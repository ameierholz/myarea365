-- ════════════════════════════════════════════════════════════════════
-- REBRAND: Truppen + Trainings-Gebäude → "Kiez-Crew" (Set D)
-- ════════════════════════════════════════════════════════════════════
-- Behält IDs (kaserne/stall/schiessstand/belagerungsschuppen + inf_*/cav_*/
-- mks_*/sg_*) damit RPCs/Code nicht brechen — nur Display-Namen + Emojis +
-- Beschreibungen werden aktualisiert.
-- ════════════════════════════════════════════════════════════════════

-- ─── 1) Trainings-Gebäude umbenennen ──────────────────────────────────
update public.buildings_catalog set
  name = 'Bar', emoji = '🍺',
  description = 'Heuert Türsteher an. Höhere Stufen = höhere Tiers + mehr Türsteher pro Schicht.'
 where id = 'kaserne';

update public.buildings_catalog set
  name = 'Garage', emoji = '🏍️',
  description = 'Schult Kuriere. Höhere Stufen = höhere Tiers + mehr Kuriere pro Tour.'
 where id = 'stall';

update public.buildings_catalog set
  name = 'Gym', emoji = '🥊',
  description = 'Trainiert Schleuderer. Höhere Stufen = höhere Tiers + mehr Schleuderer pro Session.'
 where id = 'schiessstand';

update public.buildings_catalog set
  name = 'Werkhof', emoji = '🔨',
  description = 'Rekrutiert Brecher. Höhere Stufen = höhere Tiers + mehr Brecher pro Auftrag.'
 where id = 'belagerungsschuppen';

-- ─── 2) Truppen umbenennen — Set D Tier-Progression ───────────────────

-- Türsteher (infantry) — Bar
update public.troops_catalog set name='Lehrling',         emoji='🛡️', description='Frischling an der Tür.' where id='inf_t1';
update public.troops_catalog set name='Türsteher',        emoji='🛡️', description='Klassischer Türsteher. Hält die Linie.' where id='inf_t2';
update public.troops_catalog set name='Schichtleiter',    emoji='🛡️', description='Veteran mit Erfahrung — leitet die Türtruppe.' where id='inf_t3';
update public.troops_catalog set name='Vize-Boss',        emoji='🛡️', description='Schwer gepanzert, kaum zu durchbrechen.' where id='inf_t4';
update public.troops_catalog set name='Boss',             emoji='🛡️', description='Legendärer Verteidiger des Kiez.' where id='inf_t5';

-- Kuriere (cavalry) — Garage
update public.troops_catalog set name='Botenjunge',       emoji='🏍️', description='Schnell unterwegs auf zwei Rädern.' where id='cav_t1';
update public.troops_catalog set name='Kurier',           emoji='🏍️', description='Hit-and-Run-Spezialist auf der Straße.' where id='cav_t2';
update public.troops_catalog set name='Eilkurier',        emoji='🏍️', description='Bricht durch jede Linie — flink und kompromisslos.' where id='cav_t3';
update public.troops_catalog set name='Spitzenfahrer',    emoji='🏍️', description='Profi-Fahrer mit getunter Maschine.' where id='cav_t4';
update public.troops_catalog set name='Stadtmeister',     emoji='🏍️', description='Charge der Schnellsten — kein Block ist sicher.' where id='cav_t5';

-- Schleuderer (marksman) — Gym
update public.troops_catalog set name='Steinewerfer',     emoji='🎯', description='Wirft auf Distanz. Verfügbar ab Gym Lv 1.' where id='mks_t1';
update public.troops_catalog set name='Schleuderer',      emoji='🎯', description='Präzise auf mittlere Distanz.' where id='mks_t2';
update public.troops_catalog set name='Scharfwerfer',     emoji='🎯', description='Trifft alles, was sich bewegt.' where id='mks_t3';
update public.troops_catalog set name='Profi-Werfer',     emoji='🎯', description='Eliminiert Anführer aus dem Hinterhalt.' where id='mks_t4';
update public.troops_catalog set name='Meister-Schleuderer', emoji='🎯', description='Legendäre Treffsicherheit.' where id='mks_t5';

-- Brecher (siege) — Werkhof
update public.troops_catalog set name='Brechjunge',       emoji='🔨', description='Hebelt Türen, sprengt Fenster.' where id='sg_t1';
update public.troops_catalog set name='Brecher',          emoji='🔨', description='Reißt Mauern ein.' where id='sg_t2';
update public.troops_catalog set name='Sprenger',         emoji='🔨', description='Klassischer Bauwerk-Brecher.' where id='sg_t3';
update public.troops_catalog set name='Vorschlaghammer',  emoji='🔨', description='Verheerend gegen jede Verteidigung.' where id='sg_t4';
update public.troops_catalog set name='Demoliermeister',  emoji='🔨', description='Reißt jeden Bunker ein.' where id='sg_t5';
