import { randomInt } from "node:crypto";

import { MIN_TEAM_SIZE, TARGET_TEAM_SIZE, buildTeamDefinition, type TeamStateDTO } from "@last-stand/shared";

export interface TeamAssignmentResult {
  teams: TeamStateDTO[];
  /** Which team each player landed on. */
  assignments: Map<string, string>;
}

/**
 * How many teams a given player count should split into (P29: "dynamic
 * team-size calculation based on total player count (~6 per team)"),
 * respecting a floor so no team ever ends up too small to have both a
 * traitor and at least one loyal player.
 */
export function calculateTeamCount(totalPlayers: number): number {
  if (totalPlayers <= MIN_TEAM_SIZE) {
    return 1;
  }

  const idealTeamCount = Math.round(totalPlayers / TARGET_TEAM_SIZE);
  const maxTeamCountForMinSize = Math.floor(totalPlayers / MIN_TEAM_SIZE);

  return Math.max(1, Math.min(idealTeamCount, maxTeamCountForMinSize));
}

function shuffle<T>(items: T[]): T[] {
  const result = [...items];

  for (let i = result.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);

    [result[i], result[j]] = [result[j], result[i]];
  }

  return result;
}

/** Every team differs in size from every other by at most one, and no team is empty. */
function isValidDistribution(teamCount: number, sizes: number[]): boolean {
  if (sizes.length !== teamCount) {
    return false;
  }

  if (sizes.some((size) => size < 1)) {
    return false;
  }

  const max = Math.max(...sizes);
  const min = Math.min(...sizes);

  return max - min <= 1;
}

/**
 * Randomly assigns players to teams (P29). Shuffles and round-robins, then
 * validates the result is genuinely balanced - a "re-roll safeguard"
 * against a degenerate distribution. Round-robin distribution can't
 * actually produce an invalid result by construction, but the check (and a
 * deterministic fallback) exists so a future change to the distribution
 * strategy can't silently break the "evenly sized teams" guarantee without
 * a test catching it.
 */
export function assignTeams(playerIds: string[], maxAttempts = 5): TeamAssignmentResult {
  const teamCount = calculateTeamCount(playerIds.length);
  const teams = Array.from({ length: teamCount }, (_, index) => buildTeamDefinition(index));

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const shuffled = shuffle(playerIds);
    const assignments = new Map<string, string>();
    const sizes = new Array(teamCount).fill(0);

    shuffled.forEach((playerId, index) => {
      const teamIndex = index % teamCount;

      assignments.set(playerId, teams[teamIndex].id);
      sizes[teamIndex] += 1;
    });

    if (isValidDistribution(teamCount, sizes)) {
      return { teams, assignments };
    }
  }

  // Deterministic fallback, guaranteed valid by construction (no shuffle involved).
  const assignments = new Map<string, string>();

  playerIds.forEach((playerId, index) => {
    assignments.set(playerId, teams[index % teamCount].id);
  });

  return { teams, assignments };
}
