import { createHash } from "node:crypto";

import type { AvatarShape, PlayerAvatar } from "@last-stand/shared";

/**
 * Element-neutral placeholder identity (P12). Deliberately has nothing to do
 * with the real elemental system (Stage C, P15+) - just a color + shape so
 * players are visually distinct from each other on the map and roster.
 */
const AVATAR_COLORS = [
  "#e63946",
  "#f4a261",
  "#e9c46a",
  "#2a9d8f",
  "#457b9d",
  "#8338ec",
  "#ff006e",
  "#3a86ff",
  "#06d6a0",
  "#ef476f",
];

const AVATAR_SHAPES: AvatarShape[] = [
  "circle",
  "square",
  "triangle",
  "diamond",
  "hexagon",
  "star",
];

/** Same playerId always yields the same avatar - no server-side storage needed. */
export function assignAvatar(playerId: string): PlayerAvatar {
  const hash = createHash("sha256").update(playerId).digest();

  return {
    color: AVATAR_COLORS[hash[0] % AVATAR_COLORS.length],
    shape: AVATAR_SHAPES[hash[1] % AVATAR_SHAPES.length],
  };
}
