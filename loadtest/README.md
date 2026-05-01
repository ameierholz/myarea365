# Lasttests — myarea365.de

Vor Launch oder größeren Marketing-Aktionen mit k6 prüfen, ob Backend
1000+ concurrent Spieler verträgt.

## Setup

1. k6 installieren: <https://k6.io/docs/getting-started/installation>
2. (Optional) Test gegen Production: `BASE_URL=https://myarea365.de`
3. Auth-Cookie aus Browser kopieren (DevTools → Application → Cookies)

## Read-Only-Test (kein Login)

Prüft Edge-Cache + DB-Read-Pfade. Sollte mit 1000 vus stabil unter 800ms p95 bleiben.

```bash
k6 run --vus 100 --duration 60s loadtest/k6-readonly.js   # Basistest
k6 run --vus 500 --duration 5m  loadtest/k6-readonly.js   # Stresstest
k6 run --vus 1500 --duration 2m loadtest/k6-readonly.js   # Spike
```

## Authenticated-Test (Polling-Mix)

Simuliert 200 angemeldete User, jeder pollt alle 5 Listen-Endpoints alle ~60s
(Realtime-aware: greift nur als Watchdog).

```bash
K6_COOKIE='sb-access-token=...' k6 run --vus 200 --duration 5m loadtest/k6-authenticated.js
```

## Was bei Fehlern tun?

- **>5% 5xx-Errors**: Connection-Pool zu klein → Supabase-Plan upgraden,
  Supavisor explicit nutzen, Pool-Size ≥100.
- **p95 >2s**: Postgres CPU am Limit → langsame Query identifizieren via
  `pg_stat_statements`, Indizes ergänzen, Query rewriten.
- **429 rate-limited Spam**: Limits zu strikt → in `apps/web/src/lib/rate-limit.ts`-Aufrufen
  anpassen.
- **WebSocket-Disconnects in Browser-Tests**: Realtime-Plan upgraden
  (Supabase Pro = 500 concurrent Connections, Enterprise = mehr).

## Realistic Scenarios

- **Berlin-Launch (200 DAU peak)**: 100 vus × 5 min ist mehr als genug
- **Deutschland-Launch (5000 DAU peak)**: 1000 vus × 10 min
- **Spike nach Promo (Influencer-Tweet)**: 2000 vus × 1 min
