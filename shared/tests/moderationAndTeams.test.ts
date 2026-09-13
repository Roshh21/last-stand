import assert from "node:assert/strict";
import { test } from "node:test";

import { maskProfanity } from "../src/moderation.js";
import { TEAM_COLORS, buildTeamDefinition, buildTeamId } from "../src/teams.js";

test("maskProfanity replaces a whole-word match with equal-length asterisks", () => {
  assert.equal(maskProfanity("what the hell was that"), "what the **** was that");
});

test("maskProfanity is case-insensitive", () => {
  assert.equal(maskProfanity("DAMN it"), "**** it");
});

test("maskProfanity does not touch words that merely contain a filtered substring", () => {
  assert.equal(maskProfanity("hello there"), "hello there");
});

test("maskProfanity leaves clean text untouched", () => {
  const clean = "let's regroup at the power station";

  assert.equal(maskProfanity(clean), clean);
});

test("buildTeamId and buildTeamDefinition are stable and 1-indexed for display", () => {
  assert.equal(buildTeamId(0), "team-1");
  assert.equal(buildTeamDefinition(0).name, "Team 1");
  assert.equal(buildTeamDefinition(0).color, TEAM_COLORS[0]);
});

test("team colors cycle if there are ever more teams than colors", () => {
  const definition = buildTeamDefinition(TEAM_COLORS.length);

  assert.equal(definition.color, TEAM_COLORS[0]);
});
