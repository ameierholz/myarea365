-- ════════════════════════════════════════════════════════════════════
-- SPIONAGE: spy_player_base — Aufklärung gegen Gold
-- ════════════════════════════════════════════════════════════════════
-- Kostet 500 Gold, liefert Intel über Truppen, Verteidigung, HP, Loot.
-- Defender bekommt Inbox-Hinweis ("Spähtrupp gesichtet").
-- ════════════════════════════════════════════════════════════════════

create or replace function public.spy_player_base(p_defender_user_id uuid)
returns jsonb language plpgsql security definer as $$
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
  v_breakdown jsonb;
  v_guardian jsonb;
begin
  if v_user is null then return jsonb_build_object('ok', false, 'error', 'not_authenticated'); end if;
  if v_user = p_defender_user_id then return jsonb_build_object('ok', false, 'error', 'cannot_spy_self'); end if;

  -- Gold-Kosten abziehen
  update public.user_resources set gold = gold - v_cost, updated_at = now()
   where user_id = v_user and gold >= v_cost;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'not_enough_gold', 'need', v_cost);
  end if;

  -- Defender-Base
  select id, level, shield_until into v_def_base_id, v_def_level, v_def_shield
    from public.bases where owner_user_id = p_defender_user_id;
  if v_def_base_id is null then
    -- Gold zurück
    update public.user_resources set gold = gold + v_cost where user_id = v_user;
    return jsonb_build_object('ok', false, 'error', 'no_base');
  end if;

  perform public.refresh_base_hp(v_def_base_id, false);
  select current_hp, max_hp into v_def_hp_cur, v_def_hp_max
    from public.bases where id = v_def_base_id;

  -- Truppen-Aggregat
  select coalesce(sum(count), 0)::int into v_troops_total
    from public.user_troops where user_id = p_defender_user_id;

  select coalesce(sum(ut.count * t.base_atk), 0)::int,
         coalesce(sum(ut.count * t.base_def), 0)::int
    into v_atk_power, v_def_power
    from public.user_troops ut
    join public.troops_catalog t on t.id = ut.troop_id
   where ut.user_id = p_defender_user_id;

  -- Wall-Bonus auf Def
  v_def_power := round(v_def_power * (1 + v_def_level * 0.03))::int;

  -- Truppen-Breakdown nach Klasse (Summe pro infantry/cavalry/marksman/siege)
  select jsonb_object_agg(troop_class, total) into v_breakdown
    from (
      select t.troop_class, sum(ut.count)::int as total
        from public.user_troops ut
        join public.troops_catalog t on t.id = ut.troop_id
       where ut.user_id = p_defender_user_id
       group by t.troop_class
    ) s;

  -- Aktiver Wächter (archetype-Daten + Level)
  select jsonb_build_object(
           'archetype_id', ga.id,
           'name', ga.name,
           'emoji', ga.emoji,
           'rarity', ga.rarity,
           'level', ug.level
         ) into v_guardian
    from public.user_guardians ug
    join public.guardian_archetypes ga on ga.id = ug.archetype_id
   where ug.user_id = p_defender_user_id and ug.is_active = true
   limit 1;

  -- Ressourcen (zur Loot-Schätzung)
  select coalesce(wood,0) as wood, coalesce(stone,0) as stone,
         coalesce(gold,0) as gold, coalesce(mana,0) as mana
    into v_res
    from public.user_resources where user_id = p_defender_user_id;

  -- Inbox: Bericht für den Angreifer (volle Intel) + Warnung für Defender
  select coalesce(display_name, username, 'Unbekannt') into v_atk_name
    from public.users where id = v_user;

  insert into public.user_inbox (user_id, title, body) values
  (v_user,
   '🔍 Spionage-Bericht: ' || (select coalesce(display_name, username, 'Gegner') from public.users where id = p_defender_user_id),
   E'Aufklärung erfolgreich (Kosten: 500 🪙).\n' ||
   E'\n📊 Übersicht'
   E'\n  Base-Stufe: ' || v_def_level ||
   E'\n  HP: ' || v_def_hp_cur || ' / ' || v_def_hp_max ||
   E'\n  Stärke (Truppen): ' || v_troops_total ||
   E'\n  Angriffsmacht: ' || v_atk_power ||
   E'\n  Verteidigungsmacht: ' || v_def_power ||
   case when v_def_shield is not null and v_def_shield > now()
        then E'\n  🛡️ Schutzschild aktiv bis ' || to_char(v_def_shield, 'DD.MM.YYYY HH24:MI')
        else '' end ||
   E'\n\n🪙 Im Lager'
   E'\n  Holz:  ' || coalesce(v_res.wood, 0) ||
   E'\n  Stein: ' || coalesce(v_res.stone, 0) ||
   E'\n  Gold:  ' || coalesce(v_res.gold, 0) ||
   E'\n  Mana:  ' || coalesce(v_res.mana, 0) ||
   case when v_breakdown is not null and v_breakdown <> '{}'::jsonb
        then E'\n\n⚔️ Truppen-Aufteilung\n' ||
             coalesce((select string_agg('  ' ||
               case k when 'infantry' then '🛡️ Infanterie' when 'cavalry' then '🐎 Kavallerie'
                      when 'marksman' then '🏹 Schützen' when 'siege' then '🪨 Belagerung' else k end ||
               ': ' || (v_breakdown ->> k), E'\n')
               from jsonb_object_keys(v_breakdown) k), '')
        else '' end ||
   case when v_guardian is not null
        then E'\n\n🐲 Aktiver Wächter: ' || (v_guardian ->> 'emoji') || ' ' ||
             (v_guardian ->> 'name') || ' (' || upper(v_guardian ->> 'rarity') ||
             ' · Lv ' || (v_guardian ->> 'level') || ')'
        else '' end),
  (p_defender_user_id,
   '🔍 Spähtrupp gesichtet',
   E'Ein Späher von ' || v_atk_name || E' hat deine Base ausgekundschaftet.\n' ||
   E'Erwäge dein Schild zu aktivieren oder die Verteidigung zu verstärken.');

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
end $$;

revoke all on function public.spy_player_base(uuid) from public;
grant execute on function public.spy_player_base(uuid) to authenticated;
