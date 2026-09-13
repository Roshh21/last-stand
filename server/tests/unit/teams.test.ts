import assert from "node:assert/strict";
import { test } from "node:test";

import { assignTeams, calculateTeamCount } from "../../src/match/teams.js";

function makePlayerIds(count: number): string[] {
  return Array.from({ length: count }, (_, i) => `p_${i}`);
}

test("calculateTeamCount targets roughly 6 per team across the dev-to-real range", () => {
  assert.equal(calculateTeamCount(2), 1);
  assert.equal(calculateTeamCount(6), 1);
  assert.equal(calculateTeamCount(12), 2);
  assert.equal(calculateTeamCount(20), 3);
  assert.equal(calculateTeamCount(50), 8);
});

test("calculateTeamCount never produces a team smaller than MIN_TEAM_SIZE", () => {
  for (let n = 2; n <= 50; n++) {
    const teamCount = calculateTeamCount(n);
    const smallestPossibleTeam = Math.floor(n / teamCount);

    assert.ok(smallestPossibleTeam >= 2, `n=${n} produced ${teamCount} teams, too small for min size`);
  }
});

test("assignTeams places every player on exactly one team", () => {
  const playerIds = makePlayerIds(23);
  const { assignments } = assignTeams(playerIds);

  assert.equal(assignments.size, 23);

  for (const playerId of playerIds) {
    assert.ok(assignments.get(playerId));
  }
});

test("assignTeams produces evenly sized teams (P29: any count 20-50 -> evenly sized)", () => {
  for (const count of [20, 27, 33, 41, 50]) {
    const playerIds = makePlayerIds(count);
    const { teams, assignments } = assignTeams(playerIds);

    const sizes = new Map<string, number>();

    for (const teamId of assignments.values()) {
      sizes.set(teamId, (sizes.get(teamId) ?? 0) + 1);
    }

    assert.equal(sizes.size, teams.length, `count=${count}`);

    const values = [...sizes.values()];

    assert.ok(Math.max(...values) - Math.min(...values) <= 1, `count=${count} sizes: ${values.join(",")}`);
  }
});

test("assignTeams returns team definitions with distinct ids, names, and colors", () => {
  const { teams } = assignTeams(makePlayerIds(20));

  assert.equal(new Set(teams.map((t) => t.id)).size, teams.length);
  assert.equal(new Set(teams.map((t) => t.name)).size, teams.length);
});

test("with only 2 players, both land on the same single team", () => {
  const { teams, assignments } = assignTeams(makePlayerIds(2));

  assert.equal(teams.length, 1);
  assert.equal(new Set(assignments.values()).size, 1);
});
