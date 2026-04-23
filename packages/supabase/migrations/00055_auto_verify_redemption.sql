-- 00055: Einlöse-Prozess „fließend" machen — Auto-Verify via GPS-Proximity.
--
-- Problem: Aktueller Flow zwingt Shop-Personal, einen 6-stelligen Code
-- manuell einzutippen oder zu klicken. Das ist UX-Gift: 60-90 % der Shops
-- würden das Dashboard nie öffnen — die Einlösungen würden ewig als
-- "pending" liegenbleiben, Runner würden enttäuscht abreisen.
--
-- Fix: Wenn der Runner seine GPS-Position mitsendet UND er tatsächlich
-- innerhalb von 80 m um den Shop ist, wird die Einlösung sofort
-- als 'verified' erstellt. Der Runner sieht direkt den grünen
-- Bestätigungs-Screen — das Personal muss NICHTS tun.
--
-- Fallback: Kein GPS / außer Reichweite → 6-stelliger Code wie bisher
-- (für Edge-Cases, z. B. Indoor-GPS-Probleme in Kellergeschäften).

-- ═══════════════════════════════════════════════════════
-- 1) deal_redemptions sicherstellen (CREATE IF NOT EXISTS)
--    Die Tabelle wird in 00017+ geALTERt, aber das ursprüngliche
--    CREATE fehlt in den Migrations — vermutlich in Supabase direkt.
-- ═══════════════════════════════════════════════════════
create table if not exists public.deal_redemptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  business_id uuid not null references public.local_businesses(id) on delete cascade,
  deal_id uuid,
  status text not null default 'pending' check (status in ('pending','verified','expired','cancelled')),
  one_time_code text,
  expires_at timestamptz,
  xp_paid int not null default 0,
  verified_at timestamptz,
  verified_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  auto_verified boolean not null default false,
  distance_m double precision
);

alter table public.deal_redemptions
  add column if not exists auto_verified boolean not null default false,
  add column if not exists distance_m double precision;

create index if not exists idx_deal_redemptions_business_pending
  on public.deal_redemptions(business_id, status, created_at desc)
  where status = 'pending';
create index if not exists idx_deal_redemptions_code
  on public.deal_redemptions(one_time_code)
  where status = 'pending';

-- ═══════════════════════════════════════════════════════
-- 2) redeem_deal_v2 — macht den fließenden Flow möglich
-- ═══════════════════════════════════════════════════════
create or replace function public.redeem_deal_v2(
  p_user_id uuid,
  p_business_id uuid,
  p_deal_id uuid,
  p_lat double precision default null,
  p_lng double precision default null,
  p_max_radius_m int default 80
) returns jsonb
language plpgsql security definer as $$
declare
  v_xp_cost int;
  v_active boolean;
  v_min_order_cents int;
  v_user_xp int;
  v_redemption_id uuid;
  v_code text;
  v_distance_m double precision;
  v_auto_verified boolean := false;
  v_shop_name text;
  v_deal_title text;
begin
  -- Deal laden (shop_deals, seit 00054 kanonisch)
  select xp_cost, active, min_order_amount_cents, title
    into v_xp_cost, v_active, v_min_order_cents, v_deal_title
  from public.shop_deals
  where id = p_deal_id and shop_id = p_business_id;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'deal_not_found');
  end if;
  if not v_active then
    return jsonb_build_object('ok', false, 'error', 'deal_inactive');
  end if;

  -- User hat genug Wegemünzen?
  select coalesce(wegemuenzen, xp, 0) into v_user_xp
  from public.users where id = p_user_id;
  if coalesce(v_user_xp, 0) < coalesce(v_xp_cost, 0) then
    return jsonb_build_object(
      'ok', false, 'error', 'not_enough_wegemuenzen',
      'have', coalesce(v_user_xp, 0), 'need', coalesce(v_xp_cost, 0)
    );
  end if;

  -- Shop-Name + Proximity-Check
  select name into v_shop_name from public.local_businesses where id = p_business_id;

  if p_lat is not null and p_lng is not null then
    select st_distance(
      location::geography,
      st_setsrid(st_makepoint(p_lng, p_lat), 4326)::geography
    ) into v_distance_m
    from public.local_businesses
    where id = p_business_id and location is not null;
    if v_distance_m is not null and v_distance_m <= p_max_radius_m then
      v_auto_verified := true;
    end if;
  end if;

  -- 6-stelliger Code (auch bei Auto-Verify, als Fallback/Logging)
  v_code := lpad((floor(random() * 1000000))::text, 6, '0');

  -- Wegemünzen abziehen (Dual-Write XP/Wegemünzen für Legacy-Kompatibilität)
  update public.users set
    wegemuenzen = greatest(0, coalesce(wegemuenzen, 0) - v_xp_cost),
    xp = greatest(0, coalesce(xp, 0) - v_xp_cost)
  where id = p_user_id;

  -- Redemption erstellen
  insert into public.deal_redemptions (
    user_id, business_id, deal_id, status, one_time_code, expires_at,
    xp_paid, verified_at, verified_by, auto_verified, distance_m
  ) values (
    p_user_id, p_business_id, p_deal_id,
    case when v_auto_verified then 'verified' else 'pending' end,
    v_code,
    case when v_auto_verified then now() + interval '60 seconds'
                                else now() + interval '5 minutes' end,
    v_xp_cost,
    case when v_auto_verified then now() else null end,
    case when v_auto_verified then p_user_id else null end,
    v_auto_verified,
    v_distance_m
  ) returning id into v_redemption_id;

  -- Counter in shop_deals hochzählen
  update public.shop_deals set redemption_count = coalesce(redemption_count, 0) + 1
    where id = p_deal_id;

  -- Bei Auto-Verify: Loot sofort rollen (wenn Funktion existiert)
  if v_auto_verified then
    begin
      perform public.award_redemption_loot(v_redemption_id);
    exception when others then
      -- Loot-Roll ist best-effort; blockiert die Einlösung nicht
      null;
    end;
  end if;

  return jsonb_build_object(
    'ok', true,
    'id', v_redemption_id,
    'code', v_code,
    'expires_at',
      case when v_auto_verified then now() + interval '60 seconds'
                                else now() + interval '5 minutes' end,
    'auto_verified', v_auto_verified,
    'distance_m', v_distance_m,
    'shop_name', v_shop_name,
    'deal_title', v_deal_title,
    'min_order_cents', v_min_order_cents,
    'xp_paid', v_xp_cost
  );
end $$;

grant execute on function public.redeem_deal_v2(uuid, uuid, uuid, double precision, double precision, int)
  to authenticated;

comment on function public.redeem_deal_v2 is
  'Einlöse-Flow mit GPS-Auto-Verify: wenn Runner-Position innerhalb p_max_radius_m des Shops ist, sofort als verified. Sonst fällt auf pending+Code zurück.';
