-- Bug-Fix: lat/lng/icon/color als echte Spalten auf local_businesses.
-- ─────────────────────────────────────────────────────────────
-- Hintergrund: das initiale Schema (00001) speichert die Position als
-- PostGIS `location geometry(Point, 4326)`. Diverse Frontend-Queries
-- (shop_favorites, map-features, dashboard-trails) selektieren aber
-- direkt `lat, lng, icon, color` — diese Spalten existierten nie und
-- jeder solche SELECT knallt mit 400 "column does not exist".
--
-- Diese Migration legt die Spalten an, backfillt aus `location` wo
-- vorhanden, und setzt Defaults für icon/color. PostGIS-Queries auf
-- `location` bleiben funktional (Spalte wird nicht entfernt).

alter table public.local_businesses
  add column if not exists lat   double precision,
  add column if not exists lng   double precision,
  add column if not exists icon  text,
  add column if not exists color text;

-- Backfill aus PostGIS-Location (für Shops die schon eine haben)
update public.local_businesses
   set lat = ST_Y(location),
       lng = ST_X(location)
 where location is not null
   and (lat is null or lng is null);

-- Default-Icon/Farbe für Shops, die noch keinen Custom-Look haben
update public.local_businesses
   set icon = '🛍️'
 where icon is null;

update public.local_businesses
   set color = '#22D1C3'
 where color is null;

-- Indizes für Geo-Range-Queries (wer ist im 5-km-Umkreis?)
create index if not exists idx_local_businesses_lat_lng
  on public.local_businesses (lat, lng)
  where lat is not null and lng is not null;

comment on column public.local_businesses.lat is
  'Breitengrad in Dezimalgrad (WGS84). Wird vom Frontend direkt genutzt.';
comment on column public.local_businesses.lng is
  'Längengrad in Dezimalgrad (WGS84). Wird vom Frontend direkt genutzt.';
comment on column public.local_businesses.icon is
  'Emoji oder URL für den Map-Pin des Shops. Default: 🛍️';
comment on column public.local_businesses.color is
  'Hex-Farbe (#RRGGBB) für Map-Pin und Branding-Akzent. Default: #22D1C3';
