import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/arena/session
 * Liefert aktuelle Arena-Session + Top-Leaderboards (Runner + Crews).
 */
export async function GET(req: Request) {
  const sb = await createClient();
  const url = new URL(req.url);
  const forUserId = url.searchParams.get("for_user_id");
  const forCrewId = url.searchParams.get("for_crew_id");

  const { data: sessions } = await sb.from("arena_sessions")
    .select("id, name, starts_at, ends_at, status")
    .eq("status", "active")
    .order("starts_at", { ascending: false })
    .limit(1);
  const session = sessions?.[0] ?? null;

  async function fetchTitles(column: "user_id" | "crew_id", value: string) {
    const { data } = await sb.from("arena_session_titles")
      .select("id, session_id, rank, title, awarded_at, arena_sessions!inner(name)")
      .eq(column, value)
      .order("awarded_at", { ascending: false })
      .limit(10);
    return data ?? [];
  }

  if (!session) {
    if (forUserId) return NextResponse.json({ session: null, runners: [], crews: [], titles: await fetchTitles("user_id", forUserId) });
    if (forCrewId) return NextResponse.json({ session: null, runners: [], crews: [], titles: await fetchTitles("crew_id", forCrewId) });
    return NextResponse.json({ session: null, runners: [], crews: [] });
  }

  const [{ data: runners }, { data: crews }, { data: titles }] = await Promise.all([
    sb.from("arena_session_user_scores")
      .select("user_id, wins, losses, fusions, trophies, points, users!inner(display_name, username, avatar_url)")
      .eq("session_id", session.id)
      .order("points", { ascending: false })
      .order("wins", { ascending: false })
      .limit(20),
    sb.from("arena_session_crew_scores")
      .select("crew_id, wins, losses, points, crews!inner(name, color, custom_emblem_url)")
      .eq("session_id", session.id)
      .order("points", { ascending: false })
      .order("wins", { ascending: false })
      .limit(20),
    (async () => {
      if (forUserId) return { data: await fetchTitles("user_id", forUserId) };
      if (forCrewId) return { data: await fetchTitles("crew_id", forCrewId) };
      return { data: [] as Array<{ id: string; session_id: string; rank: number; title: string; awarded_at: string; arena_sessions: { name: string } }> };
    })(),
  ]);

  return NextResponse.json({ session, runners: runners ?? [], crews: crews ?? [], titles: titles ?? [] });
}
