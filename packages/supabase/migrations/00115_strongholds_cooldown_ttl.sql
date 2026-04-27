-- ══════════════════════════════════════════════════════════════════════════
-- Wegelager: zufälliger Respawn-Cooldown (60 Min – 6 Std) + 48h-TTL
-- ══════════════════════════════════════════════════════════════════════════
-- - Defeat: defeated_at = now(), respawn_at = random 60 Min – 6 Std
-- - TTL: nicht-besiegte Wegelager älter als 48 h verschwinden automatisch
-- ══════════════════════════════════════════════════════════════════════════

-- ─── Rally-Resolution patchen: Random-Respawn statt fix 6 h ────────────
-- (überschreibt die Logik aus 00110_rallies.sql)
create or replace function public.resolve_due_rallies()
returns int language plpgsql security definer as $$
declare
  r record;
  v_sh record;
  v_total_atk bigint;
  v_total_hp bigint;
  v_resolved int := 0;
begin
  -- ── Phase A: preparing → marching nach prep_ends_at ─────────────────
  update public.rallies
     set status = 'marching',
         march_ends_at = now() + interval '60 seconds'
   where status = 'preparing'
     and prep_ends_at <= now();

  -- ── Phase B: marching → done nach march_ends_at (Combat-Resolution) ─
  for r in
    select * from public.rallies
     where status = 'marching'
       and march_ends_at is not null
       and march_ends_at <= now()
     for update
  loop
    select * into v_sh from public.strongholds where id = r.stronghold_id for update;
    if v_sh is null then
      update public.rallies set status = 'aborted' where id = r.id;
      continue;
    end if;
    select coalesce(sum(atk_contribution), 0) into v_total_atk
      from public.rally_participants where rally_id = r.id;
    v_total_hp := v_sh.current_hp;

    if v_total_atk >= v_total_hp and v_sh.defeated_at is null then
      update public.strongholds
         set current_hp  = 0,
             defeated_at = now(),
             defeated_by_crew = r.crew_id,
             -- Random-Respawn 60 Min – 6 Std (in Minuten-Granularität)
             respawn_at  = now() + (60 + floor(random() * 301))::int * interval '1 minute'
       where id = v_sh.id;
      perform public._distribute_rally_loot(r.id, v_sh.level);
    else
      if v_sh.defeated_at is null then
        update public.strongholds
           set current_hp = greatest(0, v_sh.current_hp - v_total_atk)
         where id = v_sh.id;
      end if;
      perform public._return_rally_troops(r.id, false);
    end if;

    update public.rallies set status = 'done' where id = r.id;
    v_resolved := v_resolved + 1;
  end loop;
  return v_resolved;
end $$;
revoke all on function public.resolve_due_rallies() from public;
grant execute on function public.resolve_due_rallies() to authenticated;

-- ─── TTL: nicht-besiegte Wegelager älter als 48 h verschwinden ──────────
create or replace function public.expire_old_strongholds()
returns int language plpgsql security definer as $$
declare v_count int;
begin
  with expired as (
    update public.strongholds
       set defeated_at = now(),
           respawn_at  = now() + (60 + floor(random() * 301))::int * interval '1 minute'
     where defeated_at is null
       and spawned_at < now() - interval '48 hours'
    returning id
  )
  select count(*) into v_count from expired;
  return v_count;
end $$;
revoke all on function public.expire_old_strongholds() from public;
grant execute on function public.expire_old_strongholds() to authenticated;

-- Direkt ausführen
select public.expire_old_strongholds();
