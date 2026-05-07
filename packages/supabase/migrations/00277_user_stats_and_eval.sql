-- ════════════════════════════════════════════════════════════════════════
-- USER-STATS-INFRASTRUKTUR
-- Eine zentrale Counter-Tabelle für alle Spielwerte. Speist gleichzeitig
-- die Statistik-Screens UND die Achievement-Engine.
-- ════════════════════════════════════════════════════════════════════════

create table if not exists public.user_stats (
  user_id uuid primary key references public.users(id) on delete cascade,

  -- Bewegung / Märsche
  total_marches              bigint not null default 0,
  marches_completed          bigint not null default 0,
  total_meters_walked        bigint not null default 0,
  night_owl_marches          bigint not null default 0,

  -- Truhen & Loot
  chests_opened              bigint not null default 0,
  chests_legendary_opened    bigint not null default 0,
  chests_mythic_opened       bigint not null default 0,
  loot_drops_collected       bigint not null default 0,

  -- Combat allgemein
  bandit_kills               bigint not null default 0,
  pvp_wins                   bigint not null default 0,
  pvp_losses                 bigint not null default 0,
  units_killed               bigint not null default 0,
  units_lost                 bigint not null default 0,
  units_healed               bigint not null default 0,

  -- CvC
  cvc_participated           bigint not null default 0,
  cvc_won                    bigint not null default 0,
  cvc_kills                  bigint not null default 0,
  cvc_mvp_count              bigint not null default 0,
  cvc_champion_count         bigint not null default 0,
  vertrauen_peak             bigint not null default 0,

  -- Crew
  crew_donations             bigint not null default 0,
  crew_chat_messages         bigint not null default 0,
  crew_member_days           bigint not null default 0,
  rallys_attended            bigint not null default 0,
  rallys_led                 bigint not null default 0,
  walls_destroyed            bigint not null default 0,
  wegelager_won              bigint not null default 0,
  crew_top1_eras             bigint not null default 0,
  crew_top1_lifetime_days    bigint not null default 0,

  -- Social
  friends_count              bigint not null default 0,
  dms_sent                   bigint not null default 0,
  emoji_reactions_used       bigint not null default 0,
  distinct_emojis_used       bigint not null default 0,
  invitations_sent           bigint not null default 0,
  profile_views_other        bigint not null default 0,

  -- Begleiter
  guardians_unlocked         bigint not null default 0,
  guardian_max_level         bigint not null default 0,
  awakenings_done            bigint not null default 0,
  thief_classes_unlocked     bigint not null default 0,

  -- Ressourcen (Total Lifetime)
  holz_total_collected       bigint not null default 0,
  stein_total_collected      bigint not null default 0,
  mana_total_collected       bigint not null default 0,
  gold_total_collected       bigint not null default 0,
  gold_peak                  bigint not null default 0,
  all_resources_min          bigint not null default 0,

  -- Bauen / Forschen
  buildings_upgraded         bigint not null default 0,
  building_max_level         bigint not null default 0,
  buildings_at_lv10          bigint not null default 0,
  buildings_at_lv20          bigint not null default 0,
  base_level                 bigint not null default 1,
  researches_completed       bigint not null default 0,
  research_tree_complete     bigint not null default 0,

  -- Items / Crafting
  items_crafted              bigint not null default 0,
  items_legendary_owned      bigint not null default 0,
  items_mythic_owned         bigint not null default 0,
  item_sets_completed        bigint not null default 0,
  inventory_full_count       bigint not null default 0,

  -- Cosmetics
  cosmetics_owned            bigint not null default 0,
  markers_unlocked           bigint not null default 0,
  rings_unlocked             bigint not null default 0,
  avatar_changes             bigint not null default 0,
  artwork_collections_full   bigint not null default 0,

  -- Map / Exploration
  districts_visited          bigint not null default 0,
  streets_walked             bigint not null default 0,
  screenshots_taken          bigint not null default 0,

  -- Login / Streaks
  login_streak_current       bigint not null default 0,
  login_streak_max           bigint not null default 0,
  total_login_days           bigint not null default 0,
  account_age_days           bigint not null default 0,
  last_login_date            date,

  -- Quests
  daily_quests_done          bigint not null default 0,
  weekly_quests_done         bigint not null default 0,

  -- Ära
  eras_played                bigint not null default 0,
  era_top10_count            bigint not null default 0,
  era_top3_count             bigint not null default 0,
  era_won_solo_count         bigint not null default 0,
  era_score_max              bigint not null default 0,

  -- Shop / Gems
  gems_received              bigint not null default 0,
  gems_spent                 bigint not null default 0,
  shop_visits                bigint not null default 0,

  -- Trophy-Meta (recursive)
  achievements_unlocked      bigint not null default 0,
  achievements_bronze        bigint not null default 0,
  achievements_silver        bigint not null default 0,
  achievements_gold          bigint not null default 0,

  -- Onboarding-Flags (0/1)
  tutorial_done              bigint not null default 0,
  lang_set                   bigint not null default 0,
  faction_picked             bigint not null default 0,
  push_enabled               bigint not null default 0,
  first_open                 bigint not null default 0,
  first_settings             bigint not null default 0,
  first_help                 bigint not null default 0,
  first_screenshot           bigint not null default 0,
  shop_visited               bigint not null default 0,
  research_screen_seen       bigint not null default 0,
  aufgebot_screen_seen       bigint not null default 0,
  city_first_view            bigint not null default 0,
  district_first             bigint not null default 0,
  marker_first               bigint not null default 0,
  ring_first                 bigint not null default 0,
  daily_login_first          bigint not null default 0,
  first_streak_break         bigint not null default 0,
  guardian_named             bigint not null default 0,
  guardian_pet               bigint not null default 0,
  first_dm                   bigint not null default 0,
  first_invite               bigint not null default 0,
  first_gem                  bigint not null default 0,
  first_loot_drop            bigint not null default 0,
  first_pvp_seen             bigint not null default 0,
  first_dodge                bigint not null default 0,
  first_chat_msg             bigint not null default 0,
  first_inbox                bigint not null default 0,
  first_market               bigint not null default 0,
  first_potion               bigint not null default 0,
  first_quest                bigint not null default 0,
  first_artwork_seen         bigint not null default 0,
  first_friend               bigint not null default 0,
  first_chest                bigint not null default 0,
  first_chest_mythic         bigint not null default 0,
  secret_codenames_found     bigint not null default 0,

  updated_at                 timestamptz not null default now()
);

create index if not exists user_stats_updated_idx on public.user_stats(updated_at);

alter table public.user_stats enable row level security;

drop policy if exists "users see own stats" on public.user_stats;
create policy "users see own stats" on public.user_stats for select using (auth.uid() = user_id);

drop policy if exists "users update own stats" on public.user_stats;
create policy "users update own stats" on public.user_stats for update
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "users insert own stats" on public.user_stats;
create policy "users insert own stats" on public.user_stats for insert with check (auth.uid() = user_id);

comment on table public.user_stats is
  'Zentrale Counter-Tabelle: alle Lifetime-Stats des Users. Speist Stats-Screen und Achievement-Engine.';

-- ════════════════════════════════════════════════════════════════════════
-- COUNTER-INKREMENT (whitelist-validiert) + Achievement-Evaluator
-- ════════════════════════════════════════════════════════════════════════

create or replace function public.stat_increment(
  p_user uuid,
  p_stat text,
  p_delta bigint default 1
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_allowed boolean;
begin
  select exists(
    select 1 from information_schema.columns
    where table_schema='public' and table_name='user_stats' and column_name=p_stat
  ) into v_allowed;
  if not v_allowed then
    raise exception 'stat_increment: unknown stat %', p_stat;
  end if;

  insert into public.user_stats(user_id) values (p_user) on conflict (user_id) do nothing;

  execute format(
    'update public.user_stats set %I = coalesce(%I, 0) + $1, updated_at = now() where user_id = $2',
    p_stat, p_stat
  ) using p_delta, p_user;

  perform public.evaluate_achievements(p_user);
end;
$$;

grant execute on function public.stat_increment(uuid, text, bigint) to authenticated;

create or replace function public.stat_set_max(
  p_user uuid,
  p_stat text,
  p_value bigint
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_allowed boolean;
begin
  select exists(
    select 1 from information_schema.columns
    where table_schema='public' and table_name='user_stats' and column_name=p_stat
  ) into v_allowed;
  if not v_allowed then
    raise exception 'stat_set_max: unknown stat %', p_stat;
  end if;

  insert into public.user_stats(user_id) values (p_user) on conflict (user_id) do nothing;

  execute format(
    'update public.user_stats set %I = greatest(coalesce(%I, 0), $1), updated_at = now() where user_id = $2',
    p_stat, p_stat
  ) using p_value, p_user;

  perform public.evaluate_achievements(p_user);
end;
$$;

grant execute on function public.stat_set_max(uuid, text, bigint) to authenticated;

create or replace function public.evaluate_achievements(p_user uuid)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_unlocked int := 0;
  r record;
  v_value bigint;
  v_threshold bigint;
  v_stat text;
  v_tier_filter text;
  v_tier_count bigint;
  v_total_for_tier bigint;
begin
  for r in
    select a.id, a.slug, a.condition, a.tier
    from public.achievements a
    where coalesce(a.condition->>'type', '') <> ''
      and not exists (
        select 1 from public.user_achievements ua
        where ua.user_id = p_user and ua.achievement_id = a.id
      )
  loop
    v_value := 0;
    v_threshold := coalesce((r.condition->>'value')::bigint, 0);

    if r.condition->>'type' = 'stat_gte' then
      v_stat := r.condition->>'stat';
      execute format('select coalesce(%I, 0) from public.user_stats where user_id = $1', v_stat)
        into v_value using p_user;
      if coalesce(v_value, 0) >= v_threshold then
        insert into public.user_achievements(user_id, achievement_id)
          values (p_user, r.id) on conflict do nothing;
        v_unlocked := v_unlocked + 1;
      end if;

    elsif r.condition->>'type' = 'tier_complete' then
      v_tier_filter := r.condition->>'tier';
      select count(*) into v_total_for_tier from public.achievements
        where tier = v_tier_filter::public.achievement_tier and slug <> r.slug;
      select count(*) into v_tier_count
        from public.user_achievements ua
        join public.achievements a on a.id = ua.achievement_id
        where ua.user_id = p_user and a.tier = v_tier_filter::public.achievement_tier and a.slug <> r.slug;
      if v_tier_count >= v_total_for_tier and v_total_for_tier > 0 then
        insert into public.user_achievements(user_id, achievement_id)
          values (p_user, r.id) on conflict do nothing;
        v_unlocked := v_unlocked + 1;
      end if;

    elsif r.condition->>'type' = 'all_complete' then
      select count(*) into v_total_for_tier from public.achievements where slug <> r.slug;
      select count(*) into v_tier_count
        from public.user_achievements ua
        join public.achievements a on a.id = ua.achievement_id
        where ua.user_id = p_user and a.slug <> r.slug;
      if v_tier_count >= v_total_for_tier and v_total_for_tier > 0 then
        insert into public.user_achievements(user_id, achievement_id)
          values (p_user, r.id) on conflict do nothing;
        v_unlocked := v_unlocked + 1;
      end if;
    end if;
  end loop;

  return v_unlocked;
end;
$$;

grant execute on function public.evaluate_achievements(uuid) to authenticated;

-- ════════════════════════════════════════════════════════════════════════
-- Trigger: bei jedem user_achievements-Insert achievements_*-Counter pflegen
-- + Re-Evaluation für Meta-Achievements (achievements_25 etc.)
-- ════════════════════════════════════════════════════════════════════════

create or replace function public.user_achievements_update_counters()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tier text;
begin
  insert into public.user_stats(user_id) values (new.user_id) on conflict (user_id) do nothing;

  select tier::text into v_tier from public.achievements where id = new.achievement_id;

  update public.user_stats
     set achievements_unlocked = coalesce(achievements_unlocked, 0) + 1,
         achievements_bronze   = case when v_tier = 'bronze' then coalesce(achievements_bronze, 0) + 1 else achievements_bronze end,
         achievements_silver   = case when v_tier = 'silver' then coalesce(achievements_silver, 0) + 1 else achievements_silver end,
         achievements_gold     = case when v_tier = 'gold'   then coalesce(achievements_gold, 0) + 1   else achievements_gold end,
         updated_at = now()
   where user_id = new.user_id;

  perform public.evaluate_achievements(new.user_id);
  return new;
end;
$$;

drop trigger if exists user_achievements_update_counters on public.user_achievements;
create trigger user_achievements_update_counters
after insert on public.user_achievements
for each row execute function public.user_achievements_update_counters();

-- HINWEIS: Backfill der condition-jsonb für ~150 bestehende Achievements
-- ist in der DB ausgeführt (Pattern-basierte UPDATE-Statements). Da diese
-- statisch in einer eigenen DO-Block-Wand wären, lasse ich sie hier
-- bewusst raus — das File dient als Doku, der DB-Zustand ist via MCP
-- bereits aktuell.

