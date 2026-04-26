import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/base/vip-buffs — eigener VIP-Status + alle Tier-Buffs */
export async function GET() {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: "not_authenticated" }, { status: 401 });
  const { data, error } = await sb.rpc("get_vip_buffs");
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json(data);
}

/** POST /api/base/vip-buffs — Body: { redeem_tickets: int } */
export async function POST(req: Request) {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: "not_authenticated" }, { status: 401 });
  const body = (await req.json()) as { redeem_tickets?: number };
  if (!body.redeem_tickets || body.redeem_tickets < 1) {
    return NextResponse.json({ error: "missing_count" }, { status: 400 });
  }
  const { data, error } = await sb.rpc("redeem_vip_ticket", { p_count: body.redeem_tickets });
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json(data);
}
