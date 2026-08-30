import assert from "node:assert/strict";
import { test } from "node:test";

import { ISLAND_MAP } from "@last-stand/shared";

import { checkMove } from "../../src/match/movement.js";

const BASE_NOW = 1_000_000;

test("allows a move to an adjacent zone when off cooldown", () => {
  const result = checkMove({
    map: ISLAND_MAP,
    currentZoneId: "camp",
    targetZoneId: "forest",
    movementReadyAt: 0,
    now: BASE_NOW,
  });

  assert.deepEqual(result, { ok: true });
});

test("rejects a move to a non-adjacent zone", () => {
  const result = checkMove({
    map: ISLAND_MAP,
    currentZoneId: "beach",
    targetZoneId: "abandoned-house",
    movementReadyAt: 0,
    now: BASE_NOW,
  });

  assert.deepEqual(result, { ok: false, reason: "not_adjacent" });
});

test("rejects a move while still on cooldown", () => {
  const result = checkMove({
    map: ISLAND_MAP,
    currentZoneId: "camp",
    targetZoneId: "forest",
    movementReadyAt: BASE_NOW + 5_000,
    now: BASE_NOW,
  });

  assert.deepEqual(result, { ok: false, reason: "on_cooldown" });
});

test("allows a move exactly at the cooldown boundary", () => {
  const result = checkMove({
    map: ISLAND_MAP,
    currentZoneId: "camp",
    targetZoneId: "forest",
    movementReadyAt: BASE_NOW,
    now: BASE_NOW,
  });

  assert.deepEqual(result, { ok: true });
});

test("rejects a move to an unknown zone id", () => {
  const result = checkMove({
    map: ISLAND_MAP,
    currentZoneId: "camp",
    targetZoneId: "moon-base",
    movementReadyAt: 0,
    now: BASE_NOW,
  });

  assert.deepEqual(result, { ok: false, reason: "unknown_zone" });
});

test("rejects a move to the zone the player is already in", () => {
  const result = checkMove({
    map: ISLAND_MAP,
    currentZoneId: "camp",
    targetZoneId: "camp",
    movementReadyAt: 0,
    now: BASE_NOW,
  });

  assert.deepEqual(result, { ok: false, reason: "already_in_zone" });
});
