import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const { business_id, deal_id } = await req.json() as { business_id: string; deal_id: string };
  if (!business_id || !deal_id) return NextResponse.json({ ok: false, error: "Bad request" }, { status: 400 });

  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ ok: false, error: "Nicht eingeloggt" }, { status: 401 });

  const { data, error } = await sb.rpc("redeem_deal", {
    p_user_id: user.id, p_business_id: business_id, p_deal_id: deal_id,
  });
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
