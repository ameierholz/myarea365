import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/base/theme
 * Body: { theme_id: string }
 */
export async function POST(req: Request) {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: "not_authenticated" }, { status: 401 });

  const body = (await req.json()) as { theme_id?: string };
  if (!body.theme_id) return NextResponse.json({ error: "missing_theme_id" }, { status: 400 });

  const { data, error } = await sb.rpc("set_base_theme", { p_theme_id: body.theme_id });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
