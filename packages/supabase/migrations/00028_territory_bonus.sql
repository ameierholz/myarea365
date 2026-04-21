-- ═══════════════════════════════════════════════════════════════════
-- Territory-Bonus: Partner-Upsell-Modul
-- Runner, die ≥N Gebiete rings um den Shop eroberten, erhalten +20% XP
-- und ein Extra-Siegel bei jeder Einlösung in diesem Shop.
-- ═══════════════════════════════════════════════════════════════════

alter table public.local_businesses
  add column if not exists territory_bonus_until timestamptz,
  add column if not exists territory_bonus_radius_m int not null default 500
    check (territory_bonus_radius_m between 200 and 1000),
  add column if not exists territory_bonus_min_claims int not null default 10
    check (territory_bonus_min_claims between 1 and 50);

alter table public.deal_redemptions
  add column if not exists territory_bonus_xp int not null default 0,
  add column if not exists territory_bonus_siegel boolean not null default false;

create index if not exists idx_businesses_territory_bonus
  on public.local_businesses(territory_bonus_until) where territory_bonus_until is not null;

-- ─── Check: Ist User Gebietsfürst für diesen Shop? ──────────────────
create or replace function public.is_territory_lord(p_user_id uuid, p_business_id uuid)
returns boolean language plpgsql stable security definer as $$
declare
  v_until timestamptz;
  v_radius int;
  v_min_claims int;
  v_loc geometry;
  v_count int;
begin
  select territory_bonus_until, territory_bonus_radius_m, territory_bonus_min_claims, location
    into v_until, v_radius, v_min_claims, v_loc
    from public.local_businesses where id = p_business_id;

  if v_until is null or v_until < now() or v_loc is null then
    return false;
  end if;

  select count(distinct ac.area_id) into v_count
    from public.area_claims ac
    join public.areas a on a.id = ac.area_id
   where ac.user_id = p_user_id
     and ac.claimed_at > now() - interval '30 days'
     and ST_DWithin(a.geometry::geography, v_loc::geography, v_radius);

  return v_count >= v_min_claims;
end $$;

-- ─── Bonus granten (wird nach redeem_deal/verify aufgerufen) ────────
create or replace function public.grant_territory_lord_bonus(p_user_id uuid, p_business_id uuid, p_redemption_id uuid default null)
returns jsonb language plpgsql security definer as $$
declare
  v_lord boolean;
  v_xp_bonus int := 0;
begin
  select public.is_territory_lord(p_user_id, p_business_id) into v_lord;
  if not v_lord then
    return jsonb_build_object('territory_lord', false);
  end if;

  -- +X XP auf aktiven Wächter (skaliert mit Wächter-Level, min 50)
  select greatest(50, ug.level * 15) into v_xp_bonus
    from public.user_guardians ug
   where ug.user_id = p_user_id and ug.is_active limit 1;

  if v_xp_bonus > 0 then
    update public.user_guardians set xp = xp + v_xp_bonus
      where user_id = p_user_id and is_active;
  end if;

  -- Extra-Siegel (Universal-Common)
  insert into public.user_siegel (user_id) values (p_user_id) on conflict (user_id) do nothing;
  update public.user_siegel
     set siegel_universal = siegel_universal + 1, updated_at = now()
   where user_id = p_user_id;

  -- An Redemption koppeln (damit Runner-Polling das Bonus sieht)
  if p_redemption_id is not null then
    update public.deal_redemptions
       set territory_bonus_xp = v_xp_bonus,
           territory_bonus_siegel = true
     where id = p_redemption_id;
  end if;

  return jsonb_build_object(
    'territory_lord', true,
    'bonus_xp', v_xp_bonus,
    'bonus_siegel', 'universal'
  );
end $$;

grant execute on function public.is_territory_lord(uuid, uuid) to authenticated, anon;
grant execute on function public.grant_territory_lord_bonus(uuid, uuid, uuid) to authenticated;

-- ─── Shop-Feature aktivieren (Partner ruft auf, zahlt per Stripe/Gems) ──
create or replace function public.activate_territory_bonus(
  p_business_id uuid,
  p_days int,
  p_radius_m int,
  p_min_claims int
) returns jsonb language plpgsql security definer as $$
declare
  v_owner uuid;
  v_current timestamptz;
  v_new_until timestamptz;
begin
  select owner_id, territory_bonus_until into v_owner, v_current
    from public.local_businesses where id = p_business_id;
  if v_owner is null or v_owner <> auth.uid() then
    return jsonb_build_object('ok', false, 'error', 'not_owner');
  end if;
  if p_days < 1 or p_days > 365 then
    return jsonb_build_object('ok', false, 'error', 'invalid_days');
  end if;

  v_new_until := greatest(coalesce(v_current, now()), now()) + (p_days || ' days')::interval;

  update public.local_businesses
     set territory_bonus_until = v_new_until,
         territory_bonus_radius_m = coalesce(p_radius_m, territory_bonus_radius_m),
         territory_bonus_min_claims = coalesce(p_min_claims, territory_bonus_min_claims)
   where id = p_business_id;

  return jsonb_build_object('ok', true, 'active_until', v_new_until);
end $$;

grant execute on function public.activate_territory_bonus(uuid, int, int, int) to authenticated;
