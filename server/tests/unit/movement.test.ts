import assert from "node:assert/strict";
import { test } from "node:test";

import { ISLAND_MAP } from "@last-stand/shared";

import { checkMove, type MovementCheckInput } from "../../src/match/movement.js";

const BASE_NOW = 1_000_000;

function baseInput(overrides: Partial<MovementCheckInput> = {}): MovementCheckInput {
  return {
    map: ISLAND_MAP,
    currentZoneId: "camp",
    targetZoneId: "forest",
    movementReadyAt: 0,
    now: BASE_NOW,
    targetZoneBlocked: false,
    ...overrides,
  };
}

test("allows a move to an adjacent zone when off cooldown", () => {
  assert.deepEqual(checkMove(baseInput()), { ok: true });
});

test("rejects a move to a non-adjacent zone", () => {
  const result = checkMove(baseInput({ currentZoneId: "beach", targetZoneId: "abandoned-house" }));

  assert.deepEqual(result, { ok: false, reason: "not_adjacent" });
});

test("rejects a move while still on cooldown", () => {
  const result = checkMove(baseInput({ movementReadyAt: BASE_NOW + 5_000 }));

  assert.deepEqual(result, { ok: false, reason: "on_cooldown" });
});

test("allows a move exactly at the cooldown boundary", () => {
  const result = checkMove(baseInput({ movementReadyAt: BASE_NOW }));

  assert.deepEqual(result, { ok: true });
});

test("rejects a move to an unknown zone id", () => {
  const result = checkMove(baseInput({ targetZoneId: "moon-base" }));

  assert.deepEqual(result, { ok: false, reason: "unknown_zone" });
});

test("rejects a move to the zone the player is already in", () => {
  const result = checkMove(baseInput({ targetZoneId: "camp" }));

  assert.deepEqual(result, { ok: false, reason: "already_in_zone" });
});

test("rejects a move into a blocked zone even if otherwise legal", () => {
  const result = checkMove(baseInput({ targetZoneBlocked: true }));

  assert.deepEqual(result, { ok: false, reason: "zone_blocked" });
});

test("cooldown is still checked before the blocked-zone check", () => {
  const result = checkMove(
    baseInput({ targetZoneBlocked: true, movementReadyAt: BASE_NOW + 5_000 }),
  );

  assert.deepEqual(result, { ok: false, reason: "on_cooldown" });
});
