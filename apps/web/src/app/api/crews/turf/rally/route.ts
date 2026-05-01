import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { fetchWalkingRoute } from "@/lib/mapbox-route";
import { rateLimitSmart, rateLimitResponse } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/crews/turf/rally — start rally
 * Body: { repeater_id, prep_seconds, troops }
 */
export async function POST(req: Request) {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: "not_authenticated" }, { status: 401 });

  const rl = await rateLimitSmart(`crewrally:${user.id}`, 4, 60_000);
  const blocked = rateLimitResponse(rl);
  if (blocked) return blocked;

  const body = (await req.json()) as {
    repeater_id?: string;
    prep_seconds?: number;
    troops?: Record<string, number>;
  };
  if (!body.repeater_id || !body.prep_seconds || !body.troops) {
    return NextResponse.json({ error: "missing_params" }, { status: 400 });
  }

  const { data, error } = await sb.rpc("start_crew_repeater_rally", {
    p_repeater_id: body.repeater_id,
    p_prep_seconds: body.prep_seconds,
    p_troops: body.troops,
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const rallyResult = data as { ok?: boolean; rally_id?: string };
  if (rallyResult?.ok && rallyResult.rally_id) {
    try {
      const [{ data: myBase }, { data: rep }] = await Promise.all([
        sb.from("bases").select("lat, lng").eq("owner_user_id", user.id).order("created_at").limit(1).maybeSingle<{ lat: number; lng: number }>(),
        sb.from("crew_repeaters").select("lat, lng").eq("id", body.repeater_id).maybeSingle<{ lat: number; lng: number }>(),
      ]);
      if (myBase && rep) {
        const route = await fetchWalkingRoute(myBase.lat, myBase.lng, rep.lat, rep.lng);
        await sb.rpc("enrich_rally_with_route", {
          p_kind: "crew_repeater",
          p_rally_id: rallyResult.rally_id,
          p_route_distance_m: route?.distance_m ?? null,
          p_route_geom_geojson: route?.geometry ?? null,
        });
      }
    } catch { /* enrich optional, fällt auf Luftlinie zurück */ }
  }

  return NextResponse.json(data);
}
