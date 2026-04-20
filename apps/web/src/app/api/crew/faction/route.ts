import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { CREW_FACTION_SWITCH_COST_GEMS, type CrewFactionId } from "@/lib/crew-factions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/crew/faction
 * - { action: "set_initial", faction }     -> fuer frisch gegruendete Crew ohne Fraktion, kostenlos
 * - { action: "switch", faction }          -> kostet Gems, 30-Tage-Cooldown
 */
export async function POST(req: Request) {
  const sb = await createClient();
  const { data: auth } = await sb.auth.getUser();
  if (!auth?.user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = await req.json() as { action: "set_initial" | "switch"; faction: CrewFactionId };
  if (!["pfadfinder","waechterorden","stadtlaeufer","mystiker"].includes(body.faction)) {
    return NextResponse.json({ error: "unknown_faction" }, { status: 400 });
  }

  if (body.action === "set_initial") {
    const { data: user } = await sb.from("users").select("current_crew_id").eq("id", auth.user.id).maybeSingle<{ current_crew_id: string | null }>();
    if (!user?.current_crew_id) return NextResponse.json({ error: "no_crew" }, { status: 400 });
    const { data: crew } = await sb.from("crews").select("owner_id, crew_faction").eq("id", user.current_crew_id).maybeSingle<{ owner_id: string; crew_faction: string | null }>();
    if (!crew) return NextResponse.json({ error: "crew_not_found" }, { status: 404 });
    if (crew.owner_id !== auth.user.id) return NextResponse.json({ error: "not_owner" }, { status: 403 });
    if (crew.crew_faction) return NextResponse.json({ error: "already_set" }, { status: 400 });
    const { error } = await sb.from("crews")
      .update({ crew_faction: body.faction, crew_faction_switched_at: new Date().toISOString() })
      .eq("id", user.current_crew_id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, crew_faction: body.faction });
  }

  // Switch (kostet Gems)
  const { data, error } = await sb.rpc("switch_crew_faction", {
    p_new_faction: body.faction,
    p_gem_cost: CREW_FACTION_SWITCH_COST_GEMS,
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
