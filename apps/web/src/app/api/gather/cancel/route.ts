import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/gather/cancel
 * Body: { march_id: number }
 * Setzt einen aktiven Sammel-Marsch sofort in "returning" — Truppen kehren um.
 */
export async function POST(req: Request) {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: "auth_required" }, { status: 401 });

  let body: { march_id?: number };
  try { body = await req.json(); } catch { return NextResponse.json({ error: "invalid_json" }, { status: 400 }); }
  if (typeof body.march_id !== "number") return NextResponse.json({ error: "missing_march_id" }, { status: 400 });

  const { data, error } = await sb.rpc("cancel_gather_march", { p_march_id: body.march_id });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data ?? { ok: true });
}
