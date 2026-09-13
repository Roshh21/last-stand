import { randomInt } from "node:crypto";

import { ELEMENTS, type ElementId } from "@last-stand/shared";

/**
 * P15: "server-side random assignment on match start, balanced across each
 * team." There are no teams yet (Stage F, P29+) - this balances across the
 * whole match's player pool instead, which is the closest honest reading
 * available today. Once Stage F introduces teams, this should be called
 * once per team rather than once per match.
 *
 * Round-robins through a shuffled element order so counts differ by at most
 * one across the match, rather than assigning uniformly at random (which
 * could - by chance - give everyone the same element).
 */
export function assignElements(playerIds: string[]): Map<string, ElementId> {
  const shuffledPlayerIds = shuffle(playerIds);
  const elementCycle = shuffle(ELEMENTS.map((element) => element.id));
  const assignments = new Map<string, ElementId>();

  shuffledPlayerIds.forEach((playerId, index) => {
    assignments.set(playerId, elementCycle[index % elementCycle.length]);
  });

  return assignments;
}

function shuffle<T>(items: T[]): T[] {
  const result = [...items];

  for (let i = result.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);

    [result[i], result[j]] = [result[j], result[i]];
  }

  return result;
}
