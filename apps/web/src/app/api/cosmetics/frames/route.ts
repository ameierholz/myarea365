import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET — alle Frames + welche der User besitzt + welcher equipped */
export async function GET() {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ ok: false, error: "not_authenticated" }, { status: 401 });
  const [allR, ownedR] = await Promise.all([
    sb.from("avatar_frames").select("*").eq("active", true).order("rarity"),
    sb.from("user_avatar_frames").select("frame_id, equipped, unlocked_at").eq("user_id", user.id),
  ]);
  return NextResponse.json({ ok: true, frames: allR.data ?? [], owned: ownedR.data ?? [] });
}

/** POST — { action: "buy"|"equip", frame_id } */
export async function POST(req: Request) {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ ok: false, error: "not_authenticated" }, { status: 401 });
  const body = await req.json() as { action?: string; frame_id?: string };
  if (!body.frame_id) return NextResponse.json({ ok: false, error: "missing_frame_id" }, { status: 400 });
  const fn = body.action === "equip" ? "equip_avatar_frame" : "buy_avatar_frame";
  const { data, error } = await sb.rpc(fn, { p_frame_id: body.frame_id });
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
