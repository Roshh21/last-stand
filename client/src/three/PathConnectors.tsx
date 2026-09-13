import { useMemo } from "react";

import type { IslandMapDefinition } from "@last-stand/shared";

import { getZonePosition } from "./zoneLayout3D.js";

interface PathConnectorsProps {
  map: IslandMapDefinition;
  blockedZoneIds: Set<string>;
}

/** Thin ground strips connecting adjacent zones - lit amber normally, red when the destination end is blocked. */
export function PathConnectors({ map, blockedZoneIds }: PathConnectorsProps) {
  const segments = useMemo(() => {
    const seen = new Set<string>();
    const list: Array<{ key: string; from: string; to: string }> = [];

    for (const zone of map.zones) {
      for (const connectionId of zone.connections) {
        const key = [zone.id, connectionId].sort().join("|");

        if (!seen.has(key)) {
          seen.add(key);
          list.push({ key, from: zone.id, to: connectionId });
        }
      }
    }

    return list;
  }, [map]);

  return (
    <group>
      {segments.map((segment) => {
        const from = getZonePosition(segment.from);
        const to = getZonePosition(segment.to);
        const dx = to[0] - from[0];
        const dz = to[2] - from[2];
        const length = Math.hypot(dx, dz);
        const angle = Math.atan2(dz, dx);
        const midX = (from[0] + to[0]) / 2;
        const midZ = (from[2] + to[2]) / 2;
        const isBlocked = blockedZoneIds.has(segment.from) || blockedZoneIds.has(segment.to);

        return (
          <mesh
            key={segment.key}
            position={[midX, 0.01, midZ]}
            rotation={[-Math.PI / 2, 0, -angle]}
            receiveShadow
          >
            <planeGeometry args={[Math.max(0, length - 7.5), 1.4]} />
            <meshStandardMaterial
              color={isBlocked ? "#5a3530" : "#c9b27a"}
              roughness={0.9}
              transparent
              opacity={0.85}
            />
          </mesh>
        );
      })}
    </group>
  );
}
