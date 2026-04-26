-- ══════════════════════════════════════════════════════════════════════════
-- BASE-EXTENSION: 4 weitere Solo-Buildings + Auto-Grant Starter-Set
-- ══════════════════════════════════════════════════════════════════════════
-- - 4 neue Solo-Buildings (Lager, Schmiede, Gasthaus, Wachturm)
-- - get_or_create_base() vergibt jetzt alle 8 Solo-Buildings auf Lv1 kostenlos
--   beim ersten Aufruf → Base sieht sofort populated aus statt leer
-- ══════════════════════════════════════════════════════════════════════════

-- ─── 1) 4 neue Solo-Buildings ─────────────────────────────────────────────
insert into public.buildings_catalog
  (id, name, emoji, description, category, scope, max_level,
   base_cost_wood, base_cost_stone, base_cost_gold, base_cost_mana,
   base_buildtime_minutes, effect_key, effect_per_level, required_base_level, sort)
values
  ('lagerhalle',    'Lagerhalle',    '📦', 'Erhöht das Lager-Limit für Holz und Stein zusätzlich.',  'storage',    'solo', 10,
   120,  80,   0,   0, 5, 'storage_wood_stone_pct', 0.15, 1, 5),
  ('schmiede',      'Schmiede',      '🔨', 'Reduziert Bauzeit aller Solo-Gebäude.',                  'utility',    'solo', 10,
   100, 150,  20,   0, 8, 'buildtime_pct',          0.05, 2, 6),
  ('gasthaus',      'Gasthaus',      '🍺', 'Tägliche XP-Bonus-Truhe + +5% Crew-Beitrag pro Stufe.',  'production', 'solo', 10,
   180,  80,  30,  10, 10, 'gasthaus_bonus_pct',    0.05, 2, 7),
  ('wachturm',      'Wachturm',      '🗼', 'Bonus-Verteidigung gegen Crew-Raids + sieht Anstürme früher.','combat','solo', 10,
   150, 200,  40,   0, 12, 'defense_pct',            0.10, 3, 8)
on conflict (id) do update set
  name = excluded.name, emoji = excluded.emoji, description = excluded.description,
  category = excluded.category, scope = excluded.scope, max_level = excluded.max_level,
  base_cost_wood = excluded.base_cost_wood, base_cost_stone = excluded.base_cost_stone,
  base_cost_gold = excluded.base_cost_gold, base_cost_mana = excluded.base_cost_mana,
  base_buildtime_minutes = excluded.base_buildtime_minutes,
  effect_key = excluded.effect_key, effect_per_level = excluded.effect_per_level,
  required_base_level = excluded.required_base_level, sort = excluded.sort;

-- ─── 2) get_or_create_base() — auto-seed aller required_base_level=1 Buildings ─
create or replace function public.get_or_create_base()
returns uuid language plpgsql security definer as $$
declare
  v_user uuid := auth.uid();
  v_plz  text;
  v_base uuid;
begin
  if v_user is null then raise exception 'not_authenticated'; end if;
  select id into v_base from public.bases where owner_user_id = v_user;
  if v_base is not null then return v_base; end if;

  select heimat_plz into v_plz from public.users where id = v_user;
  if v_plz is null then v_plz := '00000'; end if;

  insert into public.bases (owner_user_id, plz) values (v_user, v_plz) returning id into v_base;
  insert into public.user_resources (user_id) values (v_user) on conflict do nothing;
  insert into public.vip_progress    (user_id) values (v_user) on conflict do nothing;

  -- Starter-Set: alle Solo-Buildings mit required_base_level = 1 auf Lv1 kostenlos
  -- → Base sieht sofort populated aus, User kann mit Upgrades anfangen
  insert into public.base_buildings (base_id, building_id, position_x, position_y, level, status)
  select v_base, c.id, 0, 0, 1, 'idle'
    from public.buildings_catalog c
   where c.scope = 'solo' and c.required_base_level = 1
  on conflict (base_id, building_id) do nothing;

  return v_base;
end $$;

revoke all on function public.get_or_create_base() from public;
grant execute on function public.get_or_create_base() to authenticated;

-- ─── 3) Backfill: bestehende leere Bases bekommen Starter-Set nachträglich ─
insert into public.base_buildings (base_id, building_id, position_x, position_y, level, status)
select b.id, c.id, 0, 0, 1, 'idle'
  from public.bases b
  cross join public.buildings_catalog c
 where c.scope = 'solo'
   and c.required_base_level = 1
   and not exists (select 1 from public.base_buildings bb where bb.base_id = b.id and bb.building_id = c.id)
on conflict (base_id, building_id) do nothing;
