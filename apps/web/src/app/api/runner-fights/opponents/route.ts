import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/runner-fights/opponents?refresh=1
 * Liefert 10 Matchmade-Gegner + Tagesstatus (Fights-Used, nächster Gem-Preis).
 */
export async function GET(req: NextRequest) {
  try {
    const sb = await createClient();
    const { data: { user } } = await sb.auth.getUser();
    if (!user) return NextResponse.json({ ok: false, error: "auth" }, { status: 401 });

    const url = new URL(req.url);
    const refresh = url.searchParams.get("refresh") === "1";

    const [oppRes, stateRes, gemsRes] = await Promise.all([
      sb.rpc("runner_fight_get_opponents", { p_user_id: user.id, p_force_refresh: refresh }),
      sb.from("runner_fight_state").select("fights_used_today, gems_spent_today, refresh_used_today").eq("user_id", user.id).maybeSingle(),
      sb.from("user_gems").select("gems").eq("user_id", user.id).maybeSingle(),
    ]);

    console.log("[runner-fights/opponents]", {
      oppErr: oppRes.error?.message, oppCode: oppRes.error?.code, oppData: oppRes.data ? "present" : "null",
      stateErr: stateRes.error?.message, stateCode: stateRes.error?.code,
      gemsErr: gemsRes.error?.message,
    });

    if (oppRes.error) {
      const msg = oppRes.error.message ?? "RPC-Fehler";
      const hint = msg.includes("does not exist") || oppRes.error.code === "42883" || oppRes.error.code === "42P01"
        ? "Migration 00027 fehlt — bitte im Supabase SQL Editor ausführen."
        : msg;
      return NextResponse.json({ ok: false, error: "rpc_failed", detail: hint, opponents: [] }, { status: 500 });
    }
    if (stateRes.error && stateRes.error.code === "42P01") {
      return NextResponse.json({ ok: false, error: "table_missing", detail: "Tabelle runner_fight_state fehlt — Migration 00027 ausführen.", opponents: [] }, { status: 500 });
    }

  const state = stateRes.data;
  const gems = gemsRes.data;
  const fightsUsed = state?.fights_used_today ?? 0;
  const { data: nextCost } = await sb.rpc("runner_fight_next_gem_cost", { p_used: fightsUsed });

  return NextResponse.json({
    ...(oppRes.data as object | null ?? { ok: false, opponents: [] }),
    fights_used_today: fightsUsed,
    gems_spent_today: state?.gems_spent_today ?? 0,
    refresh_used_today: state?.refresh_used_today ?? 0,
    next_gem_cost: nextCost,                  // 0 = gratis, -1 = gesperrt
    gems_available: gems?.gems ?? 0,
    refresh_cost: (state?.refresh_used_today ?? 0) < 1 ? 0 : 30,
  });
  } catch (e) {
    console.error("[runner-fights/opponents] unexpected", e);
    return NextResponse.json({
      ok: false,
      error: "exception",
      detail: e instanceof Error ? e.message : String(e),
      opponents: [],
    }, { status: 500 });
  }
}
