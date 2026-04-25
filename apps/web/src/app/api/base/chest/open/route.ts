import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/base/chest/open
 * Body: { chest_id: string }
 */
export async function POST(req: Request) {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: "not_authenticated" }, { status: 401 });

  const body = await req.json() as { chest_id?: string };
  if (!body.chest_id) return NextResponse.json({ error: "missing_chest_id" }, { status: 400 });

  const { data, error } = await sb.rpc("open_chest", { p_chest_id: body.chest_id });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
