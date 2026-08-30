import type { IncomingMessage } from "node:http";

import { isMessageEnvelope, type MessageEnvelope, type SessionErrorCode } from "@last-stand/shared";
import type { RawData, WebSocket } from "ws";

import type { RouterContext } from "../routing/context.js";
import { resolveSessionLocation, sendRehydration } from "../routing/rehydrate.js";
import { routeMessage } from "../routing/messageRouter.js";
import type { Session } from "../session/types.js";

function helloErrorMessage(code: SessionErrorCode): string {
  switch (code) {
    case "nickname_required":
      return "A nickname is required to start a new session.";
    case "nickname_invalid":
      return "That nickname isn't valid (2-20 characters).";
    case "invalid_token":
      return "Your session could not be resumed. Please pick a nickname again.";
    default:
      return "Could not establish a session.";
  }
}

/**
 * Bridges raw WebSocket connections into the session/routing layer. Every
 * connection starts with no session attached; the first message must be
 * `session:hello` (P7) before anything else is accepted.
 */
export class ConnectionManager {
  private readonly socketSessions = new WeakMap<WebSocket, Session>();
  private readonly ctx: RouterContext;

  constructor(ctx: RouterContext) {
    this.ctx = ctx;
  }

  handleConnection(socket: WebSocket, request: IncomingMessage): void {
    const userAgent = request.headers["user-agent"] ?? "";

    socket.on("message", (raw) => this.handleRawMessage(socket, raw, userAgent));
    socket.on("close", () => this.handleClose(socket));
    socket.on("error", (error) => console.error("[ws] socket error:", error));
  }

  private handleRawMessage(socket: WebSocket, raw: RawData, userAgent: string): void {
    let parsed: unknown;

    try {
      parsed = JSON.parse(raw.toString());
    } catch {
      return; // silently drop malformed input
    }

    if (!isMessageEnvelope(parsed)) {
      return;
    }

    const session = this.socketSessions.get(socket);

    if (!session) {
      if (parsed.type !== "session:hello") {
        this.ctx.sessionManager.send(socket, "session:error", {
          code: "invalid_token",
          message: "Send session:hello before anything else.",
        });

        return;
      }

      this.handleHello(socket, parsed, userAgent);

      return;
    }

    routeMessage(this.ctx, session, parsed);
  }

  private handleHello(socket: WebSocket, message: MessageEnvelope, userAgent: string): void {
    const payload = (message.payload ?? {}) as { sessionToken?: string; nickname?: string };
    const result = this.ctx.sessionManager.handleHello(payload);

    if (result.outcome === "error") {
      this.ctx.sessionManager.send(socket, "session:error", {
        code: result.code,
        message: helloErrorMessage(result.code),
      });

      return;
    }

    this.ctx.sessionManager.attachSocket(result.session, socket, userAgent);
    this.socketSessions.set(socket, result.session);

    if (result.outcome === "created") {
      this.ctx.sessionManager.send(socket, "session:created", {
        playerId: result.session.playerId,
        nickname: result.session.nickname,
        sessionToken: result.session.sessionToken,
      });

      return;
    }

    this.ctx.sessionManager.send(socket, "session:resumed", {
      playerId: result.session.playerId,
      nickname: result.session.nickname,
      sessionToken: result.session.sessionToken,
      location: resolveSessionLocation(this.ctx, result.session),
    });

    sendRehydration(this.ctx, result.session);
    this.ctx.sessionManager.notifyReconnected(result.session);
  }

  private handleClose(socket: WebSocket): void {
    const session = this.socketSessions.get(socket);

    if (!session) {
      return;
    }

    this.socketSessions.delete(socket);
    this.ctx.sessionManager.handleSocketClosed(session);
  }
}
