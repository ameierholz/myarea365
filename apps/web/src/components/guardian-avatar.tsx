"use client";

import { useState } from "react";
import { RARITY_META, type GuardianArchetype, type GuardianRarity } from "@/lib/guardian";

// Archetypen fuer die AI-Portraits existieren. Hier eintragen wenn neue Bilder
// nach apps/web/public/guardians/<id>_idle.png / <id>_attack.png gelegt werden.
// Leer lassen → automatisches Fallback auf prozeduralen SVG-Avatar.
const ARTWORK_AVAILABLE = new Set<string>([
  // "stadtfuchs", "dachs", "nachteule", ... — hier eintragen sobald PNGs in /public/guardians/ liegen
]);

export type AvatarAnimation = "idle" | "attack" | "hit" | "crit" | "evade" | "special" | "ko" | "revive";

/**
 * Procedural humanoid SVG-Avatar. Jeder Archetyp bekommt einzigartige
 * Kombination aus Kopfteil, Rumpf, Waffe und Effekt-Aura.
 * Rarity bestimmt Farbpalette und Glow-Intensitaet.
 */
export function GuardianAvatar({ archetype, size = 140, animation = "idle", facing = "right" }: {
  archetype: Pick<GuardianArchetype, "id" | "emoji" | "rarity">;
  size?: number;
  animation?: AvatarAnimation;
  facing?: "left" | "right";
}) {
  const rarity = RARITY_META[archetype.rarity];
  const palette = paletteFor(archetype.rarity);
  const A = ARCHETYPE_LOOK[archetype.id] ?? FALLBACK_LOOK;

  const flip = facing === "left" ? "scaleX(-1)" : "";
  const animClass = `anim-${animation}`;

  // Wenn AI-Portraits existieren → PNG rendern, sonst SVG-Fallback.
  const usePortrait = ARTWORK_AVAILABLE.has(archetype.id);
  const variant = animation === "attack" || animation === "crit" ? "attack" : "idle";
  const portraitSrc = `/guardians/${archetype.id}_${variant}.png`;
  const [portraitFailed, setPortraitFailed] = useState(false);

  if (usePortrait && !portraitFailed) {
    return (
      <div
        className={animClass}
        style={{
          width: size,
          height: size * 1.25,
          position: "relative",
          filter: `drop-shadow(0 6px 14px ${rarity.glow})`,
        }}
      >
        <div style={{
          position: "absolute", bottom: 2, left: "50%", transform: "translateX(-50%)",
          width: size * 0.55, height: 8, borderRadius: "50%",
          background: "radial-gradient(ellipse, rgba(0,0,0,0.5), transparent 70%)",
        }} />
        <div style={{
          position: "absolute", inset: 0,
          background: `radial-gradient(circle at 50% 45%, ${rarity.glow}, transparent 60%)`,
          opacity: 0.85,
        }} className="aura-ring" />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={portraitSrc}
          alt={archetype.id}
          onError={() => setPortraitFailed(true)}
          style={{
            position: "relative",
            width: "100%", height: "100%",
            objectFit: "contain",
            transform: flip,
            filter: animation === "ko" ? "grayscale(0.7) brightness(0.6)" : "none",
          }}
        />
        <style jsx>{`
          .anim-idle img    { animation: breathe 3s ease-in-out infinite; }
          .anim-attack img  { animation: lunge 0.45s cubic-bezier(0.3, 0.8, 0.3, 1); }
          .anim-hit img     { animation: hit-shake 0.35s; }
          .anim-crit img    { animation: crit-zoom 0.55s cubic-bezier(0.4, 1.7, 0.5, 0.95); }
          .anim-evade img   { animation: evade-slide 0.4s ease-out; }
          .anim-special img { animation: special-rise 0.7s cubic-bezier(0.3, 0.8, 0.4, 1.2); }
          .anim-ko img      { animation: ko-fall 0.9s forwards; }
          .anim-revive img  { animation: revive-rise 0.9s cubic-bezier(0.3, 1.5, 0.5, 1) forwards; }
          .aura-ring        { animation: aura-pulse 2.6s ease-in-out infinite; }
          @keyframes breathe      { 0%,100% { transform: translateY(0) scaleY(1); } 50% { transform: translateY(-2px) scaleY(1.01); } }
          @keyframes lunge        { 0%,100% { transform: translateX(0); } 40% { transform: translateX(28px) rotate(-4deg); } 60% { transform: translateX(20px); } }
          @keyframes hit-shake    { 0% { transform: translateX(0); filter: none; } 20% { transform: translateX(-6px); filter: brightness(0.6) saturate(3) hue-rotate(-30deg); } 40% { transform: translateX(6px); } 60% { transform: translateX(-4px); } 100% { transform: translateX(0); filter: none; } }
          @keyframes crit-zoom    { 0%,100% { transform: scale(1); } 40% { transform: scale(1.22); filter: brightness(1.7) drop-shadow(0 0 25px #FFD700); } }
          @keyframes evade-slide  { 0% { transform: translateX(0); opacity: 1; } 40% { transform: translateX(-22px) scaleX(0.85); opacity: 0.5; } 100% { transform: translateX(0); opacity: 1; } }
          @keyframes special-rise { 0% { transform: translateY(0) scale(1); } 45% { transform: translateY(-12px) scale(1.1); filter: drop-shadow(0 0 30px currentColor); } 100% { transform: translateY(0) scale(1); } }
          @keyframes ko-fall      { 0% { transform: rotate(0) translateY(0); opacity: 1; } 60% { transform: rotate(85deg) translateY(20px); opacity: 0.9; } 100% { transform: rotate(95deg) translateY(25px); opacity: 0.35; } }
          @keyframes revive-rise  { 0% { transform: rotate(95deg) translateY(25px); opacity: 0.35; filter: saturate(0); } 100% { transform: rotate(0) translateY(0); opacity: 1; filter: saturate(1) drop-shadow(0 0 20px #FFD700); } }
          @keyframes aura-pulse   { 0%,100% { opacity: 0.55; transform: scale(1); } 50% { opacity: 0.9; transform: scale(1.12); } }
        `}</style>
      </div>
    );
  }

  return (
    <div
      className={animClass}
      style={{
        width: size,
        height: size * 1.25,
        position: "relative",
        filter: `drop-shadow(0 6px 14px ${rarity.glow})`,
      }}
    >
      {/* Ground shadow */}
      <div style={{
        position: "absolute", bottom: 2, left: "50%", transform: "translateX(-50%)",
        width: size * 0.55, height: 8, borderRadius: "50%",
        background: "radial-gradient(ellipse, rgba(0,0,0,0.5), transparent 70%)",
      }} />

      {/* Aura */}
      <div style={{
        position: "absolute", inset: 0,
        background: `radial-gradient(circle at 50% 45%, ${rarity.glow}, transparent 60%)`,
        opacity: 0.85,
      }} className="aura-ring" />

      {/* Figur */}
      <svg
        viewBox="0 0 100 125"
        width={size}
        height={size * 1.25}
        style={{ position: "relative", transform: flip, transformOrigin: "center" }}
      >
        {/* Beine */}
        <rect x={38} y={85}  width={10} height={22} fill={palette.leg}    rx={2} />
        <rect x={52} y={85}  width={10} height={22} fill={palette.leg}    rx={2} />
        {/* Stiefel */}
        <rect x={36} y={105} width={14} height={6}  fill={palette.boot}   rx={2} />
        <rect x={50} y={105} width={14} height={6}  fill={palette.boot}   rx={2} />

        {/* Gürtel */}
        <rect x={33} y={80} width={34} height={6} fill={palette.belt} rx={1} />

        {/* Rumpf / Rüstung */}
        <path d={`M 35 50 Q 30 54, 30 60 L 30 82 L 70 82 L 70 60 Q 70 54, 65 50 Z`} fill={palette.armor} />
        <path d={`M 35 50 Q 30 54, 30 60 L 30 65 L 70 65 L 70 60 Q 70 54, 65 50 Z`} fill={palette.armorTrim} opacity={0.6} />
        {A.chestEmblem && <text x={50} y={72} textAnchor="middle" fontSize={10} fill={palette.emblem}>{A.chestEmblem}</text>}

        {/* Arme */}
        <rect x={22} y={52} width={10} height={26} fill={palette.arm} rx={3} transform={A.leftArmRotate ? `rotate(${A.leftArmRotate} 27 55)` : undefined} />
        <rect x={68} y={52} width={10} height={26} fill={palette.arm} rx={3} transform={A.rightArmRotate ? `rotate(${A.rightArmRotate} 73 55)` : undefined} />

        {/* Kopf */}
        <circle cx={50} cy={36} r={12} fill={palette.skin} />
        {/* Kopfbedeckung */}
        {renderHeadgear(A.head, palette)}

        {/* Gesicht (stilisiert) */}
        <circle cx={46} cy={36} r={1.4} fill="#0F1115" />
        <circle cx={54} cy={36} r={1.4} fill="#0F1115" />
        <path d={`M 46 41 Q 50 43, 54 41`} stroke="#0F1115" strokeWidth={0.8} fill="none" strokeLinecap="round" />

        {/* Waffe (bei right hand) */}
        <g className="weapon-arm">
          {renderWeapon(A.weapon, palette)}
        </g>

        {/* Off-hand / Schild */}
        {A.offhand && (
          <g>{renderOffhand(A.offhand, palette)}</g>
        )}

        {/* Spezial-Effekt */}
        {animation === "special" && A.specialEffect && renderSpecialEffect(A.specialEffect, palette)}
        {animation === "crit" && (
          <g className="crit-burst">
            <circle cx={50} cy={60} r={45} fill="none" stroke="#FFD700" strokeWidth={2} opacity={0.9} />
            <circle cx={50} cy={60} r={35} fill="none" stroke="#FFD700" strokeWidth={1.5} opacity={0.7} />
          </g>
        )}
      </svg>

      <style jsx>{`
        .anim-idle svg     { animation: breathe 3s ease-in-out infinite; }
        .anim-attack svg   { animation: lunge 0.45s cubic-bezier(0.3, 0.8, 0.3, 1); }
        .anim-hit svg      { animation: hit-shake 0.35s; }
        .anim-crit svg     { animation: crit-zoom 0.55s cubic-bezier(0.4, 1.7, 0.5, 0.95); }
        .anim-evade svg    { animation: evade-slide 0.4s ease-out; }
        .anim-special svg  { animation: special-rise 0.7s cubic-bezier(0.3, 0.8, 0.4, 1.2); }
        .anim-ko svg       { animation: ko-fall 0.9s forwards; }
        .anim-revive svg   { animation: revive-rise 0.9s cubic-bezier(0.3, 1.5, 0.5, 1) forwards; }
        .aura-ring         { animation: aura-pulse 2.6s ease-in-out infinite; }
        .crit-burst        { animation: crit-ring-expand 0.55s ease-out; }

        @keyframes breathe       { 0%,100% { transform: translateY(0) scaleY(1); } 50% { transform: translateY(-2px) scaleY(1.01); } }
        @keyframes lunge         { 0%,100% { transform: translateX(0); } 40% { transform: translateX(28px) rotate(-4deg); } 60% { transform: translateX(20px); } }
        @keyframes hit-shake     { 0% { transform: translateX(0); filter: none; } 20% { transform: translateX(-6px); filter: brightness(0.6) saturate(3) hue-rotate(-30deg); } 40% { transform: translateX(6px); } 60% { transform: translateX(-4px); } 100% { transform: translateX(0); filter: none; } }
        @keyframes crit-zoom     { 0%,100% { transform: scale(1); } 40% { transform: scale(1.22); filter: brightness(1.7) drop-shadow(0 0 25px #FFD700); } }
        @keyframes evade-slide   { 0% { transform: translateX(0); opacity: 1; } 40% { transform: translateX(-22px) scaleX(0.85); opacity: 0.5; } 100% { transform: translateX(0); opacity: 1; } }
        @keyframes special-rise  { 0% { transform: translateY(0) scale(1); filter: none; } 45% { transform: translateY(-12px) scale(1.1); filter: drop-shadow(0 0 30px currentColor); } 100% { transform: translateY(0) scale(1); } }
        @keyframes ko-fall       { 0% { transform: rotate(0) translateY(0); opacity: 1; } 60% { transform: rotate(85deg) translateY(20px); opacity: 0.9; } 100% { transform: rotate(95deg) translateY(25px); opacity: 0.35; } }
        @keyframes revive-rise   { 0% { transform: rotate(95deg) translateY(25px); opacity: 0.35; filter: saturate(0); } 100% { transform: rotate(0) translateY(0); opacity: 1; filter: saturate(1) drop-shadow(0 0 20px #FFD700); } }
        @keyframes aura-pulse    { 0%,100% { opacity: 0.55; transform: scale(1); } 50% { opacity: 0.9; transform: scale(1.12); } }
        @keyframes crit-ring-expand { 0% { transform-origin: 50px 60px; transform: scale(0.2); opacity: 1; } 100% { transform-origin: 50px 60px; transform: scale(1.4); opacity: 0; } }
      `}</style>
    </div>
  );
}

// ── Palettes per Rarity ───────────────────────────────────

function paletteFor(rarity: GuardianRarity) {
  if (rarity === "legend") return {
    skin: "#F4C9A0", leg: "#1A1D23", boot: "#0F1115", belt: "#7a5b1f",
    armor: "#3D2B6B", armorTrim: "#FFD700", arm: "#4a3178", emblem: "#FFD700",
  };
  if (rarity === "epic") return {
    skin: "#EAB58A", leg: "#1F2430", boot: "#0F1115", belt: "#4a2a5c",
    armor: "#5C2B6B", armorTrim: "#a855f7", arm: "#6a3680", emblem: "#E5D4F7",
  };
  if (rarity === "rare") return {
    skin: "#E6B087", leg: "#1F2430", boot: "#0F1115", belt: "#1a5a55",
    armor: "#1F6B5C", armorTrim: "#22D1C3", arm: "#277a6b", emblem: "#B8F2E6",
  };
  return {
    skin: "#D4A373", leg: "#2A2F3A", boot: "#0F1115", belt: "#4a4a52",
    armor: "#3F4654", armorTrim: "#8B8FA3", arm: "#525a6b", emblem: "#D4D8E0",
  };
}

// ── Look-Definitionen pro Archetyp ────────────────────────

type Head = "hood" | "helm" | "horned_helm" | "wizard_hat" | "priest_halo" | "bandana" | "beret" | "cap" | "warcrown" | "cowl" | "bare";
type Weapon = "sword" | "axe" | "dagger" | "staff" | "bow" | "spear" | "tome" | "hammer" | "fan" | "flail" | "none";
type Offhand = "shield" | "dagger" | "torch" | "none";
type SpecialFx = "fire" | "lightning" | "shadow" | "heal" | "none";

type Look = {
  head: Head;
  weapon: Weapon;
  offhand?: Offhand;
  chestEmblem?: string;
  specialEffect?: SpecialFx;
  leftArmRotate?: number;
  rightArmRotate?: number;
};

const FALLBACK_LOOK: Look = { head: "bare", weapon: "sword" };

const ARCHETYPE_LOOK: Record<string, Look> = {
  stadtfuchs:   { head: "hood",        weapon: "dagger",  offhand: "dagger",               specialEffect: "shadow" },
  dachs:        { head: "helm",        weapon: "hammer",  offhand: "shield" },
  taube:        { head: "beret",       weapon: "fan" },
  spatz:        { head: "cap",         weapon: "dagger" },
  strassenhund: { head: "bandana",     weapon: "sword" },
  ratte:        { head: "cowl",        weapon: "flail",   specialEffect: "heal" },
  nachteule:    { head: "wizard_hat",  weapon: "staff",                                    specialEffect: "lightning", chestEmblem: "★" },
  waschbaer:    { head: "bandana",     weapon: "dagger",  offhand: "dagger" },
  stadtkatze:   { head: "bare",        weapon: "none" },
  eule:         { head: "beret",       weapon: "tome" },
  fledermaus:   { head: "cowl",        weapon: "dagger",                                  specialEffect: "shadow" },
  moewe:        { head: "hood",        weapon: "dagger" },
  rudelalpha:   { head: "warcrown",    weapon: "spear",   offhand: "shield",              chestEmblem: "✦" },
  eber:         { head: "horned_helm", weapon: "hammer",  offhand: "shield",              chestEmblem: "⛨" },
  wolf:         { head: "cowl",        weapon: "dagger",  offhand: "dagger",              specialEffect: "shadow" },
  baer:         { head: "horned_helm", weapon: "axe",                                     specialEffect: "fire" },
  falke:        { head: "warcrown",    weapon: "sword",                                   chestEmblem: "✧" },
  drache:       { head: "wizard_hat",  weapon: "staff",                                   specialEffect: "fire", chestEmblem: "🔥" },
  phoenix:      { head: "priest_halo", weapon: "staff",                                   specialEffect: "heal", chestEmblem: "✦" },
  wyvern:       { head: "helm",        weapon: "spear",                                   specialEffect: "lightning", chestEmblem: "⚡" },
};

// ── Render-Helpers ──────────────────────────────────────

function renderHeadgear(head: Head, p: ReturnType<typeof paletteFor>) {
  switch (head) {
    case "hood":
      return <path d="M 38 30 Q 50 14, 62 30 L 62 42 Q 50 46, 38 42 Z" fill={p.armor} />;
    case "helm":
      return (
        <g>
          <path d="M 36 30 Q 50 18, 64 30 L 64 38 L 36 38 Z" fill={p.armorTrim} />
          <rect x={44} y={32} width={12} height={3} fill="#0F1115" />
        </g>
      );
    case "horned_helm":
      return (
        <g>
          <path d="M 36 30 Q 50 18, 64 30 L 64 38 L 36 38 Z" fill={p.armorTrim} />
          <path d="M 32 30 Q 28 22, 32 18" stroke={p.boot} strokeWidth={2} fill="none" strokeLinecap="round" />
          <path d="M 68 30 Q 72 22, 68 18" stroke={p.boot} strokeWidth={2} fill="none" strokeLinecap="round" />
          <rect x={44} y={32} width={12} height={3} fill="#0F1115" />
        </g>
      );
    case "wizard_hat":
      return (
        <g>
          <path d="M 38 30 L 50 10 L 62 30 Z" fill={p.armor} />
          <path d="M 50 10 L 52 14 L 48 14 Z" fill={p.armorTrim} />
          <rect x={36} y={30} width={28} height={4} fill={p.armorTrim} rx={1} />
        </g>
      );
    case "priest_halo":
      return (
        <g>
          <ellipse cx={50} cy={24} rx={14} ry={3} fill="none" stroke="#FFD700" strokeWidth={1.5} opacity={0.9} />
        </g>
      );
    case "bandana":
      return <path d="M 38 32 Q 50 28, 62 32 L 62 36 Q 50 38, 38 36 Z" fill={p.armorTrim} />;
    case "beret":
      return <path d="M 38 30 Q 50 22, 62 30 Q 55 32, 50 32 Q 45 32, 38 30 Z" fill={p.armorTrim} />;
    case "cap":
      return <path d="M 40 30 L 50 26 L 60 30 L 60 33 L 40 33 Z" fill={p.armorTrim} />;
    case "warcrown":
      return (
        <g>
          <path d="M 38 30 L 38 24 L 42 28 L 46 22 L 50 28 L 54 22 L 58 28 L 62 24 L 62 30 Z" fill="#FFD700" />
          <rect x={38} y={30} width={24} height={2} fill="#FFD700" />
        </g>
      );
    case "cowl":
      return <path d="M 36 28 Q 50 12, 64 28 L 64 44 Q 50 48, 36 44 Z" fill="#0F1115" opacity={0.85} />;
    default:
      return null;
  }
}

function renderWeapon(weapon: Weapon, p: ReturnType<typeof paletteFor>) {
  switch (weapon) {
    case "sword":
      return (
        <g>
          <rect x={79} y={40} width={3} height={30} fill="#E8ECF2" />
          <rect x={76} y={68} width={9} height={3} fill={p.belt} />
          <rect x={80} y={70} width={1} height={6} fill={p.belt} />
        </g>
      );
    case "axe":
      return (
        <g>
          <rect x={80} y={48} width={2} height={28} fill="#6b4a1f" />
          <path d="M 77 48 L 89 42 L 89 55 L 77 54 Z" fill="#B0B7C3" />
          <path d="M 80 48 L 89 42 L 86 48 Z" fill="#8B909A" />
        </g>
      );
    case "dagger":
      return (
        <g>
          <rect x={80} y={54} width={2} height={14} fill="#E8ECF2" />
          <rect x={78} y={66} width={6} height={2} fill={p.belt} />
        </g>
      );
    case "staff":
      return (
        <g>
          <rect x={80.5} y={28} width={1.5} height={48} fill="#6b4a1f" />
          <circle cx={81} cy={28} r={4} fill={p.armorTrim} opacity={0.9} />
          <circle cx={81} cy={28} r={2} fill="#FFF" opacity={0.8} />
        </g>
      );
    case "bow":
      return (
        <g>
          <path d="M 80 42 Q 90 60, 80 78" stroke="#6b4a1f" strokeWidth={2} fill="none" />
          <line x1={81} y1={42} x2={81} y2={78} stroke="#E8ECF2" strokeWidth={0.6} />
        </g>
      );
    case "spear":
      return (
        <g>
          <rect x={80.5} y={32} width={1.5} height={44} fill="#6b4a1f" />
          <path d="M 79 32 L 82 26 L 85 32 Z" fill="#E8ECF2" />
        </g>
      );
    case "tome":
      return (
        <g>
          <rect x={75} y={58} width={12} height={14} fill={p.armor} rx={1} />
          <rect x={80} y={58} width={1} height={14} fill={p.armorTrim} />
          <rect x={78} y={62} width={6} height={1} fill="#FFF" opacity={0.5} />
          <rect x={78} y={65} width={6} height={1} fill="#FFF" opacity={0.5} />
        </g>
      );
    case "hammer":
      return (
        <g>
          <rect x={80} y={50} width={2} height={26} fill="#6b4a1f" />
          <rect x={75} y={46} width={12} height={8} fill="#B0B7C3" rx={1} />
          <rect x={75} y={46} width={12} height={2} fill="#8B909A" />
        </g>
      );
    case "fan":
      return (
        <g>
          <path d="M 80 56 Q 95 45, 92 70 Q 85 65, 80 56 Z" fill={p.armorTrim} opacity={0.85} />
          <path d="M 80 56 Q 88 60, 92 70" stroke="#FFF" strokeWidth={0.6} fill="none" opacity={0.4} />
        </g>
      );
    case "flail":
      return (
        <g>
          <rect x={80} y={50} width={2} height={20} fill="#6b4a1f" />
          <path d="M 81 50 Q 85 48, 88 42" stroke="#8B909A" strokeWidth={0.7} fill="none" />
          <circle cx={90} cy={40} r={4} fill="#6a6e78" />
          <circle cx={88} cy={38} r={1} fill="#0F1115" />
          <circle cx={92} cy={42} r={1} fill="#0F1115" />
        </g>
      );
    case "none":
    default:
      return null;
  }
}

function renderOffhand(off: Offhand, p: ReturnType<typeof paletteFor>) {
  switch (off) {
    case "shield":
      return (
        <g>
          <path d="M 15 55 Q 15 48, 22 48 Q 29 48, 29 55 L 29 72 Q 22 78, 15 72 Z" fill={p.armor} />
          <path d="M 15 55 Q 15 48, 22 48 Q 29 48, 29 55 L 29 60 L 15 60 Z" fill={p.armorTrim} opacity={0.7} />
          <circle cx={22} cy={63} r={3} fill={p.armorTrim} />
        </g>
      );
    case "dagger":
      return (
        <g>
          <rect x={18} y={54} width={2} height={14} fill="#E8ECF2" />
          <rect x={16} y={66} width={6} height={2} fill={p.belt} />
        </g>
      );
    case "torch":
      return (
        <g>
          <rect x={18.5} y={50} width={1.5} height={14} fill="#6b4a1f" />
          <path d="M 15 50 Q 19 40, 23 50 Q 22 44, 19 40 Q 16 44, 15 50 Z" fill="#FF6B4A" />
          <path d="M 16 48 Q 19 42, 22 48 Q 21 45, 19 42 Q 17 45, 16 48 Z" fill="#FFD700" />
        </g>
      );
    default:
      return null;
  }
}

function renderSpecialEffect(fx: SpecialFx, p: ReturnType<typeof paletteFor>) {
  if (fx === "fire") {
    return (
      <g opacity={0.9}>
        <path d="M 50 20 Q 55 10, 50 2 Q 45 10, 50 20" fill="#FF6B4A" />
        <path d="M 48 18 Q 52 12, 48 6  Q 44 12, 48 18" fill="#FFD700" />
      </g>
    );
  }
  if (fx === "lightning") {
    return (
      <g opacity={0.95}>
        <path d="M 60 18 L 72 10 L 66 22 L 78 16" stroke="#5ddaf0" strokeWidth={2} fill="none" strokeLinecap="round" />
        <path d="M 26 18 L 18 10 L 24 22 L 14 16" stroke="#5ddaf0" strokeWidth={2} fill="none" strokeLinecap="round" />
      </g>
    );
  }
  if (fx === "shadow") {
    return (
      <g opacity={0.7}>
        <ellipse cx={50} cy={65} rx={28} ry={14} fill="#0F1115" />
        <ellipse cx={50} cy={65} rx={22} ry={10} fill="#1A1D23" />
      </g>
    );
  }
  if (fx === "heal") {
    return (
      <g opacity={0.9}>
        <circle cx={50} cy={55} r={30} fill="none" stroke="#4ade80" strokeWidth={1.2} opacity={0.7} />
        <text x={50} y={15} textAnchor="middle" fontSize={14} fill="#4ade80">+</text>
        <text x={26} y={50} textAnchor="middle" fontSize={10} fill="#4ade80">+</text>
        <text x={74} y={50} textAnchor="middle" fontSize={10} fill="#4ade80">+</text>
      </g>
    );
  }
  void p;
  return null;
}
