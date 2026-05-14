import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/me/city-travel
 *   Body: { targetSlug: string, hours?: number }
 *   → Aktiviert Reise-Modus: travel_city_slug + travel_expires_at werden gesetzt.
 *     Wetter-Lookups respektieren travel ab sofort.
 */
export async function POST(req: Request) {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ ok: false, error: "not_authenticated" }, { status: 401 });

  let body: { targetSlug?: string; hours?: number };
  try { body = await req.json(); } catch { body = {}; }
  const targetSlug = body.targetSlug?.trim();
  const hours = Math.max(1, Math.min(168, Number(body.hours) || 24));
  if (!targetSlug) return NextResponse.json({ ok: false, error: "missing_target" }, { status: 400 });

  const { data, error } = await sb.rpc("start_city_travel", {
    p_target_slug: targetSlug,
    p_hours: hours,
  });
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
