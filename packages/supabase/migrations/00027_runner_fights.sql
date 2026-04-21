-- ═══════════════════════════════════════════════════════════════════
-- Runner-Fights (S&F-Style PvP)
-- 10 gratis/Tag, Eskalations-Preis für weitere Versuche.
-- Matchmaking ±3 Level, Loot bei Sieg & Niederlage (fair).
-- ═══════════════════════════════════════════════════════════════════

create table if not exists public.runner_fight_state (
  user_id uuid primary key references public.users(id) on delete cascade,
  day_key date not null default current_date,
  fights_used_today int not null default 0 check (fights_used_today >= 0),
  gems_spent_today int not null default 0 check (gems_spent_today >= 0),
  refresh_used_today int not null default 0,
  last_refresh_at timestamptz,
  cached_opponents jsonb,
  updated_at timestamptz not null default now()
);

create table if not exists public.runner_fights (
  id uuid primary key default gen_random_uuid(),
  attacker_id uuid not null references public.users(id) on delete cascade,
  defender_id uuid not null references public.users(id) on delete cascade,
  attacker_guardian_id uuid not null references public.user_guardians(id) on delete cascade,
  defender_guardian_id uuid not null references public.user_guardians(id) on delete cascade,
  winner_user_id uuid references public.users(id),
  seed text not null,
  rounds jsonb not null,
  xp_awarded int not null default 0,
  loot_rarity text check (loot_rarity is null or loot_rarity in ('none','common','rare','epic','legendary')),
  siegel_type text,
  item_id text,
  user_item_id uuid,
  gems_paid int not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists idx_runner_fights_attacker on public.runner_fights(attacker_id, created_at desc);
create index if not exists idx_runner_fights_defender on public.runner_fights(defender_id, created_at desc);

alter table public.runner_fight_state enable row level security;
alter table public.runner_fights      enable row level security;

do $$ begin
  if not exists (select 1 from pg_policies where tablename='runner_fight_state' and policyname='rfs_self_read') then
    create policy rfs_self_read on public.runner_fight_state for select using (user_id = auth.uid());
  end if;
  if not exists (select 1 from pg_policies where tablename='runner_fights' and policyname='rf_read_involved') then
    create policy rf_read_involved on public.runner_fights for select using (attacker_id = auth.uid() or defender_id = auth.uid());
  end if;
end $$;

-- ─── Reset pro Tag ──────────────────────────────────────────────────
create or replace function public.runner_fight_reset_if_needed(p_user_id uuid)
returns void language plpgsql security definer as $$
begin
  insert into public.runner_fight_state (user_id) values (p_user_id) on conflict (user_id) do nothing;
  update public.runner_fight_state
     set day_key = current_date,
         fights_used_today = 0,
         gems_spent_today = 0,
         refresh_used_today = 0,
         cached_opponents = null,
         updated_at = now()
   where user_id = p_user_id and day_key < current_date;
end $$;

-- ─── Preis für nächsten Fight (Stufen-Eskalation) ───────────────────
create or replace function public.runner_fight_next_gem_cost(p_used int)
returns int language sql immutable as $$
  select case
    when p_used < 10 then 0
    when p_used < 15 then 50
    when p_used < 20 then 100
    when p_used < 25 then 200
    when p_used < 30 then 400
    else -1  -- gesperrt
  end;
$$;

-- ─── Matchmaking: 10 Gegner ±3 Level ────────────────────────────────
-- Gibt cached_opponents zurück falls vorhanden, sonst frisch gezogen.
create or replace function public.runner_fight_get_opponents(p_user_id uuid, p_force_refresh boolean)
returns jsonb language plpgsql security definer as $$
declare
  v_cached jsonb;
  v_refresh_used int;
  v_level int;
  v_faction text;
  v_opponents jsonb;
  v_cost int;
begin
  perform public.runner_fight_reset_if_needed(p_user_id);
  select cached_opponents, refresh_used_today into v_cached, v_refresh_used
    from public.runner_fight_state where user_id = p_user_id;

  if v_cached is not null and not p_force_refresh then
    return jsonb_build_object('ok', true, 'opponents', v_cached, 'from_cache', true);
  end if;

  -- Refresh kostet: 1× gratis/Tag, dann 30 Gems
  if p_force_refresh and v_refresh_used >= 1 then
    v_cost := 30;
    if not exists (select 1 from public.user_gems where user_id = p_user_id and gems >= v_cost) then
      return jsonb_build_object('ok', false, 'error', 'not_enough_gems_for_refresh', 'cost', v_cost);
    end if;
    update public.user_gems set gems = gems - v_cost, total_spent = total_spent + v_cost, updated_at = now() where user_id = p_user_id;
  end if;

  select ug.level into v_level
    from public.user_guardians ug
    where ug.user_id = p_user_id and ug.is_active
    limit 1;
  if v_level is null then
    return jsonb_build_object('ok', false, 'error', 'no_active_guardian');
  end if;

  select u.faction into v_faction from public.users u where u.id = p_user_id;

  -- 10 Gegner: aktive Wächter in ±3 Level, andere User
  select coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) into v_opponents from (
    select ug.id as guardian_id, ug.user_id, ug.archetype_id, ug.level,
           ug.wins, ug.losses, ug.current_hp_pct,
           u.username, u.display_name, u.faction, u.avatar_url,
           ga.name as archetype_name, ga.emoji as archetype_emoji,
           ga.rarity, ga.guardian_type, ga.role
      from public.user_guardians ug
      join public.users u on u.id = ug.user_id
      join public.guardian_archetypes ga on ga.id = ug.archetype_id
     where ug.is_active
       and ug.user_id <> p_user_id
       and ug.level between greatest(1, v_level - 3) and v_level + 3
       and (u.last_seen_at is null or u.last_seen_at > now() - interval '14 days')
     order by random()
     limit 10
  ) t;

  update public.runner_fight_state
     set cached_opponents = v_opponents,
         refresh_used_today = refresh_used_today + (case when p_force_refresh then 1 else 0 end),
         last_refresh_at = now(),
         updated_at = now()
   where user_id = p_user_id;

  return jsonb_build_object('ok', true, 'opponents', v_opponents, 'from_cache', false);
end $$;

-- ─── Fight-Settlement: Ergebnis persistieren + Loot gewähren ──────
-- Battle-Engine läuft in Node — hier nur DB-Effekte nach Sieg/Niederlage.
create or replace function public.runner_fight_settle(
  p_attacker_id uuid,
  p_defender_id uuid,
  p_attacker_guardian_id uuid,
  p_defender_guardian_id uuid,
  p_winner_user_id uuid,
  p_seed text,
  p_rounds jsonb,
  p_gems_paid int
) returns jsonb language plpgsql security definer as $$
declare
  v_won boolean;
  v_level_attacker int;
  v_level_defender int;
  v_level_diff int;
  v_xp int;
  v_rarity text := 'none';
  v_siegel_type text;
  v_item_id text;
  v_user_item_id uuid;
  v_fight_id uuid;
  v_used int;
  v_roll float;
begin
  -- Anti-Abuse: gleicher Verteidiger max 2× pro Tag
  if (select count(*) from public.runner_fights
        where attacker_id = p_attacker_id and defender_id = p_defender_id
          and created_at > current_date) >= 2 then
    return jsonb_build_object('ok', false, 'error', 'defender_cap_reached');
  end if;

  v_won := (p_winner_user_id = p_attacker_id);
  select level into v_level_attacker from public.user_guardians where id = p_attacker_guardian_id;
  select level into v_level_defender from public.user_guardians where id = p_defender_guardian_id;
  v_level_diff := coalesce(v_level_defender, 0) - coalesce(v_level_attacker, 0);

  if v_won then
    -- XP: 80 base + 10 pro Gegner-Level, +50% wenn stärkerer Gegner
    v_xp := 80 + (coalesce(v_level_defender, 1) * 10);
    if v_level_diff > 0 then v_xp := (v_xp * 15) / 10; end if;

    -- Loot-Roll (Sieg)
    v_roll := random();
    if v_level_diff >= 2 and v_roll < 0.10 then
      v_rarity := 'epic';
    elsif v_roll < 0.35 then
      v_rarity := 'rare';
    else
      v_rarity := 'common';
    end if;

    -- Siegel
    insert into public.user_siegel (user_id) values (p_attacker_id) on conflict (user_id) do nothing;
    v_siegel_type := case (floor(random()*5)::int)
      when 0 then 'infantry' when 1 then 'cavalry' when 2 then 'marksman' when 3 then 'mage' else 'universal' end;
    execute format('update public.user_siegel set siegel_%s = siegel_%s + 1, updated_at = now() where user_id = $1', v_siegel_type, v_siegel_type)
      using p_attacker_id;

    -- Item-Drop 15% (rare+)
    if random() < 0.15 then
      select id into v_item_id from public.item_catalog
        where rarity = case v_rarity when 'epic' then 'epic' when 'rare' then 'rare' else 'common' end
        order by random() limit 1;
      if v_item_id is not null then
        insert into public.user_items (user_id, item_id, source)
          values (p_attacker_id, v_item_id, 'runner_fight') returning id into v_user_item_id;
      end if;
    end if;

    update public.user_guardians set wins = wins + 1, xp = xp + v_xp where id = p_attacker_guardian_id;
    update public.user_guardians set losses = losses + 1 where id = p_defender_guardian_id;
  else
    -- Niederlage: Trostpreis
    v_xp := 20;
    v_rarity := 'common';
    insert into public.user_siegel (user_id) values (p_attacker_id) on conflict (user_id) do nothing;
    update public.user_siegel set siegel_universal = siegel_universal + 1, updated_at = now() where user_id = p_attacker_id;
    v_siegel_type := 'universal';

    update public.user_guardians set losses = losses + 1 where id = p_attacker_guardian_id;
    update public.user_guardians set wins = wins + 1, xp = xp + 30 where id = p_defender_guardian_id;
  end if;

  -- Tagesstats inkrementieren
  select fights_used_today into v_used from public.runner_fight_state where user_id = p_attacker_id;
  update public.runner_fight_state
     set fights_used_today = coalesce(v_used, 0) + 1,
         gems_spent_today = gems_spent_today + p_gems_paid,
         updated_at = now()
   where user_id = p_attacker_id;

  -- Gems abziehen
  if p_gems_paid > 0 then
    update public.user_gems set gems = gems - p_gems_paid, total_spent = total_spent + p_gems_paid, updated_at = now()
      where user_id = p_attacker_id;
  end if;

  -- Fight persistieren
  insert into public.runner_fights
    (attacker_id, defender_id, attacker_guardian_id, defender_guardian_id,
     winner_user_id, seed, rounds, xp_awarded, loot_rarity, siegel_type, item_id, user_item_id, gems_paid)
  values
    (p_attacker_id, p_defender_id, p_attacker_guardian_id, p_defender_guardian_id,
     p_winner_user_id, p_seed, p_rounds, v_xp, v_rarity, v_siegel_type, v_item_id, v_user_item_id, p_gems_paid)
  returning id into v_fight_id;

  return jsonb_build_object(
    'ok', true,
    'fight_id', v_fight_id,
    'won', v_won,
    'xp', v_xp,
    'rarity', v_rarity,
    'siegel_type', v_siegel_type,
    'item_id', v_item_id,
    'user_item_id', v_user_item_id
  );
end $$;

grant execute on function public.runner_fight_reset_if_needed(uuid) to authenticated;
grant execute on function public.runner_fight_next_gem_cost(int) to authenticated;
grant execute on function public.runner_fight_get_opponents(uuid, boolean) to authenticated;
grant execute on function public.runner_fight_settle(uuid, uuid, uuid, uuid, uuid, text, jsonb, int) to authenticated;
