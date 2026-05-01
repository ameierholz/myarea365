import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { fetchWalkingRoute } from "@/lib/mapbox-route";
import { rateLimitSmart, rateLimitResponse } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/base/rally
 * Body: { defender_user_id: string; troops: Record<string, number>; prep_seconds: number }
 * → start_player_base_rally — startet Crew-Aufgebot.
 */
export async function POST(req: Request) {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: "not_authenticated" }, { status: 401 });

  const rl = await rateLimitSmart(`pbrally:${user.id}`, 4, 60_000);
  const blocked = rateLimitResponse(rl);
  if (blocked) return blocked;

  const body = (await req.json()) as {
    defender_user_id?: string;
    troops?: Record<string, number>;
    prep_seconds?: number;
    guardian_id?: string | null;
  };
  if (!body.defender_user_id || !body.troops || !body.prep_seconds) {
    return NextResponse.json({ error: "missing_params" }, { status: 400 });
  }

  const { data, error } = await sb.rpc("start_player_base_rally", {
    p_defender_user_id: body.defender_user_id,
    p_prep_seconds: body.prep_seconds,
    p_troops: body.troops,
    p_guardian_id: body.guardian_id ?? null,
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const rallyResult = data as { ok?: boolean; rally_id?: string };
  if (rallyResult?.ok && rallyResult.rally_id) {
    try {
      const [{ data: myBase }, { data: defBase }] = await Promise.all([
        sb.from("bases").select("lat, lng").eq("owner_user_id", user.id).order("created_at").limit(1).maybeSingle<{ lat: number; lng: number }>(),
        sb.from("bases").select("lat, lng").eq("owner_user_id", body.defender_user_id).order("created_at").limit(1).maybeSingle<{ lat: number; lng: number }>(),
      ]);
      if (myBase && defBase) {
        const route = await fetchWalkingRoute(myBase.lat, myBase.lng, defBase.lat, defBase.lng);
        await sb.rpc("enrich_rally_with_route", {
          p_kind: "player_base",
          p_rally_id: rallyResult.rally_id,
          p_route_distance_m: route?.distance_m ?? null,
          p_route_geom_geojson: route?.geometry ?? null,
        });
      }
    } catch { /* enrich optional */ }
  }
  return NextResponse.json(data);
}

/** GET /api/base/rally → aktives Crew-Aufgebot des aktuellen Users (oder null) */
export async function GET() {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: "not_authenticated" }, { status: 401 });

  const { data, error } = await sb.rpc("get_active_player_base_rally");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ rally: data });
}
