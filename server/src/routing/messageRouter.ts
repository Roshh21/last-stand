import type { MessageEnvelope } from "@last-stand/shared";

import type { Session } from "../session/types.js";
import type { RouterContext } from "./context.js";
import { handleBugReportSubmit } from "./handlers/bugReportHandlers.js";
import { handleMatchMove } from "./handlers/matchHandlers.js";
import { handlePing } from "./handlers/pingHandlers.js";
import {
  handleRoomChatSend,
  handleRoomCreate,
  handleRoomJoin,
  handleRoomLeave,
  handleRoomSetReady,
  handleRoomStart,
} from "./handlers/roomHandlers.js";

/**
 * Dispatches an already-parsed, already-session-attached message to its
 * handler. `session:hello` is handled one level up (in ConnectionManager)
 * since it's the one message type allowed *before* a session exists.
 */
export function routeMessage(ctx: RouterContext, session: Session, message: MessageEnvelope): void {
  switch (message.type) {
    case "ping":
      handlePing(ctx, session);
      break;

    case "room:create":
      handleRoomCreate(ctx, session);
      break;

    case "room:join":
      handleRoomJoin(ctx, session, message.payload);
      break;

    case "room:setReady":
      handleRoomSetReady(ctx, session, message.payload);
      break;

    case "room:leave":
      handleRoomLeave(ctx, session);
      break;

    case "room:start":
      handleRoomStart(ctx, session);
      break;

    case "room:chat:send":
      handleRoomChatSend(ctx, session, message.payload);
      break;

    case "match:move":
      handleMatchMove(ctx, session, message.payload);
      break;

    case "bugReport:submit":
      handleBugReportSubmit(ctx, session, message.payload);
      break;

    default:
      // Unknown or not-yet-implemented message type - ignore rather than crash.
      break;
  }
}
