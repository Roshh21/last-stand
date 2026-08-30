import { useMemo } from "react";

import { ISLAND_MAP, getZoneById, type MatchPlayerState } from "@last-stand/shared";

const ZONE_POSITIONS: Record<string, { x: number; y: number }> = {
  camp: { x: 350, y: 210 },
  forest: { x: 170, y: 100 },
  beach: { x: 170, y: 320 },
  dock: { x: 400, y: 340 },
  "power-station": { x: 540, y: 140 },
  "abandoned-house": { x: 540, y: 300 },
};

const NODE_RADIUS = 44;
const VIEW_BOX = "0 0 700 420";
const MAX_SHOWN_OCCUPANTS = 6;

function occupantOffsets(count: number): Array<{ dx: number; dy: number }> {
  const shown = Math.min(count, MAX_SHOWN_OCCUPANTS);
  const offsets: Array<{ dx: number; dy: number }> = [];

  for (let i = 0; i < shown; i++) {
    const angle = (i / shown) * Math.PI * 2 - Math.PI / 2;

    offsets.push({ dx: Math.cos(angle) * (NODE_RADIUS * 0.5), dy: Math.sin(angle) * (NODE_RADIUS * 0.5) });
  }

  return offsets;
}

interface IslandMapSvgProps {
  players: MatchPlayerState[];
  myPlayerId: string;
  onZoneClick: (zoneId: string) => void;
  canMove: boolean;
}

/** Zone-graph map (P10/P11) - deliberately not free 2D space, per the roadmap's V1 movement model. */
export function IslandMapSvg({ players, myPlayerId, onZoneClick, canMove }: IslandMapSvgProps) {
  const me = players.find((player) => player.playerId === myPlayerId);
  const currentZoneId = me?.zoneId;
  const reachableZoneIds = currentZoneId
    ? (getZoneById(ISLAND_MAP, currentZoneId)?.connections ?? [])
    : [];

  const edges = useMemo(() => {
    const seen = new Set<string>();
    const list: Array<[string, string]> = [];

    for (const zone of ISLAND_MAP.zones) {
      for (const connectionId of zone.connections) {
        const key = [zone.id, connectionId].sort().join("|");

        if (!seen.has(key)) {
          seen.add(key);
          list.push([zone.id, connectionId]);
        }
      }
    }

    return list;
  }, []);

  const playersByZone = useMemo(() => {
    const map = new Map<string, MatchPlayerState[]>();

    for (const player of players) {
      const list = map.get(player.zoneId) ?? [];

      list.push(player);
      map.set(player.zoneId, list);
    }

    return map;
  }, [players]);

  return (
    <svg className="zone-map" viewBox={VIEW_BOX} role="img" aria-label="Island map">
      {edges.map(([fromId, toId]) => {
        const from = ZONE_POSITIONS[fromId];
        const to = ZONE_POSITIONS[toId];

        return <line key={`${fromId}-${toId}`} className="zone-edge" x1={from.x} y1={from.y} x2={to.x} y2={to.y} />;
      })}

      {ISLAND_MAP.zones.map((zone) => {
        const position = ZONE_POSITIONS[zone.id];
        const occupants = playersByZone.get(zone.id) ?? [];
        const isCurrent = zone.id === currentZoneId;
        const isReachable = canMove && !isCurrent && reachableZoneIds.includes(zone.id);
        const classNames = ["zone-node", isCurrent && "current", isReachable && "reachable"]
          .filter(Boolean)
          .join(" ");
        const offsets = occupantOffsets(occupants.length);

        return (
          <g
            key={zone.id}
            className={classNames}
            transform={`translate(${position.x}, ${position.y})`}
            onClick={isReachable ? () => onZoneClick(zone.id) : undefined}
          >
            <circle className="zone-shape" r={NODE_RADIUS} />
            {offsets.map((offset, index) => (
              <circle
                key={occupants[index].playerId}
                cx={offset.dx}
                cy={offset.dy}
                r={6}
                fill={occupants[index].avatar.color}
                stroke="#0e1512"
                strokeWidth={1}
              />
            ))}
            <text className="zone-label" y={NODE_RADIUS + 18}>
              {zone.name}
            </text>
            {occupants.length > 0 && (
              <text className="zone-occupant-count" y={NODE_RADIUS + 32}>
                {occupants.length} here
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}
