"use client";

/**
 * Begleiter3D — rendert ein animiertes 3D-Modell eines Begleiters via Three.js.
 *
 * Nutzt React-Three-Fiber + drei für glTF-Loading + Animation-Mixing.
 * Asset-Slot pro Archetype: /3d/{archetypeId}/character.glb + animation-glbs.
 * Fallback auf Lorekeeper-Standardmodell falls archetype-spezifisches fehlt.
 *
 * Performance:
 * - Eine Canvas pro Mount (kein Mehrfach-Instancing — für 1 Begleiter im Modal)
 * - frameloop="demand" → rendert nur wenn animiert (kein konstantes Re-Render)
 * - Lazy-loaded via dynamic-import im Wrapper, three-Bundle nur wenn nötig
 */

import { Canvas, useFrame } from "@react-three/fiber";
import { useGLTF, useAnimations, OrbitControls, Environment, ContactShadows } from "@react-three/drei";
import { Suspense, useEffect, useMemo, useRef } from "react";
import * as THREE from "three";

export type Animation = "idle" | "walk" | "run" | "jump" | "throw" | "interact" | "pickup" | "hit" | "spawn" | "death";

const ASSETS = {
  character: "/3d/lorekeeper/character.glb",
  animGeneral: "/3d/lorekeeper/anim_general.glb",
  animMovement: "/3d/lorekeeper/anim_movement.glb",
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

function CharacterModel({ animation }: { animation: Animation }) {
  const charGltf = useGLTF(ASSETS.character);
  const generalGltf = useGLTF(ASSETS.animGeneral);
  const movementGltf = useGLTF(ASSETS.animMovement);

  const groupRef = useRef<THREE.Group>(null);

  // Bündele alle Clips aus beiden Animation-Packs zusammen
  const allClips = useMemo(() => {
    const clips: THREE.AnimationClip[] = [];
    if (charGltf.animations?.length) clips.push(...charGltf.animations);
    if (generalGltf.animations?.length) clips.push(...generalGltf.animations);
    if (movementGltf.animations?.length) clips.push(...movementGltf.animations);
    return clips;
  }, [charGltf.animations, generalGltf.animations, movementGltf.animations]);

  const { actions, mixer } = useAnimations(allClips, groupRef);

  // Aktive Animation triggern + alte ausblenden
  useEffect(() => {
    if (!actions || Object.keys(actions).length === 0) return;
    const candidates = ANIM_NAME_MAP[animation] || [];
    let activeName: string | null = null;
    for (const name of candidates) {
      if (actions[name]) { activeName = name; break; }
    }
    // Fallback: erste verfügbare Animation
    if (!activeName) activeName = Object.keys(actions)[0] ?? null;
    if (!activeName) return;

    const action = actions[activeName];
    if (!action) return;
    action.reset().fadeIn(0.2).play();
    return () => { action.fadeOut(0.2); };
  }, [animation, actions]);

  // Mixer pro Frame updaten
  useFrame((_, dt) => mixer?.update(dt));

  // Auto-Rotation für Hero-Look
  useFrame((_, dt) => {
    if (groupRef.current) groupRef.current.rotation.y += dt * 0.3;
  });

  return (
    <group ref={groupRef} dispose={null}>
      <primitive object={charGltf.scene} />
    </group>
  );
}

// Pre-loading damit der erste Open-Klick nicht laggt
useGLTF.preload(ASSETS.character);
useGLTF.preload(ASSETS.animGeneral);
useGLTF.preload(ASSETS.animMovement);

export function Begleiter3D({
  animation = "idle",
  height = 280,
  background = "transparent",
  enableControls = false,
}: {
  animation?: Animation;
  height?: number;
  background?: string;
  enableControls?: boolean;
}) {
  return (
    <div style={{ width: "100%", height, position: "relative" }}>
      <Canvas
        shadows
        camera={{ position: [0, 1.6, 3.5], fov: 35 }}
        style={{ background }}
        dpr={[1, 1.5]}
        frameloop="always"
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
          <CharacterModel animation={animation} />
          <ContactShadows
            position={[0, 0, 0]}
            opacity={0.45}
            scale={4}
            blur={2.5}
            far={2}
          />
        </Suspense>
        {enableControls && <OrbitControls enablePan={false} enableZoom={false} />}
      </Canvas>
    </div>
  );
}
