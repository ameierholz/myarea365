import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/base/research/instant
 * Body: { queue_id: string }
 *
 * Sofort-Fertigstellung einer Forschungs-Queue mit Diamanten
 * (1 Diamant pro Minute Restzeit, mindestens 1).
 */
export async function POST(req: Request) {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: "not_authenticated" }, { status: 401 });

  const body = await req.json() as { queue_id?: string };
  if (!body.queue_id) return NextResponse.json({ error: "missing_queue_id" }, { status: 400 });

  const { data, error } = await sb.rpc("instant_finish_research_with_gems", { p_queue_id: body.queue_id });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const row = (data as Array<{ ok: boolean; gems_used: number; error: string | null }> | null)?.[0];
  if (!row?.ok) {
    return NextResponse.json({
      ok: false,
      error: row?.error ?? "unknown",
      gems_needed: row?.gems_used ?? 0,
    }, { status: 400 });
  }
  return NextResponse.json({ ok: true, gems_used: row.gems_used });
}
