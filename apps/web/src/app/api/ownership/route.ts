import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/ownership?type=segment|street|territory&id=<uuid>
 *
 * Gibt Besitzer-Info zurueck: {kind, owner_user:{id,name,avatar}?, owner_crew:{id,name,emoji}?, ...extras}
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const type = url.searchParams.get("type");
  const id = url.searchParams.get("id");
  if (!type || !id) return NextResponse.json({ error: "type+id required" }, { status: 400 });
  const sb = await createClient();

  type Owner = { user: { id: string; display_name: string | null; username: string | null } | null; crew: { id: string; name: string } | null };
  async function resolveOwner(userId: string | null, crewId: string | null): Promise<Owner> {
    const out: Owner = { user: null, crew: null };
    if (userId) {
      const { data } = await sb.from("users").select("id, display_name, username").eq("id", userId).maybeSingle<{ id: string; display_name: string | null; username: string | null }>();
      if (data) out.user = data;
    }
    if (crewId) {
      const { data } = await sb.from("crews").select("id, name").eq("id", crewId).maybeSingle<{ id: string; name: string }>();
      if (data) out.crew = data;
    }
    return out;
  }

  if (type === "segment") {
    const { data, error } = await sb.from("street_segments")
      .select("id, user_id, crew_id, street_name, length_m, created_at")
      .eq("id", id).maybeSingle<{ id: string; user_id: string; crew_id: string | null; street_name: string | null; length_m: number; created_at: string }>();
    if (error || !data) return NextResponse.json({ error: "not_found" }, { status: 404 });
    const owner = await resolveOwner(data.user_id, data.crew_id);
    return NextResponse.json({ kind: "segment", id: data.id, street_name: data.street_name, length_m: data.length_m, claimed_at: data.created_at, owner });
  }

  if (type === "street") {
    const { data, error } = await sb.from("streets_claimed")
      .select("id, user_id, crew_id, street_name, segments_count, total_length_m, created_at")
      .eq("id", id).maybeSingle<{ id: string; user_id: string; crew_id: string | null; street_name: string; segments_count: number; total_length_m: number; created_at: string }>();
    if (error || !data) return NextResponse.json({ error: "not_found" }, { status: 404 });
    const owner = await resolveOwner(data.user_id, data.crew_id);
    return NextResponse.json({ kind: "street", id: data.id, street_name: data.street_name, segments_count: data.segments_count, total_length_m: data.total_length_m, claimed_at: data.created_at, owner });
  }

  if (type === "territory") {
    const { data, error } = await sb.from("territory_polygons")
      .select("id, owner_user_id, owner_crew_id, status, area_m2, perimeter_m, polygon, created_at, stolen_from_user_id, stolen_from_crew_id, stolen_at")
      .eq("id", id).maybeSingle();
    if (error || !data) return NextResponse.json({ error: "not_found" }, { status: 404 });
    const owner = await resolveOwner(data.owner_user_id, data.owner_crew_id);
    const stoleFrom = (data.stolen_from_user_id || data.stolen_from_crew_id)
      ? await resolveOwner(data.stolen_from_user_id, data.stolen_from_crew_id)
      : null;
    return NextResponse.json({
      kind: "territory",
      id: data.id, status: data.status, area_m2: data.area_m2, perimeter_m: data.perimeter_m,
      claimed_at: data.created_at, polygon: data.polygon, owner, stole_from: stoleFrom, stolen_at: data.stolen_at,
    });
  }

  return NextResponse.json({ error: "unknown type" }, { status: 400 });
}
