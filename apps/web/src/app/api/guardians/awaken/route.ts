import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** POST — Body: { guardian_id } → Erweckung des Wächters (Endgame, ab 5 Sternen) */
export async function POST(req: Request) {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ ok: false, error: "not_authenticated" }, { status: 401 });
  const body = await req.json() as { guardian_id?: string };
  if (!body.guardian_id) return NextResponse.json({ ok: false, error: "missing_guardian_id" }, { status: 400 });
  const { data, error } = await sb.rpc("awaken_guardian", { p_guardian_id: body.guardian_id });
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
