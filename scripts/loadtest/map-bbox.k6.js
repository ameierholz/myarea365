// k6 Load-Test: simuliert 100 gleichzeitige Map-Viewer
// Run: k6 run scripts/loadtest/map-bbox.k6.js
// Vorher: BASE_URL setzen, optional AUTH_COOKIE für eingeloggten Test
//
// Ziel-Metriken:
//  - p95 < 500ms für /api/map/bbox unter 100 VUs
//  - http_req_failed < 1%
//  - keine 5xx

import http from "k6/http";
import { check, sleep } from "k6";

const BASE_URL = __ENV.BASE_URL || "https://myarea365.de";
const AUTH = __ENV.AUTH_COOKIE || ""; // "sb-access-token=..." optional

// Berlin BBox-Bereiche (zufällig pro VU für realistisches Verteilung)
const BBOXES = [
  // Reinickendorf
  [13.30, 52.55, 13.40, 52.62],
  // Mitte
  [13.35, 52.50, 13.45, 52.55],
  // Kreuzberg
  [13.38, 52.48, 13.45, 52.52],
  // Charlottenburg
  [13.27, 52.50, 13.34, 52.54],
  // Pankow
  [13.39, 52.55, 13.46, 52.60],
];

export const options = {
  stages: [
    { duration: "30s", target: 25 },   // Ramp-up
    { duration: "1m", target: 100 },   // 100 VUs
    { duration: "2m", target: 100 },   // Sustain
    { duration: "30s", target: 0 },    // Ramp-down
  ],
  thresholds: {
    http_req_duration: ["p(95)<500", "p(99)<1500"],
    http_req_failed: ["rate<0.01"],
  },
};

const headers = AUTH ? { Cookie: AUTH } : {};

export default function () {
  // Random BBox pro Iteration
  const bbox = BBOXES[Math.floor(Math.random() * BBOXES.length)];
  const bboxStr = bbox.join(",");

  // Composite-Endpoint (bases + strongholds + nodes in einem Call)
  const r1 = http.get(`${BASE_URL}/api/map/bbox?bbox=${bboxStr}`, { headers, tags: { name: "map_bbox" } });
  check(r1, {
    "bbox 200": (r) => r.status === 200,
    "bbox returns json": (r) => r.headers["Content-Type"]?.includes("json"),
  });

  // Strongholds (public-cacheable)
  const cLat = (bbox[1] + bbox[3]) / 2;
  const cLng = (bbox[0] + bbox[2]) / 2;
  const r2 = http.get(`${BASE_URL}/api/strongholds/nearby?lat=${cLat}&lng=${cLng}&radius_km=5`, { headers, tags: { name: "strongholds" } });
  check(r2, { "strongholds 200": (r) => r.status === 200 });

  sleep(2 + Math.random() * 3); // Realistische User-Pause: 2–5s zwischen Map-Interaktionen
}
