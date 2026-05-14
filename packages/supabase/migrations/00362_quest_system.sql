-- ══════════════════════════════════════════════════════════════════════════
-- 00362_quest_system.sql — Konsolidiertes Quest-System (RoK/CoD-Style)
--
-- Eine einzige `quests`-Tabelle für alle Quest-Arten:
--   • main      → Hauptquest-Kette (Story, mit prereq_quest_code-Kette)
--   • side      → Nebenquests (Pool, immer sichtbar bis claimed)
--   • daily     → Tages-Quests (Reset 00:00 Europe/Berlin)
--   • weekly    → Wochen-Quests (Reset Mo 00:00 Europe/Berlin)
--   • seasonal  → Saison-Quests (gekoppelt an public.seasons)
--
-- Rewards als JSONB-Array — flexibel für gems/wood/stone/gold/mana/
-- speed_token/xp/item:
--   [{"kind":"gems","amount":50},{"kind":"wood","amount":1000},
--    {"kind":"item","code":"elixir_5k","amount":2}]
--
-- Altes `missions` + `user_missions` bleibt im Schema stehen, wird aber
-- nicht mehr gelesen (Archivierung). Sobald keine API mehr Mission-Tabellen
-- liest, kann in einem späteren Cleanup-Step der Drop erfolgen.
-- ══════════════════════════════════════════════════════════════════════════

-- ─── 1) Pool-Tabelle ─────────────────────────────────────────────────────
create table if not exists public.quests (
  id              uuid primary key default gen_random_uuid(),
  code            text unique not null,
  kind            text not null check (kind in ('main','side','daily','weekly','seasonal')),
  chapter         int  not null default 1,        -- Hauptquest-Kapitel (1,2,3…)
  sort_order      int  not null default 100,
  name            text not null,
  description     text not null,
  icon            text not null default '🎯',
  target_metric   text not null,                  -- z.B. 'segments_total','crew_help','base_level','login_days'
  target_value    int  not null default 1,
  prereq_quest_code text,                         -- ref code, nicht id (vereinfacht Seeds)
  goto_route      text,                           -- "/karte", "/saga", "/profile" — für "GEHE ZU"-Button
  rewards         jsonb not null default '[]'::jsonb,
  active          boolean not null default true,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists idx_quests_kind_active on public.quests(kind, active);
create index if not exists idx_quests_chapter_sort on public.quests(chapter, sort_order);
create index if not exists idx_quests_metric on public.quests(target_metric) where active = true;

-- ─── 2) Progress-Tabelle ─────────────────────────────────────────────────
-- period_key:
--   daily    → 'YYYY-MM-DD' (Europe/Berlin)
--   weekly   → 'YYYY-MM-DD' des Wochen-Montags
--   seasonal → 's<season_id>'
--   main/side → '' (leer = einmalig)
create table if not exists public.user_quests (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references public.users(id) on delete cascade,
  quest_id      uuid not null references public.quests(id) on delete cascade,
  period_key    text not null default '',
  progress      numeric not null default 0,
  completed_at  timestamptz,
  claimed_at    timestamptz,
  created_at    timestamptz not null default now(),
  unique(user_id, quest_id, period_key)
);

create index if not exists idx_user_quests_user_kind on public.user_quests(user_id);
create index if not exists idx_user_quests_unclaimed on public.user_quests(user_id) where claimed_at is null;

-- ─── 3) RLS ──────────────────────────────────────────────────────────────
alter table public.quests       enable row level security;
alter table public.user_quests  enable row level security;

drop policy if exists quests_read_active on public.quests;
create policy quests_read_active on public.quests for select using (active = true);

drop policy if exists user_quests_read_own on public.user_quests;
create policy user_quests_read_own on public.user_quests for select using (auth.uid() = user_id);

-- ─── 4) Helper: aktuellen period_key für eine Quest-Art berechnen ────────
create or replace function public.quest_period_key(p_kind text)
returns text language sql immutable as $$
  select case
    when p_kind = 'daily'    then to_char((now() at time zone 'Europe/Berlin')::date, 'YYYY-MM-DD')
    when p_kind = 'weekly'   then to_char(
      ((now() at time zone 'Europe/Berlin')::date
        - extract(dow from (now() at time zone 'Europe/Berlin')::date)::int + 1
      ), 'YYYY-MM-DD')
    when p_kind = 'seasonal' then 's' || coalesce((
      select id::text from public.seasons
       where now() between starts_at and ends_at
       order by starts_at desc limit 1
    ), '0')
    else ''
  end;
$$;

-- ─── 5) ensure_user_quests: legt fehlende user_quests-Rows an ────────────
-- Wird vor jedem get_user_quests aufgerufen, damit Daily/Weekly-Slots für
-- die aktuelle Periode existieren und Main/Side-Pool initial befüllt wird.
create or replace function public.ensure_user_quests(p_user_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  q record;
  v_key text;
begin
  if p_user_id is null then return; end if;

  for q in
    select id, kind from public.quests where active = true
  loop
    v_key := public.quest_period_key(q.kind);
    insert into public.user_quests (user_id, quest_id, period_key)
    values (p_user_id, q.id, v_key)
    on conflict (user_id, quest_id, period_key) do nothing;
  end loop;
end $$;

grant execute on function public.ensure_user_quests(uuid) to authenticated, service_role;

-- ─── 6) get_user_quests: aggregierter Snapshot ───────────────────────────
-- Liefert {ok, by_kind:{main:[...],side:[...],daily:[...],weekly:[...],
-- seasonal:[...]}, summary:{claimable, in_progress}}
-- Hauptquests: nur sichtbar, wenn prereq_quest_code null oder prereq geclaimt
create or replace function public.get_user_quests()
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_result jsonb;
  v_claimable int := 0;
  v_in_progress int := 0;
begin
  if v_uid is null then
    return jsonb_build_object('ok', false, 'error', 'not_authenticated');
  end if;

  perform public.ensure_user_quests(v_uid);

  with claimed_codes as (
    select q.code
      from public.user_quests uq
      join public.quests q on q.id = uq.quest_id
     where uq.user_id = v_uid and uq.claimed_at is not null
  ),
  rows as (
    select
      q.id, q.code, q.kind, q.chapter, q.sort_order, q.name, q.description, q.icon,
      q.target_metric, q.target_value, q.goto_route, q.rewards,
      q.prereq_quest_code,
      uq.progress, uq.completed_at, uq.claimed_at, uq.period_key
    from public.quests q
    join public.user_quests uq
      on uq.quest_id = q.id
     and uq.user_id  = v_uid
     and uq.period_key = public.quest_period_key(q.kind)
    where q.active = true
      and (
        q.kind <> 'main'
        or q.prereq_quest_code is null
        or q.prereq_quest_code in (select code from claimed_codes)
      )
  ),
  agg as (
    select kind, jsonb_agg(jsonb_build_object(
      'id', id, 'code', code, 'chapter', chapter, 'sort_order', sort_order,
      'name', name, 'description', description, 'icon', icon,
      'target_metric', target_metric, 'target_value', target_value,
      'goto_route', goto_route, 'rewards', rewards,
      'progress', progress, 'completed_at', completed_at, 'claimed_at', claimed_at,
      'period_key', period_key
    ) order by chapter, sort_order, name) as items
    from rows
    group by kind
  )
  select jsonb_object_agg(kind, items) into v_result from agg;

  select
    count(*) filter (where uq.completed_at is not null and uq.claimed_at is null),
    count(*) filter (where uq.completed_at is null and uq.progress > 0)
    into v_claimable, v_in_progress
  from public.user_quests uq
  join public.quests q on q.id = uq.quest_id
  where uq.user_id = v_uid
    and q.active = true
    and uq.period_key = public.quest_period_key(q.kind);

  return jsonb_build_object(
    'ok', true,
    'by_kind', coalesce(v_result, '{}'::jsonb),
    'summary', jsonb_build_object('claimable', v_claimable, 'in_progress', v_in_progress)
  );
end $$;

revoke all on function public.get_user_quests() from public;
grant execute on function public.get_user_quests() to authenticated, service_role;

-- ─── 7) bump_quest_progress: Progress-Erhöhung aus Gameplay-Endpoints ────
-- Pendant zu bump_mission_progress, aber für die neue quests-Tabelle.
create or replace function public.bump_quest_progress(
  p_user_id uuid,
  p_metric  text,
  p_amount  numeric default 1
) returns table(updated_count int, newly_completed int)
language plpgsql security definer set search_path = public as $$
declare
  v_updated int := 0;
  v_completed int := 0;
  r record;
  v_new_progress numeric;
  v_is_done boolean;
  v_was_done boolean;
begin
  if p_user_id is null or p_amount <= 0 then
    return query select 0, 0;
    return;
  end if;

  -- Sicherstellen, dass für alle Daily/Weekly/Main/Side/Seasonal Rows
  -- existieren (sonst kann progress nicht hochgezählt werden).
  perform public.ensure_user_quests(p_user_id);

  for r in
    select uq.id, uq.progress, uq.completed_at, q.target_value
      from public.user_quests uq
      join public.quests q on q.id = uq.quest_id
     where uq.user_id   = p_user_id
       and uq.claimed_at is null
       and q.active     = true
       and q.target_metric = p_metric
       and uq.period_key = public.quest_period_key(q.kind)
  loop
    v_updated := v_updated + 1;
    v_new_progress := coalesce(r.progress, 0) + p_amount;
    v_was_done := r.completed_at is not null;
    v_is_done  := v_new_progress >= r.target_value;
    update public.user_quests
       set progress = v_new_progress,
           completed_at = case when v_is_done and not v_was_done then now() else completed_at end
     where id = r.id;
    if v_is_done and not v_was_done then
      v_completed := v_completed + 1;
    end if;
  end loop;

  return query select v_updated, v_completed;
end $$;

revoke all on function public.bump_quest_progress(uuid, text, numeric) from public;
grant execute on function public.bump_quest_progress(uuid, text, numeric) to authenticated, service_role;

-- ─── 8) claim_quest: Reward auszahlen, claimed_at setzen ─────────────────
-- Iteriert über das JSONB-rewards-Array und ruft je nach kind die richtige
-- Gutschrift auf. Unbekannte kinds werden ignoriert (vorwärts-kompatibel).
create or replace function public.claim_quest(p_quest_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_q record;
  v_uq record;
  v_reward jsonb;
  v_kind text;
  v_amount int;
  v_code text;
  v_total_gems int := 0;
  v_total_xp int := 0;
begin
  if v_uid is null then return jsonb_build_object('ok', false, 'error', 'not_authenticated'); end if;

  select * into v_q from public.quests where id = p_quest_id and active = true;
  if not found then return jsonb_build_object('ok', false, 'error', 'quest_not_found'); end if;

  -- Aktuellen Slot finden + Locken
  select * into v_uq from public.user_quests
    where user_id = v_uid and quest_id = p_quest_id
      and period_key = public.quest_period_key(v_q.kind)
    for update;
  if not found then return jsonb_build_object('ok', false, 'error', 'no_progress_row'); end if;
  if v_uq.completed_at is null then return jsonb_build_object('ok', false, 'error', 'not_completed'); end if;
  if v_uq.claimed_at is not null then return jsonb_build_object('ok', false, 'error', 'already_claimed'); end if;

  -- Sicherstellen, dass User-Aggregat-Tabellen existieren
  insert into public.user_gems (user_id, gems) values (v_uid, 0) on conflict (user_id) do nothing;
  insert into public.user_resources (user_id, wood, stone, gold, mana, speed_tokens)
    values (v_uid, 0, 0, 0, 0, 0) on conflict (user_id) do nothing;

  -- Rewards auszahlen
  for v_reward in select * from jsonb_array_elements(coalesce(v_q.rewards, '[]'::jsonb))
  loop
    v_kind   := v_reward->>'kind';
    v_amount := coalesce((v_reward->>'amount')::int, 0);
    v_code   := v_reward->>'code';
    if v_amount <= 0 and v_kind <> 'item' then continue; end if;

    if v_kind = 'gems' then
      update public.user_gems set gems = gems + v_amount where user_id = v_uid;
      v_total_gems := v_total_gems + v_amount;
    elsif v_kind = 'wood' then
      update public.user_resources set wood = wood + v_amount where user_id = v_uid;
    elsif v_kind = 'stone' then
      update public.user_resources set stone = stone + v_amount where user_id = v_uid;
    elsif v_kind = 'gold' then
      update public.user_resources set gold = gold + v_amount where user_id = v_uid;
    elsif v_kind = 'mana' then
      update public.user_resources set mana = mana + v_amount where user_id = v_uid;
    elsif v_kind = 'speed_token' then
      update public.user_resources set speed_tokens = coalesce(speed_tokens, 0) + v_amount where user_id = v_uid;
    elsif v_kind = 'xp' then
      update public.users set xp = coalesce(xp, 0) + v_amount where id = v_uid;
      v_total_xp := v_total_xp + v_amount;
      -- Halbe XP auch ins Saison-Pass-Track (falls aktiv)
      begin
        perform public.add_season_xp(v_uid, greatest(1, v_amount / 2));
      exception when others then /* no-op falls add_season_xp nicht existiert */
      end;
    elsif v_kind = 'item' and v_code is not null then
      begin
        perform public.grant_inventory_item(v_uid, v_code, greatest(1, v_amount));
      exception when others then /* falls Item-Code nicht im Katalog */
      end;
    end if;
  end loop;

  update public.user_quests set claimed_at = now()
   where id = v_uq.id;

  return jsonb_build_object(
    'ok', true,
    'quest_id', p_quest_id,
    'quest_code', v_q.code,
    'quest_name', v_q.name,
    'rewards', v_q.rewards,
    'gained_gems', v_total_gems,
    'gained_xp', v_total_xp
  );
end $$;

revoke all on function public.claim_quest(uuid) from public;
grant execute on function public.claim_quest(uuid) to authenticated;

comment on table public.quests is
  'Konsolidierte Quest-Pool-Tabelle (main/side/daily/weekly/seasonal). Rewards als JSONB-Array.';
comment on table public.user_quests is
  'Pro User+Quest+Periode: progress, completed_at, claimed_at. period_key segmentiert nach Quest-Art.';
comment on function public.bump_quest_progress(uuid, text, numeric) is
  'Erhöht progress aller passenden aktiven Quests des Users um p_amount, markiert completed_at bei Ziel.';
