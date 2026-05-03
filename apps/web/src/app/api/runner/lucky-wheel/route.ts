import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/runner/lucky-wheel
 * Returns: { event, state: { spins_used, pity_counter, total_gems_won } }
 * Liefert das aktuell aktive Event (oder null) + User-Status.
 */
export async function GET() {
  const sb = await createClient();
  const { data: auth } = await sb.auth.getUser();
  if (!auth?.user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { data: event } = await sb.from("lucky_wheel_events")
    .select("id, name, starts_at, ends_at, spin_cost_gems, max_spins, prize_pool, pity_threshold, guaranteed_pool")
    .lte("starts_at", new Date().toISOString())
    .gte("ends_at", new Date().toISOString())
    .order("starts_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!event) return NextResponse.json({ event: null, state: null });

  const { data: state } = await sb.from("user_wheel_spins")
    .select("spins_used, pity_counter, total_gems_won")
    .eq("user_id", auth.user.id).eq("event_id", event.id)
    .maybeSingle();

  return NextResponse.json({
    event,
    state: state ?? { spins_used: 0, pity_counter: 0, total_gems_won: 0 },
  });
}

/**
 * POST /api/runner/lucky-wheel
 * Body: { event_id }
 * Spinnt das Rad einmal.
 */
export async function POST(req: Request) {
  const sb = await createClient();
  const { data: auth } = await sb.auth.getUser();
  if (!auth?.user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null) as { event_id?: string } | null;
  if (!body?.event_id) return NextResponse.json({ error: "bad_request" }, { status: 400 });

  const { data, error } = await sb.rpc("spin_lucky_wheel", {
    p_user_id: auth.user.id, p_event_id: body.event_id,
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const row = Array.isArray(data) ? data[0] : data;
  if (row?.error) return NextResponse.json({ error: row.error }, { status: 400 });
  return NextResponse.json({ ok: true, prize: row });
}
