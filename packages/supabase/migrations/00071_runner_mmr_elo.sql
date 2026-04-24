-- Elo-basiertes MMR fuer Runner-Fights
-- Jeder Runner hat einen globalen MMR-Wert (Start 1000).
-- Nach jedem Fight wird MMR per Standard-Elo-Formel aktualisiert.
--
-- K-Faktor:
--   games < 30            → K=32 (Kalibrierungsphase)
--   mmr   >= 2000         → K=16 (High-Elo, stabileres Rating)
--   sonst                 → K=24
--
-- Unentschieden gibt es bei Runner-Fights nicht (winner_user_id ist immer gesetzt),
-- Implementierung unterstuetzt aber trotzdem 0.5/0.5 fuer zukuenftige Erweiterungen.

create table if not exists public.runner_mmr (
  user_id    uuid primary key references public.users(id) on delete cascade,
  mmr        int not null default 1000,
  games      int not null default 0,
  wins       int not null default 0,
  losses     int not null default 0,
  peak_mmr   int not null default 1000,
  last_change      int not null default 0,          -- letzte Elo-Aenderung (+/-)
  last_change_at   timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_runner_mmr_mmr on public.runner_mmr(mmr desc);

alter table public.runner_mmr enable row level security;

do $$ begin
  if not exists (select 1 from pg_policies where tablename='runner_mmr' and policyname='rmr_select_all') then
    -- Leaderboard: jeder darf MMR jedes Nutzers lesen
    create policy rmr_select_all on public.runner_mmr for select using (true);
  end if;
end $$;

-- MMR sicherstellen (INSERT on conflict do nothing)
create or replace function public.runner_mmr_ensure(p_user_id uuid)
returns void language sql security definer as $$
  insert into public.runner_mmr (user_id) values (p_user_id)
  on conflict (user_id) do nothing;
$$;

-- Kern: Elo-Update fuer zwei Spieler
-- p_score_winner ∈ {1.0} im Standard-Fall, 0.5 fuer Draw (hier ungenutzt).
create or replace function public.runner_mmr_apply(
  p_winner_id uuid,
  p_loser_id  uuid
) returns void language plpgsql security definer as $$
declare
  v_w_mmr int; v_w_games int;
  v_l_mmr int; v_l_games int;
  v_exp_w numeric; v_exp_l numeric;
  v_k_w int; v_k_l int;
  v_delta_w int; v_delta_l int;
  v_new_w int; v_new_l int;
begin
  if p_winner_id is null or p_loser_id is null or p_winner_id = p_loser_id then
    return;
  end if;

  perform public.runner_mmr_ensure(p_winner_id);
  perform public.runner_mmr_ensure(p_loser_id);

  select mmr, games into v_w_mmr, v_w_games from public.runner_mmr where user_id = p_winner_id for update;
  select mmr, games into v_l_mmr, v_l_games from public.runner_mmr where user_id = p_loser_id  for update;

  -- Expected Score
  v_exp_w := 1.0 / (1.0 + power(10.0, (v_l_mmr - v_w_mmr)::numeric / 400.0));
  v_exp_l := 1.0 - v_exp_w;

  -- K-Faktoren
  v_k_w := case when v_w_games < 30 then 32 when v_w_mmr >= 2000 then 16 else 24 end;
  v_k_l := case when v_l_games < 30 then 32 when v_l_mmr >= 2000 then 16 else 24 end;

  v_delta_w := round(v_k_w * (1.0 - v_exp_w));
  v_delta_l := round(v_k_l * (0.0 - v_exp_l));

  -- MMR darf nicht unter 0 fallen
  v_new_w := greatest(0, v_w_mmr + v_delta_w);
  v_new_l := greatest(0, v_l_mmr + v_delta_l);

  update public.runner_mmr
     set mmr            = v_new_w,
         games          = games + 1,
         wins           = wins  + 1,
         peak_mmr       = greatest(peak_mmr, v_new_w),
         last_change    = v_delta_w,
         last_change_at = now(),
         updated_at     = now()
   where user_id = p_winner_id;

  update public.runner_mmr
     set mmr            = v_new_l,
         games          = games + 1,
         losses         = losses + 1,
         peak_mmr       = greatest(peak_mmr, v_new_l),
         last_change    = v_delta_l,
         last_change_at = now(),
         updated_at     = now()
   where user_id = p_loser_id;
end $$;

grant execute on function public.runner_mmr_ensure(uuid) to authenticated;
-- runner_mmr_apply wird ausschliesslich vom Trigger aufgerufen → kein direkter Grant.

-- Trigger: nach jedem neuen runner_fight MMR aktualisieren
create or replace function public.runner_fights_after_insert_mmr()
returns trigger language plpgsql security definer as $$
declare
  v_loser_id uuid;
begin
  if new.winner_user_id is null then
    return new;
  end if;
  v_loser_id := case
    when new.winner_user_id = new.attacker_id then new.defender_id
    when new.winner_user_id = new.defender_id then new.attacker_id
    else null
  end;
  if v_loser_id is null then
    return new;
  end if;
  perform public.runner_mmr_apply(new.winner_user_id, v_loser_id);
  return new;
end $$;

drop trigger if exists trg_runner_fights_mmr on public.runner_fights;
create trigger trg_runner_fights_mmr
  after insert on public.runner_fights
  for each row execute function public.runner_fights_after_insert_mmr();

-- Backfill: alle bestehenden Fights chronologisch durchrechnen
do $$
declare
  r record;
  v_loser uuid;
begin
  -- Bestehende MMR-Eintraege zuruecksetzen (Backfill sauber)
  update public.runner_mmr set mmr=1000, games=0, wins=0, losses=0, peak_mmr=1000,
         last_change=0, last_change_at=null, updated_at=now();

  for r in
    select id, attacker_id, defender_id, winner_user_id
      from public.runner_fights
     where winner_user_id is not null
     order by created_at asc
  loop
    v_loser := case
      when r.winner_user_id = r.attacker_id then r.defender_id
      when r.winner_user_id = r.defender_id then r.attacker_id
      else null
    end;
    if v_loser is not null then
      perform public.runner_mmr_apply(r.winner_user_id, v_loser);
    end if;
  end loop;
end $$;
