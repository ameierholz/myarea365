import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireStaff } from "@/lib/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/admin/seasons/stats
 * Live-Metriken der aktiven Saison: Fights, Klassen-Balance, Top-User, etc.
 */
export async function GET() {
  await requireStaff();
  const sb = await createClient();

  const { data: season } = await sb.from("arena_seasons")
    .select("id, number, name, starts_at, ends_at")
    .eq("status", "active")
    .order("starts_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!season) {
    return NextResponse.json({ ok: true, season: null });
  }

  const since24h = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
  const since7d  = new Date(Date.now() -  7 * 24 * 3600 * 1000).toISOString();

  // runner_fights archived (pivot 2026-05-05) — Stats werden im neuen Marsch-System ersetzt
  const fightsRes = { count: 0 };
  const fights24hRes = { count: 0 };
  const fights7dRes = { count: 0 };
  const pickersRes = await sb.from("user_guardians").select("id", { count: "exact", head: true }).eq("kind", "seasonal").eq("season_id", (season as { id: string }).id);

  // Klassen-Balance: Pick + Win pro class_id (tank/support/ranged/melee)
  const { data: seasonalGuardians } = await sb.from("user_guardians")
    .select("user_id, archetype_id, wins, losses, guardian_archetypes!inner(class_id)")
    .eq("kind", "seasonal")
    .eq("season_id", (season as { id: string }).id);

  type ClassStat = { picks: number; wins: number; losses: number };
  const classStats = new Map<string, ClassStat>();
  type SGRow = { user_id: string; archetype_id: string; wins: number; losses: number; guardian_archetypes: { class_id: string | null } | { class_id: string | null }[] };
  for (const g of (seasonalGuardians ?? []) as SGRow[]) {
    const ga = Array.isArray(g.guardian_archetypes) ? g.guardian_archetypes[0] : g.guardian_archetypes;
    const c = ga?.class_id ?? "unknown";
    const cur = classStats.get(c) ?? { picks: 0, wins: 0, losses: 0 };
    cur.picks += 1; cur.wins += g.wins; cur.losses += g.losses;
    classStats.set(c, cur);
  }

  const classBalance = Array.from(classStats.entries()).map(([class_id, s]) => ({
    class_id,
    picks: s.picks,
    wins: s.wins,
    losses: s.losses,
    win_pct: s.wins + s.losses > 0 ? Math.round((s.wins / (s.wins + s.losses)) * 100) : 0,
  })).sort((a, b) => b.picks - a.picks);

  // Top 10 Fighter dieser Saison
  const { data: topFighters } = await sb.from("user_guardians")
    .select("user_id, wins, losses, level, guardian_archetypes!inner(name, emoji), users!inner(username, display_name)")
    .eq("kind", "seasonal")
    .eq("season_id", (season as { id: string }).id)
    .order("wins", { ascending: false })
    .limit(10);

  // runner_fights archived — Daily-Curve leer
  const daily: Array<{ day: string; count: number }> = [];

  return NextResponse.json({
    ok: true,
    season,
    kpis: {
      total_fights:   fightsRes.count ?? 0,
      fights_24h:     fights24hRes.count ?? 0,
      fights_7d:      fights7dRes.count ?? 0,
      seasonal_pickers: pickersRes.count ?? 0,
    },
    class_balance: classBalance,
    top_fighters:  topFighters ?? [],
    daily,
  });
}
