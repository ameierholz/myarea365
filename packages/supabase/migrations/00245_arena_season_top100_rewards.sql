-- 00245: Arena Top-100-Rewards (Diamanten + Siegel) + finalize-Wrapper
--
-- arena_season_end() vergab bislang nur Prestige + Titel. Damit das im
-- Currency-Guide versprochene "Top-100-Saison-Belohnung" real wird, kommt
-- ein zusätzlicher Reward-Layer dazu. Wir packen das in eine neue Funktion
-- `arena_season_finalize()`, die end + Reward in einem Schritt macht
-- (atomar pro Saison, weil end() die user_prestige-Tabelle füllt, aus
-- der wir dann unmittelbar Top-100 lesen).
--
-- Reward-Tabelle (pro abgeschlossener Saison, einmalig):
--   Rang 1     → 500 💎 + 50 Siegel-Universal + Champion-Titel (Titel bleibt aus end())
--   Rang 2-3   → 300 💎 + 25 Siegel-Universal
--   Rang 4-10  → 150 💎 + 10 Siegel-Universal
--   Rang 11-50 →  50 💎 +  3 Siegel-Universal
--   Rang 51-100→  20 💎 +  1 Siegel-Universal

create or replace function public.arena_season_finalize()
returns jsonb
language plpgsql security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_end_result   jsonb;
  v_season_id    uuid;
  v_top1         int := 0;
  v_top3         int := 0;
  v_top10        int := 0;
  v_top50        int := 0;
  v_top100       int := 0;
  v_total_gems   bigint := 0;
  v_total_siegel bigint := 0;
  r              record;
  v_gems         int;
  v_siegel       int;
begin
  -- 1) end() — schreibt user_prestige für die soeben beendete Saison
  v_end_result := public.arena_season_end();
  if not coalesce((v_end_result->>'ok')::bool, false) then
    return v_end_result;
  end if;
  v_season_id := (v_end_result->>'season_id')::uuid;

  -- 2) Top-100 aus user_prestige lesen + Reward verteilen
  for r in
    select user_id, final_rank
      from public.user_prestige
     where season_id = v_season_id and final_rank <= 100
     order by final_rank asc
  loop
    if r.final_rank = 1        then v_gems := 500; v_siegel := 50; v_top1 := v_top1 + 1;
    elsif r.final_rank <= 3    then v_gems := 300; v_siegel := 25; v_top3 := v_top3 + 1;
    elsif r.final_rank <= 10   then v_gems := 150; v_siegel := 10; v_top10 := v_top10 + 1;
    elsif r.final_rank <= 50   then v_gems :=  50; v_siegel :=  3; v_top50 := v_top50 + 1;
    elsif r.final_rank <= 100  then v_gems :=  20; v_siegel :=  1; v_top100 := v_top100 + 1;
    else continue;
    end if;

    insert into public.user_gems (user_id, gems)
      values (r.user_id, v_gems)
    on conflict (user_id) do update
      set gems = public.user_gems.gems + v_gems,
          updated_at = now();

    insert into public.user_siegel (user_id, siegel_universal)
      values (r.user_id, v_siegel)
    on conflict (user_id) do update
      set siegel_universal = coalesce(public.user_siegel.siegel_universal, 0) + v_siegel,
          updated_at = now();

    v_total_gems   := v_total_gems   + v_gems;
    v_total_siegel := v_total_siegel + v_siegel;
  end loop;

  return jsonb_build_object(
    'ok', true,
    'season_id', v_season_id,
    'ended', v_end_result,
    'top1', v_top1, 'top3', v_top3, 'top10', v_top10,
    'top50', v_top50, 'top100', v_top100,
    'total_gems', v_total_gems,
    'total_siegel_universal', v_total_siegel
  );
end $$;

grant execute on function public.arena_season_finalize() to service_role;

comment on function public.arena_season_finalize() is
  'Wrapper um arena_season_end() + Top-100-Reward-Verteilung (Diamanten + Siegel-Universal). Cron-getriggert monatlich.';
