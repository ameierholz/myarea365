# Load-Tests

## Setup

k6 installieren: https://k6.io/docs/getting-started/installation/

Windows: `winget install k6` oder `choco install k6`

## Map-BBox-Test (100 VUs)

```bash
# Gegen Production
k6 run scripts/loadtest/map-bbox.k6.js

# Gegen Staging
BASE_URL=https://staging.myarea365.de k6 run scripts/loadtest/map-bbox.k6.js

# Mit eingeloggtem Cookie (Auth-spezifische Endpoints)
AUTH_COOKIE="sb-access-token=eyJ..." BASE_URL=https://myarea365.de k6 run scripts/loadtest/map-bbox.k6.js
```

## Erwartete Werte (Stand Sprint 1+2)

- p95 `/api/map/bbox` < 500ms
- p99 < 1500ms
- 0% 5xx
- < 1% Failed Requests

Falls nicht erfüllt → `mcp__claude_ai_Supabase__get_logs` checken auf Slow Queries.

## Erweitern

Für realistischere Lasten:
- `gather/start` + `gather/cancel` simulieren (Write-Path)
- WebSocket-Subscriptions auf `marches` parallel (k6 hat eingebauten WS-Support)
- Mapbox-Tile-Requests zählen nicht — die laufen über Mapbox-CDN
