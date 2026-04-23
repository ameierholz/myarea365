import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const revalidate = 60;

type TitleRow = {
  id: string;
  session_id: string;
  rank: number;
  title: string;
  awarded_at: string;
  user_id: string | null;
  crew_id: string | null;
  users: { username: string | null; display_name: string | null } | null;
  crews: { name: string | null; color: string | null } | null;
};

/**
 * GET /api/leaderboard/past-sessions
 * Listet abgeschlossene Arena-Sessions + Top-3-Titelträger pro Session.
 */
export async function GET() {
  const sb = await createClient();

  const { data: sessions } = await sb.from("arena_sessions")
    .select("id, name, starts_at, ends_at, status")
    .eq("status", "closed")
    .order("ends_at", { ascending: false })
    .limit(12);

  if (!sessions || sessions.length === 0) {
    return NextResponse.json({ sessions: [] });
  }

  const sessionIds = sessions.map((s) => s.id);
  const { data: titles } = await sb.from("arena_session_titles")
    .select("id, session_id, rank, title, awarded_at, user_id, crew_id, users:user_id(username, display_name), crews:crew_id(name, color)")
    .in("session_id", sessionIds)
    .order("rank", { ascending: true });

  const byId = new Map<string, TitleRow[]>();
  for (const t of (titles ?? []) as unknown as TitleRow[]) {
    const arr = byId.get(t.session_id) ?? [];
    arr.push(t);
    byId.set(t.session_id, arr);
  }

  return NextResponse.json({
    sessions: sessions.map((s) => ({ ...s, titles: byId.get(s.id) ?? [] })),
  });
}
