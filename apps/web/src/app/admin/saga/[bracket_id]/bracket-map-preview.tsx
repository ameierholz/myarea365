"use client";

import { useEffect, useRef, useState, useMemo } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";

const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN || "";
mapboxgl.accessToken = MAPBOX_TOKEN;

type Zone = {
  id: string; osm_id: number | null; name: string;
  zone_kind: "district" | "spawn" | "apex" | "gate";
  ring: number;
  centroid_lat: number; centroid_lng: number;
  polygon: number[][];
  owner_crew_id: string | null;
  gate_kind: string | null; gate_phase: number | null; gate_state: string | null;
  gate_garrison_crew_id: string | null;
  resource_bonus_pct: number; resource_kind: string | null;
  is_holy_site?: boolean; holy_buff_kind?: string | null; holy_buff_pct?: number;
  is_gather_tile?: boolean; gather_yield_per_hour?: number; gather_kind?: string | null; gather_remaining?: number;
};

type Crew = {
  crew_id: string; color_hex: string; spawn_zone_id: string | null;
  zones_held: number; buildings_count: number; merits: number; final_rank: number | null;
  crews?: { name: string | null; slug: string | null } | null;
};

type Building = {
  id: string; zone_id: string; crew_id: string;
  building_kind: "repeater" | "hauptgebaeude";
  hp: number; max_hp: number;
  built_at: string; destroyed_at: string | null;
};

type March = {
  id: string; crew_id: string; user_id: string;
  origin_zone_id: string; target_zone_id: string;
  march_kind: "attack" | "reinforce" | "gather";
  inf: number; cav: number; mark: number; werk: number;
  started_at: string; arrives_at: string; status: string;
};

type City = {
  slug: string; name: string;
  bbox_south: number; bbox_west: number; bbox_north: number; bbox_east: number;
  apex_lat: number; apex_lng: number; apex_name: string; apex_emoji: string;
};

type Bracket = {
  id: string; round_id: string; city_slug: string; size_tier: string;
  crew_count: number; status: string; current_phase: number;
  apex_holder_crew_id: string | null; apex_hold_started_at: string | null;
  winner_crew_id: string | null; buildup_winner_crew_id: string | null;
};

type Snap = {
  bracket: Bracket; city: City | null;
  zones: Zone[]; crews: Crew[];
  adjacency: Array<{ zone_a: string; zone_b: string; via_gate_zone: string | null }>;
  buildings: Building[]; marches: March[];
  mega_camps: Array<{ id: string; zone_id: string; hp_remaining: number; hp_total: number; expires_at: string }>;
  recent_battles: Array<{ id: string; zone_id: string; outcome: string; battle_kind?: string; created_at: string }>;
  holy_holders: Array<{ zone_id: string; crew_id: string | null; held_since: string | null; total_hold_seconds: number }>;
  user_positions: Array<{ user_id: string; current_zone_id: string; field_inf: number; field_cav: number; field_mark: number; field_werk: number }>;
  augur_milestones: Array<{ id: string; milestone_kind: string; crew_id: string | null; achieved_at: string; reward_gems: number; reward_keys: number; reward_speedups: number }>;
  rallies: Array<{ id: string; crew_id: string; target_zone_id: string; participant_count: number; status: string }>;
  diplomacy: Array<{ id: string; crew_a: string; crew_b: string; pact_kind: string; status: string; expires_at: string | null }>;
};

export function BracketMapPreview({ bracketId }: { bracketId: string }) {
  const mapContainer = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const [snap, setSnap] = useState<Snap | null>(null);
  const [loading, setLoading] = useState(true);
  const [selZone, setSelZone] = useState<Zone | null>(null);
  const [showLayers, setShowLayers] = useState({ districts: true, spawns: true, gates: true, apex: true, buildings: true, marches: true, holy: true, gather: true, megas: true, positions: true, labels: true });
  const [busy, setBusy] = useState(false);

  async function load() {
    setLoading(true);
    const r = await fetch(`/api/admin/saga/bracket-detail?bracket_id=${bracketId}`, { cache: "no-store" });
    const j = await r.json();
    if (j.ok) setSnap(j);
    setLoading(false);
  }
  useEffect(() => { void load(); }, [bracketId]);

  // Map initialisieren wenn Daten + Container bereit
  useEffect(() => {
    if (!snap || !snap.city || !mapContainer.current || mapRef.current) return;
    const c = snap.city;
    if (!MAPBOX_TOKEN) {
      console.error("NEXT_PUBLIC_MAPBOX_TOKEN fehlt — Karte kann nicht angezeigt werden");
      return;
    }

    const m = new mapboxgl.Map({
      container: mapContainer.current,
      style: "mapbox://styles/mapbox/dark-v11",
      bounds: [[c.bbox_west, c.bbox_south], [c.bbox_east, c.bbox_north]],
      fitBoundsOptions: { padding: 40 },
    });
    m.addControl(new mapboxgl.NavigationControl(), "top-right");

    m.on("load", () => {
      // GeoJSON für alle Zone-Typen aufbauen
      const districts: GeoJSON.Feature[] = [];
      const spawns: GeoJSON.Feature[] = [];
      const gates: GeoJSON.Feature[] = [];
      const apexFeatures: GeoJSON.Feature[] = [];

      for (const z of snap.zones) {
        const coords = (z.polygon ?? []).map(([lat, lng]) => [lng, lat]);
        if (coords.length < 3) continue;
        // Polygon schließen
        if (coords[0][0] !== coords[coords.length - 1][0] || coords[0][1] !== coords[coords.length - 1][1]) {
          coords.push(coords[0]);
        }
        const owner = z.owner_crew_id ? snap.crews.find((cr) => cr.crew_id === z.owner_crew_id) : null;
        const feat: GeoJSON.Feature = {
          type: "Feature",
          id: z.id,
          properties: {
            id: z.id,
            name: z.name,
            zone_kind: z.zone_kind,
            ring: z.ring,
            owner_color: owner?.color_hex ?? "#444",
            owner_name: owner?.crews?.name ?? null,
            gate_state: z.gate_state,
            gate_kind: z.gate_kind,
            gate_phase: z.gate_phase,
          },
          geometry: { type: "Polygon", coordinates: [coords] },
        };
        if (z.zone_kind === "apex") apexFeatures.push(feat);
        else if (z.zone_kind === "gate") gates.push(feat);
        else if (z.zone_kind === "spawn") spawns.push(feat);
        else districts.push(feat);
      }

      // Sources
      m.addSource("districts", { type: "geojson", data: { type: "FeatureCollection", features: districts } });
      m.addSource("spawns",    { type: "geojson", data: { type: "FeatureCollection", features: spawns } });
      m.addSource("gates",     { type: "geojson", data: { type: "FeatureCollection", features: gates } });
      m.addSource("apex",      { type: "geojson", data: { type: "FeatureCollection", features: apexFeatures } });

      // Districts: gefüllt nach Owner-Farbe
      m.addLayer({
        id: "districts-fill", type: "fill", source: "districts",
        paint: {
          "fill-color": ["get", "owner_color"],
          "fill-opacity": 0.35,
        },
      });
      m.addLayer({
        id: "districts-line", type: "line", source: "districts",
        paint: { "line-color": "#888", "line-width": 1, "line-opacity": 0.6 },
      });

      // Spawns: stärker hervorgehoben
      m.addLayer({
        id: "spawns-fill", type: "fill", source: "spawns",
        paint: { "fill-color": ["get", "owner_color"], "fill-opacity": 0.6 },
      });
      m.addLayer({
        id: "spawns-line", type: "line", source: "spawns",
        paint: { "line-color": "#FFD700", "line-width": 3 },
      });

      // Gates: rot wenn closed, grün wenn open
      m.addLayer({
        id: "gates-fill", type: "fill", source: "gates",
        paint: {
          "fill-color": [
            "match", ["get", "gate_state"],
            "open", "#22c55e",
            "garrisoned", "#a855f7",
            "besieged", "#f59e0b",
            "#ef4444",  // default = closed
          ],
          "fill-opacity": 0.7,
        },
      });
      m.addLayer({
        id: "gates-line", type: "line", source: "gates",
        paint: { "line-color": "#fff", "line-width": 2, "line-dasharray": [2, 1] },
      });

      // Apex: gold
      m.addLayer({
        id: "apex-fill", type: "fill", source: "apex",
        paint: { "fill-color": "#FFD700", "fill-opacity": 0.5 },
      });
      m.addLayer({
        id: "apex-line", type: "line", source: "apex",
        paint: { "line-color": "#FF2D78", "line-width": 4 },
      });

      // Labels für alle Zonen
      const labels: GeoJSON.Feature[] = snap.zones.map((z) => ({
        type: "Feature",
        properties: { name: z.name, kind: z.zone_kind, ring: z.ring },
        geometry: { type: "Point", coordinates: [z.centroid_lng, z.centroid_lat] },
      }));
      m.addSource("labels", { type: "geojson", data: { type: "FeatureCollection", features: labels } });
      m.addLayer({
        id: "zone-labels", type: "symbol", source: "labels",
        layout: {
          "text-field": ["get", "name"],
          "text-size": 11,
          "text-anchor": "center",
          "text-allow-overlap": false,
        },
        paint: { "text-color": "#fff", "text-halo-color": "#000", "text-halo-width": 1.5 },
      });

      // Hauptgebäude + Repeater als Pins
      const buildings: GeoJSON.Feature[] = snap.buildings.filter((b) => !b.destroyed_at).map((b) => {
        const z = snap.zones.find((zz) => zz.id === b.zone_id);
        const owner = snap.crews.find((c) => c.crew_id === b.crew_id);
        return {
          type: "Feature",
          properties: {
            kind: b.building_kind,
            color: owner?.color_hex ?? "#fff",
            hp_pct: Math.round((b.hp / b.max_hp) * 100),
          },
          geometry: { type: "Point", coordinates: [Number(z?.centroid_lng ?? 0), Number(z?.centroid_lat ?? 0)] },
        };
      });
      m.addSource("buildings", { type: "geojson", data: { type: "FeatureCollection", features: buildings } });
      m.addLayer({
        id: "buildings-icon", type: "symbol", source: "buildings",
        layout: {
          "text-field": ["match", ["get", "kind"], "hauptgebaeude", "🏰", "📡"],
          "text-size": 22,
          "text-allow-overlap": true,
          "text-offset": [0, -1],
        },
      });

      // Marsch-Pfeile
      const marchLines: GeoJSON.Feature[] = [];
      for (const mr of snap.marches) {
        const o = snap.zones.find((z) => z.id === mr.origin_zone_id);
        const t = snap.zones.find((z) => z.id === mr.target_zone_id);
        if (!o || !t) continue;
        const owner = snap.crews.find((c) => c.crew_id === mr.crew_id);
        marchLines.push({
          type: "Feature",
          properties: {
            kind: mr.march_kind,
            color: owner?.color_hex ?? "#fff",
          },
          geometry: { type: "LineString", coordinates: [[Number(o.centroid_lng), Number(o.centroid_lat)], [Number(t.centroid_lng), Number(t.centroid_lat)]] },
        });
      }
      m.addSource("marches", { type: "geojson", data: { type: "FeatureCollection", features: marchLines } });
      m.addLayer({
        id: "marches-line", type: "line", source: "marches",
        paint: {
          "line-color": ["get", "color"],
          "line-width": 3,
          "line-dasharray": [2, 2],
          "line-opacity": 0.8,
        },
      });

      // Holy-Sites als pulsierende goldene Marker
      const holyFeatures: GeoJSON.Feature[] = snap.zones.filter((z) => z.is_holy_site).map((z) => ({
        type: "Feature",
        properties: { name: z.name, holder: snap.holy_holders?.find((h) => h.zone_id === z.id)?.crew_id ?? null },
        geometry: { type: "Point", coordinates: [Number(z.centroid_lng), Number(z.centroid_lat)] },
      }));
      m.addSource("holy", { type: "geojson", data: { type: "FeatureCollection", features: holyFeatures } });
      m.addLayer({
        id: "holy-icon", type: "symbol", source: "holy",
        layout: { "text-field": "🏛", "text-size": 28, "text-allow-overlap": true, "text-offset": [0, 1.2] },
      });

      // Gather-Tiles als blaue RSS-Marker
      const gatherFeatures: GeoJSON.Feature[] = snap.zones.filter((z) => z.is_gather_tile).map((z) => ({
        type: "Feature",
        properties: { name: z.name, kind: z.gather_kind, remaining: z.gather_remaining },
        geometry: { type: "Point", coordinates: [Number(z.centroid_lng), Number(z.centroid_lat)] },
      }));
      m.addSource("gather", { type: "geojson", data: { type: "FeatureCollection", features: gatherFeatures } });
      m.addLayer({
        id: "gather-icon", type: "symbol", source: "gather",
        layout: { "text-field": "📦", "text-size": 22, "text-allow-overlap": true, "text-offset": [-1.5, 0] },
      });

      // Mega-Camps als Drachen-Marker
      const megaFeatures: GeoJSON.Feature[] = (snap.mega_camps ?? []).map((mc) => {
        const z = snap.zones.find((zz) => zz.id === mc.zone_id);
        return {
          type: "Feature",
          properties: { id: mc.id, hp_pct: Math.round((mc.hp_remaining / mc.hp_total) * 100) },
          geometry: { type: "Point", coordinates: [Number(z?.centroid_lng ?? 0), Number(z?.centroid_lat ?? 0)] },
        };
      });
      m.addSource("megas", { type: "geojson", data: { type: "FeatureCollection", features: megaFeatures } });
      m.addLayer({
        id: "megas-icon", type: "symbol", source: "megas",
        layout: { "text-field": ["concat", "🐉 ", ["get", "hp_pct"], "%"], "text-size": 16, "text-allow-overlap": true, "text-offset": [0, 1.5] },
        paint: { "text-color": "#FF2D78", "text-halo-color": "#000", "text-halo-width": 2 },
      });

      // User-Field-Positions (User die mit Truppen draußen stehen)
      const posFeatures: GeoJSON.Feature[] = (snap.user_positions ?? [])
        .filter((p) => (p.field_inf + p.field_cav + p.field_mark + p.field_werk) > 0)
        .map((p) => {
          const z = snap.zones.find((zz) => zz.id === p.current_zone_id);
          return {
            type: "Feature",
            properties: { user_id: p.user_id, total: p.field_inf + p.field_cav + p.field_mark + p.field_werk },
            geometry: { type: "Point", coordinates: [Number(z?.centroid_lng ?? 0), Number(z?.centroid_lat ?? 0)] },
          };
        });
      m.addSource("positions", { type: "geojson", data: { type: "FeatureCollection", features: posFeatures } });
      m.addLayer({
        id: "positions-icon", type: "symbol", source: "positions",
        layout: { "text-field": ["concat", "🪖 ", ["get", "total"]], "text-size": 12, "text-allow-overlap": true, "text-offset": [1.2, 0.8] },
        paint: { "text-color": "#22D1C3", "text-halo-color": "#000", "text-halo-width": 1.5 },
      });

      // Click-Handler: Zone selektieren
      const handleClick = (e: mapboxgl.MapMouseEvent & { features?: mapboxgl.MapboxGeoJSONFeature[] }) => {
        if (!e.features?.length) return;
        const id = e.features[0].properties?.id;
        if (!id) return;
        const z = snap.zones.find((zz) => zz.id === id);
        if (z) setSelZone(z);
      };
      m.on("click", "districts-fill", handleClick);
      m.on("click", "spawns-fill", handleClick);
      m.on("click", "gates-fill", handleClick);
      m.on("click", "apex-fill", handleClick);

      ["districts-fill", "spawns-fill", "gates-fill", "apex-fill"].forEach((layer) => {
        m.on("mouseenter", layer, () => { m.getCanvas().style.cursor = "pointer"; });
        m.on("mouseleave", layer, () => { m.getCanvas().style.cursor = ""; });
      });
    });

    mapRef.current = m;
    return () => { m.remove(); mapRef.current = null; };
  }, [snap]);

  // Layer-Toggle
  useEffect(() => {
    const m = mapRef.current;
    if (!m || !m.loaded()) return;
    const setVis = (id: string, on: boolean) => {
      if (m.getLayer(id)) m.setLayoutProperty(id, "visibility", on ? "visible" : "none");
    };
    setVis("districts-fill", showLayers.districts);
    setVis("districts-line", showLayers.districts);
    setVis("spawns-fill", showLayers.spawns);
    setVis("spawns-line", showLayers.spawns);
    setVis("gates-fill", showLayers.gates);
    setVis("gates-line", showLayers.gates);
    setVis("apex-fill", showLayers.apex);
    setVis("apex-line", showLayers.apex);
    setVis("buildings-icon", showLayers.buildings);
    setVis("marches-line", showLayers.marches);
    setVis("holy-icon", showLayers.holy);
    setVis("gather-icon", showLayers.gather);
    setVis("megas-icon", showLayers.megas);
    setVis("positions-icon", showLayers.positions);
    setVis("zone-labels", showLayers.labels);
  }, [showLayers]);

  async function adminAction(payload: Record<string, unknown>): Promise<boolean> {
    setBusy(true);
    try {
      const r = await fetch("/api/admin/saga/bracket-detail", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ bracket_id: bracketId, ...payload }),
      });
      const j = await r.json();
      if (!j.ok) { alert("Fehler: " + j.error); return false; }
      await load();
      return true;
    } finally { setBusy(false); }
  }

  if (loading) return <div className="text-text-muted">Lade Bracket-Daten …</div>;
  if (!snap) return <div className="text-accent">Bracket nicht gefunden.</div>;
  if (!snap.zones || snap.zones.length === 0) {
    return (
      <div className="bg-accent/10 border border-accent/40 rounded-xl p-5">
        <div className="text-accent font-bold mb-2">⚠ Keine Zonen vorhanden</div>
        <div className="text-text-muted text-sm">
          Diese Bracket-Map wurde noch nicht generiert. Klick im Admin auf „🗺 Map gen." um die Zonen aus OSM zu holen.
        </div>
      </div>
    );
  }

  const zonesByKind = {
    district: snap.zones.filter((z) => z.zone_kind === "district"),
    spawn:    snap.zones.filter((z) => z.zone_kind === "spawn"),
    gate:     snap.zones.filter((z) => z.zone_kind === "gate"),
    apex:     snap.zones.filter((z) => z.zone_kind === "apex"),
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-4">
      {/* Map */}
      <div className="bg-white/[0.02] border border-white/10 rounded-xl overflow-hidden">
        <div ref={mapContainer} className="w-full h-[700px]" />
        {!MAPBOX_TOKEN && (
          <div className="p-4 text-center text-accent">⚠ NEXT_PUBLIC_MAPBOX_TOKEN fehlt in der Env.</div>
        )}
      </div>

      {/* Sidebar */}
      <div className="space-y-3">
        {/* Header */}
        <Section title={snap.city?.name ?? snap.bracket.city_slug}>
          <div className="text-xs text-text-muted">Status: <span className="text-primary font-bold">{snap.bracket.status}</span></div>
          <div className="text-xs text-text-muted">Phase: <span className="text-xp font-bold">{snap.bracket.current_phase}/4</span></div>
          <div className="text-xs text-text-muted">Größen-Tier: {snap.bracket.size_tier}</div>
          <div className="text-xs text-text-muted">Apex: {snap.city?.apex_emoji} {snap.city?.apex_name}</div>
        </Section>

        {/* Zonen-Statistik */}
        <Section title="Zonen-Counts">
          <div className="grid grid-cols-2 gap-1 text-xs">
            <Stat label="🏘 Districts" v={zonesByKind.district.length} />
            <Stat label="🏠 Spawns"    v={zonesByKind.spawn.length} />
            <Stat label="🌉 Gates"     v={zonesByKind.gate.length} />
            <Stat label="🏛 Apex"      v={zonesByKind.apex.length} />
            <Stat label="🏗 Gebäude"   v={snap.buildings.filter((b) => !b.destroyed_at).length} />
            <Stat label="⚔ Märsche"   v={snap.marches.length} />
          </div>
        </Section>

        {/* Crews */}
        <Section title={`Crews (${snap.crews.length})`}>
          <div className="space-y-1">
            {snap.crews.map((c) => (
              <div key={c.crew_id} className="flex items-center gap-2 text-xs bg-white/5 rounded px-2 py-1">
                <span className="w-3 h-3 rounded-full" style={{ background: c.color_hex }} />
                <div className="flex-1 min-w-0">
                  <div className="text-white font-bold truncate">{c.crews?.name ?? c.crew_id.slice(0, 8)}</div>
                  <div className="text-[10px] text-text-muted">
                    {c.zones_held} Z · {c.buildings_count} G · {c.merits} V
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Section>

        {/* Layer-Toggles */}
        <Section title="Layer">
          {Object.entries(showLayers).map(([k, v]) => (
            <label key={k} className="flex items-center gap-2 text-xs text-text-muted py-0.5">
              <input type="checkbox" checked={v} onChange={(e) => setShowLayers((s) => ({ ...s, [k]: e.target.checked }))} />
              <span>{k}</span>
            </label>
          ))}
        </Section>

        {/* Active Mega-Camps */}
        {snap.mega_camps.length > 0 && (
          <Section title={`Mega-Wegelager (${snap.mega_camps.length})`}>
            {snap.mega_camps.map((mc) => (
              <div key={mc.id} className="text-xs bg-white/5 rounded p-2 mb-1">
                <div className="text-accent font-bold">🐉 {mc.hp_remaining.toLocaleString()}/{mc.hp_total.toLocaleString()} HP</div>
                <div className="text-[10px] text-text-muted">expires {fmt(mc.expires_at)}</div>
              </div>
            ))}
          </Section>
        )}

        {/* Recent Battles */}
        {snap.recent_battles.length > 0 && (
          <Section title={`Letzte Kämpfe (${snap.recent_battles.length})`}>
            <div className="space-y-1 max-h-48 overflow-y-auto">
              {snap.recent_battles.slice(0, 10).map((b) => (
                <div key={b.id} className="text-[10px] bg-white/5 rounded p-1.5">
                  <div className="font-bold" style={{ color: b.outcome === "attacker_won" ? "#4ade80" : "#ef4444" }}>{b.outcome}</div>
                  <div className="text-text-muted">{fmt(b.created_at)}</div>
                </div>
              ))}
            </div>
          </Section>
        )}
      </div>

      {/* Zone-Detail-Modal */}
      {selZone && (
        <ZoneDetailModal
          zone={selZone} crews={snap.crews}
          buildings={snap.buildings.filter((b) => b.zone_id === selZone.id && !b.destroyed_at)}
          onClose={() => setSelZone(null)}
          onAction={adminAction} busy={busy}
          bracketId={bracketId}
        />
      )}
    </div>
  );
}

function ZoneDetailModal({ zone, crews, buildings, onClose, onAction, busy, bracketId }: {
  zone: Zone; crews: Crew[]; buildings: Building[];
  onClose: () => void;
  onAction: (p: Record<string, unknown>) => Promise<boolean>;
  busy: boolean; bracketId: string;
}) {
  const owner = crews.find((c) => c.crew_id === zone.owner_crew_id);

  return (
    <div className="fixed inset-0 z-9999 bg-black/70 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-[#1A1D23] border border-white/10 rounded-xl p-5 max-w-md w-full" onClick={(e) => e.stopPropagation()}>
        <div className="flex justify-between items-start mb-3">
          <div>
            <div className="text-[10px] uppercase text-text-muted">{zone.zone_kind} · Ring {zone.ring}</div>
            <div className="text-white font-bold text-lg">{zone.name}</div>
            <div className="text-[10px] text-text-muted font-mono">{zone.id}</div>
          </div>
          <button onClick={onClose} className="text-text-muted text-xl">✕</button>
        </div>

        <div className="space-y-2 text-xs">
          <Row label="OSM-ID" v={zone.osm_id ?? "—"} />
          <Row label="Centroid" v={`${Number(zone.centroid_lat).toFixed(5)}, ${Number(zone.centroid_lng).toFixed(5)}`} />
          <Row label="Polygon-Punkte" v={zone.polygon?.length ?? 0} />
          <Row label="Owner" v={owner ? <><span className="inline-block w-2 h-2 rounded-full mr-1" style={{ background: owner.color_hex }} />{owner.crews?.name ?? owner.crew_id.slice(0, 8)}</> : "—"} />
          <Row label="Resource" v={zone.resource_kind ? `+${zone.resource_bonus_pct}% ${zone.resource_kind}` : "—"} />
          {zone.zone_kind === "gate" && (
            <>
              <Row label="Gate-Kind" v={zone.gate_kind ?? "—"} />
              <Row label="Gate-Phase" v={zone.gate_phase ?? "—"} />
              <Row label="Gate-State" v={<span style={{ color: zone.gate_state === "open" ? "#4ade80" : "#ef4444" }}>{zone.gate_state}</span>} />
            </>
          )}
        </div>

        {/* Buildings in der Zone */}
        {buildings.length > 0 && (
          <div className="mt-3">
            <div className="text-[10px] uppercase text-text-muted mb-1">Gebäude</div>
            {buildings.map((b) => (
              <div key={b.id} className="bg-white/5 rounded p-2 text-xs flex items-center justify-between">
                <div>
                  {b.building_kind === "hauptgebaeude" ? "🏰 Hauptgebäude" : "📡 Repeater"}
                  <span className="text-text-muted ml-2">{b.hp}/{b.max_hp} HP</span>
                </div>
                <button onClick={() => onAction({ action: "force_destroy_building", building_id: b.id })}
                  disabled={busy} className="px-2 py-0.5 rounded bg-accent text-white text-[10px] font-bold">💥 Zerstören</button>
              </div>
            ))}
          </div>
        )}

        {/* Admin-Test-Aktionen */}
        <div className="mt-4 pt-3 border-t border-white/10">
          <div className="text-[10px] uppercase text-text-muted mb-2">⚙ Admin-Test-Aktionen</div>
          <div className="flex flex-wrap gap-2">
            {zone.zone_kind === "gate" && zone.gate_state === "closed" && (
              <button onClick={async () => { if (await onAction({ action: "force_open_gate", zone_id: zone.id })) onClose(); }}
                disabled={busy} className="px-3 py-1.5 rounded bg-green-600 text-white text-xs font-bold">🔓 Tor öffnen</button>
            )}
            {zone.zone_kind === "gate" && zone.gate_state === "open" && (
              <button onClick={async () => { if (await onAction({ action: "force_close_gate", zone_id: zone.id })) onClose(); }}
                disabled={busy} className="px-3 py-1.5 rounded bg-red-600 text-white text-xs font-bold">🔒 Tor schließen</button>
            )}
            {(zone.zone_kind === "district" || zone.zone_kind === "apex") && (
              <>
                <button onClick={async () => { if (await onAction({ action: "force_claim_zone", zone_id: zone.id, crew_id: null })) onClose(); }}
                  disabled={busy} className="px-3 py-1.5 rounded bg-white/10 text-white text-xs font-bold">↺ Zone-Owner clear</button>
                <button onClick={async () => { if (await onAction({ action: "spawn_mega", zone_id: zone.id, hp: 100000 })) onClose(); }}
                  disabled={busy} className="px-3 py-1.5 rounded bg-accent text-white text-xs font-bold">🐉 Mega-Boss spawnen</button>
                <button onClick={async () => { if (await onAction({ action: "toggle_holy_site", zone_id: zone.id, is_holy_site: !zone.is_holy_site, holy_buff_kind: "troop_atk", holy_buff_pct: 5 })) onClose(); }}
                  disabled={busy} className="px-3 py-1.5 rounded bg-xp text-bg-deep text-xs font-bold">🏛 {zone.is_holy_site ? "Holy entfernen" : "Als Holy markieren"}</button>
                <button onClick={async () => { if (await onAction({ action: "toggle_gather_tile", zone_id: zone.id, is_gather_tile: !zone.is_gather_tile, gather_kind: "tech_schrott", gather_yield_per_hour: 100, gather_capacity: 10000 })) onClose(); }}
                  disabled={busy} className="px-3 py-1.5 rounded bg-blue-500 text-white text-xs font-bold">📦 {zone.is_gather_tile ? "Gather entfernen" : "Als Gather markieren"}</button>
              </>
            )}
            {/* Force-Claim per Crew */}
            {(zone.zone_kind === "district" || zone.zone_kind === "apex") && crews.length > 0 && (
              <details className="w-full">
                <summary className="text-xs text-primary cursor-pointer">⚙ Crew zuweisen</summary>
                <div className="mt-2 space-y-1">
                  {crews.map((c) => (
                    <button key={c.crew_id}
                      onClick={async () => { if (await onAction({ action: "force_claim_zone", zone_id: zone.id, crew_id: c.crew_id })) onClose(); }}
                      disabled={busy}
                      className="w-full text-left px-2 py-1 rounded bg-white/5 text-xs flex items-center gap-2">
                      <span className="w-3 h-3 rounded-full" style={{ background: c.color_hex }} />
                      <span>{c.crews?.name ?? c.crew_id.slice(0, 8)}</span>
                    </button>
                  ))}
                </div>
              </details>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white/[0.02] border border-white/10 rounded-xl p-3">
      <div className="text-[10px] uppercase tracking-wider text-text-muted font-bold mb-1">{title}</div>
      {children}
    </div>
  );
}
function Stat({ label, v }: { label: string; v: number | string }) {
  return (
    <div className="bg-white/5 rounded p-1.5">
      <div className="text-[9px] text-text-muted">{label}</div>
      <div className="text-white font-bold text-sm">{v}</div>
    </div>
  );
}
function Row({ label, v }: { label: string; v: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-text-muted">{label}</span>
      <span className="text-white">{v}</span>
    </div>
  );
}
function fmt(iso: string) {
  return new Date(iso).toLocaleString("de-DE", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
}
