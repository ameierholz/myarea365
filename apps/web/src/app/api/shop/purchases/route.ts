import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/shop/purchases?business_id=...
 * Rechnungshistorie für einen Shop, den der User besitzt.
 */
export async function GET(req: NextRequest) {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ purchases: [] });

  const businessId = new URL(req.url).searchParams.get("business_id");
  if (!businessId) return NextResponse.json({ purchases: [] });

  const { data: shop } = await sb.from("local_businesses")
    .select("id").eq("id", businessId).eq("owner_id", user.id).maybeSingle();
  if (!shop) return NextResponse.json({ purchases: [] });

  const { data } = await sb.from("purchases")
    .select("id, product_name, amount_cents, status, created_at")
    .eq("business_id", businessId)
    .order("created_at", { ascending: false })
    .limit(10);

  return NextResponse.json({ purchases: data ?? [] });
}
