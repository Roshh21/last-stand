import type { AbilityTargetKind, AbilityUsePayload } from "@last-stand/shared";

import type { Session } from "../../session/types.js";
import type { RouterContext } from "../context.js";

function isTargetKind(value: unknown): value is AbilityTargetKind {
  return value === "zone" || value === "task";
}

export function handleAbilityUse(ctx: RouterContext, session: Session, payload: unknown): void {
  const input = payload as Partial<AbilityUsePayload> | undefined;
  const targetKind = input?.targetKind;
  const targetId = typeof input?.targetId === "string" ? input.targetId : "";

  if (!isTargetKind(targetKind) || !targetId) {
    return;
  }

  const result = ctx.matchManager.handleUseAbility(session, targetKind, targetId);

  if (!result.ok) {
    ctx.sessionManager.sendToSession(session, "ability:rejected", {
      reason: result.reason,
      targetKind,
      targetId,
    });
  }

  // On success there's no direct ack - the anonymized "ability:used" event
  // (P19) and the next match:snapshot both follow separately.
}
