# Wächter-System: CoD/RoK-Umbau — Konzept

**Status:** Entwurf — zur Diskussion
**Ziel:** Bestehendes Wächter-System (20 Archetypen, simpel) auf Call of Dragons / Rise of Kingdoms Tiefe umbauen, bei Beibehaltung der MyArea365-USPs (Shop-Arena-Bindung, Walking als XP-Quelle, humanoide Stadt-Archetypen).

---

## 1. Design-Prinzipien

1. **CoD-Struktur als Vorlage**, nicht 1:1 Klon. Klauen was funktioniert, weglassen was zu schwer ist.
2. **Niedrige Einstiegshürde trotz Tiefe** — per Feature-Drip (stufenweises Freischalten) und Default-Builds (1-Klick-Empfehlungen).
3. **Walking-First** — jedes System muss zur Gehen-Kern-Loop passen. Kein Overhead der vom Draußen-Sein abhält.
4. **USPs bleiben:** Shop-gebundene Arenen, Crew-System, humanoide Archetypen.

---

## 2. Wächter-Pool

### Umfang
- **Ziel-Pool: 60 Wächter** (20 Legendär / 20 Episch / 20 Elite)
- **Launch-Pool: 30 Wächter** (10/10/10), Rest als Season-2-Content
- Aktuelle 20 werden übernommen/umgelabelt (6 common→elite, 6 rare→elite, 4 epic→episch, 4 legend→legendär)
- **Kein `common`** mehr — Elite ist die neue Einstiegsklasse

### Typen (4 Klassen)
| Typ | Symbol | Stark gegen | Schwach gegen |
|---|---|---|---|
| Infanterie | 🛡️ | Kavallerie | Scharfschützen |
| Kavallerie | 🐎 | Scharfschützen | Infanterie |
| Scharfschütze | 🏹 | Infanterie | Kavallerie |
| Magier | 🔮 | Wildcard (neutral) | Wildcard (neutral) |

- Stein-Schere-Papier: **+25% Schaden / -25% Schaden** bei Typen-Vorteil/-Nachteil
- Magier ignoriert Typ-Counter (immer neutral) — dafür keine Stärke gegen andere

### Level-System
- **Level-Cap: 60** (wie RoK)
- Walking-XP skaliert auf Level 60 (kein Instant-Grind)
- Pro Level-Up: **+1 Talentpunkt**
- XP-Kurve: progressiv, Lategame-Level (40-60) erfordern Tage/Wochen Walking

---

## 3. Talentbaum (RoK-Style)

### Struktur
- **Individueller Talentbaum pro Wächter** (nicht pro Typ)
- **3 Äste** pro Wächter, z.B.:
  - **Ast 1:** Rollen-Spezialisierung (DPS / Tank / Support — je nach Wächter)
  - **Ast 2:** Typ-Synergie (Buffs für eigenen Typ)
  - **Ast 3:** Utility / Situational (Arena-spezifisch, Boss-spezifisch, etc.)
- **~30 Nodes pro Baum** (RoK hat ~74 — halbiert für niedrigere Hürde)
- **Max 60 Punkte zum Vergeben** (bei Level 60 = alle Punkte investiert, aber nicht alle Nodes maxbar → **Build-Entscheidung**)

### Node-Typen
- **Stat-Nodes:** +X% HP/ATK/DEF/SPD (1-5 Ränge)
- **Keystone-Nodes:** einzigartige Buffs (z.B. „Erster Angriff +100% Schaden") — nur via tiefer Ast-Investment
- **Synergien:** funktionieren nur im Typ-Kontext

### Default-Builds
- **Jeder Wächter hat 2-3 empfohlene Builds** („Arena", „AreBoss", „Balanced")
- **1-Klick-Apply:** Anfänger müssen nicht selbst skillen
- Advanced-Spieler können Freestyle-Builds basteln

### Respec
- **Kosten:** Siegel-Währung (s.u.), mit Cooldown 7 Tage kostenlos
- Verhindert Min-Max-Switching vor jedem Kampf

---

## 4. Fähigkeiten (Skills)

### Struktur
- **5 Skills pro Wächter** (wie CoD/RoK-Commander):
  1. **Aktiv-Skill** (Rage-basiert, primäre Kampf-Fähigkeit)
  2. **Passiv-Skill** (immer aktiv)
  3. **Kampf-Skill** (triggert bei Schaden erhalten/zugefügt)
  4. **Rollen-Skill** (Infanterie/Kavallerie/Scharfschütze/Magier-spezifisch)
  5. **Expertise-Skill** (freigeschaltet wenn Skills 1-4 auf Max)
- **Jede Fähigkeit: 5 Stufen**
- Upgrade mit **Siegeln** (Drop-Währung aus Kämpfen)

### Rage-System (CoD)
- Im Kampf baut sich Rage auf (1000 max)
- Aktiv-Skill bei 1000 Rage automatisch getriggert
- Jede Stufe: +20% Effekt oder reduzierte Rage-Kosten

### Expertise
- Freigeschaltet wenn Skills 1-4 alle auf Stufe 5
- Massiver Power-Spike — Endgame-Ziel
- Siegel-Kosten: exponentiell (Skill-Stufe 4→5 ist teuer, Expertise 0→5 nochmal teurer)

---

## 5. Siegel-Währung (Skill-Upgrade-Material)

### Warum „Siegel"?
Eigener Begriff (nicht RoK-„Sculpting Jade" oder CoD-„Artifact Fragments"). Passt zu urbanem Setting (Stadt-Siegel, Gang-Zeichen).

### Varianten (nach Typ)
- **Infanterie-Siegel** (🛡️) — upgradet Infanterie-Wächter-Skills
- **Kavallerie-Siegel** (🐎)
- **Scharfschützen-Siegel** (🏹)
- **Magier-Siegel** (🔮)
- **Universal-Siegel** (⚡) — für alle Wächter, aber selten

### Drop-Quellen
| Quelle | Drops |
|---|---|
| **Arena-Sieg** | 1-3 typ-spezifische Siegel (je nach Gegner-Typ) |
| **AreBoss Loot Tier 1-3** | 5-15 Siegel (Typ gemischt) |
| **AreBoss Winner** | +Universal-Siegel Bonus |
| **Walking-Milestones** (10/30/100km) | Siegel-Pakete |
| **Tages-Missionen** | 1-2 Siegel pro Tag |
| **Shop-QR-Scan** | Seltene Chance auf Universal-Siegel |

### Kein Pay-to-Win
- Siegel **nicht kaufbar** mit Echtgeld
- Premium-Shop-Sichtbarkeit bringt B2B-Geld, nicht Siegel-Kauf

---

## 6. Loot-System (Arena + AreBoss)

### Arena-Loot (Shop-gebunden)
Pro Sieg:
- XP für kämpfenden Wächter
- 1-3 typ-spezifische Siegel (abhängig vom Gegner-Typ)
- Shop-Rabatt-Chance (Crosslink zu B2B)

### AreBoss-Loot (winner-takes-all + gestaffelt, **bereits implementiert**)
**Aktuelles System erweitern:**
- Winner: Große Siegel-Menge + Universal-Siegel + XP-Boost
- Platz 2-3: Mittlere Siegel-Menge
- Platz 4-10: Kleine Siegel-Menge + Trostpreis

### Seltene Drops
- **Wächter-Shards** (für Fusion/Upgrade in Season 2)
- **Artefakte** (CoD-Stil, nur Endgame, Season 2)

---

## 7. Kampf-System

### Arena 1v1 (aktuell)
- Beibehalten: 1 Wächter vs. 1 Wächter, Shop-gebunden
- **Neu:** Typ-Counter (Stein-Schere-Papier)
- **Neu:** Skills feuern basierend auf Rage-Aufbau
- **Neu:** Talentbaum-Buffs aktiv

### AreBoss (Crew vs. Boss, CoD Behemoth-Style)
- Crew-Leader startet Rally (bestehender Mechanismus)
- Jedes Mitglied schickt 1-3 Wächter (max 10 Spieler × 3 = 30 Wächter)
- Boss hat eigene Skills + Phasen
- Winner-takes-all (bereits da) + **Rally-Kontributions-Ranking**

### Neues: Crew-vs-Crew (CoD KvK light)
- **Später-Phase**: Crews können sich in Wochen-Events matchen
- Skip für erste Iteration (zu komplex)

---

## 8. Onboarding (Feature-Drip)

**Tag 1 (Registrierung):**
- Wizard wählt **Starter-Wächter** (1 Elite, aus jedem der 4 Typen einer)
- Nur Basis-Stats sichtbar (HP/ATK/DEF/SPD)
- Talentbaum + Skills **noch nicht sichtbar**

**Level 2-5 (erste km gelaufen):**
- Talentpunkt vergibt sich automatisch mit Default-Build
- „Empfohlen"-Badge zeigt System-Auswahl
- Erst ab Level 5: Manuelles Talent-Vergeben freigeschaltet

**Nach erstem Arena-Kampf:**
- Skills-Panel wird erklärt
- Erster Siegel-Drop mit Tutorial

**Nach erstem AreBoss:**
- Typ-Counter wird eingeführt
- Build-Varianten (Arena/Boss/Balanced) freigeschaltet

**Level 20+:**
- Expertise-Skill-System erklärt
- Advanced-Tooltips

→ **Anfänger sehen nie alles auf einmal.** Fortgeschrittene kriegen volle Tiefe.

---

## 9. Migration bestehender Spieler

- Bestehende Wächter-Levels 1-30 → bleiben, Cap hebt auf 60
- **Retro-Talentpunkte:** Level × 1 Punkt rückwirkend
- **Starter-Siegel-Paket:** Kompensation für bestehende Wins/Losses
- Typ-Zuweisung zu bestehenden Archetypen:
  - Bollwerk/Paladin → Infanterie
  - Sturmritter/Hauptmann → Kavallerie
  - Schnellklinge/Meuchler → Scharfschütze
  - Erzmagier/Apotheker → Magier
  - (Restliche Zuweisung in Seed-Migration)

---

## 10. Umsetzungs-Phasen

### Phase 1: Foundation (~1 Woche)
- Schema-Migration: Typen-Spalte, Talent-Table, Skill-Stufen-Table, Siegel-Inventar
- Level-Cap auf 60, XP-Kurve anpassen
- Typ-Counter-Logic in Arena
- Migration bestehender Wächter (Typ-Zuweisung + Retro-Punkte)

### Phase 2: Talentbaum (~1-2 Wochen)
- 3-Äste-Struktur pro Wächter (30 Nodes × 20 Wächter = 600 Nodes als Content-Arbeit — kann Templates nutzen)
- Default-Builds definieren (Arena/Boss/Balanced pro Wächter)
- UI: Talentbaum-Viewer + Node-Tooltip + 1-Klick-Apply

### Phase 3: Skills + Siegel (~1-2 Wochen)
- 5 Skills × 5 Stufen pro Wächter (Content-Arbeit)
- Rage-System im Kampf
- Siegel-Inventar-UI
- Skill-Upgrade-Flow
- Drop-Logik in Arena + AreBoss

### Phase 4: Onboarding + Feature-Drip (~1 Woche)
- Wizard-Update (Typ-Auswahl)
- Stufenweise Freischaltung (Level-Gates)
- Tutorial-Overlays für Erstnutzung

### Phase 5: Content-Expansion (~offen)
- 10 neue Wächter pro Rarität → auf 60 hochziehen
- Crew-vs-Crew (optional)
- Artefakte / Fusion (Season 2)

**Gesamt: ~5-7 Wochen Entwicklungszeit für Phase 1-4.**

---

## 11. Monetarisierung (Fair-Play-Modell)

### Grundprinzip
> **Wer viel geht, läuft und joggt, kommt schneller ans Ziel — nicht wer zahlt.**

Echtgeld kauft **Komfort und Aussehen**, niemals Power. Dies ist MyArea365s ehrliches Gegenmodell zu RoK/CoD („das faire Walking-RPG").

### Premium-Währung: **Edelsteine**
- Kaufbar mit Echtgeld (Standard-IAP-Staffeln)
- Verdienbar: tägliche Login-Boni, Achievements, seltene Walking-Milestones (z.B. alle 100km)
- Verwendung: siehe Tabelle unten

### Was mit Edelsteinen kaufbar ist (erlaubt)
| Kategorie | Beispiele | Begründung |
|---|---|---|
| **Cosmetics** | Wächter-Skins, Profil-Rahmen, Karten-Pin-Themes, Animations-FX | Reine Optik, kein Impact |
| **XP-Boost** | 2× XP für 1h / 4h / 24h (nur beim Gehen verdienbar, wird schneller) | Du musst trotzdem laufen |
| **Respec-Token** | Talentbaum neu vergeben ohne 7-Tage-Cooldown | Komfort, kein Stat-Gain |
| **Extra Loadout-Slots** | Mehr Build-Speicher pro Wächter | Komfort |
| **Arena-Pass (Monatspass)** | Tägliche Edelsteine + exklusive Skins + XP-Boost permanent | Wie RoK VIP, aber ohne Power |
| **Crew-Emblem-Anpassung** | Eigenes Logo, Farben, Banner | Community-Ausdruck |

### Was **NICHT** kaufbar ist (verboten)
- ❌ **Siegel** (Skill-Upgrade-Material) — nur Kampf/Walking
- ❌ **Wächter-Shards / Wächter-Unlocks** — nur Kampf/Walking
- ❌ **XP direkt** (nur Booster auf verdiente XP)
- ❌ **Talentpunkte** — nur durch Level-Up
- ❌ **Equipment** (bestehendes System bleibt verdient)
- ❌ **Lootboxen mit Wächter-Zufallszug** — DSGVO/Jugendschutz + unfair

### Shop-Struktur (angelehnt an CoD-Layout)
| Sektion | Inhalt |
|---|---|
| **Tagesangebote** | 1-3 rotierende Cosmetics, vergünstigt |
| **Edelsteinpakete** | Standard-IAP: 100 / 500 / 1200 / 2500 / 6000 Edelsteine |
| **Arena-Pass** | Monatsabo (z.B. 4,99€), tägliche Belohnungen |
| **Skin-Shop** | Permanent verfügbare Wächter-Skins |
| **Seasonal** | Limitierte Event-Cosmetics (Halloween, Weihnachten, Stadtmarathon-Tage) |

### Nicht-Ziele im Shop
- **Keine Tauschmünzen-Markt / Edelsteinmarkt für Power-Items** (im Screenshot sichtbar bei CoD → bewusst ausgelassen)
- **Keine „Lieferstation" mit Zufalls-Drops** (Lootbox-ähnlich)
- **Keine Wöchentlichen Whale-Angebote** (99,99€ Power-Packs)

### Rechts-Konformität
- **DSGVO:** Kauf-Daten verschlüsselt, Löschrecht via Account-Löschung
- **Jugendschutz:** Altersabfrage vor erstem Kauf, Monats-Ausgaben-Limit für U18 (konfigurierbar)
- **Transparenz:** Alle Preise in € klar ausgewiesen, keine versteckten Kosten
- **USK-Einstufung:** ohne Lootboxen bleibt App bei niedriger Altersfreigabe

### B2B-Einnahmen (parallele Säule, bestehend)
- Shop-Arena-Premium (lokale Geschäfte zahlen für Sichtbarkeit) — **Haupteinnahmequelle bleibt B2B**
- Edelsteine = Zweitgeschäft, nicht Lebensader

---

## 12. Kampf-System — Epic Feel

### Kern-Prinzip
Kämpfe sind **deterministisch simuliert** (Server) und **episch animiert** (Client). Der Spieler sieht **30-45 Sekunden Kino**, nicht eine Excel-Tabelle.

### Auto-Battle Ablauf (1v1 Arena)

**Phase 1: Intro (3 Sek)**
- Beide Wächter zoomen rein mit Rarity-Glow (gold für Legendär, lila Episch, teal Elite)
- Typ-Icons blinken auf, Counter-Indikator zeigt Vorteil/Nachteil
- „VS"-Screen mit Level + Namen
- Sound: tiefes Bass-Dröhnen, Herzschlag

**Phase 2: Rundenablauf pro Runde (ca. 3-5 Sek)**
```
1. Runden-Nummer fadet ein (Runde 1, Runde 2...)
2. Initiative-Check (schneller Wächter blitzt auf)
3. Angreifer bewegt sich → trifft
4. Damage-Number springt heraus (Rot, groß, Schütteln bei Crit)
5. Getroffener HP-Balken reduziert sich animiert
6. Rage-Balken füllt sich sichtbar (orange/rot glühend)
7. Bei 1000 Rage: Aktiv-Skill triggert
   → Bildschirm-Flash
   → Skill-Name erscheint groß ("INFERNO!")
   → Aufladung mit Partikeln
   → Fullscreen-Effekt beim Treffer
   → Screen-Shake
   → Kritischer Damage-Number (groß, goldrand)
8. Status-Effekte visuell (Flammen bei Burn, grüne Schleier bei Gift)
9. Nächste Runde
```

**Phase 3: Finishing Blow (2 Sek)**
- Letzter Treffer in Slow-Motion
- Verlierer „zerbricht" (Glass-Shatter-Effekt passend zur Rarität)
- „SIEG!" / „NIEDERLAGE" mit Bildschirm-Beben

**Phase 4: Loot-Reveal (5-8 Sek) — *hier kommt das Dopamin***
- Truhe fällt vom Himmel, wackelt
- Spieler tippt → Truhe öffnet sich mit Licht-Explosion
- Items fliegen einzeln raus, jedes mit eigener Animation:
  - **Grau (Standard):** kleiner Funke
  - **Blau (Selten):** blauer Kristall-Flash
  - **Lila (Episch):** Partikel-Explosion
  - **Gold (Legendär):** Fullscreen-Flash + Sound-Fanfare + Haptik-Feedback
- Damage-Summary fadet ein (DPS, Runden, Crits)
- XP-Balken füllt sich animiert
- Level-Up → voller Screen-Flash mit Fanfare + „LEVEL UP!" + Talentpunkt-Icon

### AreBoss-Kampf (Crew vs. Boss)

**Pre-Battle-Lobby (60 Sek Countdown):**
- Alle Crew-Mitglieder wählen ihre 1-3 Wächter
- Boss-Portrait wird langsam enthüllt (Silhouette → voll)
- Crew-Mitglieder-Avatare erscheinen am Rand
- Musik baut sich auf

**Kampf (interaktive Simulation):**
- Boss groß in der Mitte, Wächter der Crew am unteren Rand
- **Echtzeit-Leaderboard:** Damage-Dealt-Ranking der Spieler (live sortiert)
- Phasen-Übergänge (100%→66%→33% HP):
  - Boss brüllt, Kamera zoomt
  - Neue Skills werden eingeblendet („PHASE 2: Erdbeben-Welle")
  - Bildschirm-Farbgebung wechselt (rot-getönt in Phase 3)
- Mitwirken der Spieler: **Tap-to-Boost** — alle 30 Sek können Spieler tippen für +5% Schaden für 3 Sek (simple Interaktion, die Engagement schafft ohne Skill zu fordern)

**Boss-Kill:**
- Slow-Motion letzter Schlag
- Boss explodiert in Partikeln
- **Loot-Regen:** Items fliegen vom Himmel runter (wie Fortnite-Viktory)
- Winner wird gekürt (Krone-Animation)
- Ranking-Liste mit Loot-Zuteilung animiert

### Technik-Stack für Animation (Empfehlung)

| Komponente | Lösung |
|---|---|
| **Skelett-Animation Wächter** | Rive oder Lottie (beide Web + Mobile, lightweight) |
| **Partikel/FX** | Custom Canvas + CSS-Animationen |
| **Screen-Shake / Flash** | CSS `transform: translate` + `filter: brightness` |
| **Haptik (Mobile-Browser)** | `navigator.vibrate()` bei Legendär-Drops/Crits |
| **Sound** | HTMLAudio + preloaded Sprites |
| **Replay-System** | Nutzen der bestehenden `RoundEvent[]`-Struktur in battle-engine.ts |

Die bestehende `battle-engine.ts` liefert schon **deterministische Round-Events**. Die Animation ist reines Frontend-Rendering dieser Events → Replay funktioniert automatisch.

### Kampf-Rhythmus (wichtig für Epic Feel)
- **Nicht zu schnell:** 3-5 Sek pro Runde, sonst unverständlich
- **Nicht zu langsam:** max 45 Sek total, sonst skippen Nutzer
- **Skip-Option:** nach 1× gesehen kann Animation übersprungen werden (→ direkt zu Ergebnis + Loot)
- **Highlights immer animiert:** selbst bei Skip werden Crits + Skill-Ults kurz gezeigt

### Akustik
- **Pro Wächter-Typ eigene Sound-Signatur:**
  - Infanterie: Metall-Klirren, schwere Schritte
  - Kavallerie: Hufgetrappel, Wind
  - Scharfschütze: Pfeil-Surren, Bogenspannung
  - Magier: Chor-Samples, Arkane Resonanz
- **Skill-Ults mit Voice-Lines?** (optional, Post-Launch) → „FÜR DIE STADT!"
- **Loot-Legendär:** Erkennbarer Orchester-Stinger (à la Diablo)

### Was das technisch bedeutet
- Animation-System ist **nicht trivial** — rechne ~2-3 Wochen für solides Feel
- Asset-Pipeline: Rive-Animationen pro Wächter (kann bei 30 Wächtern × 4 Animationen = 120 Assets werden)
- **MVP-Kompromiss:** Start mit 2D-Sprites + CSS-Animationen, Rive/Skelett-System als Phase-2-Upgrade

---

## 13. Offene Fragen

1. **Respec-Kosten:** Kostenlos alle 7 Tage, danach Siegel-Kosten? Oder immer Siegel-Kosten?
2. **Expertise-Skill:** Nur für Legendäre, oder auch Episch/Elite?
3. **Siegel-Typ-Strenge:** Reine Typ-Siegel oder gemischte Drops?
4. **Crew-Buffs:** Geben Talent-Builds Crew-weite Effekte (CoD hat das) — oder nur individuelle Wächter?
5. **Balancing:** Manuell oder datengetrieben (nach Beta-Feedback)?
6. **Mobile-UI:** Wie passt Talentbaum auf 375px Viewport? (Mobile-First ist Pflicht!)
7. **60 Wächter-Content:** Wer schreibt Lore + Skills? AI-generiert oder handgemacht?

---

## 14. Nicht-Ziele (bewusst weggelassen)

- ❌ **Sekundär-Commander / Pairings** (RoK-Feature) — zu komplex, später vielleicht
- ❌ **Civilization / Nation-System** (RoK/CoD-Kernfeature) — passt nicht zu lokaler Walking-App
- ❌ **Gacha / Lucky Draw** — Pay-to-Win-Risiko, Wächter kommen aus Walking + Achievements
- ❌ **Equipment-Slots komplexer machen** — bestehendes Equipment-System (Migration 18) reicht vorerst
- ❌ **PvP-Rankings global** — Crew/Stadt/Lokal bleibt Fokus
