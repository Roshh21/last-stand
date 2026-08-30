/**
 * Tunable constants shared by client and server.
 *
 * These are deliberately conservative "dev scaffold" defaults for the
 * infrastructure phases (P4-P14). Game-specific tuning (Island's real
 * player counts, team sizes, etc.) happens in later stages and should
 * override these rather than this file growing speculative options.
 */

/** Room codes are short, human-shareable, and exclude ambiguous characters. */
export const ROOM_CODE_LENGTH = 5;
export const ROOM_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

/** Lobby size bounds. Island's real target range (20-50) is tuned in later stages. */
export const MIN_ROOM_PLAYERS = 2;
export const MAX_ROOM_PLAYERS = 50;

/** Authoritative match tick rate (P8: "roughly every 100-250ms"). */
export const MATCH_TICK_INTERVAL_MS = 150;

/** Short countdown between "Start Game" and the match actually beginning. */
export const MATCH_START_COUNTDOWN_MS = 3000;

/** How long a disconnected player has to reconnect before being treated as gone. */
export const DISCONNECT_TIMEOUT_MS = 30_000;

/** Zone-to-zone travel isn't instant; this is both the animation length and the move cooldown. */
export const MOVEMENT_COOLDOWN_MS = 1500;

/** Lobby chat is a lightweight placeholder - Stage E replaces this with the real system. */
export const LOBBY_CHAT_HISTORY_LIMIT = 50;
export const LOBBY_CHAT_MAX_MESSAGE_LENGTH = 280;

/** Size (in bytes, before hex-encoding) of generated player ids / session tokens. */
export const SESSION_TOKEN_BYTES = 24;
export const PLAYER_ID_BYTES = 12;

export const NICKNAME_MIN_LENGTH = 2;
export const NICKNAME_MAX_LENGTH = 20;
