# MyArea365 - Business & Gameplay Konzepte

## Endgame-Features (Langzeitmotivation)

### 1. Kiez-Deals (Echtwelt-Wirtschaft) - PRIORITAET 1
- XP gegen echte Gutscheine bei lokalen Geschaeften
- 25.000 XP = gratis Kaffee beim Baecker
- 100.000 XP = 10% Rabatt auf Laufschuhe
- XP bekommen realen Geldwert

### 2. Digitales Graffiti & Claiming - PRIORITAET 2
- Strassen-Pate (50.000 XP): Name 7 Tage an Strasse
- Team-Base (100.000 Team-Macht): Neon-Festung auf Karte
- Sichtbar fuer alle Spieler

### 3. Strassen-Upgrades (Passives Einkommen) - PRIORITAET 3
- Eroberte Strasse: +10 Macht/Tag
- Level 2 Upgrade: +25 Macht/Tag
- Level 3 Upgrade: +50 Macht/Tag + dickere Visualisierung
- Motiviert Teams, Kerngebiete hochzuleveln

### 4. Taktische Map-Items (Phase 2)
- Nebelgranate (5.000 XP): Gebiet 2h unsichtbar
- Radar-Stoersender (10.000 XP): Halbiert feindliche XP 24h
- Erzeugt Team-Dynamik und Strategie

---

## Check-in System (B2B Verifizierung)

### Methode 1: QR-Code-Scan (Hauptmethode)
- Acryl-Aufsteller an der Kasse
- GPS-Radius aktiviert "Belohnung abholen" Button
- QR-Scan = unumstoesslicher Anwesenheitsbeweis
- Zeitstempel in Supabase geloggt

### Methode 2: Barista-PIN
- Mitarbeiter tippt 4-stellige PIN auf Laeufer-Handy
- Nur echtes Personal kann freischalten
- Alternative wenn kein Aufsteller gewuenscht

### Methode 3: Time-Lock (Drive-by-Schutz)
- Unsichtbarer Timer bei GPS-Radius-Eintritt
- Button erst nach 2-3 Min Verweildauer aktiv
- Verhindert Vorbeifahren/Vorbeirennen

### Reporting fuer Geschaefte
- Jeder Check-in: Datum, Uhrzeit, anonymisierte User-ID
- Monatsreport: "42 verifizierte Check-ins"
- Stosszeiten-Analyse (z.B. Di 18:00, Sa 10:00)
- Wertvolle Laufkundschaft-Daten als Zusatznutzen

---

## DB-Tabellen (noch zu erstellen)

### check_ins
- id, user_id, business_id, method (qr/pin/auto)
- verified_at, gps_lat, gps_lng
- dwell_time_seconds

### business_reports
- id, business_id, month, year
- total_checkins, unique_visitors
- peak_hours (jsonb)

### street_upgrades
- id, area_id, team_id, level
- daily_power, upgraded_at, upgraded_by

### map_items
- id, user_id, item_type, target_area_id
- activated_at, expires_at, active

### street_claims (Strassen-Pate)
- id, area_id, user_id, display_name
- claimed_at, expires_at

---

## Running Points - Niantic-Modell (B2B Monetarisierung)

### Vorteile fuer lokale Geschaefte
- Garantierte Laufkundschaft (Foot Traffic)
- 100% messbarer Erfolg ("142 Laeufer im Mai")
- Hyperlokales Targeting (sportliche Kiez-Bewohner)
- Modernes Image (Teil eines City-Games)

### Motivation fuer Runner
- In-App: +1.000 XP, 24h Punkte-Multiplikator, seltene Marker
- Real-World: Gratis Espresso, 20% Rabatt, Proteinriegel
- Team-Stuetzpunkte: Capture the Flag um Geschaefte

### Preisstrategie (3 Phasen)
1. GRATIS-PHASE: 3-5 Laeden kostenlos, 10% Rabatt fuer Laeufer
   - Ziel: Case Studies + Referenzen aufbauen
2. PAY-PER-VISIT: 0.50-1.00 EUR pro verifiziertem Besuch
   - Kosten-Deckelung: max 50 EUR/Monat
3. SPONSOREN-FLATRATE (ab 500+ aktive Laeufer):
   - 29-89 EUR/Monat fuer permanenten Sponsored Pin
   - Exklusiver Marker in Teamfarben auf der Map

### Technische Umsetzung
- Running Points als Supabase-Tabelle (nicht hardcoded)
- Geschaefte ueber Admin-Panel hinzufuegen
- GPS-Radius Trigger (20m)
- QR-Scan oder PIN fuer Verifizierung
- Time-Lock (2-3 Min Verweildauer)
- Monatliches Reporting automatisiert
