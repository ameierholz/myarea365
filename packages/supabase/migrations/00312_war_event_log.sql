-- 00312 — War Event-Log für Battle-Replay-UI
-- Jeder Score-bringende Vorgang innerhalb eines crew_war wird hier protokolliert.

create table if not exists public.crew_war_events (
  id uuid primary key default gen_random_uuid(),
  war_id uuid not null references public.crew_wars(id) on delete cascade,
  recorded_at timestamptz not null default now(),
  event_type text not null,                       -- 'repeater_attack' | 'repeater_defense' | 'manual' | 'siege'
  actor_user_id uuid,                             -- wer hat den Vorgang ausgelöst (optional)
  attacker_crew uuid,                             -- der angreifende Crew aus Sicht des Events
  outcome text,                                   -- 'attacker_won' | 'defender_won' | 'draw'
  points_attacker int not null default 0,         -- Punkte für War-Attacker-Crew
  points_defender int not null default 0,         -- Punkte für War-Defender-Crew
  source_id uuid,                                 -- ID des verknüpften Objekts (repeater_attack etc.)
  payload jsonb                                   -- frei: distanz, troop_count, repeater_name etc.
);

create index if not exists crew_war_events_war_recent_idx
  on public.crew_war_events (war_id, recorded_at desc);

-- Helper-Funktion zum Loggen (vom Trigger genutzt).
create or replace function public._log_war_event(
  p_war_id uuid,
  p_type text,
  p_actor uuid,
  p_attacker_crew uuid,
  p_outcome text,
  p_points_attacker int,
  p_points_defender int,
  p_source_id uuid,
  p_payload jsonb
) returns void language sql security definer set search_path = public as $$
  insert into public.crew_war_events
    (war_id, event_type, actor_user_id, attacker_crew, outcome,
     points_attacker, points_defender, source_id, payload)
  values
    (p_war_id, p_type, p_actor, p_attacker_crew, p_outcome,
     p_points_attacker, p_points_defender, p_source_id, p_payload);
$$;

-- Patch des Repeater-Attack-Resolved-Triggers: identisch wie 00284 + Event-Log
create or replace function public._on_repeater_attack_resolved()
returns trigger language plpgsql security definer as $$
declare
  v_repeater record;
  v_war record;
  v_pa int := 0;
  v_pd int := 0;
begin
  if new.outcome is null or new.outcome = old.outcome then return new; end if;
  if new.outcome not in ('attacker_won','defender_won') then return new; end if;

  select * into v_repeater from public.crew_repeaters where id = new.repeater_id;
  if v_repeater is null then return new; end if;

  select * into v_war from public.crew_wars
   where status = 'active'
     and (
          (attacker_crew = new.attacker_crew_id and defender_crew = v_repeater.crew_id)
       or (attacker_crew = v_repeater.crew_id   and defender_crew = new.attacker_crew_id)
     )
   order by declared_at desc limit 1;
  if v_war is null then return new; end if;

  -- Score-Update (gleiche Logik wie 00284)
  if v_war.attacker_crew = new.attacker_crew_id then
    -- War-Attacker greift hier an
    if new.outcome = 'attacker_won' then v_pa := 100; else v_pd := 50; end if;
  else
    -- War-Defender greift hier an
    if new.outcome = 'attacker_won' then v_pd := 100; else v_pa := 50; end if;
  end if;
  if v_pa > 0 then
    update public.crew_wars set attacker_score = attacker_score + v_pa where id = v_war.id;
  end if;
  if v_pd > 0 then
    update public.crew_wars set defender_score = defender_score + v_pd where id = v_war.id;
  end if;

  -- Event loggen
  perform public._log_war_event(
    v_war.id,
    case when new.outcome = 'attacker_won' then 'repeater_destroyed' else 'repeater_defended' end,
    new.attacker_user_id,
    new.attacker_crew_id,
    new.outcome,
    v_pa, v_pd,
    new.id,
    jsonb_build_object(
      'repeater_id', v_repeater.id,
      'repeater_name', v_repeater.name
    )
  );

  return new;
end $$;

-- RPC: Liefert Events für eine War-ID (nur für Mitglieder einer der beiden Crews).
create or replace function public.get_war_events(p_war_id uuid)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  v_user uuid := auth.uid();
  v_my_crew uuid;
  v_war record;
  v_events jsonb;
begin
  if v_user is null then return jsonb_build_object('ok', false, 'error', 'not_authenticated'); end if;
  select crew_id into v_my_crew from public.crew_members where user_id = v_user;

  select * into v_war from public.crew_wars where id = p_war_id;
  if v_war is null then return jsonb_build_object('ok', false, 'error', 'war_not_found'); end if;

  if v_my_crew is null or v_my_crew not in (v_war.attacker_crew, v_war.defender_crew) then
    return jsonb_build_object('ok', false, 'error', 'not_participant');
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'id', id,
    'recorded_at', recorded_at,
    'event_type', event_type,
    'actor_user_id', actor_user_id,
    'attacker_crew', attacker_crew,
    'outcome', outcome,
    'points_attacker', points_attacker,
    'points_defender', points_defender,
    'payload', payload
  ) order by recorded_at asc), '[]'::jsonb)
  into v_events
  from public.crew_war_events
  where war_id = p_war_id;

  return jsonb_build_object(
    'ok', true,
    'war', jsonb_build_object(
      'id', v_war.id,
      'attacker_crew', v_war.attacker_crew,
      'defender_crew', v_war.defender_crew,
      'attacker_score', v_war.attacker_score,
      'defender_score', v_war.defender_score,
      'declared_at', v_war.declared_at,
      'ends_at', v_war.ends_at,
      'ended_at', v_war.ended_at,
      'status', v_war.status,
      'winner_crew', v_war.winner_crew,
      'is_my_crew_attacker', v_my_crew = v_war.attacker_crew
    ),
    'events', v_events
  );
end $$;

revoke all on function public._log_war_event(uuid, text, uuid, uuid, text, int, int, uuid, jsonb) from public;
grant execute on function public._log_war_event(uuid, text, uuid, uuid, text, int, int, uuid, jsonb) to service_role;
grant execute on function public.get_war_events(uuid) to authenticated;

alter table public.crew_war_events enable row level security;
create policy crew_war_events_select on public.crew_war_events for select to authenticated
  using (
    exists (
      select 1 from public.crew_wars w
      join public.crew_members cm on cm.crew_id in (w.attacker_crew, w.defender_crew)
      where w.id = crew_war_events.war_id and cm.user_id = auth.uid()
    )
  );
