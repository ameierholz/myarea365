-- Vervollständigt das Achievement-Mapping: keine offenen condition='{}'-Slugs mehr.
-- Erweitert evaluate_achievements um zwei neue Typen:
--   - multi_stat_min     : alle aufgelisteten stats müssen >= value sein
--   - entity_collect_all : stat >= count(*) aus einer Quelltabelle (dynamisch, robust gegen neue Entities)
-- Plus Sanity-Check + BEFORE-INSERT-Trigger der zukünftige Seeds ohne condition blockt.

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
  v_stats_list text[];
  v_min bigint;
  v_per_value bigint;
  v_source_table text;
  v_count bigint;
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

    elsif r.condition->>'type' = 'multi_stat_min' then
      v_stats_list := array(select jsonb_array_elements_text(r.condition->'stats'));
      v_min := 9223372036854775807;
      v_per_value := 0;
      foreach v_stat in array v_stats_list loop
        execute format('select coalesce(%I, 0) from public.user_stats where user_id = $1', v_stat)
          into v_per_value using p_user;
        if coalesce(v_per_value, 0) < v_min then v_min := coalesce(v_per_value, 0); end if;
      end loop;
      if v_min >= v_threshold then
        insert into public.user_achievements(user_id, achievement_id)
          values (p_user, r.id) on conflict do nothing;
        v_unlocked := v_unlocked + 1;
      end if;

    elsif r.condition->>'type' = 'entity_collect_all' then
      v_stat := r.condition->>'stat';
      v_source_table := r.condition->>'source_table';
      execute format('select count(*)::bigint from public.%I', v_source_table) into v_count;
      execute format('select coalesce(%I, 0) from public.user_stats where user_id = $1', v_stat)
        into v_value using p_user;
      if coalesce(v_value, 0) >= v_count and v_count > 0 then
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

-- Mappings für die zuvor offenen Slugs

update public.achievements set condition = jsonb_build_object(
  'type','multi_stat_min',
  'stats', jsonb_build_array('holz_total_collected','stein_total_collected','mana_total_collected','gold_total_collected'),
  'value', 5000
) where slug = 'all_res_5k';

update public.achievements set condition = jsonb_build_object(
  'type','multi_stat_min',
  'stats', jsonb_build_array('holz_total_collected','stein_total_collected','mana_total_collected','gold_total_collected'),
  'value', 100000
) where slug = 'all_res_100k';

update public.achievements set condition = jsonb_build_object(
  'type','entity_collect_all',
  'stat','guardians_unlocked',
  'source_table','guardian_archetypes'
) where slug in ('all_guardians','guardian_collect_all');

alter table public.user_stats
  add column if not exists guardians_maxed_count bigint not null default 0;

update public.achievements set condition = jsonb_build_object(
  'type','stat_gte','stat','guardians_maxed_count','value',1
) where slug = 'guardian_max';

-- Sanity-Funktion + BEFORE-INSERT/UPDATE-Trigger gegen zukünftige Lücken

create or replace function public.unmapped_achievements()
returns table (slug text, name text, tier public.achievement_tier, description text)
language sql stable security invoker set search_path = public
as $$
  select slug, name, tier, description
    from public.achievements
   where coalesce(condition->>'type', '') = ''
   order by tier, slug;
$$;

grant execute on function public.unmapped_achievements() to authenticated;

create or replace function public.achievements_require_condition()
returns trigger
language plpgsql
as $$
begin
  if coalesce(new.condition->>'type', '') = '' then
    raise exception
      'Achievement %: condition fehlt (type-Feld leer). Beispiele: stat_gte / multi_stat_min / entity_collect_all / tier_complete / all_complete',
      new.slug;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_achievements_require_condition on public.achievements;
create trigger trg_achievements_require_condition
before insert or update on public.achievements
for each row execute function public.achievements_require_condition();
