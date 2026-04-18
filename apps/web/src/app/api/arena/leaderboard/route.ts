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
    // Top 50 Waechter nach wins
    const { data: top } = await sb.from("crew_guardians")
      .select("id, crew_id, archetype_id, level, wins, losses")
      .eq("is_active", true)
      .order("wins", { ascending: false })
      .limit(50);
    if (!top || top.length === 0) return NextResponse.json({ entries: [] });

    const crewIds = Array.from(new Set(top.map((g: { crew_id: string }) => g.crew_id)));
    const archIds = Array.from(new Set(top.map((g: { archetype_id: string }) => g.archetype_id)));
    const [crewsRes, archsRes] = await Promise.all([
      sb.from("crews").select("id, name").in("id", crewIds),
      sb.from("guardian_archetypes").select("id, name, emoji, rarity").in("id", archIds),
    ]);
    const crewMap = new Map((crewsRes.data ?? []).map((c: { id: string; name: string }) => [c.id, c]));
    const archMap = new Map((archsRes.data ?? []).map((a: { id: string; name: string; emoji: string; rarity: string }) => [a.id, a]));

    const entries = top.map((g: { id: string; crew_id: string; archetype_id: string; level: number; wins: number; losses: number }, idx: number) => ({
      rank: idx + 1,
      crew: crewMap.get(g.crew_id) ?? { id: g.crew_id, name: "Unbekannt" },
      guardian: archMap.get(g.archetype_id) ?? null,
      level: g.level,
      wins: g.wins,
      losses: g.losses,
    }));
    return NextResponse.json({ entries });
  }

  if (scope === "crew") {
    const crewId = url.searchParams.get("crew_id");
    if (!crewId) return NextResponse.json({ error: "crew_id required" }, { status: 400 });
    const { data: g } = await sb.from("crew_guardians")
      .select("id, archetype_id, level, xp, wins, losses, current_hp_pct, wounded_until")
      .eq("crew_id", crewId).eq("is_active", true).maybeSingle();
    const { data: trophies } = await sb.from("guardian_trophies")
      .select("id, archetype_id, captured_level, captured_at")
      .eq("crew_id", crewId)
      .order("captured_at", { ascending: false });
    return NextResponse.json({ guardian: g, trophies: trophies ?? [] });
  }

  return NextResponse.json({ error: "unknown scope" }, { status: 400 });
}
