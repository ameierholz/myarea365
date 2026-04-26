"use client";

/* eslint-disable react/no-unknown-property */

/**
 * Procedural low-poly Buildings für die 3D-Base.
 * Bewusst stylized (Monument-Valley-Vibe), keine externen Assets nötig.
 * Jede Komponente nimmt `level` und skaliert/dekoriert visuell mit Stufe.
 */

import { useFrame } from "@react-three/fiber";
import { useRef, useState } from "react";
import * as THREE from "three";

type LevelProps = { level: number };

const PALETTE = {
  stone:    "#5a5e6c",
  stoneDark:"#3a3e4a",
  wood:     "#8b5a2b",
  woodDark: "#5a3a1c",
  gold:     "#FFD700",
  teal:     "#22D1C3",
  pink:     "#FF2D78",
  purple:   "#a855f7",
  emerald:  "#4ade80",
  ember:    "#FF6B4A",
  iceblue:  "#7dd3fc",
};

// ─── Hilfs-Komponenten ──────────────────────────────────────────────────
function GlowRune({ color, y = 1.5, size = 0.3 }: { color: string; y?: number; size?: number }) {
  const ref = useRef<THREE.Mesh>(null);
  useFrame(({ clock }) => {
    if (ref.current) {
      const t = clock.getElapsedTime();
      const mat = ref.current.material as THREE.MeshStandardMaterial;
      mat.emissiveIntensity = 0.6 + Math.sin(t * 2) * 0.4;
    }
  });
  return (
    <mesh ref={ref} position={[0, y, 0]}>
      <sphereGeometry args={[size, 16, 16]} />
      <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.8} />
    </mesh>
  );
}

function Banner({ color, y, x = 0, z = 0 }: { color: string; y: number; x?: number; z?: number }) {
  const ref = useRef<THREE.Mesh>(null);
  useFrame(({ clock }) => {
    if (ref.current) ref.current.rotation.z = Math.sin(clock.getElapsedTime() * 1.5) * 0.08;
  });
  return (
    <group position={[x, y, z]}>
      <mesh position={[0, 0.4, 0]}>
        <cylinderGeometry args={[0.04, 0.04, 1, 6]} />
        <meshStandardMaterial color={PALETTE.woodDark} />
      </mesh>
      <mesh ref={ref} position={[0.2, 0.5, 0]}>
        <planeGeometry args={[0.4, 0.6]} />
        <meshStandardMaterial color={color} side={THREE.DoubleSide} />
      </mesh>
    </group>
  );
}

// ═══ SOLO BUILDINGS ═══════════════════════════════════════════════════

/** Wegekasse — Schatzkammer-Turm mit goldenem Dach */
function Wegekasse({ level }: LevelProps) {
  const h = 1.2 + level * 0.18;
  return (
    <group>
      {/* Sockel */}
      <mesh position={[0, 0.15, 0]} castShadow>
        <boxGeometry args={[1.6, 0.3, 1.6]} />
        <meshStandardMaterial color={PALETTE.stoneDark} />
      </mesh>
      {/* Turm */}
      <mesh position={[0, 0.3 + h / 2, 0]} castShadow>
        <boxGeometry args={[1.2, h, 1.2]} />
        <meshStandardMaterial color={PALETTE.stone} />
      </mesh>
      {/* Tür */}
      <mesh position={[0, 0.55, 0.61]}>
        <boxGeometry args={[0.4, 0.5, 0.02]} />
        <meshStandardMaterial color={PALETTE.woodDark} />
      </mesh>
      {/* Goldenes Dach */}
      <mesh position={[0, 0.3 + h + 0.3, 0]} castShadow>
        <coneGeometry args={[0.95, 0.7, 4]} />
        <meshStandardMaterial color={PALETTE.gold} metalness={0.7} roughness={0.3} emissive={PALETTE.gold} emissiveIntensity={0.15} />
      </mesh>
      {/* Schatzkiste vor dem Turm */}
      <mesh position={[0, 0.15, 0.85]} castShadow>
        <boxGeometry args={[0.4, 0.3, 0.25]} />
        <meshStandardMaterial color={PALETTE.wood} />
      </mesh>
      <mesh position={[0, 0.32, 0.85]}>
        <boxGeometry args={[0.42, 0.04, 0.27]} />
        <meshStandardMaterial color={PALETTE.gold} metalness={0.8} />
      </mesh>
      <GlowRune color={PALETTE.gold} y={0.3 + h + 0.75} size={0.08} />
    </group>
  );
}

/** Wald-Pfad — Plattform mit 3-5 Bäumen je nach Stufe */
function WaldPfad({ level }: LevelProps) {
  const trees = Math.min(5, 3 + Math.floor(level / 3));
  return (
    <group>
      {/* Plattform */}
      <mesh position={[0, 0.1, 0]} castShadow>
        <cylinderGeometry args={[0.95, 1.1, 0.2, 8]} />
        <meshStandardMaterial color={PALETTE.woodDark} />
      </mesh>
      {/* Pfad-Steine */}
      {[0, 1, 2, 3].map((i) => (
        <mesh key={i} position={[Math.cos((i / 4) * Math.PI * 2) * 0.5, 0.21, Math.sin((i / 4) * Math.PI * 2) * 0.5]}>
          <boxGeometry args={[0.18, 0.04, 0.18]} />
          <meshStandardMaterial color={PALETTE.stone} />
        </mesh>
      ))}
      {/* Bäume */}
      {Array.from({ length: trees }).map((_, i) => {
        const angle = (i / trees) * Math.PI * 2;
        const r = 0.55;
        const x = Math.cos(angle) * r;
        const z = Math.sin(angle) * r;
        const treeH = 0.5 + (i % 3) * 0.2;
        return (
          <group key={i} position={[x, 0.2, z]}>
            <mesh position={[0, treeH / 2, 0]} castShadow>
              <cylinderGeometry args={[0.06, 0.08, treeH, 5]} />
              <meshStandardMaterial color={PALETTE.woodDark} />
            </mesh>
            <mesh position={[0, treeH + 0.25, 0]} castShadow>
              <coneGeometry args={[0.3, 0.5, 5]} />
              <meshStandardMaterial color={PALETTE.emerald} />
            </mesh>
            <mesh position={[0, treeH + 0.55, 0]} castShadow>
              <coneGeometry args={[0.22, 0.4, 5]} />
              <meshStandardMaterial color={PALETTE.emerald} />
            </mesh>
          </group>
        );
      })}
      <GlowRune color={PALETTE.emerald} y={1.5} size={0.07} />
    </group>
  );
}

/** Wächter-Halle — Rune-Tor mit pulsierendem Portal */
function WaechterHalle({ level }: LevelProps) {
  const portalGlow = 0.5 + level * 0.05;
  const portalRef = useRef<THREE.Mesh>(null);
  useFrame(({ clock }) => {
    if (portalRef.current) {
      const t = clock.getElapsedTime();
      const mat = portalRef.current.material as THREE.MeshStandardMaterial;
      mat.emissiveIntensity = portalGlow + Math.sin(t * 1.5) * 0.3;
    }
  });
  return (
    <group>
      {/* Sockel */}
      <mesh position={[0, 0.15, 0]} castShadow>
        <boxGeometry args={[1.8, 0.3, 1.4]} />
        <meshStandardMaterial color={PALETTE.stoneDark} />
      </mesh>
      {/* Linke Säule */}
      <mesh position={[-0.6, 0.95, 0]} castShadow>
        <boxGeometry args={[0.3, 1.5, 0.3]} />
        <meshStandardMaterial color={PALETTE.stone} />
      </mesh>
      {/* Rechte Säule */}
      <mesh position={[0.6, 0.95, 0]} castShadow>
        <boxGeometry args={[0.3, 1.5, 0.3]} />
        <meshStandardMaterial color={PALETTE.stone} />
      </mesh>
      {/* Querbalken */}
      <mesh position={[0, 1.85, 0]} castShadow>
        <boxGeometry args={[1.6, 0.2, 0.4]} />
        <meshStandardMaterial color={PALETTE.purple} emissive={PALETTE.purple} emissiveIntensity={0.3} />
      </mesh>
      {/* Portal */}
      <mesh ref={portalRef} position={[0, 0.95, 0]}>
        <planeGeometry args={[0.95, 1.4]} />
        <meshStandardMaterial color={PALETTE.purple} emissive={PALETTE.purple} emissiveIntensity={portalGlow} transparent opacity={0.7} side={THREE.DoubleSide} />
      </mesh>
      <Banner color={PALETTE.pink} y={1.0} x={-0.85} />
      <Banner color={PALETTE.pink} y={1.0} x={0.85} />
      <GlowRune color={PALETTE.purple} y={2.05} size={0.1} />
    </group>
  );
}

/** Lauftürme — schlanker Aussichtsturm + Sucher-Strahl */
function Laufturm({ level }: LevelProps) {
  const beamRef = useRef<THREE.Mesh>(null);
  useFrame(({ clock }) => {
    if (beamRef.current) beamRef.current.rotation.y = clock.getElapsedTime() * 0.8;
  });
  const baseH = 1.5 + level * 0.18;
  return (
    <group>
      {/* Sockel */}
      <mesh position={[0, 0.1, 0]} castShadow>
        <cylinderGeometry args={[0.7, 0.9, 0.2, 8]} />
        <meshStandardMaterial color={PALETTE.stoneDark} />
      </mesh>
      {/* Turm */}
      <mesh position={[0, 0.2 + baseH / 2, 0]} castShadow>
        <cylinderGeometry args={[0.35, 0.45, baseH, 8]} />
        <meshStandardMaterial color={PALETTE.stone} />
      </mesh>
      {/* Plattform oben */}
      <mesh position={[0, 0.2 + baseH + 0.1, 0]} castShadow>
        <cylinderGeometry args={[0.65, 0.5, 0.2, 8]} />
        <meshStandardMaterial color={PALETTE.woodDark} />
      </mesh>
      {/* Geländer */}
      <mesh position={[0, 0.2 + baseH + 0.3, 0]}>
        <torusGeometry args={[0.55, 0.03, 8, 16]} />
        <meshStandardMaterial color={PALETTE.wood} />
      </mesh>
      {/* Suchscheinwerfer */}
      <group ref={beamRef} position={[0, 0.2 + baseH + 0.3, 0]}>
        <mesh position={[0.5, 0.05, 0]}>
          <boxGeometry args={[0.2, 0.15, 0.15]} />
          <meshStandardMaterial color={PALETTE.gold} metalness={0.6} />
        </mesh>
        <mesh position={[1.5, 0.05, 0]} rotation={[0, 0, Math.PI / 2]}>
          <coneGeometry args={[0.4, 2, 16, 1, true]} />
          <meshBasicMaterial color={PALETTE.gold} transparent opacity={0.18} side={THREE.DoubleSide} />
        </mesh>
      </group>
      <GlowRune color={PALETTE.gold} y={0.2 + baseH + 0.55} size={0.06} />
    </group>
  );
}

// ═══ CREW BUILDINGS ════════════════════════════════════════════════════

/** Crew-Treffpunkt — Bühne mit Banner-Pavillon */
function CrewTreffpunkt({ level }: LevelProps) {
  return (
    <group>
      {/* Bühne */}
      <mesh position={[0, 0.15, 0]} castShadow>
        <boxGeometry args={[1.8, 0.3, 1.8]} />
        <meshStandardMaterial color={PALETTE.woodDark} />
      </mesh>
      {/* 4 Säulen */}
      {[[-0.7,-0.7],[0.7,-0.7],[-0.7,0.7],[0.7,0.7]].map(([x,z],i) => (
        <mesh key={i} position={[x, 0.85, z]} castShadow>
          <cylinderGeometry args={[0.08, 0.08, 1.4, 8]} />
          <meshStandardMaterial color={PALETTE.wood} />
        </mesh>
      ))}
      {/* Dach */}
      <mesh position={[0, 1.7, 0]} castShadow>
        <coneGeometry args={[1.4, 0.8, 4]} />
        <meshStandardMaterial color={PALETTE.teal} emissive={PALETTE.teal} emissiveIntensity={0.1} />
      </mesh>
      {/* Tisch in der Mitte */}
      <mesh position={[0, 0.55, 0]} castShadow>
        <cylinderGeometry args={[0.3, 0.3, 0.4, 8]} />
        <meshStandardMaterial color={PALETTE.stone} />
      </mesh>
      {/* Crew-Marker */}
      <Banner color={PALETTE.teal} y={1.3} x={0} z={0.85} />
      <GlowRune color={PALETTE.teal} y={2.2} size={0.12 + level * 0.01} />
    </group>
  );
}

/** Truhenkammer — Schatz-Pyramide */
function Truhenkammer({ level }: LevelProps) {
  return (
    <group>
      <mesh position={[0, 0.1, 0]} castShadow>
        <boxGeometry args={[1.5, 0.2, 1.5]} />
        <meshStandardMaterial color={PALETTE.stoneDark} />
      </mesh>
      {/* Pyramide */}
      <mesh position={[0, 0.7, 0]} castShadow>
        <coneGeometry args={[0.85, 1.2, 4]} />
        <meshStandardMaterial color={PALETTE.gold} metalness={0.6} roughness={0.4} emissive={PALETTE.gold} emissiveIntensity={0.15} />
      </mesh>
      {/* Truhen vorne */}
      {[-0.4, 0, 0.4].map((x) => (
        <group key={x} position={[x, 0.18, 0.85]}>
          <mesh castShadow>
            <boxGeometry args={[0.25, 0.18, 0.18]} />
            <meshStandardMaterial color={PALETTE.wood} />
          </mesh>
          <mesh position={[0, 0.11, 0]}>
            <boxGeometry args={[0.27, 0.04, 0.2]} />
            <meshStandardMaterial color={PALETTE.gold} metalness={0.8} />
          </mesh>
        </group>
      ))}
      <GlowRune color={PALETTE.gold} y={1.45 + level * 0.02} size={0.1} />
    </group>
  );
}

/** Arena-Halle — Kolosseum-Style */
function ArenaHalle({ level }: LevelProps) {
  return (
    <group>
      {/* Außen-Ring */}
      <mesh position={[0, 0.3, 0]} rotation={[Math.PI / 2, 0, 0]} castShadow>
        <torusGeometry args={[0.85, 0.25, 8, 16]} />
        <meshStandardMaterial color={PALETTE.stone} />
      </mesh>
      {/* Säulen */}
      {Array.from({ length: 8 }).map((_, i) => {
        const a = (i / 8) * Math.PI * 2;
        return (
          <mesh key={i} position={[Math.cos(a) * 0.85, 0.6, Math.sin(a) * 0.85]} castShadow>
            <cylinderGeometry args={[0.08, 0.1, 0.7, 6]} />
            <meshStandardMaterial color={PALETTE.stone} />
          </mesh>
        );
      })}
      {/* Innen-Boden (Arena) */}
      <mesh position={[0, 0.05, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[0.7, 32]} />
        <meshStandardMaterial color={PALETTE.ember} emissive={PALETTE.ember} emissiveIntensity={0.4} />
      </mesh>
      {/* 2 Klingen kreuzweise */}
      <mesh position={[0, 1.1, 0]} rotation={[0, 0, Math.PI / 4]}>
        <boxGeometry args={[0.05, 0.8, 0.05]} />
        <meshStandardMaterial color={PALETTE.iceblue} metalness={0.7} />
      </mesh>
      <mesh position={[0, 1.1, 0]} rotation={[0, 0, -Math.PI / 4]}>
        <boxGeometry args={[0.05, 0.8, 0.05]} />
        <meshStandardMaterial color={PALETTE.iceblue} metalness={0.7} />
      </mesh>
      <GlowRune color={PALETTE.ember} y={1.65} size={0.1 + level * 0.005} />
    </group>
  );
}

/** Mana-Quell — Brunnen mit aufsteigender Wassersäule */
function ManaQuell({ level }: LevelProps) {
  const waterRef = useRef<THREE.Mesh>(null);
  useFrame(({ clock }) => {
    if (waterRef.current) {
      const t = clock.getElapsedTime();
      waterRef.current.scale.y = 1 + Math.sin(t * 2) * 0.15;
      waterRef.current.position.y = 0.6 + Math.sin(t * 2) * 0.05;
    }
  });
  return (
    <group>
      {/* Becken */}
      <mesh position={[0, 0.1, 0]} castShadow>
        <cylinderGeometry args={[0.85, 1.0, 0.2, 16]} />
        <meshStandardMaterial color={PALETTE.stone} />
      </mesh>
      <mesh position={[0, 0.25, 0]}>
        <cylinderGeometry args={[0.7, 0.7, 0.2, 16]} />
        <meshStandardMaterial color={PALETTE.iceblue} transparent opacity={0.7} emissive={PALETTE.iceblue} emissiveIntensity={0.4} />
      </mesh>
      {/* Inner-Sockel */}
      <mesh position={[0, 0.4, 0]} castShadow>
        <cylinderGeometry args={[0.18, 0.22, 0.4, 8]} />
        <meshStandardMaterial color={PALETTE.stoneDark} />
      </mesh>
      {/* Wassersäule */}
      <mesh ref={waterRef} position={[0, 0.6, 0]}>
        <cylinderGeometry args={[0.08, 0.12, 0.4, 8]} />
        <meshStandardMaterial color={PALETTE.iceblue} emissive={PALETTE.iceblue} emissiveIntensity={0.6} transparent opacity={0.8} />
      </mesh>
      {/* Tropfen oben */}
      {[0, 1, 2].map((i) => (
        <mesh key={i} position={[Math.cos((i / 3) * Math.PI * 2) * 0.15, 0.95 + i * 0.1, Math.sin((i / 3) * Math.PI * 2) * 0.15]}>
          <sphereGeometry args={[0.05, 8, 8]} />
          <meshStandardMaterial color={PALETTE.iceblue} emissive={PALETTE.iceblue} emissiveIntensity={0.8} transparent opacity={0.7} />
        </mesh>
      ))}
      <GlowRune color={PALETTE.iceblue} y={1.3 + level * 0.01} size={0.08} />
    </group>
  );
}

// ═══ EMPTY-SLOT (für noch nicht gebaute Buildings) ═════════════════════
export function EmptySlot({ onTap }: { onTap?: () => void }) {
  const [hovered, setHovered] = useState(false);
  const ref = useRef<THREE.Mesh>(null);
  useFrame(({ clock }) => {
    if (ref.current) {
      ref.current.rotation.y = clock.getElapsedTime() * 0.5;
      const mat = ref.current.material as THREE.MeshStandardMaterial;
      mat.opacity = hovered ? 0.8 : 0.4;
    }
  });
  return (
    <group onPointerOver={() => setHovered(true)} onPointerOut={() => setHovered(false)} onClick={onTap}>
      <mesh ref={ref} position={[0, 0.5, 0]}>
        <torusGeometry args={[0.5, 0.05, 8, 16]} />
        <meshStandardMaterial color={hovered ? PALETTE.gold : PALETTE.teal} transparent opacity={0.4} emissive={hovered ? PALETTE.gold : PALETTE.teal} emissiveIntensity={0.5} />
      </mesh>
      <mesh position={[0, 0.5, 0]}>
        <boxGeometry args={[0.15, 0.4, 0.05]} />
        <meshStandardMaterial color={hovered ? PALETTE.gold : PALETTE.teal} emissive={hovered ? PALETTE.gold : PALETTE.teal} emissiveIntensity={0.6} transparent opacity={0.7} />
      </mesh>
      <mesh position={[0, 0.5, 0]} rotation={[0, 0, Math.PI / 2]}>
        <boxGeometry args={[0.15, 0.4, 0.05]} />
        <meshStandardMaterial color={hovered ? PALETTE.gold : PALETTE.teal} emissive={hovered ? PALETTE.gold : PALETTE.teal} emissiveIntensity={0.6} transparent opacity={0.7} />
      </mesh>
    </group>
  );
}

// ═══ NEUE SOLO BUILDINGS (Migration 00082) ════════════════════════════

/** Lagerhalle — flache breite Halle mit Holz/Stein-Stapeln davor */
function Lagerhalle({ level }: LevelProps) {
  return (
    <group>
      {/* Sockel */}
      <mesh position={[0, 0.1, 0]} castShadow>
        <boxGeometry args={[1.7, 0.2, 1.3]} />
        <meshStandardMaterial color={PALETTE.stoneDark} />
      </mesh>
      {/* Hauptgebäude */}
      <mesh position={[0, 0.55, 0]} castShadow>
        <boxGeometry args={[1.5, 0.7, 1.1]} />
        <meshStandardMaterial color={PALETTE.wood} />
      </mesh>
      {/* Dach */}
      <mesh position={[0, 1.05, 0]} castShadow rotation={[0, Math.PI / 4, 0]}>
        <coneGeometry args={[1.1, 0.5, 4]} />
        <meshStandardMaterial color={PALETTE.woodDark} />
      </mesh>
      {/* Tor */}
      <mesh position={[0, 0.4, 0.56]}>
        <boxGeometry args={[0.5, 0.5, 0.02]} />
        <meshStandardMaterial color={PALETTE.stoneDark} />
      </mesh>
      {/* Holzstapel links */}
      <group position={[-0.95, 0.2, 0.4]}>
        {[0, 1, 2].map((i) => (
          <mesh key={i} position={[0, 0.07 * i, 0]} rotation={[0, 0, Math.PI / 2]} castShadow>
            <cylinderGeometry args={[0.06, 0.06, 0.4, 6]} />
            <meshStandardMaterial color={PALETTE.woodDark} />
          </mesh>
        ))}
      </group>
      {/* Steinstapel rechts */}
      <group position={[0.9, 0.15, 0.5]}>
        {[
          [0, 0, 0], [0.18, 0, 0], [0.09, 0.15, 0],
        ].map((p, i) => (
          <mesh key={i} position={p as [number, number, number]} castShadow>
            <boxGeometry args={[0.16, 0.14, 0.16]} />
            <meshStandardMaterial color={PALETTE.stone} />
          </mesh>
        ))}
      </group>
      <GlowRune color={PALETTE.wood} y={1.4 + level * 0.01} size={0.07} />
    </group>
  );
}

/** Schmiede — Esse mit aufsteigendem Rauch + Amboss */
function Schmiede({ level }: LevelProps) {
  const smokeRef = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    if (smokeRef.current) {
      const t = clock.getElapsedTime();
      smokeRef.current.children.forEach((c, i) => {
        c.position.y = 1.6 + ((t * 0.4 + i * 0.4) % 1.2);
        const scale = 0.1 + ((t * 0.4 + i * 0.4) % 1.2) * 0.15;
        c.scale.set(scale, scale, scale);
        const mat = (c as THREE.Mesh).material as THREE.MeshStandardMaterial;
        mat.opacity = Math.max(0, 0.5 - ((t * 0.4 + i * 0.4) % 1.2) * 0.4);
      });
    }
  });
  return (
    <group>
      {/* Sockel */}
      <mesh position={[0, 0.1, 0]} castShadow>
        <boxGeometry args={[1.4, 0.2, 1.4]} />
        <meshStandardMaterial color={PALETTE.stoneDark} />
      </mesh>
      {/* Hauptgebäude */}
      <mesh position={[0, 0.55, 0]} castShadow>
        <boxGeometry args={[1.2, 0.7, 1.2]} />
        <meshStandardMaterial color={PALETTE.stone} />
      </mesh>
      {/* Schornstein */}
      <mesh position={[0.4, 1.1, -0.3]} castShadow>
        <cylinderGeometry args={[0.12, 0.15, 1, 6]} />
        <meshStandardMaterial color={PALETTE.stoneDark} />
      </mesh>
      {/* Glühende Esse-Öffnung im Schornstein */}
      <mesh position={[0.4, 1.55, -0.3]}>
        <sphereGeometry args={[0.1, 8, 8]} />
        <meshStandardMaterial color={PALETTE.ember} emissive={PALETTE.ember} emissiveIntensity={1.5} />
      </mesh>
      {/* Dach */}
      <mesh position={[0, 1.05, 0]} castShadow>
        <boxGeometry args={[1.3, 0.15, 1.3]} />
        <meshStandardMaterial color={PALETTE.woodDark} />
      </mesh>
      {/* Amboss vorne */}
      <mesh position={[0, 0.3, 0.85]} castShadow>
        <boxGeometry args={[0.3, 0.2, 0.15]} />
        <meshStandardMaterial color={PALETTE.stoneDark} metalness={0.6} />
      </mesh>
      {/* Hammer */}
      <mesh position={[0.15, 0.5, 0.85]} castShadow rotation={[0, 0, Math.PI / 6]}>
        <boxGeometry args={[0.04, 0.4, 0.04]} />
        <meshStandardMaterial color={PALETTE.woodDark} />
      </mesh>
      <mesh position={[0.18, 0.7, 0.85]} castShadow>
        <boxGeometry args={[0.15, 0.08, 0.08]} />
        <meshStandardMaterial color={PALETTE.stoneDark} metalness={0.7} />
      </mesh>
      {/* Rauch */}
      <group ref={smokeRef} position={[0.4, 1.6, -0.3]}>
        {[0, 1, 2, 3].map((i) => (
          <mesh key={i}>
            <sphereGeometry args={[1, 8, 8]} />
            <meshStandardMaterial color="#aaa" transparent opacity={0.3} />
          </mesh>
        ))}
      </group>
      <GlowRune color={PALETTE.ember} y={1.45} size={0.07 + level * 0.005} />
    </group>
  );
}

/** Gasthaus — Fachwerk-Tavern mit Schild */
function Gasthaus({ level }: LevelProps) {
  return (
    <group>
      {/* Sockel */}
      <mesh position={[0, 0.1, 0]} castShadow>
        <boxGeometry args={[1.5, 0.2, 1.3]} />
        <meshStandardMaterial color={PALETTE.stoneDark} />
      </mesh>
      {/* Erdgeschoss */}
      <mesh position={[0, 0.5, 0]} castShadow>
        <boxGeometry args={[1.4, 0.6, 1.2]} />
        <meshStandardMaterial color="#d4b483" />
      </mesh>
      {/* Fachwerk-Balken (vereinfacht) */}
      {[-0.5, 0.5].map((x) => (
        <mesh key={x} position={[x, 0.5, 0.61]}>
          <boxGeometry args={[0.06, 0.6, 0.04]} />
          <meshStandardMaterial color={PALETTE.woodDark} />
        </mesh>
      ))}
      <mesh position={[0, 0.2, 0.61]}>
        <boxGeometry args={[1.3, 0.06, 0.04]} />
        <meshStandardMaterial color={PALETTE.woodDark} />
      </mesh>
      <mesh position={[0, 0.78, 0.61]}>
        <boxGeometry args={[1.3, 0.06, 0.04]} />
        <meshStandardMaterial color={PALETTE.woodDark} />
      </mesh>
      {/* Tür */}
      <mesh position={[0, 0.45, 0.62]}>
        <boxGeometry args={[0.3, 0.5, 0.02]} />
        <meshStandardMaterial color={PALETTE.woodDark} />
      </mesh>
      {/* Fenster (warm leuchtend) */}
      {[-0.4, 0.4].map((x) => (
        <mesh key={x} position={[x, 0.55, 0.62]}>
          <boxGeometry args={[0.18, 0.18, 0.02]} />
          <meshStandardMaterial color="#FFC85A" emissive="#FFC85A" emissiveIntensity={0.8} />
        </mesh>
      ))}
      {/* Dach (giebelförmig) */}
      <mesh position={[0, 1.05, 0]} rotation={[0, Math.PI / 4, 0]} castShadow>
        <coneGeometry args={[1.1, 0.55, 4]} />
        <meshStandardMaterial color="#7a3a1a" />
      </mesh>
      {/* Schild über der Tür */}
      <mesh position={[0, 0.95, 0.7]}>
        <boxGeometry args={[0.4, 0.18, 0.03]} />
        <meshStandardMaterial color={PALETTE.gold} metalness={0.5} emissive={PALETTE.gold} emissiveIntensity={0.2} />
      </mesh>
      {/* Bierfass davor */}
      <mesh position={[0.55, 0.25, 0.85]} castShadow rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.18, 0.18, 0.3, 12]} />
        <meshStandardMaterial color={PALETTE.woodDark} />
      </mesh>
      <Banner color={PALETTE.gold} y={1.3} x={-0.7} z={0.5} />
      <GlowRune color={PALETTE.gold} y={1.5 + level * 0.01} size={0.07} />
    </group>
  );
}

/** Wachturm — schlanker hoher Turm mit Zinnen */
function Wachturm({ level }: LevelProps) {
  const baseH = 1.8 + level * 0.12;
  return (
    <group>
      {/* Sockel */}
      <mesh position={[0, 0.1, 0]} castShadow>
        <cylinderGeometry args={[0.55, 0.7, 0.2, 8]} />
        <meshStandardMaterial color={PALETTE.stoneDark} />
      </mesh>
      {/* Turmschaft */}
      <mesh position={[0, 0.2 + baseH / 2, 0]} castShadow>
        <cylinderGeometry args={[0.35, 0.5, baseH, 8]} />
        <meshStandardMaterial color={PALETTE.stone} />
      </mesh>
      {/* Tür */}
      <mesh position={[0, 0.5, 0.5]}>
        <boxGeometry args={[0.25, 0.45, 0.02]} />
        <meshStandardMaterial color={PALETTE.woodDark} />
      </mesh>
      {/* Schießscharten (3 Etagen) */}
      {[0.8, 1.3, 1.8].map((y, i) => (
        <mesh key={i} position={[0, y, 0.5]}>
          <boxGeometry args={[0.06, 0.18, 0.02]} />
          <meshStandardMaterial color="#000" />
        </mesh>
      ))}
      {/* Plattform mit Zinnen */}
      <mesh position={[0, 0.2 + baseH + 0.1, 0]} castShadow>
        <cylinderGeometry args={[0.55, 0.4, 0.18, 8]} />
        <meshStandardMaterial color={PALETTE.stoneDark} />
      </mesh>
      {/* 8 Zinnen */}
      {Array.from({ length: 8 }).map((_, i) => {
        const a = (i / 8) * Math.PI * 2;
        return (
          <mesh key={i} position={[Math.cos(a) * 0.5, 0.2 + baseH + 0.28, Math.sin(a) * 0.5]} castShadow>
            <boxGeometry args={[0.1, 0.18, 0.1]} />
            <meshStandardMaterial color={PALETTE.stone} />
          </mesh>
        );
      })}
      {/* Banner oben */}
      <Banner color={PALETTE.pink} y={0.2 + baseH + 0.4} x={0} z={0} />
      <GlowRune color={PALETTE.pink} y={0.2 + baseH + 0.7} size={0.06} />
    </group>
  );
}

// ─── Map: building_id → Component ──────────────────────────────────────
export const BUILDING_MODELS: Record<string, React.ComponentType<LevelProps>> = {
  wegekasse:        Wegekasse,
  wald_pfad:        WaldPfad,
  waechter_halle:   WaechterHalle,
  laufturm:         Laufturm,
  lagerhalle:       Lagerhalle,
  schmiede:         Schmiede,
  gasthaus:         Gasthaus,
  wachturm:         Wachturm,
  crew_treffpunkt:  CrewTreffpunkt,
  truhenkammer:     Truhenkammer,
  arena_halle:      ArenaHalle,
  mana_quell:       ManaQuell,
};
