/**
 * Session types (P7).
 *
 * A "session" is a player's stable identity: a playerId + sessionToken pair
 * that survives page refreshes and socket reconnects. It is deliberately
 * independent of any single WebSocket connection.
 */

export interface SessionInfoDTO {
  playerId: string;
  nickname: string;
  sessionToken: string;
}

/** Where a resumed session currently is, so the client can restore the right screen. */
export type SessionLocation =
  | { type: "none" }
  | { type: "room"; roomCode: string }
  | { type: "match"; matchId: string; roomCode: string | null };

export interface SessionResumedDTO extends SessionInfoDTO {
  location: SessionLocation;
}

export type SessionErrorCode = "invalid_token" | "nickname_required" | "nickname_invalid";
