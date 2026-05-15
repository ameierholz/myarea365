import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { rateLimitSmart, rateLimitResponse } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/mutant/rally
 * Body: { mutant_id: number, prep_seconds: 180|480|1680|28680, troops: Record<troop_id,count>, guardian_id?: string }
 *
 * Crew-Rally gegen einen Mutanten. Nur Leader; andere Crew-Member joinen über
 * den bestehenden /api/rally Endpoint (action='join').
 * Solo-Angriff existiert nicht mehr für Mutanten — nur Crew-Rally.
 */
export async function POST(req: Request) {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: "not_authenticated" }, { status: 401 });

  const rl = await rateLimitSmart(`mutant-rally:${user.id}`, 6, 60_000);
  const limited = rateLimitResponse(rl);
  if (limited) return limited;

  let body: {
    mutant_id?: number;
    prep_seconds?: number;
    troops?: Record<string, number>;
    total_troops?: number;        // alternative: server-side auto-fill aus Top-Tier
    guardian_id?: string | null;
  };
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: "invalid_json" }, { status: 400 }); }

  const { mutant_id, prep_seconds, troops, total_troops, guardian_id } = body;
  if (typeof mutant_id !== "number" || typeof prep_seconds !== "number") {
    return NextResponse.json({ error: "missing_params" }, { status: 400 });
  }

  // Auto-Fill: wenn total_troops angegeben statt explizite troops-Map, vom Server
  // mit Top-Tier-zuerst auffüllen. Vereinfacht UI (User gibt nur Total ein).
  let finalTroops: Record<string, number> = troops ?? {};
  if (!troops && typeof total_troops === "number" && total_troops > 0) {
    const { data: userTroops } = await sb
      .from("user_troops")
      .select("troop_id, count, troops_catalog:troop_id(tier, base_atk)")
      .eq("user_id", user.id)
      .gt("count", 0);
    type Row = { troop_id: string; count: number; troops_catalog: { tier: number; base_atk: number } | null };
    const rows = (userTroops ?? []) as Row[];
    rows.sort((a, b) => (b.troops_catalog?.base_atk ?? 0) - (a.troops_catalog?.base_atk ?? 0));
    let need = total_troops;
    finalTroops = {};
    for (const r of rows) {
      if (need <= 0) break;
      const take = Math.min(r.count, need);
      finalTroops[r.troop_id] = take;
      need -= take;
    }
    if (Object.keys(finalTroops).length === 0) {
      return NextResponse.json({ error: "no_troops_available" }, { status: 400 });
    }
  }

  const { data, error } = await sb.rpc("start_mutant_rally", {
    p_mutant_id:    mutant_id,
    p_prep_seconds: prep_seconds,
    p_guardian_id:  guardian_id ?? null,
    p_troops:       finalTroops,
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json(data ?? { ok: true });
}
