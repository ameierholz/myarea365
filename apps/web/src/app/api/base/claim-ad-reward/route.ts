import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** POST /api/base/claim-ad-reward — Body: { kind: 'daily' | 'cooldown' } */
export async function POST(req: Request) {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: "not_authenticated" }, { status: 401 });

  const body = (await req.json().catch(() => ({}))) as { kind?: string };
  const kind = body.kind === "cooldown" ? "cooldown" : "daily";
  const { data, error } = await sb.rpc("claim_ad_reward", { p_kind: kind });
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json(data);
}
