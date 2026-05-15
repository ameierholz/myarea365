import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { fetchWalkingRoute } from "@/lib/mapbox-route";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET: aktive Rally für den User (oder null)
export async function GET() {
  const sb = await createClient();
  const { data, error } = await sb.rpc("get_active_rally_for_user");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

// POST: neue Rally starten ODER bestehender beitreten
type StartBody = { action: "start"; stronghold_id: string; prep_seconds: number; guardian_id: string | null; troops: Record<string, number> };
type JoinBody  = { action: "join";  rally_id: string;   guardian_id: string | null; troops: Record<string, number> };
type ResolveBody = { action: "resolve" };

export async function POST(req: Request) {
  const sb = await createClient();
  const body = await req.json() as StartBody | JoinBody | ResolveBody;

  if (body.action === "start") {
    const { data: { user } } = await sb.auth.getUser();
    if (!user) return NextResponse.json({ error: "not_authenticated" }, { status: 401 });

    // Kern-Konzept: Aufgebot marschiert über Straßen — Route VOR dem RPC holen.
    const [{ data: myBase }, { data: sh }] = await Promise.all([
      sb.from("bases").select("lat, lng").eq("owner_user_id", user.id).order("created_at").limit(1).maybeSingle<{ lat: number; lng: number }>(),
      sb.from("strongholds").select("lat, lng").eq("id", body.stronghold_id).maybeSingle<{ lat: number; lng: number }>(),
    ]);
    if (!myBase) return NextResponse.json({ error: "no_own_base" }, { status: 400 });
    if (!sh) return NextResponse.json({ error: "stronghold_not_found" }, { status: 404 });

    const route = await fetchWalkingRoute(myBase.lat, myBase.lng, sh.lat, sh.lng);
    if (!route) {
      console.error("[rally] routing_unavailable", {
        user_id: user.id, from: [myBase.lat, myBase.lng], to: [sh.lat, sh.lng],
        has_token: !!process.env.MAPBOX_ACCESS_TOKEN,
      });
      return NextResponse.json({
        error: "routing_unavailable",
        message: "Keine Lauf-Route gefunden — Mapbox antwortet nicht. Versuche es in einem Moment erneut.",
      }, { status: 503 });
    }

    const { data, error } = await sb.rpc("start_rally", {
      p_stronghold_id: body.stronghold_id,
      p_prep_seconds:  body.prep_seconds,
      p_guardian_id:   body.guardian_id,
      p_troops:        body.troops,
    });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    const rallyResult = data as { ok?: boolean; rally_id?: string };
    if (rallyResult?.ok && rallyResult.rally_id) {
      await sb.rpc("enrich_rally_with_route", {
        p_kind: "stronghold",
        p_rally_id: rallyResult.rally_id,
        p_route_distance_m: route.distance_m,
        p_route_geom_geojson: route.geometry,
      });
    }
    return NextResponse.json(data);
  }

  if (body.action === "join") {
    const { data, error } = await sb.rpc("join_rally", {
      p_rally_id:    body.rally_id,
      p_guardian_id: body.guardian_id,
      p_troops:      body.troops,
    });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(data);
  }

  if (body.action === "resolve") {
    const { data, error } = await sb.rpc("resolve_due_rallies");
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, resolved: data });
  }

  return NextResponse.json({ error: "invalid_action" }, { status: 400 });
}
