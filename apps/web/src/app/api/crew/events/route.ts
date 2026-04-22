import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/crew/events?crew_id=... → Events + meine RSVP + attendees_count */
export async function GET(req: NextRequest) {
  const sb = await createClient();
  const crewId = new URL(req.url).searchParams.get("crew_id");
  if (!crewId) return NextResponse.json({ error: "crew_id required" }, { status: 400 });
  const { data: { user } } = await sb.auth.getUser();

  const { data: events, error } = await sb
    .from("crew_events")
    .select("*")
    .eq("crew_id", crewId)
    .gte("starts_at", new Date(Date.now() - 7 * 86400000).toISOString())
    .order("starts_at", { ascending: true })
    .limit(40);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const ids = (events ?? []).map((e) => (e as { id: string }).id);
  if (ids.length === 0) return NextResponse.json({ events: [] });

  const { data: rsvps } = await sb.from("crew_event_rsvps")
    .select("event_id, user_id, status").in("event_id", ids);

  const byEvent = new Map<string, { going: number; maybe: number; my: string | null }>();
  for (const r of rsvps ?? []) {
    const rr = r as { event_id: string; user_id: string; status: string };
    const cur = byEvent.get(rr.event_id) ?? { going: 0, maybe: 0, my: null };
    if (rr.status === "going") cur.going += 1;
    else if (rr.status === "maybe") cur.maybe += 1;
    if (user && rr.user_id === user.id) cur.my = rr.status;
    byEvent.set(rr.event_id, cur);
  }

  const out = (events ?? []).map((e) => {
    const ee = e as { id: string };
    const agg = byEvent.get(ee.id) ?? { going: 0, maybe: 0, my: null };
    return { ...e, going_count: agg.going, maybe_count: agg.maybe, my_rsvp: agg.my };
  });

  return NextResponse.json({ events: out });
}

/** POST /api/crew/events → Neues Event */
export async function POST(req: Request) {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  let body: {
    crew_id?: string; title?: string; description?: string;
    starts_at?: string; meeting_point?: string;
    meeting_lat?: number; meeting_lng?: number;
    target_distance_km?: number; target_pace_min_per_km?: number; max_attendees?: number;
  };
  try { body = await req.json(); } catch { return NextResponse.json({ error: "bad_json" }, { status: 400 }); }
  if (!body.crew_id || !body.title || !body.starts_at) return NextResponse.json({ error: "missing_fields" }, { status: 400 });

  // Muss Member sein
  const { data: mem } = await sb.from("crew_members").select("user_id").eq("crew_id", body.crew_id).eq("user_id", user.id).maybeSingle();
  if (!mem) return NextResponse.json({ error: "not_member" }, { status: 403 });

  const { data, error } = await sb.from("crew_events").insert({
    crew_id: body.crew_id,
    created_by: user.id,
    title: body.title,
    description: body.description ?? null,
    starts_at: body.starts_at,
    meeting_point: body.meeting_point ?? null,
    meeting_lat: body.meeting_lat ?? null,
    meeting_lng: body.meeting_lng ?? null,
    target_distance_km: body.target_distance_km ?? null,
    target_pace_min_per_km: body.target_pace_min_per_km ?? null,
    max_attendees: body.max_attendees ?? null,
  }).select().single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Creator automatisch als going RSVP
  await sb.from("crew_event_rsvps").upsert({
    event_id: (data as { id: string }).id,
    user_id: user.id,
    status: "going",
  });

  // Feed
  try {
    await sb.rpc("add_crew_feed", {
      p_crew_id: body.crew_id,
      p_user_id: user.id,
      p_kind: "event_created",
      p_data: { title: body.title, starts_at: body.starts_at },
    });
  } catch { /* stumm */ }

  return NextResponse.json({ event: data });
}
