"use client";

/* eslint-disable react/no-unknown-property */

import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls, Sky, Environment } from "@react-three/drei";
import { Suspense, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { BUILDING_MODELS, EmptySlot } from "./building-models";

export type SceneBuilding = {
  building_id: string;
  level: number;
  position_x: number;
  position_y: number;
  status: "idle" | "building" | "upgrading";
};

export type SceneSlot = {
  position_x: number;
  position_y: number;
  empty_for: string;  // catalog id of building that COULD go here
};

type Props = {
  buildings: SceneBuilding[];
  emptySlots?: SceneSlot[];
  /** Wenn ein leerer Slot getapped wird → catalog-id des vorgeschlagenen Buildings */
  onSlotTap?: (catalogId: string) => void;
  /** Wenn ein vorhandenes Building getapped wird */
  onBuildingTap?: (buildingId: string) => void;
  /** "solo" oder "crew" — beeinflusst Bodenfarbe + Skybox */
  variant?: "solo" | "crew";
  /** Pixel-Höhe der Canvas */
  height?: number;
};

/** Hex/Grid → world-coords */
function gridToWorld(x: number, y: number): [number, number, number] {
  // 4-Slot-Grid 2x2 zentriert. Spacing 4.5
  const spacing = 4.5;
  return [(x - 0.5) * spacing, 0, (y - 0.5) * spacing];
}

function GroundPlate({ variant }: { variant: "solo" | "crew" }) {
  const color = variant === "crew" ? "#1a3a4d" : "#1a2a1a";
  const accent = variant === "crew" ? "#22D1C3" : "#4ade80";
  return (
    <group>
      {/* Bodenplatte */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <circleGeometry args={[14, 64]} />
        <meshStandardMaterial color={color} roughness={0.85} metalness={0.1} />
      </mesh>
      {/* Glow-Ring */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, 0]}>
        <ringGeometry args={[12.5, 13.5, 64]} />
        <meshBasicMaterial color={accent} transparent opacity={0.5} />
      </mesh>
      {/* Innerer Pfad */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]}>
        <ringGeometry args={[2.5, 2.7, 64]} />
        <meshBasicMaterial color={accent} transparent opacity={0.3} />
      </mesh>
      {/* Center-Plate (Base-Core) */}
      <mesh position={[0, 0.05, 0]} castShadow>
        <cylinderGeometry args={[2.3, 2.5, 0.3, 8]} />
        <meshStandardMaterial color="#2a2d3a" roughness={0.6} metalness={0.4} />
      </mesh>
      <mesh position={[0, 0.25, 0]}>
        <cylinderGeometry args={[1.5, 1.5, 0.1, 32]} />
        <meshStandardMaterial color={accent} emissive={accent} emissiveIntensity={0.5} />
      </mesh>
    </group>
  );
}

function FloatingParticles({ accent }: { accent: string }) {
  const ref = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    if (ref.current) ref.current.rotation.y = clock.getElapsedTime() * 0.05;
  });
  const positions = useMemo(() => {
    const arr: Array<[number, number, number]> = [];
    for (let i = 0; i < 18; i++) {
      const angle = (i / 18) * Math.PI * 2;
      const r = 8 + Math.random() * 4;
      arr.push([Math.cos(angle) * r, 1 + Math.random() * 5, Math.sin(angle) * r]);
    }
    return arr;
  }, []);
  return (
    <group ref={ref}>
      {positions.map((p, i) => (
        <mesh key={i} position={p}>
          <sphereGeometry args={[0.08, 8, 8]} />
          <meshBasicMaterial color={accent} transparent opacity={0.6} />
        </mesh>
      ))}
    </group>
  );
}

function BuildingSlot({ b, onTap }: { b: SceneBuilding; onTap?: () => void }) {
  const [hovered, setHovered] = useState(false);
  const ref = useRef<THREE.Group>(null);
  const Model = BUILDING_MODELS[b.building_id];
  const isAnimated = b.status !== "idle";

  useFrame(({ clock }) => {
    if (!ref.current) return;
    const t = clock.getElapsedTime();
    if (isAnimated) {
      ref.current.position.y = Math.sin(t * 4) * 0.15 + 0.15;
      ref.current.rotation.y = t * 0.5;
    } else {
      ref.current.rotation.y = THREE.MathUtils.lerp(ref.current.rotation.y, hovered ? t * 0.3 : 0, 0.05);
      const targetY = hovered ? 0.3 : 0;
      ref.current.position.y = THREE.MathUtils.lerp(ref.current.position.y, targetY, 0.1);
    }
  });

  const pos = gridToWorld(b.position_x, b.position_y);
  return (
    <group position={pos}>
      <group
        ref={ref}
        onPointerOver={() => setHovered(true)}
        onPointerOut={() => setHovered(false)}
        onClick={onTap}
      >
        {Model ? <Model level={b.level} /> : <DefaultBuilding level={b.level} />}
      </group>
      {/* Level-Plate unter dem Building */}
      <mesh position={[0, 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[1.4, 1.5, 32]} />
        <meshBasicMaterial color={hovered ? "#FFD700" : "#22D1C3"} transparent opacity={0.6} />
      </mesh>
    </group>
  );
}

function DefaultBuilding({ level }: { level: number }) {
  const h = 1 + level * 0.2;
  return (
    <mesh position={[0, h / 2, 0]} castShadow>
      <boxGeometry args={[1.5, h, 1.5]} />
      <meshStandardMaterial color="#888" />
    </mesh>
  );
}

export function BaseScene({
  buildings,
  emptySlots = [],
  onSlotTap,
  onBuildingTap,
  variant = "solo",
  height = 320,
}: Props) {
  const accent = variant === "crew" ? "#22D1C3" : "#4ade80";
  const skyColor = variant === "crew" ? "#0a1d2c" : "#0e1a2c";

  return (
    <div style={{ width: "100%", height, position: "relative" }}>
      <Canvas
        shadows
        camera={{ position: [10, 12, 10], fov: 35 }}
        style={{ background: `linear-gradient(180deg, ${skyColor} 0%, #0F1115 100%)` }}
        dpr={[1, 2]}
      >
        <Suspense fallback={null}>
          {/* Lighting */}
          <ambientLight intensity={0.6} />
          <directionalLight
            position={[10, 14, 8]}
            intensity={1.1}
            castShadow
            shadow-mapSize-width={1024}
            shadow-mapSize-height={1024}
            shadow-camera-left={-15}
            shadow-camera-right={15}
            shadow-camera-top={15}
            shadow-camera-bottom={-15}
          />
          <hemisphereLight args={[accent, "#0F1115", 0.4]} />
          <Environment preset="city" />

          <GroundPlate variant={variant} />
          <FloatingParticles accent={accent} />

          {buildings.map((b, i) => (
            <BuildingSlot key={`${b.building_id}-${i}`} b={b} onTap={() => onBuildingTap?.(b.building_id)} />
          ))}

          {emptySlots.map((s, i) => (
            <group key={`empty-${i}`} position={gridToWorld(s.position_x, s.position_y)}>
              <EmptySlot onTap={() => onSlotTap?.(s.empty_for)} />
            </group>
          ))}

          <Sky distance={450000} sunPosition={[10, 8, 5]} inclination={0.45} azimuth={0.25} />

          {/* OrbitControls — beschränkt auf top-down-iso, kein Zoom */}
          <OrbitControls
            enablePan={false}
            enableZoom={false}
            minPolarAngle={Math.PI / 4.5}
            maxPolarAngle={Math.PI / 3}
            autoRotate
            autoRotateSpeed={0.4}
          />
        </Suspense>
      </Canvas>
    </div>
  );
}
