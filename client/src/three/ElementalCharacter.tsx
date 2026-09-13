import { useMemo, useRef } from "react";

import { Html, Sparkles } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import type { ElementId, PlayerMovementState } from "@last-stand/shared";
import * as THREE from "three";

import { computeCharacterPosition } from "./zoneLayout3D.js";

interface ElementVisual {
  bodyColor: string;
  emissive: string;
  emissiveIntensity: number;
  roughness: number;
  metalness: number;
  opacity: number;
  transparent: boolean;
  flatShading: boolean;
  sparkleColor: string;
  sparkleCount: number;
  sparkleSpeed: number;
  /** Faceted "crystal" look (Earth) vs. smooth (everyone else). */
  faceted: boolean;
}

const ELEMENT_VISUALS: Record<ElementId, ElementVisual> = {
  fire: {
    bodyColor: "#e2543d",
    emissive: "#ff7a3d",
    emissiveIntensity: 0.9,
    roughness: 0.5,
    metalness: 0,
    opacity: 1,
    transparent: false,
    flatShading: false,
    sparkleColor: "#ffb454",
    sparkleCount: 26,
    sparkleSpeed: 0.7,
    faceted: false,
  },
  water: {
    bodyColor: "#3d8fe2",
    emissive: "#1c3f66",
    emissiveIntensity: 0.15,
    roughness: 0.15,
    metalness: 0.2,
    opacity: 0.72,
    transparent: true,
    flatShading: false,
    sparkleColor: "#bfe3ff",
    sparkleCount: 14,
    sparkleSpeed: 0.25,
    faceted: false,
  },
  nature: {
    bodyColor: "#4caf6d",
    emissive: "#173a1d",
    emissiveIntensity: 0.15,
    roughness: 0.95,
    metalness: 0,
    opacity: 1,
    transparent: false,
    flatShading: true,
    sparkleColor: "#c8f2b8",
    sparkleCount: 10,
    sparkleSpeed: 0.15,
    faceted: false,
  },
  lightning: {
    bodyColor: "#c9a53d",
    emissive: "#fff2a0",
    emissiveIntensity: 0.8,
    roughness: 0.4,
    metalness: 0.3,
    opacity: 1,
    transparent: false,
    flatShading: false,
    sparkleColor: "#fff9c4",
    sparkleCount: 20,
    sparkleSpeed: 1.2,
    faceted: false,
  },
  earth: {
    bodyColor: "#a06a3d",
    emissive: "#2a1a0d",
    emissiveIntensity: 0.05,
    roughness: 1,
    metalness: 0,
    opacity: 1,
    transparent: false,
    flatShading: true,
    sparkleColor: "#000000",
    sparkleCount: 0,
    sparkleSpeed: 0,
    faceted: true,
  },
  wind: {
    bodyColor: "#dff5f5",
    emissive: "#ffffff",
    emissiveIntensity: 0.08,
    roughness: 0.3,
    metalness: 0,
    opacity: 0.5,
    transparent: true,
    flatShading: false,
    sparkleColor: "#ffffff",
    sparkleCount: 22,
    sparkleSpeed: 1.0,
    faceted: false,
  },
};

/** Small orbiting fragments for Earth (rock chunks) and Lightning (static shards). */
function OrbitingShards({ color, radius, count, speed }: { color: string; radius: number; count: number; speed: number }) {
  const group = useRef<THREE.Group>(null);

  useFrame((_, delta) => {
    if (group.current) {
      group.current.rotation.y += delta * speed;
    }
  });

  const shards = useMemo(
    () =>
      Array.from({ length: count }, (_, i) => {
        const angle = (i / count) * Math.PI * 2;

        return { angle, y: (i % 2 === 0 ? 1 : -1) * 0.15 };
      }),
    [count],
  );

  return (
    <group ref={group}>
      {shards.map((shard, i) => (
        <mesh
          key={i}
          position={[Math.cos(shard.angle) * radius, 0.9 + shard.y, Math.sin(shard.angle) * radius]}
        >
          <tetrahedronGeometry args={[0.12]} />
          <meshStandardMaterial color={color} roughness={0.6} flatShading />
        </mesh>
      ))}
    </group>
  );
}

/** Flat leaf-like shapes fanning out from the body (Nature only). */
function LeafCluster({ color }: { color: string }) {
  const leaves = useMemo(
    () =>
      Array.from({ length: 5 }, (_, i) => {
        const angle = (i / 5) * Math.PI * 2;

        return { angle };
      }),
    [],
  );

  return (
    <>
      {leaves.map((leaf, i) => (
        <mesh
          key={i}
          position={[Math.cos(leaf.angle) * 0.5, 0.75, Math.sin(leaf.angle) * 0.5]}
          rotation={[0.3, -leaf.angle, 0.4]}
        >
          <coneGeometry args={[0.16, 0.4, 4]} />
          <meshStandardMaterial color={color} roughness={0.9} flatShading />
        </mesh>
      ))}
    </>
  );
}

/** A small deterministic hash so each character's idle animation phase differs, without calling Math.random() during render. */
function seedFromString(value: string): number {
  let hash = 0;

  for (let i = 0; i < value.length; i++) {
    hash = (hash * 31 + value.charCodeAt(i)) % 1000;
  }

  return (hash / 1000) * Math.PI * 2;
}

interface ElementalCharacterProps {
  element: ElementId;
  zoneId: string;
  movement: PlayerMovementState | null;
  nickname: string;
  isMe: boolean;
  connected: boolean;
}

/**
 * A procedurally-built "elemental spirit" - no imported 3D models are
 * available in this environment, so every element is a distinct
 * combination of geometry, material, and particle effect built from
 * primitive Three.js shapes. See docs/game-world-3d.md for the full
 * per-element breakdown and the reasoning behind this approach.
 */
export function ElementalCharacter({
  element,
  zoneId,
  movement,
  nickname,
  isMe,
  connected,
}: ElementalCharacterProps) {
  const visual = ELEMENT_VISUALS[element];
  const outerRef = useRef<THREE.Group>(null);
  const bodyRef = useRef<THREE.Group>(null);
  const materialRef = useRef<THREE.MeshStandardMaterial>(null);
  const bobSeed = useMemo(() => seedFromString(nickname), [nickname]);

  useFrame((state) => {
    const t = state.clock.elapsedTime;

    if (outerRef.current) {
      const [x, y, z] = computeCharacterPosition(zoneId, movement, Date.now());

      outerRef.current.position.set(x, y, z);
    }

    if (bodyRef.current) {
      // Idle bob + gentle breathing scale, common to every element.
      bodyRef.current.position.y = Math.sin(t * 1.6 + bobSeed) * 0.06;
      const breathe = 1 + Math.sin(t * 2 + bobSeed) * 0.02;

      bodyRef.current.scale.set(breathe, breathe, breathe);

      if (element === "wind") {
        bodyRef.current.rotation.y += 0.01;
      }
    }

    if (materialRef.current && (element === "fire" || element === "lightning")) {
      // Flicker: fire is a smooth pulse, lightning is jittery/electric.
      const flicker =
        element === "fire"
          ? visual.emissiveIntensity + Math.sin(t * 6 + bobSeed) * 0.2
          : visual.emissiveIntensity + (Math.random() - 0.5) * 0.6;

      materialRef.current.emissiveIntensity = Math.max(0.2, flicker);
    }
  });

  return (
    <group ref={outerRef}>
      {/* Cheap grounding shadow blob - keeps characters readable even before real shadows resolve. */}
      <mesh position={[0, 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[0.55, 20]} />
        <meshBasicMaterial color="#000000" transparent opacity={0.25} />
      </mesh>

      <group ref={bodyRef} position={[0, 0.55, 0]} scale={connected ? 1 : 0.001}>
        {/* Body */}
        <mesh castShadow>
          {visual.faceted ? <icosahedronGeometry args={[0.55, 1]} /> : <sphereGeometry args={[0.5, 24, 24]} />}
          <meshStandardMaterial
            ref={materialRef}
            color={visual.bodyColor}
            emissive={visual.emissive}
            emissiveIntensity={visual.emissiveIntensity}
            roughness={visual.roughness}
            metalness={visual.metalness}
            opacity={visual.opacity}
            transparent={visual.transparent}
            flatShading={visual.flatShading}
          />
        </mesh>

        {/* Head */}
        <mesh position={[0, 0.62, 0.05]} castShadow>
          <sphereGeometry args={[0.28, 16, 16]} />
          <meshStandardMaterial
            color={visual.bodyColor}
            emissive={visual.emissive}
            emissiveIntensity={visual.emissiveIntensity * 0.7}
            roughness={visual.roughness}
            metalness={visual.metalness}
            opacity={visual.opacity}
            transparent={visual.transparent}
            flatShading={visual.flatShading}
          />
        </mesh>

        {/* Eyes - a small personality touch so it reads as a character, not a shape. */}
        <mesh position={[-0.1, 0.66, 0.28]}>
          <sphereGeometry args={[0.04, 8, 8]} />
          <meshBasicMaterial color="#1a1a1a" />
        </mesh>
        <mesh position={[0.1, 0.66, 0.28]}>
          <sphereGeometry args={[0.04, 8, 8]} />
          <meshBasicMaterial color="#1a1a1a" />
        </mesh>

        {element === "nature" && <LeafCluster color={visual.bodyColor} />}
        {element === "earth" && <OrbitingShards color={visual.bodyColor} radius={0.75} count={4} speed={0.6} />}
        {element === "lightning" && (
          <OrbitingShards color="#fff9c4" radius={0.65} count={5} speed={2.2} />
        )}

        {visual.sparkleCount > 0 && (
          <Sparkles
            count={visual.sparkleCount}
            scale={[0.9, 1.6, 0.9]}
            size={2.5}
            speed={visual.sparkleSpeed}
            color={visual.sparkleColor}
            position={[0, 0.6, 0]}
          />
        )}

        {(element === "fire" || element === "lightning") && (
          <pointLight color={visual.sparkleColor} intensity={1.2} distance={3} position={[0, 0.8, 0]} />
        )}
      </group>

      <Html position={[0, 1.6, 0]} center distanceFactor={12} zIndexRange={[10, 0]}>
        <div className={`character-label${isMe ? " character-label-me" : ""}${connected ? "" : " character-label-disconnected"}`}>
          {nickname}
        </div>
      </Html>
    </group>
  );
}
