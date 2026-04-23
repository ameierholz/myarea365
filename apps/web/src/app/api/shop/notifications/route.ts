import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DEFAULTS = {
  email_on_checkin: false,
  email_daily_report: true,
  email_weekly_summary: true,
  kiez_newsletter: true,
};

/** GET /api/shop/notifications?shop_id=... */
export async function GET(req: NextRequest) {
  const sb = await createClient();
  const shopId = new URL(req.url).searchParams.get("shop_id");
  if (!shopId) return NextResponse.json({ prefs: DEFAULTS });

  const { data } = await sb.from("shop_notification_prefs")
    .select("email_on_checkin, email_daily_report, email_weekly_summary, kiez_newsletter")
    .eq("shop_id", shopId).maybeSingle();
  return NextResponse.json({ prefs: data ?? DEFAULTS });
}

/** PATCH /api/shop/notifications  Body: { shop_id, ...boolean-prefs } */
export async function PATCH(req: NextRequest) {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ ok: false, error: "auth" }, { status: 401 });

  const body = await req.json() as Partial<typeof DEFAULTS> & { shop_id: string };
  if (!body.shop_id) return NextResponse.json({ ok: false, error: "missing_shop_id" }, { status: 400 });

  const row: Record<string, unknown> = { shop_id: body.shop_id, updated_at: new Date().toISOString() };
  for (const k of Object.keys(DEFAULTS) as (keyof typeof DEFAULTS)[]) {
    if (typeof body[k] === "boolean") row[k] = body[k];
  }

  const { error } = await sb.from("shop_notification_prefs")
    .upsert(row, { onConflict: "shop_id" });
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
