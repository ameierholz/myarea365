-- 00247: Fix ambiguous column refs in finalize_*_seasons() functions
--
-- Problem: PL/pgSQL OUT-Parameter (season_id, business_id) collidieren mit
-- gleichnamigen Tabellen-Spalten in den FOR-Schleifen → "ambiguous column reference".
-- Lösung: Cursor mit lokalen Variablen + qualifizierte Spalten-Refs.
-- Funktional identisch zu 00244 + 00246, nur ohne den Naming-Clash.

drop function if exists public.finalize_shop_league_seasons();

create or replace function public.finalize_shop_league_seasons()
returns table (season_id uuid, business_id uuid, crews_ranked int, rep_paid bigint)
language plpgsql security definer as $$
declare
  s_id uuid;
  s_biz uuid;
  s_ends timestamptz;
  v_crews_ranked int;
  v_rep_paid bigint;
  v_rank int;
  st record;
  v_reward int;
  cur cursor for
    select sls.id, sls.business_id, sls.ends_at
      from public.shop_league_seasons sls
     where sls.status = 'active' and sls.ends_at <= now();
begin
  open cur;
  loop
    fetch cur into s_id, s_biz, s_ends;
    exit when not found;

    v_crews_ranked := 0;
    v_rep_paid := 0;
    v_rank := 0;
    for st in
      select id, crew_id, wins
      from public.shop_league_standings
      where shop_league_standings.season_id = s_id
      order by score desc, losses asc, wins desc
    loop
      v_rank := v_rank + 1;
      v_reward := case v_rank
        when 1 then 5000
        when 2 then 2500
        when 3 then 1000
        else (case when st.wins >= 1 then 250 else 0 end)
      end;

      update public.shop_league_standings
        set rank = v_rank, reward_paid = v_reward
        where id = st.id;

      if v_reward > 0 then
        update public.users u
          set gebietsruf = coalesce(u.gebietsruf, 0) + v_reward
          where u.id in (
            select user_id from public.crew_members where crew_id = st.crew_id
          );
        v_rep_paid := v_rep_paid + v_reward;

        begin
          perform public.add_crew_feed(
            st.crew_id, null, 'shop_league_finished',
            jsonb_build_object(
              'rank', v_rank, 'business_id', s_biz,
              'gebietsruf', v_reward, 'season_id', s_id
            )
          );
        exception when others then null; end;
      end if;

      v_crews_ranked := v_crews_ranked + 1;
    end loop;

    update public.shop_league_seasons
      set status = 'finalized', finalized_at = now()
      where id = s_id;

    season_id := s_id;
    business_id := s_biz;
    crews_ranked := v_crews_ranked;
    rep_paid := v_rep_paid;
    return next;
  end loop;
  close cur;
  return;
end $$;

grant execute on function public.finalize_shop_league_seasons() to service_role;

drop function if exists public.finalize_crew_seasons();

create or replace function public.finalize_crew_seasons()
returns table (season_id uuid, crews_ranked int, rep_paid bigint)
language plpgsql security definer
as $$
declare
  s_id uuid;
  st record;
  v_rank int;
  v_reward int;
  v_crews int;
  v_total bigint;
  cur cursor for
    select id from public.crew_seasons
      where status = 'active' and ends_at <= now();
begin
  open cur;
  loop
    fetch cur into s_id;
    exit when not found;

    v_rank := 0;
    v_crews := 0;
    v_total := 0;

    for st in
      select id, crew_id, war_wins, duel_wins, territories_claimed
        from public.crew_season_standings
       where crew_season_standings.season_id = s_id
       order by points desc nulls last,
                war_wins desc,
                territories_claimed desc
    loop
      v_rank := v_rank + 1;
      v_reward := case
        when v_rank = 1                                          then 10000
        when v_rank <= 3                                         then  5000
        when v_rank <= 10                                        then  2500
        when v_rank <= 50                                        then  1000
        when (st.war_wins >= 1 or st.territories_claimed >= 3)   then   250
        else 0
      end;

      update public.crew_season_standings
        set final_rank = v_rank
        where id = st.id;

      if v_reward > 0 then
        update public.users u
          set gebietsruf = coalesce(u.gebietsruf, 0) + v_reward
          where u.id in (
            select user_id from public.crew_members where crew_id = st.crew_id
          );
        v_total := v_total + v_reward;

        begin
          perform public.add_crew_feed(
            st.crew_id, null, 'season_finished',
            jsonb_build_object('rank', v_rank, 'gebietsruf', v_reward, 'season_id', s_id)
          );
        exception when others then null; end;
      end if;

      v_crews := v_crews + 1;
    end loop;

    update public.crew_seasons set status = 'finalized' where id = s_id;

    season_id := s_id;
    crews_ranked := v_crews;
    rep_paid := v_total;
    return next;
  end loop;
  close cur;
  return;
end $$;

grant execute on function public.finalize_crew_seasons() to service_role;
