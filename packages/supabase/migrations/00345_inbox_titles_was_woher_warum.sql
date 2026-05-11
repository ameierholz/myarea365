-- 00345_inbox_titles_was_woher_warum.sql
-- Refactor: Inbox-Titles aller Drop-Templates auf WAS · WOHER · WARUM
-- Pattern (siehe feedback_inbox_title_pattern.md). Variablen werden zur
-- Laufzeit aus p_vars befüllt (send_templated_inbox).
--
-- Battle/Spy/Rally-Reports lassen wir — das sind Reports, kein Drop.
-- Andere Sprachen (EN/ES/FR/IT) folgen in separater Mig.

UPDATE public.system_message_templates SET
  title = '{{resource_emoji}} +{{collected}} {{resource_label}} · Plünder-Marsch · {{kind_label}} Lv {{node_level}}'
WHERE kind = 'gather_complete' AND locale = 'de';

UPDATE public.system_message_templates SET
  title = '↩️ Plünder-Marsch abgebrochen · {{kind_label}} · Selbst-Recall'
WHERE kind = 'gather_recalled' AND locale = 'de';

UPDATE public.system_message_templates SET
  title = '💎 +{{gems}} Diamanten · Verknüpfung · {{label}}'
WHERE kind = 'link_bonus' AND locale = 'de';

UPDATE public.system_message_templates SET
  title = '💎 +{{gems}} Diamanten · Krypto-Drop · {{sender_name}}'
WHERE kind = 'crypto_drop_received' AND locale = 'de';

UPDATE public.system_message_templates SET
  title = '🔧 Wartungs-Kompensation · System · {{reason}}'
WHERE kind = 'maintenance' AND locale = 'de';

UPDATE public.system_message_templates SET
  title = '👑 {{chest_kind}}-Truhe · Stadtherr · Saison-Belohnung'
WHERE kind = 'royal_chest' AND locale = 'de';

UPDATE public.system_message_templates SET
  title = '📊 Tagesreward Stufe {{level}} · Tägliche Aktivität · {{points}} Punkte'
WHERE kind = 'activity_reward' AND locale = 'de';

UPDATE public.system_message_templates SET
  title = '📋 Umfrage-Belohnung · Marktforschung · Danke'
WHERE kind = 'survey_reward' AND locale = 'de';

UPDATE public.system_message_templates SET
  title = '📅 +{{gems}} Diamanten · Monatspaket · Tages-Auszahlung'
WHERE kind = 'monthly_pack_daily' AND locale = 'de';

UPDATE public.system_message_templates SET
  title = '🎉 {{offer_name}} eingelöst · Pop-Up-Angebot · Kauf'
WHERE kind = 'popup_purchased' AND locale = 'de';

UPDATE public.system_message_templates SET
  title = '💸 +{{gold}} Krypto · Event-Ablauf · Item-Konvertierung'
WHERE kind = 'expire_event_item' AND locale = 'de';

UPDATE public.system_message_templates SET
  title = '🏅 Titel verliehen: {{title}} · Auszeichnung · {{title}}'
WHERE kind = 'title_granted' AND locale = 'de';

UPDATE public.system_message_templates SET
  title = '⭐ {{guardian_name}} Stufe {{level}} · Wächter-Vertrauen · Level-up'
WHERE kind = 'guardian_trust_levelup' AND locale = 'de';

UPDATE public.system_message_templates SET
  title = '📜 Set vervollständigt: {{set_name}} · Lore-Kompendium · Set-Belohnung'
WHERE kind = 'lore_set' AND locale = 'de';
