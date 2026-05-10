import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ALLOWED_FIELDS = [
  "push_enabled", "crew_chat", "crew_events", "duels", "achievements",
  "rank_up", "shop_deals", "streak_warn", "quiet_mode",
  "quiet_start_hour", "quiet_end_hour",
  "email_weekly", "email_monthly", "email_newsletter", "email_flash_deals",
] as const;
type Field = typeof ALLOWED_FIELDS[number];

export async function GET() {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: "not_authenticated" }, { status: 401 });

  await sb.rpc("ensure_notification_prefs", { p_user_id: user.id });
  const { data, error } = await sb.from("user_notification_prefs").select("*").eq("user_id", user.id).maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, prefs: data });
}

export async function PUT(req: Request) {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: "not_authenticated" }, { status: 401 });

  const body = await req.json() as Partial<Record<Field, boolean | number>>;
  const patch: Record<string, boolean | number> = {};
  for (const k of ALLOWED_FIELDS) {
    if (k in body) {
      const v = body[k];
      if (k === "quiet_start_hour" || k === "quiet_end_hour") {
        if (typeof v === "number" && v >= 0 && v <= 23) patch[k] = v;
      } else if (typeof v === "boolean") {
        patch[k] = v;
      }
    }
  }
  await sb.rpc("ensure_notification_prefs", { p_user_id: user.id });
  const { error } = await sb.from("user_notification_prefs").update({ ...patch, updated_at: new Date().toISOString() }).eq("user_id", user.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
