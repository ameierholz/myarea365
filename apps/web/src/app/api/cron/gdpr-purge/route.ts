import { NextResponse } from "next/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Vercel-Cron-Endpoint (1x/Tag): purged User die seit > 14 Tagen
 * deletion_requested_at gesetzt haben — DSGVO-Hard-Delete.
 *
 * Auth: Vercel sendet Header `Authorization: Bearer <CRON_SECRET>`.
 *
 * Schedule (vercel.json):
 *   { "path": "/api/cron/gdpr-purge", "schedule": "0 3 * * *" }   // 03:00 UTC daily
 */
export async function GET(req: Request) {
  const auth = req.headers.get("authorization");
  const secret = process.env.CRON_SECRET;
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return NextResponse.json({ error: "supabase_env_missing" }, { status: 500 });

  const sb = createAdminClient(url, key, { auth: { persistSession: false } });

  const { data, error } = await sb.rpc("purge_due_users", { p_grace_days: 14 });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Im Audit-Log liegen jetzt die gelöschten Records — nichts an Console loggen.
  return NextResponse.json({ ok: true, ...((data as Record<string, unknown>) ?? {}) });
}
