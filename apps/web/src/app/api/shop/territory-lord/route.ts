import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/shop/territory-lord?business_id=X
 * Sagt dem Runner, ob er Gebietsfürst dieses Shops ist (Premium-Feature).
 */
export async function GET(req: NextRequest) {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ is_lord: false, active: false });
  const url = new URL(req.url);
  const businessId = url.searchParams.get("business_id");
  if (!businessId) return NextResponse.json({ is_lord: false, active: false });

  const [{ data: biz }, { data: isLord }] = await Promise.all([
    sb.from("local_businesses").select("territory_bonus_until, territory_bonus_radius_m, territory_bonus_min_claims").eq("id", businessId).maybeSingle(),
    sb.rpc("is_territory_lord", { p_user_id: user.id, p_business_id: businessId }),
  ]);

  const active = !!(biz?.territory_bonus_until && new Date(biz.territory_bonus_until) > new Date());
  return NextResponse.json({
    is_lord: !!isLord,
    active,
    radius_m: biz?.territory_bonus_radius_m ?? 500,
    min_claims: biz?.territory_bonus_min_claims ?? 10,
    active_until: biz?.territory_bonus_until ?? null,
  });
}
