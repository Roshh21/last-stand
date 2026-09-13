import assert from "node:assert/strict";
import { test } from "node:test";

import { ELEMENTS } from "@last-stand/shared";

import { assignElements } from "../../src/match/elements.js";

function makePlayerIds(count: number): string[] {
  return Array.from({ length: count }, (_, i) => `p_${i}`);
}

test("every player gets exactly one valid element", () => {
  const playerIds = makePlayerIds(9);
  const assignments = assignElements(playerIds);

  assert.equal(assignments.size, 9);

  const validIds = new Set(ELEMENTS.map((element) => element.id));

  for (const playerId of playerIds) {
    assert.ok(validIds.has(assignments.get(playerId)!), `expected a valid element for ${playerId}`);
  }
});

test("distribution is balanced: no element is assigned to more than ceil(n/6) players", () => {
  const playerIds = makePlayerIds(20);
  const assignments = assignElements(playerIds);

  const counts = new Map<string, number>();

  for (const element of assignments.values()) {
    counts.set(element, (counts.get(element) ?? 0) + 1);
  }

  const maxAllowed = Math.ceil(20 / ELEMENTS.length);

  for (const count of counts.values()) {
    assert.ok(count <= maxAllowed, `an element got ${count} players, more than the fair share of ${maxAllowed}`);
  }
});

test("with 6 or fewer players, every element assigned is distinct", () => {
  const playerIds = makePlayerIds(6);
  const assignments = assignElements(playerIds);
  const elementsUsed = new Set(assignments.values());

  assert.equal(elementsUsed.size, 6);
});

test("with 2 players (the dev minimum), both get an element and they may differ", () => {
  const assignments = assignElements(["a", "b"]);

  assert.equal(assignments.size, 2);
  assert.ok(assignments.get("a"));
  assert.ok(assignments.get("b"));
});
