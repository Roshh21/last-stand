/**
 * Match types (P8, P12-P14).
 *
 * A Match is the authoritative, tick-driven in-game state machine. It is
 * deliberately separate from Room: a Room is "people waiting to play", a
 * Match is "a game in progress". No real game mechanics (abilities, tasks,
 * traitors, ...) live here yet - just the skeleton those systems will plug
 * into, plus the world/movement layer from Stage B.
 */

export type MatchStatus = "starting" | "in_progress" | "ended";

/** Element-neutral placeholder identity. Real elemental abilities are Stage C (P15+). */
export type AvatarShape = "circle" | "square" | "triangle" | "diamond" | "hexagon" | "star";

export interface PlayerAvatar {
  /** Hex color, e.g. "#4f8ef7". */
  color: string;
  shape: AvatarShape;
}

export interface PlayerMovementState {
  fromZoneId: string;
  toZoneId: string;
  startedAt: number;
  durationMs: number;
}

export interface MatchPlayerState {
  playerId: string;
  nickname: string;
  connected: boolean;
  /** Placeholder for the future eliminated/spectator state (P42). Always false for now. */
  spectator: boolean;
  avatar: PlayerAvatar;
  zoneId: string;
  /** Present while the player is mid-transit between zones (for client interpolation). */
  movement: PlayerMovementState | null;
  /** Server timestamp (ms) after which this player may issue another move. */
  movementReadyAt: number;
}

export interface MatchSnapshotDTO {
  matchId: string;
  status: MatchStatus;
  mapId: string;
  tick: number;
  serverTime: number;
  /** Only meaningful while status === "starting". */
  startsAt: number | null;
  players: MatchPlayerState[];
}

export type MoveRejectReason =
  | "not_in_match"
  | "match_not_in_progress"
  | "on_cooldown"
  | "unknown_zone"
  | "not_adjacent"
  | "already_in_zone";
