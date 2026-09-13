import type {
  ChatRejectReason,
  MatchChatSendPayload,
  PrivateChatOpenPayload,
  PrivateChatSendPayload,
  PrivateChatSignalPayload,
  TraitorChatSendPayload,
} from "@last-stand/shared";

import type { Session } from "../../session/types.js";
import type { RouterContext } from "../context.js";

function sendChatRejected(ctx: RouterContext, session: Session, reason: ChatRejectReason): void {
  ctx.sessionManager.sendToSession(session, "match:chat:rejected", { reason });
}

function readTargetPlayerId(payload: unknown): string {
  const targetPlayerId = (payload as { targetPlayerId?: unknown } | undefined)?.targetPlayerId;

  return typeof targetPlayerId === "string" ? targetPlayerId : "";
}

function readText(payload: unknown): string {
  const text = (payload as { text?: unknown } | undefined)?.text;

  return typeof text === "string" ? text : "";
}

export function handleMatchChatSend(ctx: RouterContext, session: Session, payload: unknown): void {
  const input = payload as Partial<MatchChatSendPayload> | undefined;
  const text = typeof input?.text === "string" ? input.text : "";

  if (!text) {
    sendChatRejected(ctx, session, "invalid_input");

    return;
  }

  const result =
    input?.channel === "team"
      ? ctx.matchManager.handleSendTeamChat(session, text)
      : ctx.matchManager.handleSendGlobalChat(session, text);

  if (!result.ok) {
    sendChatRejected(ctx, session, result.reason);
  }
}

export function handlePrivateChatOpen(ctx: RouterContext, session: Session, payload: unknown): void {
  const targetPlayerId = readTargetPlayerId(payload as PrivateChatOpenPayload | undefined);

  if (!targetPlayerId) {
    sendChatRejected(ctx, session, "target_not_found");

    return;
  }

  const result = ctx.matchManager.handleOpenPrivateThread(session, targetPlayerId);

  if (!result.ok) {
    sendChatRejected(ctx, session, result.reason);
  }
}

export function handlePrivateChatSend(ctx: RouterContext, session: Session, payload: unknown): void {
  const input = payload as Partial<PrivateChatSendPayload> | undefined;
  const targetPlayerId = readTargetPlayerId(input);
  const text = readText(input);

  if (!targetPlayerId || !text) {
    sendChatRejected(ctx, session, "invalid_input");

    return;
  }

  const result = ctx.matchManager.handleSendPrivateChat(session, targetPlayerId, text);

  if (!result.ok) {
    sendChatRejected(ctx, session, result.reason);
  }
}

export function handlePrivateChatSignal(ctx: RouterContext, session: Session, payload: unknown): void {
  const targetPlayerId = readTargetPlayerId(payload as PrivateChatSignalPayload | undefined);

  if (!targetPlayerId) {
    sendChatRejected(ctx, session, "target_not_found");

    return;
  }

  const result = ctx.matchManager.handleSendSignal(session, targetPlayerId);

  if (!result.ok) {
    sendChatRejected(ctx, session, result.reason);
  }
}

export function handleTraitorChatSend(ctx: RouterContext, session: Session, payload: unknown): void {
  const input = payload as Partial<TraitorChatSendPayload> | undefined;
  const targetPlayerId = readTargetPlayerId(input);
  const text = readText(input);

  if (!targetPlayerId || !text) {
    sendChatRejected(ctx, session, "invalid_input");

    return;
  }

  const result = ctx.matchManager.handleSendTraitorChat(session, targetPlayerId, text);

  if (!result.ok) {
    sendChatRejected(ctx, session, result.reason);
  }
}
