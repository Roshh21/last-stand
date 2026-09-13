import { isValidZoneId, ISLAND_MAP } from "./map/islandMap.js";
import type { ElementId } from "./elements.js";

/**
 * Static task placement/config (P20) - shared by client and server, same
 * pattern as the island map. Runtime state (progress, completion) is
 * per-match and lives in TaskStateDTO, built fresh from this config when a
 * match starts.
 */
export interface TaskDefinition {
  id: string;
  zoneId: string;
  name: string;
  /** Any of these elements advances progress normally. */
  requiredElements: ElementId[];
  completionThreshold: number;
  /** P23: how many players must be physically present, contributing, at once. 1 = solo-completable. */
  minContributors: number;
  /** P23: how many *distinct* elements must be represented among those present at once. 1 = no real co-op requirement. */
  requiredDistinctElements: number;
}

/**
 * The roadmap's own example: a Power Station with a generator (Water), a
 * furnace (Fire), and a circuit (Lightning + Earth, built together - the
 * one cooperative task for now, per P23).
 */
export const TASK_DEFINITIONS: TaskDefinition[] = [
  {
    id: "cool-generator",
    zoneId: "power-station",
    name: "Cool the Generator",
    requiredElements: ["water"],
    completionThreshold: 100,
    minContributors: 1,
    requiredDistinctElements: 1,
  },
  {
    id: "ignite-furnace",
    zoneId: "power-station",
    name: "Ignite the Furnace",
    requiredElements: ["fire"],
    completionThreshold: 100,
    minContributors: 1,
    requiredDistinctElements: 1,
  },
  {
    id: "activate-circuit",
    zoneId: "power-station",
    name: "Activate the Circuit",
    requiredElements: ["lightning", "earth"],
    completionThreshold: 100,
    minContributors: 2,
    requiredDistinctElements: 2,
  },
];

export function getTaskDefinition(taskId: string): TaskDefinition | undefined {
  return TASK_DEFINITIONS.find((task) => task.id === taskId);
}

export function getTaskDefinitionsForZone(zoneId: string): TaskDefinition[] {
  return TASK_DEFINITIONS.filter((task) => task.zoneId === zoneId);
}

export function isTaskCooperative(task: Pick<TaskDefinition, "minContributors" | "requiredDistinctElements">): boolean {
  return task.minContributors > 1 || task.requiredDistinctElements > 1;
}

/** Public, per-match runtime view of a task. Deliberately excludes hidden instability (P22) and contribution history. */
export interface TaskStateDTO {
  id: string;
  zoneId: string;
  name: string;
  requiredElements: ElementId[];
  completionThreshold: number;
  minContributors: number;
  requiredDistinctElements: number;
  progress: number;
  completed: boolean;
}

/** Structural sanity checks, exercised in tests - same spirit as validateMapGraph. */
export function validateTaskDefinitions(tasks: TaskDefinition[]): string[] {
  const problems: string[] = [];
  const idsSeen = new Set<string>();

  for (const task of tasks) {
    if (idsSeen.has(task.id)) {
      problems.push(`Duplicate task id: ${task.id}`);
    }

    idsSeen.add(task.id);

    if (!isValidZoneId(ISLAND_MAP, task.zoneId)) {
      problems.push(`Task "${task.id}" references unknown zone "${task.zoneId}"`);
    }

    if (task.requiredElements.length === 0) {
      problems.push(`Task "${task.id}" has no required elements`);
    }

    if (task.completionThreshold <= 0) {
      problems.push(`Task "${task.id}" has a non-positive completion threshold`);
    }

    if (task.minContributors < 1) {
      problems.push(`Task "${task.id}" has minContributors < 1`);
    }

    if (task.requiredDistinctElements < 1) {
      problems.push(`Task "${task.id}" has requiredDistinctElements < 1`);
    }
  }

  return problems;
}

export function getRequiredObjectiveTaskCount(tasks: TaskDefinition[]): number {
  return tasks.length;
}

/** Team-wide objective progress (P24). Purely informational for now - win conditions are Stage I, much later. */
export interface ObjectiveStateDTO {
  completedTasks: number;
  totalTasks: number;
  requiredTasks: number;
  met: boolean;
}
