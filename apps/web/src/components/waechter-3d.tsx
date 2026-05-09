"use client";

/**
 * Waechter3D — rendert ein animiertes 3D-Modell eines Wächters via Three.js.
 *
 * Nutzt React-Three-Fiber + drei für glTF-Loading + Animation-Mixing.
 * Asset-Slot pro Archetype: /3d/{archetypeId}/character.glb + animation-glbs.
 * Fallback auf Lorekeeper-Standardmodell falls archetype-spezifisches fehlt.
 *
 * Performance:
 * - Eine Canvas pro Mount (kein Mehrfach-Instancing — für 1 Wächter im Modal)
 * - frameloop="demand" → rendert nur wenn animiert (kein konstantes Re-Render)
 * - Lazy-loaded via dynamic-import im Wrapper, three-Bundle nur wenn nötig
 */

import { Canvas, useFrame } from "@react-three/fiber";
import { useGLTF, useAnimations, OrbitControls, Environment, ContactShadows } from "@react-three/drei";
import { Suspense, useEffect, useMemo, useRef } from "react";
import * as THREE from "three";

export type Animation = "idle" | "walk" | "run" | "jump" | "throw" | "interact" | "pickup" | "hit" | "spawn" | "death";

// Mapping archetype_id (z.B. "bgl_brute") → GLB-Datei in /3d/waechter/
function characterGlbPath(archetypeId?: string | null): string {
  if (!archetypeId) return "/3d/waechter/lorekeeper.glb";
  const name = archetypeId.startsWith("bgl_") ? archetypeId.slice(4) : archetypeId;
  return `/3d/waechter/${name}.glb`;
}

const LOREKEEPER_ANIMS = {
  general: "/3d/lorekeeper/anim_general.glb",
  movement: "/3d/lorekeeper/anim_movement.glb",
};

/**
 * Mappt unsere semantischen Anim-Namen auf die tatsächlichen Clip-Namen
 * im Lorekeeper-Animation-Pack (KayKit-Konvention, verifiziert via GLB-Header).
 *
 * Verfügbare Clips:
 *   Idle_A, Idle_B, Walking_A/B/C, Running_A/B, Jump_*, Hit_A/B, Death_A/B,
 *   Throw, Interact, PickUp, Use_Item, Spawn_Ground/Air
 */
const ANIM_NAME_MAP: Record<Animation, string[]> = {
  idle:     ["Idle_A", "Idle_B"],
  walk:     ["Walking_A", "Walking_B", "Walking_C"],
  run:      ["Running_A", "Running_B"],
  jump:     ["Jump_Idle", "Jump_Full_Long", "Jump_Full_Short"],
  throw:    ["Throw"],
  interact: ["Interact"],
  pickup:   ["PickUp"],
  hit:      ["Hit_A", "Hit_B"],
  spawn:    ["Spawn_Ground", "Spawn_Air"],
  death:    ["Death_A", "Death_B"],
};

function CharacterModel({ animation, archetypeId }: { animation: Animation; archetypeId?: string | null }) {
  const charPath = characterGlbPath(archetypeId);
  const charGltf = useGLTF(charPath);
  const generalGltf = useGLTF(LOREKEEPER_ANIMS.general);
  const movementGltf = useGLTF(LOREKEEPER_ANIMS.movement);

  const groupRef = useRef<THREE.Group>(null);

  // Scene clonen damit jede Instanz unabhängig ist (sonst überschreibt Cache
  // unsere Animation/Position bei zweitem Mount oder mehrfacher Verwendung).
  const sceneClone = useMemo(() => charGltf.scene?.clone(true), [charGltf.scene]);

  // Hardcoded Transform: Quaternius/KayKit-Characters sind ~2 Welt-Einheiten
  // hoch, Origin an den Füßen. scale 0.7 + position[0,-0.7,0] zentriert sie
  // in (-0.7, +0.7) um den Ursprung. Camera [0,0.2,5] fov 38 zeigt vertikal
  // -1.52 bis +1.92 → fits mit großzügigem Margin.

  // Bündele alle Clips aus beiden Animation-Packs zusammen.
  // Lorekeeper-Anim-Pack funktioniert nur auf der Lorekeeper-Skelett-Topologie —
  // andere Wächter zeigen ihre eingebetteten Clips (falls vorhanden) oder static.
  const allClips = useMemo(() => {
    const clips: THREE.AnimationClip[] = [];
    if (charGltf.animations?.length) clips.push(...charGltf.animations);
    const isLorekeeper = !archetypeId || archetypeId === "bgl_lorekeeper";
    if (isLorekeeper) {
      if (generalGltf.animations?.length) clips.push(...generalGltf.animations);
      if (movementGltf.animations?.length) clips.push(...movementGltf.animations);
    }
    return clips;
  }, [charGltf.animations, generalGltf.animations, movementGltf.animations, archetypeId]);

  const { actions, mixer } = useAnimations(allClips, groupRef);

  // Aktive Animation triggern + alte ausblenden.
  useEffect(() => {
    if (!actions || Object.keys(actions).length === 0) return;
    const candidates = ANIM_NAME_MAP[animation] || [];
    let activeName: string | null = null;
    for (const name of candidates) {
      if (actions[name]) { activeName = name; break; }
    }
    // Fallback (für Wächter ohne Lorekeeper-Pack): suche IRGENDEIN idle-artiges
    // Clip per Name-Match. Vermeide Rotate/Spin/Turn-Clips die den Char drehen.
    if (!activeName && animation === "idle") {
      const all = Object.keys(actions);
      const idleLike = all.find((n) => /idle|wait|stand/i.test(n) && !/turn|spin|rotate/i.test(n));
      if (idleLike) activeName = idleLike;
    }
    if (!activeName) return; // wirklich keins gefunden → static T-pose

    const action = actions[activeName];
    if (!action) return;
    action.reset().fadeIn(0.2).play();
    return () => { action.fadeOut(0.2); };
  }, [animation, actions]);

  // Idle-Mode: gelegentlich Greet einstreuen — NUR für Lorekeeper, weil dessen
  // Anim-Pack bekannt ist. Andere Wächter haben evtl. Clips mit Y-Translation
  // (Jump etc.), die den Charakter aus dem Frame heben würden.
  useEffect(() => {
    if (animation !== "idle") return;
    if (!actions || Object.keys(actions).length === 0) return;

    // Idle-Action ermitteln (Lorekeeper-Pack-Namen ODER Regex-Fallback).
    const idleAction = (() => {
      for (const n of ANIM_NAME_MAP.idle) if (actions[n]) return actions[n];
      const all = Object.keys(actions);
      const idleLike = all.find((n) => /idle|wait|stand/i.test(n) && !/turn|spin|rotate/i.test(n));
      return idleLike ? actions[idleLike] : null;
    })();
    if (!idleAction) return;

    // Greet-Pool: Clips die ARM/HAND-Geste machen, KEIN Y-Translation,
    // kein Death/Hit/Jump/Movement. Funktioniert für ALLE Archetypes.
    const allNames = Object.keys(actions);
    const candidates = allNames.filter((n) => {
      if (/jump|death|die|fall|hit|spawn|attack|throw|run|walk|spin|turn|rotate|idle/i.test(n)) return false;
      const a = actions[n];
      if (!a) return false;
      // Y-Translation in Position-Tracks erkennen → ausschließen.
      const clip = a.getClip();
      for (const track of clip.tracks) {
        if (!track.name.endsWith(".position")) continue;
        const v = track.values;
        let minY = Infinity, maxY = -Infinity;
        for (let i = 1; i < v.length; i += 3) {
          if (v[i] < minY) minY = v[i];
          if (v[i] > maxY) maxY = v[i];
        }
        if (maxY - minY > 0.3) return false;
      }
      return true;
    });
    // Bevorzugt explizite Wave/Greet-Clips, sonst Interact/PickUp.
    const preferred = candidates.filter((n) => /wave|hi|greet|hello|cheer|yes/i.test(n));
    const greetPool = preferred.length > 0 ? preferred : candidates;
    if (greetPool.length === 0) return;

    let mounted = true;
    const schedule = () => {
      if (!mounted) return;
      const delay = 6000 + Math.random() * 6000;
      window.setTimeout(() => {
        if (!mounted) return;
        const pick = greetPool[Math.floor(Math.random() * greetPool.length)];
        const greet = actions[pick];
        if (!greet) { schedule(); return; }
        idleAction.fadeOut(0.3);
        greet.reset().setLoop(THREE.LoopOnce, 1).clampWhenFinished = true;
        greet.fadeIn(0.3).play();
        const dur = (greet.getClip().duration || 1.5) * 1000 + 600;
        window.setTimeout(() => {
          if (!mounted) return;
          greet.fadeOut(0.3);
          idleAction.reset().fadeIn(0.3).play();
          schedule();
        }, dur);
      }, delay);
    };
    schedule();
    return () => { mounted = false; };
  }, [animation, actions]);

  // Mixer pro Frame updaten
  useFrame((_, dt) => mixer?.update(dt));

  // Keine Auto-Rotation mehr — Wächter steht still im Banner.

  if (!sceneClone) return null;
  return (
    <group ref={groupRef} dispose={null} position={[0, -0.7, 0]} scale={0.7}>
      <primitive object={sceneClone} />
    </group>
  );
}

// Pre-loading damit der erste Open-Klick nicht laggt
useGLTF.preload("/3d/waechter/lorekeeper.glb");
useGLTF.preload(LOREKEEPER_ANIMS.general);
useGLTF.preload(LOREKEEPER_ANIMS.movement);

export function Waechter3D({
  archetypeId,
  animation = "idle",
  height = 280,
  background = "transparent",
  enableControls = false,
  thumbnail = false,
}: {
  archetypeId?: string | null;
  animation?: Animation;
  height?: number | string;
  background?: string;
  enableControls?: boolean;
  /** Thumb-Mode: kein Light, kein Shadow, frameloop demand → günstig für Picker-Tiles */
  thumbnail?: boolean;
}) {
  return (
    <div style={{ width: "100%", height, position: "relative" }}>
      <Canvas
        shadows={!thumbnail}
        camera={{ position: [0, 0.2, 5], fov: 38 }}
        style={{ background }}
        dpr={thumbnail ? [1, 1] : [1, 1.5]}
        frameloop={thumbnail ? "demand" : "always"}
      >
        <ambientLight intensity={0.55} />
        <directionalLight
          castShadow
          position={[3, 5, 4]}
          intensity={1.6}
          shadow-mapSize-width={1024}
          shadow-mapSize-height={1024}
        />
        <directionalLight position={[-3, 2, -2]} intensity={0.5} color="#FFD27A" />
        <Suspense fallback={null}>
          <Environment preset="sunset" />
          <CharacterModel animation={animation} archetypeId={archetypeId} />
          <ContactShadows
            position={[0, -0.72, 0]}
            opacity={0.45}
            scale={3.5}
            blur={2.4}
            far={2}
          />
        </Suspense>
        {enableControls && <OrbitControls enablePan={false} enableZoom={false} />}
      </Canvas>
    </div>
  );
}
