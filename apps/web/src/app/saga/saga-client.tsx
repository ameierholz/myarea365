"use client";

import { useEffect, useRef, useState, useMemo, useCallback } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";

const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN || "";
mapboxgl.accessToken = MAPBOX_TOKEN;

// ────── Types ──────
type Round = {
  id: string; name: string; status: string;
  signup_starts: string; signup_ends: string; auftakt_ends: string;
  main_ends: string; awards_ends: string;
};
type Bracket = { id: string; city_slug: string; status: string; current_phase: number; crew_count: number };
type Zone = {
  id: string; name: string; zone_kind: "district" | "spawn" | "apex" | "gate";
  ring: number; centroid_lat: number; centroid_lng: number; polygon: number[][];
  owner_crew_id: string | null;
  gate_kind: string | null; gate_phase: number | null; gate_state: string | null;
  resource_bonus_pct: number; resource_kind: string | null;
  is_holy_site: boolean; holy_buff_kind: string | null; holy_buff_pct: number;
  is_gather_tile: boolean; gather_yield_per_hour: number; gather_kind: string | null; gather_remaining: number;
};
type March = {
  id: string; crew_id: string; user_id: string;
  origin_zone_id: string; target_zone_id: string; target_user_id: string | null;
  march_kind: string;
  inf: number; cav: number; mark: number; werk: number; guardian_id: string | null;
  started_at: string; arrives_at: string; status: string;
};
type BracketCrew = {
  crew_id: string; color_hex: string; spawn_zone_id: string | null;
  zones_held: number; buildings_count: number; merits: number; final_rank: number | null;
  crews?: { name: string | null; slug: string | null } | null;
};
type City = {
  name: string; apex_name: string; apex_lat: number; apex_lng: number; apex_emoji: string;
  bbox_south: number; bbox_west: number; bbox_north: number; bbox_east: number;
};
type UserState = {
  bracket_id: string; march_slots_total: number; march_slots_used: number;
  saga_slot_inf: number; saga_slot_cav: number; saga_slot_mark: number; saga_slot_werk: number;
  action_points: number; action_points_max: number;
  pvp_attacks_today: number; pvp_attacks_max: number;
};
type UserPosition = {
  user_id: string; current_zone_id: string;
  field_inf: number; field_cav: number; field_mark: number; field_werk: number;
  field_guardian_id: string | null;
};
type Building = {
  id: string; zone_id: string; crew_id: string;
  building_kind: "repeater" | "hauptgebaeude";
  hp: number; max_hp: number; built_at: string;
};
type Battle = {
  id: string; zone_id: string; battle_kind: string;
  attacker_crew_id: string; attacker_user_id: string | null;
  defender_crew_id: string | null; defender_user_id: string | null;
  outcome: string; created_at: string;
  attacker_inf: number; attacker_cav: number; attacker_mark: number; attacker_werk: number;
  defender_inf: number; defender_cav: number; defender_mark: number; defender_werk: number;
  attacker_losses_dead: number; attacker_losses_wounded: number;
  defender_losses_dead: number; defender_losses_wounded: number;
  viewed_by_attacker: boolean;
};
type Augur = {
  id: string; bracket_id: string; crew_id: string | null; milestone_kind: string;
  reward_gems: number; reward_keys: number; reward_speedups: number; achieved_at: string;
};
type Snap = {
  active_round: Round | null; signup_open: boolean; my_crew_signed_up: boolean;
  my_crew_id: string | null; my_role: string | null;
  my_bracket: Bracket | null;
  zones: Zone[] | null; marches: March[] | null;
  my_state: UserState | null; bracket_crews: BracketCrew[] | null; city: City | null;
  my_position: UserPosition | null; buildings: Building[] | null;
  my_inventory: Array<{ item_kind: string; qty: number }> | null;
  my_merits: { merits: number; merits_spent: number } | null;
  my_resources: { tech_schrott: number; komponenten: number; krypto: number; bandbreite: number } | null;
  active_buffs: Array<{ buff_kind: string; multiplier: number; expires_at: string }> | null;
  my_shield: { expires_at: string } | null;
  my_lazarett: { inf: number; cav: number; mark: number; werk: number } | null;
  pending_attacks: Array<{ march_id: string; attacker_crew_id: string; target_zone_name: string; arrives_at: string }> | null;
  recent_battles: Battle[] | null;
  augur_milestones: Augur[] | null;
  active_rallies: Array<{ id: string; crew_id: string; leader_user_id: string; target_zone_id: string; joinable_until: string; participant_count: number; status: string }> | null;
  active_megas: Array<{ id: string; zone_id: string; hp_remaining: number; hp_total: number; expires_at: string }> | null;
  active_diplomacy: Array<{ id: string; crew_a: string; crew_b: string; pact_kind: string; status: string; expires_at: string | null; proposed_by: string | null }> | null;
  user_positions: Array<UserPosition> | null;
  all_brackets: Bracket[];
};

type ActionMenuChoice = "verlegen" | "marsch_angriff" | "einsetzen" | "verstärken" | "sammeln" | "rally" | "build_repeater" | "build_mega" | "verstecken";

export function SagaClient() {
  const [snap, setSnap] = useState<Snap | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const mapContainer = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);

  const [tapMenu, setTapMenu] = useState<{ zone: Zone; lngLat: [number, number] } | null>(null);
  const [legionModal, setLegionModal] = useState<{ kind: ActionMenuChoice; zone: Zone } | null>(null);
  const [multiModal, setMultiModal] = useState<{ zone: Zone } | null>(null);
  const [battleModal, setBattleModal] = useState<Battle | null>(null);
  const [marchPopup, setMarchPopup] = useState<March | null>(null);
  const [dragMarch, setDragMarch] = useState<{ id: string; from: [number, number]; to: [number, number] } | null>(null);

  // ────── Load + WebSocket-style refresh ──────
  const load = useCallback(async () => {
    try {
      const r = await fetch("/api/saga", { cache: "no-store" });
      const j = await r.json();
      setSnap(j);
    } catch { setErr("Konnte Saga-Daten nicht laden."); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { void load(); }, [load]);

  // Auto-Refresh alle 15s
  useEffect(() => {
    if (!snap?.my_bracket) return;
    const t = setInterval(load, 15000);
    return () => clearInterval(t);
  }, [snap?.my_bracket, load]);

  // ────── Map-Init ──────
  useEffect(() => {
    if (!snap?.my_bracket || !snap.city || !snap.zones || !mapContainer.current || mapRef.current) return;
    if (!MAPBOX_TOKEN) return;

    const c = snap.city;
    const m = new mapboxgl.Map({
      container: mapContainer.current,
      style: "mapbox://styles/mapbox/dark-v11",
      bounds: [[c.bbox_west, c.bbox_south], [c.bbox_east, c.bbox_north]],
      fitBoundsOptions: { padding: 30 },
    });
    m.addControl(new mapboxgl.NavigationControl(), "top-right");

    m.on("load", () => {
      // Polygone aller Zonen
      const features: GeoJSON.Feature[] = [];
      for (const z of snap.zones!) {
        const coords = (z.polygon ?? []).map(([lat, lng]) => [lng, lat]);
        if (coords.length < 3) continue;
        if (coords[0][0] !== coords[coords.length - 1][0] || coords[0][1] !== coords[coords.length - 1][1]) coords.push(coords[0]);
        const owner = z.owner_crew_id ? snap.bracket_crews?.find((cr) => cr.crew_id === z.owner_crew_id) : null;
        features.push({
          type: "Feature", id: z.id,
          properties: {
            id: z.id, name: z.name, kind: z.zone_kind, ring: z.ring,
            owner_color: owner?.color_hex ?? "#444",
            gate_state: z.gate_state, is_holy: z.is_holy_site, is_gather: z.is_gather_tile,
            is_mine: z.owner_crew_id === snap.my_crew_id,
          },
          geometry: { type: "Polygon", coordinates: [coords] },
        });
      }

      m.addSource("zones", { type: "geojson", data: { type: "FeatureCollection", features } });

      // Layer-Stack
      m.addLayer({
        id: "zones-fill", type: "fill", source: "zones",
        paint: {
          "fill-color": [
            "case",
            ["==", ["get", "kind"], "apex"], "#FFD700",
            ["==", ["get", "kind"], "gate"],
              ["match", ["get", "gate_state"], "open", "#22c55e", "garrisoned", "#a855f7", "besieged", "#f59e0b", "#ef4444"],
            ["==", ["get", "is_holy"], true], "#FFD700",
            ["==", ["get", "is_gather"], true], "#5DDAF0",
            ["get", "owner_color"],
          ],
          "fill-opacity": ["case", ["==", ["get", "is_mine"], true], 0.55, 0.3],
        },
      });
      m.addLayer({
        id: "zones-line", type: "line", source: "zones",
        paint: {
          "line-color": [
            "case",
            ["==", ["get", "kind"], "spawn"], "#FFD700",
            ["==", ["get", "kind"], "apex"], "#FF2D78",
            ["==", ["get", "kind"], "gate"], "#fff",
            "#888",
          ],
          "line-width": ["case", ["==", ["get", "kind"], "spawn"], 3, ["==", ["get", "kind"], "apex"], 4, 1],
          "line-dasharray": ["case", ["==", ["get", "kind"], "gate"], ["literal", [2, 1]], ["literal", [1]]],
        },
      });

      // Labels
      m.addSource("labels", {
        type: "geojson",
        data: {
          type: "FeatureCollection",
          features: snap.zones!.map((z) => ({
            type: "Feature",
            properties: { name: z.name, kind: z.zone_kind, holy: z.is_holy_site ? "🏛 " : "", gather: z.is_gather_tile ? "📦 " : "" },
            geometry: { type: "Point", coordinates: [Number(z.centroid_lng), Number(z.centroid_lat)] },
          })),
        },
      });
      m.addLayer({
        id: "zone-labels", type: "symbol", source: "labels",
        layout: {
          "text-field": ["concat", ["get", "holy"], ["get", "gather"], ["get", "name"]],
          "text-size": 11, "text-allow-overlap": false,
        },
        paint: { "text-color": "#fff", "text-halo-color": "#000", "text-halo-width": 1.5 },
      });

      // Buildings als Pins
      const bld: GeoJSON.Feature[] = (snap.buildings ?? []).map((b) => {
        const z = snap.zones!.find((zz) => zz.id === b.zone_id);
        const c = snap.bracket_crews?.find((cr) => cr.crew_id === b.crew_id);
        return {
          type: "Feature", properties: { kind: b.building_kind, color: c?.color_hex ?? "#fff", id: b.id },
          geometry: { type: "Point", coordinates: [Number(z?.centroid_lng ?? 0), Number(z?.centroid_lat ?? 0)] },
        };
      });
      m.addSource("buildings", { type: "geojson", data: { type: "FeatureCollection", features: bld } });
      m.addLayer({
        id: "buildings-icon", type: "symbol", source: "buildings",
        layout: {
          "text-field": ["match", ["get", "kind"], "hauptgebaeude", "🏰", "📡"],
          "text-size": 22, "text-allow-overlap": true, "text-offset": [0, -1],
        },
      });

      // Marsch-Animierte Pfeile
      const marchFeatures: GeoJSON.Feature[] = (snap.marches ?? []).map((mr) => {
        const o = snap.zones!.find((z) => z.id === mr.origin_zone_id);
        const t = snap.zones!.find((z) => z.id === mr.target_zone_id);
        if (!o || !t) return null;
        const owner = snap.bracket_crews?.find((c) => c.crew_id === mr.crew_id);
        const isOwn = mr.crew_id === snap.my_crew_id;
        const total = mr.inf + mr.cav + mr.mark + mr.werk;
        return {
          type: "Feature",
          properties: {
            id: mr.id, kind: mr.march_kind,
            color: owner?.color_hex ?? "#fff",
            is_own: isOwn,
            label: isOwn ? `${total}` : "?",
          },
          geometry: { type: "LineString", coordinates: [[Number(o.centroid_lng), Number(o.centroid_lat)], [Number(t.centroid_lng), Number(t.centroid_lat)]] },
        };
      }).filter(Boolean) as GeoJSON.Feature[];
      m.addSource("marches", { type: "geojson", data: { type: "FeatureCollection", features: marchFeatures } });
      m.addLayer({
        id: "marches-line", type: "line", source: "marches",
        paint: {
          "line-color": ["get", "color"], "line-width": 3,
          "line-dasharray": [2, 2], "line-opacity": 0.8,
        },
      });

      // Marching troops als Punkte (Mitte des Pfeils, animiert)
      const troopPoints: GeoJSON.Feature[] = (snap.marches ?? []).map((mr) => {
        const o = snap.zones!.find((z) => z.id === mr.origin_zone_id);
        const t = snap.zones!.find((z) => z.id === mr.target_zone_id);
        if (!o || !t) return null;
        const isOwn = mr.crew_id === snap.my_crew_id;
        const total = mr.inf + mr.cav + mr.mark + mr.werk;
        const owner = snap.bracket_crews?.find((c) => c.crew_id === mr.crew_id);
        const startMs = new Date(mr.started_at).getTime();
        const endMs = new Date(mr.arrives_at).getTime();
        const nowMs = Date.now();
        const t01 = endMs > startMs ? Math.max(0, Math.min(1, (nowMs - startMs) / (endMs - startMs))) : 0;
        const lng = Number(o.centroid_lng) + (Number(t.centroid_lng) - Number(o.centroid_lng)) * t01;
        const lat = Number(o.centroid_lat) + (Number(t.centroid_lat) - Number(o.centroid_lat)) * t01;
        return {
          type: "Feature",
          properties: { id: mr.id, label: isOwn ? `${total}` : "?", color: owner?.color_hex ?? "#fff" },
          geometry: { type: "Point", coordinates: [lng, lat] },
        };
      }).filter(Boolean) as GeoJSON.Feature[];
      m.addSource("troops", { type: "geojson", data: { type: "FeatureCollection", features: troopPoints } });
      m.addLayer({
        id: "troops-circle", type: "circle", source: "troops",
        paint: {
          "circle-radius": 12,
          "circle-color": ["get", "color"],
          "circle-stroke-width": 2,
          "circle-stroke-color": "#000",
        },
      });
      m.addLayer({
        id: "troops-label", type: "symbol", source: "troops",
        layout: { "text-field": ["get", "label"], "text-size": 10, "text-allow-overlap": true },
        paint: { "text-color": "#fff", "text-halo-color": "#000", "text-halo-width": 1 },
      });

      // Click auf Zone → TapMenu
      const handleZoneClick = (e: mapboxgl.MapMouseEvent & { features?: mapboxgl.MapboxGeoJSONFeature[] }) => {
        if (!e.features?.length) return;
        const id = e.features[0].properties?.id;
        const z = snap.zones?.find((zz) => zz.id === id);
        if (z) setTapMenu({ zone: z, lngLat: [e.lngLat.lng, e.lngLat.lat] });
      };
      m.on("click", "zones-fill", handleZoneClick);

      // Click auf March-Punkt → März-Popup
      const handleMarchClick = (e: mapboxgl.MapMouseEvent & { features?: mapboxgl.MapboxGeoJSONFeature[] }) => {
        if (!e.features?.length) return;
        const id = e.features[0].properties?.id;
        const mr = snap.marches?.find((mm) => mm.id === id);
        if (mr) setMarchPopup(mr);
      };
      m.on("click", "troops-circle", handleMarchClick);

      // Cursor
      ["zones-fill", "troops-circle", "buildings-icon"].forEach((layer) => {
        m.on("mouseenter", layer, () => { m.getCanvas().style.cursor = "pointer"; });
        m.on("mouseleave", layer, () => { m.getCanvas().style.cursor = ""; });
      });
    });

    mapRef.current = m;
    return () => { m.remove(); mapRef.current = null; };
  }, [snap]);

  // Animations-Update für Truppen-Position alle 1s
  useEffect(() => {
    if (!snap?.marches || !mapRef.current?.loaded()) return;
    const interval = setInterval(() => {
      const m = mapRef.current;
      if (!m || !m.getSource("troops")) return;
      const features: GeoJSON.Feature[] = snap.marches!.map((mr) => {
        const o = snap.zones!.find((z) => z.id === mr.origin_zone_id);
        const t = snap.zones!.find((z) => z.id === mr.target_zone_id);
        if (!o || !t) return null;
        const isOwn = mr.crew_id === snap.my_crew_id;
        const total = mr.inf + mr.cav + mr.mark + mr.werk;
        const owner = snap.bracket_crews?.find((c) => c.crew_id === mr.crew_id);
        const startMs = new Date(mr.started_at).getTime();
        const endMs = new Date(mr.arrives_at).getTime();
        const nowMs = Date.now();
        const t01 = endMs > startMs ? Math.max(0, Math.min(1, (nowMs - startMs) / (endMs - startMs))) : 0;
        const lng = Number(o.centroid_lng) + (Number(t.centroid_lng) - Number(o.centroid_lng)) * t01;
        const lat = Number(o.centroid_lat) + (Number(t.centroid_lat) - Number(o.centroid_lat)) * t01;
        return {
          type: "Feature",
          properties: { id: mr.id, label: isOwn ? `${total}` : "?", color: owner?.color_hex ?? "#fff" },
          geometry: { type: "Point", coordinates: [lng, lat] },
        };
      }).filter(Boolean) as GeoJSON.Feature[];
      (m.getSource("troops") as mapboxgl.GeoJSONSource).setData({ type: "FeatureCollection", features });
    }, 1000);
    return () => clearInterval(interval);
  }, [snap?.marches, snap?.zones, snap?.bracket_crews, snap?.my_crew_id]);

  // ────── Action Helper ──────
  async function doAction(payload: Record<string, unknown>): Promise<boolean> {
    setBusy(true); setErr(null);
    try {
      const r = await fetch("/api/saga", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      const j = await r.json();
      if (r.status === 401) { setErr("Bitte einloggen."); return false; }
      if (!j.ok) { setErr(`Fehler: ${j.message ?? j.error ?? "unbekannt"}`); return false; }
      await load();
      return true;
    } finally { setBusy(false); }
  }

  // ────── Renderer ──────
  if (loading) return <div className="text-text-muted text-sm py-10 text-center">Lade …</div>;
  if (!snap?.active_round) return <NoRound />;

  // Signup-Block
  if (snap.signup_open && !snap.my_bracket) {
    return <SignupView snap={snap} doAction={doAction} busy={busy} err={err} />;
  }

  if (!snap.my_bracket) return <BracketsView snap={snap} />;

  const myCrew = snap.bracket_crews?.find((c) => c.crew_id === snap.my_crew_id);
  const r = snap.active_round;
  const phase = phaseInfo(r);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-3">
      {/* Map + Header */}
      <div className="space-y-3">
        <div className="bg-linear-to-br from-[#1A1D23] to-bg-deep border border-white/10 rounded-2xl p-4">
          <div className="flex justify-between items-center mb-2 flex-wrap gap-2">
            <div>
              <div className="text-[10px] uppercase tracking-wider text-text-muted">{phase.label}</div>
              <div className="text-xl font-black text-white">{snap.city?.name}</div>
              <div className="text-[10px] text-text-muted">{snap.city?.apex_emoji} Apex: {snap.city?.apex_name} · Phase {snap.my_bracket.current_phase}/4</div>
            </div>
            <div className="text-right">
              <div className="text-[10px] uppercase tracking-wider text-text-muted">{phase.timeLabel}</div>
              <div className="text-base font-bold text-primary">{phase.timeValue}</div>
            </div>
          </div>
        </div>

        {err && <div className="px-3 py-2 rounded bg-accent/15 border border-accent/40 text-accent text-xs font-bold">{err}</div>}

        {/* Mapbox */}
        <div className="bg-white/2 border border-white/10 rounded-2xl overflow-hidden">
          <div ref={mapContainer} className="w-full h-[600px]" />
          {!MAPBOX_TOKEN && (
            <div className="p-4 text-center text-accent">⚠ NEXT_PUBLIC_MAPBOX_TOKEN fehlt</div>
          )}
        </div>

        {/* Pending-Attacks-Banner */}
        {snap.pending_attacks && snap.pending_attacks.length > 0 && (
          <PendingAttacksBanner pending={snap.pending_attacks} myCrewId={snap.my_crew_id} bracketCrews={snap.bracket_crews ?? []} />
        )}
      </div>

      {/* Sidebar */}
      <div className="space-y-3">
        {myCrew && <MyCrewCard crew={myCrew} myState={snap.my_state} buffs={snap.active_buffs ?? []} shield={snap.my_shield} />}

        {/* Inventory + Resources */}
        <ResourcePanel snap={snap} doAction={doAction} busy={busy} />

        {/* Augur-Feed */}
        <AugurFeed milestones={snap.augur_milestones ?? []} crews={snap.bracket_crews ?? []} />

        {/* Active Rallies */}
        {snap.active_rallies && snap.active_rallies.length > 0 && (
          <ActiveRalliesList rallies={snap.active_rallies} zones={snap.zones ?? []} myCrewId={snap.my_crew_id} doAction={doAction} busy={busy} />
        )}

        {/* Active Megas */}
        {snap.active_megas && snap.active_megas.length > 0 && (
          <ActiveMegasList megas={snap.active_megas} zones={snap.zones ?? []} doAction={doAction} busy={busy} />
        )}

        {/* Bracket-Standings */}
        <BracketStandings crews={snap.bracket_crews ?? []} myCrewId={snap.my_crew_id} />

        {/* Diplomatie */}
        <DiplomacyPanel diplomacy={snap.active_diplomacy ?? []} crews={snap.bracket_crews ?? []} myCrewId={snap.my_crew_id} doAction={doAction} busy={busy} />

        {/* Recent Battles */}
        {snap.recent_battles && snap.recent_battles.length > 0 && (
          <RecentBattlesList battles={snap.recent_battles} onOpen={setBattleModal} />
        )}
      </div>

      {/* Modals */}
      {tapMenu && (
        <TapActionMenu menu={tapMenu} snap={snap} onClose={() => setTapMenu(null)}
          onChoice={(choice) => {
            setTapMenu(null);
            if (choice === "verlegen") void doAction({ action: "relocate_base", zone_id: tapMenu.zone.id });
            else if (choice === "build_repeater") void doAction({ action: "build_repeater", zone_id: tapMenu.zone.id });
            else if (choice === "build_mega") void doAction({ action: "build_hauptgebaeude", zone_id: tapMenu.zone.id });
            else setLegionModal({ kind: choice, zone: tapMenu.zone });
          }}
          onMulti={() => { setTapMenu(null); setMultiModal({ zone: tapMenu.zone }); }}
        />
      )}
      {legionModal && (
        <LegionModal kind={legionModal.kind} zone={legionModal.zone} snap={snap}
          onClose={() => setLegionModal(null)}
          onConfirm={(legion) => {
            const action =
              legionModal.kind === "marsch_angriff" ? "start_march" :
              legionModal.kind === "verstärken"     ? "send_reinforcement" :
              legionModal.kind === "sammeln"        ? "start_gather" :
              legionModal.kind === "rally"          ? "start_rally" :
              "start_march";
            const payload = { ...legion, action, zone_id: legionModal.zone.id, target_zone_id: legionModal.zone.id, kind: action === "start_march" ? "attack" : undefined };
            void doAction(payload).then((ok) => { if (ok) setLegionModal(null); });
          }}
          busy={busy}
        />
      )}
      {multiModal && (
        <MultiAufgebotModal zone={multiModal.zone} snap={snap}
          onClose={() => setMultiModal(null)}
          onConfirm={async (legions) => {
            const ok = await doAction({ action: "deploy_multi", legions });
            if (ok) setMultiModal(null);
          }}
          busy={busy}
        />
      )}
      {battleModal && <BattleReportModal battle={battleModal} crews={snap.bracket_crews ?? []} onClose={() => setBattleModal(null)} />}
      {marchPopup && (
        <MarchPopup march={marchPopup} myUserId={snap.my_state ? "" : null}
          onClose={() => setMarchPopup(null)}
          onRecall={async () => { const ok = await doAction({ action: "recall_march", march_id: marchPopup.id }); if (ok) setMarchPopup(null); }}
          isOwn={marchPopup.crew_id === snap.my_crew_id}
        />
      )}
    </div>
  );
}

// ════════════════════════════════════════════════════════════════
// SUB-COMPONENTS
// ════════════════════════════════════════════════════════════════

function NoRound() {
  return (
    <div className="bg-white/3 border border-white/10 rounded-xl p-8 text-center">
      <div className="text-3xl mb-2">🏙️</div>
      <div className="text-white font-bold">Aktuell läuft keine Saga.</div>
      <div className="text-text-muted text-sm">Schau bald wieder rein.</div>
    </div>
  );
}

function SignupView({ snap, doAction, busy, err }: { snap: Snap; doAction: (p: Record<string, unknown>) => Promise<boolean>; busy: boolean; err: string | null }) {
  const isLeader = snap.my_role === "leader" || snap.my_role === "officer";
  return (
    <div className="space-y-4">
      <div className="bg-linear-to-r from-primary/15 to-accent/15 border border-primary/40 rounded-2xl p-5">
        <div className="text-white font-black text-xl mb-1">📋 Saga-Anmeldung offen</div>
        <div className="text-text-muted text-sm mb-3">
          Crew-Leader können ihre Crew jetzt für die Saga anmelden. Matchmaking gruppiert Crews ähnlicher Größe in eigene Brackets auf realer Stadt-Map.
        </div>
        {err && <div className="px-3 py-2 mb-3 rounded bg-accent/15 border border-accent/40 text-accent text-xs font-bold">{err}</div>}
        {!snap.my_crew_id ? (
          <div className="text-xs text-text-muted">Du bist in keiner Crew — Anmeldung nicht möglich.</div>
        ) : !isLeader ? (
          <div className="text-xs text-text-muted">Nur Crew-Leader/Officer können anmelden.</div>
        ) : snap.my_crew_signed_up ? (
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xp font-bold">✓ Crew angemeldet</span>
            <button onClick={() => doAction({ action: "withdraw" })} disabled={busy}
              className="px-3 py-1.5 rounded bg-white/10 text-white text-xs font-bold">Zurückziehen</button>
          </div>
        ) : (
          <button onClick={() => doAction({ action: "signup" })} disabled={busy}
            className="px-4 py-2 rounded bg-primary text-bg-deep font-bold text-sm">▶ Crew anmelden</button>
        )}
      </div>
    </div>
  );
}

function BracketsView({ snap }: { snap: Snap }) {
  return (
    <div className="bg-white/3 border border-white/10 rounded-xl p-6 text-center">
      <div className="text-3xl mb-2">🎲</div>
      <div className="text-white font-bold mb-2">Matchmaking läuft</div>
      <div className="text-text-muted text-sm">{snap.all_brackets.length} Brackets aktiv. Deine Crew ist nicht angemeldet oder noch nicht zugeordnet.</div>
    </div>
  );
}

function MyCrewCard({ crew, myState, buffs, shield }: { crew: BracketCrew; myState: UserState | null; buffs: Array<{ buff_kind: string; multiplier: number; expires_at: string }>; shield: { expires_at: string } | null }) {
  return (
    <div className="bg-linear-to-br from-primary/15 to-accent/15 border border-primary/40 rounded-2xl p-4">
      <div className="flex items-center gap-2 mb-2">
        <span className="w-3 h-3 rounded-full" style={{ background: crew.color_hex }} />
        <div>
          <div className="text-[10px] uppercase tracking-wider text-text-muted">DEINE CREW</div>
          <div className="text-white font-bold">{crew.crews?.name ?? crew.crew_id.slice(0, 8)}</div>
        </div>
      </div>
      <div className="grid grid-cols-3 gap-2 text-center text-xs">
        <Stat label="Zonen" v={crew.zones_held} />
        <Stat label="Gebäude" v={crew.buildings_count} />
        <Stat label="Verdienste" v={crew.merits.toLocaleString()} />
      </div>
      {myState && (
        <div className="grid grid-cols-2 gap-1 mt-3 text-[10px]">
          <Pill label="🛡 Slots" v={`${myState.march_slots_used}/${myState.march_slots_total}`} />
          <Pill label="⚡ AP" v={`${myState.action_points}/${myState.action_points_max}`} />
          <Pill label="⚔ PvP" v={`${myState.pvp_attacks_today}/${myState.pvp_attacks_max}`} />
          <Pill label="Field-Truppen" v={(myState.saga_slot_inf + myState.saga_slot_cav + myState.saga_slot_mark + myState.saga_slot_werk).toLocaleString()} />
        </div>
      )}
      {(buffs.length > 0 || shield) && (
        <div className="mt-2 space-y-1">
          {shield && shield.expires_at && new Date(shield.expires_at) > new Date() && (
            <div className="text-[10px] bg-blue-500/20 text-blue-300 rounded px-2 py-1">🛡 Shield bis {fmtTime(shield.expires_at)}</div>
          )}
          {buffs.map((b, i) => (
            <div key={i} className="text-[10px] bg-xp/20 text-xp rounded px-2 py-1">⚡ {b.buff_kind} ×{b.multiplier} bis {fmtTime(b.expires_at)}</div>
          ))}
        </div>
      )}
    </div>
  );
}

function ResourcePanel({ snap, doAction, busy }: { snap: Snap; doAction: (p: Record<string, unknown>) => Promise<boolean>; busy: boolean }) {
  const r = snap.my_resources;
  const inv = snap.my_inventory ?? [];
  return (
    <div className="bg-white/2 border border-white/10 rounded-xl p-3">
      <div className="text-[10px] uppercase tracking-wider text-text-muted font-bold mb-1">📦 Ressourcen + Items</div>
      {r && (
        <div className="grid grid-cols-2 gap-1 text-xs mb-2">
          <Pill label="🔧 Schrott" v={r.tech_schrott.toLocaleString()} />
          <Pill label="⚙ Komp." v={r.komponenten.toLocaleString()} />
          <Pill label="💰 Krypto" v={r.krypto.toLocaleString()} />
          <Pill label="📡 Bandbr." v={r.bandbreite.toLocaleString()} />
        </div>
      )}
      {inv.length > 0 ? (
        <div className="space-y-1">
          {inv.filter((i) => i.qty > 0).map((i) => (
            <button key={i.item_kind} onClick={() => doAction({ action: i.item_kind.startsWith("tele_") ? "use_migration_item" : "use_buff_item", item_kind: i.item_kind })}
              disabled={busy}
              className="w-full text-left bg-white/5 hover:bg-white/10 rounded px-2 py-1 text-xs flex items-center justify-between">
              <span>{itemLabel(i.item_kind)}</span>
              <span className="text-text-muted">×{i.qty}</span>
            </button>
          ))}
        </div>
      ) : <div className="text-text-muted text-[10px]">Keine Items im Inventar</div>}
    </div>
  );
}

function AugurFeed({ milestones, crews }: { milestones: Augur[]; crews: BracketCrew[] }) {
  if (milestones.length === 0) return null;
  return (
    <div className="bg-white/2 border border-white/10 rounded-xl p-3">
      <div className="text-[10px] uppercase tracking-wider text-text-muted font-bold mb-1">🌟 Skyline-Chronik</div>
      <div className="space-y-1 max-h-40 overflow-y-auto">
        {milestones.slice(0, 10).map((m) => {
          const c = crews.find((cc) => cc.crew_id === m.crew_id);
          return (
            <div key={m.id} className="text-[10px] bg-xp/10 border-l-2 border-xp px-2 py-1">
              <div className="font-bold text-xp">{augurLabel(m.milestone_kind)}</div>
              {c && <div className="text-text-muted">durch {c.crews?.name ?? "?"} · {fmtTime(m.achieved_at)}</div>}
              <div className="text-text-muted">+{m.reward_gems}💎 {m.reward_keys > 0 && `+${m.reward_keys}🔑`} {m.reward_speedups > 0 && `+${m.reward_speedups}⚡`}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ActiveRalliesList({ rallies, zones, myCrewId, doAction, busy }: {
  rallies: Array<{ id: string; crew_id: string; leader_user_id: string; target_zone_id: string; joinable_until: string; participant_count: number; status: string }>;
  zones: Zone[]; myCrewId: string | null;
  doAction: (p: Record<string, unknown>) => Promise<boolean>; busy: boolean;
}) {
  return (
    <div className="bg-white/2 border border-white/10 rounded-xl p-3">
      <div className="text-[10px] uppercase tracking-wider text-text-muted font-bold mb-1">🚩 Aktive Rallies</div>
      {rallies.map((r) => {
        const z = zones.find((zz) => zz.id === r.target_zone_id);
        const isMine = r.crew_id === myCrewId;
        return (
          <div key={r.id} className="bg-white/5 rounded p-2 text-xs mb-1">
            <div className="text-white font-bold">→ {z?.name ?? "?"}</div>
            <div className="text-text-muted text-[10px]">{r.participant_count}/10 · bis {fmtTime(r.joinable_until)}</div>
            {isMine && r.status === "gathering" && (
              <button onClick={() => doAction({ action: "join_rally", rally_id: r.id, inf: 100, cav: 0, mark: 0, werk: 0 })}
                disabled={busy}
                className="mt-1 w-full py-1 rounded bg-primary text-bg-deep text-[10px] font-bold">▶ Joinen</button>
            )}
          </div>
        );
      })}
    </div>
  );
}

function ActiveMegasList({ megas, zones, doAction, busy }: { megas: Array<{ id: string; zone_id: string; hp_remaining: number; hp_total: number; expires_at: string }>; zones: Zone[]; doAction: (p: Record<string, unknown>) => Promise<boolean>; busy: boolean }) {
  return (
    <div className="bg-white/2 border border-white/10 rounded-xl p-3">
      <div className="text-[10px] uppercase tracking-wider text-text-muted font-bold mb-1">🐉 Mega-Wegelager</div>
      {megas.map((m) => {
        const z = zones.find((zz) => zz.id === m.zone_id);
        const pct = Math.round((m.hp_remaining / m.hp_total) * 100);
        return (
          <div key={m.id} className="bg-white/5 rounded p-2 text-xs mb-1">
            <div className="text-white font-bold">{z?.name ?? "?"} — {pct}% HP</div>
            <div className="text-text-muted text-[10px]">expires {fmtTime(m.expires_at)}</div>
            <button onClick={() => doAction({ action: "attack_behemoth", mega_id: m.id, inf: 100, cav: 0, mark: 0, werk: 0 })}
              disabled={busy}
              className="mt-1 w-full py-1 rounded bg-accent text-white text-[10px] font-bold">⚔ Angreifen</button>
          </div>
        );
      })}
    </div>
  );
}

function BracketStandings({ crews, myCrewId }: { crews: BracketCrew[]; myCrewId: string | null }) {
  const sorted = [...crews].sort((a, b) => b.zones_held - a.zones_held || b.merits - a.merits);
  return (
    <div className="bg-white/2 border border-white/10 rounded-xl p-3">
      <div className="text-[10px] uppercase tracking-wider text-text-muted font-bold mb-1">📊 Standings</div>
      {sorted.map((c, i) => (
        <div key={c.crew_id} className={`flex items-center gap-2 py-1 text-xs ${c.crew_id === myCrewId ? "bg-primary/10 rounded" : ""}`}>
          <span className="w-5 text-center">{i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `${i + 1}.`}</span>
          <span className="w-2 h-2 rounded-full" style={{ background: c.color_hex }} />
          <span className="flex-1 truncate text-white">{c.crews?.name ?? "?"}</span>
          <span className="text-text-muted">{c.zones_held}z {c.buildings_count}g</span>
        </div>
      ))}
    </div>
  );
}

function DiplomacyPanel({ diplomacy, crews, myCrewId, doAction, busy }: { diplomacy: Array<{ id: string; crew_a: string; crew_b: string; pact_kind: string; status: string; expires_at: string | null; proposed_by: string | null }>; crews: BracketCrew[]; myCrewId: string | null; doAction: (p: Record<string, unknown>) => Promise<boolean>; busy: boolean }) {
  if (diplomacy.length === 0) return null;
  return (
    <div className="bg-white/2 border border-white/10 rounded-xl p-3">
      <div className="text-[10px] uppercase tracking-wider text-text-muted font-bold mb-1">🤝 Diplomatie</div>
      {diplomacy.map((d) => {
        const otherId = d.crew_a === myCrewId ? d.crew_b : d.crew_a;
        const other = crews.find((c) => c.crew_id === otherId);
        return (
          <div key={d.id} className="bg-white/5 rounded p-2 text-xs mb-1">
            <div className="text-white">{d.pact_kind.toUpperCase()} · {other?.crews?.name ?? "?"}</div>
            <div className="text-text-muted text-[10px]">{d.status} {d.expires_at && `bis ${fmtTime(d.expires_at)}`}</div>
            {d.status === "proposed" && d.crew_a !== myCrewId && (
              <button onClick={() => doAction({ action: "accept_nap", dip_id: d.id })} disabled={busy}
                className="mt-1 w-full py-1 rounded bg-primary text-bg-deep text-[10px] font-bold">Annehmen</button>
            )}
            {d.status === "active" && (
              <button onClick={() => doAction({ action: "break_nap", dip_id: d.id })} disabled={busy}
                className="mt-1 w-full py-1 rounded bg-accent text-white text-[10px] font-bold">Brechen</button>
            )}
          </div>
        );
      })}
    </div>
  );
}

function RecentBattlesList({ battles, onOpen }: { battles: Battle[]; onOpen: (b: Battle) => void }) {
  return (
    <div className="bg-white/2 border border-white/10 rounded-xl p-3">
      <div className="text-[10px] uppercase tracking-wider text-text-muted font-bold mb-1">⚔ Letzte Kämpfe</div>
      <div className="space-y-1 max-h-40 overflow-y-auto">
        {battles.slice(0, 8).map((b) => (
          <button key={b.id} onClick={() => onOpen(b)}
            className="w-full text-left bg-white/5 hover:bg-white/10 rounded p-1.5 text-[10px]">
            <div className={b.outcome === "attacker_won" ? "text-green-400 font-bold" : "text-red-400 font-bold"}>{b.outcome === "attacker_won" ? "✓ Sieg" : "✗ Niederlage"}</div>
            <div className="text-text-muted">{b.battle_kind} · {fmtTime(b.created_at)}</div>
          </button>
        ))}
      </div>
    </div>
  );
}

function PendingAttacksBanner({ pending, myCrewId, bracketCrews }: { pending: Array<{ march_id: string; attacker_crew_id: string; target_zone_name: string; arrives_at: string }>; myCrewId: string | null; bracketCrews: BracketCrew[] }) {
  const incoming = pending.filter((p) => p.attacker_crew_id !== myCrewId);
  if (incoming.length === 0) return null;
  return (
    <div className="bg-accent/15 border border-accent/40 rounded-xl p-3">
      <div className="text-[10px] uppercase tracking-wider text-accent font-bold mb-1">🚨 EINGEHENDE ANGRIFFE</div>
      {incoming.slice(0, 3).map((p) => {
        const atkCrew = bracketCrews.find((c) => c.crew_id === p.attacker_crew_id);
        return (
          <div key={p.march_id} className="text-xs mb-1">
            <span className="text-white font-bold">{atkCrew?.crews?.name ?? "?"}</span>
            <span className="text-text-muted"> → </span>
            <span className="text-accent">{p.target_zone_name}</span>
            <span className="text-text-muted"> · </span>
            <span className="text-xp">{fmtCountdown(Math.max(0, Math.floor((new Date(p.arrives_at).getTime() - Date.now()) / 1000)))}</span>
          </div>
        );
      })}
    </div>
  );
}

// ────── TAP-ACTION-MENU (CoD-Style) ──────
function TapActionMenu({ menu, snap, onClose, onChoice, onMulti }: {
  menu: { zone: Zone; lngLat: [number, number] };
  snap: Snap;
  onClose: () => void;
  onChoice: (c: ActionMenuChoice) => void;
  onMulti: () => void;
}) {
  const z = menu.zone;
  const isMine = z.owner_crew_id === snap.my_crew_id;
  const isFree = !z.owner_crew_id && z.zone_kind === "district";

  return (
    <div className="fixed inset-0 z-9999 bg-black/70 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-[#1A1D23] border border-white/10 rounded-xl p-4 max-w-sm w-full" onClick={(e) => e.stopPropagation()}>
        <div className="text-white font-black text-lg">{z.name}</div>
        <div className="text-text-muted text-xs mb-3">
          {z.zone_kind} · Ring {z.ring}
          {z.is_holy_site && <span className="ml-1 text-xp">🏛 HOLY +{z.holy_buff_pct}%</span>}
          {z.is_gather_tile && <span className="ml-1 text-blue-300">📦 {z.gather_kind} ({z.gather_remaining})</span>}
        </div>

        <div className="space-y-2">
          {/* VERLEGEN — eigene Position auf diese Zone */}
          {(isMine || z.zone_kind === "spawn") && (
            <BigBtn icon="📍" label="Base verlegen" desc="Deine Position auf diese Zone" onClick={() => onChoice("verlegen")} color="#22D1C3" />
          )}

          {/* MARSCH-ANGRIFF — auf fremde/neutrale Zone */}
          {!isMine && z.zone_kind !== "gate" && (
            <BigBtn icon="⚔" label="Marsch-Angriff" desc="Aufgebot losschicken zum Erobern" onClick={() => onChoice("marsch_angriff")} color="#FF2D78" />
          )}

          {/* EINSETZEN — Truppen-Auswahl bei eigener Zone */}
          {isMine && (
            <BigBtn icon="🪖" label="Einsetzen" desc="Aufgebot oder Multi-Aufgebot" onClick={() => onChoice("verstärken")} color="#FFD700" />
          )}

          {/* SAMMELN — auf Gather-Tiles */}
          {z.is_gather_tile && z.gather_remaining > 0 && (
            <BigBtn icon="📦" label="Sammeln" desc={`+${z.gather_yield_per_hour}/h ${z.gather_kind}`} onClick={() => onChoice("sammeln")} color="#5DDAF0" />
          )}

          {/* RALLY — eigene oder fremde Zone */}
          {(snap.my_role === "leader" || snap.my_role === "officer") && (
            <BigBtn icon="🚩" label="Rally starten" desc="Crew-Mega-Angriff (max 10 Member)" onClick={() => onChoice("rally")} color="#A855F7" />
          )}

          {/* BAUEN */}
          {(isFree || isMine) && z.zone_kind === "district" && (
            <BigBtn icon="📡" label="Repeater bauen" desc="Zone markieren · 50 Verdienste" onClick={() => onChoice("build_repeater")} color="#5DDAF0" />
          )}
          {isMine && z.zone_kind === "district" && (
            <BigBtn icon="🏰" label="Mega-Repeater bauen" desc="Permanente Eroberung · 500 Verdienste" onClick={() => onChoice("build_mega")} color="#FFD700" />
          )}

          {/* MULTI-AUFGEBOT */}
          {isMine && (
            <BigBtn icon="🪙" label="Multi-Aufgebot" desc="Bis zu 5 Aufgebote parallel" onClick={onMulti} color="#FFD700" />
          )}
        </div>

        <button onClick={onClose} className="w-full mt-3 py-2 rounded bg-white/10 text-white text-sm">Abbrechen</button>
      </div>
    </div>
  );
}

function BigBtn({ icon, label, desc, onClick, color }: { icon: string; label: string; desc: string; onClick: () => void; color: string }) {
  return (
    <button onClick={onClick}
      className="w-full text-left p-3 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 flex items-center gap-3">
      <div className="text-2xl" style={{ color }}>{icon}</div>
      <div className="flex-1 min-w-0">
        <div className="text-white font-bold text-sm">{label}</div>
        <div className="text-text-muted text-[10px]">{desc}</div>
      </div>
      <div className="text-text-muted">→</div>
    </button>
  );
}

// ────── LEGION-MODAL ──────
function LegionModal({ kind, zone, snap, onClose, onConfirm, busy }: {
  kind: ActionMenuChoice; zone: Zone; snap: Snap;
  onClose: () => void; onConfirm: (legion: Record<string, unknown>) => void; busy: boolean;
}) {
  const [inf, setInf] = useState(0);
  const [cav, setCav] = useState(0);
  const [mark, setMark] = useState(0);
  const [werk, setWerk] = useState(0);
  const [guardianId] = useState<string | null>(null);

  const max = snap.my_state ?? { saga_slot_inf: 0, saga_slot_cav: 0, saga_slot_mark: 0, saga_slot_werk: 0 };
  const total = inf + cav + mark + werk;
  const title = kind === "marsch_angriff" ? "⚔ Marsch-Angriff" :
                kind === "verstärken"     ? "🛡 Verstärkung" :
                kind === "sammeln"        ? "📦 Sammeln" :
                kind === "rally"          ? "🚩 Rally" :
                "🪖 Aufgebot";

  return (
    <div className="fixed inset-0 z-9999 bg-black/70 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-[#1A1D23] border border-white/10 rounded-xl p-5 max-w-md w-full" onClick={(e) => e.stopPropagation()}>
        <div className="text-white font-black text-lg mb-1">{title}</div>
        <div className="text-text-muted text-xs mb-4">Ziel: {zone.name}</div>

        <div className="text-[10px] uppercase text-text-muted mb-2">Aufgebot zusammenstellen</div>
        <div className="grid grid-cols-4 gap-2">
          <NumIn label="⚒ Inf" v={inf} setV={setInf} max={max.saga_slot_inf} />
          <NumIn label="🐎 Cav" v={cav} setV={setCav} max={max.saga_slot_cav} />
          <NumIn label="🎯 Mark" v={mark} setV={setMark} max={max.saga_slot_mark} />
          <NumIn label="🛠 Werk" v={werk} setV={setWerk} max={max.saga_slot_werk} />
        </div>
        <div className="text-text-muted text-[10px] text-center mt-1">Gesamt: {total}</div>

        <div className="flex gap-2 mt-4">
          <button onClick={onClose} disabled={busy} className="flex-1 py-2 rounded bg-white/10 text-white text-sm font-bold">Abbrechen</button>
          <button onClick={() => onConfirm({ inf, cav, mark, werk, guardian_id: guardianId })} disabled={busy || total === 0}
            className="flex-1 py-2 rounded bg-primary text-bg-deep text-sm font-bold disabled:opacity-40">▶ Marsch starten</button>
        </div>
      </div>
    </div>
  );
}

// ────── MULTI-AUFGEBOT MODAL ──────
function MultiAufgebotModal({ zone, snap, onClose, onConfirm, busy }: {
  zone: Zone; snap: Snap; onClose: () => void;
  onConfirm: (legions: Array<Record<string, unknown>>) => Promise<void>; busy: boolean;
}) {
  const [legions, setLegions] = useState<Array<{ inf: number; cav: number; mark: number; werk: number }>>([
    { inf: 0, cav: 0, mark: 0, werk: 0 },
  ]);
  const max = snap.my_state ?? { saga_slot_inf: 0, saga_slot_cav: 0, saga_slot_mark: 0, saga_slot_werk: 0, march_slots_total: 5, march_slots_used: 0 };
  const slotsAvailable = max.march_slots_total - max.march_slots_used;

  function addLegion() {
    if (legions.length >= 5 || legions.length >= slotsAvailable) return;
    setLegions([...legions, { inf: 0, cav: 0, mark: 0, werk: 0 }]);
  }
  function removeLegion(i: number) { setLegions(legions.filter((_, idx) => idx !== i)); }
  function updateLegion(i: number, patch: Partial<typeof legions[0]>) {
    setLegions(legions.map((l, idx) => idx === i ? { ...l, ...patch } : l));
  }

  async function submit() {
    await onConfirm(legions.filter((l) => l.inf + l.cav + l.mark + l.werk > 0).map((l) => ({
      kind: "attack", target_zone_id: zone.id, ...l,
    })));
  }

  return (
    <div className="fixed inset-0 z-9999 bg-black/70 flex items-center justify-center p-4 overflow-y-auto" onClick={onClose}>
      <div className="bg-[#1A1D23] border border-white/10 rounded-xl p-5 max-w-2xl w-full" onClick={(e) => e.stopPropagation()}>
        <div className="text-white font-black text-lg mb-1">🪙 Multi-Aufgebot</div>
        <div className="text-text-muted text-xs mb-3">Ziel: {zone.name} · {legions.length}/{Math.min(5, slotsAvailable)} Aufgebote</div>

        <div className="space-y-2 mb-3">
          {legions.map((l, i) => (
            <div key={i} className="bg-white/5 rounded-lg p-2">
              <div className="flex justify-between items-center mb-1">
                <span className="text-white text-xs font-bold">Aufgebot #{i + 1}</span>
                {legions.length > 1 && <button onClick={() => removeLegion(i)} className="text-accent text-xs">✕</button>}
              </div>
              <div className="grid grid-cols-4 gap-1">
                <NumIn label="Inf" v={l.inf} setV={(v) => updateLegion(i, { inf: v })} max={max.saga_slot_inf} />
                <NumIn label="Cav" v={l.cav} setV={(v) => updateLegion(i, { cav: v })} max={max.saga_slot_cav} />
                <NumIn label="Mark" v={l.mark} setV={(v) => updateLegion(i, { mark: v })} max={max.saga_slot_mark} />
                <NumIn label="Werk" v={l.werk} setV={(v) => updateLegion(i, { werk: v })} max={max.saga_slot_werk} />
              </div>
            </div>
          ))}
        </div>
        {legions.length < 5 && legions.length < slotsAvailable && (
          <button onClick={addLegion} className="w-full py-1.5 rounded bg-white/10 text-primary text-xs font-bold mb-3">+ Aufgebot hinzufügen</button>
        )}

        <div className="flex gap-2">
          <button onClick={onClose} disabled={busy} className="flex-1 py-2 rounded bg-white/10 text-white text-sm font-bold">Abbrechen</button>
          <button onClick={submit} disabled={busy} className="flex-1 py-2 rounded bg-primary text-bg-deep text-sm font-bold">▶ Alle losschicken</button>
        </div>
      </div>
    </div>
  );
}

// ────── BATTLE-REPORT-MODAL ──────
function BattleReportModal({ battle, crews, onClose }: { battle: Battle; crews: BracketCrew[]; onClose: () => void }) {
  const atk = crews.find((c) => c.crew_id === battle.attacker_crew_id);
  const def = crews.find((c) => c.crew_id === battle.defender_crew_id);
  return (
    <div className="fixed inset-0 z-9999 bg-black/70 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-[#1A1D23] border border-white/10 rounded-xl p-5 max-w-md w-full" onClick={(e) => e.stopPropagation()}>
        <div className="text-center mb-4">
          <div className="text-3xl">{battle.outcome === "attacker_won" ? "🏆" : battle.outcome === "defender_won" ? "🛡" : "🤝"}</div>
          <div className="text-white font-black text-lg">{battle.outcome === "attacker_won" ? "ANGREIFER SIEG" : battle.outcome === "defender_won" ? "VERTEIDIGER SIEG" : "UNENTSCHIEDEN"}</div>
          <div className="text-text-muted text-xs">{battle.battle_kind} · {fmtTime(battle.created_at)}</div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-accent/10 rounded p-2 text-center text-xs">
            <div className="text-accent font-bold">⚔ {atk?.crews?.name ?? "?"}</div>
            <div className="text-text-muted">Inf:{battle.attacker_inf} Cav:{battle.attacker_cav}</div>
            <div className="text-text-muted">Mark:{battle.attacker_mark} Werk:{battle.attacker_werk}</div>
            <div className="text-red-400 mt-1">−{battle.attacker_losses_dead + battle.attacker_losses_wounded}</div>
          </div>
          <div className="bg-primary/10 rounded p-2 text-center text-xs">
            <div className="text-primary font-bold">🛡 {def?.crews?.name ?? "?"}</div>
            <div className="text-text-muted">Inf:{battle.defender_inf} Cav:{battle.defender_cav}</div>
            <div className="text-text-muted">Mark:{battle.defender_mark} Werk:{battle.defender_werk}</div>
            <div className="text-red-400 mt-1">−{battle.defender_losses_dead + battle.defender_losses_wounded}</div>
          </div>
        </div>
        <button onClick={onClose} className="w-full mt-4 py-2 rounded bg-primary text-bg-deep font-bold text-sm">Schließen</button>
      </div>
    </div>
  );
}

// ────── MARCH-POPUP (auf Truppen-Click) ──────
function MarchPopup({ march, onClose, onRecall, isOwn }: { march: March; myUserId: string | null; onClose: () => void; onRecall: () => Promise<void>; isOwn: boolean }) {
  return (
    <div className="fixed inset-0 z-9999 bg-black/70 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-[#1A1D23] border border-white/10 rounded-xl p-4 max-w-xs w-full" onClick={(e) => e.stopPropagation()}>
        <div className="text-white font-bold text-base mb-1">{march.march_kind}</div>
        <div className="text-text-muted text-xs mb-3">
          {isOwn ? `Inf:${march.inf} Cav:${march.cav} Mark:${march.mark} Werk:${march.werk}` : "❓ Feindlicher Marsch"}
        </div>
        <div className="text-text-muted text-[10px] mb-3">Ankunft: {fmtTime(march.arrives_at)}</div>
        {isOwn && march.status === "marching" && (
          <button onClick={onRecall} className="w-full py-2 rounded bg-accent text-white font-bold text-sm">↩ Zurückrufen</button>
        )}
        <button onClick={onClose} className="w-full mt-2 py-2 rounded bg-white/10 text-white font-bold text-sm">Schließen</button>
      </div>
    </div>
  );
}

// ────── HELPERS ──────
function NumIn({ label, v, setV, max }: { label: string; v: number; setV: (v: number) => void; max: number }) {
  return (
    <div>
      <div className="text-[9px] text-text-muted text-center">{label}</div>
      <input type="number" value={v} min={0} max={max}
        onChange={(e) => setV(Math.max(0, Math.min(max, parseInt(e.target.value) || 0)))}
        className="w-full bg-white/10 px-1 py-1 rounded text-white text-center text-xs" />
      <div className="text-[8px] text-text-muted text-center">/{max}</div>
    </div>
  );
}
function Stat({ label, v }: { label: string; v: number | string }) { return (<div><div className="text-[9px] uppercase text-text-muted">{label}</div><div className="font-black text-base text-white">{v}</div></div>); }
function Pill({ label, v }: { label: string; v: number | string }) { return (<div className="bg-white/5 rounded px-2 py-0.5"><div className="text-[8px] text-text-muted">{label}</div><div className="text-white font-bold text-xs">{v}</div></div>); }
function fmtTime(iso: string) { return new Date(iso).toLocaleString("de-DE", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }); }
function fmtCountdown(s: number): string { if (s <= 0) return "0s"; const h = Math.floor(s / 3600); s = s % 3600; const m = Math.floor(s / 60); s = s % 60; if (h > 0) return `${h}h ${m}m`; if (m > 0) return `${m}m ${s}s`; return `${s}s`; }

function itemLabel(k: string): string {
  const map: Record<string, string> = {
    tele_random: "🎲 Random Teleport",
    tele_targeted: "🎯 Gezielter Teleport",
    tele_advanced: "💎 Advanced Teleport",
    speedup_5min: "⚡ Speedup 5min",
    speedup_30min: "⚡ Speedup 30min",
    speedup_1h: "⚡ Speedup 1h",
    speedup_3h: "⚡ Speedup 3h",
    speedup_8h: "⚡ Speedup 8h",
    speedup_24h: "⚡ Speedup 24h",
    buff_atk_30min: "🔥 +50% Atk 30min",
    buff_def_30min: "🛡 +50% Def 30min",
    buff_marchspeed_30min: "🏃 +50% Marsch 30min",
    buff_gather_30min: "📦 +30% Sammeln 30min",
    heal_token: "💊 Heilungs-Token",
    shield_24h: "🛡 Shield 24h",
    shield_8h: "🛡 Shield 8h",
  };
  return map[k] ?? k;
}
function augurLabel(k: string): string {
  const map: Record<string, string> = {
    first_phase_2: "🔓 Phase 2 erreicht",
    first_phase_3: "🔓 Phase 3 erreicht",
    first_phase_4: "🔓 Phase 4 erreicht",
    first_holy_capture: "🏛 Erste Holy-Site erobert",
    first_apex_touch: "🏰 Apex erreicht",
    first_behemoth_kill: "🐉 Behemoth besiegt",
    first_hauptgebaeude: "🏰 Erstes Mega-Repeater",
    first_rally_won: "🚩 Erste Rally gewonnen",
    apex_held_24h: "👑 Apex 24h gehalten",
    apex_held_48h: "🎉 SAGA-SIEG (48h Hold)",
  };
  return map[k] ?? k;
}

function phaseInfo(r: Round): { label: string; timeLabel: string; timeValue: string; progressPct: number } {
  const now = Date.now();
  const start = new Date(r.signup_starts).getTime();
  const total = new Date(r.awards_ends).getTime() - start;
  const elapsed = Math.max(0, Math.min(total, now - start));
  const pct = total > 0 ? (elapsed / total) * 100 : 0;
  const days = (until: string) => Math.max(0, Math.ceil((new Date(until).getTime() - now) / 86400000));
  if (r.status === "signup") return { label: "📋 Anmeldung offen", timeLabel: "noch", timeValue: `${days(r.signup_ends)}d`, progressPct: pct };
  if (r.status === "matchmaking") return { label: "🎲 Matchmaking", timeLabel: "Auftakt-Start", timeValue: "in Kürze", progressPct: pct };
  if (r.status === "active") {
    const auftaktDays = days(r.auftakt_ends);
    if (auftaktDays > 0) return { label: "🎽 Auftakt-Phase", timeLabel: "Hauptphase in", timeValue: `${auftaktDays}d`, progressPct: pct };
    const mainDays = days(r.main_ends);
    if (mainDays > 0) return { label: "⚔ Hauptphase", timeLabel: "Apex-Hold in", timeValue: `${mainDays}d`, progressPct: pct };
    return { label: "🏛 Apex-Hold", timeLabel: "Awards in", timeValue: `${days(r.awards_ends)}d`, progressPct: pct };
  }
  return { label: "Saga beendet", timeLabel: "", timeValue: "—", progressPct: 100 };
}
