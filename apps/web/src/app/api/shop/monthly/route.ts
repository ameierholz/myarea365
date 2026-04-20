import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/shop/monthly
 * Liefert die aktiven Monatspacks des Users + ob heute schon geclaimt wurde.
 */
export async function GET() {
  const sb = await createClient();
  const { data: auth } = await sb.auth.getUser();
  if (!auth?.user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const today = new Date().toISOString().slice(0, 10);

  // Aktive Monthly-Pass-Käufe des Users (category='monthly_pass' und expires_at > now)
  const { data: purchases } = await sb.from("user_shop_purchases")
    .select("id, shop_item_id, expires_at, created_at, gem_shop_items:shop_item_id(id, name, icon, category, payload)")
    .eq("user_id", auth.user.id)
    .order("created_at", { ascending: false });

  type Row = {
    id: string; shop_item_id: string; expires_at: string | null; created_at: string;
    gem_shop_items: { id: string; name: string; icon: string; category: string; payload: Record<string, unknown> } |
                    Array<{ id: string; name: string; icon: string; category: string; payload: Record<string, unknown> }>;
  };

  const rows = (purchases ?? []) as Row[];
  const now = Date.now();
  const activePasses = rows
    .map((r) => ({
      ...r,
      item: Array.isArray(r.gem_shop_items) ? r.gem_shop_items[0] : r.gem_shop_items,
    }))
    .filter((r) => r.item?.category === "monthly_pass" && (!r.expires_at || new Date(r.expires_at).getTime() > now));

  // Für jeden aktiven Pass: heute schon geclaimt?
  const claimsToday = activePasses.length > 0
    ? (await sb.from("monthly_pack_claims")
        .select("purchase_id").eq("user_id", auth.user.id).eq("claim_date", today)).data ?? []
    : [];
  const claimedIds = new Set(claimsToday.map((c) => c.purchase_id));

  return NextResponse.json({
    active_passes: activePasses.map((r) => ({
      purchase_id: r.id,
      shop_item_id: r.shop_item_id,
      name: r.item.name,
      icon: r.item.icon,
      payload: r.item.payload,
      expires_at: r.expires_at,
      claimed_today: claimedIds.has(r.id),
    })),
  });
}

/**
 * POST /api/shop/monthly
 * Body: { purchase_id }
 */
export async function POST(req: Request) {
  const sb = await createClient();
  const { data: auth } = await sb.auth.getUser();
  if (!auth?.user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = await req.json() as { purchase_id: string };
  if (!body.purchase_id) return NextResponse.json({ error: "purchase_id_missing" }, { status: 400 });

  const { data, error } = await sb.rpc("claim_monthly_pack_daily", { p_purchase_id: body.purchase_id });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
