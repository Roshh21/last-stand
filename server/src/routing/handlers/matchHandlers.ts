import type { MatchMovePayload } from "@last-stand/shared";

import type { Session } from "../../session/types.js";
import type { RouterContext } from "../context.js";

export function handleMatchMove(ctx: RouterContext, session: Session, payload: unknown): void {
  const targetZoneId = typeof (payload as MatchMovePayload | undefined)?.targetZoneId === "string"
    ? (payload as MatchMovePayload).targetZoneId
    : "";

  if (!targetZoneId) {
    return;
  }

  const result = ctx.matchManager.handleMove(session, targetZoneId);

  if (!result.ok) {
    ctx.sessionManager.sendToSession(session, "match:moveRejected", {
      reason: result.reason,
      targetZoneId,
    });
  }

  // On success there's no separate ack - the next tick's match:snapshot
  // (at most MATCH_TICK_INTERVAL_MS away) carries the new authoritative position.
}
