-- ════════════════════════════════════════════════════════════════════
-- City-Server-Architektur: Heimat-Stadt pro User via PLZ-Zuweisung.
--
-- - cities: jede Stadt ist ein Spielserver mit eigener Bounding-Box
-- - plz_to_city: 2-stellige PLZ-Präfixe → city_slug
-- - users.home_city_slug: denormalized für fast lookup, auto-assigned via Trigger
--
-- Konzept (siehe Memory project_city_servers.md):
-- - User registriert mit PLZ → Trigger setzt home_city_slug
-- - Heimat-Map des Users wird durch home_city → cities.bounds bestimmt
-- - Pro Stadt läuft EIN Server, neue Server-Instanzen via Admin-Rotation
-- ════════════════════════════════════════════════════════════════════

-- Cities-Tabelle
create table if not exists public.cities (
  slug                text primary key,
  name                text not null,
  country             text not null default 'DE',
  bounds_sw_lng       double precision not null,
  bounds_sw_lat       double precision not null,
  bounds_ne_lng       double precision not null,
  bounds_ne_lat       double precision not null,
  default_center_lng  double precision not null,
  default_center_lat  double precision not null,
  default_zoom        integer not null default 12,
  min_zoom            integer not null default 11,
  max_zoom            integer not null default 19,
  is_active           boolean not null default true,
  opened_at           timestamptz not null default now()
);

comment on table public.cities is
  'Reale Städte als Spiel-Server. Eine Heimat-Map pro Stadt. Jeder User wird via PLZ einer Stadt zugewiesen.';

-- PLZ-Präfix → City-Mapping (datensparsam: nur 2 Ziffern)
create table if not exists public.plz_to_city (
  plz_prefix  text primary key check (plz_prefix ~ '^[0-9]{2}$'),
  city_slug   text not null references public.cities(slug) on delete cascade
);

comment on table public.plz_to_city is
  'Mapping: erste 2 PLZ-Ziffern → city_slug. DSGVO-konform: speichert nur Präfix, nicht volle PLZ.';

-- Users → home_city_slug (denormalized, auto-set via Trigger)
alter table public.users
  add column if not exists home_city_slug text references public.cities(slug);

create index if not exists idx_users_home_city
  on public.users(home_city_slug)
  where home_city_slug is not null;

-- Helper: PLZ → city_slug Lookup
create or replace function public.city_from_plz(p_plz text)
returns text
language sql
stable
as $$
  select city_slug from public.plz_to_city
   where plz_prefix = substr(p_plz, 1, 2)
   limit 1;
$$;

comment on function public.city_from_plz is
  'Liefert city_slug für eine 5-stellige PLZ via Präfix-Match. NULL falls keine Stadt zugeordnet.';

-- Trigger: auto-assign home_city_slug bei heimat_plz-Änderung
create or replace function public.users_assign_home_city()
returns trigger
language plpgsql
as $$
begin
  if new.heimat_plz is null then
    new.home_city_slug := null;
  elsif new.heimat_plz is distinct from coalesce(old.heimat_plz, '') then
    new.home_city_slug := public.city_from_plz(new.heimat_plz);
  end if;
  return new;
end;
$$;

drop trigger if exists trg_users_home_city on public.users;
create trigger trg_users_home_city
  before insert or update of heimat_plz on public.users
  for each row execute function public.users_assign_home_city();

-- Backfill: bestehende User mit PLZ aber ohne city zuweisen
update public.users
   set home_city_slug = public.city_from_plz(heimat_plz)
 where heimat_plz is not null
   and home_city_slug is null;

-- ════════════════════════════════════════════════════════════════════
-- SEED — Soft-Launch-Phase: nur Berlin als aktiver Server.
-- Weitere Städte (Hamburg, München, Köln) später per Migration oder Admin-UI.
-- ════════════════════════════════════════════════════════════════════
insert into public.cities (
  slug, name, country,
  bounds_sw_lng, bounds_sw_lat, bounds_ne_lng, bounds_ne_lat,
  default_center_lng, default_center_lat,
  default_zoom, min_zoom, max_zoom
) values
  ('berlin', 'Berlin', 'DE',
   13.088, 52.338, 13.761, 52.675,
   13.405, 52.520,
   12, 11, 19)
on conflict (slug) do nothing;

-- Berliner PLZ-Bereich: 10000–14199 → Präfix 10, 11, 12, 13, 14
insert into public.plz_to_city (plz_prefix, city_slug) values
  ('10', 'berlin'),
  ('11', 'berlin'),
  ('12', 'berlin'),
  ('13', 'berlin'),
  ('14', 'berlin')
on conflict (plz_prefix) do nothing;

-- Re-run Backfill jetzt wo Berlin geseeded ist
update public.users
   set home_city_slug = public.city_from_plz(heimat_plz)
 where heimat_plz is not null
   and home_city_slug is null;

-- ════════════════════════════════════════════════════════════════════
-- RLS — Cities + PLZ-Mapping sind read-only public für eingeloggte User
-- ════════════════════════════════════════════════════════════════════
alter table public.cities       enable row level security;
alter table public.plz_to_city  enable row level security;

drop policy if exists "cities_public_read" on public.cities;
create policy "cities_public_read"
  on public.cities for select
  to authenticated
  using (is_active);

drop policy if exists "plz_to_city_public_read" on public.plz_to_city;
create policy "plz_to_city_public_read"
  on public.plz_to_city for select
  to authenticated
  using (true);
