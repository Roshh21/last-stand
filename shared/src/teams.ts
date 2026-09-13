/**
 * Team types (P29). Splitting the match into ~6-person teams is what makes
 * the hidden-traitor mechanic (Stage F) meaningful - each team needs at
 * least one loyal member and at least one traitor for there to be anyone
 * to suspect.
 */
export type TeamId = string;

export interface TeamStateDTO {
  id: TeamId;
  name: string;
  color: string;
}

/** Cycled through if there are ever more teams than colors (up to ~8 teams at max room size / target team size). */
export const TEAM_COLORS = [
  "#e2543d",
  "#3d8fe2",
  "#4caf6d",
  "#c9a53d",
  "#a06a3d",
  "#7fd6d6",
  "#c77dd6",
  "#e2893d",
];

export function buildTeamId(index: number): TeamId {
  return `team-${index + 1}`;
}

export function buildTeamDefinition(index: number): TeamStateDTO {
  return {
    id: buildTeamId(index),
    name: `Team ${index + 1}`,
    color: TEAM_COLORS[index % TEAM_COLORS.length],
  };
}
