import { useMemo, useRef, useState } from "react";

import { Sparkles } from "@react-three/drei";
import { useFrame, type ThreeEvent } from "@react-three/fiber";
import * as THREE from "three";

import type { Vec3 } from "./zoneLayout3D.js";

const ZONE_GROUND_COLOR: Record<string, string> = {
  camp: "#6b8f5a",
  forest: "#3f6b3a",
  beach: "#d9c48a",
  dock: "#7a6a52",
  "power-station": "#5a5a5f",
  "abandoned-house": "#6a6558",
};

/**
 * A tiny deterministic PRNG (no Math.random/Date.now - keeps decoration
 * placement pure so it's safe to compute inside useMemo). Each decoration
 * cluster gets its own fixed seed, so layouts are stable across re-renders
 * but still look scattered rather than obviously repeating.
 */
function createSeededRandom(seed: number): () => number {
  let state = seed;

  return () => {
    state = (state * 1103515245 + 12345) & 0x7fffffff;

    return state / 0x7fffffff;
  };
}

function randomIn(rand: () => number, min: number, max: number): number {
  return min + rand() * (max - min);
}

/** A ring of logs around a crackling campfire - the start zone, meant to feel like "home." */
function CampDecorations() {
  const logs = useMemo(() => {
    const rand = createSeededRandom(101);

    return Array.from({ length: 7 }, (_, i) => (i / 7) * Math.PI * 2 + randomIn(rand, -0.1, 0.1));
  }, []);

  return (
    <group>
      <mesh position={[0, 0.15, 0]}>
        <coneGeometry args={[0.35, 0.7, 8]} />
        <meshStandardMaterial color="#e2543d" emissive="#ff7a3d" emissiveIntensity={1.1} />
      </mesh>
      <pointLight color="#ff9d4d" intensity={2.2} distance={6} position={[0, 0.6, 0]} />
      <Sparkles count={30} scale={[1.2, 2, 1.2]} size={3} speed={0.6} color="#ffb454" position={[0, 0.8, 0]} />
      {logs.map((angle, i) => (
        <mesh
          key={i}
          position={[Math.cos(angle) * 1.4, 0.12, Math.sin(angle) * 1.4]}
          rotation={[0, -angle, Math.PI / 2]}
        >
          <cylinderGeometry args={[0.12, 0.12, 1, 8]} />
          <meshStandardMaterial color="#5a4632" roughness={0.9} />
        </mesh>
      ))}
    </group>
  );
}

function TreeCluster() {
  const trees = useMemo(() => {
    const rand = createSeededRandom(202);

    return Array.from({ length: 9 }, () => ({
      x: randomIn(rand, -3.2, 3.2),
      z: randomIn(rand, -3.2, 3.2),
      scale: randomIn(rand, 0.7, 1.3),
    })).filter((t) => Math.hypot(t.x, t.z) > 0.8);
  }, []);

  return (
    <group>
      {trees.map((tree, i) => (
        <group key={i} position={[tree.x, 0, tree.z]} scale={tree.scale}>
          <mesh position={[0, 0.4, 0]}>
            <cylinderGeometry args={[0.1, 0.14, 0.8, 6]} />
            <meshStandardMaterial color="#5a4632" roughness={0.9} />
          </mesh>
          <mesh position={[0, 1.05, 0]}>
            <coneGeometry args={[0.55, 1.1, 7]} />
            <meshStandardMaterial color="#2f5c33" roughness={0.85} flatShading />
          </mesh>
          <mesh position={[0, 1.55, 0]}>
            <coneGeometry args={[0.4, 0.8, 7]} />
            <meshStandardMaterial color="#3a6b3d" roughness={0.85} flatShading />
          </mesh>
        </group>
      ))}
    </group>
  );
}

function BeachDecorations() {
  const palms = useMemo(() => {
    const rand = createSeededRandom(303);

    return Array.from({ length: 2 }, () => ({ x: randomIn(rand, -2.5, 2.5), z: randomIn(rand, -2.5, 2.5) }));
  }, []);
  const rocks = useMemo(() => {
    const rand = createSeededRandom(404);

    return Array.from({ length: 4 }, () => ({
      x: randomIn(rand, -3, 3),
      z: randomIn(rand, -3, 3),
      scale: randomIn(rand, 0.15, 0.3),
    }));
  }, []);

  return (
    <group>
      {palms.map((palm, i) => (
        <group key={i} position={[palm.x, 0, palm.z]}>
          <mesh position={[0, 0.9, 0]} rotation={[0, 0, 0.15]}>
            <cylinderGeometry args={[0.08, 0.12, 1.8, 6]} />
            <meshStandardMaterial color="#8a6a42" roughness={0.9} />
          </mesh>
          <mesh position={[0.15, 1.85, 0]}>
            <sphereGeometry args={[0.5, 8, 6]} />
            <meshStandardMaterial color="#4caf6d" roughness={0.85} flatShading />
          </mesh>
        </group>
      ))}
      {rocks.map((rock, i) => (
        <mesh key={i} position={[rock.x, rock.scale * 0.5, rock.z]} scale={rock.scale}>
          <icosahedronGeometry args={[1, 0]} />
          <meshStandardMaterial color="#9a9a92" roughness={1} flatShading />
        </mesh>
      ))}
    </group>
  );
}

function DockDecorations() {
  const planks = useMemo(() => Array.from({ length: 6 }, (_, i) => i), []);

  return (
    <group position={[0, 0.05, 1.5]}>
      {planks.map((i) => (
        <mesh key={i} position={[0, 0, i * 0.9]}>
          <boxGeometry args={[2.2, 0.12, 0.85]} />
          <meshStandardMaterial color="#7a5a3a" roughness={0.9} />
        </mesh>
      ))}
      {[-1, 1].map((side) =>
        planks
          .filter((i) => i % 2 === 0)
          .map((i) => (
            <mesh key={`${side}-${i}`} position={[side * 1.1, -0.5, i * 0.9]}>
              <cylinderGeometry args={[0.08, 0.08, 1, 6]} />
              <meshStandardMaterial color="#5a4632" roughness={0.9} />
            </mesh>
          )),
      )}
    </group>
  );
}

function PowerStationDecorations() {
  const flicker = useRef<THREE.PointLight>(null);

  useFrame((state) => {
    if (flicker.current) {
      flicker.current.intensity = 1.2 + Math.sin(state.clock.elapsedTime * 3) * 0.4;
    }
  });

  return (
    <group>
      <mesh position={[-1.3, 1, -0.5]}>
        <cylinderGeometry args={[0.6, 0.6, 2, 12]} />
        <meshStandardMaterial color="#6a6a70" roughness={0.6} metalness={0.4} />
      </mesh>
      <mesh position={[1.2, 0.7, 0.3]}>
        <cylinderGeometry args={[0.45, 0.45, 1.4, 12]} />
        <meshStandardMaterial color="#5a5a60" roughness={0.6} metalness={0.4} />
      </mesh>
      <mesh position={[0.1, 0.5, 1.4]}>
        <boxGeometry args={[1.6, 1, 1.2]} />
        <meshStandardMaterial color="#4a4a50" roughness={0.7} metalness={0.3} />
      </mesh>
      <mesh position={[0, 2.1, -0.5]}>
        <sphereGeometry args={[0.12, 8, 8]} />
        <meshStandardMaterial color="#ff4d4d" emissive="#ff4d4d" emissiveIntensity={1.5} />
      </mesh>
      <pointLight ref={flicker} color="#ff8080" intensity={1.2} distance={4} position={[0, 2.1, -0.5]} />
    </group>
  );
}

function AbandonedHouseDecorations() {
  return (
    <group rotation={[0, 0.15, 0.03]}>
      <mesh position={[0, 0.7, 0]}>
        <boxGeometry args={[2, 1.4, 1.8]} />
        <meshStandardMaterial color="#6a6050" roughness={0.95} />
      </mesh>
      <mesh position={[0, 1.65, 0]} rotation={[0, Math.PI / 4, 0]}>
        <coneGeometry args={[1.7, 1, 4]} />
        <meshStandardMaterial color="#4a4438" roughness={0.95} flatShading />
      </mesh>
      <mesh position={[0.6, 1.5, 0.95]} rotation={[0, 0, -0.5]}>
        <boxGeometry args={[0.15, 1.6, 0.5]} />
        <meshStandardMaterial color="#3a3428" roughness={1} />
      </mesh>
    </group>
  );
}

function ZoneDecorations({ zoneId }: { zoneId: string }) {
  switch (zoneId) {
    case "camp":
      return <CampDecorations />;
    case "forest":
      return <TreeCluster />;
    case "beach":
      return <BeachDecorations />;
    case "dock":
      return <DockDecorations />;
    case "power-station":
      return <PowerStationDecorations />;
    case "abandoned-house":
      return <AbandonedHouseDecorations />;
    default:
      return null;
  }
}

interface ZoneMarker3DProps {
  zoneId: string;
  name: string;
  position: Vec3;
  isCurrent: boolean;
  isReachable: boolean;
  isBlocked: boolean;
  hasIncompleteTasks: boolean;
  onSelect: () => void;
}

export function ZoneMarker3D({
  zoneId,
  position,
  isCurrent,
  isReachable,
  isBlocked,
  hasIncompleteTasks,
  onSelect,
}: ZoneMarker3DProps) {
  const [hovered, setHovered] = useState(false);
  const ringRef = useRef<THREE.Mesh>(null);
  const taskMarkerRef = useRef<THREE.Group>(null);

  useFrame((state) => {
    if (ringRef.current && (isReachable || isBlocked)) {
      const pulse = 1 + Math.sin(state.clock.elapsedTime * 3) * 0.06;

      ringRef.current.scale.set(pulse, pulse, 1);
    }

    if (taskMarkerRef.current) {
      taskMarkerRef.current.rotation.y = state.clock.elapsedTime * 0.8;
      taskMarkerRef.current.position.y = 3 + Math.sin(state.clock.elapsedTime * 2) * 0.15;
    }
  });

  function handleClick(event: ThreeEvent<MouseEvent>): void {
    event.stopPropagation();

    if (isReachable) {
      onSelect();
    }
  }

  return (
    <group
      position={position}
      onClick={handleClick}
      onPointerOver={(event) => {
        event.stopPropagation();

        if (isReachable) {
          setHovered(true);
          document.body.style.cursor = "pointer";
        }
      }}
      onPointerOut={() => {
        setHovered(false);
        document.body.style.cursor = "auto";
      }}
    >
      {/* Ground platform */}
      <mesh receiveShadow position={[0, -0.02, 0]}>
        <cylinderGeometry args={[4.2, 4.4, 0.15, 24]} />
        <meshStandardMaterial
          color={ZONE_GROUND_COLOR[zoneId] ?? "#6b8f5a"}
          roughness={0.95}
          emissive={hovered ? "#ffffff" : "#000000"}
          emissiveIntensity={hovered ? 0.08 : 0}
        />
      </mesh>

      {/* Current-zone marker */}
      {isCurrent && (
        <mesh position={[0, 0.05, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[3.9, 4.1, 32]} />
          <meshBasicMaterial color="#2fb8a3" />
        </mesh>
      )}

      {/* Reachable highlight ring */}
      {isReachable && !isBlocked && (
        <mesh ref={ringRef} position={[0, 0.06, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[4.15, 4.35, 32]} />
          <meshBasicMaterial color="#e2a13d" />
        </mesh>
      )}

      {/* Blocked barrier */}
      {isBlocked && (
        <mesh ref={ringRef} position={[0, 1, 0]}>
          <torusGeometry args={[4.2, 0.08, 8, 32]} />
          <meshStandardMaterial color="#e0604f" emissive="#e0604f" emissiveIntensity={0.8} />
        </mesh>
      )}

      {hasIncompleteTasks && (
        <group ref={taskMarkerRef} position={[0, 3, 0]}>
          <mesh>
            <octahedronGeometry args={[0.3]} />
            <meshStandardMaterial color="#e2a13d" emissive="#e2a13d" emissiveIntensity={0.6} />
          </mesh>
        </group>
      )}

      <ZoneDecorations zoneId={zoneId} />
    </group>
  );
}
