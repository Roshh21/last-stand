import assert from "node:assert/strict";
import { test } from "node:test";

import { KEY_PHRASES } from "@last-stand/shared";

import { assignInitialKey } from "../../src/match/key.js";

test("the key holder is always one of the given traitors", () => {
  const traitorIds = ["t1", "t2", "t3"];
  const assignment = assignInitialKey(traitorIds);

  assert.ok(traitorIds.includes(assignment.holderId));
});

test("the key content is always one of the shared phrases", () => {
  const assignment = assignInitialKey(["t1"]);

  assert.ok(KEY_PHRASES.includes(assignment.content));
});

test("a single traitor always gets the key", () => {
  const assignment = assignInitialKey(["only-traitor"]);

  assert.equal(assignment.holderId, "only-traitor");
});

test("throws if there are no traitors to hold the key", () => {
  assert.throws(() => assignInitialKey([]));
});
