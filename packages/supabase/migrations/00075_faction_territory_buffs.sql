-- Fraktions-Buffs fuer das Territory-System
-- ─────────────────────────────────────────────────────────────
-- 👑 Kronenwacht (Beständig): Claims verfallen 40 % langsamer.
--     Statt 10 Tagen Lebensdauer → 14 Tage. Intensity skaliert proportional.
-- 🗝️ Gossenbund (Raubzug): Bonus-Wegemuenzen beim Uebermalen feindlicher
--     Straßen und bei neuen Claims. +25 % Basis-Claim-XP.
-- Wird automatisch beim Walk-Save über die Helper-Funktionen angewandt.

-- ─────────────────────────────────────────────────────────────
-- 1) Fraktions-aware Intensity-Helper
-- ─────────────────────────────────────────────────────────────
-- Akzeptiert den Owner explizit, damit Kronenwacht-Claims langsamer verfallen.
-- Bleibt kompatibel mit old `claim_intensity(painted_at)` — wird intern aufgerufen.

create or replace function public.claim_intensity_v2(
  painted_at timestamptz,
  owner_id uuid
)
returns int
language sql
stable
parallel safe
as $$
  select greatest(
    0,
    100 - (floor(extract(epoch from (now() - painted_at)) / 86400)
           * case
               when (select faction from public.users where id = owner_id) in ('kronenwacht', 'vanguard') then 7   -- ~14 Tage
               else 10  -- ~10 Tage (Standard)
             end
    )::int
  )
$$;

comment on function public.claim_intensity_v2 is
  'Farbintensität eines Claims abhängig vom Owner. Kronenwacht: 14 Tage Lebensdauer (-7 %/Tag), sonst 10 Tage (-10 %/Tag).';

grant execute on function public.claim_intensity_v2(timestamptz, uuid) to anon, authenticated, service_role;

-- ─────────────────────────────────────────────────────────────
-- 2) Prune: Kronenwacht-Claims leben 14 statt 10 Tage
-- ─────────────────────────────────────────────────────────────

create or replace function public.prune_expired_claims()
returns table(territories_deleted bigint, streets_deleted bigint)
language plpgsql
security definer
set search_path = public
as $$
declare
  t_count bigint;
  s_count bigint;
begin
  -- Territorien: Kronenwacht lebt 14 Tage, Rest 10 Tage
  delete from public.territory_polygons tp
   using public.users u
   where tp.claimed_by_user_id = u.id
     and tp.last_painted_at < now() - case
       when u.faction in ('kronenwacht', 'vanguard') then interval '14 days'
       else interval '10 days'
     end;
  get diagnostics t_count = row_count;

  -- Straßen: Kronenwacht lebt 14 Tage, Rest 10 Tage
  delete from public.streets_claimed sc
   using public.users u
   where sc.user_id = u.id
     and sc.last_painted_at < now() - case
       when u.faction in ('kronenwacht', 'vanguard') then interval '14 days'
       else interval '10 days'
     end;
  get diagnostics s_count = row_count;

  return query select t_count, s_count;
end;
$$;

grant execute on function public.prune_expired_claims() to service_role;

-- ─────────────────────────────────────────────────────────────
-- 3) Gossenbund: Bonus-XP bei neuen Eroberungen + feindlichen Übermalungen
-- ─────────────────────────────────────────────────────────────
-- Liefert den Bonus, der zum base_xp eines Walks addiert wird.
-- - new_claims_count: Anzahl frischer Segmente/Straßen/Gebiete
-- - enemy_repaints_count: Anzahl fremder Claims die übermalt wurden
-- Bonus = 25 % der Basis-XP für die Gossenbund-Fraktion.

create or replace function public.faction_claim_bonus(
  p_user_id uuid,
  p_base_claim_xp int,
  p_enemy_repaints int default 0
)
returns int
language plpgsql
stable
parallel safe
as $$
declare
  v_faction text;
  v_bonus   int := 0;
begin
  select faction into v_faction from public.users where id = p_user_id;

  if v_faction in ('gossenbund', 'syndicate') then
    -- 25 % auf neue Claim-XP + extra 50 🪙 pro übermaltem Feind-Claim
    v_bonus := (p_base_claim_xp * 25) / 100 + coalesce(p_enemy_repaints, 0) * 50;
  end if;

  return v_bonus;
end;
$$;

comment on function public.faction_claim_bonus is
  'Gossenbund-Bonus-XP pro Walk: +25 % auf Basis-Claim-XP + 50 pro übermaltem Feind-Claim. Kronenwacht bekommt 0 (deren Buff ist die längere Lebensdauer).';

grant execute on function public.faction_claim_bonus(uuid, int, int) to authenticated, service_role;

-- ─────────────────────────────────────────────────────────────
-- 4) Repaint-Funktion: gibt Feind-Übermalungen zurück
-- ─────────────────────────────────────────────────────────────
-- Erweiterung von repaint_user_claims — zählt parallel wie viele
-- fremde Claims in den gelaufenen Segmenten liegen (für Gossenbund-Bonus).

create or replace function public.count_enemy_repaints(
  p_user_id uuid,
  p_street_names text[]
)
returns int
language sql
stable
parallel safe
as $$
  select coalesce(count(distinct sc.id), 0)::int
    from public.streets_claimed sc
   where sc.user_id <> p_user_id
     and sc.street_name = any(p_street_names);
$$;

comment on function public.count_enemy_repaints is
  'Zählt wie viele der gelaufenen Straßen zu einem anderen Runner gehören (= übermalt).';

grant execute on function public.count_enemy_repaints(uuid, text[]) to authenticated, service_role;
