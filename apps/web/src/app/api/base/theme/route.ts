import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/base/theme → Theme-Katalog inkl. aktuell aktiviertes Theme + VIP-Level */
export async function GET() {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: "not_authenticated" }, { status: 401 });

  const [themes, base, vip] = await Promise.all([
    sb.from("base_themes").select("*").order("sort"),
    sb.from("bases").select("theme_id").eq("owner_user_id", user.id).maybeSingle(),
    sb.from("vip_progress").select("vip_level").eq("user_id", user.id).maybeSingle(),
  ]);

  return NextResponse.json({
    themes: themes.data ?? [],
    active_theme_id: (base.data as { theme_id: string } | null)?.theme_id ?? "plattenbau",
    vip_level: (vip.data as { vip_level: number } | null)?.vip_level ?? 0,
  });
}

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
