import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { tierForMmr } from "@/lib/mmr-tiers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/runner/mmr
 * Liefert Elo/MMR des eingeloggten Runners + Rank-Percentile + Liga-Label.
 */
export async function GET() {
  const sb = await createClient();
  const { data: auth } = await sb.auth.getUser();
  if (!auth?.user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  // Sicherstellen dass Zeile existiert (neu registrierte Nutzer)
  await sb.rpc("runner_mmr_ensure", { p_user_id: auth.user.id });

  const [{ data: me }, { count: totalCount }, { count: aboveCount }] = await Promise.all([
    sb.from("runner_mmr")
      .select("mmr, games, wins, losses, peak_mmr, last_change, last_change_at")
      .eq("user_id", auth.user.id).maybeSingle(),
    sb.from("runner_mmr").select("user_id", { count: "exact", head: true }),
    (async () => {
      const { data: m } = await sb.from("runner_mmr").select("mmr").eq("user_id", auth.user.id).maybeSingle();
      const myMmr = (m as { mmr: number } | null)?.mmr ?? 1000;
      return sb.from("runner_mmr").select("user_id", { count: "exact", head: true }).gt("mmr", myMmr);
    })(),
  ]);

  const mmr = (me as { mmr?: number } | null)?.mmr ?? 1000;
  const total = totalCount ?? 0;
  const above = aboveCount ?? 0;
  const rank = above + 1; // 1-basiert
  const percentile = total > 0 ? Math.round(100 * (total - above) / total) : 0;
  const tier = tierForMmr(mmr);

  return NextResponse.json({
    mmr,
    games: (me as { games?: number } | null)?.games ?? 0,
    wins: (me as { wins?: number } | null)?.wins ?? 0,
    losses: (me as { losses?: number } | null)?.losses ?? 0,
    peak_mmr: (me as { peak_mmr?: number } | null)?.peak_mmr ?? 1000,
    last_change: (me as { last_change?: number } | null)?.last_change ?? 0,
    last_change_at: (me as { last_change_at?: string } | null)?.last_change_at ?? null,
    rank,
    total_players: total,
    percentile,
    tier,
  });
}

