import { createHash } from "node:crypto";

import { getElement, type AvatarShape, type ElementId, type PlayerAvatar } from "@last-stand/shared";

/**
 * Avatar shape is still a deterministic-per-player placeholder (P12) - it
 * exists purely so two players with the same element are still visually
 * distinguishable from each other. Color is no longer arbitrary: as of P15,
 * it's the player's assigned element's canonical color, so a glance at the
 * roster or map tells you who's playing what.
 */
const AVATAR_SHAPES: AvatarShape[] = ["circle", "square", "triangle", "diamond", "hexagon", "star"];

export function pickAvatarShape(playerId: string): AvatarShape {
  const hash = createHash("sha256").update(playerId).digest();

  return AVATAR_SHAPES[hash[1] % AVATAR_SHAPES.length];
}

export function buildAvatar(playerId: string, element: ElementId): PlayerAvatar {
  return {
    color: getElement(element).color,
    shape: pickAvatarShape(playerId),
  };
}
