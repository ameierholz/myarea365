import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const sb = await createClient();
  const { data: auth } = await sb.auth.getUser();
  if (!auth?.user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const uid = auth.user.id;
  // Spawn-Coords für diesen User generieren falls noch nicht da (idempotent)
  await sb.rpc("ensure_user_lore_spawns", { p_radius_km: 6.0 });
  const [setsQ, piecesQ, foundQ, claimedQ, spawnsQ] = await Promise.all([
    sb.from("lore_sets").select("*").eq("active", true).order("sort_order"),
    sb.from("lore_pieces").select("*").order("sort_order"),
    sb.from("user_lore_pieces").select("piece_id, found_at").eq("user_id", uid),
    sb.from("user_lore_sets_claimed").select("set_id, claimed_at").eq("user_id", uid),
    sb.from("user_lore_piece_spawns").select("piece_id, lat, lng").eq("user_id", uid),
  ]);
  return NextResponse.json({
    sets: setsQ.data ?? [], pieces: piecesQ.data ?? [],
    found: foundQ.data ?? [], claimed: claimedQ.data ?? [],
    spawns: spawnsQ.data ?? [],
  });
}

export async function POST(req: Request) {
  const sb = await createClient();
  const { data: auth } = await sb.auth.getUser();
  if (!auth?.user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const body = await req.json().catch(() => null) as { action?: string; piece_id?: string; set_id?: string; lat?: number; lng?: number } | null;
  if (body?.action === "pickup" && body.piece_id) {
    const { data, error } = await sb.rpc("pickup_lore_piece", {
      p_piece_id: body.piece_id,
      p_user_lat: body.lat ?? null,
      p_user_lng: body.lng ?? null,
    });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(data);
  }
  if (body?.action === "claim_set" && body.set_id) {
    const { data, error } = await sb.rpc("claim_lore_set", { p_set_id: body.set_id });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(data);
  }
  return NextResponse.json({ error: "bad_request" }, { status: 400 });
}
