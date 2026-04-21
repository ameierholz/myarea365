import { NextResponse } from "next/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Vercel-Cron-Endpoint (1x/Tag): schließt abgelaufene Arena-Sessions automatisch
 * und startet die nächste (RPC `close_arena_session` enthält Bootstrap).
 *
 * Auth: Vercel sendet Header `Authorization: Bearer <CRON_SECRET>` aus ENV.
 * Lokal kannst du den Endpoint mit demselben Header manuell aufrufen.
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

  const { data: expired } = await sb.from("arena_sessions")
    .select("id, name, ends_at")
    .eq("status", "active")
    .lte("ends_at", new Date().toISOString());

  const closed: Array<{ id: string; name: string }> = [];
  for (const s of expired ?? []) {
    const typedS = s as { id: string; name: string; ends_at: string };
    const { data, error } = await sb.rpc("close_arena_session", { p_session_id: typedS.id });
    if (!error && (data as { ok?: boolean })?.ok) {
      closed.push({ id: typedS.id, name: typedS.name });
    }
  }

  return NextResponse.json({ ok: true, closed_count: closed.length, closed });
}
