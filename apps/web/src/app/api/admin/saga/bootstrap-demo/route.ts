import { NextResponse, type NextRequest } from "next/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { requireStaff } from "@/lib/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/admin/saga/bootstrap-demo  { city_slug?, crew_count? }
 *
 * Admin-Shortcut: erstellt eine aktive Saga-Round + Bracket für die gewünschte
 * Stadt + ordnet die eigene Crew dem Bracket zu. Falls eine aktive Round +
 * Berlin-Bracket bereits existieren: idempotent, fügt nur die Crew hinzu.
 *
 * Nutzt Service-Role-Client: saga_rounds/brackets/signups haben nur public
 * READ-Policies — INSERTs müssen RLS umgehen. Auth ist über requireStaff()
 * upfront geprüft.
 *
 * Liefert bracket_id zurück, damit der Client direkt /api/admin/saga/generate-map
 * aufrufen kann (~30-60s Overpass-Call, separates Loading).
 */
const DUMMY_CREW_IDS = [
  "11111111-1111-1111-1111-111111111111", // Kaelthors Kiez-Crew
  "22222222-2222-2222-2222-222222222222", // Weißensee Walker
  "33333333-3333-3333-3333-333333333333", // Friedrichshain Foxes
];
const COLORS = ["#22D1C3", "#FF2D78", "#FFD700", "#22c55e", "#FF6B4A", "#8B5CF6", "#06B6D4", "#F472B6"];

function getServiceSb() {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("missing_service_role_env");
  return createServiceClient(url, key, { auth: { persistSession: false } });
}

export async function POST(req: NextRequest) {
  const ctx = await requireStaff();
  const sb = getServiceSb();
  const body = await req.json().catch(() => ({}));
  const citySlug: string = body.city_slug ?? "berlin";
  const crewCount: number = Math.max(2, Math.min(8, body.crew_count ?? 4));

  // 1) Admin's eigene Crew finden — falls keine: in die erste verfügbare
  //    Dummy-Crew eintragen (Admin-Observer-Fallback).
  let { data: cm } = await sb.from("crew_members")
    .select("crew_id").eq("user_id", ctx.userId).maybeSingle();
  if (!cm) {
    for (const dummyId of DUMMY_CREW_IDS) {
      const { data: exists } = await sb.from("crews").select("id").eq("id", dummyId).maybeSingle();
      if (!exists) continue;
      const { error } = await sb.from("crew_members").insert({
        user_id: ctx.userId, crew_id: dummyId, role: "member",
      });
      if (!error) { cm = { crew_id: dummyId }; break; }
    }
    if (!cm) {
      return NextResponse.json({
        ok: false, error: "admin_no_crew_and_no_dummy",
        message: "Admin ist in keiner Crew und keine Dummy-Crew verfügbar.",
      }, { status: 400 });
    }
  }

  // 2) Stadt validieren
  const { data: city } = await sb.from("saga_city_pool")
    .select("slug, name, size_tier").eq("slug", citySlug).maybeSingle();
  if (!city) return NextResponse.json({ ok: false, error: "city_not_found" }, { status: 404 });

  // 3) Aktive Round finden oder anlegen
  let { data: round } = await sb.from("saga_rounds")
    .select("id").eq("status", "active")
    .order("created_at", { ascending: false }).limit(1).maybeSingle();
  if (!round) {
    const now = Date.now();
    const offset = (d: number) => new Date(now + d * 86400000).toISOString();
    const { data: created, error } = await sb.from("saga_rounds").insert({
      name: `Demo-Round ${new Date().toISOString().slice(0, 10)}`,
      status: "active",
      signup_starts: offset(-8),
      signup_ends: offset(-1),
      match_starts: offset(-1),
      auftakt_ends: offset(-0.01),
      main_ends: offset(28),
      apex_window_ends: offset(30),
      awards_ends: offset(32),
    }).select("id").single();
    if (error || !created) return NextResponse.json({ ok: false, error: error?.message ?? "round_create_failed" }, { status: 500 });
    round = created;
  }

  // 4) Bracket für Stadt finden oder anlegen
  let { data: bracket } = await sb.from("saga_brackets")
    .select("id, crew_count, status").eq("round_id", round.id).eq("city_slug", citySlug)
    .maybeSingle();
  if (!bracket) {
    const { data: created, error } = await sb.from("saga_brackets").insert({
      round_id: round.id,
      city_slug: citySlug,
      size_tier: city.size_tier,
      crew_count: crewCount,
      status: "main",
      current_phase: 4,
    }).select("id, crew_count, status").single();
    if (error || !created) return NextResponse.json({ ok: false, error: error?.message ?? "bracket_create_failed" }, { status: 500 });
    bracket = created;
  }

  // 5) Admin's Crew anmelden
  await sb.from("saga_signups").upsert({
    round_id: round.id, crew_id: cm.crew_id, bracket_id: bracket.id,
    signed_up_by: ctx.userId, member_count_at_signup: 1, power_score_at_signup: 0,
  }, { onConflict: "round_id,crew_id" });
  await sb.from("saga_bracket_crews").upsert({
    bracket_id: bracket.id, crew_id: cm.crew_id, color_hex: COLORS[0],
  }, { onConflict: "bracket_id,crew_id" });

  // 6) Dummy-Crews auffüllen
  let placed = 1;
  for (const dummyId of DUMMY_CREW_IDS) {
    if (placed >= crewCount) break;
    if (dummyId === cm.crew_id) continue;
    const { data: exists } = await sb.from("crews").select("id").eq("id", dummyId).maybeSingle();
    if (!exists) continue;
    await sb.from("saga_signups").upsert({
      round_id: round.id, crew_id: dummyId, bracket_id: bracket.id,
      signed_up_by: ctx.userId, member_count_at_signup: 1, power_score_at_signup: 0,
    }, { onConflict: "round_id,crew_id" });
    await sb.from("saga_bracket_crews").upsert({
      bracket_id: bracket.id, crew_id: dummyId, color_hex: COLORS[placed % COLORS.length],
    }, { onConflict: "bracket_id,crew_id" });
    placed++;
  }

  const { count: zonesCount } = await sb.from("saga_zones")
    .select("id", { count: "exact", head: true }).eq("bracket_id", bracket.id);

  return NextResponse.json({
    ok: true,
    round_id: round.id,
    bracket_id: bracket.id,
    city: city.name,
    city_slug: citySlug,
    crews_placed: placed,
    zones_existing: zonesCount ?? 0,
    needs_map_gen: (zonesCount ?? 0) === 0,
  });
}
