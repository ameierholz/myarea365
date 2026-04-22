-- 00039: Zeit-abhängige Reclaim-XP für Straßenabschnitte.
-- Ziel: Kein Farming über dieselben Straßen, aber faire Belohnung wenn Runner
-- nach langer Zeit zurückkehren. Multiplier kappt bei 1.0× — keine unendliche Skala.

-- 1) last_walked_at-Timestamp auf den drei Claim-Tabellen.
--    Wird bei jedem (Re-)Walk über denselben Abschnitt aktualisiert.
alter table public.street_segments
  add column if not exists last_walked_at timestamptz not null default now();

alter table public.streets_claimed
  add column if not exists last_walked_at timestamptz not null default now();

alter table public.territory_polygons
  add column if not exists last_walked_at timestamptz not null default now();

create index if not exists idx_street_segments_last_walked
  on public.street_segments(user_id, last_walked_at);

-- 2) Multiplier-Funktion:
--    < 24 h:   0.0×  (Cooldown gegen Farming)
--    1–7 d:    0.3×
--    7–30 d:   0.6×
--    > 30 d:   1.0×  (voller Reclaim)
create or replace function public.reclaim_xp_multiplier(p_last_walked timestamptz)
returns numeric language sql immutable as $$
  select case
    when p_last_walked is null                                        then 1.0
    when now() - p_last_walked < interval '24 hours'                  then 0.0
    when now() - p_last_walked < interval '7 days'                    then 0.3
    when now() - p_last_walked < interval '30 days'                   then 0.6
    else 1.0
  end;
$$;

-- 3) RPC: bulk Reclaim — nimmt osm_way_ids entgegen, berechnet pro Abschnitt den
--    Bonus basierend auf last_walked_at, aktualisiert Timestamps und gutschreibt
--    XP direkt auf users.xp. Gibt Summen zurück für Frontend-Anzeige.
create or replace function public.process_segment_reclaims(
  p_user_id uuid,
  p_osm_way_ids bigint[]
)
returns table(
  reclaim_count int,
  reclaim_xp int,
  segments_cooldown int
)
language plpgsql
security definer
as $$
declare
  v_count int := 0;
  v_xp int := 0;
  v_cooldown int := 0;
  r record;
begin
  if p_osm_way_ids is null or array_length(p_osm_way_ids, 1) is null then
    return query select 0, 0, 0;
    return;
  end if;

  for r in
    select id, last_walked_at,
           public.reclaim_xp_multiplier(last_walked_at) as mult
    from public.street_segments
    where user_id = p_user_id
      and osm_way_id = any(p_osm_way_ids)
      and segment_index = 0
  loop
    if r.mult = 0.0 then
      v_cooldown := v_cooldown + 1;
    else
      v_count := v_count + 1;
      v_xp := v_xp + floor(50 * r.mult)::int;
    end if;

    update public.street_segments
    set last_walked_at = now()
    where id = r.id;
  end loop;

  if v_xp > 0 then
    update public.users set xp = coalesce(xp, 0) + v_xp where id = p_user_id;
  end if;

  return query select v_count, v_xp, v_cooldown;
end $$;

grant execute on function public.process_segment_reclaims(uuid, bigint[]) to authenticated, service_role;
grant execute on function public.reclaim_xp_multiplier(timestamptz) to authenticated, service_role;

comment on function public.process_segment_reclaims is
  'Verarbeitet Re-Walks über existierende Segmente. Gibt zeit-abhängigen Bonus (0–100 % von 50 XP) und aktualisiert last_walked_at.';
