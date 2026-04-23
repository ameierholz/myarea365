import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/shop/delete  Body: { shop_id, confirm: "LÖSCHEN" }
 * Löscht einen Shop samt allen verknüpften Daten (Cascade).
 */
export async function POST(req: NextRequest) {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ ok: false, error: "auth" }, { status: 401 });

  const { shop_id, confirm } = await req.json() as { shop_id: string; confirm: string };
  if (!shop_id) return NextResponse.json({ ok: false, error: "missing_shop_id" }, { status: 400 });

  const { data, error } = await sb.rpc("delete_my_shop", { p_shop_id: shop_id, p_confirm: confirm });
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
