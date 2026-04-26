"use client";

/**
 * Iso-Buildings — geladen aus dem Artyom Isometric Medieval Pack (CC0).
 *
 * Pack-Quelle: https://artyom-zagorskiy.itch.io/isometric-medieval-pack
 * Pack liegt in: /public/iso/medieval/pack/Sprites/...
 *
 * Mapping pro Building → konkrete Sprite-Files (mit Level-Variation):
 *   Towers haben 9 Aufbau-Stufen (z.B. castle_tower_blue(1).png … (9).png)
 *   Buildings (mill, blacksmith, house) haben 2-4 Varianten je Farbe
 *
 * Wir spiegeln Wächter-Level (1-10) auf Pack-Variant (1-9) für Towers,
 * und auf 1-4 für Houses/Mills/Blacksmiths.
 */

import Image from "next/image";

type BuildingProps = {
  level: number;
  status?: "idle" | "building" | "upgrading";
  highlighted?: boolean;
};

const BASE = "/iso/medieval/pack/Sprites";

/** Map level (1-10) → tower variant (1-9). Höheres Level = größerer Turm. */
function towerVariant(level: number): number {
  return Math.min(9, Math.max(1, Math.ceil(level * 0.9)));
}
/** Map level (1-10) → house/mill variant (1-4). */
function houseVariant(level: number): number {
  return Math.min(4, Math.max(1, Math.ceil(level / 2.5)));
}

function BuildingFrame({
  src,
  alt,
  status,
  highlighted,
  level,
  glow,
}: {
  src: string;
  alt: string;
  status?: BuildingProps["status"];
  highlighted?: boolean;
  level: number;
  glow: string;
}) {
  return (
    <div style={{
      position: "relative", width: "100%", height: "100%",
      display: "flex", alignItems: "flex-end", justifyContent: "center",
      pointerEvents: "auto",
    }}>
      {/* Soft glow under building */}
      <div style={{
        position: "absolute", bottom: 30, left: "50%", transform: "translateX(-50%)",
        width: 140, height: 24, borderRadius: "50%",
        background: `radial-gradient(ellipse, ${glow}66 0%, transparent 70%)`,
        filter: "blur(4px)",
        opacity: highlighted ? 0.9 : 0.55,
        transition: "opacity 0.2s",
      }} />
      {/* Building image */}
      <div style={{
        position: "relative",
        width: "85%", height: "85%",
        filter: highlighted ? `drop-shadow(0 0 12px ${glow})` : "drop-shadow(0 4px 6px rgba(0,0,0,0.4))",
        transition: "filter 0.2s",
      }}>
        <Image
          src={src}
          alt={alt}
          fill
          unoptimized
          style={{ objectFit: "contain", objectPosition: "bottom center" }}
        />
      </div>
      {/* Status badge */}
      {status && status !== "idle" && (
        <div style={{
          position: "absolute", top: 4, right: 4,
          padding: "3px 7px", borderRadius: 999,
          background: "#FF6B4A", color: "#fff", fontSize: 11, fontWeight: 900,
          animation: "pulse 1s infinite",
          boxShadow: "0 2px 6px rgba(0,0,0,0.4)",
        }}>
          {status === "building" ? "🔨" : "⬆️"}
        </div>
      )}
      {/* Level Badge */}
      <div style={{
        position: "absolute", bottom: 4, left: "50%", transform: "translateX(-50%)",
        padding: "2px 9px", borderRadius: 999,
        background: "#0F1115EE", border: "1.5px solid " + glow,
        color: glow, fontSize: 10, fontWeight: 900,
        boxShadow: "0 1px 3px rgba(0,0,0,0.4)",
        whiteSpace: "nowrap",
      }}>
        Lv {level}
      </div>
      <style>{`@keyframes pulse { 0%,100%{transform:scale(1)} 50%{transform:scale(1.15)} }`}</style>
    </div>
  );
}

// ═══ SOLO BUILDINGS ═══════════════════════════════════════════════════

export function IsoWegekasse(p: BuildingProps) {
  // Schatzkammer = blauer Turm (hoch + offiziell)
  const v = towerVariant(p.level);
  return <BuildingFrame {...p} src={`${BASE}/Towers/Blue%20towers/castle_tower_blue(${v}).png`} alt="Wegekasse" glow="#FFD700" />;
}

export function IsoWaldPfad(p: BuildingProps) {
  // Wald-Pfad = grüne Mühle (steht für Verarbeitung von Holz)
  const v = houseVariant(p.level);
  return <BuildingFrame {...p} src={`${BASE}/Buildings/mill/mill(${v}).png`} alt="Wald-Pfad" glow="#4ade80" />;
}

export function IsoWaechterHalle(p: BuildingProps) {
  // Wächter-Halle = roter Turm (Krieg/Magie)
  const v = towerVariant(p.level);
  return <BuildingFrame {...p} src={`${BASE}/Towers/Red%20tower/castle_tower_red(${v}).png`} alt="Wächter-Halle" glow="#a855f7" />;
}

export function IsoLaufturm(p: BuildingProps) {
  // Lauftürme = grüner Turm (Späher)
  const v = towerVariant(p.level);
  return <BuildingFrame {...p} src={`${BASE}/Towers/Green%20towers/castle_tower_green(${v}).png`} alt="Lauftürme" glow="#FFD700" />;
}

export function IsoLagerhalle(p: BuildingProps) {
  // Lagerhalle = blaues Schmiede-Gebäude (eckig wie Lager)
  const v = Math.min(2, Math.max(1, Math.ceil(p.level / 5)));
  return <BuildingFrame {...p} src={`${BASE}/Buildings/blacksmith_blue(${v}).png`} alt="Lagerhalle" glow="#a16f32" />;
}

export function IsoSchmiede(p: BuildingProps) {
  // Schmiede = rotes Schmiede-Gebäude
  const v = Math.min(2, Math.max(1, Math.ceil(p.level / 5)));
  return <BuildingFrame {...p} src={`${BASE}/Buildings/blacksmith_red(${v}).png`} alt="Schmiede" glow="#FF6B4A" />;
}

export function IsoGasthaus(p: BuildingProps) {
  // Gasthaus = Wood-Wood-House (klassische Tavern-Optik)
  const v = houseVariant(p.level);
  return <BuildingFrame {...p} src={`${BASE}/Buildings/house/Wood%20houses/Wood%20house/wood_house(${v}).png`} alt="Gasthaus" glow="#FFD700" />;
}

export function IsoWachturm(p: BuildingProps) {
  // Wachturm = Holzturm (urig)
  const v = towerVariant(p.level);
  return <BuildingFrame {...p} src={`${BASE}/Towers/Wood%20towers/castle_tower_wood(${v}).png`} alt="Wachturm" glow="#FF2D78" />;
}

// ═══ CREW BUILDINGS ════════════════════════════════════════════════════

export function IsoCrewTreffpunkt(p: BuildingProps) {
  // Crew-Treffpunkt = großer roter Turm
  const v = Math.min(9, Math.max(5, towerVariant(p.level)));
  return <BuildingFrame {...p} src={`${BASE}/Towers/Red%20tower/castle_tower_red(${v}).png`} alt="Crew-Treffpunkt" glow="#22D1C3" />;
}

export function IsoTruhenkammer(p: BuildingProps) {
  // Truhenkammer = blauer großer Turm
  const v = Math.min(9, Math.max(5, towerVariant(p.level)));
  return <BuildingFrame {...p} src={`${BASE}/Towers/Blue%20towers/castle_tower_blue(${v}).png`} alt="Truhenkammer" glow="#FFD700" />;
}

export function IsoArenaHalle(p: BuildingProps) {
  // Arena = grüner Turm groß
  const v = Math.min(9, Math.max(5, towerVariant(p.level)));
  return <BuildingFrame {...p} src={`${BASE}/Towers/Green%20towers/castle_tower_green(${v}).png`} alt="Arena-Halle" glow="#FF6B4A" />;
}

export function IsoManaQuell(p: BuildingProps) {
  // Mana-Quell = blaue Mühle (Wasser-Theme)
  const v = houseVariant(p.level);
  return <BuildingFrame {...p} src={`${BASE}/Buildings/mill/mill(${v}).png`} alt="Mana-Quell" glow="#22D1C3" />;
}

// ═══ EMPTY SLOT ════════════════════════════════════════════════════════
export function IsoEmptySlot() {
  return (
    <div style={{
      width: "100%", height: "100%",
      display: "flex", alignItems: "center", justifyContent: "center",
      cursor: "pointer",
    }}>
      <div style={{
        width: 100, height: 60,
        display: "flex", alignItems: "center", justifyContent: "center",
        border: "2px dashed #22D1C3aa",
        borderRadius: 8,
        background: "#22D1C311",
        color: "#22D1C3",
        fontSize: 26, fontWeight: 900,
        animation: "blink 2s infinite",
      }}>+</div>
      <style>{`@keyframes blink { 0%,100%{opacity:0.5} 50%{opacity:1} }`}</style>
    </div>
  );
}

// ─── Map: building_id → Component ──────────────────────────────────────
export const ISO_BUILDINGS: Record<string, React.ComponentType<BuildingProps>> = {
  wegekasse:        IsoWegekasse,
  wald_pfad:        IsoWaldPfad,
  waechter_halle:   IsoWaechterHalle,
  laufturm:         IsoLaufturm,
  lagerhalle:       IsoLagerhalle,
  schmiede:         IsoSchmiede,
  gasthaus:         IsoGasthaus,
  wachturm:         IsoWachturm,
  crew_treffpunkt:  IsoCrewTreffpunkt,
  truhenkammer:     IsoTruhenkammer,
  arena_halle:      IsoArenaHalle,
  mana_quell:       IsoManaQuell,
};
