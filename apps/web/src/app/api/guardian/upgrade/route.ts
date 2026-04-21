import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/guardian/upgrade
 * Body: { user_item_id }
 * Upgrades the item one tier if materials available.
 */
export async function POST(req: NextRequest) {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ ok: false, error: "auth" }, { status: 401 });

  const { user_item_id } = await req.json() as { user_item_id: string };
  if (!user_item_id) return NextResponse.json({ ok: false, error: "missing_id" }, { status: 400 });

  const { data, error } = await sb.rpc("upgrade_item", { p_user_item_id: user_item_id });
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
