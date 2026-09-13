import {
  TASK_NORMAL_CONTRIBUTION,
  TASK_SABOTAGE_CONTRIBUTION,
  TASK_SABOTAGE_INSTABILITY,
  type ElementId,
  type TaskDefinition,
} from "@last-stand/shared";

export interface TaskContributionInput {
  task: Pick<TaskDefinition, "requiredElements">;
  element: ElementId;
  /**
   * Always `false` in real gameplay right now - nothing in P15-P24 ever
   * assigns a player this flag. It exists so the reduced-progress /
   * hidden-instability code path (P22) is real and tested today, ready for
   * Stage F's traitor assignment to call into later. See
   * docs/elements-and-abilities.md for the full reasoning.
   */
  isSaboteur: boolean;
}

export interface TaskContributionResult {
  /** Whether the element used is actually one this task needs. */
  elementMatched: boolean;
  progressDelta: number;
  /** Never sent to any client - server-internal only (P22: "never let the client receive a flag that says this was sabotage"). */
  instabilityDelta: number;
}

/**
 * The help-vs-sabotage spectrum from P22, as a pure function: same task,
 * same correct element, can produce a different (but same-shaped) result
 * depending on `isSaboteur` - proving the mechanism works without needing
 * any real traitor-assignment system to exist yet.
 */
export function resolveTaskContribution(input: TaskContributionInput): TaskContributionResult {
  const { task, element, isSaboteur } = input;
  const elementMatched = task.requiredElements.includes(element);

  if (!elementMatched) {
    return { elementMatched: false, progressDelta: 0, instabilityDelta: 0 };
  }

  if (isSaboteur) {
    return {
      elementMatched: true,
      progressDelta: TASK_SABOTAGE_CONTRIBUTION,
      instabilityDelta: TASK_SABOTAGE_INSTABILITY,
    };
  }

  return { elementMatched: true, progressDelta: TASK_NORMAL_CONTRIBUTION, instabilityDelta: 0 };
}

export interface CooperativeCheckInput {
  task: Pick<TaskDefinition, "minContributors" | "requiredDistinctElements">;
  /** Elements of every player *currently standing in the task's zone* - not a history of past contributors. */
  elementsPresent: ElementId[];
}

export type CooperativeCheckResult =
  | { ok: true }
  | { ok: false; playersPresent: number; distinctElementsPresent: number };

/**
 * P23: a cooperative task can't be soloed, even by spamming one ability -
 * this checks who's physically present *right now*, not who has ever
 * contributed, so there's no way to "bank" progress toward the requirement
 * solo and cash it in later.
 */
export function checkCooperativeRequirement(input: CooperativeCheckInput): CooperativeCheckResult {
  const { task, elementsPresent } = input;
  const distinctElementsPresent = new Set(elementsPresent).size;
  const playersPresent = elementsPresent.length;

  if (playersPresent >= task.minContributors && distinctElementsPresent >= task.requiredDistinctElements) {
    return { ok: true };
  }

  return { ok: false, playersPresent, distinctElementsPresent };
}
