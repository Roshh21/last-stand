/**
 * Match types (P8, P12-P14, extended in P15-P24).
 *
 * A Match is the authoritative, tick-driven in-game state machine. It is
 * deliberately separate from Room: a Room is "people waiting to play", a
 * Match is "a game in progress". Traitors/keys/sabotage-as-a-role don't
 * exist yet (Stage F, much later) - just the world/movement layer (Stage B)
 * and now elements, abilities, and tasks (Stages C and D).
 */

import type { ElementId } from "./elements.js";
import type { TeamStateDTO } from "./teams.js";
import type { ObjectiveStateDTO, TaskStateDTO } from "./tasks.js";

export type MatchStatus = "starting" | "in_progress" | "ended";

/** Element-neutral placeholder shape; color now comes from the player's assigned element (P15). */
export type AvatarShape = "circle" | "square" | "triangle" | "diamond" | "hexagon" | "star";

export interface PlayerAvatar {
  /** Hex color - matches the player's element's canonical color as of P15. */
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
  /** P15: every player has exactly one element for the whole match. */
  element: ElementId;
  /** P16: server timestamp (ms) after which this player may use their ability again. */
  abilityReadyAt: number;
  /**
   * P29: which of the match's teams this player is on - public information,
   * shown to everyone. Their PlayerRole (loyal/traitor) is NOT here and
   * never will be - see shared/src/roles.ts and PrivateMatchStateDTO.
   */
  teamId: string;
}

/** Per-match dynamic zone state (P17/P18) - separate from the static shared island map. */
export interface ZoneRuntimeStateDTO {
  zoneId: string;
  /** Set/cleared by Fire/Water/Nature/Earth/Wind abilities. Movement into a blocked zone is rejected. */
  blocked: boolean;
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
  teams: TeamStateDTO[];
  zones: ZoneRuntimeStateDTO[];
  tasks: TaskStateDTO[];
  objective: ObjectiveStateDTO;
}

export type MoveRejectReason =
  | "not_in_match"
  | "match_not_in_progress"
  | "on_cooldown"
  | "unknown_zone"
  | "not_adjacent"
  | "already_in_zone"
  | "zone_blocked";
