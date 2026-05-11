-- 00325_weather_combat_modifier.sql
-- Wetter beeinflusst PvP-Schaden konkret. Defender's home_city Wetter wirkt.
-- Real-City-USP wird zur konkreten Spielmechanik.

CREATE OR REPLACE FUNCTION public._weather_atk_mult(p_city_slug text, p_troop_class text)
RETURNS numeric LANGUAGE plpgsql STABLE
SET search_path = public, pg_temp
AS $$
declare
  v_w public.city_weather;
begin
  select * into v_w from public.city_weather where city_slug = p_city_slug;
  if v_w is null then return 1.0; end if;
  case v_w.condition
    when 'rain' then
      if p_troop_class = 'marksman' then return 0.80; end if;
    when 'storm' then
      if p_troop_class = 'marksman' then return 0.70; end if;
      if p_troop_class = 'siege'    then return 1.10; end if;
    when 'fog' then
      if p_troop_class = 'marksman' then return 0.85; end if;
    when 'night' then
      if p_troop_class = 'cavalry'  then return 1.15; end if;
      if p_troop_class = 'marksman' then return 0.85; end if;
    when 'snow' then
      if p_troop_class = 'architect' then return 1.10; end if;
    else null;
  end case;
  return 1.0;
end $$;

CREATE OR REPLACE FUNCTION public._weather_def_mult(p_city_slug text, p_troop_class text)
RETURNS numeric LANGUAGE plpgsql STABLE
SET search_path = public, pg_temp
AS $$
declare
  v_w public.city_weather;
begin
  select * into v_w from public.city_weather where city_slug = p_city_slug;
  if v_w is null then return 1.0; end if;
  case v_w.condition
    when 'rain' then
      if p_troop_class = 'infantry' then return 1.10; end if;
    when 'heat' then return 0.90;
    else null;
  end case;
  return 1.0;
end $$;

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
  v_city_slug text;
  v_weather public.city_weather;
  v_weather_line text := '';
begin
  select * into a from public.player_base_attacks where id = p_attack_id for update;
  if a is null then return jsonb_build_object('ok', false, 'error', 'not_found'); end if;
  if a.resolved_at is not null then return jsonb_build_object('ok', false, 'error', 'already_resolved'); end if;
  if a.ends_at > now() then return jsonb_build_object('ok', false, 'error', 'too_early'); end if;

  select home_city_slug into v_city_slug from public.users where id = a.defender_user_id;
  if v_city_slug is not null then
    select * into v_weather from public.city_weather where city_slug = v_city_slug;
  end if;

  for k, v_cnt in select * from jsonb_each_text(a.troops_committed) loop
    select * into v_t from public.troops_catalog where id = k;
    if v_t is null then continue; end if;
    v_atk_power := v_atk_power + round(
      v_t.base_atk * v_cnt::int *
      coalesce(public._weather_atk_mult(v_city_slug, v_t.troop_class), 1.0)
    )::int;
  end loop;

  select coalesce(sum(round(ut.count * t.base_def *
      coalesce(public._weather_def_mult(v_city_slug, t.troop_class), 1.0))::int), 0)::int
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

  if v_weather is not null and v_weather.condition not in ('clear','cloud') then
    v_weather_line := chr(10) || chr(10) || '🌦️ Wetter in ' || v_city_slug || ': ' ||
      case v_weather.condition
        when 'rain' then '🌧️ Regen — Schützen geschwächt'
        when 'storm' then '⛈️ Sturm — Schützen schwer geschwächt, Brecher gestärkt'
        when 'snow' then '❄️ Schnee — Konstrukteur-Schaden +10%'
        when 'heat' then '🔥 Hitze — Verteidigung global geschwächt'
        when 'fog' then '🌫️ Nebel — Schützen-Sicht reduziert'
        when 'night' then '🌙 Nacht — Kurier-Vorteil'
        else v_weather.condition
      end || ' · ' || v_weather.temperature_c || '°C';
  end if;

  v_payload_atk := jsonb_build_object(
    'outcome', v_outcome, 'atk_power', v_atk_power, 'def_power', v_def_power,
    'hp_damage', v_dmg, 'hp_before', v_hp_before, 'hp_after', v_hp_after,
    'loss_pct_atk', round(v_loss_pct_atk * 100)::int,
    'loot', jsonb_build_object('wood', v_loot_w, 'stone', v_loot_s, 'gold', v_loot_g, 'mana', v_loot_m),
    'attacker_name', v_atk_name, 'defender_name', v_def_name,
    'attacker_guardian', v_atk_guardian, 'defender_guardian', v_def_guardian,
    'weather', to_jsonb(v_weather),
    'perspective', 'attacker'
  );
  v_payload_def := jsonb_build_object(
    'outcome', v_outcome, 'atk_power', v_atk_power, 'def_power', v_def_power,
    'hp_damage', v_dmg, 'hp_before', v_hp_before, 'hp_after', v_hp_after,
    'loss_pct_def', round(v_loss_pct_def * 100)::int,
    'loot', jsonb_build_object('wood', v_loot_w, 'stone', v_loot_s, 'gold', v_loot_g, 'mana', v_loot_m),
    'attacker_name', v_atk_name, 'defender_name', v_def_name,
    'attacker_guardian', v_atk_guardian, 'defender_guardian', v_def_guardian,
    'weather', to_jsonb(v_weather),
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
    v_atk_g_line || v_def_g_line || v_weather_line ||
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
    replace(v_def_g_line, 'Gegner-Wächter', 'Dein Wächter') || v_weather_line ||
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
