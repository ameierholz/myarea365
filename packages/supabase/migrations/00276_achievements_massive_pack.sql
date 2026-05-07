-- Massiver Achievement-Ausbau: ~150 weitere Erfolge in 3 Schwierigkeitsstufen.
-- Bronze: einfach (Onboarding/Mikro-Aktionen) · Silber: schwer (Wochen-Engagement)
-- Gold: ganz schwer (Endgame-Grind, Top-Platzierungen).
-- Begriffe: "Begleiter" (nicht "Wächter").

insert into public.achievements (slug, name, description, icon, xp_reward, tier) values
  -- ════════════════════════════════════════════════════════════════════
  -- BRONZE — viele kleine Erfolge, leicht zu erreichen
  -- ════════════════════════════════════════════════════════════════════
  -- Profil & Onboarding
  ('lang_set',           'Sprache gewählt',       'App-Sprache mindestens einmal angepasst.',                     '🌐', 50, 'bronze'),
  ('avatar_named',       'Eigener Name',          'Anzeigename gesetzt.',                                          '✏️', 50, 'bronze'),
  ('faction_picked',     'Lager bekannt',         'Eine Fraktion gewählt.',                                        '🚩', 50, 'bronze'),
  ('tutorial_done',      'Tutorial geschafft',    'Tutorial vollständig abgeschlossen.',                           '🎓', 50, 'bronze'),
  ('push_enabled',       'Immer informiert',      'Push-Benachrichtigungen aktiviert.',                            '🔔', 50, 'bronze'),
  ('first_open',         'Wach geworden',         'Die App zum ersten Mal geöffnet.',                              '👁️', 50, 'bronze'),
  ('first_settings',     'Einstellungen erkundet','Einstellungs-Screen zum ersten Mal geöffnet.',                  '⚙️', 50, 'bronze'),
  ('first_help',         'Hilfe gelesen',         'Hilfe-/FAQ-Screen besucht.',                                    '📖', 50, 'bronze'),
  ('first_screenshot',   'Erinnerungsfoto',       'Ersten Screenshot der Karte aufgenommen.',                      '📸', 50, 'bronze'),
  -- Bewegung (klein)
  ('walk_500m',          'Runde um den Block',    'Erste 500 Meter zurückgelegt.',                                 '👟', 50, 'bronze'),
  ('walk_1km',           'Erster Kilometer',      '1 km insgesamt zurückgelegt.',                                  '🛣️', 50, 'bronze'),
  ('walk_5km',           'Frische-Tour',          '5 km insgesamt zurückgelegt.',                                  '🌳', 80, 'bronze'),
  ('marches_5',          'Routen-Anfänger',       '5 Märsche abgeschlossen.',                                      '🚶', 50, 'bronze'),
  -- Truhen & Loot
  ('chests_5',           'Truhen-Fan',            '5 Truhen geöffnet.',                                            '📦', 50, 'bronze'),
  ('first_loot_drop',    'Erstes Loot',           'Ersten Loot-Drop von der Karte aufgesammelt.',                  '🎈', 50, 'bronze'),
  -- Crew
  ('crew_join_any',      'Crew-Schnupperer',      'Eine Crew-Liste angesehen.',                                    '👥', 50, 'bronze'),
  ('crew_donate_first',  'Erste Spende',          'Erste Crew-Spende getätigt.',                                   '🎁', 50, 'bronze'),
  ('crew_emoji_first',   'Erste Reaktion',        'Erste Emoji-Reaktion im Crew-Chat.',                            '😊', 50, 'bronze'),
  -- Combat (klein)
  ('first_pvp_seen',     'Schlachtfeld-Besuch',   'Erste PvP-Karte angesehen.',                                    '🗡️', 50, 'bronze'),
  ('first_dodge',        'Knapp entkommen',       'Erstem Banditen-Angriff entkommen.',                            '💨', 50, 'bronze'),
  -- Resources
  ('first_gold',         'Erste Krypto',          'Erste Krypto-Münzen erhalten.',                                 '🪙', 50, 'bronze'),
  ('first_holz',         'Tech-Schrott-Fund',     'Ersten Tech-Schrott gesammelt.',                                '⚙️', 50, 'bronze'),
  ('first_stein',        'Komponenten-Fund',      'Erste Komponenten gesammelt.',                                  '🧱', 50, 'bronze'),
  ('first_mana',         'Bandbreite gesichert',  'Erste Bandbreite erbeutet.',                                    '📡', 50, 'bronze'),
  -- Bauen / Forschen
  ('first_upgrade',      'Erstes Upgrade',        'Ein Gebäude erstmals verbessert.',                              '⬆️', 50, 'bronze'),
  ('research_seen',      'Forschungs-Schnupperer','Forschungs-Bildschirm zum ersten Mal geöffnet.',                '🔬', 50, 'bronze'),
  ('aufgebot_seen',      'Aufgebot inspiziert',   'Aufgebots-Modal zum ersten Mal geöffnet.',                      '🛡️', 50, 'bronze'),
  -- Begleiter
  ('guardian_named',     'Begleiter benannt',     'Einem Begleiter einen Namen gegeben.',                          '🏷️', 50, 'bronze'),
  ('guardian_pet',       'Begleiter gestreichelt','Begleiter im Profil interagiert.',                              '✋', 50, 'bronze'),
  -- Social
  ('first_dm',           'Erste DM',              'Erste Direktnachricht verschickt.',                             '✉️', 50, 'bronze'),
  ('first_invite',       'Mitspieler eingeladen', 'Eine Einladung verschickt.',                                    '📧', 50, 'bronze'),
  -- Shop / Gems
  ('shop_visit',         'Markt erkundet',        'Shop zum ersten Mal geöffnet.',                                 '🛍️', 50, 'bronze'),
  ('first_gem',          'Erste Edelsteine',      'Erste Edelsteine erhalten oder gekauft.',                       '💠', 50, 'bronze'),
  -- Map / Exploration
  ('district_first',     'Stadtteil-Pionier',     'Ersten Stadtteil betreten.',                                    '📍', 50, 'bronze'),
  ('city_first_view',    'Heimat-Karte gesehen',  'Heimat-Stadt-Karte zum ersten Mal angezeigt.',                  '🗺️', 50, 'bronze'),
  -- Cosmetics
  ('marker_first',       'Marker geändert',       'Marker-Stil zum ersten Mal angepasst.',                         '🎯', 50, 'bronze'),
  ('ring_first',         'Ring angelegt',         'Base-Ring zum ersten Mal aktiviert.',                           '💍', 50, 'bronze'),
  -- Daily / Weekly Engagement
  ('daily_login_first',  'Tagesgruß',             'Erste Tages-Login-Belohnung abgeholt.',                         '☀️', 50, 'bronze'),
  ('first_streak_break', 'Wieder dabei',          'Nach einer Pause zurückgekehrt.',                               '🔄', 50, 'bronze'),
  -- Misc
  ('emoji_5',            'Stimmungsmacherin',     '5 verschiedene Emoji-Reaktionen verwendet.',                    '🎭', 50, 'bronze'),
  ('avatar_change_3',    'Modefan',               'Avatar 3-mal umgestylt.',                                       '👗', 50, 'bronze'),
  ('first_view_other',   'Neugierig',             'Profil eines anderen Spielers angesehen.',                      '👀', 50, 'bronze'),

  -- ════════════════════════════════════════════════════════════════════
  -- SILBER — Wochen-Engagement, mehrere Sitzungen erforderlich
  -- ════════════════════════════════════════════════════════════════════
  -- Bewegung
  ('walk_25km',          'Geübter Läufer',        '25 km insgesamt zurückgelegt.',                                 '🥾', 200, 'silver'),
  ('walk_100km',         'Stadt-Vermesserin',     '100 km insgesamt zurückgelegt.',                                '🧭', 350, 'silver'),
  ('marches_50',         'Strecken-Arbeiter',     '50 Märsche abgeschlossen.',                                     '🚶', 200, 'silver'),
  ('marches_500',        'Routinier',             '500 Märsche abgeschlossen.',                                    '👞', 400, 'silver'),
  -- Truhen & Loot
  ('chests_50',          'Truhen-Hortuer',        '50 Truhen geöffnet.',                                           '🎁', 250, 'silver'),
  ('chests_100',         'Truhen-Sammler',        '100 Truhen geöffnet.',                                          '🗝️', 350, 'silver'),
  ('loot_drops_50',      'Loot-Aufsammler',       '50 Loot-Drops eingesammelt.',                                   '🎈', 200, 'silver'),
  -- Forschung & Bauten
  ('research_25',        'Studierte Spielerin',   '25 Forschungen abgeschlossen.',                                 '🔬', 250, 'silver'),
  ('upgrades_25',        'Bautrupp',              '25 Gebäude-Upgrades abgeschlossen.',                            '🏗️', 250, 'silver'),
  ('upgrades_100',       'Architektin',           '100 Gebäude-Upgrades abgeschlossen.',                           '🏛️', 400, 'silver'),
  ('building_lv10',      'Höhenflug',             'Erstes Gebäude auf Stufe 10 gebracht.',                         '🏢', 300, 'silver'),
  ('building_lv15',      'Wolkenkratzer',         'Erstes Gebäude auf Stufe 15 gebracht.',                         '🏬', 400, 'silver'),
  -- Combat & Wegelager
  ('cvc_kills_100',      'Bandit-Stopperin',      '100 Banditen-Kills im CvC.',                                    '🏹', 300, 'silver'),
  ('cvc_kills_250',      'Schreck der Banden',    '250 Banditen-Kills im CvC.',                                    '⚔️', 400, 'silver'),
  ('pvp_wins_10',        'Erfahrene Kämpferin',   '10 PvP-Begegnungen gewonnen.',                                  '🥇', 250, 'silver'),
  ('pvp_wins_50',        'PvP-Veteran',           '50 PvP-Begegnungen gewonnen.',                                  '🏆', 400, 'silver'),
  ('walls_25',           'Mauer-Brecherin XL',    '25 Wegelager-Wälle eingerissen.',                               '🧱', 300, 'silver'),
  ('rallys_attended_25', 'Rally-Stütze',          'An 25 Rallys teilgenommen.',                                    '📣', 300, 'silver'),
  -- Resources
  ('holz_10k',           'Schrott-Magnet',        '10.000 Tech-Schrott insgesamt gesammelt.',                      '⚙️', 250, 'silver'),
  ('stein_10k',          'Komponenten-Hortuer',   '10.000 Komponenten insgesamt gesammelt.',                       '🧱', 250, 'silver'),
  ('mana_10k',           'Bandbreite-Profi',      '10.000 Bandbreite insgesamt gesammelt.',                        '📡', 250, 'silver'),
  ('gold_100k',          'Krypto-Investor',       '100.000 Krypto angesammelt.',                                   '🪙', 350, 'silver'),
  ('all_res_5k',         'Diversifiziert',        'Von jeder Ressource mindestens 5.000 erbeutet.',                '💼', 350, 'silver'),
  -- Begleiter
  ('guardian_lv10',      'Begleiter-Trainer',     'Ersten Begleiter auf Stufe 10 gebracht.',                       '🐺', 300, 'silver'),
  ('guardian_lv25',      'Begleiter-Mentor',      'Ersten Begleiter auf Stufe 25 gebracht.',                       '🐲', 400, 'silver'),
  ('guardian_collect_10','Begleiter-Sammler',     '10 verschiedene Begleiter freigeschaltet.',                     '🐾', 350, 'silver'),
  -- Items / Crafting
  ('craft_50',           'Werkbank-Veteran',      '50 Items geschmiedet.',                                         '🛠️', 250, 'silver'),
  ('items_legendary_5',  'Legenden-Schatz',       '5 legendäre Items besessen.',                                   '💎', 400, 'silver'),
  ('item_set_first',     'Erstes Set',            'Erstes Item-Set vollständig getragen.',                         '🎽', 350, 'silver'),
  ('inventory_full',     'Lager voll',            'Inventar erstmals zu 100 % gefüllt.',                           '🎒', 200, 'silver'),
  -- Crew & Social
  ('crew_donate_25',     'Großzügige Spenderin',  '25 Spenden an die Crew getätigt.',                              '💝', 250, 'silver'),
  ('crew_chat_500',      'Kommunikatorin',        '500 Nachrichten im Crew-Chat.',                                 '💬', 250, 'silver'),
  ('friends_10',         'Freundeskreis',         '10 bestätigte Freunde.',                                        '🫂', 250, 'silver'),
  ('dms_100',            'Briefefreund',          '100 Direktnachrichten verschickt.',                             '📨', 250, 'silver'),
  ('crew_member_60d',    'Stammgast',             '60 Tage in derselben Crew aktiv.',                              '🏠', 350, 'silver'),
  -- Login / Streaks
  ('login_streak_14',    'Zweiwochen-Treue',      '14 Tage in Folge eingeloggt.',                                  '📅', 250, 'silver'),
  ('login_streak_60',    'Zweimonats-Treue',      '60 Tage in Folge eingeloggt.',                                  '🌙', 400, 'silver'),
  -- Daily Quests
  ('daily_quests_25',    'Quester',               '25 Tagesaufgaben abgeschlossen.',                               '✅', 250, 'silver'),
  ('daily_quests_100',   'Quest-Maniac',          '100 Tagesaufgaben abgeschlossen.',                              '📋', 400, 'silver'),
  ('weekly_quests_5',    'Wochen-Profi',          '5 Wochenaufgaben abgeschlossen.',                               '🗓️', 250, 'silver'),
  -- Cosmetics / Sammlung
  ('cosmetics_10',       'Mode-Sammlerin',        '10 verschiedene Kosmetika besessen.',                           '🧣', 250, 'silver'),
  ('marker_collect_5',   'Marker-Garderobe',      '5 verschiedene Marker freigeschaltet.',                         '🎯', 200, 'silver'),
  ('rings_collect_5',    'Ring-Sammlerin',        '5 verschiedene Base-Ringe freigeschaltet.',                     '💍', 200, 'silver'),
  -- Map / Exploration
  ('districts_10',       'Stadtteil-Erkunderin',  '10 Stadtteile besucht.',                                        '🚇', 250, 'silver'),
  ('streets_100',        'Hundert Straßen',       '100 verschiedene Straßen abgegangen.',                          '🛣️', 350, 'silver'),
  -- Trophäen-Meta
  ('achievements_25',    'Trophäen-Sammlerin',    '25 Trophäen freigeschaltet.',                                   '🥉', 300, 'silver'),
  ('achievements_50',    'Trophäen-Magnet',       '50 Trophäen freigeschaltet.',                                   '🥈', 500, 'silver'),
  -- Ära
  ('era_score_1k',       'Ära-Engagement',        'In einer Ära mindestens 1.000 Score erreicht.',                 '⭐', 300, 'silver'),
  ('era_played_3',       'Ära-Veteranin',         'An 3 verschiedenen Ären teilgenommen.',                         '⏳', 300, 'silver'),
  -- Wegelager
  ('wegelager_25',       'Wegelager-Reiniger',    '25 Wegelager-Posten besiegt.',                                  '🛤️', 350, 'silver'),

  -- ════════════════════════════════════════════════════════════════════
  -- GOLD — Endgame, Monate Spielzeit oder Top-Plätze
  -- ════════════════════════════════════════════════════════════════════
  -- Bewegung extrem
  ('walk_500km',         'Halbmarathon-Stadt',    '500 km insgesamt zurückgelegt.',                                '🌍', 1500, 'gold'),
  ('walk_1000km',        'Tausend-km-Club',       '1.000 km insgesamt zurückgelegt.',                              '🌐', 2500, 'gold'),
  ('marches_5000',       'Strecken-Sammlerin XL', '5.000 Märsche abgeschlossen.',                                  '🥇', 2000, 'gold'),
  ('marches_10000',      'Marsch-Maniac',         '10.000 Märsche abgeschlossen.',                                 '🏃', 3000, 'gold'),
  -- Truhen extrem
  ('chests_500',         'Truhen-König',          '500 Truhen geöffnet.',                                          '👑', 1500, 'gold'),
  ('chests_legendary_10','Legenden-Lager',        '10 legendäre Truhen geöffnet.',                                 '💎', 2000, 'gold'),
  ('chest_mythic_first', 'Mythische Truhe',       'Erste mythische Truhe geöffnet.',                               '🌟', 2500, 'gold'),
  -- Login / Streaks
  ('login_streak_200',   '200-Tage-Spirit',       '200 Tage in Folge eingeloggt.',                                 '🔥', 2000, 'gold'),
  ('login_streak_365',   'Jahres-Treue',          '365 Tage in Folge eingeloggt.',                                 '🎂', 3500, 'gold'),
  -- Crew & CvC
  ('cvc_kills_2500',     'Schlachtfeld-Hexe',     '2.500 Banditen-Kills im CvC.',                                  '🩸', 2000, 'gold'),
  ('cvc_mvp_3x',         'CvC-MVP-Triple',        'Drei Mal MVP einer CvC-Saison.',                                '⭐', 2500, 'gold'),
  ('crew_top1_3x',       'Stadt-Hegemonie',       'Crew dreimal Stadt-Nummer-1 in unterschiedlichen Ären.',        '🦁', 3000, 'gold'),
  ('crew_top1_lifetime', 'Ewige Krone',           'Crew gesamt 100+ Tage auf Stadt-Platz 1 gehalten.',             '👑', 5000, 'gold'),
  ('rallys_leader_50',   'Rally-Marschallin',     '50 Rallys als Initiator gestartet.',                            '🚩', 2000, 'gold'),
  -- Items / Crafting
  ('items_legendary_25', 'Legendärer Vorrat',     '25 legendäre Items besessen.',                                  '💎', 1500, 'gold'),
  ('item_set_complete',  'Komplettes Set',        'Komplettes Item-Set inkl. Bonus aktiviert.',                    '🎽', 1200, 'gold'),
  ('forge_500',          'Schmiedemeisterin',     '500 Items geschmiedet.',                                        '🔥', 1500, 'gold'),
  -- Begleiter
  ('guardian_lv50',      'Begleiter-Heroin',      'Ersten Begleiter auf Stufe 50 gebracht.',                       '🐉', 2000, 'gold'),
  ('guardian_max',       'Maximal-Begleiter',     'Begleiter komplett ausgereizt (Stufe & Skills).',               '✨', 3000, 'gold'),
  ('guardian_collect_all','Voller Stall',         'Alle freischaltbaren Begleiter gesammelt.',                     '🐾', 3000, 'gold'),
  ('awakening_3',        'Erweckungs-Profi',      '3 Begleiter awakened.',                                         '🌟', 2500, 'gold'),
  -- Resources extrem
  ('holz_1m',            'Schrott-Imperium',      '1.000.000 Tech-Schrott insgesamt gesammelt.',                   '⚙️', 1500, 'gold'),
  ('stein_1m',           'Komponenten-Imperium',  '1.000.000 Komponenten insgesamt gesammelt.',                    '🧱', 1500, 'gold'),
  ('mana_1m',            'Bandbreiten-Imperium',  '1.000.000 Bandbreite insgesamt gesammelt.',                     '📡', 1500, 'gold'),
  ('gold_10m',           'Krypto-Megawhale',      '10.000.000 Krypto insgesamt gesammelt.',                        '💰', 2000, 'gold'),
  ('all_res_100k',       'Allrounder-Magnatin',   'Von jeder Ressource 100.000 insgesamt gesammelt.',              '🎯', 2500, 'gold'),
  -- Forschung
  ('research_complete',  'Wissens-Krone',         'Forschungsbaum komplett abgeschlossen.',                        '🧠', 4000, 'gold'),
  ('research_100',       'Forschungs-Marathon',   '100 Forschungen abgeschlossen.',                                '📚', 1500, 'gold'),
  -- Bauten
  ('all_buildings_lv10', 'Stadt-Architektin',     'Alle Gebäude auf mindestens Stufe 10.',                         '🏙️', 2000, 'gold'),
  ('all_buildings_lv20', 'Mega-Stadt',            'Alle Gebäude auf mindestens Stufe 20.',                         '🌆', 4000, 'gold'),
  ('base_lv25',          'Maximale Base',         'Base auf Maximalstufe ausgebaut.',                              '🏰', 5000, 'gold'),
  -- Era / CvC Champion
  ('era_top10',          'Top-10-Spielerin',      'Top-10-Platzierung am Ende einer Ära.',                         '🥇', 1500, 'gold'),
  ('era_top3',           'Top-3-Spielerin',       'Top-3-Platzierung am Ende einer Ära.',                          '🏆', 2500, 'gold'),
  ('era_winner_solo',    'Ära-Eroberin',          'Persönlich Platz 1 einer Ära erreicht.',                        '👑', 5000, 'gold'),
  ('era_played_10',      'Era-Veteran',           'An 10 verschiedenen Ären teilgenommen.',                        '⌛', 2000, 'gold'),
  ('cvc_champion_3x',    'CvC-Triple-Champion',   'Drei verschiedene CvC-Saisons gewonnen.',                       '🏅', 3500, 'gold'),
  -- Trophäen-Meta
  ('achievements_100',   'Trophäen-Hortuerin',    '100 Trophäen freigeschaltet.',                                  '🥇', 2000, 'gold'),
  ('achievements_150',   'Trophäen-Süchtig',      '150 Trophäen freigeschaltet.',                                  '🌟', 3000, 'gold'),
  ('achievements_all',   'Vollendet',             'Alle freischaltbaren Trophäen gesammelt — Legende.',            '🏛️', 10000,'gold'),
  ('all_bronze',         'Bronze-Kollektorin',    'Alle Bronze-Trophäen freigeschaltet.',                          '🥉', 1500, 'gold'),
  ('all_silver',         'Silber-Kollektorin',    'Alle Silber-Trophäen freigeschaltet.',                          '🥈', 2500, 'gold'),
  -- Sammlung
  ('cosmetics_25',       'Mode-Imperium',         '25 verschiedene Kosmetika besessen.',                           '🧥', 1500, 'gold'),
  ('artwork_full',       'Kunst-Liebhaberin',     'Alle Kunst-Sammlungen vollständig freigeschaltet.',             '🖼️', 2000, 'gold'),
  -- Zeit
  ('account_365d',       'Jahres-Wegelager',      'Account seit mindestens 365 Tagen aktiv.',                      '🎉', 2500, 'gold'),
  ('account_1000d',      'Tausend-Tage-Spielerin','Account seit mindestens 1.000 Tagen aktiv.',                    '🏆', 5000, 'gold'),
  -- Geheim
  ('secret_codename',    'Codewort gefunden',     'Geheime Eingabe entdeckt — psst!',                              '🤫', 2000, 'gold'),
  ('night_owl_30',       'Nachtfalterin',         '30 Märsche zwischen 0 und 5 Uhr abgeschlossen.',                '🦉', 1500, 'gold')
on conflict (slug) do update set
  name = excluded.name,
  description = excluded.description,
  icon = excluded.icon,
  xp_reward = excluded.xp_reward,
  tier = excluded.tier;
