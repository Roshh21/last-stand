import type { PlayerReportInput } from "@last-stand/shared";

import type { Session } from "../../session/types.js";
import type { RouterContext } from "../context.js";

export function handleModerationReport(ctx: RouterContext, session: Session, payload: unknown): void {
  const input = payload as Partial<PlayerReportInput> | undefined;
  const targetPlayerId = typeof input?.targetPlayerId === "string" ? input.targetPlayerId : "";
  const reason = typeof input?.reason === "string" ? input.reason.trim() : "";

  if (!targetPlayerId || !reason) {
    return;
  }

  const record = ctx.playerReportStore.save(
    { targetPlayerId, reason },
    {
      reporterId: session.playerId,
      reporterNickname: session.nickname,
      matchId: session.matchId,
      submittedAt: Date.now(),
    },
  );

  ctx.sessionManager.sendToSession(session, "moderation:reportAck", { id: record.id });
}
