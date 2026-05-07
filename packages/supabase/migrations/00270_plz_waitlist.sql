-- ════════════════════════════════════════════════════════════════════
-- PLZ-Wartelisten + nächste größere Stadt-Empfehlung.
--
-- Wenn ein User mit einer PLZ registriert für die noch kein Server existiert:
--   1) Eintrag in plz_waitlist (für Analytics + spätere Benachrichtigung)
--   2) System empfiehlt die nächste größere unterstützte Stadt
--      (Distanz zwischen PLZ-Centroid und cities.default_center)
--
-- Wir nutzen eine plz_centroids-Tabelle mit ungefähren Koordinaten pro
-- 2-stelligem PLZ-Präfix für die Distanz-Berechnung. Das ist datensparsam
-- und reicht für "nächste Stadt"-Vorschläge auf Bundesland-Ebene.
-- ════════════════════════════════════════════════════════════════════

-- Wartelisten-Tabelle
create table if not exists public.plz_waitlist (
  id                  uuid primary key default gen_random_uuid(),
  plz                 text not null check (plz ~ '^[0-9]{5}$'),
  user_id             uuid references public.users(id) on delete cascade,
  email               text,
  fallback_city_slug  text references public.cities(slug),
  source              text default 'register',  -- "register", "settings_change", etc.
  created_at          timestamptz not null default now(),
  notified_at         timestamptz,
  metadata            jsonb default '{}'::jsonb
);

create index if not exists idx_plz_waitlist_plz on public.plz_waitlist(plz);
create index if not exists idx_plz_waitlist_user on public.plz_waitlist(user_id) where user_id is not null;
create index if not exists idx_plz_waitlist_pending on public.plz_waitlist(notified_at) where notified_at is null;

comment on table public.plz_waitlist is
  'PLZ-Anfragen für noch nicht unterstützte Regionen. Bei Server-Eröffnung dieser Region werden alle pending Einträge benachrichtigt.';

-- PLZ-Präfix-Centroids (ungefähre geographische Mitte des PLZ-Bereichs)
-- Quelle: gemeinsame Koordinaten pro PLZ-Präfix (Public Domain / abgeleitet)
create table if not exists public.plz_centroids (
  plz_prefix  text primary key check (plz_prefix ~ '^[0-9]{2}$'),
  lng         double precision not null,
  lat         double precision not null,
  city_hint   text  -- größte Stadt im Präfix-Bereich (informativ)
);

comment on table public.plz_centroids is
  'Ungefähre Koordinaten pro 2-stelligem PLZ-Präfix für Distance-basierte Stadt-Empfehlungen.';

-- Centroids für alle deutschen PLZ-Präfixe seeden (00–99)
insert into public.plz_centroids (plz_prefix, lng, lat, city_hint) values
  ('01', 13.74, 51.05, 'Dresden'),
  ('02', 14.45, 51.18, 'Bautzen/Görlitz'),
  ('03', 14.33, 51.76, 'Cottbus'),
  ('04', 12.37, 51.34, 'Leipzig'),
  ('06', 11.97, 51.48, 'Halle'),
  ('07', 11.59, 50.93, 'Jena/Gera'),
  ('08', 12.50, 50.71, 'Zwickau/Plauen'),
  ('09', 12.92, 50.83, 'Chemnitz'),
  ('10', 13.40, 52.52, 'Berlin Mitte'),
  ('11', 13.40, 52.52, 'Berlin'),
  ('12', 13.45, 52.45, 'Berlin Süd'),
  ('13', 13.40, 52.58, 'Berlin Nord'),
  ('14', 13.20, 52.40, 'Brandenburg/Potsdam'),
  ('15', 14.25, 52.30, 'Frankfurt Oder'),
  ('16', 13.30, 52.70, 'Eberswalde/Oranienburg'),
  ('17', 13.40, 53.50, 'Neubrandenburg/Stralsund'),
  ('18', 12.13, 54.08, 'Rostock'),
  ('19', 11.42, 53.63, 'Schwerin'),
  ('20', 9.99, 53.55, 'Hamburg Mitte'),
  ('21', 9.95, 53.45, 'Hamburg Süd/Lüneburg'),
  ('22', 10.05, 53.65, 'Hamburg Nord'),
  ('23', 10.69, 53.87, 'Lübeck'),
  ('24', 10.13, 54.32, 'Kiel'),
  ('25', 9.10, 54.20, 'Husum/Heide'),
  ('26', 7.99, 53.14, 'Oldenburg/Emden'),
  ('27', 8.80, 53.08, 'Bremerhaven/Bremen-Nord'),
  ('28', 8.81, 53.08, 'Bremen'),
  ('29', 10.42, 52.85, 'Celle/Lüneburger Heide'),
  ('30', 9.74, 52.37, 'Hannover'),
  ('31', 9.88, 52.15, 'Hildesheim/Hameln'),
  ('32', 8.74, 52.02, 'Bielefeld/Herford'),
  ('33', 8.53, 51.72, 'Paderborn/Bielefeld'),
  ('34', 9.49, 51.31, 'Kassel'),
  ('35', 8.68, 50.80, 'Marburg/Gießen'),
  ('36', 9.68, 50.55, 'Fulda/Bad Hersfeld'),
  ('37', 9.93, 51.53, 'Göttingen'),
  ('38', 10.52, 52.27, 'Braunschweig/Wolfsburg'),
  ('39', 11.62, 52.13, 'Magdeburg'),
  ('40', 6.78, 51.23, 'Düsseldorf'),
  ('41', 6.45, 51.20, 'Mönchengladbach/Neuss'),
  ('42', 7.18, 51.26, 'Wuppertal/Solingen'),
  ('44', 7.47, 51.51, 'Dortmund'),
  ('45', 7.01, 51.45, 'Essen'),
  ('46', 6.61, 51.50, 'Oberhausen/Wesel'),
  ('47', 6.62, 51.43, 'Duisburg/Krefeld'),
  ('48', 7.62, 51.96, 'Münster'),
  ('49', 8.05, 52.27, 'Osnabrück'),
  ('50', 6.96, 50.94, 'Köln'),
  ('51', 7.20, 50.95, 'Köln-Ost/Leverkusen'),
  ('52', 6.08, 50.78, 'Aachen'),
  ('53', 7.10, 50.74, 'Bonn'),
  ('54', 6.64, 49.75, 'Trier'),
  ('55', 8.27, 49.99, 'Mainz/Bingen'),
  ('56', 7.59, 50.36, 'Koblenz'),
  ('57', 7.97, 50.86, 'Siegen'),
  ('58', 7.46, 51.36, 'Hagen/Iserlohn'),
  ('59', 7.83, 51.65, 'Hamm/Soest'),
  ('60', 8.68, 50.11, 'Frankfurt Mitte'),
  ('61', 8.62, 50.27, 'Bad Homburg/Friedberg'),
  ('63', 9.10, 50.13, 'Offenbach/Hanau'),
  ('64', 8.65, 49.87, 'Darmstadt'),
  ('65', 8.24, 50.08, 'Wiesbaden'),
  ('66', 7.00, 49.24, 'Saarbrücken'),
  ('67', 8.18, 49.45, 'Kaiserslautern/Ludwigshafen'),
  ('68', 8.47, 49.49, 'Mannheim'),
  ('69', 8.69, 49.41, 'Heidelberg'),
  ('70', 9.18, 48.78, 'Stuttgart'),
  ('71', 9.05, 48.90, 'Ludwigsburg/Böblingen'),
  ('72', 9.04, 48.52, 'Tübingen/Reutlingen'),
  ('73', 9.87, 48.79, 'Aalen/Schwäbisch Gmünd'),
  ('74', 9.21, 49.14, 'Heilbronn'),
  ('75', 8.69, 48.89, 'Pforzheim'),
  ('76', 8.40, 49.01, 'Karlsruhe'),
  ('77', 8.00, 48.46, 'Offenburg/Baden-Baden'),
  ('78', 8.55, 47.98, 'Konstanz/Villingen'),
  ('79', 7.85, 47.99, 'Freiburg'),
  ('80', 11.58, 48.14, 'München Mitte'),
  ('81', 11.60, 48.10, 'München Süd'),
  ('82', 11.20, 48.00, 'Starnberg/Garmisch'),
  ('83', 12.18, 47.85, 'Rosenheim/Traunstein'),
  ('84', 12.45, 48.55, 'Landshut'),
  ('85', 11.43, 48.27, 'Ingolstadt/Erding'),
  ('86', 10.90, 48.37, 'Augsburg'),
  ('87', 10.32, 47.73, 'Kempten/Memmingen'),
  ('88', 9.74, 47.78, 'Ravensburg/Friedrichshafen'),
  ('89', 10.00, 48.40, 'Ulm'),
  ('90', 11.08, 49.45, 'Nürnberg'),
  ('91', 10.99, 49.57, 'Erlangen/Fürth'),
  ('92', 12.10, 49.45, 'Amberg/Weiden'),
  ('93', 12.10, 49.01, 'Regensburg'),
  ('94', 13.45, 48.55, 'Passau/Deggendorf'),
  ('95', 11.58, 50.10, 'Hof/Bayreuth'),
  ('96', 10.97, 50.00, 'Bamberg/Coburg'),
  ('97', 9.93, 49.79, 'Würzburg'),
  ('98', 10.72, 50.55, 'Suhl/Meiningen'),
  ('99', 11.03, 50.99, 'Erfurt/Weimar')
on conflict (plz_prefix) do nothing;

-- ════════════════════════════════════════════════════════════════════
-- RPC: PLZ checken + Stadt-Vorschlag liefern
-- ════════════════════════════════════════════════════════════════════
create or replace function public.check_plz_city(p_plz text)
returns table (
  has_city            boolean,
  city_slug           text,
  city_name           text,
  suggestion_slug     text,
  suggestion_name     text,
  suggestion_distance_km numeric
)
language plpgsql
stable
as $$
declare
  v_prefix text;
  v_centroid record;
  v_match record;
  v_nearest record;
begin
  if p_plz is null or not (p_plz ~ '^[0-9]{5}$') then
    return query select false, null::text, null::text, null::text, null::text, null::numeric;
    return;
  end if;

  v_prefix := substr(p_plz, 1, 2);

  -- Direkter Match?
  select c.slug, c.name into v_match
    from public.cities c
    join public.plz_to_city p on p.city_slug = c.slug
   where p.plz_prefix = v_prefix and c.is_active
   limit 1;

  if found then
    return query select true, v_match.slug, v_match.name, null::text, null::text, null::numeric;
    return;
  end if;

  -- Kein Match → nächste aktive Stadt anhand PLZ-Centroid berechnen
  select * into v_centroid from public.plz_centroids where plz_prefix = v_prefix;

  if not found then
    -- Kein Centroid bekannt → erste aktive Stadt als Vorschlag
    select c.slug, c.name into v_match
      from public.cities c
     where c.is_active
     order by c.opened_at
     limit 1;
    if found then
      return query select false, null::text, null::text, v_match.slug, v_match.name, null::numeric;
    else
      return query select false, null::text, null::text, null::text, null::text, null::numeric;
    end if;
    return;
  end if;

  -- Distanz-Berechnung (Haversine, vereinfacht für DE-Range)
  -- Approximation: 1° lat ≈ 111 km, 1° lng ≈ 111 km × cos(lat)
  select c.slug, c.name,
         (sqrt(
           power((c.default_center_lat - v_centroid.lat) * 111, 2) +
           power((c.default_center_lng - v_centroid.lng) * 111 * cos(radians(v_centroid.lat)), 2)
         ))::numeric(10, 1) as dist_km
    into v_nearest
    from public.cities c
   where c.is_active
   order by dist_km
   limit 1;

  if found then
    return query select false, null::text, null::text, v_nearest.slug, v_nearest.name, v_nearest.dist_km;
  else
    return query select false, null::text, null::text, null::text, null::text, null::numeric;
  end if;
end;
$$;

comment on function public.check_plz_city is
  'Prüft ob für eine PLZ ein aktiver Server existiert. Gibt entweder den Match oder die nächstgelegene aktive Stadt als Vorschlag zurück (Luftlinie in km).';

-- ════════════════════════════════════════════════════════════════════
-- RLS für plz_waitlist + plz_centroids
-- ════════════════════════════════════════════════════════════════════
alter table public.plz_waitlist  enable row level security;
alter table public.plz_centroids enable row level security;

-- User können eigene Wartelisten-Einträge sehen + neue erstellen
drop policy if exists "waitlist_self_select" on public.plz_waitlist;
create policy "waitlist_self_select"
  on public.plz_waitlist for select to authenticated
  using (user_id = auth.uid());

drop policy if exists "waitlist_self_insert" on public.plz_waitlist;
create policy "waitlist_self_insert"
  on public.plz_waitlist for insert to authenticated
  with check (user_id = auth.uid() or user_id is null);

-- Centroids sind public read
drop policy if exists "plz_centroids_public_read" on public.plz_centroids;
create policy "plz_centroids_public_read"
  on public.plz_centroids for select to authenticated using (true);
