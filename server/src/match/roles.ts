import { randomInt } from "node:crypto";

import type { PlayerRole, TeamId } from "@last-stand/shared";

/**
 * Exactly one traitor per team (P30: "at least one per team" - using the
 * minimum keeps it simple and predictable, and pairs naturally with
 * MIN_TEAM_SIZE=2 always leaving at least one loyal player alongside them).
 * Traitors on different teams have no idea who the other traitors are -
 * this function doesn't even group them together anywhere a client could
 * see; each player's own PrivateMatchStateDTO only ever contains their own
 * role.
 */
export function assignRoles(teamAssignments: Map<string, TeamId>): Map<string, PlayerRole> {
  const playersByTeam = new Map<TeamId, string[]>();

  for (const [playerId, teamId] of teamAssignments) {
    const list = playersByTeam.get(teamId) ?? [];

    list.push(playerId);
    playersByTeam.set(teamId, list);
  }

  const roles = new Map<string, PlayerRole>();

  for (const teamMembers of playersByTeam.values()) {
    const traitorIndex = randomInt(teamMembers.length);

    teamMembers.forEach((playerId, index) => {
      roles.set(playerId, index === traitorIndex ? "traitor" : "loyal");
    });
  }

  return roles;
}
