import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/shop/pin-theme
 * Liefert aktuelles Theme + alle vom User freigeschalteten Themes.
 */
export async function GET() {
  const sb = await createClient();
  const { data: auth } = await sb.auth.getUser();
  if (!auth?.user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const [{ data: user }, { data: purchases }] = await Promise.all([
    sb.from("users").select("pin_theme, role").eq("id", auth.user.id).maybeSingle<{ pin_theme: string | null; role: string | null }>(),
    sb.from("user_shop_purchases").select("shop_item_id").eq("user_id", auth.user.id),
  ]);

  const unlockedThemes = new Set<string>(["default"]);
  const isAdmin = user?.role === "admin" || user?.role === "super_admin";
  if (isAdmin) {
    for (const id of ["neon","cyberpunk","arcade","golden","frost"]) unlockedThemes.add(id);
  }
  for (const p of (purchases ?? [])) {
    if (p.shop_item_id.startsWith("pin_theme_")) {
      unlockedThemes.add(p.shop_item_id.replace("pin_theme_", ""));
    }
  }

  return NextResponse.json({
    active: user?.pin_theme ?? "default",
    unlocked: Array.from(unlockedThemes),
  });
}

/**
 * POST /api/shop/pin-theme
 * Body: { theme: "default"|"neon"|... }
 */
export async function POST(req: Request) {
  const sb = await createClient();
  const { data: auth } = await sb.auth.getUser();
  if (!auth?.user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = await req.json() as { theme: string };
  const { data, error } = await sb.rpc("set_active_pin_theme", { p_theme: body.theme });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
