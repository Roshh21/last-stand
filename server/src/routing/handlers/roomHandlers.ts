import type {
  RoomChatSendPayload,
  RoomErrorCode,
  RoomJoinPayload,
  RoomSetReadyPayload,
} from "@last-stand/shared";

import type { Room } from "../../rooms/Room.js";
import type { Session } from "../../session/types.js";
import type { RouterContext } from "../context.js";

function roomErrorMessage(code: RoomErrorCode): string {
  switch (code) {
    case "invalid_code":
      return "That room code doesn't look right.";
    case "invalid_input":
      return "That message couldn't be sent.";
    case "room_not_found":
      return "No room with that code is open right now.";
    case "room_full":
      return "That room is already full.";
    case "already_in_room":
      return "You're already in a room. Leave it first.";
    case "not_in_room":
      return "You're not currently in a room.";
    case "not_host":
      return "Only the host can do that.";
    case "not_enough_ready":
      return "Everyone needs to be ready before the game can start.";
    case "already_started":
      return "This room has already started.";
    case "no_session":
      return "Your session isn't ready yet.";
    default:
      return "Something went wrong.";
  }
}

function sendRoomError(ctx: RouterContext, session: Session, code: RoomErrorCode): void {
  ctx.sessionManager.sendToSession(session, "room:error", {
    code,
    message: roomErrorMessage(code),
  });
}

function broadcastRoomState(ctx: RouterContext, room: Room): void {
  ctx.roomManager.broadcast(room, "room:state", ctx.roomManager.toDTO(room));
}

export function handleRoomCreate(ctx: RouterContext, session: Session): void {
  const result = ctx.roomManager.createRoom(session);

  if (!result.ok) {
    sendRoomError(ctx, session, result.code);

    return;
  }

  ctx.sessionManager.sendToSession(session, "room:state", ctx.roomManager.toDTO(result.value));
}

export function handleRoomJoin(ctx: RouterContext, session: Session, payload: unknown): void {
  const code = typeof (payload as RoomJoinPayload | undefined)?.code === "string"
    ? (payload as RoomJoinPayload).code
    : "";

  if (!code) {
    sendRoomError(ctx, session, "invalid_code");

    return;
  }

  const result = ctx.roomManager.joinRoom(session, code);

  if (!result.ok) {
    sendRoomError(ctx, session, result.code);

    return;
  }

  broadcastRoomState(ctx, result.value);
  ctx.sessionManager.sendToSession(session, "room:chat:history", result.value.getChatHistory());
}

export function handleRoomSetReady(ctx: RouterContext, session: Session, payload: unknown): void {
  const ready = Boolean((payload as RoomSetReadyPayload | undefined)?.ready);
  const result = ctx.roomManager.setReady(session, ready);

  if (!result.ok) {
    sendRoomError(ctx, session, result.code);

    return;
  }

  broadcastRoomState(ctx, result.value);
}

export function handleRoomLeave(ctx: RouterContext, session: Session): void {
  const result = ctx.roomManager.leaveRoom(session);

  if (!result.ok) {
    sendRoomError(ctx, session, result.code);

    return;
  }

  if (result.value) {
    broadcastRoomState(ctx, result.value);
  }
}

export function handleRoomChatSend(ctx: RouterContext, session: Session, payload: unknown): void {
  const text = typeof (payload as RoomChatSendPayload | undefined)?.text === "string"
    ? (payload as RoomChatSendPayload).text
    : "";

  const result = ctx.roomManager.sendChat(session, text);

  if (!result.ok) {
    sendRoomError(ctx, session, result.code);

    return;
  }

  const room = ctx.roomManager.getRoomForSession(session);

  if (room) {
    ctx.roomManager.broadcast(room, "room:chat:message", result.value);
  }
}

export function handleRoomStart(ctx: RouterContext, session: Session): void {
  const result = ctx.roomManager.beginStart(session);

  if (!result.ok) {
    sendRoomError(ctx, session, result.code);

    return;
  }

  const room = result.value;
  const match = ctx.matchManager.createMatchFromRoom(room);

  ctx.roomManager.closeRoom(room);

  for (const playerId of match.getPlayerIds()) {
    const playerSession = ctx.sessionManager.getByPlayerId(playerId);

    if (playerSession) {
      ctx.sessionManager.sendToSession(playerSession, "match:started", {
        matchId: match.matchId,
        startsAt: match.startsAt,
      });
    }
  }
}
