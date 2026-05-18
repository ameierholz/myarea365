import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/crews/gifts/pool?level=N → Drop-Pool-Preview für Segenstruhe */
export async function GET(req: NextRequest) {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: "not_authenticated" }, { status: 401 });
  const url = new URL(req.url);
  const levelStr = url.searchParams.get("level");
  const level = levelStr ? Math.max(1, Math.min(50, parseInt(levelStr, 10) || 1)) : null;
  const { data, error } = await sb.rpc("segenstruhe_drop_pool_preview", { p_level: level });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data ?? { level: 1, pool: [] });
}
