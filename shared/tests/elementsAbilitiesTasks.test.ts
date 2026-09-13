import assert from "node:assert/strict";
import { test } from "node:test";

import { ABILITIES, getAbility } from "../src/abilities.js";
import { ELEMENTS, getElement } from "../src/elements.js";
import { TASK_DEFINITIONS, validateTaskDefinitions } from "../src/tasks.js";

test("there are exactly six elements, each with a unique id and color", () => {
  assert.equal(ELEMENTS.length, 6);

  const ids = new Set(ELEMENTS.map((element) => element.id));
  const colors = new Set(ELEMENTS.map((element) => element.color));

  assert.equal(ids.size, 6);
  assert.equal(colors.size, 6);
});

test("getElement returns the right definition and throws for an unknown id", () => {
  assert.equal(getElement("fire").name, "Fire");
  assert.throws(() => getElement("plasma" as never));
});

test("every element has exactly one ability defined", () => {
  const elementIds = ELEMENTS.map((element) => element.id).sort();
  const abilityElementIds = ABILITIES.map((ability) => ability.element).sort();

  assert.deepEqual(abilityElementIds, elementIds);
});

test("lightning is the one ability with no zone effect", () => {
  const zoneCapable = ABILITIES.filter((ability) => ability.canTargetZone).map((a) => a.element);

  assert.equal(ABILITIES.length - zoneCapable.length, 1);
  assert.equal(getAbility("lightning").canTargetZone, false);
});

test("task definitions reference real zones and have sane thresholds", () => {
  const problems = validateTaskDefinitions(TASK_DEFINITIONS);

  assert.deepEqual(problems, []);
});

test("at least one task is genuinely cooperative (P23)", () => {
  const cooperative = TASK_DEFINITIONS.filter(
    (task) => task.minContributors > 1 || task.requiredDistinctElements > 1,
  );

  assert.ok(cooperative.length >= 1);
});

test("validateTaskDefinitions catches a bad zone reference", () => {
  const problems = validateTaskDefinitions([
    {
      id: "bogus",
      zoneId: "moon-base",
      name: "Bogus Task",
      requiredElements: ["fire"],
      completionThreshold: 100,
      minContributors: 1,
      requiredDistinctElements: 1,
    },
  ]);

  assert.equal(problems.length, 1);
  assert.match(problems[0], /unknown zone/);
});
