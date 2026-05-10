import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** POST /api/admin/server/new-era — Body: { city_slug } */
export async function POST(req: Request) {
  await requireAdmin();
  const sb = await createClient();
  const b = await req.json() as { city_slug?: string };
  if (!b.city_slug) return NextResponse.json({ ok: false, error: "missing_city_slug" }, { status: 400 });
  const { data, error } = await sb.rpc("start_new_era", { p_city_slug: b.city_slug });
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
