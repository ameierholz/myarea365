import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ ok: false, error: "auth_required" }, { status: 401 });

  const { id } = await params;
  const body = await req.json().catch(() => ({})) as { user_id?: string };
  if (!body.user_id) return NextResponse.json({ ok: false, error: "user_id_required" }, { status: 400 });

  const { data, error } = await sb.rpc("kick_crew_rally_participant", { p_rally_id: id, p_user_id: body.user_id });
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
