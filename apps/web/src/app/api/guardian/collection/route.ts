import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/guardian/collection
 * - owned: Wächter die der User besitzt (mit Rassen-Info)
 * - all_races: 20 Rassen (damit UI "noch nicht gesammelt" anzeigen kann)
 * - summoning_stones: verfügbare Beschwörungssteine
 * - km_milestone_unlocks: bereits freigeschaltete km-Meilensteine
 */
export async function GET() {
  const sb = await createClient();
  const { data: auth } = await sb.auth.getUser();
  if (!auth?.user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const [owned, races, user] = await Promise.all([
    sb.from("my_guardian_collection").select("*").eq("user_id", auth.user.id).order("acquired_at"),
    sb.from("races_catalog").select("id, name, role, lore, material_desc, energy_color").order("role").order("name"),
    sb.from("users").select("summoning_stones, km_milestone_unlocks").eq("id", auth.user.id).maybeSingle(),
  ]);

  return NextResponse.json({
    owned: owned.data ?? [],
    all_races: races.data ?? [],
    summoning_stones: user.data?.summoning_stones ?? 0,
    km_milestone_unlocks: user.data?.km_milestone_unlocks ?? [],
  });
}

/**
 * POST /api/guardian/collection
 * Actions:
 *   { action: "activate", guardian_id }   -> 24h-Cooldown geprüft
 *   { action: "summon", race_id }         -> verbraucht 1 Stone
 *   { action: "check_milestones", total_km } -> vergibt Stones für neue Meilensteine
 */
export async function POST(req: Request) {
  const sb = await createClient();
  const { data: auth } = await sb.auth.getUser();
  if (!auth?.user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = await req.json() as Record<string, unknown>;
  const action = body.action as string;

  if (action === "activate") {
    const { data, error } = await sb.rpc("activate_guardian", { p_guardian_id: body.guardian_id as string });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(data);
  }
  if (action === "summon") {
    const { data, error } = await sb.rpc("summon_guardian", { p_race_id: body.race_id as string });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(data);
  }
  if (action === "check_milestones") {
    const { data, error } = await sb.rpc("check_km_milestones", { p_total_km: body.total_km as number });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(data);
  }
  return NextResponse.json({ error: "bad_request" }, { status: 400 });
}
