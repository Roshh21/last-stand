import {
  canStartRoom,
  isValidChatText,
  sanitizeChatText,
  type LobbyChatMessageDTO,
  type RoomErrorCode,
  type RoomPlayerDTO,
  type RoomStateDTO,
} from "@last-stand/shared";

import type { SessionManager } from "../session/SessionManager.js";
import type { Session } from "../session/types.js";
import { generateMessageId, generateRoomCode } from "../utils/id.js";
import { Room } from "./Room.js";

export type RoomResult<T = Room> = { ok: true; value: T } | { ok: false; code: RoomErrorCode };

const ROOM_CODE_PATTERN = /^[A-Z0-9]{4,8}$/;

/**
 * Owns every open Room and the rules for creating/joining/readying/leaving/
 * starting one. Never trusts a client-sent value for anything authoritative
 * (room membership, ready flags, host status) - every mutation here is
 * derived from the session making the request.
 */
export class RoomManager {
  private readonly roomsByCode = new Map<string, Room>();
  private readonly sessionManager: SessionManager;

  constructor(sessionManager: SessionManager) {
    this.sessionManager = sessionManager;
  }

  createRoom(session: Session): RoomResult {
    if (session.roomCode || session.matchId) {
      return { ok: false, code: "already_in_room" };
    }

    let code = generateRoomCode();

    while (this.roomsByCode.has(code)) {
      code = generateRoomCode();
    }

    const room = new Room({ roomId: `r_${code}`, code, hostPlayerId: session.playerId });

    room.addPlayer(session.playerId);
    this.roomsByCode.set(code, room);
    session.roomCode = code;

    return { ok: true, value: room };
  }

  joinRoom(session: Session, rawCode: string): RoomResult {
    if (session.roomCode || session.matchId) {
      return { ok: false, code: "already_in_room" };
    }

    const code = rawCode.trim().toUpperCase();

    if (!ROOM_CODE_PATTERN.test(code)) {
      return { ok: false, code: "invalid_code" };
    }

    const room = this.roomsByCode.get(code);

    if (!room) {
      return { ok: false, code: "room_not_found" };
    }

    if (room.status !== "open") {
      return { ok: false, code: "already_started" };
    }

    if (room.players.size >= room.maxPlayers) {
      return { ok: false, code: "room_full" };
    }

    room.addPlayer(session.playerId);
    session.roomCode = code;

    return { ok: true, value: room };
  }

  setReady(session: Session, ready: boolean): RoomResult {
    const room = this.requireRoom(session);

    if (!room.ok) {
      return room;
    }

    room.value.setReady(session.playerId, ready);

    return room;
  }

  /**
   * Removes a player from whatever room they're in. Safe to call for a
   * player who isn't in a room (no-op). Used for explicit leaves, socket
   * disconnect+expiry cleanup, and after a match starts.
   */
  removeFromRoom(session: Session): Room | null {
    const code = session.roomCode;

    if (!code) {
      return null;
    }

    const room = this.roomsByCode.get(code);

    session.roomCode = null;

    if (!room) {
      return null;
    }

    room.removePlayer(session.playerId);

    if (room.isEmpty) {
      this.roomsByCode.delete(code);

      return null;
    }

    room.reassignHostIfNeeded();

    return room;
  }

  leaveRoom(session: Session): RoomResult<Room | null> {
    if (!session.roomCode) {
      return { ok: false, code: "not_in_room" };
    }

    return { ok: true, value: this.removeFromRoom(session) };
  }

  /** Validates the start request and, if valid, marks the room as starting. */
  beginStart(session: Session): RoomResult {
    const roomResult = this.requireRoom(session);

    if (!roomResult.ok) {
      return roomResult;
    }

    const room = roomResult.value;

    if (room.status !== "open") {
      return { ok: false, code: "already_started" };
    }

    if (room.hostPlayerId !== session.playerId) {
      return { ok: false, code: "not_host" };
    }

    if (!canStartRoom(this.toDTO(room))) {
      return { ok: false, code: "not_enough_ready" };
    }

    room.status = "starting";

    return { ok: true, value: room };
  }

  /** Removes a room from the joinable set entirely (called once its match exists). */
  closeRoom(room: Room): void {
    this.roomsByCode.delete(room.code);
    room.status = "in_game";
  }

  sendChat(session: Session, rawText: string): RoomResult<LobbyChatMessageDTO> {
    const roomResult = this.requireRoom(session);

    if (!roomResult.ok) {
      return roomResult;
    }

    const text = sanitizeChatText(rawText);

    if (!isValidChatText(text)) {
      return { ok: false, code: "invalid_code" }; // reused: generic "bad input" for this room action
    }

    const message: LobbyChatMessageDTO = {
      id: generateMessageId(),
      playerId: session.playerId,
      nickname: session.nickname,
      text,
      sentAt: Date.now(),
    };

    roomResult.value.addChatMessage(message);

    return { ok: true, value: message };
  }

  getRoomByCode(code: string): Room | undefined {
    return this.roomsByCode.get(code);
  }

  getRoomForSession(session: Session): Room | undefined {
    return session.roomCode ? this.roomsByCode.get(session.roomCode) : undefined;
  }

  private requireRoom(session: Session): RoomResult {
    const room = this.getRoomForSession(session);

    if (!room) {
      return { ok: false, code: "not_in_room" };
    }

    return { ok: true, value: room };
  }

  toDTO(room: Room): RoomStateDTO {
    const players: RoomPlayerDTO[] = [...room.players.values()]
      .sort((a, b) => a.joinedAt - b.joinedAt)
      .map((record) => {
        const playerSession = this.sessionManager.getByPlayerId(record.playerId);

        return {
          playerId: record.playerId,
          nickname: playerSession?.nickname ?? "(disconnected)",
          connected: playerSession?.connected ?? false,
          ready: record.ready,
          isHost: record.playerId === room.hostPlayerId,
          joinedAt: record.joinedAt,
        };
      });

    return {
      roomId: room.roomId,
      code: room.code,
      status: room.status,
      hostPlayerId: room.hostPlayerId,
      minPlayers: room.minPlayers,
      maxPlayers: room.maxPlayers,
      players,
      createdAt: room.createdAt,
    };
  }

  /** Sends a message to every currently-connected player in a room. */
  broadcast<TPayload>(room: Room, type: Parameters<SessionManager["send"]>[1], payload: TPayload): void {
    for (const playerId of room.players.keys()) {
      const playerSession = this.sessionManager.getByPlayerId(playerId);

      if (playerSession) {
        this.sessionManager.sendToSession(playerSession, type, payload);
      }
    }
  }
}
