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
    const { data, error } = await sb.rpc("start_rally", {
      p_stronghold_id: body.stronghold_id,
      p_prep_seconds:  body.prep_seconds,
      p_guardian_id:   body.guardian_id,
      p_troops:        body.troops,
    });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    const rallyResult = data as { ok?: boolean; rally_id?: string };
    if (user && rallyResult?.ok && rallyResult.rally_id) {
      try {
        const [{ data: myBase }, { data: sh }] = await Promise.all([
          sb.from("bases").select("lat, lng").eq("owner_user_id", user.id).order("created_at").limit(1).maybeSingle<{ lat: number; lng: number }>(),
          sb.from("strongholds").select("lat, lng").eq("id", body.stronghold_id).maybeSingle<{ lat: number; lng: number }>(),
        ]);
        if (myBase && sh) {
          const route = await fetchWalkingRoute(myBase.lat, myBase.lng, sh.lat, sh.lng);
          await sb.rpc("enrich_rally_with_route", {
            p_kind: "stronghold",
            p_rally_id: rallyResult.rally_id,
            p_route_distance_m: route?.distance_m ?? null,
            p_route_geom_geojson: route?.geometry ?? null,
          });
        }
      } catch { /* enrich optional */ }
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
