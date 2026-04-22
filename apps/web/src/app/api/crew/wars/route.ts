import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/crew/wars?crew_id=... → Active + Pending + letzte finishs */
export async function GET(req: NextRequest) {
  const sb = await createClient();
  const crewId = new URL(req.url).searchParams.get("crew_id");
  if (!crewId) return NextResponse.json({ error: "crew_id required" }, { status: 400 });

  const { data, error } = await sb.from("crew_wars")
    .select("id, crew_a_id, crew_b_id, declared_by, status, starts_at, ends_at, crew_a_score, crew_b_score, crew_a_km, crew_b_km, crew_a_territories, crew_b_territories, winner_crew_id, prize_xp, finished_at, crew_a:crew_a_id(id, name, color), crew_b:crew_b_id(id, name, color)")
    .or(`crew_a_id.eq.${crewId},crew_b_id.eq.${crewId}`)
    .order("created_at", { ascending: false })
    .limit(20);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ wars: data ?? [] });
}

/** POST /api/crew/wars  { target_crew_id } — Admin erklärt Krieg */
export async function POST(req: Request) {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  let body: { target_crew_id?: string };
  try { body = await req.json(); } catch { return NextResponse.json({ error: "bad_json" }, { status: 400 }); }
  if (!body.target_crew_id) return NextResponse.json({ error: "target_crew_id required" }, { status: 400 });

  // Eigene Crew + Admin-Check
  const { data: me } = await sb.from("users").select("current_crew_id").eq("id", user.id).maybeSingle<{ current_crew_id: string | null }>();
  if (!me?.current_crew_id) return NextResponse.json({ error: "no_crew" }, { status: 400 });
  if (me.current_crew_id === body.target_crew_id) return NextResponse.json({ error: "self_target" }, { status: 400 });

  const { data: mem } = await sb.from("crew_members")
    .select("role").eq("crew_id", me.current_crew_id).eq("user_id", user.id).maybeSingle<{ role: string }>();
  if (!mem || !["admin","owner"].includes(mem.role)) return NextResponse.json({ error: "admin_only" }, { status: 403 });

  // Keine aktive/pending war zwischen diesen beiden Crews?
  const { data: existing } = await sb.from("crew_wars")
    .select("id").in("status", ["pending","active"])
    .or(`and(crew_a_id.eq.${me.current_crew_id},crew_b_id.eq.${body.target_crew_id}),and(crew_a_id.eq.${body.target_crew_id},crew_b_id.eq.${me.current_crew_id})`)
    .maybeSingle();
  if (existing) return NextResponse.json({ error: "war_already_exists" }, { status: 409 });

  const { data, error } = await sb.from("crew_wars").insert({
    crew_a_id: me.current_crew_id,
    crew_b_id: body.target_crew_id,
    declared_by: user.id,
    status: "pending",
  }).select().single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ war: data });
}

/** PATCH /api/crew/wars  { id, action: "accept" | "decline" | "cancel" } */
export async function PATCH(req: Request) {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  let body: { id?: string; action?: "accept" | "decline" | "cancel" };
  try { body = await req.json(); } catch { return NextResponse.json({ error: "bad_json" }, { status: 400 }); }
  if (!body.id || !body.action) return NextResponse.json({ error: "missing_fields" }, { status: 400 });

  const { data: war } = await sb.from("crew_wars")
    .select("id, crew_a_id, crew_b_id, status").eq("id", body.id).maybeSingle<{ id: string; crew_a_id: string; crew_b_id: string; status: string }>();
  if (!war) return NextResponse.json({ error: "not_found" }, { status: 404 });

  // Muss Admin der betroffenen Crew sein
  const targetCrew = body.action === "cancel" ? war.crew_a_id : war.crew_b_id; // Cancel = Declarer-Crew, Accept/Decline = Target-Crew
  const { data: mem } = await sb.from("crew_members")
    .select("role").eq("crew_id", targetCrew).eq("user_id", user.id).maybeSingle<{ role: string }>();
  if (!mem || !["admin","owner"].includes(mem.role)) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  if (war.status !== "pending") return NextResponse.json({ error: "not_pending" }, { status: 400 });

  let updates: Record<string, unknown> = {};
  if (body.action === "accept") {
    updates = {
      status: "active",
      starts_at: new Date().toISOString(),
      ends_at: new Date(Date.now() + 7 * 86400000).toISOString(),
    };
  } else if (body.action === "decline") {
    updates = { status: "declined" };
  } else {
    updates = { status: "cancelled" };
  }

  const { error } = await sb.from("crew_wars").update(updates).eq("id", body.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
