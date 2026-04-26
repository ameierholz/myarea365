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

/** Grid → world-coords. 3x3-Slot-Grid mit Center frei (für Lagerfeuer). */
function gridToWorld(x: number, y: number): [number, number, number] {
  // 3x3-Grid (x,y in [0,2]) zentriert. Spacing 4.0
  const spacing = 4.0;
  return [(x - 1) * spacing, 0, (y - 1) * spacing];
}

function GroundPlate({ variant }: { variant: "solo" | "crew" }) {
  const color = variant === "crew" ? "#1a3a4d" : "#1a2a1a";
  const accent = variant === "crew" ? "#22D1C3" : "#4ade80";
  return (
    <group>
      {/* Bodenplatte */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <circleGeometry args={[15, 64]} />
        <meshStandardMaterial color={color} roughness={0.85} metalness={0.1} />
      </mesh>
      {/* Glow-Ring */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, 0]}>
        <ringGeometry args={[14, 14.8, 64]} />
        <meshBasicMaterial color={accent} transparent opacity={0.5} />
      </mesh>
      {/* Innerer Pfad-Ring */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]}>
        <ringGeometry args={[1.6, 1.75, 64]} />
        <meshBasicMaterial color={accent} transparent opacity={0.25} />
      </mesh>
    </group>
  );
}

/** Mauer-Ring um die Base — 16 Steinblöcke + 4 Türmchen + 1 Tor */
function WallRing({ variant }: { variant: "solo" | "crew" }) {
  const wallColor = variant === "crew" ? "#3a4a5a" : "#4a4d56";
  const accent = variant === "crew" ? "#22D1C3" : "#4ade80";
  const radius = 12.5;
  const segments = 16;
  return (
    <group>
      {Array.from({ length: segments }).map((_, i) => {
        // Vorne (i=0,1,15) ist das Tor — keine Wand
        if (i === 0 || i === 15) return null;
        const a = (i / segments) * Math.PI * 2;
        const x = Math.cos(a) * radius;
        const z = Math.sin(a) * radius;
        return (
          <group key={i} position={[x, 0, z]} rotation={[0, -a + Math.PI / 2, 0]}>
            <mesh position={[0, 0.6, 0]} castShadow>
              <boxGeometry args={[2.4, 1.2, 0.5]} />
              <meshStandardMaterial color={wallColor} roughness={0.9} />
            </mesh>
            {/* Zinnen */}
            {[-0.8, 0, 0.8].map((zx, k) => (
              <mesh key={k} position={[zx, 1.35, 0]} castShadow>
                <boxGeometry args={[0.4, 0.3, 0.5]} />
                <meshStandardMaterial color={wallColor} roughness={0.9} />
              </mesh>
            ))}
          </group>
        );
      })}
      {/* 4 Eck-Türmchen */}
      {[0, 0.25, 0.5, 0.75].map((p, i) => {
        const a = p * Math.PI * 2 + Math.PI / 8;
        const x = Math.cos(a) * radius;
        const z = Math.sin(a) * radius;
        return (
          <group key={i} position={[x, 0, z]}>
            <mesh position={[0, 1.1, 0]} castShadow>
              <cylinderGeometry args={[0.55, 0.7, 2.2, 8]} />
              <meshStandardMaterial color={wallColor} roughness={0.85} />
            </mesh>
            {/* Spitzdach */}
            <mesh position={[0, 2.5, 0]} castShadow>
              <coneGeometry args={[0.7, 0.8, 8]} />
              <meshStandardMaterial color={accent} emissive={accent} emissiveIntensity={0.15} metalness={0.3} />
            </mesh>
            {/* Glow oben */}
            <mesh position={[0, 3.0, 0]}>
              <sphereGeometry args={[0.12, 8, 8]} />
              <meshStandardMaterial color={accent} emissive={accent} emissiveIntensity={1} />
            </mesh>
          </group>
        );
      })}
      {/* Tor — vorne (positive X/Z) */}
      <group position={[radius, 0, 0]}>
        {/* Linker Pfeiler */}
        <mesh position={[0, 0.9, -0.9]} castShadow>
          <boxGeometry args={[0.7, 1.8, 0.7]} />
          <meshStandardMaterial color={wallColor} />
        </mesh>
        {/* Rechter Pfeiler */}
        <mesh position={[0, 0.9, 0.9]} castShadow>
          <boxGeometry args={[0.7, 1.8, 0.7]} />
          <meshStandardMaterial color={wallColor} />
        </mesh>
        {/* Querbalken */}
        <mesh position={[0, 1.9, 0]} castShadow>
          <boxGeometry args={[0.7, 0.3, 2.5]} />
          <meshStandardMaterial color={accent} emissive={accent} emissiveIntensity={0.3} />
        </mesh>
        {/* Zwei Banner an Pfeilern */}
        {[-0.9, 0.9].map((zb) => (
          <group key={zb} position={[0, 1.4, zb]}>
            <mesh position={[0.4, 0, 0]} rotation={[0, Math.PI / 2, 0]}>
              <planeGeometry args={[0.5, 0.8]} />
              <meshStandardMaterial color={accent} side={THREE.DoubleSide} />
            </mesh>
          </group>
        ))}
      </group>
    </group>
  );
}

/** Pfad-Kreuz von Center nach 8 Richtungen (verbindet Buildings) */
function PathCross() {
  const color = "#8b8074";
  return (
    <group>
      {/* 8 radiale Pfade */}
      {Array.from({ length: 8 }).map((_, i) => {
        const a = (i / 8) * Math.PI * 2;
        return (
          <mesh
            key={i}
            position={[Math.cos(a) * 5.2, 0.04, Math.sin(a) * 5.2]}
            rotation={[-Math.PI / 2, 0, -a]}
          >
            <planeGeometry args={[8, 0.7]} />
            <meshStandardMaterial color={color} roughness={1} transparent opacity={0.7} />
          </mesh>
        );
      })}
      {/* Center-Plaza */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.05, 0]}>
        <circleGeometry args={[1.8, 16]} />
        <meshStandardMaterial color={color} roughness={1} transparent opacity={0.85} />
      </mesh>
    </group>
  );
}

/** Lagerfeuer in der Mitte mit animiertem Flammen-Cluster */
function Campfire({ variant }: { variant: "solo" | "crew" }) {
  const fireRef = useRef<THREE.Group>(null);
  const lightRef = useRef<THREE.PointLight>(null);
  const accent = variant === "crew" ? PALETTE_TEAL : PALETTE_EMBER;
  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    if (fireRef.current) {
      fireRef.current.children.forEach((c, i) => {
        const phase = t * 3 + i * 1.7;
        c.scale.y = 0.7 + Math.sin(phase) * 0.3;
        c.position.y = 0.4 + Math.sin(phase * 0.5) * 0.05;
      });
    }
    if (lightRef.current) {
      lightRef.current.intensity = 1.5 + Math.sin(t * 5) * 0.5;
    }
  });
  return (
    <group position={[0, 0, 0]}>
      {/* Holzscheite kreuzweise */}
      <mesh position={[0, 0.1, 0]} castShadow rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.06, 0.06, 0.7, 6]} />
        <meshStandardMaterial color="#5a3a1c" />
      </mesh>
      <mesh position={[0, 0.1, 0]} castShadow rotation={[Math.PI / 2, 0, Math.PI / 3]}>
        <cylinderGeometry args={[0.06, 0.06, 0.7, 6]} />
        <meshStandardMaterial color="#5a3a1c" />
      </mesh>
      <mesh position={[0, 0.1, 0]} castShadow rotation={[Math.PI / 2, 0, -Math.PI / 3]}>
        <cylinderGeometry args={[0.06, 0.06, 0.7, 6]} />
        <meshStandardMaterial color="#5a3a1c" />
      </mesh>
      {/* Steinring */}
      {Array.from({ length: 8 }).map((_, i) => {
        const a = (i / 8) * Math.PI * 2;
        return (
          <mesh key={i} position={[Math.cos(a) * 0.45, 0.05, Math.sin(a) * 0.45]} castShadow>
            <boxGeometry args={[0.15, 0.1, 0.15]} />
            <meshStandardMaterial color="#4a4d56" />
          </mesh>
        );
      })}
      {/* Flammen */}
      <group ref={fireRef}>
        {[0, 1, 2].map((i) => (
          <mesh key={i} position={[Math.cos(i) * 0.1, 0.4, Math.sin(i) * 0.1]}>
            <coneGeometry args={[0.15 - i * 0.02, 0.5, 6]} />
            <meshStandardMaterial color={i === 0 ? "#FFE066" : i === 1 ? PALETTE_EMBER : PALETTE_PINK} emissive={i === 0 ? "#FFE066" : i === 1 ? PALETTE_EMBER : PALETTE_PINK} emissiveIntensity={1.5} transparent opacity={0.85} />
          </mesh>
        ))}
      </group>
      <pointLight ref={lightRef} position={[0, 0.6, 0]} color={accent} intensity={1.5} distance={6} />
    </group>
  );
}

const PALETTE_EMBER = "#FF6B4A";
const PALETTE_PINK  = "#FF2D78";
const PALETTE_TEAL  = "#22D1C3";

/** Bäume außerhalb der Mauer */
function ForestRing({ variant }: { variant: "solo" | "crew" }) {
  const treeColor = variant === "crew" ? "#3aa890" : "#4ade80";
  const trunkColor = "#5a3a1c";
  const trees = useMemo(() => {
    const arr: Array<{ x: number; z: number; h: number }> = [];
    const radius = 14.5;
    for (let i = 0; i < 28; i++) {
      const a = (i / 28) * Math.PI * 2 + (Math.random() * 0.2 - 0.1);
      const r = radius + Math.random() * 1.0;
      arr.push({ x: Math.cos(a) * r, z: Math.sin(a) * r, h: 0.7 + Math.random() * 0.7 });
    }
    return arr;
  }, []);
  return (
    <group>
      {trees.map((t, i) => (
        <group key={i} position={[t.x, 0, t.z]}>
          <mesh position={[0, t.h / 2, 0]} castShadow>
            <cylinderGeometry args={[0.08, 0.1, t.h, 5]} />
            <meshStandardMaterial color={trunkColor} />
          </mesh>
          <mesh position={[0, t.h + 0.4, 0]} castShadow>
            <coneGeometry args={[0.45, 0.9, 6]} />
            <meshStandardMaterial color={treeColor} />
          </mesh>
          <mesh position={[0, t.h + 0.95, 0]} castShadow>
            <coneGeometry args={[0.32, 0.6, 6]} />
            <meshStandardMaterial color={treeColor} />
          </mesh>
        </group>
      ))}
      {/* Felsen vereinzelt */}
      {Array.from({ length: 8 }).map((_, i) => {
        const a = (i / 8) * Math.PI * 2 + Math.PI / 16;
        const r = 14;
        return (
          <mesh key={i} position={[Math.cos(a) * r, 0.2, Math.sin(a) * r]} castShadow rotation={[0, Math.random() * Math.PI, 0]}>
            <dodecahedronGeometry args={[0.4 + Math.random() * 0.2]} />
            <meshStandardMaterial color="#5a5d68" roughness={1} flatShading />
          </mesh>
        );
      })}
    </group>
  );
}

/** Schwebende NPC-Lichter (kleine Bewohner, friedlich kreisend) */
function VillagerLights({ accent }: { accent: string }) {
  const ref = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    if (!ref.current) return;
    const t = clock.getElapsedTime();
    ref.current.children.forEach((c, i) => {
      const phase = t * 0.4 + (i / ref.current!.children.length) * Math.PI * 2;
      const r = 6 + (i % 3) * 1.5;
      c.position.x = Math.cos(phase) * r;
      c.position.z = Math.sin(phase) * r;
      c.position.y = 0.6 + Math.sin(t * 2 + i) * 0.2;
    });
  });
  return (
    <group ref={ref}>
      {Array.from({ length: 6 }).map((_, i) => (
        <pointLight key={i} color={accent} intensity={0.5} distance={2}>
          <mesh>
            <sphereGeometry args={[0.06, 8, 8]} />
            <meshBasicMaterial color={accent} />
          </mesh>
        </pointLight>
      ))}
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
        camera={{ position: [16, 18, 16], fov: 35 }}
        style={{ background: `linear-gradient(180deg, ${skyColor} 0%, #0F1115 100%)` }}
        dpr={[1, 2]}
      >
        <Suspense fallback={null}>
          {/* Lighting */}
          <ambientLight intensity={0.55} />
          <directionalLight
            position={[12, 18, 10]}
            intensity={1.2}
            castShadow
            shadow-mapSize-width={1536}
            shadow-mapSize-height={1536}
            shadow-camera-left={-18}
            shadow-camera-right={18}
            shadow-camera-top={18}
            shadow-camera-bottom={-18}
          />
          <hemisphereLight args={[accent, "#0F1115", 0.4]} />
          <Environment preset="city" />

          <GroundPlate variant={variant} />
          <PathCross />
          <WallRing variant={variant} />
          <ForestRing variant={variant} />
          <Campfire variant={variant} />
          <FloatingParticles accent={accent} />
          <VillagerLights accent={accent} />

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
            autoRotateSpeed={0.3}
          />
        </Suspense>
      </Canvas>
    </div>
  );
}
