import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireStaff } from "@/lib/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/admin/saga/bracket-detail?bracket_id=...
 *   → komplettes Bracket-Snapshot für Admin-Map-Preview:
 *     bracket, city, zones (alle), adjacency, crews, buildings, marches,
 *     active mega_camps, recent battles
 */
export async function GET(req: NextRequest) {
  await requireStaff();
  const sb = await createClient();
  const url = new URL(req.url);
  const bracketId = url.searchParams.get("bracket_id");
  if (!bracketId) return NextResponse.json({ ok: false, error: "bracket_id required" }, { status: 400 });

  const [bracket, zones, crews, adj, buildings, marches, megas, battles, holyHolders, userPositions, augur, rallies, diplomacy] = await Promise.all([
    sb.from("saga_brackets").select("*").eq("id", bracketId).single(),
    sb.from("saga_zones")
      .select("id, osm_id, name, zone_kind, ring, centroid_lat, centroid_lng, polygon, owner_crew_id, gate_kind, gate_phase, gate_state, gate_garrison_crew_id, resource_bonus_pct, resource_kind, is_holy_site, holy_buff_kind, holy_buff_pct, is_gather_tile, gather_yield_per_hour, gather_kind, gather_remaining, gather_capacity")
      .eq("bracket_id", bracketId),
    sb.from("saga_bracket_crews")
      .select("crew_id, color_hex, spawn_zone_id, auftakt_points, merits, zones_held, buildings_count, troops_killed, troops_lost, final_rank, crews:crew_id(name, slug)")
      .eq("bracket_id", bracketId),
    sb.from("saga_zone_adjacency")
      .select("zone_a, zone_b, via_gate_zone, saga_zones!saga_zone_adjacency_zone_a_fkey(bracket_id)")
      .returns<Array<{ zone_a: string; zone_b: string; via_gate_zone: string | null; saga_zones: { bracket_id: string } | null }>>(),
    sb.from("saga_buildings")
      .select("id, zone_id, crew_id, building_kind, hp, max_hp, built_at, destroyed_at")
      .eq("bracket_id", bracketId),
    sb.from("saga_marches")
      .select("id, crew_id, user_id, origin_zone_id, target_zone_id, march_kind, inf, cav, mark, werk, started_at, arrives_at, status")
      .eq("bracket_id", bracketId).in("status", ["marching", "arrived"]),
    sb.from("saga_mega_camps")
      .select("id, zone_id, spawned_at, expires_at, hp_total, hp_remaining, status")
      .eq("bracket_id", bracketId).eq("status", "active"),
    sb.from("saga_battles")
      .select("id, zone_id, attacker_crew_id, defender_crew_id, attacker_inf, attacker_cav, attacker_mark, attacker_werk, defender_inf, defender_cav, defender_mark, defender_werk, attacker_losses_dead, defender_losses_dead, outcome, battle_kind, created_at")
      .eq("bracket_id", bracketId).order("created_at", { ascending: false }).limit(50),
    sb.from("saga_holy_holders").select("*").eq("bracket_id", bracketId),
    sb.from("saga_user_positions").select("user_id, current_zone_id, field_inf, field_cav, field_mark, field_werk").eq("bracket_id", bracketId),
    sb.from("saga_augur_milestones").select("*").eq("bracket_id", bracketId).order("achieved_at", { ascending: false }),
    sb.from("saga_rallies").select("*").eq("bracket_id", bracketId).in("status", ["gathering","marching"]),
    sb.from("saga_diplomacy").select("*").eq("bracket_id", bracketId).in("status", ["proposed","active"]),
  ]);

  if (bracket.error || !bracket.data) {
    return NextResponse.json({ ok: false, error: "bracket_not_found" }, { status: 404 });
  }

  const { data: city } = await sb.from("saga_city_pool")
    .select("*").eq("slug", bracket.data.city_slug).single();

  // Adjacency nach bracket filtern (RPC kann's nicht direkt joinen, wir filtern hier)
  const zoneIds = new Set((zones.data ?? []).map((z) => z.id));
  const filteredAdj = (adj.data ?? []).filter((a) => zoneIds.has(a.zone_a) && zoneIds.has(a.zone_b));

  return NextResponse.json({
    ok: true,
    bracket: bracket.data,
    city,
    zones: zones.data ?? [],
    crews: crews.data ?? [],
    adjacency: filteredAdj.map((a) => ({ zone_a: a.zone_a, zone_b: a.zone_b, via_gate_zone: a.via_gate_zone })),
    buildings: buildings.data ?? [],
    marches: marches.data ?? [],
    mega_camps: megas.data ?? [],
    recent_battles: battles.data ?? [],
    holy_holders: holyHolders.data ?? [],
    user_positions: userPositions.data ?? [],
    augur_milestones: augur.data ?? [],
    rallies: rallies.data ?? [],
    diplomacy: diplomacy.data ?? [],
  });
}

/**
 * POST /api/admin/saga/bracket-detail — Test-Aktionen
 *   { bracket_id, action: "force_open_gate", zone_id }
 *   { bracket_id, action: "force_claim_zone", zone_id, crew_id }
 *   { bracket_id, action: "force_destroy_building", building_id }
 *   { bracket_id, action: "spawn_mega", zone_id, hp }
 */
export async function POST(req: NextRequest) {
  await requireStaff();
  const sb = await createClient();
  const body = await req.json();
  const action = body.action as string;

  if (action === "force_open_gate") {
    const { error } = await sb.from("saga_zones")
      .update({ gate_state: "open" })
      .eq("id", body.zone_id);
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  if (action === "force_close_gate") {
    const { error } = await sb.from("saga_zones")
      .update({ gate_state: "closed" })
      .eq("id", body.zone_id);
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  if (action === "force_claim_zone") {
    const { error } = await sb.from("saga_zones")
      .update({ owner_crew_id: body.crew_id })
      .eq("id", body.zone_id);
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  if (action === "force_destroy_building") {
    const { error } = await sb.from("saga_buildings")
      .update({ hp: 0, destroyed_at: new Date().toISOString() })
      .eq("id", body.building_id);
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  if (action === "spawn_mega") {
    const expires = new Date(Date.now() + 48 * 3600 * 1000).toISOString();
    const { data, error } = await sb.from("saga_mega_camps").insert({
      bracket_id: body.bracket_id,
      zone_id: body.zone_id,
      expires_at: expires,
      hp_total: body.hp ?? 100000,
      hp_remaining: body.hp ?? 100000,
      status: "active",
    }).select("id").single();
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, id: data.id });
  }

  if (action === "toggle_holy_site") {
    const { error } = await sb.from("saga_zones").update({
      is_holy_site: body.is_holy_site,
      holy_buff_kind: body.holy_buff_kind ?? "troop_atk",
      holy_buff_pct: body.holy_buff_pct ?? 5,
    }).eq("id", body.zone_id);
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  if (action === "toggle_gather_tile") {
    const { error } = await sb.from("saga_zones").update({
      is_gather_tile: body.is_gather_tile,
      gather_kind: body.gather_kind ?? "tech_schrott",
      gather_yield_per_hour: body.gather_yield_per_hour ?? 100,
      gather_capacity: body.gather_capacity ?? 10000,
      gather_remaining: body.gather_capacity ?? 10000,
    }).eq("id", body.zone_id);
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  if (action === "give_inventory") {
    const { error } = await sb.from("saga_user_inventory").upsert({
      user_id: body.user_id,
      bracket_id: body.bracket_id,
      item_kind: body.item_kind,
      qty: body.qty ?? 1,
    }, { onConflict: "user_id,bracket_id,item_kind" });
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  if (action === "force_advance_phase") {
    const { error } = await sb.from("saga_brackets").update({ current_phase: body.phase }).eq("id", body.bracket_id);
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  if (action === "force_resolve_now") {
    const { data, error } = await sb.rpc("saga_resolve_arrived_marches");
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, result: data });
  }

  return NextResponse.json({ ok: false, error: "unknown_action" }, { status: 400 });
}
