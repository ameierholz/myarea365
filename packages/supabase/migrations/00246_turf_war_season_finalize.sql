-- 00246: Turf-Krieg Saison-Finalize (monatlich)
--
-- crew_seasons + crew_season_standings existieren seit 00044 — Punkte werden
-- via bump_crew_season_points() getrackt, aber kein Saison-Abschluss.
-- Diese Migration ergänzt finalize_crew_seasons():
--   1) findet alle crew_seasons mit status='active' und ends_at <= now()
--   2) berechnet final_rank pro Standing (Punkte desc, Tie-Break: war_wins desc)
--   3) verteilt Gebietsruf-Reward an Crew-Mitglieder
--   4) setzt status='finalized'
--
-- Reward-Tabelle:
--   Rang 1     → 10 000 🏴 / Mitglied
--   Rang 2-3   →  5 000 🏴 / Mitglied
--   Rang 4-10  →  2 500 🏴 / Mitglied
--   Rang 11-50 →  1 000 🏴 / Mitglied
--   Rang ≥51   →    250 🏴 (Teilnahme, nur wenn ≥1 War-Sieg oder ≥3 Territorien)

create or replace function public.finalize_crew_seasons()
returns table (season_id uuid, crews_ranked int, rep_paid bigint)
language plpgsql security definer
as $$
declare
  s record;
  st record;
  v_rank int;
  v_reward int;
  v_crews int;
  v_total bigint;
begin
  for s in
    select id from public.crew_seasons
      where status = 'active' and ends_at <= now()
  loop
    v_rank := 0;
    v_crews := 0;
    v_total := 0;

    for st in
      select id, crew_id, war_wins, duel_wins, territories_claimed
        from public.crew_season_standings
       where season_id = s.id
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
          set gebietsruf = coalesce(gebietsruf, 0) + v_reward
          where u.id in (
            select user_id from public.crew_members where crew_id = st.crew_id
          );
        v_total := v_total + v_reward;

        begin
          perform public.add_crew_feed(
            st.crew_id, null, 'season_finished',
            jsonb_build_object('rank', v_rank, 'gebietsruf', v_reward, 'season_id', s.id)
          );
        exception when others then null; end;
      end if;

      v_crews := v_crews + 1;
    end loop;

    update public.crew_seasons set status = 'finalized' where id = s.id;

    season_id := s.id;
    crews_ranked := v_crews;
    rep_paid := v_total;
    return next;
  end loop;

  return;
end $$;

grant execute on function public.finalize_crew_seasons() to service_role;

comment on function public.finalize_crew_seasons() is
  'Schließt alle abgelaufenen Crew-Liga-Saisons ab und verteilt Top-50-Gebietsruf-Rewards. Cron monatlich.';
