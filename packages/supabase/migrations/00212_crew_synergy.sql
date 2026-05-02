-- ══════════════════════════════════════════════════════════════════════════
-- Phase 3 — Crew-Aktivitäts-Synergie
--
-- Konzept: Pro Crew-Mitglied das in den letzten 24h gelaufen ist gibt es
-- +1% XP-Buff für ALLE Crew-Mitglieder, max +25%. Wer 7+ Tage inaktiv ist,
-- zählt als "Bremse" und ist sichtbar in der Crew-Liste.
-- ══════════════════════════════════════════════════════════════════════════

create or replace function public.get_crew_synergy(p_crew_id uuid default null)
returns jsonb language plpgsql security definer as $$
declare
  v_crew_id uuid := p_crew_id;
  v_total int;
  v_active int;
  v_idle int;
  v_buff_pct int;
  v_members jsonb;
begin
  if v_crew_id is null then
    select current_crew_id into v_crew_id from public.users where id = auth.uid();
  end if;
  if v_crew_id is null then
    return jsonb_build_object('ok', false, 'error', 'no_crew');
  end if;

  with members as (
    select cm.user_id, u.display_name, u.avatar_url,
           (select max(created_at) from public.walks w where w.user_id = cm.user_id) as last_walk
      from public.crew_members cm
      join public.users u on u.id = cm.user_id
     where cm.crew_id = v_crew_id
  )
  select
    count(*),
    count(*) filter (where last_walk > now() - interval '24 hours'),
    count(*) filter (where last_walk is null or last_walk < now() - interval '7 days'),
    coalesce(jsonb_agg(jsonb_build_object(
      'user_id', user_id,
      'display_name', display_name,
      'avatar_url', avatar_url,
      'last_walk_at', last_walk,
      'is_active_24h', last_walk > now() - interval '24 hours',
      'is_idle_7d', last_walk is null or last_walk < now() - interval '7 days',
      'hours_since_walk', case when last_walk is null then null else round(extract(epoch from (now() - last_walk)) / 3600) end
    ) order by last_walk desc nulls last), '[]'::jsonb)
    into v_total, v_active, v_idle, v_members
    from members;

  v_buff_pct := least(v_active, 25);

  return jsonb_build_object(
    'ok', true,
    'crew_id', v_crew_id,
    'total_members', v_total,
    'active_24h', v_active,
    'idle_7d', v_idle,
    'buff_pct', v_buff_pct,
    'members', v_members
  );
end $$;

revoke all on function public.get_crew_synergy(uuid) from public;
grant execute on function public.get_crew_synergy(uuid) to authenticated;
