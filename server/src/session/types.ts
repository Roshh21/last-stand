import type { WebSocket } from "ws";

/**
 * Internal server representation of a player's session. Not the same as
 * SessionInfoDTO/SessionResumedDTO - those are the wire-format views sent to
 * clients; this holds the live socket and bookkeeping the server needs.
 */
export interface Session {
  playerId: string;
  sessionToken: string;
  nickname: string;
  socket: WebSocket | null;
  connected: boolean;
  disconnectedAt: number | null;
  disconnectTimer: NodeJS.Timeout | null;
  roomCode: string | null;
  matchId: string | null;
  createdAt: number;
  /** Captured from the WebSocket upgrade request; used for bug report metadata. */
  userAgent: string;
}
