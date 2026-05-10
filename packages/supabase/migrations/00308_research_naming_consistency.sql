-- ════════════════════════════════════════════════════════════════════════
-- Forschungs-Namen + Beschreibungen — Konsistenz mit Crew-Theme
-- ════════════════════════════════════════════════════════════════════════
-- Fixes:
--   1) Schleuderer → Schütze (matcht den tatsächlichen Truppen-Namen)
--   2) Gilden → Crew (Projekt-Terminologie)
--   3) Resource-Flavor angleichen: Tech-Schrott (Holz), Komponenten (Stein),
--      Krypto (Gold), Bandbreite (Mana) — neue Namen + Beschreibungen
-- ════════════════════════════════════════════════════════════════════════

-- ─── 1) Schleuderer → Schütze ────────────────────────────────────────────
update public.research_definitions set
  name = 'Schütze-Drill',
  description = '+3% Schütze-Angriff pro Stufe.'
where id = 'mil_schiesskunst';

update public.research_definitions set
  name = 'Schütze-Schutz',
  description = '+4% Schütze-Verteidigung pro Stufe.'
where id = 'mil_schuetzenschutz';

update public.research_definitions set
  name = 'Schütze Stufe 2', description = 'Schaltet Schütze Stufe 2 frei.'
where id = 'marksman_tier_2';
update public.research_definitions set
  name = 'Schütze Stufe 3', description = 'Schaltet Schütze Stufe 3 frei.'
where id = 'marksman_tier_3';
update public.research_definitions set
  name = 'Schütze Stufe 4', description = 'Schaltet Schütze Stufe 4 frei.'
where id = 'marksman_tier_4';
update public.research_definitions set
  name = 'Schütze Stufe 5', description = 'Schaltet Schütze Stufe 5 frei.'
where id = 'marksman_tier_5';

-- ─── 2) Gilden → Crew ────────────────────────────────────────────────────
update public.research_definitions set
  name = 'Crew-Verband',
  description = '+5% Crew-XP pro Stufe.'
where id = 'soc_gildenbonus';

update public.research_definitions set
  name = 'Wächter-Inspiration',
  description = '+5% Wächter-ATK pro Stufe.'
where id = 'soc_inspiration_2';

-- ─── 3) Resource-Themen angleichen ───────────────────────────────────────

-- HOLZ = Tech-Schrott (Schrott-Sammler bleibt, Bauholz-Beschaffung wird thematisch)
update public.research_definitions set
  description = '+5% Tech-Schrott pro Stufe — mehr Paletten und Verschnitt aus dem Kiez.'
where id = 'eco_holzfaeller';

update public.research_definitions set
  name = 'Recycling-Netzwerk',
  description = '+8% Tech-Schrott pro Stufe (Stufe 2) — feste Schrott-Routen etablieren.'
where id = 'eco_forstwirtschaft';

-- STEIN = Komponenten (Pflasterstein/Asphalt → Komponenten-Wording)
update public.research_definitions set
  name = 'Bauteile-Bergung',
  description = '+5% Komponenten pro Stufe — Schrott zerlegen, Brauchbares retten.'
where id = 'eco_steinbruch';

update public.research_definitions set
  name = 'Bauteile-Veredelung',
  description = '+8% Komponenten pro Stufe (Stufe 2) — auch ausgereiftere Teile bergen.'
where id = 'eco_eisenbearbeitung';

-- GOLD = Krypto (Schwarzmarkt-Kontakte bleibt thematisch okay; Goldkanten-Schleifer wird Krypto)
update public.research_definitions set
  description = '+5% Krypto pro Stufe — bessere Deals beim Hinterhof-Tausch.'
where id = 'eco_handel';

update public.research_definitions set
  name = 'Krypto-Trading',
  description = '+8% Krypto pro Stufe (Stufe 2) — höhere Marge beim Tausch.'
where id = 'eco_goldverarbeitung';

-- MANA = Bandbreite (Coffein-Tanks → Bandbreiten-Multiplexer)
update public.research_definitions set
  name = 'Bandbreiten-Multiplexer',
  description = '+5% Bandbreite pro Stufe — die Crew bleibt länger online.'
where id = 'eco_manaernte';

-- Lager-Beschreibungen: "Lager-Kapazität" statt einfach "Lager" — passt
update public.research_definitions set
  name = 'Lager-Optimierung',
  description = '+10% Lager-Kapazität pro Stufe (Stufe 2) — clever gestapelt.'
where id = 'eco_architektur';

-- Edelstein-Hehler → Diamanten-Hehler (Edelstein-Drops sind eigentlich Diamanten)
update public.research_definitions set
  name = 'Diamanten-Hehler',
  description = 'Schaltet seltene Diamanten-Drops aus Truhen frei.'
where id = 'eco_edelstein';

-- ─── 4) Misc-Beschreibungen die generisch waren ──────────────────────────
-- Stahl-Container Beschreibung schon ok ("+8% Lager-Kapazität pro Stufe")
-- Truppen-Bezeichnungen Brecher/Kurier/Türsteher passen schon
-- Inf_logistik "Kiez-Logistik" passt
