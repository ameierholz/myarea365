import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/base/build
 * Body: { building_id: string, position_x?: number, position_y?: number }
 * Wenn das Gebäude noch nicht existiert → build, sonst → upgrade.
 */
export async function POST(req: Request) {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: "not_authenticated" }, { status: 401 });

  const body = await req.json() as { building_id?: string; position_x?: number; position_y?: number };
  if (!body.building_id) return NextResponse.json({ error: "missing_building_id" }, { status: 400 });

  const { data, error } = await sb.rpc("start_building", {
    p_building_id: body.building_id,
    p_position_x:  body.position_x ?? 0,
    p_position_y:  body.position_y ?? 0,
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
