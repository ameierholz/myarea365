-- ════════════════════════════════════════════════════════════════════
-- Stadt-Ären (City-Eras) — Phase 1: Manuell-getriggerte Ära-Rotation.
--
-- Konzept:
-- - Pro Stadt läuft genau eine aktive Ära (cities.current_era_id)
-- - Ära kann durch Admin manuell beendet werden (end_era_manual RPC)
-- - Beim Ende: HoF-Snapshot wird gespeichert, neue Ära startet
-- - Reset des Spielstands ist NICHT in dieser Phase enthalten — wird in
--   Phase 2/3 angegangen wenn Carry-Over-Regeln klar sind
--
-- "Ära" statt "Saison", weil Saison schon für CvC-Matchmaking belegt ist.
-- ════════════════════════════════════════════════════════════════════

create table if not exists public.eras (
  id              uuid primary key default gen_random_uuid(),
  city_slug       text not null references public.cities(slug),
  number          integer not null,
  started_at      timestamptz not null default now(),
  ended_at        timestamptz,
  end_reason      text,
  winner_crew_id  uuid references public.crews(id),
  hof_snapshot    jsonb default '{}'::jsonb,
  created_by      uuid references public.users(id),
  unique (city_slug, number)
);

create index if not exists idx_eras_city_active
  on public.eras(city_slug)
  where ended_at is null;

comment on table public.eras is
  'Stadt-Ära. Pro Stadt eine aktive Ära. Ende setzt ended_at + HoF-Snapshot, neue Ära wird angelegt.';

alter table public.cities
  add column if not exists current_era_id uuid references public.eras(id);

comment on column public.cities.current_era_id is
  'Verweis auf die aktuell aktive Ära dieser Stadt.';

-- ════════════════════════════════════════════════════════════════════
-- Ära 1 für Berlin seeden (alle bestehenden Cities sollen eine aktive Ära haben)
-- ════════════════════════════════════════════════════════════════════
do $$
declare
  v_city record;
  v_era_id uuid;
begin
  for v_city in (select slug from public.cities where current_era_id is null)
  loop
    insert into public.eras (city_slug, number, started_at)
    values (v_city.slug, 1, now())
    returning id into v_era_id;

    update public.cities set current_era_id = v_era_id where slug = v_city.slug;
  end loop;
end $$;

-- ════════════════════════════════════════════════════════════════════
-- HoF-Snapshot-Builder (intern, wird von end_era_manual aufgerufen)
-- ════════════════════════════════════════════════════════════════════
create or replace function public.build_era_hof_snapshot(p_city_slug text)
returns jsonb
language plpgsql
stable
as $$
declare
  v_top_crews jsonb;
  v_top_players jsonb;
  v_stats jsonb;
begin
  -- Top-Crews der Stadt nach Mitglieder-Anzahl
  select coalesce(jsonb_agg(t order by t.member_count desc), '[]'::jsonb)
    into v_top_crews
  from (
    select c.id, c.name, c.tag,
           (select count(*) from public.crew_members cm where cm.crew_id = c.id) as member_count
    from public.crews c
    join public.users u on u.crew_id = c.id
   where u.home_city_slug = p_city_slug
   group by c.id, c.name, c.tag
   order by member_count desc
   limit 10
  ) t;

  -- Top-Player der Stadt nach VIP-Punkten (oder einfach Erstellungsdatum als Fallback)
  select coalesce(jsonb_agg(t order by t.created_at), '[]'::jsonb)
    into v_top_players
  from (
    select u.id, u.username, u.display_name, u.created_at
      from public.users u
     where u.home_city_slug = p_city_slug
     order by u.created_at
     limit 50
  ) t;

  -- Aggregat-Stats
  select jsonb_build_object(
    'total_players', (select count(*) from public.users where home_city_slug = p_city_slug),
    'total_crews',   (select count(distinct c.id)
                       from public.crews c
                       join public.users u on u.crew_id = c.id
                      where u.home_city_slug = p_city_slug),
    'snapshot_at',   now()
  ) into v_stats;

  return jsonb_build_object(
    'top_crews', v_top_crews,
    'top_players', v_top_players,
    'stats', v_stats
  );
end;
$$;

-- ════════════════════════════════════════════════════════════════════
-- end_era_manual() — Admin-getriggerter Ära-Wechsel
--
-- 1) HoF-Snapshot der laufenden Ära bauen + speichern
-- 2) ended_at + end_reason setzen
-- 3) Neue Ära mit number+1 anlegen
-- 4) cities.current_era_id auf neue Ära zeigen lassen
--
-- WICHTIG: Spielstand wird NICHT zurückgesetzt. Das ist Phase 2/3-Aufgabe.
-- ════════════════════════════════════════════════════════════════════
create or replace function public.end_era_manual(
  p_city_slug   text,
  p_end_reason  text default 'manual',
  p_admin_user  uuid default null
)
returns jsonb
language plpgsql
security definer
as $$
declare
  v_old_era_id    uuid;
  v_old_number    integer;
  v_new_era_id    uuid;
  v_snapshot      jsonb;
  v_winner_crew   uuid;
begin
  -- Aktuelle Ära der Stadt finden
  select id, number into v_old_era_id, v_old_number
    from public.eras
   where city_slug = p_city_slug and ended_at is null
   limit 1;

  if v_old_era_id is null then
    raise exception 'Keine aktive Ära für Stadt "%"', p_city_slug;
  end if;

  -- HoF-Snapshot bauen
  v_snapshot := public.build_era_hof_snapshot(p_city_slug);

  -- Top-Crew als Sieger ermitteln
  v_winner_crew := nullif((v_snapshot -> 'top_crews' -> 0 ->> 'id'), '')::uuid;

  -- Aktuelle Ära schließen
  update public.eras
     set ended_at        = now(),
         end_reason      = p_end_reason,
         winner_crew_id  = v_winner_crew,
         hof_snapshot    = v_snapshot
   where id = v_old_era_id;

  -- Neue Ära anlegen
  insert into public.eras (city_slug, number, started_at, created_by)
  values (p_city_slug, v_old_number + 1, now(), p_admin_user)
  returning id into v_new_era_id;

  -- cities.current_era_id auf neue Ära
  update public.cities set current_era_id = v_new_era_id where slug = p_city_slug;

  return jsonb_build_object(
    'ok', true,
    'old_era_id', v_old_era_id,
    'old_era_number', v_old_number,
    'new_era_id', v_new_era_id,
    'new_era_number', v_old_number + 1,
    'winner_crew_id', v_winner_crew,
    'snapshot', v_snapshot
  );
end;
$$;

comment on function public.end_era_manual is
  'Admin-RPC: Beendet aktive Ära einer Stadt, speichert HoF-Snapshot, startet Ära N+1. Reset des Spielstands ist Phase 2/3.';

-- ════════════════════════════════════════════════════════════════════
-- RLS: eras lesbar für authenticated, write-only via security-definer RPC
-- ════════════════════════════════════════════════════════════════════
alter table public.eras enable row level security;

drop policy if exists "eras_public_read" on public.eras;
create policy "eras_public_read"
  on public.eras for select
  to authenticated
  using (true);
