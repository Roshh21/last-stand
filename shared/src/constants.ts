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

/** Lobby size bounds. 5 is Island's real minimum - see docs/teams-and-roles.md ("5 players -> one team, one traitor"). */
export const MIN_ROOM_PLAYERS = 5;
export const MAX_ROOM_PLAYERS = 50;

/** Authoritative match tick rate (P8: "roughly every 100-250ms"). */
export const MATCH_TICK_INTERVAL_MS = 150;

/** Short countdown between "Start Game" and the match actually beginning. */
export const MATCH_START_COUNTDOWN_MS = 3000;

/** How long a disconnected player has to reconnect before being treated as gone. */
export const DISCONNECT_TIMEOUT_MS = 30_000;

/** Zone-to-zone travel isn't instant; this is both the animation length and the move cooldown. */
export const MOVEMENT_COOLDOWN_MS = 1500;

/** Elemental ability cooldown (P16). Longer than movement - abilities should feel more deliberate. */
export const ABILITY_COOLDOWN_MS = 4000;

/** Normal-case task contribution per ability use (P22: "advances progress by a defined amount (e.g. +25%)"). */
export const TASK_NORMAL_CONTRIBUTION = 25;

/**
 * Subtle-sabotage-case contribution (P22): still positive (a full no-op
 * would be an obvious tell), but noticeably smaller, plus hidden instability
 * that's never surfaced to any client. Nothing in P15-P24 ever sets a player
 * into this path - it's a hook Stage F's real traitor assignment will call
 * into later. See docs/elements-and-abilities.md.
 */
export const TASK_SABOTAGE_CONTRIBUTION = 10;
export const TASK_SABOTAGE_INSTABILITY = 15;

/** P29: target/minimum team size. Minimum ensures every team has room for at least one loyal player alongside its traitor. */
export const TARGET_TEAM_SIZE = 6;
export const MIN_TEAM_SIZE = 2;

/** P25/P28: basic per-player spam protection, shared across all chat channels for simplicity. */
export const CHAT_RATE_LIMIT_COUNT = 5;
export const CHAT_RATE_LIMIT_WINDOW_MS = 3000;

export const MATCH_CHAT_HISTORY_LIMIT = 100;
export const MATCH_CHAT_MAX_MESSAGE_LENGTH = 280;

/** P27: private conversations are a limited strategic resource - this many *new threads* per match, not a cap on messages within one. */
export const PRIVATE_CHAT_MAX_STARTS = 3;

/** Lobby chat is a lightweight placeholder - Stage E replaces this with the real system. */
export const LOBBY_CHAT_HISTORY_LIMIT = 50;
export const LOBBY_CHAT_MAX_MESSAGE_LENGTH = 280;

/** Size (in bytes, before hex-encoding) of generated player ids / session tokens. */
export const SESSION_TOKEN_BYTES = 24;
export const PLAYER_ID_BYTES = 12;

export const NICKNAME_MIN_LENGTH = 2;
export const NICKNAME_MAX_LENGTH = 20;
