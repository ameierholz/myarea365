-- 00038: Crew-Pflicht für Territorien
-- Solo-Runner können Polygone zwar "sichtbar" machen (status='pending_crew'), bekommen aber keine XP.
-- Sobald sie einer Crew beitreten, werden pending-Territorien in 'active' hochgestuft
-- und die 500 XP pro Polygon einmalig ausgezahlt.

-- 1) status-Enum erweitern
alter table public.territory_polygons
  drop constraint if exists territory_polygons_status_check;

alter table public.territory_polygons
  add constraint territory_polygons_status_check
  check (status in ('active','stolen','expired','pending_crew'));

-- 2) RPC: Alle pending_crew-Territorien eines Users auf active heben, XP gutschreiben.
--    Wird beim Crew-Beitritt aufgerufen.
create or replace function public.promote_pending_territories(p_user_id uuid)
returns table(promoted_count int, xp_granted int)
language plpgsql
security definer
as $$
declare
  v_crew_id uuid;
  v_count int := 0;
  v_xp int := 0;
begin
  select current_crew_id into v_crew_id from public.users where id = p_user_id;
  if v_crew_id is null then
    return query select 0, 0;
    return;
  end if;

  with upd as (
    update public.territory_polygons
    set status = 'active',
        owner_crew_id = v_crew_id,
        xp_awarded = 500
    where claimed_by_user_id = p_user_id
      and status = 'pending_crew'
    returning id
  )
  select count(*)::int into v_count from upd;

  v_xp := v_count * 500;

  if v_count > 0 and v_xp > 0 then
    update public.users
    set xp = coalesce(xp, 0) + v_xp
    where id = p_user_id;
  end if;

  return query select v_count, v_xp;
end $$;

grant execute on function public.promote_pending_territories(uuid) to authenticated, service_role;

comment on function public.promote_pending_territories is
  'Hebt alle pending_crew-Territorien eines Users auf active, wenn er eine Crew hat, und gutschreibt 500 XP pro Polygon.';
