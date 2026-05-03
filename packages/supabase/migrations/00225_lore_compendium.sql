-- 00225_lore_compendium.sql
-- Lore-Pieces / Sets — User findet Pieces (geo-spawn später dynamisch),
-- Set vervollständigt → Reward via Inbox / grant_inventory_item.
-- Initial-Seeds nutzen Berlin-Koordinaten als Platzhalter; später dynamisch.

create table if not exists public.lore_sets (
  id              text primary key,
  name            text not null,
  description     text,
  reward_payload  jsonb not null default '{}'::jsonb,
  sort_order      int default 0,
  active          boolean default true
);

create table if not exists public.lore_pieces (
  id          text primary key,
  set_id      text not null references public.lore_sets(id) on delete cascade,
  name        text not null,
  description text,
  lat         double precision,
  lng         double precision,
  sort_order  int default 0
);

create table if not exists public.user_lore_pieces (
  user_id   uuid not null references public.users(id) on delete cascade,
  piece_id  text not null references public.lore_pieces(id) on delete cascade,
  found_at  timestamptz not null default now(),
  primary key (user_id, piece_id)
);

create table if not exists public.user_lore_sets_claimed (
  user_id     uuid not null references public.users(id) on delete cascade,
  set_id      text not null references public.lore_sets(id) on delete cascade,
  claimed_at  timestamptz not null default now(),
  primary key (user_id, set_id)
);

alter table public.lore_sets enable row level security;
alter table public.lore_pieces enable row level security;
alter table public.user_lore_pieces enable row level security;
alter table public.user_lore_sets_claimed enable row level security;

drop policy if exists "lore_sets_read_all" on public.lore_sets;
create policy "lore_sets_read_all" on public.lore_sets for select using (true);
drop policy if exists "lore_pieces_read_all" on public.lore_pieces;
create policy "lore_pieces_read_all" on public.lore_pieces for select using (true);
drop policy if exists "user_lore_pieces_self" on public.user_lore_pieces;
create policy "user_lore_pieces_self" on public.user_lore_pieces for select using (user_id = auth.uid());
drop policy if exists "user_lore_sets_claimed_self" on public.user_lore_sets_claimed;
create policy "user_lore_sets_claimed_self" on public.user_lore_sets_claimed for select using (user_id = auth.uid());

create or replace function public.pickup_lore_piece(p_piece_id text)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_set text;
  v_total int;
  v_found int;
begin
  if v_uid is null then raise exception 'unauthorized'; end if;
  select set_id into v_set from public.lore_pieces where id = p_piece_id;
  if v_set is null then raise exception 'piece_not_found'; end if;

  insert into public.user_lore_pieces (user_id, piece_id) values (v_uid, p_piece_id)
  on conflict do nothing;

  select count(*) into v_total from public.lore_pieces where set_id = v_set;
  select count(*) into v_found from public.user_lore_pieces ulp
    join public.lore_pieces lp on lp.id = ulp.piece_id
    where ulp.user_id = v_uid and lp.set_id = v_set;

  return jsonb_build_object('ok', true, 'set_id', v_set, 'found', v_found, 'total', v_total,
                            'set_complete', v_found >= v_total);
end;
$$;

create or replace function public.claim_lore_set(p_set_id text)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_set public.lore_sets%rowtype;
  v_total int;
  v_found int;
  v_gems int;
  v_items jsonb;
  v_item jsonb;
begin
  if v_uid is null then raise exception 'unauthorized'; end if;
  select * into v_set from public.lore_sets where id = p_set_id;
  if not found then raise exception 'set_not_found'; end if;

  if exists(select 1 from public.user_lore_sets_claimed where user_id=v_uid and set_id=p_set_id) then
    return jsonb_build_object('ok', false, 'error', 'already_claimed');
  end if;

  select count(*) into v_total from public.lore_pieces where set_id = p_set_id;
  select count(*) into v_found from public.user_lore_pieces ulp
    join public.lore_pieces lp on lp.id = ulp.piece_id
    where ulp.user_id = v_uid and lp.set_id = p_set_id;

  if v_found < v_total then
    return jsonb_build_object('ok', false, 'error', 'set_incomplete', 'found', v_found, 'total', v_total);
  end if;

  insert into public.user_lore_sets_claimed (user_id, set_id) values (v_uid, p_set_id);

  v_gems := coalesce((v_set.reward_payload->>'gems')::int, 0);
  if v_gems > 0 then
    insert into public.user_gems (user_id, gems) values (v_uid, v_gems)
    on conflict (user_id) do update set gems = user_gems.gems + v_gems, updated_at = now();
    insert into public.gem_transactions (user_id, delta, reason, metadata)
    values (v_uid, v_gems, 'lore_set', jsonb_build_object('set_id', p_set_id));
  end if;

  v_items := coalesce(v_set.reward_payload->'items', '[]'::jsonb);
  for v_item in select * from jsonb_array_elements(v_items) loop
    perform public.grant_inventory_item(v_uid, v_item->>'catalog_id', coalesce((v_item->>'count')::int, 1));
  end loop;

  insert into public.user_inbox (user_id, title, body, category, kind, payload, reward_payload, from_label)
  values (v_uid, 'Lore-Set vollendet: '||v_set.name, coalesce(v_set.description, ''),
          'reward', 'lore_set', v_set.reward_payload, v_set.reward_payload, 'Chronist');

  return jsonb_build_object('ok', true, 'reward', v_set.reward_payload);
end;
$$;

revoke all on function public.pickup_lore_piece(text) from public;
revoke all on function public.claim_lore_set(text) from public;
grant execute on function public.pickup_lore_piece(text) to authenticated;
grant execute on function public.claim_lore_set(text) to authenticated;

-- ── Seeds: 3 Sets à 5 Pieces (Platzhalter-Koordinaten Berlin)
insert into public.lore_sets (id, name, description, reward_payload, sort_order) values
  ('chronicles', 'Wächter-Chroniken', 'Sammle die fünf Tafeln der ersten Wächter.',
    jsonb_build_object('gems', 200, 'items', jsonb_build_array(jsonb_build_object('catalog_id', 'chest_gold', 'count', 1))), 10),
  ('letters',    'Verlorene Briefe', 'Fünf Briefe aus einer vergessenen Zeit.',
    jsonb_build_object('gems', 150, 'items', jsonb_build_array(jsonb_build_object('catalog_id', 'chest_silver', 'count', 2))), 20),
  ('relics',     'Reliquien',        'Fünf Reliquien — verstreut in der Stadt.',
    jsonb_build_object('gems', 300, 'items', jsonb_build_array(jsonb_build_object('catalog_id', 'chest_legendary', 'count', 1))), 30)
on conflict (id) do nothing;

insert into public.lore_pieces (id, set_id, name, description, lat, lng, sort_order) values
  ('chronicles_1','chronicles','Tafel I',  'Die erste Wache stand am Tor.',           52.5200, 13.4050, 1),
  ('chronicles_2','chronicles','Tafel II', 'Drei Eide und ein gebrochenes Schwert.',  52.5210, 13.4060, 2),
  ('chronicles_3','chronicles','Tafel III','Der Pakt mit den Schatten.',              52.5220, 13.4070, 3),
  ('chronicles_4','chronicles','Tafel IV', 'Die Nacht der langen Klingen.',           52.5230, 13.4080, 4),
  ('chronicles_5','chronicles','Tafel V',  'Was übrig blieb.',                        52.5240, 13.4090, 5),
  ('letters_1','letters','Brief I',  'Mein Liebster, falls du das findest…',  52.5100, 13.3900, 1),
  ('letters_2','letters','Brief II', 'Sie wissen, wo wir sind.',              52.5110, 13.3910, 2),
  ('letters_3','letters','Brief III','Triff mich an der alten Brücke.',       52.5120, 13.3920, 3),
  ('letters_4','letters','Brief IV', 'Vertraue niemandem, auch mir nicht.',   52.5130, 13.3930, 4),
  ('letters_5','letters','Brief V',  'Es ist vorbei.',                        52.5140, 13.3940, 5),
  ('relics_1','relics','Reliquie I',  'Ein zerbrochener Anhänger.',           52.5300, 13.4200, 1),
  ('relics_2','relics','Reliquie II', 'Eine Münze unbekannten Reichs.',       52.5310, 13.4210, 2),
  ('relics_3','relics','Reliquie III','Ein Stück Knochen, fein graviert.',    52.5320, 13.4220, 3),
  ('relics_4','relics','Reliquie IV', 'Eine Klinge, die nicht rostet.',       52.5330, 13.4230, 4),
  ('relics_5','relics','Reliquie V',  'Das Auge.',                            52.5340, 13.4240, 5)
on conflict (id) do nothing;

comment on table public.lore_pieces is 'Lore-Pieces. lat/lng werden zukünftig dynamisch beim Bewegen des Spielers re-spawnt; aktuelle Werte sind Berlin-Platzhalter.';
