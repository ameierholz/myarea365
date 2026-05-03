-- ─── 00235: System-Nachrichten-Templates (Admin-editierbar) ────────────
-- Statt Hardcoded-Strings in jedem Bonus-RPC werden Inbox-Nachrichten aus
-- system_message_templates gelesen. Admin kann Title/Body/Emoji/Color
-- über /admin/system-messages anpassen ohne Code-Deploy.
--
-- Platzhalter-Syntax: {{var_name}} — wird via format_message_template
-- mit jsonb-Variablen ersetzt. Verfügbare Standard-Vars:
--   {{runner_name}}    — Display-Name oder Username des Empfängers
--   {{crew_name}}      — Crew-Name des Empfängers (oder leer)
--   {{gems}}           — Anzahl Diamanten
--   {{wood}}/{{stone}}/{{gold}}/{{mana}} — RSS-Beträge
--   {{item_name}}      — Item-Name (für item-spezifische Nachrichten)
--   {{item_count}}     — Item-Anzahl
--   {{kind}}           — z.B. 'desktop_web', 'google'
--   ...beliebige weitere kommen aus dem RPC-Aufrufer per p_vars jsonb.

create table if not exists public.system_message_templates (
  kind        text primary key,                     -- 'link_bonus' | 'maintenance' | ...
  category    text not null default 'system',       -- inbox-Category-Tab
  title       text not null,                        -- mit Platzhaltern
  body        text not null,                        -- mit Platzhaltern, Markdown-light: **bold**
  emoji       text not null default '🎁',
  color       text not null default '#FFD700',
  hero_label  text not null default '',             -- z.B. 'KÖNIGLICHE TRUHE'
  default_reward jsonb not null default '{}'::jsonb, -- Fallback-Reward-Struktur (gems/items/wood/etc.)
  available_vars text[] not null default '{}',      -- Doku-Liste der unterstützten Platzhalter
  description text not null default '',             -- Admin-Hilfe-Text
  active      boolean not null default true,
  updated_at  timestamptz not null default now()
);

alter table public.system_message_templates enable row level security;
drop policy if exists "smt_read_authenticated" on public.system_message_templates;
create policy "smt_read_authenticated" on public.system_message_templates
  for select to authenticated using (true);

-- Render-Helper: ersetzt {{var}} im Text mit jsonb-Werten.
create or replace function public.format_message_template(p_template text, p_vars jsonb)
returns text language plpgsql immutable as $$
declare
  v_out text := p_template;
  k text;
  v text;
begin
  if p_template is null then return ''; end if;
  if p_vars is null then return p_template; end if;
  for k in select jsonb_object_keys(p_vars) loop
    v := coalesce(p_vars->>k, '');
    v_out := replace(v_out, '{{' || k || '}}', v);
  end loop;
  return v_out;
end $$;
grant execute on function public.format_message_template(text, jsonb) to authenticated, service_role;

-- Inbox-Sender via Template-Lookup (zentraler Einsprungpunkt für RPCs).
-- p_user → Empfänger; p_kind → Template-Lookup; p_vars → Platzhalter-Werte;
-- p_reward_payload → strukturierte Belohnungen (gems/wood/items[]/...);
-- p_payload → freie Metadaten.
create or replace function public.send_templated_inbox(
  p_user uuid,
  p_kind text,
  p_vars jsonb default '{}'::jsonb,
  p_reward_payload jsonb default null,
  p_payload jsonb default '{}'::jsonb
) returns uuid language plpgsql security definer as $$
declare
  v_tpl record;
  v_title text;
  v_body text;
  v_user_name text;
  v_crew_name text;
  v_vars jsonb;
  v_id uuid;
begin
  select * into v_tpl from public.system_message_templates where kind = p_kind and active;
  if v_tpl is null then
    -- Fallback: einfache Nachricht ohne Template
    insert into public.user_inbox (user_id, title, body, category, kind, payload, reward_payload, from_label)
    values (p_user, 'System-Nachricht', 'Du hast eine System-Nachricht erhalten.', 'system', p_kind, p_payload, p_reward_payload, 'System')
    returning id into v_id;
    return v_id;
  end if;

  -- Standard-Vars dazumixen (runner_name, crew_name)
  select coalesce(display_name, username, '')::text into v_user_name from public.users where id = p_user;
  select c.name into v_crew_name
    from public.crew_members cm
    join public.crews c on c.id = cm.crew_id
    where cm.user_id = p_user limit 1;

  v_vars := jsonb_build_object(
    'runner_name', coalesce(v_user_name, ''),
    'crew_name',   coalesce(v_crew_name, '')
  ) || coalesce(p_vars, '{}'::jsonb);

  v_title := public.format_message_template(v_tpl.title, v_vars);
  v_body  := public.format_message_template(v_tpl.body,  v_vars);

  insert into public.user_inbox (
    user_id, title, body, category, kind,
    payload, reward_payload, from_label
  ) values (
    p_user, v_title, v_body, v_tpl.category, p_kind,
    coalesce(p_payload, '{}'::jsonb) || jsonb_build_object('emoji', v_tpl.emoji, 'color', v_tpl.color, 'hero_label', v_tpl.hero_label),
    coalesce(p_reward_payload, v_tpl.default_reward),
    'System'
  ) returning id into v_id;

  return v_id;
end $$;
grant execute on function public.send_templated_inbox(uuid, text, jsonb, jsonb, jsonb) to authenticated, service_role;

-- ─── Seed: Templates für alle bekannten System-Nachrichten ────────
insert into public.system_message_templates (kind, category, title, body, emoji, color, hero_label, available_vars, description) values
  ('link_bonus',
   'system',
   '{{emoji}} {{label}}',
   E'Hallo {{runner_name}},\n\ndanke fürs Verknüpfen! Du hast einmalig **{{gems}} Diamanten** als Willkommensbonus erhalten.\n\nDiamanten kannst du im Glücksrad, der Schmiede des Lichts oder direkt im Shop einsetzen — viel Spaß!',
   '🎁', '#22D1C3', 'VERKNÜPFUNGS-BONUS',
   ARRAY['runner_name','gems','kind','emoji','label'],
   'Wird verschickt wenn Spieler ein neues Konto verknüpft (Google/Apple/Discord) oder zum ersten Mal Desktop-Web nutzt.'),

  ('maintenance',
   'system',
   '🔧 Wartungs-Kompensation',
   E'Hallo {{runner_name}},\n\nentschuldige die kurze Auszeit — wir haben gerade ein Update aufgespielt. Als kleine Entschädigung findest du **{{gems}} Diamanten** und ein paar Ressourcen in deinem Posteingang.\n\nViel Spaß weiter beim Spielen!',
   '🔧', '#FFD700', 'WARTUNG',
   ARRAY['runner_name','gems'],
   'Verschickt nach geplanten Server-Updates an alle aktiven Spieler.'),

  ('royal_chest',
   'system',
   '👑 Königliche Truhe ({{chest_kind}})',
   E'Hallo {{runner_name}},\n\nder Stadtherr hat dich mit einer **{{chest_kind}}-Truhe** ausgezeichnet — eine Anerkennung für deine Verdienste in der laufenden Saison.\n\nÖffne sie unten und genieße deine Belohnungen!',
   '👑', '#FFD700', 'KÖNIGLICHE TRUHE',
   ARRAY['runner_name','chest_kind','gems'],
   'Stadtherr (KvK-Sieger) verteilt manuell Truhen an Spieler.'),

  ('lore_set',
   'system',
   '📜 Set vervollständigt: {{set_name}}',
   E'Großartig, {{runner_name}}!\n\nDu hast das Set **{{set_name}}** komplettiert — die letzte Reliquie ist gefunden. Hier ist deine Set-Belohnung.\n\nWeiter so — die nächste Sammlung wartet schon!',
   '📜', '#a855f7', 'LORE-KOMPENDIUM',
   ARRAY['runner_name','set_name'],
   'Wenn ein Spieler alle Stücke eines Lore-Sets gesammelt hat.'),

  ('crypto_drop_received',
   'system',
   '💸 Krypto-Drop von {{sender_name}}',
   E'{{sender_name}} hat einen Krypto-Drop in den Crew-Chat geworfen.\n\nDu warst schnell genug und hast **{{gems}} Diamanten** abgegriffen — schönes Timing!',
   '💸', '#4ade80', 'KRYPTO-DROP',
   ARRAY['runner_name','sender_name','gems'],
   'Wenn der Spieler erfolgreich einen Crew-Krypto-Drop geclaimed hat.'),

  ('activity_reward',
   'system',
   '📊 Aktivitäts-Belohnung Stufe {{level}}',
   E'Hallo {{runner_name}},\n\ndu hast heute **{{points}} Aktivitätspunkte** gesammelt und Stufe {{level}} erreicht. Hier ist deine Belohnung — weiter so!',
   '📊', '#22D1C3', 'TÄGLICHE AKTIVITÄT',
   ARRAY['runner_name','level','points'],
   'Tägliche Activity-Bar Schwellen-Belohnung.'),

  ('monthly_pack_daily',
   'system',
   '📅 Monats-Pack Tagesreward',
   E'Dein Monats-Pack hat heute **{{gems}} Diamanten** ausgeschüttet. Schau morgen wieder rein für den nächsten Bonus!',
   '📅', '#5ddaf0', 'MONATSPAKET',
   ARRAY['runner_name','gems','sku'],
   'Tägliche Auszahlung eines aktiven Monatspakets.'),

  ('survey_reward',
   'system',
   '📋 Danke für deine Umfrage-Teilnahme',
   E'Hallo {{runner_name}},\n\ndanke dass du dir Zeit genommen hast! Hier ist deine kleine Belohnung.',
   '📋', '#a855f7', 'UMFRAGE',
   ARRAY['runner_name','survey_title'],
   'Nach erfolgreicher Survey-Teilnahme.'),

  ('guardian_trust_levelup',
   'system',
   '⭐ Wächter-Vertrauen Level {{level}}',
   E'Dein Wächter **{{guardian_name}}** vertraut dir jetzt auf Stufe {{level}}.\n\nNeue Dialoge und kleine Belohnungen sind freigeschaltet.',
   '⭐', '#FFD700', 'WÄCHTER-VERTRAUEN',
   ARRAY['runner_name','guardian_name','level'],
   'Wenn das Vertrauen eines Wächters ein neues Level erreicht.'),

  ('popup_purchased',
   'system',
   '🎉 Pop-Up-Angebot eingelöst',
   E'Danke für deinen Kauf, {{runner_name}}!\n\nDeine Belohnungen aus **{{offer_name}}** liegen unten bereit.',
   '🎉', '#FF2D78', 'ANGEBOT EINGELÖST',
   ARRAY['runner_name','offer_name'],
   'Bestätigung nach Kauf eines Pop-Up-Offers.'),

  ('expire_event_item',
   'system',
   '⏳ Event-Items abgelaufen',
   E'Hallo {{runner_name}},\n\neinige deiner Event-Items sind abgelaufen und wurden in **{{gold}} Krypto** umgewandelt. Beim nächsten Event mehr Glück!',
   '⏳', '#9ba8c7', 'EVENT-ABLAUF',
   ARRAY['runner_name','gold'],
   'Cron-Job konvertiert abgelaufene Event-Items in RSS.')
on conflict (kind) do update
  set title = excluded.title,
      body = excluded.body,
      emoji = excluded.emoji,
      color = excluded.color,
      hero_label = excluded.hero_label,
      available_vars = excluded.available_vars,
      description = excluded.description,
      updated_at = now();
