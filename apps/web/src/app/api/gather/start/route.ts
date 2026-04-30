import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/gather/start
 * Body: { node_id: number, guardian_id: string, troop_count: number, user_lat: number, user_lng: number }
 */
export async function POST(req: Request) {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: "auth_required" }, { status: 401 });

  let body: { node_id?: number; guardian_id?: string; troop_count?: number; user_lat?: number; user_lng?: number };
  try { body = await req.json(); } catch { return NextResponse.json({ error: "invalid_json" }, { status: 400 }); }

  const { node_id, guardian_id, troop_count, user_lat, user_lng } = body;
  if (typeof node_id !== "number" || typeof guardian_id !== "string" || typeof troop_count !== "number" || typeof user_lat !== "number" || typeof user_lng !== "number") {
    return NextResponse.json({ error: "missing_params" }, { status: 400 });
  }
  if (troop_count < 1) return NextResponse.json({ error: "troop_count_min_1" }, { status: 400 });

  const { data, error } = await sb.rpc("start_gather_march", {
    p_node_id: node_id,
    p_guardian_id: guardian_id,
    p_troop_count: troop_count,
    p_user_lat: user_lat,
    p_user_lng: user_lng,
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data ?? { ok: true });
}
