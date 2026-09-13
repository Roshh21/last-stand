import { useRef } from "react";

import { Sparkles } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { getElement, type ElementId } from "@last-stand/shared";
import * as THREE from "three";

import type { Vec3 } from "./zoneLayout3D.js";

const BURST_DURATION_SECONDS = 1.1;

interface AbilityEffectBurstProps {
  element: ElementId;
  position: Vec3;
  onComplete: () => void;
}

/** A short-lived ring + spark burst at the zone where an ability was just used (P19's "visual cue for each ability's world effect"). */
export function AbilityEffectBurst({ element, position, onComplete }: AbilityEffectBurstProps) {
  const startTime = useRef<number | null>(null);
  const completedRef = useRef(false);
  const ringRef = useRef<THREE.Mesh>(null);
  const color = getElement(element).color;

  useFrame((state) => {
    if (startTime.current === null) {
      startTime.current = state.clock.elapsedTime;
    }

    const elapsed = state.clock.elapsedTime - startTime.current;

    if (elapsed > BURST_DURATION_SECONDS) {
      if (!completedRef.current) {
        completedRef.current = true;
        onComplete();
      }

      return;
    }

    const progress = elapsed / BURST_DURATION_SECONDS;

    if (ringRef.current) {
      const scale = 0.4 + progress * 3.2;

      ringRef.current.scale.set(scale, scale, scale);

      const material = ringRef.current.material as THREE.MeshBasicMaterial;

      material.opacity = 1 - progress;
    }
  });

  return (
    <group position={[position[0], 0.15, position[2]]}>
      <mesh ref={ringRef} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.5, 0.8, 24]} />
        <meshBasicMaterial color={color} transparent opacity={1} side={THREE.DoubleSide} />
      </mesh>
      <Sparkles count={16} scale={[2, 1.5, 2]} size={4} speed={1.5} color={color} position={[0, 1, 0]} />
    </group>
  );
}
