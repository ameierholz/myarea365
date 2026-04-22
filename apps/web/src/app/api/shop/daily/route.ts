import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { bumpMissionProgress } from "@/lib/missions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/shop/daily
 * Liefert tägliche Packs + welche der User heute schon gekauft hat.
 */
export async function GET() {
  const sb = await createClient();
  const { data: auth } = await sb.auth.getUser();
  if (!auth?.user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const today = new Date().toISOString().slice(0, 10); // UTC YYYY-MM-DD

  const [{ data: packs }, { data: purchases }, { data: gems }] = await Promise.all([
    sb.from("daily_deal_packs").select("*").eq("active", true).order("sort"),
    sb.from("user_daily_purchases")
      .select("pack_id").eq("user_id", auth.user.id).eq("purchased_utc_date", today),
    sb.from("user_gems").select("gems").eq("user_id", auth.user.id).maybeSingle<{ gems: number }>(),
  ]);

  const purchasedIds = new Set((purchases ?? []).map((p) => p.pack_id));

  // Zeit bis Reset (00:00 UTC) in Sekunden
  const now = new Date();
  const tomorrow = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1));
  const secondsUntilReset = Math.max(0, Math.floor((tomorrow.getTime() - now.getTime()) / 1000));

  return NextResponse.json({
    packs: packs ?? [],
    purchased_today: Array.from(purchasedIds),
    gems: gems?.gems ?? 0,
    reset_in_seconds: secondsUntilReset,
  });
}

/**
 * POST /api/shop/daily
 * Body: { pack_id }
 */
export async function POST(req: Request) {
  const sb = await createClient();
  const { data: auth } = await sb.auth.getUser();
  if (!auth?.user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = await req.json() as { pack_id: string };
  if (!body.pack_id) return NextResponse.json({ error: "pack_id_missing" }, { status: 400 });

  const { data, error } = await sb.rpc("purchase_daily_deal", { p_pack_id: body.pack_id });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Missions-Progress: täglicher Pack-Kauf
  const ok = (data as { ok?: boolean } | null)?.ok;
  if (ok) {
    await bumpMissionProgress(sb, auth.user.id, "daily_pack_bought", 1);
  }

  return NextResponse.json(data);
}
