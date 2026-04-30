import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/map/bbox?bbox=minLng,minLat,maxLng,maxLat[&include=bases,strongholds,nodes]
 *
 * Composite-Endpoint: liefert Bases + Strongholds + Resource-Nodes in EINER Response.
 * Spart Round-Trips, Auth-Checks und DB-Connections gegenüber drei separaten Calls.
 * Default: alle drei Datasets. Per `include` filterbar.
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const bboxStr = url.searchParams.get("bbox");
  if (!bboxStr) return NextResponse.json({ error: "missing_bbox" }, { status: 400 });

  const parts = bboxStr.split(",").map(Number);
  if (parts.length !== 4 || parts.some((n) => Number.isNaN(n))) {
    return NextResponse.json({ error: "invalid_bbox" }, { status: 400 });
  }
  const [minLng, minLat, maxLng, maxLat] = parts;

  const includeRaw = url.searchParams.get("include");
  const include = includeRaw ? new Set(includeRaw.split(",")) : new Set(["bases", "strongholds", "nodes"]);

  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  const myId = user?.id ?? null;

  // Center für stronghold-Radius (RPC-Vertrag akzeptiert lat/lng/radius_km — wir konvertieren BBox)
  const cLat = (minLat + maxLat) / 2;
  const cLng = (minLng + maxLng) / 2;
  // Radius in km grob aus BBox-Diagonale (1° lat ≈ 111km)
  const dLat = (maxLat - minLat) * 111;
  const dLng = (maxLng - minLng) * 111 * Math.cos((cLat * Math.PI) / 180);
  const radiusKm = Math.max(2, Math.sqrt(dLat * dLat + dLng * dLng) / 2 + 1);

  const tasks: Array<PromiseLike<unknown>> = [];
  const taskKeys: string[] = [];

  if (include.has("bases")) {
    taskKeys.push("bases");
    tasks.push(sb.rpc("get_bases_in_bbox", {
      p_min_lat: minLat, p_min_lng: minLng,
      p_max_lat: maxLat, p_max_lng: maxLng,
    }));
  }
  if (include.has("strongholds")) {
    taskKeys.push("strongholds");
    tasks.push(sb.rpc("get_nearby_strongholds", {
      p_lat: cLat, p_lng: cLng, p_radius_km: radiusKm,
    }));
  }
  if (include.has("nodes")) {
    taskKeys.push("nodes");
    tasks.push(sb.from("resource_nodes")
      .select("id, kind, resource_type, name, lat, lng, level, total_yield, current_yield, depleted_at")
      .is("depleted_at", null)
      .gte("lat", minLat).lte("lat", maxLat)
      .gte("lng", minLng).lte("lng", maxLng)
      .limit(500));
  }

  const results = await Promise.all(tasks);
  const out: Record<string, unknown> = {};

  for (let i = 0; i < taskKeys.length; i++) {
    const key = taskKeys[i];
    const r = results[i] as { data?: unknown; error?: { message: string } | null };
    if (r.error) {
      out[key] = { error: r.error.message };
      continue;
    }
    out[key] = r.data ?? [];
  }

  // Resource-Nodes mit Sammel-Status anreichern
  if (include.has("nodes") && Array.isArray(out.nodes) && (out.nodes as unknown[]).length > 0) {
    const nodes = out.nodes as Array<{ id: number; [k: string]: unknown }>;
    const ids = nodes.map((n) => n.id);
    const { data: gathers } = await sb
      .from("resource_node_active_gathers")
      .select("node_id, active_count, someone_gathering, next_finish_at, user_ids")
      .in("node_id", ids);

    type GatherRow = { node_id: number; active_count: number; someone_gathering: boolean; next_finish_at: string | null; user_ids: string[] | null };
    const byNode = new Map<number, GatherRow>(((gathers ?? []) as GatherRow[]).map((g) => [g.node_id, g]));

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

    out.nodes = nodes.map((n) => {
      const g = byNode.get(n.id);
      const firstUserId = g?.user_ids?.[0] ?? null;
      const gatherer = firstUserId ? (userInfoMap.get(firstUserId) ?? null) : null;
      return {
        ...n,
        gather_count: g?.active_count ?? 0,
        gather_active: (g?.active_count ?? 0) > 0,
        gather_someone_gathering: g?.someone_gathering ?? false,
        gather_finish_at: g?.next_finish_at ?? null,
        gather_mine: !!(myId && g?.user_ids?.includes(myId)),
        gather_username: gatherer?.username ?? null,
        gather_crew_tag: gatherer?.crew_tag ?? null,
      };
    });
  }

  // User-spezifisch (is_own, gather_mine) → privater Browser-Cache, kein Edge-Cache.
  return NextResponse.json(out, {
    headers: { "Cache-Control": "private, max-age=10" },
  });
}
