import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/arena/session
 * Liefert aktuelle Arena-Session + Top-Leaderboards (Runner + Crews).
 */
export async function GET() {
  const sb = await createClient();

  const { data: sessions } = await sb.from("arena_sessions")
    .select("id, name, starts_at, ends_at, status")
    .eq("status", "active")
    .order("starts_at", { ascending: false })
    .limit(1);
  const session = sessions?.[0] ?? null;
  if (!session) return NextResponse.json({ session: null, runners: [], crews: [] });

  const [{ data: runners }, { data: crews }] = await Promise.all([
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
  ]);

  return NextResponse.json({ session, runners: runners ?? [], crews: crews ?? [] });
}
