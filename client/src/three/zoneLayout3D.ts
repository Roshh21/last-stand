import type { PlayerMovementState } from "@last-stand/shared";

export type Vec3 = [number, number, number];

/** Ground-plane positions for each zone, mirroring the 2D map's spatial layout (IslandMapSvg.tsx). */
export const ZONE_POSITIONS_3D: Record<string, Vec3> = {
  camp: [0, 0, 0],
  forest: [-15, 0, -9],
  beach: [-15, 0, 11],
  dock: [7, 0, 15],
  "power-station": [17, 0, -7],
  "abandoned-house": [17, 0, 9],
};

export function getZonePosition(zoneId: string): Vec3 {
  return ZONE_POSITIONS_3D[zoneId] ?? [0, 0, 0];
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/** Smooth in/out easing so movement doesn't look robotic. */
function easeInOutQuad(t: number): number {
  return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
}

/**
 * Reuses the server's existing `movement` field (fromZoneId/toZoneId/
 * startedAt/durationMs) - no new server data needed. The server remains
 * the sole authority on *whether* a move is legal; this only interpolates
 * *where to draw* a player who's mid-transit. Called from inside a
 * useFrame callback (the Three.js render loop), not from React state, so
 * reading `now` fresh each call is the correct place for it - not a React
 * purity concern.
 */
export function computeCharacterPosition(
  zoneId: string,
  movement: PlayerMovementState | null,
  now: number,
): Vec3 {
  if (!movement) {
    return getZonePosition(zoneId);
  }

  const { fromZoneId, toZoneId, startedAt, durationMs } = movement;
  const rawProgress = durationMs > 0 ? (now - startedAt) / durationMs : 1;
  const progress = easeInOutQuad(Math.min(1, Math.max(0, rawProgress)));

  const from = getZonePosition(fromZoneId);
  const to = getZonePosition(toZoneId);

  return [lerp(from[0], to[0], progress), lerp(from[1], to[1], progress), lerp(from[2], to[2], progress)];
}
