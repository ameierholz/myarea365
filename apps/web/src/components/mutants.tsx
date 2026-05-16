"use client";

/**
 * MUTANTS — feindliche NPC-Gruppen direkt auf der Karte (Wegelager-Ersatz).
 *
 * Pollt /api/mutant/active alle 10s, rendert Mapbox-HTMLMarker pro Mutant.
 * Click öffnet Modal mit zwei Tabs:
 *   • Solo (Banditen-Style): instant attack mit X Truppen
 *   • Crew-Rally (Stronghold-Style): Vorbereitung + Beitritt + Marsch
 */

import { useEffect, useState } from "react";
import mapboxgl from "mapbox-gl";
import { Star, Share2, Flag } from "lucide-react";
import { ResourceIcon, useResourceArt } from "@/components/resource-icon";
import { createClient } from "@/lib/supabase/client";
import { PersonalMarkerModal, CrewMarkerModal, SharePinModal } from "@/components/heimat/heimat-marker-modals";

type Mutant = {
  id: number;
  city_slug: string;
  npc_kind?: "static" | "walker";
  spawn_terrain?: "park" | "industrial" | "forest" | "water_edge" | string | null;
  origin_lat: number; origin_lng: number;
  target_lat: number; target_lng: number;
  route_geom_json?: { type: "LineString"; coordinates: [number, number][] } | null;
  route_distance_m?: number;
  started_at: string;
  finishes_at: string;
  status: "walking" | "captured" | "escaped" | "expired";
  loot_tier: "bronze" | "silver" | "gold" | "platinum";
  hp: number;
  troop_count: number;
  /** Server-Level beim Spawn (1-30). HP/Truppen × level, Loot × sqrt(level). */
  level: number;
  /** ISO-Timestamp wann der Kampf VFX-maessig beginnt (= march_ends_at der
   *  zugehoerigen Rally). Wird beim marching-Uebergang gesetzt, damit der
   *  Client den Kampfbeginn ohne Cron-Latenz kennt. */
  fight_starts_at?: string | null;
  /** ISO-Timestamp wann der Kampf endet (= fight_starts_at + dynamische Dauer).
   *  VFX-Slash laeuft im Bereich [fight_starts_at, fight_until - 1.5s],
   *  Explosion in den letzten 1.5s vor fight_until. */
  fight_until?: string | null;
};

type AttackResult = {
  ok?: boolean; victory?: boolean;
  troops_sent?: number; losses?: number;
  tier?: string; drop_rss?: number; drop_gems?: number;
  error?: string;
};

const TIER_META: Record<Mutant["loot_tier"], { emoji: string; label: string; color: string; ring: string }> = {
  bronze:   { emoji: "🥉", label: "Bronze",   color: "#CD7F32", ring: "#CD7F32" },
  silver:   { emoji: "🥈", label: "Silber",   color: "#C0C0C0", ring: "#C0C0C0" },
  gold:     { emoji: "🥇", label: "Gold",     color: "#FFD700", ring: "#FFD700" },
  platinum: { emoji: "💎", label: "Platin",   color: "#22D1C3", ring: "#22D1C3" },
};

function progress(starts_at: string, ends_at: string): number {
  const s = new Date(starts_at).getTime();
  const e = new Date(ends_at).getTime();
  const now = Date.now();
  if (now <= s) return 0;
  if (now >= e) return 1;
  return (now - s) / (e - s);
}

function haversineMeters(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6_371_000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

function interpolatePolyline(coords: [number, number][], t: number): [number, number] {
  if (coords.length === 0) return [0, 0];
  if (coords.length === 1 || t <= 0) return coords[0];
  if (t >= 1) return coords[coords.length - 1];
  const segLens: number[] = [];
  let total = 0;
  for (let i = 1; i < coords.length; i++) {
    const d = Math.hypot(coords[i][0] - coords[i - 1][0], coords[i][1] - coords[i - 1][1]);
    segLens.push(d);
    total += d;
  }
  if (total === 0) return coords[0];
  let target = total * t;
  for (let i = 0; i < segLens.length; i++) {
    if (target <= segLens[i]) {
      const f = segLens[i] === 0 ? 0 : target / segLens[i];
      return [coords[i][0] + (coords[i + 1][0] - coords[i][0]) * f,
              coords[i][1] + (coords[i + 1][1] - coords[i][1]) * f];
    }
    target -= segLens[i];
  }
  return coords[coords.length - 1];
}

function createMarkerElement(m: Mutant, onClick: () => void): HTMLDivElement {
  const meta = TIER_META[m.loot_tier];
  const el = document.createElement("div");
  el.style.cssText = `position: relative; width: 64px; height: 64px; cursor: pointer; pointer-events: auto;`;

  const isStatic = m.npc_kind !== "walker";
  const spriteFile = isStatic ? "/sprites/mutant_idle_12x128.png" : "/sprites/mutant_walker_walk_16x128.png";
  const spriteFrames = isStatic ? 12 : 16;
  const sheetW = spriteFrames * 64;
  const spriteDur = isStatic ? "1.4s" : "0.9s";
  const animName = isStatic ? "ma365MutantIdle" : "ma365MutantWalk";
  const fallbackEmoji = isStatic ? "🧟" : "🚶";

  const sprite = document.createElement("div");
  sprite.style.cssText = `
    position: absolute; inset: 0;
    background-image: url(${spriteFile});
    background-repeat: no-repeat;
    background-size: ${sheetW}px 64px;
    background-position: 0 0;
    image-rendering: pixelated;
    filter: drop-shadow(0 0 6px ${meta.ring}aa) drop-shadow(0 3px 5px rgba(0,0,0,0.6));
    animation: ${animName} ${spriteDur} steps(${spriteFrames}) infinite;
  `;
  const fallback = document.createElement("div");
  fallback.style.cssText = `
    position: absolute; inset: 0;
    border-radius: 50%;
    border: 3px solid ${meta.ring};
    box-shadow: 0 0 12px ${meta.ring}cc, 0 4px 10px rgba(0,0,0,0.7);
    background: radial-gradient(circle at 35% 30%, #2A2D38, #0F1115);
    display: flex; align-items: center; justify-content: center;
    font-size: 26px;
    opacity: 0;
    transition: opacity 0.15s;
  `;
  fallback.textContent = fallbackEmoji;
  const probe = new Image();
  probe.onerror = () => { sprite.style.display = "none"; fallback.style.opacity = "1"; };
  probe.src = spriteFile;
  el.appendChild(sprite);
  el.appendChild(fallback);

  const badge = document.createElement("div");
  badge.style.cssText = `
    position: absolute; bottom: -4px; left: 50%; transform: translateX(-50%);
    background: linear-gradient(135deg, #1A1D23, #0F1115);
    color: ${meta.color};
    font-size: 11px; padding: 1px 6px; border-radius: 8px;
    border: 1px solid ${meta.ring}88;
    font-weight: 900; line-height: 1;
    box-shadow: 0 2px 5px rgba(0,0,0,0.6);
  `;
  badge.textContent = meta.emoji;
  el.appendChild(badge);

  el.onclick = (ev) => { ev.stopPropagation(); onClick(); };
  return el;
}

export function Mutants(_props: { bbox: [number, number, number, number] | null }) {
  // Mapbox NATIVE Symbol-Layer statt HTML-Marker. Vorher mit Marker-Klasse gab
  // es zwei harte Probleme: (1) bei MAX_VALUE-Projection blieben Marker unsicht-
  // bar; (2) HTML-Marker performen schlecht bei 600+ Stueck.
  // Native Symbol-Layer: GeoJSON-Source + symbol-layer mit icon-image.
  // Mapbox WebGL-Renderer zeichnet alle 600 nativ in einem draw-call, fixed an
  // lat/lng — kein wandern moeglich.
  const [selected, setSelected] = useState<Mutant | null>(null);

  useEffect(() => {
    let cancelled = false;
    let map: mapboxgl.Map | null = null;
    let mutantsById = new Map<number, Mutant>();

    const SOURCE_ID = "ma365-mutants-source";
    const LAYER_ID = "ma365-mutants-layer";
    const BADGE_BG_ID = "ma365-mutants-badge-bg";
    const BADGE_TEXT_ID = "ma365-mutants-badge-text";
    const SLASH_LAYER_ID = "ma365-mutants-vfx-slash";
    const EXPLOSION_LAYER_ID = "ma365-mutants-vfx-explosion";
    const FRAME_COUNT = 12;
    const FRAME_SIZE = 128;
    const SLASH_FRAME_COUNT = 8;
    const EXPLOSION_FRAME_COUNT = 16;
    const VFX_FRAME_SIZE = 128;
    const ICON_PREFIX = "ma365-mutant-frame-";
    const SLASH_PREFIX = "ma365-vfx-slash-";
    const EXPLOSION_PREFIX = "ma365-vfx-explosion-";
    const iconId = (frame: number) => `${ICON_PREFIX}${frame}`;
    const slashIconId = (frame: number) => `${SLASH_PREFIX}${frame}`;
    const explosionIconId = (frame: number) => `${EXPLOSION_PREFIX}${frame}`;
    // Letzte 1.5s der Fight-Phase: Slash stoppt, Explosion spielt als Climax.
    const EXPLOSION_TAIL_MS = 1500;
    const TIER_COLOR: Record<string, string> = {
      bronze: "#CD7F32", silver: "#C0C0C0", gold: "#FFD700", platinum: "#22D1C3",
    };

    // Hexagonal Badge als Canvas-Image generieren — CoD/RoK-Style. Hex-shape mit
    // Gradient + schwarzem Rand + innerer Highlight-Linie. Pro Tier ein eigenes
    // Image, das via icon-image=["concat","badge-",tier] pro Feature gewaehlt wird.
    const createHexBadge = (color: string): ImageData | null => {
      const size = 56;
      const canvas = document.createElement("canvas");
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext("2d");
      if (!ctx) return null;
      const cx = size / 2, cy = size / 2;
      const r = size / 2 - 4;

      // Hexagon-Path (flat-top)
      const drawHex = (radius: number) => {
        ctx.beginPath();
        for (let i = 0; i < 6; i++) {
          const a = (Math.PI / 3) * i;
          const x = cx + radius * Math.cos(a);
          const y = cy + radius * Math.sin(a);
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.closePath();
      };

      // Helper: hex-color → rgb
      const hex2rgb = (h: string) => ({
        r: parseInt(h.slice(1, 3), 16),
        g: parseInt(h.slice(3, 5), 16),
        b: parseInt(h.slice(5, 7), 16),
      });
      const rgb = hex2rgb(color);
      const dark = `rgb(${Math.round(rgb.r * 0.55)},${Math.round(rgb.g * 0.55)},${Math.round(rgb.b * 0.55)})`;
      const light = `rgb(${Math.round(rgb.r + (255 - rgb.r) * 0.4)},${Math.round(rgb.g + (255 - rgb.g) * 0.4)},${Math.round(rgb.b + (255 - rgb.b) * 0.4)})`;

      // Outer hex — Gradient fill
      drawHex(r);
      const grad = ctx.createLinearGradient(0, 0, 0, size);
      grad.addColorStop(0, light);
      grad.addColorStop(0.5, color);
      grad.addColorStop(1, dark);
      ctx.fillStyle = grad;
      ctx.fill();

      // Outer border
      ctx.lineWidth = 2.5;
      ctx.strokeStyle = "#0F1115";
      drawHex(r);
      ctx.stroke();

      // Inner highlight ring
      ctx.lineWidth = 1;
      ctx.strokeStyle = `rgba(${rgb.r},${rgb.g},${rgb.b},0.6)`;
      drawHex(r - 4);
      ctx.stroke();

      return ctx.getImageData(0, 0, size, size);
    };

    // Hilfsfunktion: Sprite-Sheet horizontal in einzelne Mapbox-Icons zerlegen.
    const loadSpriteSheet = async (
      m: mapboxgl.Map,
      url: string,
      frameCount: number,
      frameSize: number,
      prefixId: (f: number) => string,
    ): Promise<void> => {
      if (m.hasImage(prefixId(0))) return;
      await new Promise<void>((resolve) => {
        const img = new Image();
        img.crossOrigin = "anonymous";
        img.onload = () => {
          try {
            const canvas = document.createElement("canvas");
            canvas.width = frameSize;
            canvas.height = frameSize;
            const ctx = canvas.getContext("2d");
            if (!ctx) return resolve();
            for (let f = 0; f < frameCount; f++) {
              ctx.clearRect(0, 0, frameSize, frameSize);
              ctx.drawImage(img, f * frameSize, 0, frameSize, frameSize,
                            0, 0, frameSize, frameSize);
              const data = ctx.getImageData(0, 0, frameSize, frameSize);
              if (!m.hasImage(prefixId(f))) m.addImage(prefixId(f), data);
            }
            resolve();
          } catch { resolve(); }
        };
        img.onerror = () => resolve();
        img.src = url;
      });
    };

    const setupLayer = async (m: mapboxgl.Map) => {
      // Alle 12 Frames aus dem Sprite-Sheet einzeln als Mapbox-Icons registrieren.
      // Animation laeuft dann via setLayoutProperty("icon-image", iconId(currentFrame))
      // — EIN Mapbox-Call schaltet ALLE 600 Mutanten gleichzeitig auf den naechsten
      // Frame. Synchron-animiert, super-performant (WebGL macht den Rest).
      await loadSpriteSheet(m, "/sprites/mutant_idle_12x128.png", FRAME_COUNT, FRAME_SIZE, iconId);

      // VFX-Sprites: Slash (8 Frames, loopt waehrend Fight) + Explosion (16 Frames,
      // spielt in den letzten 1.5s als Climax). Beide werden parallel von Blender
      // gerendert (scripts/sprites/render_vfx_sprites.py).
      await loadSpriteSheet(m, "/sprites/vfx_slash_8x128.png", SLASH_FRAME_COUNT, VFX_FRAME_SIZE, slashIconId);
      await loadSpriteSheet(m, "/sprites/vfx_explosion_16x128.png", EXPLOSION_FRAME_COUNT, VFX_FRAME_SIZE, explosionIconId);

      if (!m.getSource(SOURCE_ID)) {
        m.addSource(SOURCE_ID, {
          type: "geojson",
          data: { type: "FeatureCollection", features: [] },
        });
      }
      if (!m.getLayer(LAYER_ID)) {
        m.addLayer({
          id: LAYER_ID,
          type: "symbol",
          source: SOURCE_ID,
          minzoom: 13,
          layout: {
            "icon-image": iconId(0),
            // Harte Step-Funktion (KEINE Interpolation):
            //   z < 16 → 0.30 (klein, konstant in Silhouetten-Range)
            //   z >= 16 → 0.6 (groß, Full-Stage)
            //   z >= 18 → 0.85 (sehr nahe)
            // Nur 1 Schwelle bei z=16 synchron mit Base-LOD. Bei Rauszoomen
            // wird's einmal kleiner und bleibt dann konstant.
            "icon-size": [
              "step", ["zoom"],
              0.30,
              16, 0.6,
              18, 0.85,
            ],
            "icon-allow-overlap": true,
            "icon-ignore-placement": true,
            "icon-anchor": "bottom",
          },
        });

        m.on("click", LAYER_ID, (e) => {
          const f = e.features?.[0];
          if (!f) return;
          // Verhindert dass der Map-Klick-Handler (Heimat-Tap-Card) gleichzeitig
          // feuert — Mapbox-Layer-Click feuert immer durch zur Map.
          e.originalEvent.preventDefault();
          e.preventDefault();
          const id = (f.properties?.id ?? 0) as number;
          const mutant = mutantsById.get(id);
          if (mutant) setSelected(mutant);
        });
        m.on("mouseenter", LAYER_ID, () => { m.getCanvas().style.cursor = "pointer"; });
        m.on("mouseleave", LAYER_ID, () => { m.getCanvas().style.cursor = ""; });
      }

      // 4 Hexagon-Tier-Badges einmalig als Mapbox-Images registrieren.
      // Pro Feature waehlt der symbol-layer den richtigen via tier-property.
      for (const t of ["bronze", "silver", "gold", "platinum"]) {
        const imgId = `badge-${t}`;
        if (!m.hasImage(imgId)) {
          const data = createHexBadge(TIER_COLOR[t]);
          if (data) m.addImage(imgId, data);
        }
      }

      // Tier+Level-Badge — Hexagon-Shield in Tier-Farbe (CoD/RoK-Style) + Level-
      // Zahl mittig drin. Sitzt am Sprite-Fuss (auf der lat/lng-Position).
      if (!m.getLayer(BADGE_BG_ID)) {
        m.addLayer({
          id: BADGE_BG_ID,
          type: "symbol",
          source: SOURCE_ID,
          minzoom: 13,
          layout: {
            "icon-image": ["concat", "badge-", ["get", "tier"]],
            "icon-size": [
              "step", ["zoom"],
              0.28,
              16, 0.5,
              18, 0.7,
            ],
            "icon-allow-overlap": true,
            "icon-ignore-placement": true,
            "icon-anchor": "center",
          },
        });
      }
      if (!m.getLayer(BADGE_TEXT_ID)) {
        m.addLayer({
          id: BADGE_TEXT_ID,
          type: "symbol",
          source: SOURCE_ID,
          minzoom: 13,
          layout: {
            "text-field": ["to-string", ["get", "level"]],
            "text-size": [
              "step", ["zoom"],
              8,
              16, 11,
              18, 15,
            ],
            "text-font": ["Open Sans Bold", "Arial Unicode MS Bold"],
            "text-anchor": "center",
            "text-allow-overlap": true,
            "text-ignore-placement": true,
          },
          paint: {
            "text-color": "#0F1115",
            "text-halo-color": "#FFFFFF",
            "text-halo-width": 0.8,
          },
        });
      }

      // Sofort-Patch bestehender Layer (HMR-Safe): die addLayer-Aufrufe oben
      // sind durch !getLayer-Guards geschützt → bei Code-Änderungen würden die
      // neuen icon-size-Werte sonst nicht greifen weil der Layer schon
      // existiert. setLayoutProperty zwingt den aktuellen Wert rein, ohne
      // Layer zu zerstören oder Daten zu verlieren.
      // Harte Step-Funktion: z=16 ist die einzige Übergangs-Schwelle
      // (synchron mit Base-LOD). Keine Interpolation = kein Mausrad-Klick
      // landet in einer Misch-Größe.
      const MUTANT_ICON_SIZE: mapboxgl.ExpressionSpecification = [
        "step", ["zoom"], 0.30, 16, 0.6, 18, 0.85,
      ];
      const BADGE_ICON_SIZE: mapboxgl.ExpressionSpecification = [
        "step", ["zoom"], 0.28, 16, 0.5, 18, 0.7,
      ];
      const BADGE_TEXT_SIZE: mapboxgl.ExpressionSpecification = [
        "step", ["zoom"], 8, 16, 11, 18, 15,
      ];
      try {
        m.setLayoutProperty(LAYER_ID, "icon-size", MUTANT_ICON_SIZE);
        m.setLayoutProperty(BADGE_BG_ID, "icon-size", BADGE_ICON_SIZE);
        m.setLayoutProperty(BADGE_TEXT_ID, "text-size", BADGE_TEXT_SIZE);
      } catch { /* layer may not exist yet */ }

      // VFX-Layer Slash: nur sichtbar bei `vfx == 'slash'`. Sitzt mittig auf dem
      // Mutant, etwas groesser als der Sprite damit man den Bogenschlag drumherum
      // sieht. icon-image wird zentral via setLayoutProperty zyklisch durchgeschaltet.
      if (!m.getLayer(SLASH_LAYER_ID)) {
        m.addLayer({
          id: SLASH_LAYER_ID,
          type: "symbol",
          source: SOURCE_ID,
          minzoom: 13,
          filter: ["==", ["get", "vfx"], "slash"],
          layout: {
            "icon-image": slashIconId(0),
            "icon-size": [
              "interpolate", ["linear"], ["zoom"],
              13, 0.45,
              16, 0.75,
              18, 1.0,
            ],
            "icon-allow-overlap": true,
            "icon-ignore-placement": true,
            "icon-anchor": "center",
            "icon-offset": [0, -40],
            "icon-rotate": ["get", "vfx_rotate"],
          },
        });
      }

      // VFX-Layer Explosion: gleicher Mechanismus, andere Frame-Sequenz, leicht
      // groesser fuer den "Climax"-Punch. Wird in den letzten 1.5s vor Fight-Ende
      // aktiviert (slash deaktiviert sich dann gleichzeitig).
      if (!m.getLayer(EXPLOSION_LAYER_ID)) {
        m.addLayer({
          id: EXPLOSION_LAYER_ID,
          type: "symbol",
          source: SOURCE_ID,
          minzoom: 13,
          filter: ["==", ["get", "vfx"], "explosion"],
          layout: {
            "icon-image": explosionIconId(0),
            "icon-size": [
              "interpolate", ["linear"], ["zoom"],
              13, 0.55,
              16, 0.9,
              18, 1.2,
            ],
            "icon-allow-overlap": true,
            "icon-ignore-placement": true,
            "icon-anchor": "center",
            "icon-offset": [0, -40],
          },
        });
      }
    };

    // Letzter VFX-State pro Mutant — vermeidet setData wenn nichts geaendert hat.
    // Ohne diesen Cache rief der 500ms-Tick setData jedes Mal auf, was Mapbox
    // zwang Label-Collisions neu zu berechnen -> Hausnummern flackerten.
    let lastSourceFingerprint = "";
    const updateSource = () => {
      if (!map) return;
      const src = map.getSource(SOURCE_ID) as mapboxgl.GeoJSONSource | undefined;
      if (!src) return;
      const now = Date.now();
      const features = Array.from(mutantsById.values()).map((m) => {
        const fightStartsAt = m.fight_starts_at ? new Date(m.fight_starts_at).getTime() : 0;
        const fightEndsAt = m.fight_until ? new Date(m.fight_until).getTime() : 0;
        // VFX-Aktiv: zwischen fight_starts_at (= Ende des Marsches) und fight_until.
        // Vor fight_starts_at sind die Truppen noch unterwegs — kein Kampf-VFX.
        const fightActive = fightStartsAt > 0 && fightStartsAt <= now && now < fightEndsAt;
        const inExplosionTail = fightActive && (fightEndsAt - now) <= EXPLOSION_TAIL_MS;
        // VFX-Phasen: slash (Hauptkampf) → explosion (letzte 1.5s) → none
        const vfx: "slash" | "explosion" | "none" = inExplosionTail
          ? "explosion"
          : fightActive
            ? "slash"
            : "none";
        // Slash leicht rotieren je nach Mutant-id (Pseudo-Random), damit nicht
        // alle gleichzeitig in dieselbe Richtung schwingen.
        const vfxRotate = ((m.id * 37) % 360);
        return {
          type: "Feature" as const,
          geometry: { type: "Point" as const, coordinates: [m.origin_lng, m.origin_lat] },
          properties: {
            id: m.id,
            tier: m.loot_tier,
            level: m.level,
            tierColor: TIER_COLOR[m.loot_tier] ?? "#CD7F32",
            vfx,
            vfx_rotate: vfxRotate,
          },
        };
      });
      // Fingerprint nur ueber Felder die das visuelle Rendering aendern.
      // Wenn identisch -> setData skippen (kein Re-Layout / kein Label-Flicker).
      const fp = features
        .map((f) => `${f.properties.id}:${f.properties.vfx}:${f.geometry.coordinates[0].toFixed(5)},${f.geometry.coordinates[1].toFixed(5)}`)
        .join("|");
      if (fp === lastSourceFingerprint) return;
      lastSourceFingerprint = fp;
      src.setData({ type: "FeatureCollection", features });
    };

    const refresh = async () => {
      try {
        const r = await fetch(`/api/mutant/active`, { cache: "no-store" });
        if (!r.ok) return;
        const j = (await r.json()) as { mutants?: Mutant[] };
        if (cancelled) return;
        mutantsById = new Map((j.mutants ?? []).map((m) => [m.id, m]));
        updateSource();
      } catch { /* silent */ }
    };

    const tryStart = () => {
      if (map) return;
      const m = (window as unknown as { __ma365Map?: mapboxgl.Map }).__ma365Map ?? null;
      if (!m) return;

      const startWhenReady = async () => {
        if (cancelled) return;
        map = m;
        await setupLayer(m);
        if (cancelled) return;
        void refresh();
      };

      if (m.loaded() && m.isStyleLoaded()) {
        void startWhenReady();
      } else {
        m.once("idle", () => { void startWhenReady(); });
      }
    };
    tryStart();
    const mapPoller = setInterval(() => {
      if (!map) tryStart();
    }, 500);
    window.addEventListener("ma365:map-ready", tryStart);

    // Realtime macht die Hauptarbeit (Supabase Channel auf mutants-Tabelle).
    // Poll 60s als Fallback falls WebSocket abreisst.
    const refreshIv = setInterval(() => { void refresh(); }, 60_000);
    const onChanged = () => { void refresh(); };
    window.addEventListener("ma365:mutants-changed", onChanged);
    window.addEventListener("ma365:rally-changed", onChanged);

    // Source-Refresh 500ms — schreibt nur die VFX-Properties neu (slash/explosion/
    // none) anhand der lokalen Zeit. So sieht der Spieler den Phasen-Wechsel
    // slash → explosion → off in Echtzeit, ohne auf den 5s-API-Refresh zu warten.
    const sourceTickIv = setInterval(() => { updateSource(); }, 500);

    // Frame-Cycle: schaltet alle 600 Mutanten gleichzeitig auf naechsten Sprite-
    // Frame. 12 Frames × 120ms = 1.44s pro Idle-Loop. 1 Mapbox-Layer-Update pro
    // Tick, kein DOM-Touch — laeuft auch bei 600 Markern ohne Performance-Issue.
    // Parallel werden Slash (8 Frames × 120ms = 960ms loop) und Explosion (16
    // Frames × 120ms = 1.92s loop) ueber denselben Tick fortgeschaltet.
    let currentFrame = 0;
    let currentSlashFrame = 0;
    let currentExplosionFrame = 0;
    const frameIv = setInterval(() => {
      if (!map || !map.getLayer(LAYER_ID)) return;
      currentFrame = (currentFrame + 1) % FRAME_COUNT;
      currentSlashFrame = (currentSlashFrame + 1) % SLASH_FRAME_COUNT;
      currentExplosionFrame = (currentExplosionFrame + 1) % EXPLOSION_FRAME_COUNT;
      try {
        map.setLayoutProperty(LAYER_ID, "icon-image", iconId(currentFrame));
        if (map.getLayer(SLASH_LAYER_ID)) {
          map.setLayoutProperty(SLASH_LAYER_ID, "icon-image", slashIconId(currentSlashFrame));
        }
        if (map.getLayer(EXPLOSION_LAYER_ID)) {
          map.setLayoutProperty(EXPLOSION_LAYER_ID, "icon-image", explosionIconId(currentExplosionFrame));
        }
      } catch { /* layer may have been removed */ }
    }, 120);

    return () => {
      cancelled = true;
      clearInterval(mapPoller);
      clearInterval(refreshIv);
      clearInterval(sourceTickIv);
      clearInterval(frameIv);
      window.removeEventListener("ma365:map-ready", tryStart);
      window.removeEventListener("ma365:mutants-changed", onChanged);
      window.removeEventListener("ma365:rally-changed", onChanged);
      if (map) {
        try { if (map.getLayer(EXPLOSION_LAYER_ID)) map.removeLayer(EXPLOSION_LAYER_ID); } catch { /* ignore */ }
        try { if (map.getLayer(SLASH_LAYER_ID)) map.removeLayer(SLASH_LAYER_ID); } catch { /* ignore */ }
        try { if (map.getLayer(BADGE_TEXT_ID)) map.removeLayer(BADGE_TEXT_ID); } catch { /* ignore */ }
        try { if (map.getLayer(BADGE_BG_ID)) map.removeLayer(BADGE_BG_ID); } catch { /* ignore */ }
        try { if (map.getLayer(LAYER_ID)) map.removeLayer(LAYER_ID); } catch { /* ignore */ }
        try { if (map.getSource(SOURCE_ID)) map.removeSource(SOURCE_ID); } catch { /* ignore */ }
      }
    };
  }, []);

  return (
    <>
      <style>{`
        @keyframes ma365MutantIdle {
          from { background-position: 0 0; }
          to   { background-position: -768px 0; }
        }
        @keyframes ma365MutantWalk {
          from { background-position: 0 0; }
          to   { background-position: -1024px 0; }
        }
        /* Kompakt-Variante für Modal-Header (48×48 statt 64×64): 12 × 48 = 576px */
        @keyframes ma365MutantIdle48 {
          from { background-position: 0 0; }
          to   { background-position: -576px 0; }
        }
      `}</style>
      {selected && (
        <MutantAttackModal
          mutant={selected}
          onClose={() => setSelected(null)}
          onResolved={() => { setSelected(null); }}
        />
      )}
    </>
  );
}

/* ─── ATTACK MODAL — exakt wie StrongholdModal (Wegelager) ────────────────── */

// Base-Belohnung pro Tier — matched public.mutant_tier_def Base-Werte (Mig 00391).
// Loot skaliert mit sqrt(level) (DB-seitig in mutant_tier_def). Die Modal-Anzeige
// rechnet den Multiplikator clientseitig nach damit der Spieler den echten Drop
// pro Stufe sieht (nicht nur Stufe-1-Werte).
const TIER_BASE_REWARD: Record<Mutant["loot_tier"], { rss: number; gems: number }> = {
  bronze:   { rss: 1000,  gems: 0  },
  silver:   { rss: 4000,  gems: 5  },
  gold:     { rss: 12000, gems: 15 },
  platinum: { rss: 40000, gems: 50 },
};

function rewardForLevel(tier: Mutant["loot_tier"], level: number): { rss: number; gems: number } {
  const base = TIER_BASE_REWARD[tier];
  const mult = Math.max(1, Math.floor(Math.sqrt(Math.max(1, level))));
  return { rss: base.rss * mult, gems: base.gems * mult };
}

function MutantAttackModal({
  mutant, onClose, onResolved,
}: {
  mutant: Mutant;
  onClose: () => void;
  onResolved: () => void;
}) {
  const meta = TIER_META[mutant.loot_tier];
  const level = mutant.level ?? 1;
  const reward = rewardForLevel(mutant.loot_tier, level);
  const art = useResourceArt();
  const [baseLatLng, setBaseLatLng] = useState<{ lat: number; lng: number } | null>(null);
  const [nowMs, setNowMs] = useState<number>(() => Date.now());
  // Crew-Angriff-Form-State — direkt im Modal (kein 2. Modal mehr)
  const recommended = Math.ceil(mutant.hp / 9);
  const [totalTroops, setTotalTroops] = useState<number>(recommended);
  const [prepSeconds, setPrepSeconds] = useState<number>(5);
  const [guardians, setGuardians] = useState<GuardianRow[]>([]);
  const [selectedGuardian, setSelectedGuardian] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [done, setDone] = useState<{ rally_id: string; prep_ends_at: string } | null>(null);
  // Side-Action-Modals (Speichern/Teilen/Markieren)
  const [openMarker, setOpenMarker] = useState<null | "personal" | "share" | "crew">(null);

  // Aktive Wächter laden — gleiches Pattern wie StrongholdModal
  useEffect(() => {
    const sb = createClient();
    void (async () => {
      const { data } = await sb
        .from("user_guardians")
        .select("id, level, archetype:guardian_archetypes(id,name,image_url,video_url)")
        .eq("is_active", true)
        .limit(20);
      type Row = { id: string; level: number; archetype: { id: string; name: string; image_url: string | null; video_url: string | null } | null };
      setGuardians(((data ?? []) as unknown as Row[]).map((r) => ({
        id: r.id, level: r.level,
        name: r.archetype?.name ?? "Wächter",
        image_url: r.archetype?.image_url ?? null,
        video_url: r.archetype?.video_url ?? null,
      })));
    })();
  }, []);

  async function startRally() {
    setBusy(true); setErr(null);
    try {
      const r = await fetch("/api/mutant/rally", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mutant_id: mutant.id,
          prep_seconds: prepSeconds,
          total_troops: totalTroops,
          guardian_id: selectedGuardian,
        }),
      });
      const j = (await r.json()) as { ok?: boolean; rally_id?: string; prep_ends_at?: string; error?: string };
      if (!r.ok || j.error) {
        const errMap: Record<string, string> = {
          not_in_crew: "Du bist in keiner Crew — beitreten oder gründen um einen Crew-Angriff zu starten.",
          rally_already_active: "Deine Crew hat bereits einen aktiven Crew-Angriff.",
          mutant_not_available: "Dieser Mutant wurde gerade von einer anderen Crew besiegt.",
          no_troops_available: "Du hast keine Truppen zum Mitnehmen.",
          no_troops_selected: "Keine Truppen ausgewählt.",
        };
        setErr(errMap[j.error ?? ""] ?? j.error ?? "Fehler beim Rally-Start");
        return;
      }
      if (j.rally_id && j.prep_ends_at) {
        setDone({ rally_id: j.rally_id, prep_ends_at: j.prep_ends_at });
        // Realtime-Trigger: map-dashboard refresht Rally-State + Map sofort.
        window.dispatchEvent(new CustomEvent("ma365:rally-changed"));
      }
    } catch {
      setErr("Netzwerkfehler");
    } finally {
      setBusy(false);
    }
  }

  // Despawn-Countdown — Mutanten verschwinden bei finishes_at und werden durch
  // neue ersetzt (gibt Rotation + Druck auf den Spieler schnell zu entscheiden).
  useEffect(() => {
    const iv = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(iv);
  }, []);
  const despawnSec = Math.max(0, Math.round((new Date(mutant.finishes_at).getTime() - nowMs) / 1000));
  const despawnLabel = despawnSec >= 3600
    ? `${Math.floor(despawnSec / 3600)}h ${Math.floor((despawnSec % 3600) / 60)}m`
    : despawnSec >= 60
    ? `${Math.floor(despawnSec / 60)}m ${despawnSec % 60}s`
    : `${despawnSec}s`;
  const despawnUrgent = despawnSec < 600; // < 10min

  // User-Base laden für Wegzeit-Berechnung (analog zu start_rally-Flow)
  useEffect(() => {
    const sb = createClient();
    void (async () => {
      const { data: { user } } = await sb.auth.getUser();
      if (!user) return;
      const { data } = await sb.from("bases")
        .select("lat, lng")
        .eq("owner_user_id", user.id)
        .order("created_at").limit(1).maybeSingle<{ lat: number; lng: number }>();
      if (data) setBaseLatLng({ lat: data.lat, lng: data.lng });
    })();
  }, []);

  // ESC schließt
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const terrain = mutant.spawn_terrain ?? "park";
  const terrainLabel = terrain === "park" ? "Park" : terrain === "industrial" ? "Industriegebiet" : terrain === "forest" ? "Wald" : "Stadt";

  // Wegzeit: Haversine-Distanz, 5 km/h Fußmarsch (Mapbox-Walking-Profil).
  // Tatsächliche Straßen-Distanz ist ~25 % länger als Luftlinie — Faktor 1.25.
  const distanceM = baseLatLng ? haversineMeters(baseLatLng.lat, baseLatLng.lng, mutant.origin_lat, mutant.origin_lng) * 1.25 : null;
  const walkSeconds = distanceM != null ? Math.round(distanceM / 1.39) : null; // 5 km/h = 1.39 m/s
  const wegzeit = walkSeconds == null ? "—" : walkSeconds < 60 ? `${walkSeconds}s` :
    walkSeconds < 3600 ? `${Math.floor(walkSeconds / 60)}m ${walkSeconds % 60}s` :
    `${Math.floor(walkSeconds / 3600)}h ${Math.floor((walkSeconds % 3600) / 60)}m`;
  const distLabel = distanceM == null ? "" : distanceM < 1000 ? `${Math.round(distanceM)} m` : `${(distanceM / 1000).toFixed(1)} km`;

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-[9100]"
      style={{ background: "rgba(0,0,0,0.55)", display: "flex", alignItems: "center", justifyContent: "flex-end", padding: "12px 24px 12px 12px" }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="rounded-xl bg-[#1A1D23] border shadow-2xl overflow-hidden"
        style={{ width: "min(300px, 100%)", borderColor: `${meta.color}80`, boxShadow: "0 12px 30px rgba(0,0,0,0.55)" }}
      >
        {/* Header — kompakt: Sprite + Title + Action-Buttons + Close in einer Zeile */}
        <div className="px-2.5 py-2 flex items-center gap-2" style={{ background: `linear-gradient(135deg, ${meta.color}33, ${meta.color}10)` }}>
          <div className="shrink-0 w-12 h-12 overflow-hidden">
            <div style={{
              width: 48, height: 48,
              backgroundImage: "url(/sprites/mutant_idle_12x128.png)",
              backgroundRepeat: "no-repeat",
              backgroundSize: `${12 * 48}px 48px`,
              backgroundPosition: "0 0",
              imageRendering: "pixelated",
              filter: `drop-shadow(0 0 4px ${meta.ring}aa)`,
              animation: "ma365MutantIdle48 1.4s steps(12) infinite",
            }} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-[8px] font-black tracking-widest" style={{ color: meta.color }}>MUTANT · {meta.label.toUpperCase()} · STUFE {level}</div>
            <div className="text-[11px] text-[#a8b4cf]">Spawn: {terrainLabel}</div>
            <div className={`text-[9px] font-black tracking-wide leading-tight ${despawnUrgent ? "text-[#FF6B8D]" : "text-[#FFD700]"}`}>
              ⏱ Verschwindet in {despawnLabel}
            </div>
          </div>
          {/* Close oben, darunter 3 Mini-Action-Buttons (Speichern/Teilen/Markieren) */}
          <div className="shrink-0 flex flex-col items-end gap-1">
            <button
              onClick={onClose}
              className="w-6 h-6 rounded-full bg-black/40 text-white text-sm leading-none"
              aria-label="Schließen"
            >×</button>
            <div className="flex items-center gap-0.5">
              <button
                onClick={() => setOpenMarker("personal")}
                title="Speichern"
                className="w-4 h-4 rounded-full bg-black/30 border border-[#FFD700]/60 text-[#FFD700] flex items-center justify-center hover:bg-[#FFD700]/20 transition-all"
              >
                <Star size={8} strokeWidth={2.5} fill="currentColor" />
              </button>
              <button
                onClick={() => setOpenMarker("share")}
                title="Im Chat teilen"
                className="w-4 h-4 rounded-full bg-black/30 border border-[#22D1C3]/60 text-[#22D1C3] flex items-center justify-center hover:bg-[#22D1C3]/20 transition-all"
              >
                <Share2 size={8} strokeWidth={2.5} />
              </button>
              <button
                onClick={() => setOpenMarker("crew")}
                title="Crew-Markierung"
                className="w-4 h-4 rounded-full bg-black/30 border border-[#FF2D78]/60 text-[#FF2D78] flex items-center justify-center hover:bg-[#FF2D78]/20 transition-all"
              >
                <Flag size={8} strokeWidth={2.5} fill="currentColor" />
              </button>
            </div>
          </div>
        </div>

        <div className="p-2.5 space-y-2 max-h-[80dvh] overflow-y-auto">
          <div className="grid grid-cols-2 gap-2">
            <div className="rounded-md bg-black/40 border border-white/10 p-2">
              <div className="text-[8px] font-black tracking-widest text-[#a8b4cf]">VERTEIDIGUNG</div>
              <div className="text-[12px] font-black text-white leading-tight">{mutant.hp.toLocaleString("de-DE")} <span className="text-[9px] text-[#a8b4cf]">LP</span></div>
              <div className="text-[9px] text-[#a8b4cf]">{mutant.troop_count.toLocaleString("de-DE")} Mutant-Truppen</div>
            </div>
            <div className="rounded-md bg-black/40 border border-white/10 p-2">
              <div className="text-[8px] font-black tracking-widest text-[#a8b4cf]">WEGZEIT (FUSS)</div>
              <div className="text-[12px] font-black text-white leading-tight">{wegzeit}</div>
              <div className="text-[9px] text-[#a8b4cf]">{distLabel || "Base lädt…"}</div>
            </div>
          </div>

          {/* Empfehlung — 1 Zeile */}
          <div className="text-[9px] text-[#a8b4cf] px-1">
            Empfohlen: <b className="text-white">{Math.ceil(mutant.hp / 9).toLocaleString("de-DE")}+ Truppen</b> (Crew kann mit Beitritten verstärken)
          </div>

          {/* Belohnung — 1 Zeile mit Artwork + Hinweis darunter */}
          <div className="rounded-md bg-black/30 border border-white/5 p-2">
            <div className="text-[8px] font-black tracking-widest text-[#a8b4cf] mb-1">BELOHNUNGS-POOL (ANTEILIG)</div>
            <div className="flex items-center gap-2 text-[11px] font-bold text-white">
              <span className="inline-flex items-center gap-0.5">
                <ResourceIcon kind="wood" size={16} fallback="🔧" art={art} />
                <span className="text-[#FFD700]">{reward.rss.toLocaleString("de-DE")}</span>
              </span>
              <span className="inline-flex items-center gap-0.5">
                <ResourceIcon kind="stone" size={16} fallback="🔩" art={art} />
                <span className="text-[#FFD700]">{reward.rss.toLocaleString("de-DE")}</span>
              </span>
              <span className="inline-flex items-center gap-0.5">
                <ResourceIcon kind="gold" size={16} fallback="🪙" art={art} />
                <span className="text-[#FFD700]">{reward.rss.toLocaleString("de-DE")}</span>
              </span>
              <span className="inline-flex items-center gap-0.5">
                <ResourceIcon kind="mana" size={16} fallback="📡" art={art} />
                <span className="text-[#FFD700]">{reward.rss.toLocaleString("de-DE")}</span>
              </span>
              {reward.gems > 0 && (
                <span className="inline-flex items-center gap-0.5">
                  <span style={{ fontSize: 14 }}>💎</span>
                  <span className="text-[#22D1C3]">{reward.gems}</span>
                </span>
              )}
            </div>
            <div className="text-[8px] text-[#8B8FA3] mt-1 leading-tight">
              Aufteilung kommt als Ingame-Nachricht in den Posteingang.
            </div>
          </div>

          {/* ─── CREW-ANGRIFF FORM (direkt im Modal, kein 2. Modal) ─── */}
          {done ? (
            <div className="space-y-2">
              <div className="rounded-md p-2 text-center" style={{ background: "rgba(34,209,195,0.1)", border: "1px solid #22D1C3" }}>
                <div className="text-[12px] font-black" style={{ color: "#22D1C3" }}>CREW-ANGRIFF VORBEREITUNG</div>
                <div className="text-[10px] mt-1 text-[#F0F0F0]">Crew-Mitglieder können jetzt beitreten.</div>
                <div className="text-[9px] mt-1 text-[#8B8FA3]">
                  Ende: {new Date(done.prep_ends_at).toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" })}
                </div>
              </div>
              <button onClick={onResolved} className="w-full py-2 rounded-md bg-gradient-to-r from-[#22D1C3] to-[#1AAEA3] text-[#0F1115] font-black text-[12px]">OK</button>
            </div>
          ) : (
            <>
              <div className="border-t border-white/10 my-1" />

              {/* Truppen */}
              <div>
                <div className="text-[8px] font-black tracking-widest text-[#a8b4cf] mb-1">DEINE TRUPPEN (AUTO-FILL TOP-TIER)</div>
                <div className="flex gap-1.5">
                  <input
                    type="number" min={1}
                    value={totalTroops}
                    onChange={(e) => setTotalTroops(Math.max(1, parseInt(e.target.value || "1", 10)))}
                    className="flex-1 px-2 py-1.5 bg-[#0F1115] border border-[#2A2E36] rounded-md text-white font-mono text-[12px]"
                  />
                  <button onClick={() => setTotalTroops(recommended)} className="px-2 py-1.5 text-[9px] font-black bg-white/5 border border-white/10 rounded-md text-[#F0F0F0]">
                    Empfohlen
                  </button>
                </div>
              </div>

              {/* Wächter */}
              <div>
                <div className="text-[8px] font-black tracking-widest text-[#a8b4cf] mb-1">WÄCHTER (KOMMANDANT)</div>
                <div className="flex gap-1 overflow-x-auto pb-1">
                  <button
                    onClick={() => setSelectedGuardian(null)}
                    className={`shrink-0 w-12 h-14 rounded-md flex flex-col items-center justify-center ${selectedGuardian === null ? "border-2" : "border"}`}
                    style={selectedGuardian === null
                      ? { background: `${meta.color}22`, borderColor: meta.color, color: meta.color }
                      : { background: "rgba(255,255,255,0.04)", borderColor: "rgba(255,255,255,0.1)", color: "#a8b4cf" }}
                  >
                    <span className="text-base leading-none">—</span>
                    <span className="text-[7px] mt-0.5">Keiner</span>
                  </button>
                  {guardians.map((g) => (
                    <button
                      key={g.id}
                      onClick={() => setSelectedGuardian(g.id)}
                      className={`shrink-0 w-12 h-14 rounded-md flex flex-col items-center justify-center overflow-hidden ${selectedGuardian === g.id ? "border-2" : "border"}`}
                      style={selectedGuardian === g.id
                        ? { background: `${meta.color}22`, borderColor: meta.color }
                        : { background: "rgba(255,255,255,0.04)", borderColor: "rgba(255,255,255,0.1)" }}
                    >
                      {g.video_url ? (
                        <video src={g.video_url} autoPlay loop muted playsInline className="w-8 h-8 object-cover rounded" style={{ filter: "url(#ma365-chroma-black)" }} />
                      ) : g.image_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={g.image_url} alt={g.name} className="w-8 h-8 object-cover rounded" style={{ filter: "url(#ma365-chroma-black)" }} />
                      ) : (
                        <span className="text-lg">🛡</span>
                      )}
                      <span className="text-[7px] text-white truncate w-full px-0.5 mt-0.5">{g.name}</span>
                      <span className="text-[7px]" style={{ color: meta.color }}>Stufe {g.level}</span>
                    </button>
                  ))}
                  {guardians.length === 0 && <div className="text-[9px] text-[#a8b4cf] py-2 px-2">Keine Wächter</div>}
                </div>
              </div>

              {/* Vorbereitungszeit */}
              <div>
                <div className="text-[8px] font-black tracking-widest text-[#a8b4cf] mb-1">VORBEREITUNGSZEIT</div>
                <div className="grid grid-cols-4 gap-1">
                  {PREP_OPTIONS.map((opt) => (
                    <button
                      key={opt.s}
                      onClick={() => setPrepSeconds(opt.s)}
                      className="py-1 px-0.5 rounded text-[9px] font-black border transition"
                      style={prepSeconds === opt.s
                        ? { background: meta.color + "33", borderColor: meta.color, color: "white" }
                        : { background: "rgba(255,255,255,0.04)", borderColor: "rgba(255,255,255,0.1)", color: "#a8b4cf" }}
                    >{opt.label}</button>
                  ))}
                </div>
              </div>

              {err && <div className="text-[9px] text-[#FF6B8D]">{err}</div>}

              <button
                onClick={startRally}
                disabled={busy || totalTroops < 1}
                className="w-full py-2 rounded-md text-white font-black text-[12px] shadow-lg disabled:opacity-50"
                style={{ background: `linear-gradient(135deg, ${meta.color}, ${meta.color}cc)` }}
              >
                {busy ? "Vorbereitung läuft…" : `🤝 Crew-Angriff starten · ${totalTroops.toLocaleString("de-DE")} Truppen`}
              </button>
            </>
          )}
        </div>
      </div>

      {/* Side-Action-Modals (Speichern/Teilen/Markieren) */}
      {openMarker === "personal" && (
        <PersonalMarkerModal
          coords={{ lat: mutant.origin_lat, lng: mutant.origin_lng }}
          ctx={{ primary: `Mutant ${meta.label} · Stufe ${level}`, secondary: terrainLabel }}
          onClose={() => setOpenMarker(null)}
          onSuccess={() => setOpenMarker(null)}
        />
      )}
      {openMarker === "share" && (
        <SharePinModal
          coords={{ lat: mutant.origin_lat, lng: mutant.origin_lng }}
          ctx={{ primary: `Mutant ${meta.label} · Stufe ${level}`, secondary: terrainLabel }}
          onClose={() => setOpenMarker(null)}
          onSuccess={() => setOpenMarker(null)}
        />
      )}
      {openMarker === "crew" && (
        <CrewMarkerModal
          coords={{ lat: mutant.origin_lat, lng: mutant.origin_lng }}
          ctx={{ primary: `Mutant ${meta.label} · Stufe ${level}`, secondary: terrainLabel }}
          onClose={() => setOpenMarker(null)}
          onSuccess={() => setOpenMarker(null)}
        />
      )}
    </div>
  );
}

const PREP_OPTIONS: Array<{ s: number; label: string }> = [
  // "Sofort" = 5s prep, fuer Solo-Angriff ohne Warten auf Crew-Beitritte.
  // Laengere Optionen geben anderen Crew-Mitgliedern Zeit beizutreten.
  { s: 5,      label: "Sofort" },
  { s: 180,    label: "3 Min" },
  { s: 480,    label: "8 Min" },
  { s: 1680,   label: "28 Min" },
];

type GuardianRow = {
  id: string; level: number;
  name: string; image_url: string | null; video_url: string | null;
};

