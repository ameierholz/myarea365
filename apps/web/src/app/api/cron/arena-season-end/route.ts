import { NextResponse } from "next/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Vercel-Cron (1. des Monats, 01:00 UTC): schließt die aktuelle Arena-Saison
 * ab und startet die nächste. Verteilt Top-100-Belohnungen (Diamanten + Siegel).
 *
 * RPC: arena_season_finalize() — wrapper um arena_season_end() + Reward-Layer.
 * Danach: arena_season_start() für die nächste 30-Tage-Saison.
 *
 * Auth: Authorization: Bearer <CRON_SECRET>.
 */
export async function GET(req: Request) {
  const auth = req.headers.get("authorization");
  const secret = process.env.CRON_SECRET;
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return NextResponse.json({ error: "supabase_env_missing" }, { status: 500 });

  const sb = createAdminClient(url, key, { auth: { persistSession: false } });

  // 1) finalize (ende + Top-100-Reward)
  const { data: finalizeData, error: fErr } = await sb.rpc("arena_season_finalize");
  if (fErr) return NextResponse.json({ ok: false, step: "finalize", error: fErr.message }, { status: 500 });
  const finalize = finalizeData as { ok?: boolean; error?: string; season_id?: string } | null;
  if (!finalize?.ok) {
    // "no_active_season" ist OK — heißt nur, dass nichts zu beenden war
    if (finalize?.error === "no_active_season") {
      return NextResponse.json({ ok: true, skipped: true, reason: "no_active_season" });
    }
    return NextResponse.json({ ok: false, step: "finalize", result: finalize }, { status: 500 });
  }

  // 2) Neue Saison starten (30 Tage = 1 Monat)
  const monthName = new Date().toLocaleString("de-DE", { month: "long", year: "numeric" });
  const { data: newSeasonId, error: sErr } = await sb.rpc("arena_season_start", {
    p_name: `Arena ${monthName}`,
    p_duration_days: 30,
  });
  if (sErr) return NextResponse.json({ ok: false, step: "start", error: sErr.message }, { status: 500 });

  return NextResponse.json({
    ok: true,
    finalize,
    new_season_id: newSeasonId,
  });
}
