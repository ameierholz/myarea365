# Master-Konzept MyArea365.de — Strategisches Übertreffen von CoD & RoK

**Stand**: 2026-05-11
**Scope**: 4X-Strategie auf echter Weltkarte, in realen Städten, die CoD/RoK in jeder Hinsicht übertrifft.

---

## 0. Executive Summary

**One-Liner**: 4X-Strategie auf der echten Stadt-Karte, in der Topografie, Wetter und Verkehrsknotenpunkte tatsächlich strategisches Gewicht haben — nicht als Skin, sondern als Game-Mechanik.

**Stand heute (2026-05-11)**:
- 3 Stadt-Server live (Berlin/Hamburg/München), PLZ-Zuweisung automatisch
- OSM-Terrain-Polygone in Postgres+PostGIS (29.699 Polygone Berlin)
- Live-Wetter mit echtem Combat-Modifier (Mig 00324–00326)
- Vollständiger RoK/CoD-Feature-Anschluss (Mig 00295–00352): Crew-Hierarchie, Don, Hospital, Diplomacy, Mail, Mighty-Governor, Equipment-Sets, Expedition, Raid, Frames, Pets, Wächter-Sterne, Pull-System
- 14 Wächter mit RoK-style Rarity/Faction/Welle-System

**3 USPs, die uns vom Klon zur Nummer 1 machen**:
1. **OSM-Polygone als Combat-Layer** — Wald gibt Tatsache Bonus, nicht nur Optisch
2. **Wetter & Tageszeit als taktisches Mid-Game** — Counterspiel statt Reroll
3. **Real-Verkehrsknoten als CvC-Portale** — keine Fantasy-Türen, sondern echte Flughäfen/Bahnhöfe

---

## 1. Feature-Audit & Vergleich

### Matrix CoD vs. RoK vs. MyArea365

| Bereich | RoK | CoD | MyArea365 IST | Plan: Übertreffen durch |
|---|---|---|---|---|
| **3D-Terrain** | flache 2.5D | echtes 3D, Höhenmeter | OSM-Polygone (PostGIS) live | Höhenmeter aus DEM-Daten + Sichtblockade durch Gebäude |
| **Behemoths** | Lost Kingdom Beasts | weltklasse, Kern-Identität | ⚠️ Banditen-Modal vorhanden, keine echten Behemoths | Real-Landmarks als Boss-Spawns (Reichstag/Charité/TU) mit POI-Größe → HP |
| **Free-Healing** | Heilung kostet RSS | Free-Healing nach Kampf | Hospital live (Mig 00300) | Sanitätshäuser auf echten Krankenhaus-POIs → +50% Heilrate |
| **Ranged Combat** | Bogen=Range-Buff | echte Range-Mechanik | troop_class.marksman live, ranged_position-Spalte fehlt | Range-Brackets (close/mid/far) + Cover-System aus OSM-Gebäuden |
| **Alliance-Struktur** | tief, dauerhaft, 100+ | flach, ~30 Spieler | Crew mit Hierarchie (Mig 00295), Diplomatie (NAP/Allied/Enemy) | Crew-Treffen-Mechanik (s. §5) + Don-System (Mig 00296) |
| **Kingdom-Management** | träge, mit "Pass" wechselbar | nicht vorhanden | Stadt-Server mit Migration-Token (7d-CD) | Diaspora-Mode (s. §3) löst Newbie-Problem |
| **Commander-System** | historisch, viele | Fantasy, sammelbar | 14 Wächter (3 Fraktionen, 4 Rarities, Wellen) | Wächter sind urban-cyber, eigene IP statt Asset-Klon |
| **Battle-Pass** | Pass + Kingdom-Pass | Kingdom-Pass + Season | Mig 00297/00298 live, Free/Premium/Premium-Plus | Quest-basiert statt time-spent (s. §7) |
| **Equipment-Sets** | tief, +Stats | tief, +Stats | Mig 00302 (royal_armor/marauder/tactician) | Real-World-Materialien (Beton/Glas/Stahl) statt Fantasy |
| **Pets/Behemoth-Reit** | nicht vorhanden | Behemoth-Mounts | Mig 00302 (4 Archetypes) | Stadt-spezifische Pets (Berliner Bär, Hamburger Möwe) |
| **Solo-Endgame** | Expedition (~80 Stages) | Expedition (~80 Stages) | Mig 00302 (30 Stages, ausbaubar) | City-Story-Arcs statt generische Map |
| **Soziales/IRL** | ❌ | ❌ | ❌ (geplant: Treffen-Mechanik) | **echter Blue Ocean** — Crew-Treff-Buffs |

### Spieler-Pain-Points beider Vorbilder → unsere Eliminierung

| Pain Point | Vorkommen | Unsere Lösung |
|---|---|---|
| **Pay-to-Win in KvK** | RoK extrem | CvC-Stat-Caps + Skill-Multiplikatoren via Terrain/Wetter (s. §7) |
| **Account-Switch-Frustration** | RoK ("Account-Trade-Markt") | Migration-Token (Mig 00303), 7d-CD, kein Bezahl-Aspekt |
| **Repetitives Endgame** | beide | Era-Reset mit verschiebbarem Throne (s. §4) |
| **Träges Kingdom-Switching** | RoK ("Migration locked") | PLZ-Auto-Assignment + Diaspora-Mode |
| **Vereinsamung in toten Allianzen** | beide | Treff-Mechanik zwingt zur sozialen Reaktivierung (s. §5) |
| **Bot-Farms (Auto-Walk)** | nicht in CoD/RoK, war bei uns | bereits gefixt mit Pivot — kein Walking mehr |
| **Akku-Killer (Pokémon-GO-Vergleich)** | nicht in CoD/RoK | Wir auch nicht — kein Real-Walking-Requirement |
| **Sucht-Schleife ohne Pause** | beide | Bezirk-Cooldown 7d (Mig 00339) statt Daily-Reset — Anti-Farming-Pattern auf alles übertragbar |

---

## 2. Real-World Integration (USP-Maximierung)

### 2.1 Dynamische Topografie aus OSM (teilweise live, ausbaubar)

**Aktuell** (Mig 00326/00327): 11 OSM-Tags getaggt mit Priority-Ranking. `get_terrain_at(city, lat, lng)` → Tag.

**Plan: Combat-Modifier pro OSM-Tag**

| OSM-Tag | Gather-Effekt | Combat-Effekt | Move-Effekt |
|---|---|---|---|
| `forest` | Holz +30%, Mana +15% | Verteidigung +15%, Cavalry -10% Sicht | -10% Speed |
| `water` | — | Marsch **blockiert** (außer Hafen/Brücke) | n/a |
| `industrial` | Komponenten +40% | Diebe +20% Plünder | normal |
| `park` | Mana +20% | Heilrate +50%, Belagerung -25% | +10% Speed |
| `hospital` | — | Heilrate +100% bei Defense | normal |
| `government` | — | **Boss-Spawn-Trigger** | langsam (-15%) |
| `university` | Bandbreite +50% | Forschung-Speed +20% lokal | normal |
| `motorway` | — | Hinterhalt-Penalty (sichtbar) | +30% Speed |
| `commercial` | Krypto +25% | — | +5% Speed |
| `tourism` | RSS Mix +10% | Boss-Spawn (Sehenswürdigkeiten) | normal |
| `warehouse` | Holz/Komponenten +20% | Cover gegen Ranged | normal |

**Innovation: Layered-Terrain**. Beispiel: Marsch durch Wald (forest) bei Regen → Holz-Gather +30%, Schützen -20% (Wetter), Sichtbarkeit -50% → perfekt für Hinterhalt.

### 2.2 Taktisches Terrain (neu, nicht live)

**Brücken-Choke** (echte OSM-`bridge=yes`-Tags):
- Marsch über Brücke = max 5.000 Truppen-Slot
- Crew kann Brücke "halten" (Holding-Marker, 30min) → -50% Marsch-Durchsatz für Gegner
- Beispiel Berlin: Oberbaumbrücke = wichtiger Choke zwischen Friedrichshain ↔ Kreuzberg

**Autobahnkreuz-Logistik-Lockdown**:
- Crew kann Autobahnkreuz (z. B. Berlin Funkturm) für 24h blockieren (Kosten: 500k aller RSS + 10 Wächter)
- Effekt: alle gegnerischen Crews bekommen +50% Marsch-Zeit zwischen den 4 Quadranten
- Counter: 3 Crews verbünden sich, brechen Block in 6h

**Bahnhof = Sub-Server-Portal** (s. §4):
- Hauptbahnhof / Ostbahnhof / Südkreuz = Portal-POI auf Map
- 1h Truppen-Transport zu anderem Stadt-Server (CvC-Mechanik)

**Sehenswürdigkeit als Throne-Stronghold**:
- Reichstag (Berlin), Rathaus (Hamburg), Marienplatz (München) = Stadt-Don-Throne
- Belagerung wie bestehende Stronghold-Mechanik, aber pro Stadt nur EINE Position

### 2.3 Skill over Wallet (taktische Tiefe)

**Marsch-Routing-Wahl** (neu):
- Kürzester Pfad (default) vs. Buff-reicher Pfad (über Wald für Heal+Sicht) vs. Sicherer Pfad (über Crew-Territorium)
- Spieler wählt am Start des Marsches — keine Auto-Optimierung
- Routing nutzt OSM-Straßen-Graph, nicht Luftlinie (bereits in `sample_route_speed_mult`, Mig 00337)

**Hinterhalt-Mechanik**:
- Crew kann Wegpunkt setzen (Pin auf Straße/Brücke)
- Wenn gegnerischer Marsch durchläuft → Auto-Engagement
- Aktive Spieler-Wahl vs. AFK-Walk-Loot — Skill-Element

**Counter-Wetter-Plays**:
- Sturm-Forecast 6h vorher in UI sichtbar
- Crew kann Angriff timen wenn Gegner-Composition feindlich zum Wetter ist
- Beispiel: gegnerische Crew ist Marksman-heavy → bei Regen angreifen (Mig 00325 -20%)

### 2.4 Wetter & Tag/Nacht (teils live)

**Live in Mig 00325**:
- Regen → Schützen -20%
- Sturm → Schützen -30%, Brecher +10%
- Nacht → Kurier +15%
- Hitze → Verteidigung -10%
- Schnee → Konstrukteur-Schaden +10%

**Erweitern**:
- Nebel → Sichtweite -50%, Spähradius -50%, Hinterhalt-Bonus +30%
- Hitzewelle (>32°) → Marsch-Speed -20%, Wasser-RSS +50%
- Gewitter → Mage/Magic-Crit +20%, Tech-RSS -30%
- Schneesturm → komplette Map-Spähradius -30%
- Tag/Nacht-Cycle (echt nach Sonnenstand): Diebe-Klasse +25% nachts, Konstrukteur +15% tagsüber

**Forecasting-UI**: Wetter-Pille zeigt aktuell + 6h forecast → strategische Planung möglich.

---

## 3. Server-Architektur & City-Instanzen

### 3.1 Aktueller Stand (live)

- `city_servers` Tabelle, 3 aktive Server (Berlin/Hamburg/München)
- PLZ-Auto-Assignment via `home_plz` → `city_server_id`
- `activate_city_server(city_name, plz_ranges)` als Admin-RPC (Mig 00303)
- Migration-Token (`change_home_city`, 7d-CD)
- Era-Reset-Pipeline mit `era_wipe_state`

### 3.2 Newbie-Fairness (neu)

**E0-Schutz (Eternal-Zero)**:
- Neue Spieler in den ersten 14 Tagen sind **unangreifbar in CvC**
- Sichtbar auf Map als E0-Pin (visuell, nicht hidden — Soziales Signal "Newbie, bitte nicht raiden")
- Auto-Crew-Vorschlag basierend auf Stadt + Spielstil

**Era-Stages für faire Server-Eröffnung**:
- Tag 1-7: nur Sammeln + PvE (kein PvP)
- Tag 8-21: PvP nur mit gleichem Stadt-Server, kein CvC
- Tag 22+: Vollausbau

### 3.3 Diaspora-Mode (Innovation, neu)

**Problem**: Spieler in Cottbus, Tübingen, Görlitz haben keinen lokalen Stadt-Server.

**Lösung**:
- Diaspora-Pool sammelt Spieler aus PLZ ohne Stadt-Server
- Sie werden virtuell einer Wahl-Stadt zugewiesen (während Onboarding)
- Bekommen "Diaspora-Bonus": +25% gather, +10% combat — als Ausgleich für fehlende lokale Karte
- Sobald 100 aktive Spieler in einer Region → Stadt-Server-Vorschlag via Push
- Spieler können dann mit Migration-Token in den neuen Server umziehen

### 3.4 Server-Lifecycle

- **Bootstrap**: Admin-Wizard fragt Stadt-Name, PLZ-Range, OSM-Import-Trigger
- **Phase Wachstum**: 0–1000 Spieler — kein CvC, nur Diaspora-Bonus
- **Phase Established**: 1000+ Spieler — CvC aktiv, Throne-Stronghold spawnt
- **Phase End-of-Era**: nach 180 Tagen — Era-Reset, alle Karten wipen, Don/Wächter/Inventar bleiben

---

## 4. CvC Endgame (Crew vs. Crew & City vs. City)

### 4.1 Faires Matchmaking (Skizze)

**City-Strength-Score** = Σ top-50-Power + Σ top-3-Crew-Power + Stadt-Don-Aura.

**Matchmaking-Pool**:
- ±15% Strength-Toleranz
- ±2 Era-Number (verhindert Match Wachstums-Server gegen End-of-Era-Server)
- ±50% Aktivitäts-Score (Daily-Active-Users last 7d)

**Falls kein Match**: Diaspora-Aggregation — mehrere kleine Städte werden virtuell zusammengeschlossen für 1 CvC-Wochenende.

### 4.2 Reale Portale (Killer-USP)

**Flughafen = Inter-City-Portal** (Berlin Tegel/BER, Hamburg Fuhlsbüttel, München MUC):
- Crew kann Truppen-Transport buchen (Kosten: 500 Diamanten + 1.000.000 RSS)
- Truppen "fliegen" 60min zu Ziel-Flughafen
- Können auf Ziel-Stadt-Server für 4h kämpfen, dann zurück
- Nutzbar nur während CvC-Saison

**Hauptbahnhof = Sub-Server-Portal**:
- 30min Crew-Raid in beliebige Nachbar-Stadt
- 1× pro Woche pro Crew
- Beute = 10% der attackierten Stadt-Wochen-RSS

**Hafen** (Hamburg, München via Donau-Kanal nicht echt, aber Berlin via Spree):
- Container-Transport: bulk-RSS-Move zwischen Crew-Lagern verschiedener Städte
- Kein PvP, nur Logistik

### 4.3 Throne-of-Earth (Killer-Feature gegen Repetition)

**Konzept**: Eine **globale** Throne-Stadt pro Saison.

- Algorithmus wählt Top-3-Aggregate-Power-Stadt nach Era-Start
- Alle Crews aller Stadt-Server können Truppen entsenden (über Flughafen-Portal)
- 7-Tage-Belagerung um Throne (immer Reichstag/Rathaus/Marienplatz der Throne-Stadt)
- Sieger-Crew bekommt **Don-of-Earth-Aura**: +5% all-stats für ALLE Mitglieder ALLER Crews aller Stadt-Server, die zur Sieger-Stadt gehören
- Era-Reset = neue Throne-Stadt

**Warum übertrifft das KvK von RoK**:
- RoK-KvK: 8 Königreiche kämpfen, viele schauen zu
- Throne-of-Earth: alle Städte sind beteiligt, Schwächere können sich Allianzen mit Stärkeren anschließen → mehr Spieler beteiligt
- Sichtbar im Real-Bezug: "Berlin verteidigt Reichstag gegen München" hat erzählerischen Wert

### 4.4 Anti-Repetition-Loops

**Saisonal-Themen**: Jede Era hat ein Thema (z. B. "Behörden-Krise", "Cyber-Sturm", "Mutanten-Welle") mit unterschiedlichen Buff-Sets.

**Wandern-Quests**: Endgame-Spieler kriegen wöchentlich Stadt-Discovery-Quests in fremden Städten (über Bahnhof-Portal). Belohnung: einzigartige Wächter-Skins.

---

## 5. Innovations & Crew-Features (Blue Ocean)

### 5.1 AR-Layer (Phase 5, geplant)

- Kamera scannt POI → Wächter erscheint AR-overlayed
- "Capture-Pose" für Crew-Memorabilia (Social-Share)
- AR-Foto-Modus als Cosmetic-Reward (Battle-Pass-Premium-Plus)

**Tech-Stack**: WebXR / Capacitor-AR Plugin / oder native expo-AR — Phase-5-Recherche.

### 5.2 Wirtschaftssimulation (mittel)

**Stadt-Markt** (neu):
- Trader-NPC auf Map (rotiert wöchentlich)
- Bietet Crew-Resources gegen Diamanten oder andere RSS
- Wechselkurs aus aggregierten Stadt-RSS-Pools (Supply/Demand)

**Crew-Bauwerke generieren Stadt-Pool**:
- Pro Crew-Bauwerk +1% zur Stadt-Wochen-Produktion
- Alle Crews der Stadt profitieren (Shared Pool, Anti-Free-Riding via min. 5% Beitrag)

**Real-Goods-Sponsoring** (CLAUDE.md erwähnt B2B):
- Lokale Geschäfte zahlen für Pin-Sichtbarkeit
- Spieler scannt QR-Code beim Geschäft = +5% gather 24h
- Geschäft kriegt Foot-Traffic, Spieler kriegt Buff, App kriegt Umsatz — Win-Win-Win

### 5.3 Crew-IRL-Features (Blue Ocean Kern)

**Treff-Mechanik** (Killer-Soziales):
- Crew-Leader setzt "Treff-Pin" (Café, Bar, Park)
- Mitglieder check-in physisch (GPS-Range 100m, 2h-Window)
- 3+ Mitglieder am Treff = **Treff-Buff für ganze Crew**: +50% gather 24h, +20% combat in der Stadt
- Anti-Cheat: Speed-Plausibilität, Bewegungs-Muster
- Privacy: Pin ist öffentlich gesetzt, nicht geheim getrackt

**Crew-Wandertag-Event** (monatlich):
- Crew muss kollektiv 100km in 7 Tagen erlaufen (Schrittzähler)
- Belohnung: legendäres Crew-Banner + 10% Stadt-Don-Vote-Bonus
- Nicht-Voraussetzung für Spielfortschritt — optional

**City-Discovery-Pin-Wall**:
- Jeder Crew-Member kann Stadt-POIs "Crew-claimen" (visit-once-Mechanik)
- Crew-Skyline = visualisiert was die Crew zusammen erlebt hat
- Reward: Skins/Frames an Discovery-Milestones (10/50/100 POIs)

### 5.4 Quest-Innovationen

**Pendel-Quests**:
- App erkennt regelmäßige Bewegungs-Muster (z. B. tägliche Pendel-Route)
- Generiert Quest entlang dieser Route: "Sammle 3 Wegelager an deinem Heimweg"
- Erfüllt sich passiv über den Tag, ohne Detour
- Funktioniert ohne Walking-Requirement — Marsch-System macht das

**Tourist-Quests**:
- Spieler in fremder Stadt (über Bahnhof-Portal) bekommt Tourist-Quest-Line
- "Besuche 3 Sehenswürdigkeiten in München" → spezielle Wächter-Skin freischalten

---

## 6. PvE-System & Lore

### 6.1 Lore-Foundation (urban-cyber, eigene IP)

**Welt-Setup**:
- Spielen in nahöstlicher Zukunft (~2080)
- Nach Kollaps der Mega-Konzerne entstand Stadtfraktionen-Chaos
- Spieler = Don einer aufsteigenden Crew, baut Macht in zerfallenden Stadt-Ruinen

**3 Faktionen (live)**:
- **Gossenbund** (Slum, Wilderness-Equivalent)
- **Kronenwacht** (Ordnung, Liga-Equivalent)
- **Netzhüter** (Hacker, Quellhüter-Equivalent)

**Geo-Lore**: Berlin = "Hauptstadt der Netzhüter", Hamburg = "Hafenfreistadt der Gossenbund", München = "Königswacht der Kronenwacht" → Stadt-Identity über Faction-Bias.

### 6.2 PvE-Gegner (neu, ausbaubar)

**Allgemeine Wegelager** (live, Banditen-Modal):
- Auf Straßen-POIs (motorway/trunk/primary)
- Stufen-abhängig vom Spieler-Level
- Drops: Common-RSS, Marken

**Mutanten** (neu, Industrie):
- Spawn auf `industrial`-Polygonen
- Higher-Tier-Gegner mit Komponenten-Drops + Speedups
- Wave-Based: alle 4h spawned eine neue Mutanten-Welle pro Industriegebiet

**KI-Konzern-Mechs** (neu, Government):
- Spawn auf `government`-Polygonen (Behörden, Ministerien)
- Mini-Behemoth — 1-Stunden-Burn-Down
- Drops: Legendary-Equipment-Set-Pieces

**Kult-Sammler** (neu, Friedhöfe / `cemetery`):
- Phantom-Gegner, nur Nachts (>20 Uhr)
- Drops: Wächter-Seelenmarken (rare Currency für Awakening)

**Hacker-Hordes** (neu, Universities):
- Spawn auf `university`-Polygonen
- Schwarm-Encounter (viele schwache Gegner)
- Drops: Bandbreite (Mana), Forschungs-Boosts

### 6.3 Behemoths an Landmarks (Killer-PvE)

**Real-Landmark-Boss-Spawns**:

| Landmark | Boss-Name | Rarity | Special |
|---|---|---|---|
| Reichstag (Berlin) | "Reichstag-Wächter" | Legendary | Polit-Buff: +20% Diplomacy |
| TU Berlin | "Daten-Kraken" | Epic | Mana-Vampir |
| Charité | "Pestlord" | Legendary | Heal-Field-Negator |
| Hauptbahnhof Berlin | "Schienenmarodeur" | Epic | Speed-Drain |
| Olympiastadion | "Arenakönig" | Legendary | PvE-Only-Boss, Sport-Themed |
| Marienplatz München | "Glockenwart" | Epic | Sound-Wellen-AoE |
| Speicherstadt Hamburg | "Kran-Titan" | Legendary | Crane-Range-Atk |

**Mechanik**:
- Spawn-Trigger: `primary_tag IN ('government','tourism','university','hospital')` aus `city_terrain_polygons`
- Boss-HP-Skalierung: aus OSM-Polygon-Größe (Reichstag-Area in m² → HP)
- 24h-Killing-Window pro Spawn
- Multi-Crew-Engagement möglich (CoD-Pattern)
- Drop-Tabelle: Wächter-Marken, Equipment, Skins, Diamanten

### 6.4 Quest-System

**City-Story-Arcs** (neu):
- Pro Stadt 12-Kapitel-Hauptstory (z. B. Berlin: "Mauerwall-Krise")
- Geo-Triggered: Spieler ist in PLZ → Quest verfügbar
- Reward: einzigartige City-Wächter (Berliner Bär als Pet)

**Daily-Crawl**:
- 3 Quests entlang real-walkable Route
- Spieler erfüllt sie ohne extra Aufwand
- Reward: kleine RSS-Pakete + Battle-Pass-XP

---

## 7. Fair-Play-Wirtschaft & Monetarisierung

### 7.1 Was wird verkauft (klar definiert)

**Tier 1 - Reine Kosmetik** (keine Power):
- Frames, Titel, Pet-Skins, Wächter-Skins, Map-Themes
- Avatar-Frames + Title-Shop (Mig 00302 live)

**Tier 2 - Zeitersparnis**:
- Speedups (alle Längen)
- Speed-Tokens (Mig 00291 live, Pflicht für Lv24→25)
- Resource-Pakete (small/medium/large)

**Tier 3 - Convenience**:
- Battle-Pass Free/Premium/Premium-Plus (Mig 00298)
- Subscriptions: 4.99/9.99/19.99 EUR (Mig 00297)
- Monthly-Pack mit täglichem Daily-Reward

**Tier 4 - Sammeln (mit Pity)**:
- Schlüssel für Pulls (key_silver/gold) — Pity-System (Mig 00352)
- Diamanten als Premium-Currency

**IAP-Channel-Split** (live):
- Stripe NUR Web
- Play/Apple Billing PFLICHT in Apps (90/10-Anteil-Spar)

### 7.2 Was wird **NICHT** verkauft (Anti-P2W-Pakt)

- Keine direkten Power-Boosts in CvC ("buy 30% all-stats" wie RoK)
- Keine Truppen-Boost in laufender Schlacht
- Keine Wächter direkt kaufen — nur über Pull (Pity garantiert)
- Keine Resource-Pakete an Top-100-Spieler (Anti-Whale-Schutz, neu)
- Keine Speedup-Auto-Use in CvC-Hot-Phase (10min-Lockout während Belagerung)

### 7.3 CvC-Fair-Play-Mechaniken (Innovation)

**Stat-Cap im CvC**:
- Spieler über Power-Median ×2 bekommen flachen Combat-Cap
- Sie können trotzdem dominieren — aber nicht 10× besser als der Durchschnitt
- Skill-Spieler mit gutem Terrain-Timing schlagen pure Stats

**Wetter-Skill-Multiplikator**:
- Wenn Crew bei richtigem Wetter im richtigen Terrain mit richtiger Composition angreift:
  - Wald + Regen + Verteidigung Marksman-Lite-Setup = 1.5× Effektivität
- Whale ohne diese Optimierung schlägt nicht-Whale-mit-Optimierung

**Throne-Buff-Limit**:
- Don-Aura ist gecappt auf +5% all-stats (nicht stackbar mit anderen Don-Auras)

### 7.4 Sponsor-Modell (B2B-Säule)

**Lokale Geschäfte zahlen für**:
- Premium-Pin-Sichtbarkeit auf Map (39 EUR/Monat)
- Branded-Buff-Code: Geschäft druckt QR-Code, Scan = +5% gather 24h
- Geschäfte-Network-Quest: "Besuche 5 Partner-Geschäfte" → Equipment-Set-Piece

**Skalierbar**:
- Berlin allein hat ~5000 Geschäfte, die Werbung kaufen würden
- Bei 1% Conversion = 50 zahlende × 39 EUR = 1.950 EUR/Monat **pro Stadt**

### 7.5 Battle-Pass-Innovation (Quest- statt Time-spent)

**Standard-Pass** (wie RoK/CoD): Daily-Tasks erfüllen, XP sammeln.

**Unser Twist**:
- Real-World-Quests integriert: "Besuche 3 verschiedene Stadtteile" via PLZ-Detection
- Crew-Quests: gemeinsam erfüllen für Boni
- Saisonale Themen-Quests passend zur Era

---

## 8. Tech-Performance & Real-World-Compliance

### 8.1 Akku & Daten

**Adaptive Update-Intervalle**:
- Default: GPS alle 5min (nur für PLZ-Sanity-Check, nicht für Walking)
- CvC-Active-Zone: 30s (nur wenn Spieler aktiv im CvC ist)
- Background: 0 GPS-Calls (App ist server-side, Marches laufen ohne Client)

**Map-Caching**:
- OSM-Polygone server-side gehostet (PostGIS) — kein per-User-Overpass-Call
- Map-Tiles via Mapbox CDN
- Custom Vector-Tiles für Crew-Bauten/Pins (cacheable)

**Battery-Strategie**:
- WebGL 2D-Map statt 3D-Engine (Mapbox GL JS)
- 3D-Sprites nur für Wächter/Pets im Modal, nicht Map
- Hardware-Acceleration nur wenn verfügbar

**Datenvolumen**:
- Initial Map-Load: ~2-3 MB (cached für 7 Tage)
- Marsch-Live-Updates: ~50 KB/min (Polling 5s × ~100 Bytes pro Update)
- Pro 1h Spielzeit: ~30 MB

### 8.2 Real-World-Safety (Anti-Pokémon-GO-Trauma)

**Kein Walking-Requirement** (Pivot ist durch):
- Marsche real-time, aber server-side simuliert
- Spieler muss NICHT physisch laufen
- Treff-Mechanik (§5.3) ist OPTIONAL für Buff, nicht für Progression

**Privatgrundstück-Schutz**:
- OSM = nur public POIs
- Spieler-Pins werden nicht auf Privat-Grund gerendert (Adress-Filter via OSM `building=yes` + `addr:housenumber`)
- Crew-Treffen-Pins nur auf Café/Bar/Park-POIs (`amenity` IN whitelist)

**Tageszeit-Limits**:
- Nachts (22-06 Uhr): keine PvE-Boss-Quests im Real-World-Trigger (z. B. Friedhof-Mechanik nur tagsüber sichtbar)
- Erwachsene können das in Settings deaktivieren

**Anti-Spoofing** (für CvC-Fairness):
- Speed-Plausibilität (>120 km/h ohne Verkehrsknoten = Verdacht)
- Stadt-Server-Lock: kein Schummeln in fremde Stadt-Server
- Migration-Token mit 7d-CD verhindert Schummel-Hopping

### 8.3 DSGVO & Compliance

**Datenminimum**:
- Realer Standort NUR für PLZ-Detection (1× beim Onboarding + bei Treff-Check-in)
- Keine Bewegungs-Tracks gespeichert (kein Walking)
- Marsch-Routen sind virtuelle Pins, kein Real-Geo-Tracking

**Cookie-Policy**:
- Map-Tiles laden mit anonymem CDN-Request
- Mapbox/Sentry/Stripe/Supabase explizit in Privacy-Policy benannt

**Account-Delete**:
- Self-Service-Delete (vollständige RSS+Wächter+History-Löschung in 30 Tagen)
- Kein "Account-Reaktivierung" (RoK-Pattern, problematisch)

### 8.4 Test-IDs vs. Production

**Aktueller Stand** (Memory-Hinweis): AdMob hat Production-AppID im Manifest, CLAUDE.md fordert Test-IDs während Entwicklung. **Fix-Pflicht** vor Internal-Test-Build.

---

## Roadmap (6 Monate, daraus Lieferplan)

| Monat | Sprint | Lieferung |
|---|---|---|
| M1 (jetzt) | Real-World 1 (✅ LIVE) | Wetter + OSM-Foundation |
| M2 | Behemoth-Bosses an Landmarks | §6.3, government-Spawn-Logik, Multi-Crew-Engagement |
| M3 | Crew-Treff-Mechanik + Tech-Tree | §5.3, GPS-Check-in mit Privacy-Filter |
| M4 | CvC-Portale + Diaspora-Mode | §4.2, §3.3 |
| M5 | Throne-of-Earth + AR-Tease | §4.3, optional AR-Foto-Mode |
| M6 | iOS/Android-Launch + Vollausbau | Play-Store-Phasen aus `project_audit_open_tasks.md` |

---

## Sofort umsetzbare Quick-Wins (nächste 2 Wochen)

1. **OSM-Combat-Modifier expansion** (2 Tage) — `terrain_modifiers_for_tag` um Combat-Multiplikatoren ergänzen, in `resolve_player_base_attack` einbauen
2. **Behemoth-Spawner-Cron** (3 Tage) — Mig + Cron-Job für Boss-Spawns an `government`-Polygonen
3. **Brücken-Choke** (4 Tage) — `bridge=yes`-Lookup in `start_march`, Truppen-Cap bei Brücken-Pass
4. **Tourist-Quest-Skeleton** (2 Tage) — Bahnhof-Portal-Detection + Quest-Trigger in fremder Stadt
5. **Stat-Cap im CvC** (3 Tage) — Median-Power-Berechnung + Combat-Resolver-Hook
