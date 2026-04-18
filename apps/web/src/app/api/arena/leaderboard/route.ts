import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/arena/leaderboard?scope=global|crew
 *
 * global: top 50 Crews nach Waechter-Siegen
 * crew: einzelne Crew-Stats fuer ?crew_id
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const scope = url.searchParams.get("scope") ?? "global";
  const sb = await createClient();

  if (scope === "global") {
    // Top 50 Runner nach Waechter-Siegen
    const { data: top } = await sb.from("user_guardians")
      .select("id, user_id, crew_id, archetype_id, level, wins, losses")
      .eq("is_active", true)
      .order("wins", { ascending: false })
      .limit(50);
    if (!top || top.length === 0) return NextResponse.json({ entries: [] });

    const userIds = Array.from(new Set(top.map((g: { user_id: string }) => g.user_id)));
    const crewIds = Array.from(new Set(top.map((g: { crew_id: string | null }) => g.crew_id).filter((c): c is string => !!c)));
    const archIds = Array.from(new Set(top.map((g: { archetype_id: string }) => g.archetype_id)));
    const [usersRes, crewsRes, archsRes] = await Promise.all([
      sb.from("users").select("id, display_name, username").in("id", userIds),
      crewIds.length > 0 ? sb.from("crews").select("id, name").in("id", crewIds) : Promise.resolve({ data: [] }),
      sb.from("guardian_archetypes").select("id, name, emoji, rarity").in("id", archIds),
    ]);
    const userMap = new Map((usersRes.data ?? []).map((u: { id: string; display_name: string | null; username: string | null }) => [u.id, u]));
    const crewMap = new Map((crewsRes.data ?? []).map((c: { id: string; name: string }) => [c.id, c]));
    const archMap = new Map((archsRes.data ?? []).map((a: { id: string; name: string; emoji: string; rarity: string }) => [a.id, a]));

    const entries = top.map((g: { id: string; user_id: string; crew_id: string | null; archetype_id: string; level: number; wins: number; losses: number }, idx: number) => ({
      rank: idx + 1,
      runner: userMap.get(g.user_id) ?? { id: g.user_id, display_name: "Runner", username: null },
      crew: g.crew_id ? (crewMap.get(g.crew_id) ?? null) : null,
      guardian: archMap.get(g.archetype_id) ?? null,
      level: g.level,
      wins: g.wins,
      losses: g.losses,
    }));
    return NextResponse.json({ entries });
  }

  if (scope === "user") {
    const userId = url.searchParams.get("user_id");
    if (!userId) return NextResponse.json({ error: "user_id required" }, { status: 400 });
    const { data: g } = await sb.from("user_guardians")
      .select("id, archetype_id, level, xp, wins, losses, current_hp_pct, wounded_until")
      .eq("user_id", userId).eq("is_active", true).maybeSingle();
    const { data: trophies } = await sb.from("guardian_trophies")
      .select("id, archetype_id, captured_level, captured_at")
      .eq("user_id", userId)
      .order("captured_at", { ascending: false });
    return NextResponse.json({ guardian: g, trophies: trophies ?? [] });
  }

  return NextResponse.json({ error: "unknown scope" }, { status: 400 });
}
