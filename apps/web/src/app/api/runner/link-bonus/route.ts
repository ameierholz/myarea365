import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const sb = await createClient();
  const { data: auth } = await sb.auth.getUser();
  if (!auth?.user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { data } = await sb.from("user_link_bonuses").select("kind, granted_at, gems").eq("user_id", auth.user.id);
  return NextResponse.json({ claimed: data ?? [] });
}

export async function POST(req: Request) {
  const sb = await createClient();
  const { data: auth } = await sb.auth.getUser();
  if (!auth?.user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const body = await req.json().catch(() => null) as { kind?: string } | null;
  if (!body?.kind) return NextResponse.json({ error: "bad_request" }, { status: 400 });
  const { data, error } = await sb.rpc("grant_link_bonus", { p_user_id: auth.user.id, p_kind: body.kind });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
