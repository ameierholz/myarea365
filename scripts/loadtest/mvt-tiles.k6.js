// k6 Load-Test: MVT-Tile-Endpoints unter Last
// Run: k6 run scripts/loadtest/mvt-tiles.k6.js
//
// Ziel: PostGIS ST_AsMVT mit GIST-Index muss p95 < 200ms halten unter 150 VUs.
// Wenn p95 > 200ms → Index-Audit oder ST_TileEnvelope-Caching prüfen.

import http from "k6/http";
import { check, sleep } from "k6";
import { Trend } from "k6/metrics";

const BASE_URL = __ENV.BASE_URL || "https://myarea365.de";

const tileLatency = new Trend("mvt_tile_latency", true);

// Berlin Tile-Ranges für Zoom 13-16 (typische Map-Auflösungen)
// Berlin liegt grob in Tile-Range x=8800..8900, y=5400..5500 bei Z=14
function pickTile() {
  const z = 13 + Math.floor(Math.random() * 4); // z=13..16
  const factor = Math.pow(2, z - 14);
  const xBase = Math.round(8800 * factor);
  const yBase = Math.round(5400 * factor);
  const x = xBase + Math.floor(Math.random() * 100 * factor);
  const y = yBase + Math.floor(Math.random() * 100 * factor);
  return { z, x, y };
}

const LAYERS = ["resource_nodes", "strongholds", "bases"];

export const options = {
  stages: [
    { duration: "30s", target: 50 },
    { duration: "1m", target: 150 },
    { duration: "2m", target: 150 },
    { duration: "30s", target: 0 },
  ],
  thresholds: {
    "mvt_tile_latency": ["p(95)<200", "p(99)<800"],
    "http_req_failed": ["rate<0.01"],
    "http_reqs{layer:resource_nodes}": ["count>0"],
  },
};

export default function () {
  const layer = LAYERS[Math.floor(Math.random() * LAYERS.length)];
  const { z, x, y } = pickTile();
  const url = `${BASE_URL}/api/tiles/${layer}/${z}/${x}/${y}`;
  const r = http.get(url, { tags: { layer, z: String(z) } });
  tileLatency.add(r.timings.duration);
  check(r, {
    "tile 200": (rr) => rr.status === 200,
    "content-type protobuf": (rr) => rr.headers["Content-Type"]?.includes("protobuf"),
    "edge-cache header": (rr) => rr.headers["Cache-Control"]?.includes("s-maxage"),
  });
  sleep(0.5 + Math.random()); // realistische Pan-Pause
}
