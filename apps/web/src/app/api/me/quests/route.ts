import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/me/quests
 *   → Liefert alle aktiven Quests (main/side/daily/weekly/seasonal)
 *     mit Progress, completed_at, claimed_at — gruppiert nach kind.
 *     RPC ensure_user_quests legt fehlende Periode-Rows automatisch an.
 *
 * POST /api/me/quests/claim — siehe ./claim/route.ts
 */
export async function GET() {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ ok: false, error: "not_authenticated" }, { status: 401 });

  const { data, error } = await sb.rpc("get_user_quests");
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

  return NextResponse.json(data);
}
