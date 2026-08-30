import {
  LOBBY_CHAT_HISTORY_LIMIT,
  MAX_ROOM_PLAYERS,
  MIN_ROOM_PLAYERS,
  type LobbyChatMessageDTO,
  type RoomStatus,
} from "@last-stand/shared";

export interface RoomPlayerRecord {
  playerId: string;
  ready: boolean;
  joinedAt: number;
}

/**
 * Structural room state only. Player identity fields that live on the
 * session (nickname, connected) are deliberately NOT duplicated here -
 * RoomManager reads them from SessionManager when building the outward-
 * facing RoomStateDTO, so there is exactly one place a player's
 * nickname/connection status can be wrong.
 */
export class Room {
  readonly roomId: string;
  readonly code: string;
  readonly createdAt: number;
  status: RoomStatus = "open";
  hostPlayerId: string;
  minPlayers: number = MIN_ROOM_PLAYERS;
  maxPlayers: number = MAX_ROOM_PLAYERS;

  readonly players = new Map<string, RoomPlayerRecord>();
  private readonly chatHistory: LobbyChatMessageDTO[] = [];

  constructor(params: { roomId: string; code: string; hostPlayerId: string }) {
    this.roomId = params.roomId;
    this.code = params.code;
    this.hostPlayerId = params.hostPlayerId;
    this.createdAt = Date.now();
  }

  addPlayer(playerId: string): void {
    this.players.set(playerId, { playerId, ready: false, joinedAt: Date.now() });
  }

  removePlayer(playerId: string): void {
    this.players.delete(playerId);
  }

  hasPlayer(playerId: string): boolean {
    return this.players.has(playerId);
  }

  get isEmpty(): boolean {
    return this.players.size === 0;
  }

  setReady(playerId: string, ready: boolean): void {
    const record = this.players.get(playerId);

    if (record) {
      record.ready = ready;
    }
  }

  /** Promotes the longest-standing remaining player to host. No-op if already empty. */
  reassignHostIfNeeded(): void {
    if (this.players.has(this.hostPlayerId)) {
      return;
    }

    const nextHost = [...this.players.values()].sort((a, b) => a.joinedAt - b.joinedAt)[0];

    if (nextHost) {
      this.hostPlayerId = nextHost.playerId;
    }
  }

  addChatMessage(message: LobbyChatMessageDTO): void {
    this.chatHistory.push(message);

    if (this.chatHistory.length > LOBBY_CHAT_HISTORY_LIMIT) {
      this.chatHistory.shift();
    }
  }

  getChatHistory(): LobbyChatMessageDTO[] {
    return [...this.chatHistory];
  }
}
