import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/guardian/xp-items
 * Liefert Katalog + eigenes Inventar an Wächter-XP-Elixieren.
 */
export async function GET() {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: "not_authenticated" }, { status: 401 });

  const [catalog, inv] = await Promise.all([
    sb.from("guardian_xp_items").select("id, name, emoji, description, rarity, xp_amount, sort").order("sort"),
    sb.from("user_guardian_xp_items").select("item_id, count").eq("user_id", user.id),
  ]);

  return NextResponse.json({
    catalog: catalog.data ?? [],
    inventory: inv.data ?? [],
  });
}

/**
 * POST /api/guardian/xp-items/apply
 * Body: { item_id, guardian_id, count? }
 */
export async function POST(req: Request) {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: "not_authenticated" }, { status: 401 });

  const body = await req.json() as { item_id?: string; guardian_id?: string; count?: number };
  if (!body.item_id || !body.guardian_id) {
    return NextResponse.json({ error: "missing_params" }, { status: 400 });
  }

  const { data, error } = await sb.rpc("apply_guardian_xp_item", {
    p_item_id:     body.item_id,
    p_guardian_id: body.guardian_id,
    p_count:       body.count ?? 1,
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
