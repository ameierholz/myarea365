import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/tiles/{layer}/{z}/{x}/{y}
 *
 * Serves Mapbox Vector Tiles (MVT) erzeugt via PostGIS ST_AsMVT.
 * Layer: "resource_nodes" | "strongholds" | "bases"
 * Returns application/x-protobuf für Mapbox-GL als 'vector'-Source.
 *
 * Usage clientseitig:
 *   map.addSource('rn', { type: 'vector', tiles: ['/api/tiles/resource_nodes/{z}/{x}/{y}'], minzoom: 12, maxzoom: 18 });
 *   map.addLayer({ id: 'rn-circle', type: 'circle', source: 'rn', 'source-layer': 'resource_nodes', ... });
 */

const ALLOWED_LAYERS = new Set(["resource_nodes", "strongholds", "bases"]);
const RPC_BY_LAYER: Record<string, string> = {
  resource_nodes: "tile_resource_nodes",
  strongholds: "tile_strongholds",
  bases: "tile_bases",
};

type RouteParams = { layer: string; z: string; x: string; y: string };

export async function GET(_req: Request, { params }: { params: Promise<RouteParams> }) {
  const { layer, z, x, y } = await params;

  if (!ALLOWED_LAYERS.has(layer)) {
    return NextResponse.json({ error: "unknown_layer" }, { status: 400 });
  }
  const zi = parseInt(z, 10), xi = parseInt(x, 10), yi = parseInt(y, 10);
  if (![zi, xi, yi].every(Number.isFinite) || zi < 0 || zi > 22) {
    return NextResponse.json({ error: "invalid_zxy" }, { status: 400 });
  }

  const sb = await createClient();
  const { data, error } = await sb.rpc(RPC_BY_LAYER[layer], { z: zi, x: xi, y: yi });
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // PostgREST liefert bytea als base64-String oder \x… hex je nach Setup.
  // Für ST_AsMVT direkt als bytea kommt es als \x-prefixed hex zurück.
  let bytes: Uint8Array;
  if (data == null) {
    bytes = new Uint8Array(0);
  } else if (typeof data === "string") {
    if (data.startsWith("\\x")) {
      // Hex-encoded
      const hex = data.slice(2);
      bytes = new Uint8Array(hex.length / 2);
      for (let i = 0; i < bytes.length; i++) {
        bytes[i] = parseInt(hex.substr(i * 2, 2), 16);
      }
    } else {
      // Base64
      bytes = Uint8Array.from(Buffer.from(data, "base64"));
    }
  } else if (data instanceof Uint8Array) {
    bytes = data;
  } else {
    bytes = new Uint8Array(0);
  }

  return new Response(bytes as unknown as BodyInit, {
    status: 200,
    headers: {
      "Content-Type": "application/x-protobuf",
      "Content-Length": String(bytes.byteLength),
      // Tiles ändern sich kaum — Edge-Cache 30s, SWR 5min.
      "Cache-Control": "public, s-maxage=30, stale-while-revalidate=300",
    },
  });
}
