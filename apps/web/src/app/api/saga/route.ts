import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/saga
 *   → { active_round, signup_open, my_crew_signed_up, my_bracket?, zones?, marches?, my_state?, all_brackets? }
 */
export async function GET() {
  const sb = await createClient();
  const { data: auth } = await sb.auth.getUser();
  const userId = auth?.user?.id ?? null;

  // Aktuelle Round (signup oder active)
  const { data: round } = await sb
    .from("saga_rounds")
    .select("id, name, status, signup_starts, signup_ends, match_starts, auftakt_ends, main_ends, apex_window_ends, awards_ends")
    .in("status", ["signup", "matchmaking", "active"])
    .order("signup_starts", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!round) {
    return NextResponse.json({ active_round: null });
  }

  // Crew des Users
  let myCrewId: string | null = null;
  let myRole: string | null = null;
  if (userId) {
    const { data: cm } = await sb.from("crew_members")
      .select("crew_id, role")
      .eq("user_id", userId)
      .maybeSingle();
    if (cm) { myCrewId = cm.crew_id; myRole = cm.role; }
  }

  // Bracket des Users (wenn Crew angemeldet & gematcht)
  let myBracket: { id: string; city_slug: string; status: string; current_phase: number; crew_count: number } | null = null;
  let myCrewSignedUp = false;
  if (myCrewId) {
    const { data: signup } = await sb.from("saga_signups")
      .select("bracket_id")
      .eq("round_id", round.id)
      .eq("crew_id", myCrewId)
      .maybeSingle();
    if (signup) myCrewSignedUp = true;
    if (signup?.bracket_id) {
      const { data: b } = await sb.from("saga_brackets")
        .select("id, city_slug, status, current_phase, crew_count")
        .eq("id", signup.bracket_id).single();
      myBracket = b;
    }
  }

  // Wenn User in einem Bracket: Zonen + Märsche + State + alles drum herum
  let zones = null, marches = null, myState = null, bracketCrews = null, city = null;
  let myPosition = null, buildings = null, myInventory = null, myMerits = null, myResources = null;
  let activeBuffs = null, myShield = null, myLazarett = null;
  let pendingAttacks = null, recentBattles = null, augurMilestones = null;
  let activeRallies = null, activeMegas = null, activeDiplomacy = null;
  let userPositions = null;

  if (myBracket) {
    const [zr, mr, sr, br, cr, pos, bld, inv, mm, mr2, ab, ush, lz, pa, rb, am, rl, mg, dp, up] = await Promise.all([
      sb.from("saga_zones")
        .select("id, name, zone_kind, ring, centroid_lat, centroid_lng, polygon, owner_crew_id, gate_kind, gate_phase, gate_state, resource_bonus_pct, resource_kind, is_holy_site, holy_buff_kind, holy_buff_pct, is_gather_tile, gather_yield_per_hour, gather_kind, gather_remaining")
        .eq("bracket_id", myBracket.id),
      sb.from("saga_marches")
        .select("id, crew_id, user_id, origin_zone_id, target_zone_id, target_user_id, march_kind, inf, cav, mark, werk, guardian_id, started_at, arrives_at, status, rally_parent_id")
        .eq("bracket_id", myBracket.id).in("status", ["marching", "arrived"]),
      userId ? sb.from("saga_user_state").select("*").eq("user_id", userId).maybeSingle() : Promise.resolve({ data: null }),
      sb.from("saga_bracket_crews")
        .select("crew_id, color_hex, spawn_zone_id, auftakt_points, merits, zones_held, buildings_count, troops_killed, troops_lost, final_rank, crews:crew_id(name, slug)")
        .eq("bracket_id", myBracket.id),
      sb.from("saga_city_pool").select("name, apex_name, apex_lat, apex_lng, apex_emoji, bbox_south, bbox_west, bbox_north, bbox_east").eq("slug", myBracket.city_slug).single(),
      userId ? sb.from("saga_user_positions").select("*").eq("user_id", userId).eq("bracket_id", myBracket.id).maybeSingle() : Promise.resolve({ data: null }),
      sb.from("saga_buildings").select("id, zone_id, crew_id, building_kind, hp, max_hp, built_at, destroyed_at").eq("bracket_id", myBracket.id).is("destroyed_at", null),
      userId ? sb.from("saga_user_inventory").select("item_kind, qty").eq("user_id", userId).eq("bracket_id", myBracket.id) : Promise.resolve({ data: null }),
      userId ? sb.from("saga_user_merits").select("*").eq("user_id", userId).eq("bracket_id", myBracket.id).maybeSingle() : Promise.resolve({ data: null }),
      userId ? sb.from("saga_user_resources").select("*").eq("user_id", userId).eq("bracket_id", myBracket.id).maybeSingle() : Promise.resolve({ data: null }),
      userId ? sb.from("saga_active_buffs").select("*").eq("user_id", userId).eq("bracket_id", myBracket.id).gt("expires_at", new Date().toISOString()) : Promise.resolve({ data: null }),
      userId ? sb.from("saga_user_shields").select("*").eq("user_id", userId).eq("bracket_id", myBracket.id).maybeSingle() : Promise.resolve({ data: null }),
      userId ? sb.from("saga_lazarett").select("*").eq("user_id", userId).eq("bracket_id", myBracket.id).maybeSingle() : Promise.resolve({ data: null }),
      userId ? sb.from("saga_pending_attacks").select("*").eq("bracket_id", myBracket.id) : Promise.resolve({ data: null }),
      sb.from("saga_battles").select("*").eq("bracket_id", myBracket.id).order("created_at", { ascending: false }).limit(20),
      sb.from("saga_augur_milestones").select("*").eq("bracket_id", myBracket.id).order("achieved_at", { ascending: false }),
      sb.from("saga_rallies").select("*").eq("bracket_id", myBracket.id).in("status", ["gathering", "marching"]),
      sb.from("saga_mega_camps").select("*").eq("bracket_id", myBracket.id).eq("status", "active"),
      sb.from("saga_diplomacy").select("*").eq("bracket_id", myBracket.id).in("status", ["proposed", "active"]),
      sb.from("saga_user_positions").select("user_id, current_zone_id, field_inf, field_cav, field_mark, field_werk, field_guardian_id").eq("bracket_id", myBracket.id),
    ]);
    zones = zr.data; marches = mr.data; myState = sr.data; bracketCrews = br.data; city = cr.data;
    myPosition = pos.data; buildings = bld.data; myInventory = inv.data; myMerits = mm.data;
    myResources = mr2.data; activeBuffs = ab.data; myShield = ush.data; myLazarett = lz.data;
    pendingAttacks = pa.data; recentBattles = rb.data; augurMilestones = am.data;
    activeRallies = rl.data; activeMegas = mg.data; activeDiplomacy = dp.data;
    userPositions = up.data;
  }

  // Alle Brackets der Round (für Bracket-Übersicht ohne signup)
  const { data: allBrackets } = await sb.from("saga_brackets")
    .select("id, city_slug, size_tier, crew_count, status, current_phase")
    .eq("round_id", round.id);

  return NextResponse.json({
    active_round: round,
    signup_open: round.status === "signup",
    my_crew_signed_up: myCrewSignedUp,
    my_crew_id: myCrewId,
    my_role: myRole,
    my_bracket: myBracket,
    zones, marches, my_state: myState, bracket_crews: bracketCrews, city,
    my_position: myPosition, buildings, my_inventory: myInventory, my_merits: myMerits,
    my_resources: myResources, active_buffs: activeBuffs, my_shield: myShield, my_lazarett: myLazarett,
    pending_attacks: pendingAttacks, recent_battles: recentBattles, augur_milestones: augurMilestones,
    active_rallies: activeRallies, active_megas: activeMegas, active_diplomacy: activeDiplomacy,
    user_positions: userPositions,
    all_brackets: allBrackets ?? [],
  });
}

/**
 * POST /api/saga
 *   { action: "signup" }                                             — Crew anmelden
 *   { action: "withdraw" }                                           — Anmeldung zurückziehen
 *   { action: "build_repeater", zone_id }
 *   { action: "build_hauptgebaeude", zone_id }
 *   { action: "start_march", origin_zone_id, target_zone_id, kind, inf, cav, mark, werk, guardian_id? }
 *   { action: "recall_march", march_id }
 */
export async function POST(req: NextRequest) {
  const sb = await createClient();
  const { data: auth } = await sb.auth.getUser();
  if (!auth?.user) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });

  const body = await req.json();
  const action = body.action as string;

  if (action === "signup") {
    const { data: round } = await sb.from("saga_rounds").select("id").eq("status", "signup").limit(1).maybeSingle();
    if (!round) return NextResponse.json({ ok: false, error: "no_signup_round" }, { status: 400 });
    const { data, error } = await sb.rpc("saga_signup_crew", { p_round_id: round.id });
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    return NextResponse.json(Array.isArray(data) ? data[0] : { ok: false });
  }

  if (action === "withdraw") {
    const { data: round } = await sb.from("saga_rounds").select("id").eq("status", "signup").limit(1).maybeSingle();
    if (!round) return NextResponse.json({ ok: false, error: "no_signup_round" }, { status: 400 });
    const { data, error } = await sb.rpc("saga_withdraw_crew", { p_round_id: round.id });
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    return NextResponse.json(Array.isArray(data) ? data[0] : { ok: false });
  }

  if (action === "build_repeater") {
    const { data, error } = await sb.rpc("saga_build_repeater", { p_zone_id: body.zone_id });
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    return NextResponse.json(Array.isArray(data) ? data[0] : { ok: false });
  }

  if (action === "build_hauptgebaeude") {
    const { data, error } = await sb.rpc("saga_build_hauptgebaeude", { p_zone_id: body.zone_id });
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    return NextResponse.json(Array.isArray(data) ? data[0] : { ok: false });
  }

  if (action === "start_march") {
    const { data, error } = await sb.rpc("saga_start_march", {
      p_origin_zone_id: body.origin_zone_id,
      p_target_zone_id: body.target_zone_id,
      p_kind: body.kind,
      p_inf: body.inf ?? 0,
      p_cav: body.cav ?? 0,
      p_mark: body.mark ?? 0,
      p_werk: body.werk ?? 0,
      p_guardian_id: body.guardian_id ?? null,
    });
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    return NextResponse.json(Array.isArray(data) ? data[0] : { ok: false });
  }

  if (action === "recall_march") {
    const { data, error } = await sb.rpc("saga_recall_march", { p_march_id: body.march_id });
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    return NextResponse.json(Array.isArray(data) ? data[0] : { ok: false });
  }

  if (action === "redirect_march") {
    const { data, error } = await sb.rpc("saga_redirect_march", { p_march_id: body.march_id, p_new_target_zone_id: body.new_target_zone_id });
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    return NextResponse.json(Array.isArray(data) ? data[0] : { ok: false });
  }

  if (action === "relocate_base") {
    const { data, error } = await sb.rpc("saga_relocate_base", { p_target_zone_id: body.zone_id });
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    return NextResponse.json(Array.isArray(data) ? data[0] : { ok: false });
  }

  if (action === "hide_in_building") {
    const { data, error } = await sb.rpc("saga_hide_in_building", { p_building_id: body.building_id });
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    return NextResponse.json(Array.isArray(data) ? data[0] : { ok: false });
  }

  if (action === "unhide_from_building") {
    const { data, error } = await sb.rpc("saga_unhide_from_building", {
      p_building_id: body.building_id,
      p_inf: body.inf ?? 0, p_cav: body.cav ?? 0, p_mark: body.mark ?? 0, p_werk: body.werk ?? 0,
    });
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    return NextResponse.json(Array.isArray(data) ? data[0] : { ok: false });
  }

  if (action === "deploy_multi") {
    const { data, error } = await sb.rpc("saga_deploy_multi", { p_legions: body.legions });
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    return NextResponse.json(Array.isArray(data) ? data[0] : { ok: false });
  }

  if (action === "attack_user") {
    const { data, error } = await sb.rpc("saga_attack_user", {
      p_target_user_id: body.target_user_id,
      p_inf: body.inf ?? 0, p_cav: body.cav ?? 0, p_mark: body.mark ?? 0, p_werk: body.werk ?? 0,
      p_guardian_id: body.guardian_id ?? null,
    });
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    return NextResponse.json(Array.isArray(data) ? data[0] : { ok: false });
  }

  if (action === "send_reinforcement") {
    const { data, error } = await sb.rpc("saga_send_reinforcement", {
      p_target_zone_id: body.target_zone_id,
      p_inf: body.inf ?? 0, p_cav: body.cav ?? 0, p_mark: body.mark ?? 0, p_werk: body.werk ?? 0,
      p_guardian_id: body.guardian_id ?? null,
    });
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    return NextResponse.json(Array.isArray(data) ? data[0] : { ok: false });
  }

  if (action === "start_rally") {
    const { data, error } = await sb.rpc("saga_start_rally", {
      p_target_zone_id: body.target_zone_id, p_joinable_minutes: body.joinable_minutes ?? 60,
    });
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    return NextResponse.json(Array.isArray(data) ? data[0] : { ok: false });
  }

  if (action === "join_rally") {
    const { data, error } = await sb.rpc("saga_join_rally", {
      p_rally_id: body.rally_id,
      p_inf: body.inf ?? 0, p_cav: body.cav ?? 0, p_mark: body.mark ?? 0, p_werk: body.werk ?? 0,
      p_guardian_id: body.guardian_id ?? null,
    });
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    return NextResponse.json(Array.isArray(data) ? data[0] : { ok: false });
  }

  if (action === "cancel_rally") {
    const { data, error } = await sb.rpc("saga_cancel_rally", { p_rally_id: body.rally_id });
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    return NextResponse.json(Array.isArray(data) ? data[0] : { ok: false });
  }

  if (action === "start_gather") {
    const { data, error } = await sb.rpc("saga_start_gather", {
      p_zone_id: body.zone_id,
      p_inf: body.inf ?? 0, p_cav: body.cav ?? 0, p_mark: body.mark ?? 0, p_werk: body.werk ?? 0,
      p_guardian_id: body.guardian_id ?? null,
    });
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    return NextResponse.json(Array.isArray(data) ? data[0] : { ok: false });
  }

  if (action === "use_buff_item") {
    const { data, error } = await sb.rpc("saga_use_buff_item", { p_item_kind: body.item_kind });
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    return NextResponse.json(Array.isArray(data) ? data[0] : { ok: false });
  }

  if (action === "use_migration_item") {
    const { data, error } = await sb.rpc("saga_use_migration_item", {
      p_item_kind: body.item_kind, p_target_zone_id: body.target_zone_id ?? null,
    });
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    return NextResponse.json(Array.isArray(data) ? data[0] : { ok: false });
  }

  if (action === "propose_nap") {
    const { data, error } = await sb.rpc("saga_propose_nap", { p_other_crew_id: body.other_crew_id, p_hours: body.hours ?? 24 });
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    return NextResponse.json(Array.isArray(data) ? data[0] : { ok: false });
  }

  if (action === "accept_nap") {
    const { data, error } = await sb.rpc("saga_accept_nap", { p_dip_id: body.dip_id });
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    return NextResponse.json(Array.isArray(data) ? data[0] : { ok: false });
  }

  if (action === "break_nap") {
    const { data, error } = await sb.rpc("saga_break_nap", { p_dip_id: body.dip_id });
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    return NextResponse.json(Array.isArray(data) ? data[0] : { ok: false });
  }

  if (action === "attack_behemoth") {
    const { data, error } = await sb.rpc("saga_attack_behemoth", {
      p_mega_id: body.mega_id,
      p_inf: body.inf ?? 0, p_cav: body.cav ?? 0, p_mark: body.mark ?? 0, p_werk: body.werk ?? 0,
      p_guardian_id: body.guardian_id ?? null,
    });
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    return NextResponse.json(Array.isArray(data) ? data[0] : { ok: false });
  }

  if (action === "mark_battle_viewed") {
    const { error } = await sb.from("saga_battles")
      .update({ viewed_by_attacker: true })
      .eq("id", body.battle_id).eq("attacker_user_id", auth.user.id);
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ ok: false, error: "unknown_action" }, { status: 400 });
}
