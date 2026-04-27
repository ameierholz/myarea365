-- ════════════════════════════════════════════════════════════════════
-- WALK-DETAILS — Adressen, Tokens, XP-Boni, Achievements, Chests
-- ════════════════════════════════════════════════════════════════════
-- Bislang zeigte die "Letzte Läufe"-Card nur XP-Math + Distanz.
-- Diese Migration ergänzt den Walk um:
--   - start_address / end_address (per Reverse-Geocode beim Walk-Record)
--   - tokens_dropped (war bereits in user_resources, jetzt auch am Walk)
--   - xp_bonuses jsonb (Liste pro Bonus: VIP / Streak / Happy-Hour / Crew / etc.)
--   - achievements_unlocked jsonb (während dieses Laufs freigeschaltet)
--   - chests_collected jsonb (Truhen die WÄHREND des Laufs gesammelt wurden)
-- + RPC get_recent_walks_with_summary für die enriched Liste.
-- ════════════════════════════════════════════════════════════════════

alter table public.walks
  add column if not exists start_address          text,
  add column if not exists end_address            text,
  add column if not exists tokens_dropped         int  not null default 0,
  add column if not exists xp_bonuses             jsonb not null default '[]'::jsonb,
  add column if not exists achievements_unlocked  jsonb not null default '[]'::jsonb,
  add column if not exists chests_collected       jsonb not null default '[]'::jsonb;

-- ─── record_walk_resources erweitern ──────────────────────────────────
create or replace function public.record_walk_resources(p_walk_id uuid)
returns jsonb language plpgsql security definer as $$
declare
  v_walk record;
  v_user uuid := auth.uid();
  v_wood int; v_stone int; v_gold int; v_mana int; v_tokens int;
  v_vip_bonus numeric := 0;
  v_total_km numeric;
  v_bonuses jsonb := '[]'::jsonb;
  v_vip_extra_xp int;
begin
  if v_user is null then raise exception 'not_authenticated'; end if;
  select * into v_walk from public.walks where id = p_walk_id and user_id = v_user;
  if v_walk is null then return jsonb_build_object('ok', false, 'error', 'walk_not_found'); end if;
  if v_walk.drop_processed then return jsonb_build_object('ok', false, 'error', 'already_processed'); end if;

  select coalesce(t.resource_bonus_pct, 0) into v_vip_bonus
    from public.vip_progress p
    left join public.vip_tier_thresholds t on t.vip_level = p.vip_level
   where p.user_id = v_user;

  v_wood  := round(v_walk.km_in_park        * 100 * (1 + v_vip_bonus));
  v_stone := round(v_walk.km_in_residential * 100 * (1 + v_vip_bonus));
  v_gold  := round(v_walk.km_in_commercial  * 100 * (1 + v_vip_bonus));
  v_mana  := round(v_walk.km_near_water     * 100 * (1 + v_vip_bonus));

  v_total_km := coalesce(v_walk.distance_m, 0) / 1000.0;
  v_tokens := floor(v_total_km)::int;

  -- VIP-Bonus als Bonus-Eintrag protokollieren
  if v_vip_bonus > 0 then
    v_vip_extra_xp := round((v_wood + v_stone + v_gold + v_mana) * v_vip_bonus / (1 + v_vip_bonus))::int;
    v_bonuses := v_bonuses || jsonb_build_object(
      'kind', 'vip_resource_bonus',
      'label', 'VIP-Bonus auf Ressourcen',
      'pct', round(v_vip_bonus * 100, 1),
      'extra_amount', v_vip_extra_xp,
      'unit', 'rss'
    );
  end if;

  insert into public.user_resources (user_id, wood, stone, gold, mana, speed_tokens)
  values (v_user, v_wood, v_stone, v_gold, v_mana, v_tokens)
  on conflict (user_id) do update set
    wood         = public.user_resources.wood + excluded.wood,
    stone        = public.user_resources.stone + excluded.stone,
    gold         = public.user_resources.gold + excluded.gold,
    mana         = public.user_resources.mana + excluded.mana,
    speed_tokens = public.user_resources.speed_tokens + excluded.speed_tokens,
    updated_at   = now();

  update public.walks set
    wood_dropped   = v_wood,
    stone_dropped  = v_stone,
    gold_dropped   = v_gold,
    mana_dropped   = v_mana,
    tokens_dropped = v_tokens,
    xp_bonuses     = coalesce(xp_bonuses, '[]'::jsonb) || v_bonuses,
    drop_processed = true
  where id = p_walk_id;

  return jsonb_build_object('ok', true,
    'wood', v_wood, 'stone', v_stone, 'gold', v_gold, 'mana', v_mana,
    'tokens', v_tokens, 'bonuses', v_bonuses);
end $$;

revoke all on function public.record_walk_resources(uuid) from public;
grant execute on function public.record_walk_resources(uuid) to authenticated;

-- ─── log_walk_event(p_walk_id, p_kind, p_payload) ─────────────────────
-- Kompakte Helper-Funktion um Live-Events am Walk zu protokollieren.
-- kind ∈ 'achievement_unlocked', 'chest_collected', 'bonus'
create or replace function public.log_walk_event(
  p_walk_id uuid,
  p_kind    text,
  p_payload jsonb
) returns void language plpgsql security definer as $$
declare v_user uuid := auth.uid();
begin
  if v_user is null then raise exception 'not_authenticated'; end if;
  if not exists (select 1 from public.walks where id = p_walk_id and user_id = v_user) then
    raise exception 'walk_not_found_or_not_owner';
  end if;

  if p_kind = 'achievement_unlocked' then
    update public.walks
       set achievements_unlocked = coalesce(achievements_unlocked, '[]'::jsonb) || p_payload
     where id = p_walk_id;
  elsif p_kind = 'chest_collected' then
    update public.walks
       set chests_collected = coalesce(chests_collected, '[]'::jsonb) || p_payload
     where id = p_walk_id;
  elsif p_kind = 'bonus' then
    update public.walks
       set xp_bonuses = coalesce(xp_bonuses, '[]'::jsonb) || p_payload
     where id = p_walk_id;
  else
    raise exception 'unknown_kind:%', p_kind;
  end if;
end $$;
revoke all on function public.log_walk_event(uuid, text, jsonb) from public;
grant execute on function public.log_walk_event(uuid, text, jsonb) to authenticated;

-- ─── get_walk_endpoints(walk_id) → { start: [lng,lat], end: [lng,lat] } ──
create or replace function public.get_walk_endpoints(p_walk_id uuid)
returns jsonb language plpgsql security definer as $$
declare
  v_user uuid := auth.uid();
  v_start jsonb; v_end jsonb;
begin
  if v_user is null then return jsonb_build_object('ok', false, 'error', 'not_authenticated'); end if;
  select
    case when route is not null
      then jsonb_build_array(ST_X(ST_StartPoint(route::geometry)), ST_Y(ST_StartPoint(route::geometry)))
      else null end,
    case when route is not null
      then jsonb_build_array(ST_X(ST_EndPoint(route::geometry)), ST_Y(ST_EndPoint(route::geometry)))
      else null end
   into v_start, v_end
   from public.walks
  where id = p_walk_id and user_id = v_user;
  if v_start is null then return jsonb_build_object('ok', false, 'error', 'no_route'); end if;
  return jsonb_build_object('ok', true, 'start', v_start, 'end', v_end);
end $$;
revoke all on function public.get_walk_endpoints(uuid) from public;
grant execute on function public.get_walk_endpoints(uuid) to authenticated;

-- ─── set_walk_addresses(walk_id, start, end) ──────────────────────────
create or replace function public.set_walk_addresses(
  p_walk_id uuid, p_start text, p_end text
) returns void language plpgsql security definer as $$
declare v_user uuid := auth.uid();
begin
  if v_user is null then raise exception 'not_authenticated'; end if;
  update public.walks
     set start_address = coalesce(start_address, p_start),
         end_address   = coalesce(end_address,   p_end)
   where id = p_walk_id and user_id = v_user;
end $$;
revoke all on function public.set_walk_addresses(uuid, text, text) from public;
grant execute on function public.set_walk_addresses(uuid, text, text) to authenticated;

-- ─── get_recent_walks_with_summary(p_limit) ────────────────────────────
-- Liefert die letzten N Walks des aktuellen Users — joined mit dem
-- nächstgelegenen Territory-Eintrag (per Timestamp + user_id), damit
-- segments_claimed/streets_claimed/polygons_claimed/xp_earned/street_name
-- aus dem Territory-System mitkommen.
create or replace function public.get_recent_walks_with_summary(p_limit int default 5)
returns jsonb language plpgsql security definer as $$
declare
  v_user uuid := auth.uid();
  v_rows jsonb;
begin
  if v_user is null then return '[]'::jsonb; end if;

  select coalesce(jsonb_agg(row_to_json(r) order by r.created_at desc), '[]'::jsonb)
    into v_rows
    from (
      select w.id,
             w.user_id,
             w.distance_m,
             w.duration_s,
             w.created_at,
             w.start_address,
             w.end_address,
             w.wood_dropped,
             w.stone_dropped,
             w.gold_dropped,
             w.mana_dropped,
             w.tokens_dropped,
             w.xp_bonuses,
             w.achievements_unlocked,
             w.chests_collected,
             w.drop_processed,
             coalesce(t.street_name, w.start_address, 'Unbekannter Weg') as street_name,
             coalesce(t.xp_earned, 0)         as xp_earned,
             coalesce(t.segments_claimed, 0)  as segments_claimed,
             coalesce(t.streets_claimed, 0)   as streets_claimed,
             coalesce(t.polygons_claimed, 0)  as polygons_claimed
        from public.walks w
        left join lateral (
          select t1.street_name, t1.xp_earned,
                 t1.segments_claimed, t1.streets_claimed, t1.polygons_claimed
            from public.territories t1
           where t1.user_id = w.user_id
             and abs(extract(epoch from (t1.created_at - w.created_at))) < 300
           order by abs(extract(epoch from (t1.created_at - w.created_at)))
           limit 1
        ) t on true
       where w.user_id = v_user
       order by w.created_at desc
       limit greatest(1, least(50, p_limit))
    ) r;

  return v_rows;
end $$;
revoke all on function public.get_recent_walks_with_summary(int) from public;
grant execute on function public.get_recent_walks_with_summary(int) to authenticated;
