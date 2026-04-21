import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/runner-fights/opponents?refresh=1
 * Liefert 10 Matchmade-Gegner + Tagesstatus (Fights-Used, nächster Gem-Preis).
 */
export async function GET(req: NextRequest) {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ ok: false, error: "auth" }, { status: 401 });

  const url = new URL(req.url);
  const refresh = url.searchParams.get("refresh") === "1";

  const [{ data: opponentsRes }, { data: state }, { data: gems }] = await Promise.all([
    sb.rpc("runner_fight_get_opponents", { p_user_id: user.id, p_force_refresh: refresh }),
    sb.from("runner_fight_state").select("fights_used_today, gems_spent_today, refresh_used_today").eq("user_id", user.id).maybeSingle(),
    sb.from("user_gems").select("gems").eq("user_id", user.id).maybeSingle(),
  ]);

  const fightsUsed = state?.fights_used_today ?? 0;
  const { data: nextCost } = await sb.rpc("runner_fight_next_gem_cost", { p_used: fightsUsed });

  return NextResponse.json({
    ...(opponentsRes as object | null ?? { ok: false, opponents: [] }),
    fights_used_today: fightsUsed,
    gems_spent_today: state?.gems_spent_today ?? 0,
    refresh_used_today: state?.refresh_used_today ?? 0,
    next_gem_cost: nextCost,                  // 0 = gratis, -1 = gesperrt
    gems_available: gems?.gems ?? 0,
    refresh_cost: (state?.refresh_used_today ?? 0) < 1 ? 0 : 30,
  });
}
