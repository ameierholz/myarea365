import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/base/speed-up
 * Body: { queue_id: string, tokens: number } (1 token = 5 min)
 */
export async function POST(req: Request) {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: "not_authenticated" }, { status: 401 });

  const body = await req.json() as { queue_id?: string; tokens?: number };
  if (!body.queue_id || !body.tokens) return NextResponse.json({ error: "missing_params" }, { status: 400 });

  const { data, error } = await sb.rpc("speed_up_building", { p_queue_id: body.queue_id, p_tokens: body.tokens });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
