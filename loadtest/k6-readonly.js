// k6 Lasttest für Read-Only-Endpoints (kein Auth nötig).
// Run:
//   k6 run --vus 100 --duration 60s loadtest/k6-readonly.js
//   k6 run --vus 500 --duration 5m  loadtest/k6-readonly.js
//
// Ziel: prüfen wie viele concurrent virtual users die Read-Pfade vertragen
// (Strongholds, Tiles, Cosmetic-Artwork, MVT). Diese Endpoints laufen mit
// Edge-Cache, sollten also >1000 vus ohne DB-Last vertragen.

import http from "k6/http";
import { check, sleep } from "k6";

const BASE = __ENV.BASE_URL || "https://myarea365.de";

const BERLIN_VIEWPORTS = [
  // Mitte
  { lat: 52.520, lng: 13.405, bbox: "13.38,52.51,13.43,52.53" },
  // Charlottenburg
  { lat: 52.504, lng: 13.300, bbox: "13.27,52.49,13.33,52.52" },
  // Friedrichshain
  { lat: 52.514, lng: 13.456, bbox: "13.43,52.50,13.48,52.53" },
  // Prenzlauer Berg
  { lat: 52.539, lng: 13.424, bbox: "13.40,52.52,13.45,52.55" },
];

export const options = {
  thresholds: {
    http_req_failed: ["rate<0.01"],          // <1% Errors
    http_req_duration: ["p(95)<800"],         // 95% unter 800ms
  },
};

export default function () {
  const vp = BERLIN_VIEWPORTS[Math.floor(Math.random() * BERLIN_VIEWPORTS.length)];

  // 1. Stronghold-Liste (Edge-Cache 30s)
  let r = http.get(`${BASE}/api/strongholds/nearby?lat=${vp.lat}&lng=${vp.lng}&radius_km=10`);
  check(r, { "strongholds 200": (x) => x.status === 200 });

  // 2. Cosmetic-Artwork (Edge-Cache 5min)
  r = http.get(`${BASE}/api/cosmetic-artwork`);
  check(r, { "artwork 200": (x) => x.status === 200 });

  // 3. Map-Bbox-MVT-Tiles (auch cached)
  r = http.get(`${BASE}/api/map/bbox?bbox=${vp.bbox}`);
  check(r, { "map bbox 200/304": (x) => x.status === 200 || x.status === 304 });

  sleep(1 + Math.random() * 2); // 1-3s zwischen "Page-Loads"
}
