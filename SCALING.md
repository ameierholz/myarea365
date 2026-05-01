# Scaling — Was du noch tun musst

Stand: 01.05.2026. Backend-Optimierungen sind drin (Migration `00204`,
Cache, Indizes, pg_cron, Polling-Throttle, Rate-Limit-Code, Lasttests).

## ✅ Bereits erledigt (Code + DB)

- pg_cron tickt alle Lifecycle-Übergänge zentral (alle 10s) → keine read-time-Ticks mehr
- Mapbox-Walking-Route-Cache (~11m Grid) in Postgres → 80%+ Hit-Rate erwartbar
- Partielle Indizes auf alle Hot-Path-Queries (Rallies, Scouts, Marches)
- Polling drosselt automatisch auf 60s wenn Realtime-Channel SUBSCRIBED ist
- Edge-Cache-Headers auf öffentlichen Read-Endpoints (Strongholds 30s, Artwork 5min)
- Rate-Limit-Helpers (Upstash + In-Memory-Fallback) auf allen Action-Endpoints
- k6-Lasttest-Scripts in [`loadtest/`](loadtest/)

## 🔧 Du musst noch tun

### 1. Vercel Env-Vars setzen (Rate-Limit aktivieren)

Ohne diese Vars läuft der In-Memory-Fallback pro Lambda-Instance — bei hoher
Last umgehbar. Für echte verteilte Limits Upstash-Account anlegen
(<https://upstash.com> → Create Redis → Region eu-central-1):

```
UPSTASH_REDIS_REST_URL    = https://<id>.upstash.io
UPSTASH_REDIS_REST_TOKEN  = AY...
```

In Vercel Project → Settings → Environment Variables, für **Production +
Preview**.

### 2. Supabase-Plan ✅ Pro vorhanden

Damit gedeckt:
- DB-Connections: 200 (statt Free 60)
- Realtime concurrent: 500
- Storage egress: 250 GB
- Read-Replicas verfügbar (siehe Punkt 6)

Wechsel auf **Enterprise** erst sinnvoll wenn dauerhaft > 500 gleichzeitig
WebSocket-verbunden. Mit unserem Polling-Throttle (60s wenn Realtime aktiv)
ist 1000 concurrent auch auf Pro machbar — Watchdog-Polling übernimmt für
User die nicht aktiv via Realtime hängen.

### 3. Connection-Pooling explizit nutzen (Supabase)

Standardmäßig läuft alles über Supavisor. Bei Pro-Plan kann der Pool
hochgesetzt werden:

`Dashboard → Project Settings → Database → Connection Pooling`

- **Pool Size**: 100 (default 15)
- **Pool Mode**: Transaction (nicht Session)

### 4. Lasttest vor Launch

```bash
# Smoke (wenig Last, prüft dass alles antwortet)
k6 run --vus 50 --duration 60s loadtest/k6-readonly.js

# Berlin-Launch-Szenario (200 concurrent peak)
k6 run --vus 200 --duration 5m loadtest/k6-readonly.js

# Deutschland-Launch-Szenario (1000 concurrent peak)
k6 run --vus 1000 --duration 10m loadtest/k6-readonly.js
```

### 5. Monitoring einrichten (für Live-Monitoring)

- Vercel Analytics aktiviert lassen (DSGVO-konform, ohne Cookies)
- Supabase Dashboard → Reports → DB Performance regelmäßig checken
- Bei p95-Latency >1s: `Reports → Query Performance → Slow Queries`

## 📊 Realistische Kapazität nach diesen Optimierungen

| Concurrent Users | Status |
|---|---|
| 100 | locker, kein Plan-Upgrade nötig |
| 200 | OK auf Pro-Plan |
| 500 | OK mit Upstash + Pro-Plan + Pool 100 |
| 1000 | OK mit Upstash + Pro-Plan + Realtime Enterprise |
| 2000+ | Read-Replica empfohlen, Edge-Functions auswerten |

### 6. Auth: Leaked-Password-Protection einschalten

Supabase Auth kann Passwörter gegen <https://haveibeenpwned.com> prüfen
und kompromittierte ablehnen. Standardmäßig **AUS** — eine sehr günstige
Sicherheitsverbesserung:

1. Supabase Dashboard → `Authentication` → `Policies` (oder `Settings`)
2. Section `Password security` → Toggle **„Leaked password protection"** AN
3. Speichern

### 7. Read-Replica anlegen (empfohlen ab 500 concurrent)

Pro hat Read-Replicas inklusive — nutzen wir bisher nicht. Code ist
vorbereitet (`createReadClient()` in `apps/web/src/lib/supabase/server.ts`),
greift sobald die ENV gesetzt ist:

1. Supabase Dashboard → `Settings` → `Infrastructure` → `Read Replicas`
2. `Add Replica` → Region `eu-central-1` (gleiche Region wie Primary)
3. Connection-String kopieren (ähnlich `https://...replica.supabase.co`)
4. Vercel ENV setzen:
   ```
   SUPABASE_READ_REPLICA_URL = https://...replica.supabase.co
   ```
5. Optional: in API-Routes für read-heavy Endpoints (`/api/strongholds/nearby`,
   `/api/cosmetic-artwork`, etc.) `createClient()` durch `createReadClient()`
   ersetzen — kann ich auf Anfrage durchziehen, sobald Replica läuft.

## 🔮 Spätere Optimierungen (nicht akut)

- **DOM→Symbol-Layer für Map-Pins**: Viewport-Culling reicht für 1k. Erst
  bei 5k+ Spielern oder wenn mobile Performance-Reports schlecht werden.
- **Static Page-Generation für Landing**: Marketing-Seiten als ISR/SSG
  statt SSR für massiven Traffic-Spike (Influencer/Presse).
- **CDN für Mapbox-Tiles**: Mapbox hat schon CDN, aber falls eigene
  custom-Tiles → Cloudflare R2 davorschalten.

## Migrations-Datei

Alle DB-Änderungen sind in [`packages/supabase/migrations/00204_scaling_for_1k_concurrent.sql`](packages/supabase/migrations/00204_scaling_for_1k_concurrent.sql).
