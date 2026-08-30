import {
  isValidZoneId,
  isZoneAdjacent,
  type IslandMapDefinition,
  type MoveRejectReason,
} from "@last-stand/shared";

export interface MovementCheckInput {
  map: IslandMapDefinition;
  currentZoneId: string;
  targetZoneId: string;
  /** Server timestamp (ms) after which a move is allowed again. */
  movementReadyAt: number;
  now: number;
}

export type MovementCheckResult = { ok: true } | { ok: false; reason: MoveRejectReason };

/**
 * Pure function so it can be unit tested without spinning up a Match/socket
 * at all. The server is the only caller that matters - the client never
 * gets to assert its own position, only request a move.
 */
export function checkMove(input: MovementCheckInput): MovementCheckResult {
  const { map, currentZoneId, targetZoneId, movementReadyAt, now } = input;

  if (now < movementReadyAt) {
    return { ok: false, reason: "on_cooldown" };
  }

  if (!isValidZoneId(map, targetZoneId)) {
    return { ok: false, reason: "unknown_zone" };
  }

  if (targetZoneId === currentZoneId) {
    return { ok: false, reason: "already_in_zone" };
  }

  if (!isZoneAdjacent(map, currentZoneId, targetZoneId)) {
    return { ok: false, reason: "not_adjacent" };
  }

  return { ok: true };
}
