import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/gather/active
 * Liefert alle aktiven Plünder-Märsche des aktuellen Users (marching/gathering/returning).
 * Lifecycle-Tick läuft jetzt zentral via pg_cron alle 10s (Job ma365-tick-gather-marches),
 * NICHT mehr beim Lesen — entlastet die DB bei vielen gleichzeitigen Polls.
 */
export async function GET() {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ marches: [] });

  const { data, error } = await sb
    .from("gather_marches")
    .select(`
      id, node_id, guardian_id, troop_count, troop_class,
      started_at, arrives_at, finishes_at, returns_at,
      status, collected, origin_lat, origin_lng,
      route_geom_json, route_distance_m, recall_progress,
      node:resource_nodes (id, kind, resource_type, name, lat, lng, level, total_yield, current_yield)
    `)
    .eq("user_id", user.id)
    .in("status", ["marching", "gathering", "returning"])
    .order("started_at", { ascending: true });

  if (error) return NextResponse.json({ error: error.message, marches: [] }, { status: 500 });
  const marches = data ?? [];

  // Wächter-Namen pro Marsch nachladen
  const guardianIds = Array.from(new Set(marches.map((m) => m.guardian_id).filter((x): x is string => !!x)));
  let guardianMap = new Map<string, string>();
  if (guardianIds.length > 0) {
    const { data: gRows } = await sb
      .from("user_guardians")
      .select("id, archetype:guardian_archetypes(name)")
      .in("id", guardianIds);
    type GRow = { id: string; archetype: { name: string } | null };
    guardianMap = new Map(((gRows ?? []) as unknown as GRow[]).map((g) => [g.id, g.archetype?.name ?? "Wächter"]));
  }

  // Eigenes Username + Crew-Tag (für Cart-Label auf Map)
  const { data: meRow } = await sb
    .from("users")
    .select("display_name, username, crew:crews(tag)")
    .eq("id", user.id)
    .maybeSingle();
  type MeRow = { display_name: string | null; username: string | null; crew: { tag: string | null } | null };
  const me = meRow as MeRow | null;
  const ownerName = me?.display_name ?? me?.username ?? null;
  const ownerCrewTag = me?.crew?.tag ?? null;

  const enriched = marches.map((m) => ({
    ...m,
    guardian_name: m.guardian_id ? (guardianMap.get(m.guardian_id) ?? "Wächter") : null,
    owner_name: ownerName,
    owner_crew_tag: ownerCrewTag,
  }));

  return NextResponse.json({ marches: enriched });
}
