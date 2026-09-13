import assert from "node:assert/strict";
import { test } from "node:test";

import { TASK_NORMAL_CONTRIBUTION, TASK_SABOTAGE_CONTRIBUTION, TASK_SABOTAGE_INSTABILITY } from "@last-stand/shared";

import { checkCooperativeRequirement, resolveTaskContribution } from "../../src/match/taskContribution.js";

const TASK = { requiredElements: ["fire", "water"] as const };

test("the correct element advances progress by the normal amount with no instability", () => {
  const result = resolveTaskContribution({ task: TASK, element: "fire", isSaboteur: false });

  assert.deepEqual(result, {
    elementMatched: true,
    progressDelta: TASK_NORMAL_CONTRIBUTION,
    instabilityDelta: 0,
  });
});

test("an element the task doesn't need contributes nothing", () => {
  const result = resolveTaskContribution({ task: TASK, element: "earth", isSaboteur: false });

  assert.deepEqual(result, { elementMatched: false, progressDelta: 0, instabilityDelta: 0 });
});

test("P22: the same correct element, from a saboteur, advances less and adds hidden instability", () => {
  const normal = resolveTaskContribution({ task: TASK, element: "fire", isSaboteur: false });
  const sabotage = resolveTaskContribution({ task: TASK, element: "fire", isSaboteur: true });

  assert.equal(sabotage.elementMatched, true);
  assert.ok(sabotage.progressDelta > 0, "sabotage still nudges progress forward - a dead no-op would be an obvious tell");
  assert.ok(sabotage.progressDelta < normal.progressDelta);
  assert.equal(sabotage.instabilityDelta, TASK_SABOTAGE_INSTABILITY);
  assert.equal(normal.instabilityDelta, 0);

  // Same result shape either way - nothing distinguishes "this was sabotage"
  // as a separate flag a client could ever see.
  assert.deepEqual(Object.keys(normal).sort(), Object.keys(sabotage).sort());
});

test("sabotage contribution amount is a real, tunable constant, not zero", () => {
  const sabotage = resolveTaskContribution({ task: TASK, element: "water", isSaboteur: true });

  assert.equal(sabotage.progressDelta, TASK_SABOTAGE_CONTRIBUTION);
});

test("cooperative check passes when enough players and distinct elements are present", () => {
  const result = checkCooperativeRequirement({
    task: { minContributors: 2, requiredDistinctElements: 2 },
    elementsPresent: ["lightning", "earth"],
  });

  assert.deepEqual(result, { ok: true });
});

test("cooperative check fails for a solo player, even spamming the right element", () => {
  const result = checkCooperativeRequirement({
    task: { minContributors: 2, requiredDistinctElements: 2 },
    elementsPresent: ["lightning"],
  });

  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.playersPresent, 1);
    assert.equal(result.distinctElementsPresent, 1);
  }
});

test("cooperative check fails when enough players are present but they share one element", () => {
  const result = checkCooperativeRequirement({
    task: { minContributors: 2, requiredDistinctElements: 2 },
    elementsPresent: ["lightning", "lightning"],
  });

  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.playersPresent, 2);
    assert.equal(result.distinctElementsPresent, 1);
  }
});

test("a non-cooperative task (1/1) always passes the check", () => {
  const result = checkCooperativeRequirement({
    task: { minContributors: 1, requiredDistinctElements: 1 },
    elementsPresent: ["fire"],
  });

  assert.deepEqual(result, { ok: true });
});
