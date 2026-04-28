-- ════════════════════════════════════════════════════════════════════
-- COMBAT REBALANCE — CoD-Stil Stats + 200-Cap + March-Capacity-System
-- ════════════════════════════════════════════════════════════════════
-- Setzt das ganze Combat-System auf urbane Kiez-Skala um:
--
--   • Truppen-Stats nach CoD-T4-Werten (ATK 190-340, HP 167-233)
--     Tier-Skalierung: T1=30% · T2=50% · T3=75% · T4=100% · T5=130%
--   • Max 200 pro troop_id (was du BESITZEN kannst)
--   • March-Capacity = was du PRO Angriff schicken kannst (Burg-Level-abhängig)
--   • March-Queue = parallele aktive Marches (1-5)
--   • Repeater + Player-Base-HP angepasst auf neue ATK-Skala
--   • Costs runter-skaliert (200×T1 = 5k Gold, nicht 100k)
--
-- Klassen-Mapping zu CoD-Archetypen:
--   Türsteher    = Infantry (Tank)            — hohe Def/HP, niedrige ATK
--   Kuriere      = Cavalry  (Mobile)          — hohe ATK + Speed
--   Schleuderer  = Archers  (DPS)             — höchste ATK, niedrige Def
--   Brecher      = Wyvern   (Heavy/Anti-Bldg) — anti-Strukturen-Spezialist
-- ════════════════════════════════════════════════════════════════════

-- ─── 1) Truppen-Stats updaten (Set D × CoD-T4-Werte × Tier-Skala) ──
do $$
declare
  -- T4-Basiswerte pro Klasse (CoD-Referenz)
  v_stats jsonb := '{
    "infantry": { "atk": 192, "def": 203, "hp": 233 },
    "cavalry":  { "atk": 330, "def": 162, "hp": 199 },
    "marksman": { "atk": 341, "def": 148, "hp": 183 },
    "siege":    { "atk": 297, "def": 148, "hp": 183 }
  }'::jsonb;
  -- Tier-Multiplikator (% von T4)
  v_mult jsonb := '{"1":0.30, "2":0.50, "3":0.75, "4":1.00, "5":1.30}'::jsonb;
  r record;
  v_atk int; v_def int; v_hp int; v_mul numeric;
  v_cls jsonb;
begin
  for r in select id, troop_class, tier from public.troops_catalog loop
    v_cls := v_stats -> r.troop_class;
    v_mul := (v_mult ->> r.tier::text)::numeric;
    if v_cls is null or v_mul is null then continue; end if;
    v_atk := round((v_cls->>'atk')::int * v_mul);
    v_def := round((v_cls->>'def')::int * v_mul);
    v_hp  := round((v_cls->>'hp')::int  * v_mul);
    update public.troops_catalog
       set base_atk = v_atk,
           base_def = v_def,
           base_hp  = v_hp,
           -- Costs: T1 = 5 gold, T5 = 65 gold (linear via mult)
           cost_gold       = round(50 * v_mul),
           cost_wood       = round(25 * v_mul),
           cost_stone      = round(15 * v_mul),
           cost_mana       = round(10 * v_mul),
           train_time_seconds = round(60 * v_mul)
     where id = r.id;
  end loop;
end $$;

-- ─── 2) Truppen-Bestand auf 200 pro Troop-ID cappen ─────────────────
update public.user_troops set count = least(count, 200) where count > 200;
update public.crew_troops  set count = least(count, 1000) where count > 1000;  -- Crew-Pool darf 5× sein

-- ─── 3) RSS-Cap auf vernünftige Werte (50k pro Resource) ────────────
update public.user_resources set
  wood  = least(coalesce(wood,  0), 50000),
  stone = least(coalesce(stone, 0), 50000),
  gold  = least(coalesce(gold,  0), 50000),
  mana  = least(coalesce(mana,  0), 10000);

-- ─── 4) Repeater-HP skalieren (passt zu ~50k-ATK pro Solo-Angriff) ──
-- Formel: greatest(min, current * faktor) — bestehende skaliert, neue kommen über _repeater_kind_stats
create or replace function public._repeater_kind_stats(p_kind text)
returns table(max_hp int, cost_gold int, cost_wood int, cost_stone int, build_shield_s int)
language sql immutable as $$
  select t.max_hp, t.cost_gold, t.cost_wood, t.cost_stone, t.build_shield_s
    from (values
      ('hq',       150000, 5000, 2000, 2000, 1800),
      ('repeater',  30000,  500,  500,  500,  600),
      ('mega',      80000, 2000, 1000, 1500, 1200)
    ) as t(kind, max_hp, cost_gold, cost_wood, cost_stone, build_shield_s)
   where t.kind = p_kind;
$$;

-- bestehende lebende Repeater hochskalieren (HP × 10)
update public.crew_repeaters set
  max_hp = case kind
    when 'hq'       then 150000
    when 'mega'     then  80000
    when 'repeater' then  30000
    else max_hp end,
  hp = case kind
    when 'hq'       then least(hp * 10, 150000)
    when 'mega'     then least(hp * 10,  80000)
    when 'repeater' then least(hp * 10,  30000)
    else hp end
where destroyed_at is null;

-- ─── 5) Player-Base-HP skalieren (300k Standard für Stufe 20) ──────
-- bases.max_hp wird vermutlich pro level berechnet, hier setzen wir die
-- aktuellen lebenden Bases auf neue Skala (10× weil ATK-Werte steigen)
update public.bases set
  max_hp     = greatest(max_hp     * 10, 50000),
  current_hp = greatest(current_hp * 10, 50000);

-- ─── 6) March-Capacity-System ───────────────────────────────────────
-- Wieviele Truppen kann ein Spieler PRO ANGRIFF schicken (statt was er besitzt)
create or replace function public.get_march_caps(p_user_id uuid default auth.uid())
returns table(march_capacity int, march_queue int, burg_level int, guardian_bonus_pct numeric)
language plpgsql security definer as $$
declare
  v_burg int := 1;
  v_cap  int;
  v_q    int;
  v_g_bonus numeric := 0;
  v_max_g_lvl int;
begin
  -- Burg-Level aus base_buildings (Burg-Building) holen
  select coalesce(max(bb.level), 1) into v_burg
    from public.bases b
    join public.base_buildings bb on bb.base_id = b.id
   where b.owner_user_id = p_user_id and bb.building_id = 'burg';

  -- March-Capacity nach Burg-Level
  v_cap := case
    when v_burg >= 22 then 200
    when v_burg >= 17 then 150
    when v_burg >= 11 then 100
    when v_burg >=  4 then  60
    else                    30
  end;

  -- Queue-Slots
  v_q := case
    when v_burg >= 22 then 5
    when v_burg >= 17 then 4
    when v_burg >= 11 then 3
    when v_burg >=  4 then 2
    else                   1
  end;

  -- Wächter-Bonus: stärkster aktiver Wächter, +2% pro Level
  select max(level) into v_max_g_lvl
    from public.user_guardians
   where user_id = p_user_id and is_active = true;
  if v_max_g_lvl is not null then
    v_g_bonus := least(60, v_max_g_lvl * 2);  -- max +60% bei Lv 30+
  end if;

  return query select
    (v_cap + (v_cap * v_g_bonus / 100))::int as march_capacity,
    v_q as march_queue,
    v_burg as burg_level,
    v_g_bonus as guardian_bonus_pct;
end $$;

revoke all on function public.get_march_caps(uuid) from public;
grant execute on function public.get_march_caps(uuid) to authenticated;

-- ─── 7) Helper: aktive Marches eines Users zählen ───────────────────
create or replace function public.count_active_marches(p_user_id uuid default auth.uid())
returns int language sql stable security definer as $$
  select
    coalesce((select count(*) from public.player_base_attacks where attacker_user_id = p_user_id and resolved_at is null), 0) +
    coalesce((select count(*) from public.crew_repeater_attacks where attacker_user_id = p_user_id and status = 'marching'), 0) +
    coalesce((select count(*) from public.player_base_rallies where leader_user_id = p_user_id and status in ('preparing','marching','fighting')), 0) +
    coalesce((select count(*) from public.crew_repeater_rallies where leader_user_id = p_user_id and status in ('preparing','marching','fighting')), 0);
$$;
grant execute on function public.count_active_marches(uuid) to authenticated;
