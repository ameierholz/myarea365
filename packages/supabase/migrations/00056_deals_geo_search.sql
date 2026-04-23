-- 00056: Geo-Filter-Felder auf local_businesses + Indexes für Deals-Suche.
--
-- Runner sollen alle Deals nach Land/Bundesland/Stadt/PLZ/Radius filtern
-- können — aktuell gibt es nur die Map-Ansicht. Für eine Listen-Sicht
-- müssen die Shops diese Felder haben. city existiert seit 00054,
-- country/state/zip kommen jetzt dazu.

alter table public.local_businesses
  add column if not exists country text not null default 'DE',
  add column if not exists state text,
  add column if not exists zip text;

comment on column public.local_businesses.country is
  'ISO-Länder-Code (DE/AT/CH). Default DE.';
comment on column public.local_businesses.state is
  'Bundesland / Kanton / Bundesland (Berlin, Bayern, Wien, Zürich, …).';
comment on column public.local_businesses.zip is
  'PLZ als Text (Führende Nullen möglich in AT/CH).';

-- Indexe für schnelle Filter-Queries
create index if not exists idx_lb_country_state_city
  on public.local_businesses(country, state, city)
  where status = 'approved' and active = true;

create index if not exists idx_lb_zip
  on public.local_businesses(zip)
  where status = 'approved' and active = true;

create index if not exists idx_lb_category
  on public.local_businesses(category)
  where status = 'approved' and active = true;

-- Bestehende approved Shops: zip und state aus address extrahieren falls möglich
-- (best-effort; PLZ ist 5-stellige Ziffernfolge in DE)
update public.local_businesses
  set zip = substring(address from '\m(\d{5})\M')
  where zip is null and address ~ '\m\d{5}\M';

-- ═══════════════════════════════════════════════════════
-- Helper-Funktion: Deals durchsuchen mit optionalem Radius-Filter
-- ═══════════════════════════════════════════════════════
create or replace function public.search_deals(
  p_country text default null,
  p_state text default null,
  p_city text default null,
  p_zip text default null,
  p_category text default null,
  p_lat double precision default null,
  p_lng double precision default null,
  p_radius_km int default null,
  p_q text default null,  -- Volltext über Shop-Name und Deal-Titel
  p_sort text default 'distance',  -- distance | price_asc | popular | newest
  p_limit int default 50,
  p_offset int default 0
) returns table (
  deal_id uuid,
  shop_id uuid,
  shop_name text,
  shop_category text,
  shop_city text,
  shop_zip text,
  shop_address text,
  shop_logo_url text,
  deal_title text,
  deal_description text,
  xp_cost int,
  min_order_amount_cents int,
  frequency text,
  redemption_count int,
  active_until timestamptz,
  distance_m double precision
) language sql stable as $$
  with base as (
    select
      d.id as deal_id,
      b.id as shop_id,
      b.name as shop_name,
      b.category as shop_category,
      b.city as shop_city,
      b.zip as shop_zip,
      b.address as shop_address,
      b.logo_url as shop_logo_url,
      d.title as deal_title,
      d.description as deal_description,
      d.xp_cost,
      d.min_order_amount_cents,
      d.frequency,
      coalesce(d.redemption_count, 0) as redemption_count,
      d.active_until,
      case
        when p_lat is not null and p_lng is not null and b.location is not null then
          st_distance(
            b.location::geography,
            st_setsrid(st_makepoint(p_lng, p_lat), 4326)::geography
          )
        else null
      end as distance_m
    from public.shop_deals d
    join public.local_businesses b on b.id = d.shop_id
    where
      d.active = true
      and (d.active_until is null or d.active_until > now())
      and b.status = 'approved'
      and b.active = true
      and (p_country is null or b.country = p_country)
      and (p_state is null or b.state ilike p_state)
      and (p_city is null or b.city ilike '%' || p_city || '%')
      and (p_zip is null or b.zip = p_zip)
      and (p_category is null or b.category ilike '%' || p_category || '%')
      and (p_q is null or b.name ilike '%' || p_q || '%' or d.title ilike '%' || p_q || '%')
  ),
  filtered as (
    select * from base
    where p_radius_km is null or distance_m is null or distance_m <= p_radius_km * 1000
  )
  select * from filtered
  order by
    case when p_sort = 'distance'  then distance_m end nulls last,
    case when p_sort = 'price_asc' then xp_cost end,
    case when p_sort = 'popular'   then -redemption_count end,
    case when p_sort = 'newest'    then active_until end desc nulls last
  limit p_limit offset p_offset;
$$;

grant execute on function public.search_deals(
  text, text, text, text, text,
  double precision, double precision, int,
  text, text, int, int
) to authenticated, anon;

comment on function public.search_deals is
  'Durchsucht aktive Deals mit Geo- und Text-Filtern. Sortierung: distance|price_asc|popular|newest.';
