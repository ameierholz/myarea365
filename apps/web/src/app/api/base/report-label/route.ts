import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/base/report-label
 * Body: { base_id?: string, crew_base_id?: string, reason?: string }
 * Genau eines von beiden IDs muss gesetzt sein.
 */
export async function POST(req: Request) {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: "not_authenticated" }, { status: 401 });

  const body = (await req.json()) as { base_id?: string; crew_base_id?: string; reason?: string };
  if (!body.base_id && !body.crew_base_id) return NextResponse.json({ error: "missing_target" }, { status: 400 });

  const { data, error } = await sb.rpc("report_base_label", {
    p_base_id: body.base_id ?? null,
    p_crew_base_id: body.crew_base_id ?? null,
    p_reason: body.reason ?? null,
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json(data);
}
