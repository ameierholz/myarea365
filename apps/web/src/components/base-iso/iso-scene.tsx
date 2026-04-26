"use client";

/**
 * 2D-Iso-Scene — clean Hempire-Style.
 * Buildings sind inline SVGs (s. iso-buildings.tsx), später ersetzt durch Artyom-Pack.
 *
 * Layout: 3x3 Grid aus Iso-Tiles. Jedes Tile ist 200x120 (Iso-Diamond).
 * Buildings werden auf den Tiles platziert, Center kann frei bleiben (Lagerfeuer / Plaza).
 */

import { useState } from "react";
import { ISO_BUILDINGS, IsoEmptySlot } from "./iso-buildings";

export type IsoSceneBuilding = {
  building_id: string;
  level: number;
  position_x: number;  // 0,1,2
  position_y: number;  // 0,1,2
  status: "idle" | "building" | "upgrading";
};

export type IsoSceneSlot = {
  position_x: number;
  position_y: number;
  empty_for: string;
};

type Props = {
  buildings: IsoSceneBuilding[];
  emptySlots?: IsoSceneSlot[];
  onSlotTap?: (catalogId: string) => void;
  onBuildingTap?: (buildingId: string) => void;
  variant?: "solo" | "crew";
  height?: number;
};

const TILE_W = 180;     // Tile-Breite
const TILE_H = 100;     // Tile-Höhe (Diamond-Höhe)
const BUILDING_OFFSET_Y = -50;  // Building "ragt nach oben" über das Tile

/** Iso-Projection: Grid (gx, gy) → Pixel (px, py). Diamond-Layout. */
function isoToPx(gx: number, gy: number, originX: number, originY: number): { x: number; y: number } {
  const px = originX + (gx - gy) * TILE_W / 2;
  const py = originY + (gx + gy) * TILE_H / 2;
  return { x: px, y: py };
}

export function IsoScene({ buildings, emptySlots = [], onSlotTap, onBuildingTap, variant = "solo", height = 480 }: Props) {
  const accent = variant === "crew" ? "#22D1C3" : "#4ade80";
  const groundColor = variant === "crew" ? "#1a3a4d" : "#1a2a1a";
  const groundHighlight = variant === "crew" ? "#2a4a5d" : "#2a3a2a";

  const [hoveredId, setHoveredId] = useState<string | null>(null);

  // Render-Reihenfolge: Tiles zuerst, dann Buildings (von hinten nach vorne in Iso-Z)
  const allItems: Array<{ kind: "tile" | "building" | "empty"; gx: number; gy: number; data?: IsoSceneBuilding | IsoSceneSlot }> = [];
  // Alle 9 Bodentiles
  for (let gy = 0; gy < 3; gy++) for (let gx = 0; gx < 3; gx++) allItems.push({ kind: "tile", gx, gy });
  // Buildings + Empty-Slots
  for (const b of buildings)   allItems.push({ kind: "building", gx: b.position_x, gy: b.position_y, data: b });
  for (const s of emptySlots)  allItems.push({ kind: "empty",    gx: s.position_x, gy: s.position_y, data: s });

  // Sortieren nach Iso-Z (gx + gy aufsteigend = hinten zuerst)
  allItems.sort((a, b) => {
    const za = a.gx + a.gy;
    const zb = b.gx + b.gy;
    if (za !== zb) return za - zb;
    // Building/empty IMMER über Tile bei gleicher Pos
    if (a.kind === "tile" && b.kind !== "tile") return -1;
    if (a.kind !== "tile" && b.kind === "tile") return 1;
    return 0;
  });

  // Origin-Berechnung: Center der Scene auf Pixel-Mitte legen (Grid-Mittelpunkt = (1,1))
  // Container hat width 100%, so we use a wide canvas
  const canvasWidth  = 800;
  const canvasHeight = height;
  // Center ist gx=gy=1 → isoToPx(1,1,ox,oy) = (ox, oy + TILE_H)
  // Wir wollen das auf (canvasWidth/2, canvasHeight*0.55)
  const centerX = canvasWidth / 2;
  const centerY = canvasHeight * 0.40;
  const originX = centerX;
  const originY = centerY - TILE_H;  // damit (1,1) exakt zentriert sitzt

  return (
    <div
      style={{
        width: "100%", height, overflow: "hidden", position: "relative",
        background: `radial-gradient(ellipse 80% 60% at center 50%, ${groundColor}88 0%, #0F1115 70%)`,
        borderRadius: 16,
      }}
    >
      {/* Sky/Wolken (subtle) */}
      <div style={{
        position: "absolute", top: 0, left: 0, right: 0, height: 80,
        background: `linear-gradient(180deg, ${accent}11 0%, transparent 100%)`,
      }} />
      {/* 3 langsam treibende Wolken */}
      {[
        { x: "10%", y: 20, scale: 0.7, dur: 80 },
        { x: "60%", y: 35, scale: 1.0, dur: 110 },
        { x: "85%", y: 15, scale: 0.5, dur: 95 },
      ].map((c, i) => (
        <div key={i} style={{
          position: "absolute", left: c.x, top: c.y,
          width: 80 * c.scale, height: 30 * c.scale,
          background: "rgba(255,255,255,0.12)", borderRadius: 999,
          animation: `cloud${i} ${c.dur}s linear infinite`,
        }} />
      ))}
      <style>{`
        @keyframes cloud0 { from { transform: translateX(-100px); } to { transform: translateX(900px); } }
        @keyframes cloud1 { from { transform: translateX(-100px); } to { transform: translateX(900px); } }
        @keyframes cloud2 { from { transform: translateX(-100px); } to { transform: translateX(900px); } }
      `}</style>

      {/* Iso-Canvas (SVG-basierter Container für Auto-Scaling) */}
      <svg
        viewBox={`0 0 ${canvasWidth} ${canvasHeight}`}
        width="100%" height="100%"
        style={{ display: "block", position: "absolute", inset: 0 }}
        preserveAspectRatio="xMidYMid meet"
      >
        {/* Wildnis-Bäume außerhalb des Grids */}
        <ForestRing accent={accent} cx={centerX} cy={centerY} />

        {/* Iso-Tiles + Buildings in Render-Reihenfolge */}
        {allItems.map((item, i) => {
          const { x, y } = isoToPx(item.gx, item.gy, originX, originY);
          if (item.kind === "tile") {
            return <IsoTile key={`t-${i}`} cx={x} cy={y} color={groundColor} highlight={groundHighlight} accent={accent} isCenter={item.gx === 1 && item.gy === 1} />;
          }
          if (item.kind === "building") {
            const b = item.data as IsoSceneBuilding;
            const Comp = ISO_BUILDINGS[b.building_id];
            if (!Comp) return null;
            const isHovered = hoveredId === `${b.building_id}-${item.gx}-${item.gy}`;
            return (
              <foreignObject
                key={`b-${i}`}
                x={x - TILE_W / 2}
                y={y - TILE_W * 0.6 + BUILDING_OFFSET_Y}
                width={TILE_W}
                height={TILE_W * 1.2}
                onClick={() => onBuildingTap?.(b.building_id)}
                onMouseEnter={() => setHoveredId(`${b.building_id}-${item.gx}-${item.gy}`)}
                onMouseLeave={() => setHoveredId(null)}
                style={{ cursor: "pointer", overflow: "visible", transition: "transform 0.2s", transform: isHovered ? "translateY(-6px)" : "translateY(0)" }}
              >
                <div style={{ width: "100%", height: "100%" }}>
                  <Comp level={b.level} status={b.status} highlighted={isHovered} />
                </div>
              </foreignObject>
            );
          }
          // empty slot
          const s = item.data as IsoSceneSlot;
          return (
            <foreignObject
              key={`e-${i}`}
              x={x - TILE_W / 2}
              y={y - TILE_W * 0.6 + BUILDING_OFFSET_Y}
              width={TILE_W}
              height={TILE_W * 1.2}
              onClick={() => onSlotTap?.(s.empty_for)}
              style={{ cursor: "pointer", overflow: "visible" }}
            >
              <IsoEmptySlot />
            </foreignObject>
          );
        })}

        {/* Lagerfeuer in der Center-Mitte (1,1) wenn das Center-Tile leer ist */}
        {!buildings.some((b) => b.position_x === 1 && b.position_y === 1) && (
          <Campfire cx={centerX} cy={centerY + 5} accent={accent} />
        )}

        {/* Schwebende NPC-Lichter (Bewohner) */}
        <NpcLights accent={accent} cx={centerX} cy={centerY} />
      </svg>
    </div>
  );
}

// ─── Iso-Tile (rhombischer Boden-Block) ───────────────────────────────
function IsoTile({ cx, cy, color, highlight, accent, isCenter }: { cx: number; cy: number; color: string; highlight: string; accent: string; isCenter: boolean }) {
  return (
    <g>
      {/* Rhombus */}
      <polygon
        points={`${cx},${cy + TILE_H / 2} ${cx + TILE_W / 2},${cy} ${cx},${cy - TILE_H / 2} ${cx - TILE_W / 2},${cy}`}
        fill={isCenter ? highlight : color}
        stroke={accent}
        strokeWidth={isCenter ? "1.8" : "1"}
        opacity={isCenter ? 0.95 : 0.9}
      />
      {/* Subtle inner shading */}
      <polygon
        points={`${cx},${cy + TILE_H / 2} ${cx + TILE_W / 2},${cy} ${cx},${cy - TILE_H / 2} ${cx - TILE_W / 2},${cy}`}
        fill="url(#tileShade)"
        opacity="0.15"
      />
      <defs>
        <linearGradient id="tileShade" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#fff" stopOpacity="0.3" />
          <stop offset="100%" stopColor="#000" stopOpacity="0.5" />
        </linearGradient>
      </defs>
    </g>
  );
}

// ─── Bäume + Felsen außerhalb der Tiles ──────────────────────────────
function ForestRing({ accent, cx, cy }: { accent: string; cx: number; cy: number }) {
  const treeColor = accent === "#22D1C3" ? "#3aa890" : "#4ade80";
  const trees: Array<{ angle: number; r: number; scale: number }> = [];
  for (let i = 0; i < 22; i++) {
    const angle = (i / 22) * Math.PI * 2;
    const r = 280 + (i % 3) * 30;
    trees.push({ angle, r, scale: 0.4 + (i % 3) * 0.2 });
  }
  return (
    <g>
      {trees.map((t, i) => {
        const x = cx + Math.cos(t.angle) * t.r;
        const y = cy + Math.sin(t.angle) * (t.r * 0.45);  // iso-stretched
        return (
          <g key={i} transform={`translate(${x}, ${y}) scale(${t.scale})`}>
            <polygon points="0,0 -8,-12 0,-15 8,-12" fill="#5a3a1c" />
            <polygon points="0,-10 -25,-40 0,-60 25,-40" fill={treeColor} />
            <polygon points="0,-30 -18,-52 0,-68 18,-52" fill="#22a560" />
            <polygon points="0,-45 -12,-58 0,-72 12,-58" fill="#2a8a45" />
          </g>
        );
      })}
      {/* Felsen vereinzelt */}
      {Array.from({ length: 6 }).map((_, i) => {
        const angle = (i / 6) * Math.PI * 2 + Math.PI / 12;
        const r = 270;
        const x = cx + Math.cos(angle) * r;
        const y = cy + Math.sin(angle) * (r * 0.45);
        return (
          <g key={i} transform={`translate(${x}, ${y})`}>
            <polygon points="-10,0 -6,-14 6,-14 12,-2 8,4 -6,4" fill="#5a5d68" />
            <polygon points="-10,0 -6,-14 0,-10 0,4 -6,4" fill="#4a4d58" />
          </g>
        );
      })}
    </g>
  );
}

// ─── Lagerfeuer ──────────────────────────────────────────────────────
function Campfire({ cx, cy, accent }: { cx: number; cy: number; accent: string }) {
  return (
    <g transform={`translate(${cx}, ${cy})`}>
      {/* Glow */}
      <circle cx="0" cy="0" r="40" fill={accent} opacity="0.25">
        <animate attributeName="r" values="35;45;35" dur="2s" repeatCount="indefinite" />
        <animate attributeName="opacity" values="0.2;0.35;0.2" dur="2s" repeatCount="indefinite" />
      </circle>
      {/* Steinring */}
      {Array.from({ length: 6 }).map((_, i) => {
        const a = (i / 6) * Math.PI * 2;
        const x = Math.cos(a) * 18;
        const y = Math.sin(a) * 9;
        return <ellipse key={i} cx={x} cy={y} rx="6" ry="3" fill="#5a5e6c" />;
      })}
      {/* Holzscheite */}
      <line x1="-12" y1="-2" x2="12" y2="2" stroke="#5a3a1c" strokeWidth="3" />
      <line x1="-10" y1="3" x2="10" y2="-3" stroke="#7a4a2a" strokeWidth="3" />
      {/* Flammen */}
      <polygon points="-8,-8 0,-22 8,-8 4,-2 -4,-2" fill="#FFE066">
        <animate attributeName="points" values="-8,-8 0,-22 8,-8 4,-2 -4,-2;-7,-8 0,-26 7,-8 4,-2 -4,-2;-8,-8 0,-22 8,-8 4,-2 -4,-2" dur="0.8s" repeatCount="indefinite" />
      </polygon>
      <polygon points="-5,-8 0,-18 5,-8 3,-4 -3,-4" fill="#FF6B4A">
        <animate attributeName="points" values="-5,-8 0,-18 5,-8 3,-4 -3,-4;-6,-8 0,-21 6,-8 3,-4 -3,-4;-5,-8 0,-18 5,-8 3,-4 -3,-4" dur="0.6s" repeatCount="indefinite" />
      </polygon>
      <polygon points="-3,-8 0,-14 3,-8 2,-5 -2,-5" fill="#FF2D78">
        <animate attributeName="opacity" values="0.7;1;0.7" dur="0.5s" repeatCount="indefinite" />
      </polygon>
    </g>
  );
}

// ─── Schwebende NPC-Lichter ──────────────────────────────────────────
function NpcLights({ accent, cx, cy }: { accent: string; cx: number; cy: number }) {
  return (
    <g>
      {Array.from({ length: 5 }).map((_, i) => {
        const dur = 8 + i * 1.5;
        const r = 90 + i * 25;
        const startA = (i / 5) * 360;
        return (
          <g key={i}>
            <circle cx="0" cy="0" r="3" fill={accent}>
              <animateTransform
                attributeName="transform"
                type="rotate"
                from={`${startA} ${cx} ${cy}`}
                to={`${startA + 360} ${cx} ${cy}`}
                dur={`${dur}s`}
                repeatCount="indefinite"
              />
              <animateTransform
                attributeName="transform"
                type="translate"
                additive="sum"
                values={`${cx + r},${cy}; ${cx + r},${cy + 3}; ${cx + r},${cy}`}
                dur="2s"
                repeatCount="indefinite"
              />
            </circle>
            <circle cx="0" cy="0" r="6" fill={accent} opacity="0.4">
              <animateTransform
                attributeName="transform"
                type="rotate"
                from={`${startA} ${cx} ${cy}`}
                to={`${startA + 360} ${cx} ${cy}`}
                dur={`${dur}s`}
                repeatCount="indefinite"
              />
              <animateTransform
                attributeName="transform"
                type="translate"
                additive="sum"
                values={`${cx + r},${cy}; ${cx + r},${cy + 3}; ${cx + r},${cy}`}
                dur="2s"
                repeatCount="indefinite"
              />
            </circle>
          </g>
        );
      })}
    </g>
  );
}
