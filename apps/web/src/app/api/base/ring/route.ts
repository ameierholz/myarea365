import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ring = {
  id: string;
  name: string;
  description: string;
  rarity: "common" | "advanced" | "epic" | "legendary";
  unlock_kind: "free" | "vip" | "coins" | "event" | "crew_level" | "achievement";
  unlock_value: number;
  preview_emoji: string;
  preview_color: string;
  sort: number;
  is_active: boolean;
};

/** GET /api/base/ring → Katalog + Inventar + Equipped */
export async function GET() {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: "not_authenticated" }, { status: 401 });

  const [rings, owned, equipped] = await Promise.all([
    sb.from("base_rings").select("*").eq("is_active", true).order("sort"),
    sb.from("user_base_rings").select("ring_id").eq("user_id", user.id),
    sb.from("users").select("equipped_base_ring_id").eq("id", user.id).maybeSingle(),
  ]);

  const ownedSet = new Set(((owned.data ?? []) as Array<{ ring_id: string }>).map((r) => r.ring_id));
  const equippedId = ((equipped.data as { equipped_base_ring_id: string | null } | null)?.equipped_base_ring_id) ?? "default";

  const items = ((rings.data ?? []) as Ring[]).map((r) => ({
    ...r,
    owned: ownedSet.has(r.id) || r.unlock_kind === "free",
    equipped: r.id === equippedId,
  }));

  return NextResponse.json({ items, equipped_id: equippedId });
}

/** POST /api/base/ring  Body: { action: 'equip'|'claim', ring_id } */
export async function POST(req: Request) {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: "not_authenticated" }, { status: 401 });

  const body = await req.json() as { action?: "equip" | "claim"; ring_id?: string };
  if (!body.ring_id || !body.action) return NextResponse.json({ error: "missing_params" }, { status: 400 });

  const rpc = body.action === "equip" ? "set_base_ring" : "claim_base_ring";
  const { data, error } = await sb.rpc(rpc, { p_ring_id: body.ring_id });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
