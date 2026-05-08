-- ════════════════════════════════════════════════════════════════════════
-- System-Message-Templates: i18n-Refactor
-- Composite-PK (kind, locale) — pro Sprache eine Row.
-- send_templated_inbox liest users.setting_language und pickt passendes
-- Template. Fallback: locale='de'.
-- + 13 fehlende Templates seeded (battle_report, spy_report, rally_report,
--   gather_complete, gather_recalled, repeater_*, rally_cancel_*, rally_kicked,
--   city_lord_appointed, title_granted).
-- ════════════════════════════════════════════════════════════════════════

alter table public.system_message_templates
  add column if not exists locale text not null default 'de';

alter table public.system_message_templates drop constraint if exists system_message_templates_pkey;
alter table public.system_message_templates add primary key (kind, locale);
create index if not exists smt_kind_idx on public.system_message_templates(kind);

-- send_templated_inbox: locale-aware Template-Pick
create or replace function public.send_templated_inbox(
  p_user uuid, p_kind text,
  p_vars jsonb default '{}'::jsonb,
  p_reward_payload jsonb default null,
  p_payload jsonb default '{}'::jsonb
) returns uuid
language plpgsql security definer set search_path to 'public', 'extensions', 'pg_temp'
as $$
declare
  v_locale text;
  v_tpl record;
  v_title text; v_body text;
  v_inbox_id uuid;
  v_var_key text; v_var_val text;
begin
  select coalesce(setting_language, email_locale, 'de') into v_locale
    from public.users where id = p_user;
  v_locale := coalesce(v_locale, 'de');

  select * into v_tpl from public.system_message_templates
   where kind = p_kind and locale = v_locale and active limit 1;
  if not found then
    select * into v_tpl from public.system_message_templates
     where kind = p_kind and locale = 'de' and active limit 1;
  end if;
  if not found then
    raise exception 'send_templated_inbox: kein Template für kind=% (auch nicht in de)', p_kind;
  end if;

  v_title := v_tpl.title;
  v_body  := v_tpl.body;

  if p_vars is not null then
    for v_var_key, v_var_val in select * from jsonb_each_text(p_vars) loop
      v_title := replace(v_title, '{{' || v_var_key || '}}', v_var_val);
      v_body  := replace(v_body,  '{{' || v_var_key || '}}', v_var_val);
    end loop;
  end if;

  insert into public.user_inbox
    (user_id, category, kind, title, body, payload, reward_payload, from_label)
  values
    (p_user, v_tpl.category, p_kind, v_title, v_body, p_payload,
     coalesce(p_reward_payload, nullif(v_tpl.default_reward, '{}'::jsonb)),
     v_tpl.hero_label)
  returning id into v_inbox_id;

  return v_inbox_id;
end $$;

grant execute on function public.send_templated_inbox(uuid, text, jsonb, jsonb, jsonb) to authenticated, service_role;

-- 13 fehlende Templates (nur DE — andere Sprachen über Auto-Translate-Editor)
insert into public.system_message_templates
  (kind, locale, category, title, body, emoji, color, hero_label, default_reward, available_vars, description, active) values
  ('battle_report', 'de', 'report',
   '⚔️ Schlachtbericht: {{target_name}}',
   'Dein Angriff auf {{target_name}} ist abgeschlossen.{{nl}}{{nl}}Truppen ausgesandt: {{troops_sent}}{{nl}}Verluste: {{troops_lost}}{{nl}}Gegner-Verluste: {{enemy_lost}}{{nl}}Beute: {{loot_summary}}',
   '⚔️', '#FF2D78', 'Streifzug', '{}'::jsonb,
   array['target_name','troops_sent','troops_lost','enemy_lost','loot_summary','nl'],
   'Erfolgreicher PvP-Angriff auf eine Spieler-Base.', true),
  ('battle_report_defeat', 'de', 'report',
   '💀 Niederlage gegen {{target_name}}',
   'Dein Angriff auf {{target_name}} wurde zurückgeschlagen.{{nl}}{{nl}}Truppen ausgesandt: {{troops_sent}}{{nl}}Verluste: {{troops_lost}}{{nl}}Beute: keine.',
   '💀', '#8B8FA3', 'Streifzug', '{}'::jsonb,
   array['target_name','troops_sent','troops_lost','nl'], 'Verlorener PvP-Angriff.', true),
  ('spy_report', 'de', 'report',
   '🕵️ Spähauftrag: {{target_name}}',
   'Dein Spähauftrag auf {{target_name}} ist zurück.{{nl}}{{nl}}Truppen-Stärke: {{enemy_power}}{{nl}}Resourcen: {{enemy_resources}}{{nl}}Mauer-Stufe: {{wall_level}}',
   '🕵️', '#22D1C3', 'Spähauftrag', '{}'::jsonb,
   array['target_name','enemy_power','enemy_resources','wall_level','nl'],
   'Erfolgreicher Spähauftrag.', true),
  ('rally_report', 'de', 'report',
   '🚩 Aufgebot-Bericht: {{target_name}}',
   'Das Aufgebot auf {{target_name}} ist beendet.{{nl}}{{nl}}Anführer: {{leader_name}}{{nl}}Teilnehmer: {{participant_count}}{{nl}}Beute pro Teilnehmer: {{loot_per_member}}',
   '🚩', '#FFD700', 'Aufgebot', '{}'::jsonb,
   array['target_name','leader_name','participant_count','loot_per_member','nl'],
   'Aufgebots-Resultat.', true),
  ('gather_complete', 'de', 'report',
   '{{resource_emoji}} Plünderzug zurück: +{{collected}} {{resource_label}}',
   'Deine {{troop_count}} Banditen sind erfolgreich vom {{kind_label}} (Lv {{node_level}}) zurück.{{nl}}{{nl}}Anführer: {{guardian_name}}{{nl}}Marschdauer: {{duration_min}} min{{nl}}Strecke: {{distance_km}} km{{nl}}{{nl}}{{resource_emoji}} Beute: {{collected}} {{resource_label}}',
   '⛏️', '#FFD700', 'Plünderzug', '{}'::jsonb,
   array['resource_emoji','collected','resource_label','troop_count','kind_label','node_level','guardian_name','duration_min','distance_km','nl'],
   'Erfolgreich zurückgekehrter Plünderzug.', true),
  ('gather_recalled', 'de', 'report',
   '↩️ Plünderzug abgebrochen: {{node_name}}',
   'Du hast deinen Plünderzug vorzeitig zurückgerufen.{{nl}}{{nl}}Trupp: {{troop_count}} Banditen{{nl}}Anführer: {{guardian_name}}{{nl}}Ziel: {{kind_label}} (Lv {{node_level}}){{nl}}Marschdauer: {{duration_min}} min{{nl}}{{nl}}Beute: {{collected}} {{resource_label}}',
   '↩️', '#8B8FA3', 'Plünderzug', '{}'::jsonb,
   array['node_name','troop_count','guardian_name','kind_label','node_level','duration_min','collected','resource_label','nl'],
   'Abgebrochener Plünderzug.', true),
  ('repeater_built', 'de', 'crew',
   '📡 Repeater errichtet: {{location_name}}',
   '{{founder_name}} hat einen neuen Repeater in {{location_name}} errichtet.{{nl}}{{nl}}Crew-Turf erweitert sich.',
   '📡', '#22D1C3', 'Crew', '{}'::jsonb,
   array['location_name','founder_name','nl'], 'Crew-Mitglied hat einen Repeater gebaut.', true),
  ('repeater_attacked', 'de', 'crew',
   '🚨 Repeater angegriffen: {{location_name}}',
   'Der Repeater in {{location_name}} wird angegriffen!{{nl}}{{nl}}Angreifer: {{attacker_name}} ({{attacker_crew}}){{nl}}Verbleibende HP: {{remaining_hp}}',
   '🚨', '#FF6B4A', 'Crew', '{}'::jsonb,
   array['location_name','attacker_name','attacker_crew','remaining_hp','nl'], 'Crew-Repeater unter Angriff.', true),
  ('rally_cancel_leader', 'de', 'crew',
   '❌ Aufgebot abgebrochen',
   'Du hast dein Aufgebot auf {{target_name}} abgebrochen. Alle Teilnehmer wurden benachrichtigt.',
   '❌', '#FF6B4A', 'Aufgebot', '{}'::jsonb, array['target_name'], 'Anführer hat Aufgebot abgebrochen.', true),
  ('rally_cancel_participant', 'de', 'crew',
   '❌ Aufgebot abgebrochen: {{target_name}}',
   '{{leader_name}} hat das Aufgebot auf {{target_name}} abgebrochen. Deine Truppen kehren zurück.',
   '❌', '#FF6B4A', 'Aufgebot', '{}'::jsonb, array['target_name','leader_name'], 'Teilnehmer-Notification.', true),
  ('rally_kicked', 'de', 'crew',
   '⚠️ Aus Aufgebot entfernt',
   '{{leader_name}} hat dich aus dem Aufgebot auf {{target_name}} entfernt.',
   '⚠️', '#FF6B4A', 'Aufgebot', '{}'::jsonb, array['leader_name','target_name'], 'Vom Aufgebot rausgekickt.', true),
  ('city_lord_appointed', 'de', 'event',
   '👑 {{title}}: {{user_name}}',
   '{{user_name}} wurde zum {{title}} der Stadt {{city_name}} ernannt!{{nl}}{{nl}}Neuer Buff aktiv: {{buff_description}}',
   '👑', '#FFD700', 'Stadt', '{}'::jsonb,
   array['title','user_name','city_name','buff_description','nl'], 'Stadt-Würdenträger ernannt.', true),
  ('title_granted', 'de', 'event',
   '🏅 Titel verliehen: {{title}}',
   'Du hast den Titel "{{title}}" erhalten.{{nl}}{{nl}}{{description}}',
   '🏅', '#FFD700', 'Titel', '{}'::jsonb, array['title','description','nl'], 'Spieler-Titel verliehen.', true)
on conflict (kind, locale) do update set
  category = excluded.category, title = excluded.title, body = excluded.body,
  emoji = excluded.emoji, color = excluded.color, hero_label = excluded.hero_label,
  default_reward = excluded.default_reward, available_vars = excluded.available_vars,
  description = excluded.description, active = excluded.active, updated_at = now();
