-- 00249: finalize_* Funktionen lesen Reward-Werte jetzt aus season_reward_tiers
-- (siehe 00248). Damit kann der Admin Werte live ändern ohne Migration.
--
-- WICHTIG: identische Logik wie 00244/00246/00245 — nur die hardcoded CASE-
-- Statements wurden durch season_reward_for_rank()-Aufrufe ersetzt.

drop function if exists public.finalize_shop_league_seasons();

create or replace function public.finalize_shop_league_seasons()
returns table (season_id uuid, business_id uuid, crews_ranked int, rep_paid bigint)
language plpgsql security definer as $$
declare
  s_id uuid; s_biz uuid; s_ends timestamptz;
  v_crews_ranked int; v_rep_paid bigint; v_rank int;
  st record; rew record;
  cur cursor for
    select sls.id, sls.business_id, sls.ends_at
      from public.shop_league_seasons sls
     where sls.status = 'active' and sls.ends_at <= now();
begin
  open cur;
  loop
    fetch cur into s_id, s_biz, s_ends;
    exit when not found;
    v_crews_ranked := 0; v_rep_paid := 0; v_rank := 0;
    for st in
      select id, crew_id, wins
      from public.shop_league_standings
      where shop_league_standings.season_id = s_id
      order by score desc, losses asc, wins desc
    loop
      v_rank := v_rank + 1;
      select * into rew from public.season_reward_for_rank('shop_league', v_rank, st.wins >= 1);
      update public.shop_league_standings
        set rank = v_rank, reward_paid = coalesce(rew.gebietsruf, 0)
        where id = st.id;
      if coalesce(rew.gebietsruf, 0) > 0 then
        update public.users u
          set gebietsruf = coalesce(u.gebietsruf, 0) + rew.gebietsruf
          where u.id in (select user_id from public.crew_members where crew_id = st.crew_id);
        v_rep_paid := v_rep_paid + rew.gebietsruf;
        begin
          perform public.add_crew_feed(st.crew_id, null, 'shop_league_finished',
            jsonb_build_object('rank', v_rank, 'business_id', s_biz, 'gebietsruf', rew.gebietsruf, 'season_id', s_id));
        exception when others then null; end;
      end if;
      v_crews_ranked := v_crews_ranked + 1;
    end loop;
    update public.shop_league_seasons set status = 'finalized', finalized_at = now() where id = s_id;
    season_id := s_id; business_id := s_biz; crews_ranked := v_crews_ranked; rep_paid := v_rep_paid;
    return next;
  end loop;
  close cur;
  return;
end $$;

grant execute on function public.finalize_shop_league_seasons() to service_role;

drop function if exists public.finalize_crew_seasons();

create or replace function public.finalize_crew_seasons()
returns table (season_id uuid, crews_ranked int, rep_paid bigint)
language plpgsql security definer as $$
declare
  s_id uuid; st record; rew record;
  v_rank int; v_crews int; v_total bigint;
  cur cursor for
    select id from public.crew_seasons where status = 'active' and ends_at <= now();
begin
  open cur;
  loop
    fetch cur into s_id;
    exit when not found;
    v_rank := 0; v_crews := 0; v_total := 0;
    for st in
      select id, crew_id, war_wins, duel_wins, territories_claimed
        from public.crew_season_standings
       where crew_season_standings.season_id = s_id
       order by points desc nulls last, war_wins desc, territories_claimed desc
    loop
      v_rank := v_rank + 1;
      select * into rew from public.season_reward_for_rank(
        'turf_war', v_rank, (st.war_wins >= 1 or st.territories_claimed >= 3));
      update public.crew_season_standings set final_rank = v_rank where id = st.id;
      if coalesce(rew.gebietsruf, 0) > 0 then
        update public.users u
          set gebietsruf = coalesce(u.gebietsruf, 0) + rew.gebietsruf
          where u.id in (select user_id from public.crew_members where crew_id = st.crew_id);
        v_total := v_total + rew.gebietsruf;
        begin
          perform public.add_crew_feed(st.crew_id, null, 'season_finished',
            jsonb_build_object('rank', v_rank, 'gebietsruf', rew.gebietsruf, 'season_id', s_id));
        exception when others then null; end;
      end if;
      v_crews := v_crews + 1;
    end loop;
    update public.crew_seasons set status = 'finalized' where id = s_id;
    season_id := s_id; crews_ranked := v_crews; rep_paid := v_total;
    return next;
  end loop;
  close cur;
  return;
end $$;

grant execute on function public.finalize_crew_seasons() to service_role;

create or replace function public.arena_season_finalize()
returns jsonb
language plpgsql security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_end_result jsonb; v_season_id uuid;
  v_top1 int := 0; v_top3 int := 0; v_top10 int := 0; v_top50 int := 0; v_top100 int := 0;
  v_total_gems bigint := 0; v_total_siegel bigint := 0;
  r record; rew record;
begin
  v_end_result := public.arena_season_end();
  if not coalesce((v_end_result->>'ok')::bool, false) then
    return v_end_result;
  end if;
  v_season_id := (v_end_result->>'season_id')::uuid;

  for r in
    select user_id, final_rank from public.user_prestige
     where season_id = v_season_id and final_rank <= 100
     order by final_rank asc
  loop
    select * into rew from public.season_reward_for_rank('arena', r.final_rank, true);
    if rew is null or (coalesce(rew.gems, 0) = 0 and coalesce(rew.siegel_universal, 0) = 0) then
      continue;
    end if;
    if coalesce(rew.gems, 0) > 0 then
      insert into public.user_gems (user_id, gems) values (r.user_id, rew.gems)
      on conflict (user_id) do update
        set gems = public.user_gems.gems + excluded.gems, updated_at = now();
      v_total_gems := v_total_gems + rew.gems;
    end if;
    if coalesce(rew.siegel_universal, 0) > 0 then
      insert into public.user_siegel (user_id, siegel_universal)
        values (r.user_id, rew.siegel_universal)
      on conflict (user_id) do update
        set siegel_universal = coalesce(public.user_siegel.siegel_universal, 0) + excluded.siegel_universal,
            updated_at = now();
      v_total_siegel := v_total_siegel + rew.siegel_universal;
    end if;
    if r.final_rank = 1 then v_top1 := v_top1 + 1;
    elsif r.final_rank <= 3 then v_top3 := v_top3 + 1;
    elsif r.final_rank <= 10 then v_top10 := v_top10 + 1;
    elsif r.final_rank <= 50 then v_top50 := v_top50 + 1;
    elsif r.final_rank <= 100 then v_top100 := v_top100 + 1;
    end if;
  end loop;

  return jsonb_build_object(
    'ok', true, 'season_id', v_season_id, 'ended', v_end_result,
    'top1', v_top1, 'top3', v_top3, 'top10', v_top10,
    'top50', v_top50, 'top100', v_top100,
    'total_gems', v_total_gems, 'total_siegel_universal', v_total_siegel
  );
end $$;

grant execute on function public.arena_season_finalize() to service_role;
