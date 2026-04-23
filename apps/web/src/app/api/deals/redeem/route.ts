import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/deals/redeem
 * Body: { business_id, deal_id, lat?, lng? }
 * Wenn lat/lng mitkommen und Runner innerhalb 80 m um den Shop ist,
 * wird die Einlösung sofort als 'verified' gespeichert → Shop-Personal
 * muss nichts tun. Fallback: pending mit 6-stelligem Code.
 */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({})) as {
    business_id?: string; deal_id?: string;
    lat?: number | null; lng?: number | null;
  };
  if (!body.business_id || !body.deal_id) {
    return NextResponse.json({ ok: false, error: "bad_request" }, { status: 400 });
  }

  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ ok: false, error: "auth" }, { status: 401 });

  const lat = typeof body.lat === "number" ? body.lat : null;
  const lng = typeof body.lng === "number" ? body.lng : null;

  const { data, error } = await sb.rpc("redeem_deal_v2", {
    p_user_id: user.id,
    p_business_id: body.business_id,
    p_deal_id: body.deal_id,
    p_lat: lat,
    p_lng: lng,
  });
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
