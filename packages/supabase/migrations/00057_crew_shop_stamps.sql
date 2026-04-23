-- 00057: Crew-Stempelkarten-System für Shops.
--
-- Jede Deal-Einlösung eines Crew-Mitglieds zählt als 1 Stempel für die
-- gesamte Crew bei diesem Shop. Ab definierten Schwellen (Bronze/Silber/
-- Gold) schaltet automatisch eine bessere Belohnung frei — für alle
-- Crew-Mitglieder. Shop-Besitzer konfiguriert einmal 3 Stufen, danach
-- läuft's. Null zusätzlicher Aufwand an der Kasse.
--
-- Design-Entscheidung: Stempel bleiben bei der Crew, nicht beim Mitglied.
-- Wer die Crew wechselt, lässt den Fortschritt da und fängt in der neuen
-- bei 0 an — verhindert Stempel-Transfer durch Abwerbung.

-- ═══════════════════════════════════════════════════════
-- 1) Stempel-Counter pro Crew × Shop
-- ═══════════════════════════════════════════════════════
create table if not exists public.crew_shop_stamps (
  crew_id uuid not null references public.crews(id) on delete cascade,
  shop_id uuid not null references public.local_businesses(id) on delete cascade,
  stamp_count int not null default 0,
  last_stamp_at timestamptz,
  tier_unlocked int not null default 0 check (tier_unlocked between 0 and 3),
  first_stamp_at timestamptz,
  primary key (crew_id, shop_id)
);

create index if not exists idx_crew_stamps_shop
  on public.crew_shop_stamps(shop_id, stamp_count desc);

alter table public.crew_shop_stamps enable row level security;

do $$ begin
  if not exists (select 1 from pg_policies where tablename='crew_shop_stamps' and policyname='crew_stamps_read') then
    create policy crew_stamps_read on public.crew_shop_stamps for select using (true);
  end if;
end $$;

-- ═══════════════════════════════════════════════════════
-- 2) Reward-Konfiguration pro Shop (3 Tiers)
-- ═══════════════════════════════════════════════════════
create table if not exists public.shop_crew_rewards (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.local_businesses(id) on delete cascade,
  tier int not null check (tier between 1 and 3),
  threshold int not null check (threshold > 0),
  label text not null,                    -- "Bronze", "Silber", "Gold" oder eigener Name
  reward_kind text not null check (reward_kind in (
    'discount_percent',  -- reward_value_int = % Rabatt beim Shop
    'free_item',         -- reward_value_text = "Gratis-Cappuccino pro Monat"
    'wegemuenzen_unlock',-- einmaliger 🪙-Bonus pro Mitglied bei Freischaltung
    'gebietsruf_unlock', -- einmaliger 🏴-Bonus pro Mitglied
    'crew_emblem'        -- Crew-Emblem erscheint am Shop-Pin auf der Karte
  )),
  reward_value_int int,
  reward_value_text text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique(shop_id, tier)
);

create index if not exists idx_shop_rewards_shop
  on public.shop_crew_rewards(shop_id, tier);

alter table public.shop_crew_rewards enable row level security;

do $$ begin
  if not exists (select 1 from pg_policies where tablename='shop_crew_rewards' and policyname='shop_rewards_read') then
    create policy shop_rewards_read on public.shop_crew_rewards
      for select using (active);
  end if;
  if not exists (select 1 from pg_policies where tablename='shop_crew_rewards' and policyname='shop_rewards_owner_write') then
    create policy shop_rewards_owner_write on public.shop_crew_rewards
      for all using (
        shop_id in (select id from public.local_businesses where owner_id = auth.uid())
      ) with check (
        shop_id in (select id from public.local_businesses where owner_id = auth.uid())
      );
  end if;
end $$;

-- ═══════════════════════════════════════════════════════
-- 3) award_crew_stamp — wird aus redeem_deal_v2 aufgerufen
-- ═══════════════════════════════════════════════════════
create or replace function public.award_crew_stamp(
  p_user_id uuid,
  p_shop_id uuid
) returns jsonb
language plpgsql security definer as $$
declare
  v_crew_id uuid;
  v_crew_name text;
  v_new_count int;
  v_old_tier int;
  v_new_tier int := 0;
  v_reward record;
  v_member_count int;
  v_unlock_rewards jsonb := '[]'::jsonb;
begin
  -- Crew des Users holen
  select cm.crew_id, c.name into v_crew_id, v_crew_name
  from public.crew_members cm
  join public.crews c on c.id = cm.crew_id
  where cm.user_id = p_user_id
  limit 1;

  if v_crew_id is null then
    return jsonb_build_object('ok', true, 'no_crew', true);
  end if;

  -- Counter hochzählen (upsert)
  insert into public.crew_shop_stamps (crew_id, shop_id, stamp_count, last_stamp_at, first_stamp_at)
  values (v_crew_id, p_shop_id, 1, now(), now())
  on conflict (crew_id, shop_id) do update set
    stamp_count = public.crew_shop_stamps.stamp_count + 1,
    last_stamp_at = now()
  returning stamp_count, tier_unlocked into v_new_count, v_old_tier;

  -- Neue Tiers prüfen (höher als vorher freigeschaltet, threshold erreicht)
  for v_reward in
    select tier, threshold, label, reward_kind, reward_value_int, reward_value_text
    from public.shop_crew_rewards
    where shop_id = p_shop_id and active = true
      and tier > v_old_tier
      and threshold <= v_new_count
    order by tier asc
  loop
    v_new_tier := v_reward.tier;

    -- Unlock-Belohnung an alle aktiven Crew-Mitglieder verteilen
    if v_reward.reward_kind = 'wegemuenzen_unlock' and v_reward.reward_value_int > 0 then
      update public.users set
        wegemuenzen = coalesce(wegemuenzen, 0) + v_reward.reward_value_int,
        xp = coalesce(xp, 0) + v_reward.reward_value_int
      where id in (select user_id from public.crew_members where crew_id = v_crew_id);
    elsif v_reward.reward_kind = 'gebietsruf_unlock' and v_reward.reward_value_int > 0 then
      update public.users set
        gebietsruf = coalesce(gebietsruf, 0) + v_reward.reward_value_int,
        gebietsruf_all_time = coalesce(gebietsruf_all_time, 0) + v_reward.reward_value_int
      where id in (select user_id from public.crew_members where crew_id = v_crew_id);
    end if;

    v_unlock_rewards := v_unlock_rewards || jsonb_build_object(
      'tier', v_reward.tier,
      'label', v_reward.label,
      'threshold', v_reward.threshold,
      'kind', v_reward.reward_kind,
      'value_int', v_reward.reward_value_int,
      'value_text', v_reward.reward_value_text
    );

    -- Crew-Feed-Eintrag (best-effort)
    begin
      select count(*) into v_member_count from public.crew_members where crew_id = v_crew_id;
      perform public.add_crew_feed(v_crew_id, null, 'shop_stamp_unlock',
        jsonb_build_object(
          'shop_id', p_shop_id,
          'tier', v_reward.tier,
          'label', v_reward.label,
          'members', v_member_count
        ));
    exception when others then null;
    end;
  end loop;

  if v_new_tier > v_old_tier then
    update public.crew_shop_stamps
      set tier_unlocked = v_new_tier
      where crew_id = v_crew_id and shop_id = p_shop_id;
  end if;

  return jsonb_build_object(
    'ok', true,
    'crew_id', v_crew_id,
    'crew_name', v_crew_name,
    'stamp_count', v_new_count,
    'tier_unlocked', greatest(v_old_tier, v_new_tier),
    'new_unlocks', v_unlock_rewards
  );
end $$;

grant execute on function public.award_crew_stamp(uuid, uuid) to authenticated;

-- ═══════════════════════════════════════════════════════
-- 4) redeem_deal_v2 erweitern: nach Auto-Verify Stempel vergeben
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
  v_stamp_result jsonb := null;
begin
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

  select coalesce(wegemuenzen, xp, 0) into v_user_xp
  from public.users where id = p_user_id;
  if coalesce(v_user_xp, 0) < coalesce(v_xp_cost, 0) then
    return jsonb_build_object(
      'ok', false, 'error', 'not_enough_wegemuenzen',
      'have', coalesce(v_user_xp, 0), 'need', coalesce(v_xp_cost, 0)
    );
  end if;

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

  v_code := lpad((floor(random() * 1000000))::text, 6, '0');

  update public.users set
    wegemuenzen = greatest(0, coalesce(wegemuenzen, 0) - v_xp_cost),
    xp = greatest(0, coalesce(xp, 0) - v_xp_cost)
  where id = p_user_id;

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

  update public.shop_deals set redemption_count = coalesce(redemption_count, 0) + 1
    where id = p_deal_id;

  if v_auto_verified then
    begin
      perform public.award_redemption_loot(v_redemption_id);
    exception when others then null;
    end;

    -- Crew-Stempel vergeben (best-effort, darf Einlösung nicht blocken)
    begin
      v_stamp_result := public.award_crew_stamp(p_user_id, p_business_id);
    exception when others then
      v_stamp_result := null;
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
    'xp_paid', v_xp_cost,
    'crew_stamp', v_stamp_result
  );
end $$;

-- ═══════════════════════════════════════════════════════
-- 5) Hilfs-RPC: Stempel-Progress für UI
-- ═══════════════════════════════════════════════════════
create or replace function public.get_crew_stamp_progress(
  p_user_id uuid,
  p_shop_id uuid
) returns jsonb
language plpgsql stable as $$
declare
  v_crew_id uuid;
  v_crew_name text;
  v_count int;
  v_tier_unlocked int;
  v_tiers jsonb;
begin
  select cm.crew_id, c.name into v_crew_id, v_crew_name
  from public.crew_members cm
  join public.crews c on c.id = cm.crew_id
  where cm.user_id = p_user_id
  limit 1;

  if v_crew_id is null then
    return jsonb_build_object('has_crew', false);
  end if;

  select stamp_count, tier_unlocked into v_count, v_tier_unlocked
  from public.crew_shop_stamps
  where crew_id = v_crew_id and shop_id = p_shop_id;
  v_count := coalesce(v_count, 0);
  v_tier_unlocked := coalesce(v_tier_unlocked, 0);

  select coalesce(jsonb_agg(jsonb_build_object(
    'tier', tier,
    'label', label,
    'threshold', threshold,
    'reward_kind', reward_kind,
    'reward_value_int', reward_value_int,
    'reward_value_text', reward_value_text,
    'unlocked', tier <= v_tier_unlocked
  ) order by tier), '[]'::jsonb) into v_tiers
  from public.shop_crew_rewards
  where shop_id = p_shop_id and active = true;

  return jsonb_build_object(
    'has_crew', true,
    'crew_id', v_crew_id,
    'crew_name', v_crew_name,
    'stamp_count', v_count,
    'tier_unlocked', v_tier_unlocked,
    'tiers', v_tiers
  );
end $$;

grant execute on function public.get_crew_stamp_progress(uuid, uuid) to authenticated, anon;

-- ═══════════════════════════════════════════════════════
-- 6) RPC für Shop-Dashboard: Top-Crews
-- ═══════════════════════════════════════════════════════
create or replace function public.get_top_crews_for_shop(
  p_shop_id uuid,
  p_limit int default 10
) returns table (
  crew_id uuid,
  crew_name text,
  crew_color text,
  stamp_count int,
  tier_unlocked int,
  last_stamp_at timestamptz
) language sql stable as $$
  select
    s.crew_id,
    c.name,
    c.color,
    s.stamp_count,
    s.tier_unlocked,
    s.last_stamp_at
  from public.crew_shop_stamps s
  join public.crews c on c.id = s.crew_id
  where s.shop_id = p_shop_id
    and s.shop_id in (select id from public.local_businesses where owner_id = auth.uid())
  order by s.stamp_count desc
  limit p_limit;
$$;

grant execute on function public.get_top_crews_for_shop(uuid, int) to authenticated;
