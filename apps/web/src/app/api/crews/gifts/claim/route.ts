import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** POST /api/crews/gifts/claim
 *  Body: { gift_id?: string }  — wenn gift_id fehlt → claim_all
 */
export async function POST(req: NextRequest) {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: "not_authenticated" }, { status: 401 });

  let body: { gift_id?: string } = {};
  try { body = await req.json() as { gift_id?: string }; } catch { /* noop */ }

  if (body.gift_id) {
    const { data, error } = await sb.rpc("claim_crew_gift", { p_gift_id: body.gift_id });
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json(data ?? {});
  }

  const { data, error } = await sb.rpc("claim_all_crew_gifts");
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json(data ?? {});
}
