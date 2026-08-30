import type { BugReportInput } from "@last-stand/shared";

import { APP_VERSION } from "../../config.js";
import type { Session } from "../../session/types.js";
import type { RouterContext } from "../context.js";

function cleanField(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

export function handleBugReportSubmit(ctx: RouterContext, session: Session, payload: unknown): void {
  const input = payload as Partial<BugReportInput> | undefined;
  const description = cleanField(input?.description);

  if (!description) {
    ctx.sessionManager.sendToSession(session, "bugReport:error", {
      code: "invalid_input",
      message: "A description is required.",
    });

    return;
  }

  const record = ctx.bugReportStore.save(
    {
      description,
      whatWasHappening: cleanField(input?.whatWasHappening),
      expectedResult: cleanField(input?.expectedResult),
      actualResult: cleanField(input?.actualResult),
    },
    {
      playerId: session.playerId,
      nickname: session.nickname,
      matchId: session.matchId,
      roomCode: session.roomCode,
      appVersion: APP_VERSION,
      userAgent: session.userAgent,
      submittedAt: Date.now(),
    },
  );

  ctx.sessionManager.sendToSession(session, "bugReport:ack", {
    id: record.id,
    submittedAt: record.submittedAt,
  });
}
