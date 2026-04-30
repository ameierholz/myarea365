/* MyArea365 Service Worker v2 — Cache-Strategien:
 *  - Mapbox-Tiles + MVT: cache-first, 7 Tage TTL
 *  - Statische Assets (Fonts, Images, Scripts): cache-first, 30 Tage TTL
 *  - API-Reads (GET): stale-while-revalidate (sofortige Antwort + Hintergrund-Update)
 *  - API-Writes (POST/PUT/DELETE) + Auth + Realtime: NICHT gecached
 *  - HTML-Navigation: network-first, fallback Cache → /offline
 */

const VERSION = "v2";
const TILE_CACHE = `ma365-tiles-${VERSION}`;
const ASSET_CACHE = `ma365-assets-${VERSION}`;
const PAGE_CACHE = `ma365-pages-${VERSION}`;
const API_SWR_CACHE = `ma365-api-swr-${VERSION}`;
const ALL_CACHES = [TILE_CACHE, ASSET_CACHE, PAGE_CACHE, API_SWR_CACHE];

const TILE_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const ASSET_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const API_SWR_TTL_MS = 5 * 60 * 1000;

// Welche API-GETs überhaupt SWR-cacheable sind (read-heavy, idempotent)
const API_SWR_PATTERNS = [
  /^\/api\/strongholds\/nearby/,
  /^\/api\/tiles\//,
  /^\/api\/leaderboard/,
  /^\/api\/map-features/,
];

// Was niemals interceptet wird
const API_NEVER_CACHE_PATTERNS = [
  /^\/api\/auth/,
  /^\/api\/account\//,
  /^\/api\/.*\/(start|cancel|claim|create|delete|update)/,
];

self.addEventListener("install", (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(PAGE_CACHE).then((cache) => cache.addAll(["/offline"]).catch(() => {}))
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => !ALL_CACHES.includes(k)).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

function isTileRequest(url) {
  if (url.hostname.endsWith("mapbox.com") || url.hostname.endsWith("tiles.mapbox.com")) {
    return /\.(?:vector\.pbf|mvt|png|jpg|webp)(?:\?|$)/.test(url.pathname);
  }
  return url.pathname.startsWith("/api/tiles/");
}

function isAssetRequest(url, req) {
  if (url.origin !== self.location.origin) return false;
  const dest = req.destination;
  return dest === "image" || dest === "font" || dest === "style" || dest === "script";
}

function isApiRequest(url) {
  return url.pathname.startsWith("/api/") || url.hostname.endsWith(".supabase.co");
}

function isApiSwrCandidate(url) {
  return API_SWR_PATTERNS.some((p) => p.test(url.pathname));
}

function isApiNeverCache(url) {
  return API_NEVER_CACHE_PATTERNS.some((p) => p.test(url.pathname));
}

function withTimestamp(res) {
  return new Response(res.clone().body, {
    status: res.status,
    statusText: res.statusText,
    headers: { ...Object.fromEntries(res.headers.entries()), "x-cached-at": String(Date.now()) },
  });
}

async function cacheFirst(req, cacheName, ttlMs) {
  const cache = await caches.open(cacheName);
  const hit = await cache.match(req);
  if (hit) {
    const cachedAt = Number(hit.headers.get("x-cached-at") || 0);
    if (Date.now() - cachedAt < ttlMs) return hit;
  }
  try {
    const res = await fetch(req);
    if (res.ok) cache.put(req, withTimestamp(res)).catch(() => {});
    return res;
  } catch (e) {
    if (hit) return hit;
    throw e;
  }
}

async function staleWhileRevalidate(req, cacheName, ttlMs) {
  const cache = await caches.open(cacheName);
  const hit = await cache.match(req);
  const fetchPromise = fetch(req).then((res) => {
    if (res.ok) cache.put(req, withTimestamp(res)).catch(() => {});
    return res;
  }).catch(() => null);
  if (hit) {
    const cachedAt = Number(hit.headers.get("x-cached-at") || 0);
    if (Date.now() - cachedAt < ttlMs) {
      // Sofort aus Cache, im Hintergrund refresh
      void fetchPromise;
      return hit;
    }
  }
  const fresh = await fetchPromise;
  if (fresh) return fresh;
  if (hit) return hit; // offline fallback auf abgelaufenen Cache
  return new Response(JSON.stringify({ error: "offline" }), { status: 503, headers: { "Content-Type": "application/json" } });
}

async function networkFirstWithOffline(req) {
  try {
    const res = await fetch(req);
    if (res.ok && req.method === "GET") {
      const cache = await caches.open(PAGE_CACHE);
      cache.put(req, res.clone()).catch(() => {});
    }
    return res;
  } catch {
    const cache = await caches.open(PAGE_CACHE);
    const hit = await cache.match(req);
    if (hit) return hit;
    const offline = await cache.match("/offline");
    if (offline) return offline;
    return new Response("Offline", { status: 503, statusText: "Offline" });
  }
}

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);

  // API: niemals Auth/Mutations cachen
  if (isApiRequest(url)) {
    if (isApiNeverCache(url)) return;
    if (isApiSwrCandidate(url)) {
      event.respondWith(staleWhileRevalidate(req, API_SWR_CACHE, API_SWR_TTL_MS));
      return;
    }
    return; // andere APIs: durchs Netz
  }

  if (isTileRequest(url)) {
    event.respondWith(cacheFirst(req, TILE_CACHE, TILE_TTL_MS));
    return;
  }

  if (isAssetRequest(url, req)) {
    event.respondWith(cacheFirst(req, ASSET_CACHE, ASSET_TTL_MS));
    return;
  }

  if (req.mode === "navigate") {
    event.respondWith(networkFirstWithOffline(req));
    return;
  }
});
