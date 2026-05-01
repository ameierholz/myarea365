// k6 Lasttest mit auth Cookie für Polling-Endpoints (rallies, scouts, marches).
// Run:
//   K6_COOKIE='sb-...=...; ...' k6 run --vus 200 --duration 60s loadtest/k6-authenticated.js
//
// Cookie aus Browser-DevTools kopieren (logged in als Test-User).
// Ziel: simulieren von 200 concurrent angemeldeten Spielern die periodisch
// pollen — Realtime-Aware-Hook drosselt im Hintergrund auf 60s.

import http from "k6/http";
import { check, sleep } from "k6";

const BASE = __ENV.BASE_URL || "https://myarea365.de";
const COOKIE = __ENV.K6_COOKIE || "";

if (!COOKIE) {
  throw new Error("K6_COOKIE env var fehlt — Browser-Cookie kopieren");
}

export const options = {
  thresholds: {
    http_req_failed: ["rate<0.02"],
    http_req_duration: ["p(95)<1200"],
  },
};

const headers = { Cookie: COOKIE };

export default function () {
  // Simuliere typischen Polling-Mix eines aktiven Users
  let r = http.get(`${BASE}/api/gather/active`, { headers });
  check(r, { "gather/active 200": (x) => x.status === 200 });

  r = http.get(`${BASE}/api/base/scouts/active`, { headers });
  check(r, { "scouts/active 200": (x) => x.status === 200 });

  r = http.get(`${BASE}/api/crews/turf/rally/active`, { headers });
  check(r, { "crew rally/active 200": (x) => x.status === 200 });

  r = http.get(`${BASE}/api/rally`, { headers });
  check(r, { "rally 200": (x) => x.status === 200 });

  r = http.get(`${BASE}/api/base/rally`, { headers });
  check(r, { "base/rally 200": (x) => x.status === 200 });

  // Realtime-Aware-Polling: 60s Watchdog (statt 5/15s wie früher)
  sleep(60 + Math.random() * 10);
}
