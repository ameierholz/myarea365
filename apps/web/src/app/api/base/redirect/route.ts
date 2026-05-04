import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** POST /api/base/redirect — Drag-Redirect für laufenden Marsch. */
export async function POST(req: NextRequest) {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: "not_authenticated" }, { status: 401 });

  const body = await req.json() as {
    attack_id: string;
    new_target_lat: number;
    new_target_lng: number;
    new_defender_user_id?: string | null;
  };
  if (!body.attack_id || typeof body.new_target_lat !== "number" || typeof body.new_target_lng !== "number") {
    return NextResponse.json({ error: "missing_params" }, { status: 400 });
  }

  const { data, error } = await sb.rpc("redirect_march", {
    p_attack_id: body.attack_id,
    p_new_target_lat: body.new_target_lat,
    p_new_target_lng: body.new_target_lng,
    p_new_defender_user_id: body.new_defender_user_id ?? null,
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
