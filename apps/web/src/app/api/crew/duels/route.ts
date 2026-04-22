import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/crew/duels?crew_id=... → aktuelles + letzte Duelle mit Gegner-Info */
export async function GET(req: NextRequest) {
  const sb = await createClient();
  const crewId = new URL(req.url).searchParams.get("crew_id");
  if (!crewId) return NextResponse.json({ error: "crew_id required" }, { status: 400 });

  const { data, error } = await sb
    .from("crew_duels")
    .select("id, week_start, crew_a_id, crew_b_id, crew_a_km, crew_b_km, winner_crew_id, status, prize_xp, finished_at, crew_a:crew_a_id(id, name, color), crew_b:crew_b_id(id, name, color)")
    .or(`crew_a_id.eq.${crewId},crew_b_id.eq.${crewId}`)
    .order("week_start", { ascending: false })
    .limit(10);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  type CrewMini = { id: string; name: string; color: string | null };
  type Row = {
    id: string; week_start: string; crew_a_id: string; crew_b_id: string;
    crew_a_km: number; crew_b_km: number; winner_crew_id: string | null;
    status: string; prize_xp: number; finished_at: string | null;
    crew_a: CrewMini | CrewMini[] | null;
    crew_b: CrewMini | CrewMini[] | null;
  };
  const duels = ((data ?? []) as Row[]).map((d) => ({
    id: d.id,
    week_start: d.week_start,
    crew_a: Array.isArray(d.crew_a) ? d.crew_a[0] : d.crew_a,
    crew_b: Array.isArray(d.crew_b) ? d.crew_b[0] : d.crew_b,
    crew_a_km: Number(d.crew_a_km),
    crew_b_km: Number(d.crew_b_km),
    winner_crew_id: d.winner_crew_id,
    status: d.status,
    prize_xp: d.prize_xp,
    finished_at: d.finished_at,
    my_side: d.crew_a_id === crewId ? "a" : "b",
  }));

  return NextResponse.json({ duels });
}

/** POST /api/crew/duels  → triggert Scheduler manuell (wenn diese Woche noch keins) */
export async function POST() {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { data, error } = await sb.rpc("schedule_weekly_crew_duels");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ created: data ?? 0 });
}
