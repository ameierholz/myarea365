-- ══════════════════════════════════════════════════════════════════════════
-- BURG-LEVEL-REQUIREMENTS — adaptiert nach RoK-Style City-Hall-Schema
-- ══════════════════════════════════════════════════════════════════════════
-- Burg ersetzt das alte XP-basierte bases.level-System.
-- Jede Burg-Stufe braucht spezifische Gebäude auf bestimmten Leveln.
-- Plus: Bauslots skalieren mit Burg-Level (zusätzlich zu VIP).
-- ══════════════════════════════════════════════════════════════════════════

-- ─── 1) Burg-Cost-Curve schärfer + Cap höher ──────────────────────────────
-- Vorher: base_cost 500/700/100/50, growth 1.55, time-cap 1440 min.
-- Jetzt: höhere Basis + steilere Kurve + Cap auf 14 Tage hoch.
update public.buildings_catalog set
  base_cost_wood          = 3500,
  base_cost_stone         = 0,
  base_cost_gold          = 3500,
  base_cost_mana          = 0,
  base_buildtime_minutes  = 1,
  buildtime_growth        = 1.85,
  description             = 'Hauptgebäude. Begrenzt das Maximal-Level aller anderen Gebäude. Höhere Stufen brauchen spezifische andere Gebäude als Bedingung. Bis Stufe 25 ausbaubar.'
where id = 'burg';

-- ─── 2) Wichtige Gating-Gebäude auf max_level 25 hochziehen ───────────────
update public.buildings_catalog set max_level = 25
 where id in (
   'stadtmauer',          -- "Wall"
   'lagerhalle',          -- "Storehouse"
   'wegekasse',           -- "Mint" (Gold-Storage)
   'wald_pfad',           -- "Lumber Mill"
   'akademie',            -- "College of Order" (Forschung)
   'mana_quelle',         -- "Mana Refinery"
   'kloster',             -- "Abbey"
   'wachturm',            -- "Scout Camp"
   'basar',               -- "Bazaar"
   'gasthaus'             -- für Forschung/Bonus
 );
-- Diese sind schon 25: kaserne, stall, schiessstand, belagerungsschuppen, bergfried.

-- ─── 3) Burg-Level-Requirements-Tabelle ───────────────────────────────────
create table if not exists public.burg_level_requirements (
  burg_level     int  not null check (burg_level between 2 and 25),
  building_id    text not null references public.buildings_catalog(id) on delete cascade,
  required_level int  not null check (required_level >= 1),
  primary key (burg_level, building_id)
);

alter table public.burg_level_requirements enable row level security;
do $$ begin
  if not exists (select 1 from pg_policies where tablename='burg_level_requirements' and policyname='select_all') then
    create policy select_all on public.burg_level_requirements for select using (true);
  end if;
end $$;
grant select on public.burg_level_requirements to anon, authenticated;

-- ─── 4) Seed: Requirements pro Burg-Stufe ─────────────────────────────────
delete from public.burg_level_requirements;
insert into public.burg_level_requirements (burg_level, building_id, required_level) values
  -- Lv 2-3: keine Requirements (frei aufstockbar nach Platzieren)
  -- Lv 4 (Village): Stadtmauer 3
  (4,  'stadtmauer', 3),
  -- Lv 5: Stadtmauer 4 + Wegekasse (Mint) 4
  (5,  'stadtmauer', 4), (5,  'wegekasse', 4),
  -- Lv 6: Stadtmauer 5 + Wachturm (Scout Camp) 5
  (6,  'stadtmauer', 5), (6,  'wachturm', 5),
  -- Lv 7: Stadtmauer 6 + Kaserne (Swordsmen Camp) 6
  (7,  'stadtmauer', 6), (7,  'kaserne', 6),
  -- Lv 8: Stadtmauer 7 + Allianz-Zentrum (Alliance Center) 7
  (8,  'stadtmauer', 7), (8,  'allianz_zentrum', 7),
  -- Lv 9: Stadtmauer 8 + Wald-Pfad (Lumber Mill) 8
  (9,  'stadtmauer', 8), (9,  'wald_pfad', 8),
  -- Lv 10 (Town): Stadtmauer 9 + Akademie (College) 9
  (10, 'stadtmauer', 9), (10, 'akademie', 9),
  -- Lv 11: Stadtmauer 10 + Belagerungs-Schuppen (Ballista) 10 + Wald-Pfad 10
  (11, 'stadtmauer', 10), (11, 'belagerungsschuppen', 10), (11, 'wald_pfad', 10),
  -- Lv 12: Stadtmauer 11 + Wachturm 11
  (12, 'stadtmauer', 11), (12, 'wachturm', 11),
  -- Lv 13: Stadtmauer 12 + Allianz-Zentrum 12
  (13, 'stadtmauer', 12), (13, 'allianz_zentrum', 12),
  -- Lv 14: Stadtmauer 13 + Mana-Quelle (Mana Refinery) 13
  (14, 'stadtmauer', 13), (14, 'mana_quelle', 13),
  -- Lv 15: Stadtmauer 14 + Lagerhalle (Storehouse) 14
  (15, 'stadtmauer', 14), (15, 'lagerhalle', 14),
  -- Lv 16 (Citadel): Stadtmauer 15 + Akademie 15
  (16, 'stadtmauer', 15), (16, 'akademie', 15),
  -- Lv 17: Stadtmauer 16 + Kloster (Abbey) 16
  (17, 'stadtmauer', 16), (17, 'kloster', 16),
  -- Lv 18: Stadtmauer 17 + Wachturm 17
  (18, 'stadtmauer', 17), (18, 'wachturm', 17),
  -- Lv 19: Stadtmauer 18 + Lagerhalle 18
  (19, 'stadtmauer', 18), (19, 'lagerhalle', 18),
  -- Lv 20: Stadtmauer 19 + Allianz-Zentrum 19
  (20, 'stadtmauer', 19), (20, 'allianz_zentrum', 19),
  -- Lv 21 (Metropolis): Stadtmauer 20 + Basar (Bazaar) 20
  (21, 'stadtmauer', 20), (21, 'basar', 20),
  -- Lv 22: Stadtmauer 21 + Stall (Knight Camp) 21
  (22, 'stadtmauer', 21), (22, 'stall', 21),
  -- Lv 23: Stadtmauer 22 + Akademie 22
  (23, 'stadtmauer', 22), (23, 'akademie', 22),
  -- Lv 24: Stadtmauer 23 + Bergfried (Celestial Temple Solo-Pendant) 10
  (24, 'stadtmauer', 23), (24, 'bergfried', 10),
  -- Lv 25: Stadtmauer 24 + Basar 24 (Endgame)
  (25, 'stadtmauer', 24), (25, 'basar', 24);

-- ─── 5) Helper: get_burg_requirements_for_level(level) ────────────────────
create or replace function public.get_burg_requirements_for_level(p_level int)
returns jsonb language sql security definer as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'building_id', r.building_id,
    'name',        c.name,
    'emoji',       c.emoji,
    'required_level', r.required_level
  ) order by r.required_level desc), '[]'::jsonb)
  from public.burg_level_requirements r
  join public.buildings_catalog c on c.id = r.building_id
  where r.burg_level = p_level;
$$;
revoke all on function public.get_burg_requirements_for_level(int) from public;
grant execute on function public.get_burg_requirements_for_level(int) to authenticated;

-- ─── 6) start_building: Burg-Upgrade prüft requirements ───────────────────
-- Plus: extra-Bauslots aus Burg-Level. Total slots = 1 + max(vip, burg).
drop function if exists public.start_building(text, int, int);
create or replace function public.start_building(p_building_id text, p_position_x int, p_position_y int)
returns jsonb language plpgsql security definer as $$
declare
  v_user uuid := auth.uid();
  v_base_id uuid;
  v_cat record;
  v_existing record;
  v_action text;
  v_target_level int;
  v_cost_mult numeric;
  v_cost_w int; v_cost_s int; v_cost_g int; v_cost_m int;
  v_resources record;
  v_buildtime_min int;
  v_vip_speed numeric := 0;
  v_extra_slots_vip int := 0;
  v_burg_level int := 0;
  v_extra_slots_burg int := 0;
  v_total_slots int;
  v_active_count int;
  v_unmet jsonb;
begin
  if v_user is null then raise exception 'not_authenticated'; end if;
  select id into v_base_id from public.bases where owner_user_id = v_user;
  if v_base_id is null then v_base_id := public.get_or_create_base(); end if;

  select * into v_cat from public.buildings_catalog where id = p_building_id;
  if v_cat is null then return jsonb_build_object('ok', false, 'error', 'building_not_found'); end if;

  select coalesce(level, 0) into v_burg_level
    from public.base_buildings where base_id = v_base_id and building_id = 'burg';

  select * into v_existing from public.base_buildings
    where base_id = v_base_id and building_id = p_building_id;

  if v_existing is null then
    v_action := 'build';
    v_target_level := 1;
    v_cost_mult := 1.0;
  else
    if v_existing.level >= v_cat.max_level then
      return jsonb_build_object('ok', false, 'error', 'max_level_reached');
    end if;
    if v_existing.status <> 'idle' then
      return jsonb_build_object('ok', false, 'error', 'already_in_progress');
    end if;
    v_action := 'upgrade';
    v_target_level := v_existing.level + 1;
    v_cost_mult := power(1.6, v_existing.level);
  end if;

  -- Burg-Cap: Nicht-Burg-Gebäude dürfen Burg-Level nicht überschreiten.
  if p_building_id <> 'burg' and v_target_level > greatest(v_burg_level, 1) then
    return jsonb_build_object('ok', false, 'error', 'burg_level_too_low',
      'burg_level', v_burg_level, 'needed', v_target_level);
  end if;

  -- Burg-Upgrade: Building-Requirements prüfen.
  if p_building_id = 'burg' and v_target_level >= 2 then
    select coalesce(jsonb_agg(jsonb_build_object(
      'building_id', r.building_id,
      'name',        c.name,
      'required_level', r.required_level,
      'have_level',  coalesce(bb.level, 0)
    )), '[]'::jsonb)
      into v_unmet
      from public.burg_level_requirements r
      join public.buildings_catalog c on c.id = r.building_id
      left join public.base_buildings bb on bb.base_id = v_base_id and bb.building_id = r.building_id
     where r.burg_level = v_target_level
       and coalesce(bb.level, 0) < r.required_level;
    if jsonb_array_length(v_unmet) > 0 then
      return jsonb_build_object('ok', false, 'error', 'burg_requirements_unmet',
        'target_level', v_target_level, 'unmet', v_unmet);
    end if;
  end if;

  v_cost_w := round(v_cat.base_cost_wood  * v_cost_mult);
  v_cost_s := round(v_cat.base_cost_stone * v_cost_mult);
  v_cost_g := round(v_cat.base_cost_gold  * v_cost_mult);
  v_cost_m := round(v_cat.base_cost_mana  * v_cost_mult);

  -- Bauslot-Check: 1 Basis + max(vip_extra, burg_extra)
  select coalesce(t.extra_build_slots, 0) into v_extra_slots_vip
    from public.vip_progress p left join public.vip_tier_thresholds t on t.vip_level = p.vip_level
   where p.user_id = v_user;
  -- Burg-Level → +1 Slot bei Lv 4, +2 bei Lv 11, +3 bei Lv 17, +4 bei Lv 22
  v_extra_slots_burg := case
    when v_burg_level >= 22 then 4
    when v_burg_level >= 17 then 3
    when v_burg_level >= 11 then 2
    when v_burg_level >=  4 then 1
    else 0 end;
  v_total_slots := 1 + greatest(v_extra_slots_vip, v_extra_slots_burg);

  select count(*) into v_active_count
    from public.building_queue
   where base_id = v_base_id and not finished;
  if v_active_count >= v_total_slots then
    return jsonb_build_object('ok', false, 'error', 'queue_full',
      'slots', v_total_slots, 'active', v_active_count);
  end if;

  select * into v_resources from public.user_resources where user_id = v_user for update;
  if v_resources.wood < v_cost_w or v_resources.stone < v_cost_s
     or v_resources.gold < v_cost_g or v_resources.mana < v_cost_m then
    return jsonb_build_object('ok', false, 'error', 'not_enough_resources',
      'need', jsonb_build_object('wood', v_cost_w, 'stone', v_cost_s, 'gold', v_cost_g, 'mana', v_cost_m));
  end if;

  update public.user_resources set
    wood = wood - v_cost_w, stone = stone - v_cost_s,
    gold = gold - v_cost_g, mana = mana - v_cost_m, updated_at = now()
  where user_id = v_user;

  -- Bauzeit-Formel: base * growth^(target_level-1), capped 14 Tage.
  select coalesce(t.buildtime_bonus_pct, 0) into v_vip_speed
    from public.vip_progress p left join public.vip_tier_thresholds t on t.vip_level = p.vip_level
   where p.user_id = v_user;
  v_buildtime_min := least(20160,
    greatest(1, round(v_cat.base_buildtime_minutes
                       * power(coalesce(v_cat.buildtime_growth, 1.40), v_target_level - 1)
                       * (1 - coalesce(v_vip_speed, 0)))));

  if v_existing is null then
    insert into public.base_buildings (base_id, building_id, position_x, position_y, level, status)
    values (v_base_id, p_building_id, p_position_x, p_position_y, 0, 'building');
  else
    update public.base_buildings set status = 'upgrading' where id = v_existing.id;
  end if;

  insert into public.building_queue
    (base_id, building_id, action, target_level, ends_at, cost_wood, cost_stone, cost_gold, cost_mana)
  values
    (v_base_id, p_building_id, v_action, v_target_level,
     now() + (v_buildtime_min || ' minutes')::interval,
     v_cost_w, v_cost_s, v_cost_g, v_cost_m);

  return jsonb_build_object('ok', true,
    'action', v_action, 'target_level', v_target_level,
    'buildtime_minutes', v_buildtime_min,
    'cost', jsonb_build_object('wood', v_cost_w, 'stone', v_cost_s, 'gold', v_cost_g, 'mana', v_cost_m));
end $$;
revoke all on function public.start_building(text, int, int) from public;
grant execute on function public.start_building(text, int, int) to authenticated;

-- ─── 7) Hinweis: bases.level/exp werden zu Legacy-Feldern ─────────────────
-- Anzeige der "Base-Stufe" in der UI sollte ab jetzt das BURG-Building-Level
-- nutzen, nicht mehr bases.level (XP-basiert). Das alte Feld wird nicht
-- gelöscht, um keine bestehenden Queries zu brechen.
comment on column public.bases.level is 'DEPRECATED: nutze burg-Building-Level stattdessen';
comment on column public.bases.exp   is 'DEPRECATED: Burg wird gebaut, kein XP mehr';
