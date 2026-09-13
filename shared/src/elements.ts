/**
 * Elemental identity (P15). Every player in a match is assigned exactly one
 * of these. V1 keeps it simple: one element = one ability (see abilities.ts)
 * - there's no multi-ability loadout yet.
 */
export type ElementId = "fire" | "water" | "nature" | "lightning" | "earth" | "wind";

export interface ElementDefinition {
  id: ElementId;
  name: string;
  /** Canonical color reused for avatar theming (P15: "reuse the avatar theming from P12"). */
  color: string;
}

export const ELEMENTS: ElementDefinition[] = [
  { id: "fire", name: "Fire", color: "#e2543d" },
  { id: "water", name: "Water", color: "#3d8fe2" },
  { id: "nature", name: "Nature", color: "#4caf6d" },
  { id: "lightning", name: "Lightning", color: "#c9a53d" },
  { id: "earth", name: "Earth", color: "#a06a3d" },
  { id: "wind", name: "Wind", color: "#7fd6d6" },
];

const ELEMENTS_BY_ID = new Map(ELEMENTS.map((element) => [element.id, element]));

export function getElement(id: ElementId): ElementDefinition {
  const element = ELEMENTS_BY_ID.get(id);

  if (!element) {
    throw new Error(`Unknown element id: ${id}`);
  }

  return element;
}
