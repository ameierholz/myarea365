import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/runner/forge
 * Returns: { event, state, history }
 */
export async function GET() {
  const sb = await createClient();
  const { data: auth } = await sb.auth.getUser();
  if (!auth?.user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { data: event } = await sb.from("forge_events")
    .select("id, name, starts_at, ends_at, pull_cost_gems, featured_artifacts, pity_epic, pity_legendary, artifact_pool")
    .lte("starts_at", new Date().toISOString())
    .gte("ends_at", new Date().toISOString())
    .order("starts_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!event) return NextResponse.json({ event: null, state: null, history: [] });

  const [stateQ, histQ] = await Promise.all([
    sb.from("user_forge_pulls")
      .select("pulls_used, pity_epic_counter, pity_legendary_counter, featured_pulls")
      .eq("user_id", auth.user.id).eq("event_id", event.id).maybeSingle(),
    sb.from("user_forge_history")
      .select("artifact_id, artifact_name, rarity, is_featured, pulled_at")
      .eq("user_id", auth.user.id).eq("event_id", event.id)
      .order("pulled_at", { ascending: false }).limit(20),
  ]);

  return NextResponse.json({
    event,
    state: stateQ.data ?? { pulls_used: 0, pity_epic_counter: 0, pity_legendary_counter: 0, featured_pulls: 0 },
    history: histQ.data ?? [],
  });
}

/**
 * POST /api/runner/forge
 * Body: { event_id, count?: 1 | 10 }
 * Pulled 1 oder 10 Artefakte (10er = 10 RPC-Aufrufe sequentiell für korrekte Pity-Logik).
 */
export async function POST(req: Request) {
  const sb = await createClient();
  const { data: auth } = await sb.auth.getUser();
  if (!auth?.user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null) as { event_id?: string; count?: number } | null;
  if (!body?.event_id) return NextResponse.json({ error: "bad_request" }, { status: 400 });

  const count = body.count === 10 ? 10 : 1;
  const results: Array<{ artifact_id: string; artifact_name: string; emoji: string; rarity: string; is_featured: boolean }> = [];

  for (let i = 0; i < count; i++) {
    const { data, error } = await sb.rpc("pull_forge_artifact", {
      p_user_id: auth.user.id, p_event_id: body.event_id,
    });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    const row = Array.isArray(data) ? data[0] : data;
    if (row?.error) {
      if (i === 0) return NextResponse.json({ error: row.error }, { status: 400 });
      break;
    }
    results.push({
      artifact_id: row.artifact_id, artifact_name: row.artifact_name,
      emoji: row.emoji, rarity: row.rarity, is_featured: row.is_featured,
    });
  }
  return NextResponse.json({ ok: true, pulls: results });
}
