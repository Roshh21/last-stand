import assert from "node:assert/strict";
import { test } from "node:test";

import { assignTeams } from "../../src/match/teams.js";
import { assignRoles } from "../../src/match/roles.js";

function makePlayerIds(count: number): string[] {
  return Array.from({ length: count }, (_, i) => `p_${i}`);
}

test("every team gets exactly one traitor and the rest loyal", () => {
  const playerIds = makePlayerIds(24);
  const { assignments: teamOf } = assignTeams(playerIds);
  const roles = assignRoles(teamOf);

  const traitorCountByTeam = new Map<string, number>();
  const sizeByTeam = new Map<string, number>();

  for (const playerId of playerIds) {
    const teamId = teamOf.get(playerId)!;

    sizeByTeam.set(teamId, (sizeByTeam.get(teamId) ?? 0) + 1);

    if (roles.get(playerId) === "traitor") {
      traitorCountByTeam.set(teamId, (traitorCountByTeam.get(teamId) ?? 0) + 1);
    }
  }

  for (const teamId of sizeByTeam.keys()) {
    assert.equal(traitorCountByTeam.get(teamId), 1, `team ${teamId} should have exactly one traitor`);
  }
});

test("every team keeps at least one loyal player", () => {
  const playerIds = makePlayerIds(12);
  const { assignments: teamOf } = assignTeams(playerIds);
  const roles = assignRoles(teamOf);

  const loyalCountByTeam = new Map<string, number>();

  for (const playerId of playerIds) {
    if (roles.get(playerId) === "loyal") {
      const teamId = teamOf.get(playerId)!;

      loyalCountByTeam.set(teamId, (loyalCountByTeam.get(teamId) ?? 0) + 1);
    }
  }

  for (const count of loyalCountByTeam.values()) {
    assert.ok(count >= 1);
  }
});

test("with a single 2-player team, exactly one is a traitor and one is loyal", () => {
  const playerIds = makePlayerIds(2);
  const { assignments: teamOf } = assignTeams(playerIds);
  const roles = assignRoles(teamOf);

  const roleValues = playerIds.map((id) => roles.get(id));

  assert.deepEqual(roleValues.sort(), ["loyal", "traitor"]);
});

test("every player in the input has a role assigned", () => {
  const playerIds = makePlayerIds(37);
  const { assignments: teamOf } = assignTeams(playerIds);
  const roles = assignRoles(teamOf);

  assert.equal(roles.size, playerIds.length);
});
