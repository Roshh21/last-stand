import type { Session } from "../../session/types.js";
import type { RouterContext } from "../context.js";

export function handlePing(ctx: RouterContext, session: Session): void {
  ctx.sessionManager.sendToSession(session, "pong", {});
}
