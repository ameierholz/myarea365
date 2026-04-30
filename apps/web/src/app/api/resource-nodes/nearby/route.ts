import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/resource-nodes/nearby?bbox=minLng,minLat,maxLng,maxLat
 * Liefert alle aktiven Resource-Nodes im BBox.
 * Pro Node optional: gather_count, gather_finish_at, gather_mine (eigene Sammler beteiligt).
 */
export async function GET(req: Request) {
  const sb = await createClient();
  const url = new URL(req.url);
  const bboxStr = url.searchParams.get("bbox");
  if (!bboxStr) return NextResponse.json({ error: "bbox_required" }, { status: 400 });

  const [minLng, minLat, maxLng, maxLat] = bboxStr.split(",").map(Number);
  if ([minLng, minLat, maxLng, maxLat].some(Number.isNaN)) {
    return NextResponse.json({ error: "bbox_invalid" }, { status: 400 });
  }

  const { data, error } = await sb.from("resource_nodes")
    .select("id, kind, resource_type, name, lat, lng, level, total_yield, current_yield, depleted_at")
    .is("depleted_at", null)
    .gte("lat", minLat).lte("lat", maxLat)
    .gte("lng", minLng).lte("lng", maxLng)
    .limit(500);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const nodes = data ?? [];
  if (nodes.length === 0) return NextResponse.json({ nodes: [] });

  // Sammel-Status pro Node
  const ids = nodes.map((n) => n.id);
  const { data: gathers } = await sb
    .from("resource_node_active_gathers")
    .select("node_id, active_count, someone_gathering, next_finish_at, user_ids")
    .in("node_id", ids);

  const { data: { user } } = await sb.auth.getUser();
  const myId = user?.id ?? null;

  type GatherRow = { node_id: number; active_count: number; someone_gathering: boolean; next_finish_at: string | null; user_ids: string[] | null };
  const byNode = new Map<number, GatherRow>(((gathers ?? []) as GatherRow[]).map((g) => [g.node_id, g]));

  // Sammler-Info pro Node (Username/Crew-Tag des ersten aktiven Sammlers)
  const allUserIds = Array.from(new Set(((gathers ?? []) as GatherRow[]).flatMap((g) => g.user_ids ?? [])));
  let userInfoMap = new Map<string, { username: string | null; crew_tag: string | null }>();
  if (allUserIds.length > 0) {
    const { data: uRows } = await sb
      .from("users")
      .select("id, display_name, username, crew:crews(tag)")
      .in("id", allUserIds);
    type URow = { id: string; display_name: string | null; username: string | null; crew: { tag: string | null } | null };
    userInfoMap = new Map(((uRows ?? []) as unknown as URow[]).map((u) => [u.id, {
      username: u.display_name ?? u.username ?? null,
      crew_tag: u.crew?.tag ?? null,
    }]));
  }

  const enriched = nodes.map((n) => {
    const g = byNode.get(n.id);
    // Aktiv = irgendein Marsch (marching ODER gathering) — sperrt den Node
    const active = (g?.active_count ?? 0) > 0;
    const firstUserId = g?.user_ids?.[0] ?? null;
    const gatherer = firstUserId ? (userInfoMap.get(firstUserId) ?? null) : null;
    return {
      ...n,
      gather_count: g?.active_count ?? 0,
      gather_active: active,
      gather_someone_gathering: g?.someone_gathering ?? false,
      gather_finish_at: g?.next_finish_at ?? null,
      gather_mine: !!(myId && g?.user_ids?.includes(myId)),
      gather_username: gatherer?.username ?? null,
      gather_crew_tag: gatherer?.crew_tag ?? null,
    };
  });

  return NextResponse.json({ nodes: enriched });
}
