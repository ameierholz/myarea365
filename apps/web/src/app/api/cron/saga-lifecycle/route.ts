import { NextResponse } from "next/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Vercel-Cron (alle 10 min): treibt den Saga-KvK-Lifecycle voran.
 *
 *   1. saga_advance_phases()           — auftakt→main, Tor-Phasen öffnen
 *   2. saga_resolve_arrived_marches()  — angekommene Märsche auflösen (Kampf)
 *   3. saga_check_apex_holds()         — 48h-Apex-Hold prüft auf Sieg
 *   4. saga_finalize_brackets()        — beendete Brackets → Rewards verteilen
 *   5. signup → matchmaking transition (zeitbasiert)
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
  const now = new Date().toISOString();
  const log: Record<string, unknown> = {};

  // 1) signup → matchmaking transition (Zeit erreicht?)
  const { data: signupReady } = await sb
    .from("saga_rounds")
    .select("id")
    .eq("status", "signup")
    .lte("signup_ends", now);

  log.matchmaking_transition = (signupReady ?? []).length;
  for (const r of signupReady ?? []) {
    await sb.from("saga_rounds").update({ status: "matchmaking" }).eq("id", r.id);
  }

  // 2) advance_phases
  const { data: phases } = await sb.rpc("saga_advance_phases");
  log.phases_advanced = phases ?? [];

  // 3) resolve_arrived_marches
  const { data: marches } = await sb.rpc("saga_resolve_arrived_marches");
  log.marches_resolved = marches ?? [];

  // 4) check_apex_holds
  const { data: apex } = await sb.rpc("saga_check_apex_holds");
  log.apex_winners = apex ?? [];

  // 5) finalize_brackets
  const { data: finals } = await sb.rpc("saga_finalize_brackets");
  log.brackets_finalized = finals ?? [];

  // 6) Tick-Funktionen: Buffs/Shields auslaufen, Action-Points reset, Holy-Tick, Augur-Rewards
  const [{ data: buffTick }, { data: apTick }, { data: holyTick }, { data: augurDist }] = await Promise.all([
    sb.rpc("saga_buff_tick"),
    sb.rpc("saga_ap_reset"),
    sb.rpc("saga_holy_tick"),
    sb.rpc("saga_distribute_augur_rewards"),
  ]);
  log.buff_tick = buffTick ?? [];
  log.ap_reset = apTick ?? 0;
  log.holy_tick = holyTick ?? 0;
  log.augur_rewards_distributed = augurDist ?? 0;

  // 6) round → finalized (alle brackets der round sind finalized)
  const { data: roundsToClose } = await sb
    .from("saga_rounds")
    .select("id")
    .eq("status", "active")
    .lte("awards_ends", now);
  for (const r of roundsToClose ?? []) {
    await sb.from("saga_rounds").update({ status: "finalized" }).eq("id", r.id);
  }
  log.rounds_closed = (roundsToClose ?? []).length;

  return NextResponse.json({ ok: true, ...log });
}
