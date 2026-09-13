import { useEffect, useRef, useState } from "react";

import { OrbitControls, Sky } from "@react-three/drei";
import { Canvas, useFrame } from "@react-three/fiber";
import {
  ISLAND_MAP,
  getZoneById,
  type MatchPlayerState,
  type TaskStateDTO,
  type ZoneRuntimeStateDTO,
} from "@last-stand/shared";
import * as THREE from "three";

import type { AbilityLogEntry } from "../net/GameClient.js";
import { AbilityEffectBurst } from "./AbilityEffectBurst.js";
import { ElementalCharacter } from "./ElementalCharacter.js";
import { PathConnectors } from "./PathConnectors.js";
import { ZoneMarker3D } from "./ZoneMarker3D.js";
import { getZonePosition, type Vec3 } from "./zoneLayout3D.js";

interface CameraRigProps {
  targetPosition: Vec3;
}

/** Smoothly re-centers the orbit target on the player's current zone as they move, without snapping. */
function CameraRig({ targetPosition }: CameraRigProps) {
  // drei's OrbitControls instance type isn't worth importing just for a ref -
  // it's purely imperative (target.lerp/update) and never touches our own API.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const controlsRef = useRef<any>(null);
  const desired = useRef(new THREE.Vector3(...targetPosition));

  useEffect(() => {
    desired.current.set(...targetPosition);
  }, [targetPosition]);

  useFrame(() => {
    if (controlsRef.current) {
      controlsRef.current.target.lerp(desired.current, 0.04);
      controlsRef.current.update();
    }
  });

  return (
    <OrbitControls
      ref={controlsRef}
      enablePan={false}
      minDistance={12}
      maxDistance={50}
      minPolarAngle={0.25}
      maxPolarAngle={Math.PI / 2.3}
    />
  );
}

interface IslandScene3DProps {
  players: MatchPlayerState[];
  zones: ZoneRuntimeStateDTO[];
  tasks: TaskStateDTO[];
  myPlayerId: string;
  canMove: boolean;
  abilityLog: AbilityLogEntry[];
  onZoneClick: (zoneId: string) => void;
}

export function IslandScene3D({
  players,
  zones,
  tasks,
  myPlayerId,
  canMove,
  abilityLog,
  onZoneClick,
}: IslandScene3DProps) {
  const [activeBursts, setActiveBursts] = useState<AbilityLogEntry[]>([]);
  const lastSeenCount = useRef(0);

  useEffect(() => {
    if (abilityLog.length > lastSeenCount.current) {
      setActiveBursts((previous) => [...previous, ...abilityLog.slice(lastSeenCount.current)]);
    }

    lastSeenCount.current = abilityLog.length;
  }, [abilityLog]);

  const me = players.find((player) => player.playerId === myPlayerId);
  const currentZoneId = me?.zoneId ?? "camp";
  const reachableZoneIds = new Set(getZoneById(ISLAND_MAP, currentZoneId)?.connections ?? []);
  const blockedZoneIds = new Set(zones.filter((zone) => zone.blocked).map((zone) => zone.zoneId));
  const cameraTarget = getZonePosition(currentZoneId);

  return (
    <div className="island-3d-canvas">
      <Canvas shadows camera={{ position: [0, 24, 30], fov: 42 }}>
        <color attach="background" args={["#bcdff0"]} />
        <fog attach="fog" args={["#bcdff0", 35, 95]} />
        <Sky sunPosition={[40, 30, 10]} turbidity={4} rayleigh={1.2} />

        <ambientLight intensity={0.65} />
        <directionalLight
          position={[25, 35, 12]}
          intensity={1.3}
          castShadow
          shadow-mapSize={[1024, 1024]}
          shadow-camera-left={-40}
          shadow-camera-right={40}
          shadow-camera-top={40}
          shadow-camera-bottom={-40}
        />

        {/* Island base */}
        <mesh receiveShadow position={[0, -0.4, 2]} rotation={[-Math.PI / 2, 0, 0]}>
          <circleGeometry args={[34, 48]} />
          <meshStandardMaterial color="#8aa86a" roughness={1} />
        </mesh>

        {/* Ocean */}
        <mesh position={[0, -1, 2]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[240, 240]} />
          <meshStandardMaterial color="#2f7a9e" roughness={0.25} metalness={0.15} transparent opacity={0.92} />
        </mesh>

        <PathConnectors map={ISLAND_MAP} blockedZoneIds={blockedZoneIds} />

        {ISLAND_MAP.zones.map((zone) => (
          <ZoneMarker3D
            key={zone.id}
            zoneId={zone.id}
            name={zone.name}
            position={getZonePosition(zone.id)}
            isCurrent={zone.id === currentZoneId}
            isReachable={canMove && zone.id !== currentZoneId && reachableZoneIds.has(zone.id)}
            isBlocked={blockedZoneIds.has(zone.id)}
            hasIncompleteTasks={tasks.some((task) => task.zoneId === zone.id && !task.completed)}
            onSelect={() => onZoneClick(zone.id)}
          />
        ))}

        {players.map((player) => (
          <ElementalCharacter
            key={player.playerId}
            element={player.element}
            zoneId={player.zoneId}
            movement={player.movement}
            nickname={player.nickname}
            isMe={player.playerId === myPlayerId}
            connected={player.connected}
          />
        ))}

        {activeBursts.map((burst) => (
          <AbilityEffectBurst
            key={burst.id}
            element={burst.element}
            position={getZonePosition(burst.zoneId)}
            onComplete={() => setActiveBursts((prev) => prev.filter((b) => b.id !== burst.id))}
          />
        ))}

        <CameraRig targetPosition={cameraTarget} />
      </Canvas>
    </div>
  );
}
