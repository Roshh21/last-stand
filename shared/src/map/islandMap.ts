/**
 * Island map data model (P10).
 *
 * The island is represented as a graph of zones rather than free 2D space:
 * V1 movement is zone-to-zone, so all the client and server need to agree on
 * is "what zones exist" and "which zones connect to which". This file is the
 * single shared source of truth for that graph - see docs/island-map.md for
 * the reasoning and a description of each zone.
 *
 * `capacity`, `taskSlots`, and `hazardFlag` are structural metadata reserved
 * for later stages (Stage D tasks, Stage G sabotage/hazards). They are
 * defined here now so the shape of the map doesn't need to change later, but
 * nothing in P10-P14 enforces or reads them yet beyond storing them.
 */

export interface IslandZoneDefinition {
  /** Stable, unique zone id used everywhere (network messages, keys, etc). */
  id: string;
  /** Human-readable display name. */
  name: string;
  /** Ids of zones directly reachable from this one (movement graph edges). */
  connections: string[];
  /**
   * Soft cap on simultaneous occupants. `null` means unlimited.
   * Reserved for future crowding/balance rules - not enforced yet.
   */
  capacity: number | null;
  /** Number of task interaction slots this zone will host (Stage D). */
  taskSlots: number;
  /** Whether this zone can currently host an environmental hazard (Stage G). */
  hazardFlag: boolean;
  /** Where players are placed when a match begins. Exactly one zone should set this. */
  isStartZone?: boolean;
}

export interface IslandMapDefinition {
  id: string;
  name: string;
  zones: IslandZoneDefinition[];
}

export const ISLAND_MAP: IslandMapDefinition = {
  id: "island-v1",
  name: "Island",
  zones: [
    {
      id: "camp",
      name: "Camp",
      connections: ["forest", "beach", "dock"],
      capacity: null,
      taskSlots: 0,
      hazardFlag: false,
      isStartZone: true,
    },
    {
      id: "forest",
      name: "Forest",
      connections: ["camp", "abandoned-house", "power-station"],
      capacity: 12,
      taskSlots: 1,
      hazardFlag: false,
    },
    {
      id: "beach",
      name: "Beach",
      connections: ["camp", "dock"],
      capacity: 12,
      taskSlots: 0,
      hazardFlag: false,
    },
    {
      id: "dock",
      name: "Dock",
      connections: ["camp", "beach", "power-station"],
      capacity: 10,
      taskSlots: 0,
      hazardFlag: false,
    },
    {
      id: "power-station",
      name: "Power Station",
      connections: ["forest", "dock", "abandoned-house"],
      capacity: 8,
      taskSlots: 2,
      hazardFlag: false,
    },
    {
      id: "abandoned-house",
      name: "Abandoned House",
      connections: ["forest", "power-station"],
      capacity: 8,
      taskSlots: 1,
      hazardFlag: false,
    },
  ],
};

export function getZoneById(
  map: IslandMapDefinition,
  zoneId: string,
): IslandZoneDefinition | undefined {
  return map.zones.find((zone) => zone.id === zoneId);
}

export function isValidZoneId(map: IslandMapDefinition, zoneId: string): boolean {
  return map.zones.some((zone) => zone.id === zoneId);
}

export function isZoneAdjacent(
  map: IslandMapDefinition,
  fromZoneId: string,
  toZoneId: string,
): boolean {
  const fromZone = getZoneById(map, fromZoneId);

  if (!fromZone) {
    return false;
  }

  return fromZone.connections.includes(toZoneId);
}

export function getStartZoneId(map: IslandMapDefinition): string {
  const startZone = map.zones.find((zone) => zone.isStartZone);

  if (!startZone) {
    throw new Error(`Island map "${map.id}" has no zone marked isStartZone`);
  }

  return startZone.id;
}

/**
 * Basic structural sanity checks: every connection points at a real zone,
 * and connections are mutual (if A connects to B, B connects to A). Movement
 * validation only checks the forward direction, but an asymmetric graph is
 * almost certainly a config mistake, so this is exercised in tests.
 */
export function validateMapGraph(map: IslandMapDefinition): string[] {
  const problems: string[] = [];
  const idsSeen = new Set<string>();

  for (const zone of map.zones) {
    if (idsSeen.has(zone.id)) {
      problems.push(`Duplicate zone id: ${zone.id}`);
    }

    idsSeen.add(zone.id);
  }

  for (const zone of map.zones) {
    for (const connectionId of zone.connections) {
      if (!isValidZoneId(map, connectionId)) {
        problems.push(`Zone "${zone.id}" connects to unknown zone "${connectionId}"`);

        continue;
      }

      if (!isZoneAdjacent(map, connectionId, zone.id)) {
        problems.push(
          `Connection is not mutual: "${zone.id}" -> "${connectionId}" but not back`,
        );
      }
    }
  }

  const startZones = map.zones.filter((zone) => zone.isStartZone);

  if (startZones.length !== 1) {
    problems.push(`Expected exactly one start zone, found ${startZones.length}`);
  }

  return problems;
}
