import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/recruitment/pull
 * Body: { tier: 'silver' | 'gold' }
 * Verbraucht 1× chest_{tier} + 1× key_{tier} und gibt den Pull-Result zurück.
 */
export async function POST(req: Request) {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ ok: false, error: "auth_required" }, { status: 401 });

  const body = await req.json() as { tier?: string };
  const tier = body.tier;
  if (tier !== "silver" && tier !== "gold") {
    return NextResponse.json({ ok: false, error: "invalid_tier" }, { status: 400 });
  }

  const { data, error } = await sb.rpc("pull_recruitment", { p_tier: tier });
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
