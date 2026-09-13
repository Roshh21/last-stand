import type { ElementId } from "./elements.js";

/**
 * V1 ability model (P16): one ability per element, generically targetable at
 * either a zone (a path) or a task. Every ability is deliberately dual-use
 * (P18: "helpful and disruptive... per the core ambiguity principle") - the
 * SAME action (toggling a path, or working a task component) can help or
 * hurt the team depending on context, and an outside observer can't tell
 * which just from seeing it happen. That ambiguity - not a branching
 * "which button did they press" - is what makes the action deniable.
 */
export type AbilityTargetKind = "zone" | "task";

export interface AbilityDefinition {
  element: ElementId;
  label: string;
  /** Lightning has no path-clearing fiction (P18) - it's task-only. */
  canTargetZone: boolean;
  zoneEffectDescription: string;
  taskEffectDescription: string;
}

export const ABILITIES: AbilityDefinition[] = [
  {
    element: "fire",
    label: "Ignite",
    canTargetZone: true,
    zoneEffectDescription: "Clears a blocked path - or collapses one that was open.",
    taskEffectDescription: "Ignites a task component: helps if it needs Fire, damages it otherwise.",
  },
  {
    element: "water",
    label: "Douse",
    canTargetZone: true,
    zoneEffectDescription: "Clears a blocked path - or floods one that was open.",
    taskEffectDescription: "Cools a task component: helps if it needs Water, does nothing otherwise.",
  },
  {
    element: "nature",
    label: "Overgrow",
    canTargetZone: true,
    zoneEffectDescription: "Clears vegetation blocking a path - or grows vegetation to block one.",
    taskEffectDescription: "Tends a task component: helps if it needs Nature, does nothing otherwise.",
  },
  {
    element: "lightning",
    label: "Charge",
    canTargetZone: false,
    zoneEffectDescription: "",
    taskEffectDescription:
      "Powers an electrical task component: helps if it needs Lightning, overloads it otherwise.",
  },
  {
    element: "earth",
    label: "Shift",
    canTargetZone: true,
    zoneEffectDescription: "Opens a collapsed path - or collapses one that was open.",
    taskEffectDescription: "Reinforces a task component: helps if it needs Earth, does nothing otherwise.",
  },
  {
    element: "wind",
    label: "Gust",
    canTargetZone: true,
    zoneEffectDescription: "Disperses a blockage - or kicks one up to block a path.",
    taskEffectDescription: "Clears a task component: helps if it needs Wind, does nothing otherwise.",
  },
];

const ABILITIES_BY_ELEMENT = new Map(ABILITIES.map((ability) => [ability.element, ability]));

export function getAbility(element: ElementId): AbilityDefinition {
  const ability = ABILITIES_BY_ELEMENT.get(element);

  if (!ability) {
    throw new Error(`No ability defined for element: ${element}`);
  }

  return ability;
}

export type AbilityRejectReason =
  | "not_in_match"
  | "match_not_in_progress"
  | "on_cooldown"
  | "invalid_target"
  | "target_not_here"
  | "no_zone_effect"
  | "needs_more_players"
  | "task_already_complete";
