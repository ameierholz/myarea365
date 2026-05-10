import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ ok: false, error: "not_authenticated" }, { status: 401 });
  const [allR, ownedR] = await Promise.all([
    sb.from("title_catalog").select("*").eq("active", true).order("rarity"),
    sb.from("user_titles_v2").select("title_id, equipped, unlocked_at").eq("user_id", user.id),
  ]);
  return NextResponse.json({ ok: true, titles: allR.data ?? [], owned: ownedR.data ?? [] });
}

export async function POST(req: Request) {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ ok: false, error: "not_authenticated" }, { status: 401 });
  const body = await req.json() as { action?: string; title_id?: string };
  if (!body.title_id) return NextResponse.json({ ok: false, error: "missing_title_id" }, { status: 400 });
  const fn = body.action === "equip" ? "equip_title" : "buy_title";
  const { data, error } = await sb.rpc(fn, { p_title_id: body.title_id });
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
