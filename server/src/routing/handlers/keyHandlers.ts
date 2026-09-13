import type { KeyTransferPayload } from "@last-stand/shared";

import type { Session } from "../../session/types.js";
import type { RouterContext } from "../context.js";

export function handleKeyTransfer(ctx: RouterContext, session: Session, payload: unknown): void {
  const targetPlayerId = (payload as Partial<KeyTransferPayload> | undefined)?.targetPlayerId;

  if (typeof targetPlayerId !== "string" || !targetPlayerId) {
    return;
  }

  const result = ctx.matchManager.handleTransferKey(session, targetPlayerId);

  if (!result.ok) {
    ctx.sessionManager.sendToSession(session, "key:transferRejected", {
      reason: result.reason,
      targetPlayerId,
    });
  }

  // On success there's no direct ack - both the old and new holder's
  // match:privateState updates on the next tick.
}
