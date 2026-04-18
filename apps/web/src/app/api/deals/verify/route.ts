import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const { code, business_id } = await req.json() as { code: string; business_id: string };
  if (!code || !business_id) return NextResponse.json({ ok: false, error: "Bad request" }, { status: 400 });

  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ ok: false, error: "Nicht eingeloggt" }, { status: 401 });

  const { data, error } = await sb.rpc("verify_redemption", {
    p_code: code, p_business_id: business_id, p_verified_by: user.id,
  });
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

  // Nach erfolgreichem Verify: Loot rollen und auf Runner-Waechter anwenden.
  const verifyResult = data as { ok?: boolean; id?: string; xp_paid?: number } | null;
  if (verifyResult?.ok && verifyResult.id) {
    const { data: loot } = await sb.rpc("award_redemption_loot", { p_redemption_id: verifyResult.id });
    return NextResponse.json({ ...verifyResult, loot });
  }
  return NextResponse.json(data);
}
