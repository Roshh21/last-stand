import type { SessionLocation } from "@last-stand/shared";

import type { Session } from "../session/types.js";
import type { RouterContext } from "./context.js";

/** Where a session currently is, so a resuming client can restore the right screen. */
export function resolveSessionLocation(ctx: RouterContext, session: Session): SessionLocation {
  if (session.matchId) {
    const match = ctx.matchManager.getMatchById(session.matchId);

    if (match) {
      return { type: "match", matchId: match.matchId, roomCode: match.originRoomCode };
    }
  }

  if (session.roomCode) {
    const room = ctx.roomManager.getRoomByCode(session.roomCode);

    if (room) {
      return { type: "room", roomCode: room.code };
    }
  }

  return { type: "none" };
}

/**
 * On a resumed connection, proactively resend whatever state the player was
 * last looking at - the lobby doesn't have its own tick loop to rely on, and
 * even for a match it's nicer not to wait up to a full tick interval.
 */
export function sendRehydration(ctx: RouterContext, session: Session): void {
  if (session.roomCode) {
    const room = ctx.roomManager.getRoomByCode(session.roomCode);

    if (room) {
      ctx.sessionManager.sendToSession(session, "room:state", ctx.roomManager.toDTO(room));
      ctx.sessionManager.sendToSession(session, "room:chat:history", room.getChatHistory());
    }
  }

  if (session.matchId) {
    const match = ctx.matchManager.getMatchById(session.matchId);

    if (match) {
      ctx.sessionManager.sendToSession(session, "match:snapshot", match.getSnapshot());
    }
  }
}
