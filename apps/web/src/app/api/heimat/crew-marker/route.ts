import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/heimat/crew-marker
 * Body: { lat, lng, action_kind, label?, is_urgent? }
 *  action_kind: angriff/verteidigen/warnung/sammeln/aufbauen/heilen/schild/ziel/wichtig
 */
export async function POST(req: NextRequest) {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: "not_authenticated" }, { status: 401 });

  const body = await req.json() as {
    lat?: number; lng?: number; action_kind?: string;
    label?: string; is_urgent?: boolean;
  };
  if (typeof body.lat !== "number" || typeof body.lng !== "number" || !body.action_kind) {
    return NextResponse.json({ error: "missing_params" }, { status: 400 });
  }

  const { data, error } = await sb.rpc("place_crew_marker", {
    p_lat: body.lat,
    p_lng: body.lng,
    p_action_kind: body.action_kind,
    p_label: body.label ?? null,
    p_is_urgent: body.is_urgent ?? false,
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

/** DELETE /api/heimat/crew-marker?id=... — eigenen Marker löschen */
export async function DELETE(req: NextRequest) {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: "not_authenticated" }, { status: 401 });
  const url = new URL(req.url);
  const id = url.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "missing_id" }, { status: 400 });
  const { error } = await sb.from("crew_map_markers").delete().eq("id", id).eq("created_by", user.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

/** GET /api/heimat/crew-marker — aktive Crew-Marker (eigene Crew) */
export async function GET() {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: "not_authenticated" }, { status: 401 });

  const { data: cm } = await sb.from("crew_members").select("crew_id").eq("user_id", user.id).maybeSingle();
  const crewId = (cm as { crew_id: string } | null)?.crew_id;
  if (!crewId) return NextResponse.json({ ok: true, markers: [] });

  const { data } = await sb.from("crew_map_markers")
    .select("*")
    .eq("crew_id", crewId)
    .or("expires_at.is.null,expires_at.gt." + new Date().toISOString())
    .order("created_at", { ascending: false })
    .limit(50);
  return NextResponse.json({ ok: true, markers: data ?? [] });
}
