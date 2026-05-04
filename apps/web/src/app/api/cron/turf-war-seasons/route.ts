import { NextResponse } from "next/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Vercel-Cron (Montag 00:10 UTC): finalisiert alle abgelaufenen Crew-Saisons
 * (= Turf-Krieg-Liga) und verteilt Top-50-Gebietsruf-Belohnungen an die
 * Mitglieder der platzierten Crews.
 *
 * RPC: finalize_crew_seasons() — schließt active+expired Seasons ab.
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

  const { data, error } = await sb.rpc("finalize_crew_seasons");
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

  const finalized = (data ?? []) as Array<{
    season_id: string; crews_ranked: number; rep_paid: number;
  }>;
  const total_rep = finalized.reduce((s, r) => s + Number(r.rep_paid ?? 0), 0);

  return NextResponse.json({
    ok: true,
    seasons_finalized: finalized.length,
    total_rep_paid: total_rep,
    seasons: finalized,
  });
}
