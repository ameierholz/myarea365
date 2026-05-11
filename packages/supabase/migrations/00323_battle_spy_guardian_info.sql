-- 00323_battle_spy_guardian_info.sql
-- Spähung & Schlachtberichte zeigen ab jetzt die Wächter mit Spezial-
-- Fähigkeit (Name + Beschreibung), damit Counter-Play möglich wird.
-- Außerdem: kind/category/subcategory + strukturiertes payload werden
-- jetzt von den RPCs selbst gesetzt (vorher nur Title/Body, kein Renderer).

ALTER TABLE public.player_base_attacks
  ADD COLUMN IF NOT EXISTS attacker_guardian_archetype_id text REFERENCES public.guardian_archetypes(id);

CREATE OR REPLACE FUNCTION public.attack_player_base(
  p_defender_user_id uuid,
  p_troops jsonb
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp
AS $func$
declare
  v_user uuid := auth.uid();
  v_attacker_base record;
  v_defender_base record;
  v_distance_m numeric;
  v_march_seconds int;
  v_total_troops int := 0;
  v_avail int;
  v_attack_id uuid;
  v_atk_guardian_id text;
  k text; v_cnt int;
begin
  if v_user is null then return jsonb_build_object('ok', false, 'error', 'not_authenticated'); end if;
  if v_user = p_defender_user_id then return jsonb_build_object('ok', false, 'error', 'cannot_attack_self'); end if;

  select * into v_attacker_base from public.bases where owner_user_id = v_user;
  if v_attacker_base is null then return jsonb_build_object('ok', false, 'error', 'no_base'); end if;

  select * into v_defender_base from public.bases where owner_user_id = p_defender_user_id;
  if v_defender_base is null then return jsonb_build_object('ok', false, 'error', 'defender_no_base'); end if;

  if v_defender_base.shield_until is not null and v_defender_base.shield_until > now() then
    return jsonb_build_object('ok', false, 'error', 'defender_shielded', 'shield_until', v_defender_base.shield_until);
  end if;

  if exists (
    select 1 from public.player_base_attacks
     where attacker_user_id = v_user and resolved_at is null and ends_at > now()
  ) then
    return jsonb_build_object('ok', false, 'error', 'march_already_active');
  end if;

  v_distance_m := 6371000 * 2 * asin(sqrt(
    power(sin(radians((v_defender_base.lat - v_attacker_base.lat) / 2)), 2) +
    cos(radians(v_attacker_base.lat)) * cos(radians(v_defender_base.lat)) *
    power(sin(radians((v_defender_base.lng - v_attacker_base.lng) / 2)), 2)
  ));

  v_march_seconds := greatest(60, least(1800, ceil(v_distance_m / 50)::int));

  for k, v_cnt in select * from jsonb_each_text(p_troops) loop
    if v_cnt::int <= 0 then continue; end if;
    select count into v_avail from public.user_troops where user_id = v_user and troop_id = k;
    if v_avail is null or v_avail < v_cnt::int then
      return jsonb_build_object('ok', false, 'error', 'not_enough_troops',
        'troop_id', k, 'have', coalesce(v_avail, 0), 'need', v_cnt::int);
    end if;
    v_total_troops := v_total_troops + v_cnt::int;
  end loop;

  if v_total_troops < 10 then
    return jsonb_build_object('ok', false, 'error', 'min_troops_10');
  end if;

  for k, v_cnt in select * from jsonb_each_text(p_troops) loop
    if v_cnt::int <= 0 then continue; end if;
    update public.user_troops set count = count - v_cnt::int
      where user_id = v_user and troop_id = k;
  end loop;

  select archetype_id into v_atk_guardian_id
    from public.user_guardians
   where user_id = v_user and is_active = true
   limit 1;

  insert into public.player_base_attacks (
    attacker_user_id, defender_user_id,
    attacker_lat, attacker_lng, defender_lat, defender_lng,
    troops_committed, ends_at, attacker_guardian_archetype_id
  ) values (
    v_user, p_defender_user_id,
    v_attacker_base.lat, v_attacker_base.lng,
    v_defender_base.lat, v_defender_base.lng,
    p_troops, now() + (v_march_seconds || ' seconds')::interval,
    v_atk_guardian_id
  ) returning id into v_attack_id;

  return jsonb_build_object(
    'ok', true,
    'attack_id', v_attack_id,
    'march_seconds', v_march_seconds,
    'distance_m', round(v_distance_m)::int,
    'ends_at', (now() + (v_march_seconds || ' seconds')::interval)
  );
end $func$;

REVOKE ALL ON FUNCTION public.attack_player_base(uuid, jsonb) FROM public;
GRANT EXECUTE ON FUNCTION public.attack_player_base(uuid, jsonb) TO authenticated;

CREATE OR REPLACE FUNCTION public.resolve_player_base_attack(p_attack_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp
AS $func$
declare
  a record;
  v_atk_power int := 0;
  v_def_power int := 0;
  v_def_base record;
  v_hp_before int := 0;
  v_hp_after int := 0;
  v_dmg int := 0;
  v_outcome text;
  v_loot_pct numeric := 0;
  v_loss_pct_atk numeric := 0;
  v_loss_pct_def numeric := 0;
  v_loot_w int := 0; v_loot_s int := 0;
  v_loot_g int := 0; v_loot_m int := 0;
  v_pillage boolean := false;
  k text; v_cnt int;
  v_t record;
  v_atk_name text; v_def_name text;
  v_lost int; v_kept int;
  v_atk_guardian jsonb;
  v_def_guardian jsonb;
  v_payload_atk jsonb;
  v_payload_def jsonb;
  v_atk_g_line text := '';
  v_def_g_line text := '';
  v_atk_body text;
  v_def_body text;
  v_outcome_label_atk text;
  v_outcome_label_def text;
begin
  select * into a from public.player_base_attacks where id = p_attack_id for update;
  if a is null then return jsonb_build_object('ok', false, 'error', 'not_found'); end if;
  if a.resolved_at is not null then return jsonb_build_object('ok', false, 'error', 'already_resolved'); end if;
  if a.ends_at > now() then return jsonb_build_object('ok', false, 'error', 'too_early'); end if;

  for k, v_cnt in select * from jsonb_each_text(a.troops_committed) loop
    select * into v_t from public.troops_catalog where id = k;
    if v_t is null then continue; end if;
    v_atk_power := v_atk_power + v_t.base_atk * v_cnt::int;
  end loop;

  select coalesce(sum(ut.count * t.base_def), 0)::int
    into v_def_power
    from public.user_troops ut
    join public.troops_catalog t on t.id = ut.troop_id
   where ut.user_id = a.defender_user_id;

  select * into v_def_base from public.bases where owner_user_id = a.defender_user_id;
  if v_def_base is not null then
    v_def_power := round(v_def_power * (1 + v_def_base.level * 0.03));
    perform public.refresh_base_hp(v_def_base.id, false);
    select current_hp into v_hp_before from public.bases where id = v_def_base.id;
  end if;

  v_dmg := greatest(round(v_atk_power * 0.6)::int, v_atk_power - v_def_power);
  if v_atk_power > 0 then v_dmg := greatest(200, v_dmg); end if;

  if v_def_base is not null then
    v_hp_after := greatest(0, v_hp_before - v_dmg);
    update public.bases set current_hp = v_hp_after, hp_updated_at = now()
      where id = v_def_base.id;
  end if;

  if v_def_base is not null and v_hp_after = 0 then
    v_outcome := 'attacker_pillaged'; v_pillage := true;
    v_loot_pct := 0.30; v_loss_pct_atk := 0.20; v_loss_pct_def := 0.45;
  elsif v_atk_power > v_def_power * 1.10 then
    v_outcome := 'attacker_won';
    v_loot_pct := 0.10; v_loss_pct_atk := 0.25; v_loss_pct_def := 0.30;
  elsif v_def_power > v_atk_power * 1.10 then
    v_outcome := 'defender_won';
    v_loot_pct := 0; v_loss_pct_atk := 0.65; v_loss_pct_def := 0.10;
  else
    v_outcome := 'draw';
    v_loot_pct := 0; v_loss_pct_atk := 0.40; v_loss_pct_def := 0.30;
  end if;

  if v_loot_pct > 0 then
    select greatest(0, round(coalesce(wood,0)  * v_loot_pct)::int),
           greatest(0, round(coalesce(stone,0) * v_loot_pct)::int),
           greatest(0, round(coalesce(gold,0)  * v_loot_pct)::int),
           greatest(0, round(coalesce(mana,0)  * v_loot_pct)::int)
      into v_loot_w, v_loot_s, v_loot_g, v_loot_m
      from public.user_resources where user_id = a.defender_user_id;
    update public.user_resources set
       wood  = greatest(0, wood  - v_loot_w),
       stone = greatest(0, stone - v_loot_s),
       gold  = greatest(0, gold  - v_loot_g),
       mana  = greatest(0, mana  - v_loot_m),
       updated_at = now()
     where user_id = a.defender_user_id;
    insert into public.user_resources (user_id, wood, stone, gold, mana)
    values (a.attacker_user_id, v_loot_w, v_loot_s, v_loot_g, v_loot_m)
    on conflict (user_id) do update set
       wood  = public.user_resources.wood  + excluded.wood,
       stone = public.user_resources.stone + excluded.stone,
       gold  = public.user_resources.gold  + excluded.gold,
       mana  = public.user_resources.mana  + excluded.mana,
       updated_at = now();
  end if;

  for k, v_cnt in select * from jsonb_each_text(a.troops_committed) loop
    if v_cnt::int <= 0 then continue; end if;
    v_lost := round(v_cnt::int * v_loss_pct_atk * 0.5)::int;
    v_kept := v_cnt::int - v_lost;
    if v_kept > 0 then
      insert into public.user_troops (user_id, troop_id, count)
      values (a.attacker_user_id, k, v_kept)
      on conflict (user_id, troop_id) do update set
        count = public.user_troops.count + excluded.count;
    end if;
  end loop;

  if v_loss_pct_def > 0 then
    update public.user_troops
       set count = greatest(0, round(count * (1 - v_loss_pct_def * 0.5))::int)
     where user_id = a.defender_user_id;
  end if;

  update public.player_base_attacks set
    resolved_at = now(),
    outcome = v_outcome,
    loot = jsonb_build_object(
      'wood', v_loot_w, 'stone', v_loot_s, 'gold', v_loot_g, 'mana', v_loot_m,
      'pillage', v_pillage, 'hp_damage', v_dmg,
      'hp_before', v_hp_before, 'hp_after', v_hp_after),
    losses_attacker = jsonb_build_object('total_atk', v_atk_power, 'pct_lost', round(v_loss_pct_atk * 100)::int),
    losses_defender = jsonb_build_object('total_def', v_def_power, 'pct_lost', round(v_loss_pct_def * 100)::int)
   where id = p_attack_id;

  select coalesce(display_name, username, 'Unbekannt') into v_atk_name
    from public.users where id = a.attacker_user_id;
  select coalesce(display_name, username, 'Unbekannt') into v_def_name
    from public.users where id = a.defender_user_id;

  if a.attacker_guardian_archetype_id is not null then
    select jsonb_build_object(
      'archetype_id', ga.id, 'name', ga.name, 'emoji', ga.emoji,
      'rarity', ga.rarity, 'guardian_type', ga.guardian_type,
      'ability_name', ga.ability_name, 'ability_desc', ga.ability_desc,
      'level', coalesce(ug.level, 1)
    ) into v_atk_guardian
      from public.guardian_archetypes ga
      left join public.user_guardians ug
        on ug.archetype_id = ga.id and ug.user_id = a.attacker_user_id and ug.is_active = true
     where ga.id = a.attacker_guardian_archetype_id;
  end if;

  select jsonb_build_object(
    'archetype_id', ga.id, 'name', ga.name, 'emoji', ga.emoji,
    'rarity', ga.rarity, 'guardian_type', ga.guardian_type,
    'ability_name', ga.ability_name, 'ability_desc', ga.ability_desc,
    'level', ug.level
  ) into v_def_guardian
    from public.user_guardians ug
    join public.guardian_archetypes ga on ga.id = ug.archetype_id
   where ug.user_id = a.defender_user_id and ug.is_active = true
   limit 1;

  if v_atk_guardian is not null then
    v_atk_g_line := chr(10) || chr(10) || '🐲 Dein Wächter: ' || (v_atk_guardian ->> 'emoji') || ' ' ||
                    (v_atk_guardian ->> 'name') || ' (Lv ' || (v_atk_guardian ->> 'level') || ')' ||
                    chr(10) || '  ⚡ ' || (v_atk_guardian ->> 'ability_name');
  end if;
  if v_def_guardian is not null then
    v_def_g_line := chr(10) || chr(10) || '🐲 Gegner-Wächter: ' || (v_def_guardian ->> 'emoji') || ' ' ||
                    (v_def_guardian ->> 'name') || ' (Lv ' || (v_def_guardian ->> 'level') || ')' ||
                    chr(10) || '  ⚡ ' || (v_def_guardian ->> 'ability_name') ||
                    chr(10) || '  ' || (v_def_guardian ->> 'ability_desc');
  end if;

  v_payload_atk := jsonb_build_object(
    'outcome', v_outcome, 'atk_power', v_atk_power, 'def_power', v_def_power,
    'hp_damage', v_dmg, 'hp_before', v_hp_before, 'hp_after', v_hp_after,
    'loss_pct_atk', round(v_loss_pct_atk * 100)::int,
    'loot', jsonb_build_object('wood', v_loot_w, 'stone', v_loot_s, 'gold', v_loot_g, 'mana', v_loot_m),
    'attacker_name', v_atk_name, 'defender_name', v_def_name,
    'attacker_guardian', v_atk_guardian, 'defender_guardian', v_def_guardian,
    'perspective', 'attacker'
  );
  v_payload_def := jsonb_build_object(
    'outcome', v_outcome, 'atk_power', v_atk_power, 'def_power', v_def_power,
    'hp_damage', v_dmg, 'hp_before', v_hp_before, 'hp_after', v_hp_after,
    'loss_pct_def', round(v_loss_pct_def * 100)::int,
    'loot', jsonb_build_object('wood', v_loot_w, 'stone', v_loot_s, 'gold', v_loot_g, 'mana', v_loot_m),
    'attacker_name', v_atk_name, 'defender_name', v_def_name,
    'attacker_guardian', v_atk_guardian, 'defender_guardian', v_def_guardian,
    'perspective', 'defender'
  );

  v_outcome_label_atk := case v_outcome
       when 'attacker_pillaged' then '🏆 Plünderung erfolgreich!'
       when 'attacker_won' then '✅ Sieg!'
       when 'defender_won' then '❌ Niederlage'
       else '⚖️ Unentschieden' end;
  v_outcome_label_def := case v_outcome
       when 'attacker_pillaged' then '💀 Deine Base wurde geplündert!'
       when 'attacker_won' then '⚠️ Verteidigung gefallen'
       when 'defender_won' then '🛡️ Erfolgreich verteidigt!'
       else '⚖️ Unentschieden' end;

  v_atk_body := 'Ergebnis: ' || v_outcome_label_atk ||
    chr(10) || chr(10) || 'Deine Angriffsstärke: ' || v_atk_power ||
    chr(10) || 'Gegnerische Verteidigung: ' || v_def_power ||
    chr(10) || 'Base-HP-Schaden: ' || v_dmg || ' (' || v_hp_before || ' → ' || v_hp_after || ')' ||
    chr(10) || 'Deine Verluste: ~' || round(v_loss_pct_atk * 100)::int || '%' ||
    v_atk_g_line || v_def_g_line ||
    chr(10) || chr(10) || 'Beute:' ||
    chr(10) || '  🌲 Holz: '  || v_loot_w ||
    chr(10) || '  🪨 Stein: ' || v_loot_s ||
    chr(10) || '  🪙 Gold: '  || v_loot_g ||
    chr(10) || '  💧 Mana: '  || v_loot_m;

  v_def_body := 'Ergebnis: ' || v_outcome_label_def ||
    chr(10) || chr(10) || 'Gegnerische Angriffsstärke: ' || v_atk_power ||
    chr(10) || 'Deine Verteidigung: ' || v_def_power ||
    chr(10) || 'Base-HP-Schaden: ' || v_dmg || ' (' || v_hp_before || ' → ' || v_hp_after || ')' ||
    chr(10) || 'Deine Verluste: ~' || round(v_loss_pct_def * 100)::int || '%' ||
    replace(v_atk_g_line, 'Dein Wächter', 'Gegner-Wächter') ||
    replace(v_def_g_line, 'Gegner-Wächter', 'Dein Wächter') ||
    chr(10) || chr(10) || 'Geplündert:' ||
    chr(10) || '  🌲 ' || v_loot_w || ' Holz' ||
    chr(10) || '  🪨 ' || v_loot_s || ' Stein' ||
    chr(10) || '  🪙 ' || v_loot_g || ' Gold' ||
    chr(10) || '  💧 ' || v_loot_m || ' Mana';

  insert into public.user_inbox (
    user_id, category, subcategory, kind, payload, title, body
  ) values
  (a.attacker_user_id, 'report', 'pvp', 'battle_report', v_payload_atk,
   '⚔️ Schlachtbericht: Angriff auf ' || v_def_name, v_atk_body),
  (a.defender_user_id, 'report', 'pvp', 'battle_report', v_payload_def,
   '🛡️ Schlachtbericht: Angriff von ' || v_atk_name, v_def_body);

  return jsonb_build_object('ok', true, 'outcome', v_outcome,
    'atk_power', v_atk_power, 'def_power', v_def_power,
    'hp_damage', v_dmg, 'hp_before', v_hp_before, 'hp_after', v_hp_after,
    'loot', jsonb_build_object('wood', v_loot_w, 'stone', v_loot_s, 'gold', v_loot_g, 'mana', v_loot_m));
end $func$;

REVOKE ALL ON FUNCTION public.resolve_player_base_attack(uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.resolve_player_base_attack(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.spy_player_base(p_defender_user_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp
AS $func$
declare
  v_user uuid := auth.uid();
  v_cost int := 500;
  v_def_base_id uuid;
  v_def_level int;
  v_def_hp_cur int;
  v_def_hp_max int;
  v_def_shield timestamptz;
  v_troops_total int := 0;
  v_atk_power int := 0;
  v_def_power int := 0;
  v_res record;
  v_atk_name text;
  v_atk_guardian jsonb;
  v_breakdown jsonb;
  v_guardian jsonb;
  v_payload jsonb;
  v_warn_payload jsonb;
  v_body text;
  v_warn_body text;
  v_shield_line text := '';
  v_breakdown_line text := '';
  v_guardian_line text := '';
  v_warn_guardian_line text := '';
begin
  if v_user is null then return jsonb_build_object('ok', false, 'error', 'not_authenticated'); end if;
  if v_user = p_defender_user_id then return jsonb_build_object('ok', false, 'error', 'cannot_spy_self'); end if;

  update public.user_resources set gold = gold - v_cost, updated_at = now()
   where user_id = v_user and gold >= v_cost;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'not_enough_gold', 'need', v_cost);
  end if;

  select id, level, shield_until into v_def_base_id, v_def_level, v_def_shield
    from public.bases where owner_user_id = p_defender_user_id;
  if v_def_base_id is null then
    update public.user_resources set gold = gold + v_cost where user_id = v_user;
    return jsonb_build_object('ok', false, 'error', 'no_base');
  end if;

  perform public.refresh_base_hp(v_def_base_id, false);
  select current_hp, max_hp into v_def_hp_cur, v_def_hp_max
    from public.bases where id = v_def_base_id;

  select coalesce(sum(count), 0)::int into v_troops_total
    from public.user_troops where user_id = p_defender_user_id;

  select coalesce(sum(ut.count * t.base_atk), 0)::int,
         coalesce(sum(ut.count * t.base_def), 0)::int
    into v_atk_power, v_def_power
    from public.user_troops ut
    join public.troops_catalog t on t.id = ut.troop_id
   where ut.user_id = p_defender_user_id;

  v_def_power := round(v_def_power * (1 + v_def_level * 0.03))::int;

  select jsonb_object_agg(troop_class, total) into v_breakdown
    from (
      select t.troop_class, sum(ut.count)::int as total
        from public.user_troops ut
        join public.troops_catalog t on t.id = ut.troop_id
       where ut.user_id = p_defender_user_id
       group by t.troop_class
    ) s;

  select jsonb_build_object(
    'archetype_id', ga.id, 'name', ga.name, 'emoji', ga.emoji,
    'rarity', ga.rarity, 'guardian_type', ga.guardian_type,
    'ability_name', ga.ability_name, 'ability_desc', ga.ability_desc,
    'level', ug.level
  ) into v_guardian
    from public.user_guardians ug
    join public.guardian_archetypes ga on ga.id = ug.archetype_id
   where ug.user_id = p_defender_user_id and ug.is_active = true
   limit 1;

  select jsonb_build_object(
    'archetype_id', ga.id, 'name', ga.name, 'emoji', ga.emoji,
    'rarity', ga.rarity, 'guardian_type', ga.guardian_type,
    'ability_name', ga.ability_name, 'ability_desc', ga.ability_desc,
    'level', ug.level
  ) into v_atk_guardian
    from public.user_guardians ug
    join public.guardian_archetypes ga on ga.id = ug.archetype_id
   where ug.user_id = v_user and ug.is_active = true
   limit 1;

  select coalesce(wood,0) as wood, coalesce(stone,0) as stone,
         coalesce(gold,0) as gold, coalesce(mana,0) as mana
    into v_res
    from public.user_resources where user_id = p_defender_user_id;

  select coalesce(display_name, username, 'Unbekannt') into v_atk_name
    from public.users where id = v_user;

  v_payload := jsonb_build_object(
    'base_level', v_def_level, 'current_hp', v_def_hp_cur, 'max_hp', v_def_hp_max,
    'troops_total', v_troops_total, 'atk_power', v_atk_power, 'def_power', v_def_power,
    'shield_until', v_def_shield,
    'resources', jsonb_build_object('wood', v_res.wood, 'stone', v_res.stone, 'gold', v_res.gold, 'mana', v_res.mana),
    'troop_breakdown', coalesce(v_breakdown, '{}'::jsonb),
    'active_guardian', v_guardian,
    'perspective', 'spy'
  );

  v_warn_payload := jsonb_build_object(
    'attacker_name', v_atk_name,
    'attacker_guardian', v_atk_guardian,
    'perspective', 'spy_warning'
  );

  if v_def_shield is not null and v_def_shield > now() then
    v_shield_line := chr(10) || '  🛡️ Schutzschild aktiv bis ' || to_char(v_def_shield, 'DD.MM.YYYY HH24:MI');
  end if;

  if v_breakdown is not null and v_breakdown <> '{}'::jsonb then
    v_breakdown_line := chr(10) || chr(10) || '⚔️ Truppen-Aufteilung' || chr(10) ||
       coalesce((select string_agg('  ' ||
         case k when 'infantry' then '🪖 Türsteher' when 'cavalry' then '🏍️ Kuriere'
                when 'marksman' then '🚁 Schützen' when 'siege' then '💥 Brecher'
                when 'collector' then '🎒 Sammler' when 'architect' then '🏗️ Konstrukteure'
                else k end ||
         ': ' || (v_breakdown ->> k), chr(10))
         from jsonb_object_keys(v_breakdown) k), '');
  end if;

  if v_guardian is not null then
    v_guardian_line := chr(10) || chr(10) || '🐲 Aktiver Wächter: ' || (v_guardian ->> 'emoji') || ' ' ||
                       (v_guardian ->> 'name') || ' (' || upper(v_guardian ->> 'rarity') ||
                       ' · Lv ' || (v_guardian ->> 'level') || ')' ||
                       chr(10) || '  ⚡ ' || (v_guardian ->> 'ability_name') ||
                       chr(10) || '  ' || (v_guardian ->> 'ability_desc');
  end if;

  if v_atk_guardian is not null then
    v_warn_guardian_line := chr(10) || '🐲 Angreifer-Wächter: ' || (v_atk_guardian ->> 'emoji') || ' ' ||
                            (v_atk_guardian ->> 'name') || ' (Lv ' || (v_atk_guardian ->> 'level') || ')' ||
                            chr(10) || '  ⚡ ' || (v_atk_guardian ->> 'ability_name') ||
                            chr(10) || '  ' || (v_atk_guardian ->> 'ability_desc') || chr(10);
  end if;

  v_body := 'Aufklärung erfolgreich (Kosten: 500 🪙).' || chr(10) ||
    chr(10) || '📊 Übersicht' ||
    chr(10) || '  Base-Stufe: ' || v_def_level ||
    chr(10) || '  HP: ' || v_def_hp_cur || ' / ' || v_def_hp_max ||
    chr(10) || '  Stärke (Truppen): ' || v_troops_total ||
    chr(10) || '  Angriffsmacht: ' || v_atk_power ||
    chr(10) || '  Verteidigungsmacht: ' || v_def_power ||
    v_shield_line ||
    chr(10) || chr(10) || '🪙 Im Lager' ||
    chr(10) || '  Holz:  ' || coalesce(v_res.wood, 0) ||
    chr(10) || '  Stein: ' || coalesce(v_res.stone, 0) ||
    chr(10) || '  Gold:  ' || coalesce(v_res.gold, 0) ||
    chr(10) || '  Mana:  ' || coalesce(v_res.mana, 0) ||
    v_breakdown_line ||
    v_guardian_line;

  v_warn_body := 'Ein Späher von ' || v_atk_name || ' hat deine Base ausgekundschaftet.' || chr(10) ||
    v_warn_guardian_line ||
    chr(10) || 'Erwäge dein Schild zu aktivieren oder die Verteidigung zu verstärken.';

  insert into public.user_inbox (user_id, category, subcategory, kind, payload, title, body) values
  (v_user, 'report', 'misc', 'spy_report', v_payload,
   '🔍 Spionage-Bericht: ' || (select coalesce(display_name, username, 'Gegner') from public.users where id = p_defender_user_id),
   v_body),
  (p_defender_user_id, 'report', 'misc', 'spy_warning', v_warn_payload,
   '🔍 Spähtrupp gesichtet', v_warn_body);

  return jsonb_build_object('ok', true,
    'cost', v_cost,
    'troops_total', v_troops_total,
    'atk_power', v_atk_power,
    'def_power', v_def_power,
    'base_level', v_def_level,
    'current_hp', v_def_hp_cur,
    'max_hp', v_def_hp_max,
    'shield_until', v_def_shield,
    'resources', jsonb_build_object(
      'wood', coalesce(v_res.wood, 0),
      'stone', coalesce(v_res.stone, 0),
      'gold', coalesce(v_res.gold, 0),
      'mana', coalesce(v_res.mana, 0)
    ),
    'troop_breakdown', coalesce(v_breakdown, '{}'::jsonb),
    'active_guardian', v_guardian
  );
end $func$;

REVOKE ALL ON FUNCTION public.spy_player_base(uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.spy_player_base(uuid) TO authenticated;
