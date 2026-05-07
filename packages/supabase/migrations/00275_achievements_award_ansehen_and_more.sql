-- 1) Trigger: bei Achievement-Unlock wird xp_reward als Ansehen ausgezahlt.
--    xp_reward bleibt als Spaltenname (auch von Loot-Drops genutzt) — wir interpretieren
--    den Wert für Achievements als Ansehen-Reward (UI labelt "+X Ansehen").

create or replace function public.award_achievement_ansehen()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_reward int;
begin
  select coalesce(xp_reward, 0) into v_reward
  from public.achievements
  where id = new.achievement_id;

  if v_reward > 0 then
    update public.users
       set ansehen = coalesce(ansehen, 0) + v_reward
     where id = new.user_id;
  end if;

  return new;
end;
$$;

drop trigger if exists user_achievements_award_ansehen on public.user_achievements;
create trigger user_achievements_award_ansehen
after insert on public.user_achievements
for each row execute function public.award_achievement_ansehen();

comment on function public.award_achievement_ansehen() is
  'Schreibt xp_reward des Achievements als Ansehen auf den User-Account beim Unlock.';

-- 2) Mehr Achievements (deutlich erweiterter Katalog)
insert into public.achievements (slug, name, description, icon, xp_reward, tier) values
  -- ============ BRONZE (Onboarding + frühe Erfolge) ============
  ('avatar_set',         'Eigener Look',          'Marker und/oder Base-Ring angepasst.',                 '🎭', 50,  'bronze'),
  ('first_chest',        'Erste Truhe',           'Eine Truhe geöffnet.',                                  '📦', 50,  'bronze'),
  ('first_friend',       'Neuer Kontakt',         'Erste Freundschaftsanfrage angenommen.',                '🫱', 50,  'bronze'),
  ('first_chat',         'Sprich mit der Crew',   'Erste Nachricht im Crew-Chat geschrieben.',             '💬', 50,  'bronze'),
  ('first_inbox',        'Posteingang',           'Erste Inbox-Nachricht gelesen.',                        '📬', 50,  'bronze'),
  ('first_market',       'Markt-Besuch',          'Ersten Marktplatz-Stand besucht.',                      '🛒', 50,  'bronze'),
  ('first_potion',       'Trank gebraut',         'Ersten Trank konsumiert.',                              '🧪', 50,  'bronze'),
  ('first_login_streak', '3-Tage-Streak',         '3 Tage hintereinander eingeloggt.',                     '🔥', 50,  'bronze'),
  ('first_quest',        'Wegweiser',             'Erste Tagesaufgabe abgeschlossen.',                     '📋', 50,  'bronze'),
  ('first_artwork_seen', 'Ästhet',                'Eine Sammlung im Inventar geöffnet.',                   '🎨', 50,  'bronze'),
  -- ============ SILVER (Engagement, mittlere Schwellen) ============
  ('marches_25',         'Strecken-Sammlerin',    '25 Märsche erfolgreich abgeschlossen.',                 '🚶‍♀️', 200, 'silver'),
  ('marches_100',        'Tausend Schritte',      '100 Märsche erfolgreich abgeschlossen.',                '🥾', 250, 'silver'),
  ('chests_25',          'Truhen-Hortuerin',      '25 Truhen geöffnet.',                                   '🎁', 200, 'silver'),
  ('login_streak_7',     'Wochenheld',            '7 Tage hintereinander eingeloggt.',                     '📆', 200, 'silver'),
  ('login_streak_30',    'Monatswolf',            '30 Tage hintereinander eingeloggt.',                    '🌙', 350, 'silver'),
  ('crew_member_30d',    'Treues Mitglied',       '30 Tage in derselben Crew aktiv.',                      '🧷', 200, 'silver'),
  ('rally_attended_5',   'Aufgebot-Stütze',       'An 5 Rallys teilgenommen.',                             '📣', 200, 'silver'),
  ('thief_master',       'Diebes-Strippenzieherin','Alle 4 Diebes-Klassen freigeschaltet.',                '🕵️', 250, 'silver'),
  ('guardian_5',         'Wächterzucht',          '5 verschiedene Wächter freigeschaltet.',                '🐾', 250, 'silver'),
  ('items_legendary_3',  'Legendärer Schrank',    '3 legendäre Items besessen.',                           '💎', 350, 'silver'),
  ('forge_25',           'Werkbank-Routine',      '25 Items geschmiedet.',                                 '🔧', 200, 'silver'),
  ('walls_destroyed_10', 'Mauerbrecher',          '10 Wegelager-Wälle eingerissen.',                       '💥', 250, 'silver'),
  ('crew_chat_100',      'Plaudertasche',         '100 Nachrichten im Crew-Chat geschrieben.',             '🗣️', 200, 'silver'),
  ('explorer_10',        'Stadtkundige',          '10 verschiedene Stadtteile besucht.',                   '🗺️', 200, 'silver'),
  ('cvc_kills_50',       'Mit Vertrauen',         '50 Banditen-Kills im CvC.',                             '🎯', 250, 'silver'),
  -- ============ GOLD (Endgame, selten erreicht) ============
  ('marches_1000',       'Wandermarschall',       '1.000 Märsche abgeschlossen — du gehörst zur Spitze.',  '🏅', 1000, 'gold'),
  ('login_streak_100',   '100-Tage-Treue',        '100 Tage hintereinander eingeloggt.',                   '💯', 1000, 'gold'),
  ('era_top10',          'Top-10-Spielerin',      'Top-10-Platzierung am Ende einer Ära.',                 '🥇', 1500, 'gold'),
  ('era_top3',           'Top-3-Spielerin',       'Top-3-Platzierung am Ende einer Ära.',                  '🏆', 2000, 'gold'),
  ('crew_top1',          'Stadt-Dynastie',        'Crew als Nummer 1 der Stadt am Ära-Ende.',              '👑', 2000, 'gold'),
  ('cvc_kills_500',      'Kriegsherrin',          '500 Banditen-Kills im CvC.',                            '⚔️', 1200, 'gold'),
  ('all_guardians',      'Wächter-Sammler',       'Alle Wächter-Archetypen freigeschaltet.',               '🐲', 1500, 'gold'),
  ('crypto_billionaire', 'Krypto-Whale',          '100.000.000 Krypto auf einmal besessen.',               '🐳', 2000, 'gold'),
  ('all_eras_top100',    'Konstante Größe',       'In 5 verschiedenen Ären unter den Top 100 platziert.',  '🌌', 1500, 'gold'),
  ('founder_legend',     'Crew-Legende',          'Eigene Crew dauerhaft auf Stadt-Platz 1 gehalten.',     '🦁', 2500, 'gold'),
  ('rally_leader_25',    'Anführerin',            '25 Rallys als Initiator gestartet.',                    '🚩', 1000, 'gold'),
  ('items_mythic',       'Mythisches Item',       'Ein mythisches Item besessen.',                         '🌠', 2000, 'gold'),
  ('artwork_complete',   'Sammelvitrine',         'Alle freischaltbaren Artwork-Sammlungen vollständig.',  '🖼️', 1000, 'gold')
on conflict (slug) do update set
  name = excluded.name,
  description = excluded.description,
  icon = excluded.icon,
  xp_reward = excluded.xp_reward,
  tier = excluded.tier;

comment on column public.achievements.xp_reward is
  'Belohnung in ANSEHEN beim Unlock (historisch xp_reward genannt). Wird über Trigger ausgezahlt.';
