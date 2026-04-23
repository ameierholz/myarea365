import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/crew/members?crew_id=... → Live-Members mit XP/Rollen */
export async function GET(req: NextRequest) {
  const sb = await createClient();
  const crewId = new URL(req.url).searchParams.get("crew_id");
  if (!crewId) return NextResponse.json({ error: "crew_id required" }, { status: 400 });

  const { data, error } = await sb
    .from("crew_members")
    .select("user_id, role, joined_at, user:user_id(id, username, display_name, avatar_url, level, xp, wegemuenzen, gebietsruf, sessionehre, team_color, last_seen_at, streak_days)")
    .eq("crew_id", crewId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  type UserShape = {
    id: string; username: string | null; display_name: string | null; avatar_url: string | null;
    level: number | null; xp: number | null;
    wegemuenzen: number | null; gebietsruf: number | null; sessionehre: number | null;
    team_color: string | null; last_seen_at: string | null; streak_days: number | null;
  };
  type Row = {
    user_id: string; role: string; joined_at: string | null;
    user: UserShape | UserShape[] | null;
  };
  const members = ((data ?? []) as Row[]).map((r) => {
    const u = Array.isArray(r.user) ? r.user[0] : r.user;
    return {
      user_id: r.user_id,
      role: r.role,
      joined_at: r.joined_at,
      username: u?.username ?? null,
      display_name: u?.display_name ?? null,
      avatar_url: u?.avatar_url ?? null,
      level: u?.level ?? 1,
      xp: u?.xp ?? 0,
      wegemuenzen: u?.wegemuenzen ?? 0,
      gebietsruf:  u?.gebietsruf ?? 0,
      sessionehre: u?.sessionehre ?? 0,
      team_color: u?.team_color ?? null,
      last_seen_at: u?.last_seen_at ?? null,
      streak_days: u?.streak_days ?? 0,
    };
  }).sort((a, b) => (b.gebietsruf ?? 0) - (a.gebietsruf ?? 0));

  return NextResponse.json({ members });
}
