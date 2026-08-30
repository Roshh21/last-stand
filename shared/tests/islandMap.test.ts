import { test } from "node:test";
import assert from "node:assert/strict";

import {
  ISLAND_MAP,
  getStartZoneId,
  getZoneById,
  isValidZoneId,
  isZoneAdjacent,
  validateMapGraph,
} from "../src/map/islandMap.ts";

test("island map graph has no structural problems", () => {
  const problems = validateMapGraph(ISLAND_MAP);

  assert.deepEqual(problems, []);
});

test("getZoneById finds a known zone and returns undefined for an unknown one", () => {
  assert.equal(getZoneById(ISLAND_MAP, "camp")?.name, "Camp");
  assert.equal(getZoneById(ISLAND_MAP, "nonexistent"), undefined);
});

test("isValidZoneId reflects the zone list", () => {
  assert.equal(isValidZoneId(ISLAND_MAP, "forest"), true);
  assert.equal(isValidZoneId(ISLAND_MAP, "moon-base"), false);
});

test("isZoneAdjacent is true for connected zones", () => {
  assert.equal(isZoneAdjacent(ISLAND_MAP, "camp", "forest"), true);
  assert.equal(isZoneAdjacent(ISLAND_MAP, "camp", "dock"), true);
});

test("isZoneAdjacent is false for non-connected zones", () => {
  assert.equal(isZoneAdjacent(ISLAND_MAP, "beach", "abandoned-house"), false);
});

test("isZoneAdjacent is false from/to an unknown zone", () => {
  assert.equal(isZoneAdjacent(ISLAND_MAP, "nowhere", "camp"), false);
  assert.equal(isZoneAdjacent(ISLAND_MAP, "camp", "nowhere"), false);
});

test("exactly one start zone exists and getStartZoneId returns it", () => {
  const startZoneId = getStartZoneId(ISLAND_MAP);

  assert.equal(startZoneId, "camp");
});

test("connections are mutual across the whole graph", () => {
  for (const zone of ISLAND_MAP.zones) {
    for (const neighborId of zone.connections) {
      assert.equal(
        isZoneAdjacent(ISLAND_MAP, neighborId, zone.id),
        true,
        `${neighborId} should connect back to ${zone.id}`,
      );
    }
  }
});
