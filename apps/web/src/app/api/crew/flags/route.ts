import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/crew/flags → aktive Flag-Events + Leaderboard pro Event */
export async function GET() {
  const sb = await createClient();
  const nowIso = new Date().toISOString();

  const { data: events, error } = await sb.from("crew_flag_events")
    .select("*")
    .eq("status", "active")
    .gt("ends_at", nowIso)
    .order("ends_at", { ascending: true })
    .limit(10);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!events || events.length === 0) return NextResponse.json({ events: [] });

  // Pro Event Crew-Leaderboard
  const eventIds = events.map((e) => (e as { id: string }).id);
  const { data: visits } = await sb.from("crew_flag_visits")
    .select("event_id, crew_id, crew:crew_id(id, name, color)")
    .in("event_id", eventIds);

  type Row = { event_id: string; crew_id: string | null; crew: { id: string; name: string; color: string | null } | { id: string; name: string; color: string | null }[] | null };
  const byEvent = new Map<string, Map<string, { crew_id: string; name: string; color: string | null; visits: number }>>();
  for (const v of (visits ?? []) as Row[]) {
    if (!v.crew_id) continue;
    const c = Array.isArray(v.crew) ? v.crew[0] : v.crew;
    if (!c) continue;
    const byCrew = byEvent.get(v.event_id) ?? new Map();
    const cur = byCrew.get(v.crew_id) ?? { crew_id: v.crew_id, name: c.name, color: c.color, visits: 0 };
    cur.visits += 1;
    byCrew.set(v.crew_id, cur);
    byEvent.set(v.event_id, byCrew);
  }

  const out = events.map((e) => {
    const ee = e as { id: string };
    const lb = Array.from(byEvent.get(ee.id)?.values() ?? []).sort((a, b) => b.visits - a.visits);
    return { ...e, leaderboard: lb.slice(0, 5) };
  });

  return NextResponse.json({ events: out });
}

/** POST /api/crew/flags/visit  { event_id, lat, lng } → registriert Visit */
export async function POST(req: Request) {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  let body: { event_id?: string; lat?: number; lng?: number };
  try { body = await req.json(); } catch { return NextResponse.json({ error: "bad_json" }, { status: 400 }); }
  if (!body.event_id || body.lat == null || body.lng == null) return NextResponse.json({ error: "missing_fields" }, { status: 400 });

  // GPS-Check: in Radius?
  const { data: event } = await sb.from("crew_flag_events")
    .select("id, lat, lng, radius_m, status, ends_at")
    .eq("id", body.event_id).maybeSingle<{ id: string; lat: number; lng: number; radius_m: number; status: string; ends_at: string }>();
  if (!event) return NextResponse.json({ error: "not_found" }, { status: 404 });
  if (event.status !== "active") return NextResponse.json({ error: "not_active" }, { status: 400 });
  if (new Date(event.ends_at).getTime() < Date.now()) return NextResponse.json({ error: "expired" }, { status: 400 });

  // Haversine
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(body.lat - Number(event.lat));
  const dLng = toRad(body.lng - Number(event.lng));
  const a = Math.sin(dLat/2)**2 + Math.cos(toRad(body.lat)) * Math.cos(toRad(Number(event.lat))) * Math.sin(dLng/2)**2;
  const distM = 2 * R * Math.asin(Math.sqrt(a));
  if (distM > event.radius_m) return NextResponse.json({ error: "out_of_range", distance: Math.round(distM) }, { status: 400 });

  // User-Crew
  const { data: prof } = await sb.from("users").select("current_crew_id").eq("id", user.id).maybeSingle<{ current_crew_id: string | null }>();
  const crewId = prof?.current_crew_id ?? null;

  const { data: result, error } = await sb.rpc("register_flag_visit", {
    p_event_id: body.event_id,
    p_user_id: user.id,
    p_crew_id: crewId,
  });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(result ?? { ok: true });
}
