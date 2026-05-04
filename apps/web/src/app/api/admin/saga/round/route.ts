import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireStaff } from "@/lib/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET  /api/admin/saga/round  → Snapshot aller Rounds + City-Pool + Signups
 * POST /api/admin/saga/round  → Aktionen
 *   { action: "create", name, signup_starts }
 *   { action: "force_matchmake", round_id }
 *   { action: "force_advance_phases" }
 *   { action: "force_resolve_marches" }
 *   { action: "force_finalize_round", round_id }
 */
export async function GET() {
  await requireStaff();
  const sb = await createClient();

  const [rounds, cityPool, signups, brackets] = await Promise.all([
    sb.from("saga_rounds")
      .select("id, name, status, signup_starts, signup_ends, match_starts, auftakt_ends, main_ends, awards_ends, created_at")
      .order("created_at", { ascending: false }).limit(20),
    sb.from("saga_city_pool").select("*").order("size_tier").order("name"),
    sb.from("saga_signups")
      .select("round_id, crew_id, member_count_at_signup, power_score_at_signup, bracket_id, signed_up_at, crews:crew_id(name, slug)")
      .order("signed_up_at", { ascending: false }).limit(200),
    sb.from("saga_brackets")
      .select("id, round_id, city_slug, size_tier, crew_count, status, current_phase, winner_crew_id")
      .order("created_at", { ascending: false }).limit(50),
  ]);

  return NextResponse.json({
    ok: true,
    rounds: rounds.data ?? [],
    city_pool: cityPool.data ?? [],
    signups: signups.data ?? [],
    brackets: brackets.data ?? [],
  });
}

export async function POST(req: NextRequest) {
  await requireStaff();
  const sb = await createClient();
  const body = await req.json();

  if (body.action === "create") {
    if (!body.name || !body.signup_starts) {
      return NextResponse.json({ ok: false, error: "name + signup_starts required" }, { status: 400 });
    }
    const start = new Date(body.signup_starts);
    const signupEnds = new Date(start); signupEnds.setUTCDate(signupEnds.getUTCDate() + 7);
    const matchStarts = new Date(signupEnds);
    const auftaktEnds = new Date(matchStarts); auftaktEnds.setUTCDate(auftaktEnds.getUTCDate() + 8);
    const mainEnds = new Date(auftaktEnds); mainEnds.setUTCDate(mainEnds.getUTCDate() + 28);
    const apexEnds = new Date(mainEnds); apexEnds.setUTCDate(apexEnds.getUTCDate() + 2);
    const awardsEnds = new Date(apexEnds); awardsEnds.setUTCDate(awardsEnds.getUTCDate() + 2);

    const { data, error } = await sb.from("saga_rounds").insert({
      name: body.name,
      status: "signup",
      signup_starts: start.toISOString(),
      signup_ends:   signupEnds.toISOString(),
      match_starts:  matchStarts.toISOString(),
      auftakt_ends:  auftaktEnds.toISOString(),
      main_ends:     mainEnds.toISOString(),
      apex_window_ends: apexEnds.toISOString(),
      awards_ends:   awardsEnds.toISOString(),
    }).select("id").single();
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, round_id: data.id });
  }

  if (body.action === "force_matchmake") {
    if (!body.round_id) return NextResponse.json({ ok: false, error: "round_id required" }, { status: 400 });
    // Status erzwingen, dann RPC
    await sb.from("saga_rounds").update({ status: "matchmaking" }).eq("id", body.round_id);
    const { data, error } = await sb.rpc("saga_run_matchmaking", { p_round_id: body.round_id });
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, result: data });
  }

  if (body.action === "force_advance_phases") {
    const { data, error } = await sb.rpc("saga_advance_phases");
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, result: data });
  }

  if (body.action === "force_resolve_marches") {
    const { data, error } = await sb.rpc("saga_resolve_arrived_marches");
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, result: data });
  }

  if (body.action === "force_finalize_round") {
    if (!body.round_id) return NextResponse.json({ ok: false, error: "round_id required" }, { status: 400 });
    await sb.from("saga_brackets").update({ status: "finalized" }).eq("round_id", body.round_id).neq("status", "finalized");
    const { data } = await sb.rpc("saga_finalize_brackets");
    await sb.from("saga_rounds").update({ status: "finalized" }).eq("id", body.round_id);
    return NextResponse.json({ ok: true, result: data });
  }

  return NextResponse.json({ ok: false, error: "unknown_action" }, { status: 400 });
}
