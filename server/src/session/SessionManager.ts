import { EventEmitter } from "node:events";

import {
  DISCONNECT_TIMEOUT_MS,
  createMessage,
  isValidNickname,
  sanitizeNickname,
  type MessageType,
} from "@last-stand/shared";
import type { WebSocket } from "ws";

import { generatePlayerId, generateSessionToken } from "../utils/id.js";
import type { Session } from "./types.js";

export type SessionHelloResult =
  | { outcome: "created"; session: Session }
  | { outcome: "resumed"; session: Session; replacedPreviousSocket: boolean }
  | { outcome: "error"; code: "nickname_required" | "nickname_invalid" | "invalid_token" };

/**
 * Owns every player's stable identity (playerId + sessionToken), independent
 * of any one WebSocket connection. Rooms and Matches key player state off
 * `playerId`, never off the socket, so a refresh/reconnect never duplicates
 * a player.
 *
 * Emits:
 *  - "disconnected" (session)  -> socket dropped, grace period started
 *  - "reconnected"  (session)  -> a new socket reattached before it expired
 *  - "expired"       (session) -> grace period elapsed with no reconnect
 */
export class SessionManager extends EventEmitter {
  private readonly sessionsByToken = new Map<string, Session>();
  private readonly tokenByPlayerId = new Map<string, string>();

  handleHello(params: { sessionToken?: string; nickname?: string }): SessionHelloResult {
    const { sessionToken, nickname } = params;

    if (sessionToken) {
      const existing = this.sessionsByToken.get(sessionToken);

      if (existing) {
        const replacedPreviousSocket = existing.connected;

        this.clearDisconnectTimer(existing);
        existing.connected = true;
        existing.disconnectedAt = null;

        return { outcome: "resumed", session: existing, replacedPreviousSocket };
      }

      // Unknown/expired token - fall through and require a nickname to start fresh.
    }

    if (!nickname) {
      return { outcome: "error", code: "nickname_required" };
    }

    const cleanNickname = sanitizeNickname(nickname);

    if (!isValidNickname(cleanNickname)) {
      return { outcome: "error", code: "nickname_invalid" };
    }

    const session: Session = {
      playerId: generatePlayerId(),
      sessionToken: generateSessionToken(),
      nickname: cleanNickname,
      socket: null,
      connected: true,
      disconnectedAt: null,
      disconnectTimer: null,
      roomCode: null,
      matchId: null,
      createdAt: Date.now(),
      userAgent: "",
    };

    this.sessionsByToken.set(session.sessionToken, session);
    this.tokenByPlayerId.set(session.playerId, session.sessionToken);

    return { outcome: "created", session };
  }

  /** Attaches a live socket to a session, closing/kicking any previous one. */
  attachSocket(session: Session, socket: WebSocket, userAgent = ""): void {
    if (session.socket && session.socket !== socket && session.socket.readyState === socket.OPEN) {
      this.send(session.socket, "session:error", {
        code: "invalid_token",
        message: "This session was opened in another tab or window.",
      });
      session.socket.close(4001, "session-replaced");
    }

    session.socket = socket;
    session.connected = true;
    session.disconnectedAt = null;

    if (userAgent) {
      session.userAgent = userAgent;
    }
  }

  /**
   * Emits "reconnected" for a resumed session. Called explicitly by the
   * connection layer *after* attachSocket, so anything reacting to this
   * event (e.g. broadcasting updated room state) can already reach the
   * reconnecting player's own socket too.
   */
  notifyReconnected(session: Session): void {
    this.emit("reconnected", session);
  }

  handleSocketClosed(session: Session): void {
    if (session.socket) {
      session.socket = null;
    }

    session.connected = false;
    session.disconnectedAt = Date.now();

    this.emit("disconnected", session);

    this.clearDisconnectTimer(session);
    session.disconnectTimer = setTimeout(() => {
      this.expireSession(session);
    }, DISCONNECT_TIMEOUT_MS);
  }

  private expireSession(session: Session): void {
    // A reconnect may have raced the timer; only expire if still disconnected.
    if (session.connected) {
      return;
    }

    this.sessionsByToken.delete(session.sessionToken);
    this.tokenByPlayerId.delete(session.playerId);

    this.emit("expired", session);
  }

  private clearDisconnectTimer(session: Session): void {
    if (session.disconnectTimer) {
      clearTimeout(session.disconnectTimer);
      session.disconnectTimer = null;
    }
  }

  getBySessionToken(sessionToken: string): Session | undefined {
    return this.sessionsByToken.get(sessionToken);
  }

  getByPlayerId(playerId: string): Session | undefined {
    const token = this.tokenByPlayerId.get(playerId);

    return token ? this.sessionsByToken.get(token) : undefined;
  }

  /** Sends a typed message to a session's live socket, if it currently has one. */
  send<TPayload>(socket: WebSocket, type: MessageType, payload: TPayload): void {
    if (socket.readyState !== socket.OPEN) {
      return;
    }

    socket.send(JSON.stringify(createMessage(type, payload)));
  }

  sendToSession<TPayload>(session: Session, type: MessageType, payload: TPayload): void {
    if (!session.socket) {
      return;
    }

    this.send(session.socket, type, payload);
  }
}
