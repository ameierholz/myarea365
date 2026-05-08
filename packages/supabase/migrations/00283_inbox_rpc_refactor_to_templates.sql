-- ════════════════════════════════════════════════════════════════════════
-- RPC-Refactor: hardcoded inbox-Inserts auf send_templated_inbox umstellen.
-- Heute migriert:
--   - kick_crew_rally_participant      → rally_kicked
--   - cancel_crew_repeater_rally       → rally_cancel_leader/participant
--   - resolve_due_crew_repeater_rallies (Solo-Auflösung) → rally_aborted_solo
--   - tick_gather_marches              → gather_complete / gather_recalled
-- Noch offen (Memory-TODO): finish_player_base_attack, finish_spy_player_base,
-- cancel_player_base_rally, cancel_stronghold_rally — komplexere Battle-Bodies.
-- ════════════════════════════════════════════════════════════════════════

insert into public.system_message_templates
  (kind, locale, category, title, body, emoji, color, hero_label, default_reward, available_vars, description, active) values
  ('rally_aborted_solo', 'de', 'crew',
   '⚠️ Aufgebot aufgelöst',
   'Dein Crew-Aufgebot wurde aufgelöst, weil sich kein weiterer Crew-Mate angeschlossen hat.{{nl}}{{nl}}Mindestens 2 Crew-Mitglieder werden benötigt. Deine Truppen sind unbeschadet zurückgekehrt.',
   '⚠️', '#FF6B4A', 'Aufgebot', '{}'::jsonb,
   array['nl'], 'Auto-Auflösung wenn Solo-Aufgebot abläuft.', true)
on conflict (kind, locale) do update set
  title = excluded.title, body = excluded.body, updated_at = now();

-- (Body identisch zu DB-Stand — siehe Migration via MCP angewandt.
--  Funktions-Definitionen bleiben in der Doku-Migration kompakt.)
