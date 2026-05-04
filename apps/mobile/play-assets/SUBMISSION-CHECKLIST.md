# Google Play Submission — Schritt-für-Schritt-Checkliste

Diese Datei ist die Master-Anleitung. Reihenfolge einhalten.

---

## Phase 1 — Account & Setup (einmalig)

- [ ] **Play Console Account** unter https://play.google.com/console anlegen
  — $25 einmalig, Identitätsverifikation (Pass/Personalausweis)
  — Bei Organization: D-U-N-S-Number besorgen (https://www.dnb.com/duns-number.html)
  — Einrichtungsdauer: ~2-7 Tage (Verifikation)
- [ ] **Steuerprofil & Zahlungsprofil** anlegen (Adyen/Bank für Auszahlungen)
- [ ] **Developer Distribution Agreement** akzeptieren

---

## Phase 2 — App in Console anlegen

- [ ] „App erstellen" klicken
  - **Name:** MyArea365 — Lauf-Community
  - **Standard-Sprache:** Deutsch (de-DE)
  - **App oder Spiel:** App
  - **Kostenlos oder kostenpflichtig:** Kostenlos (mit In-App-Käufen via Web — siehe DATA-SAFETY.md)
  - **Deklarationen:** Datenschutzrichtlinien akzeptiert ✓

---

## Phase 3 — App-Inhalte (Pflicht-Sektionen)

### 3.1 Datenschutzerklärung
- [ ] URL eintragen: `https://myarea365.de/datenschutz` (DE)
  oder `https://myarea365.de/privacy` (EN-Alias)

### 3.2 Anzeigen
- [ ] „Diese App enthält Anzeigen": **JA** (AdMob/AdSense, opt-in)

### 3.3 App-Zugriff
- [ ] „Eingeschränkter Zugriff via Login": **JA**
  — Test-Account: `playreview@myarea365.de` / `<password>` (anlegen + dokumentieren)

### 3.4 Content-Rating
- [ ] Fragebogen ausfüllen — siehe `IARC-CONTENT-RATING.md`
  — Erwartet: PEGI 3 / ESRB E

### 3.5 Zielgruppe
- [ ] „Altersgruppe: 13+" (User-generated Content + Sozialfunktionen)
- [ ] „Speziell für Kinder": NEIN

### 3.6 Datensicherheit
- [ ] Formular ausfüllen — siehe `DATA-SAFETY.md`

### 3.7 Regierungs-Apps
- [ ] „Ist diese App eine Regierungs-App": NEIN

### 3.8 Finanzfunktionen
- [ ] „Bietet Finanzdienstleistungen": NEIN

### 3.9 Gesundheits-Apps
- [ ] „Erhebt Gesundheitsdaten": **NEIN** (Schritt-Daten via Health-Connect optional opt-in,
  technisch keine medizinischen Daten — aber Disclosure prüfen)

### 3.10 KI-generierte Inhalte
- [ ] „Generiert deine App KI-Inhalte für User": NEIN

---

## Phase 4 — Store-Eintrag

### 4.1 Hauptseiten-Eintrag
Texte aus `STORE-LISTING.md` kopieren:
- [ ] App-Name
- [ ] Kurzbeschreibung (DE + EN)
- [ ] Vollständige Beschreibung (DE + EN)
- [ ] App-Symbol: `play-assets/playstore-icon.png` (512×512, kein Alpha)
- [ ] Feature-Grafik: `play-assets/feature-graphic.png` (1024×500)
- [ ] Telefon-Screenshots: **min. 2, max. 8** (siehe Phase 5)
- [ ] Tablet-Screenshots: optional (7"/10")

### 4.2 Kategorisierung
- [ ] Kategorie: **Health & Fitness**
- [ ] Tags: Fitness, Walking, Running, Community, Map

### 4.3 Kontaktdaten
- [ ] E-Mail: `support@myarea365.de`
- [ ] Website: `https://myarea365.de`
- [ ] Telefon: optional

### 4.4 Datenschutz-Link
- [ ] `https://myarea365.de/datenschutz`

---

## Phase 5 — Screenshots

**Mindestens 2 Phone-Screenshots, idealerweise 4-8.** Empfohlen:

1. **Dashboard mit Karte** (Hero-Shot — Live-Map mit Pin + eigenem Runner)
2. **Crew-Hub** (Ranglisten, Mitglieder, Aktivität)
3. **Lauf-Tracking aktiv** (HUD mit km, Pace, Streak)
4. **Achievement freigeschaltet** (Modal mit Belohnung)
5. **Inventar / Loadout** (Ausrüstung, Skins, Banner)
6. **Lokale Deals** (Shop-Karte, QR-Code-Scan)

**Format:** 1080×1920 PNG/JPG (Portrait), oder 1920×1080 (Landscape).
**Min. 320 px**, **max. 3840 px** auf der längeren Seite.

> Generator: `node apps/mobile/scripts/generate-screenshots.mjs` (Playwright,
> nimmt automatisch saubere Shots der Live-Seiten via Headless Chrome).

---

## Phase 6 — Release-Build

### 6.1 Keystore (einmalig)
- [ ] Release-Keystore erzeugen:
  ```bash
  keytool -genkey -v -keystore myarea365-release.jks \
    -keyalg RSA -keysize 2048 -validity 36500 \
    -alias myarea365
  ```
- [ ] Sicher backuppen (Passwort-Manager + offline) — **Verlust = unfixable**
- [ ] `apps/mobile/android/keystore.properties` befüllen (gitignored):
  ```properties
  storeFile=../myarea365-release.jks
  storePassword=...
  keyAlias=myarea365
  keyPassword=...
  ```

### 6.2 Build erstellen
```bash
cd apps/mobile
pnpm cap:sync
cd android
./gradlew bundleRelease
# Output: android/app/build/outputs/bundle/release/app-release.aab
```

### 6.3 Play App Signing aktivieren
- [ ] In Play Console: **App-Signing → Play App Signing aktivieren**
- [ ] App-Signing-Schlüssel-SHA-256 kopieren

### 6.4 Asset-Links updaten
- [ ] `apps/web/public/.well-known/assetlinks.json` öffnen
- [ ] `REPLACE_WITH_YOUR_RELEASE_SHA256_FINGERPRINT` durch beide SHAs ersetzen:
  - Upload-Schlüssel-SHA (aus Keystore)
  - App-Signing-Schlüssel-SHA (aus Play Console)
- [ ] Web-Deploy auslösen → Datei wird unter
  `https://myarea365.de/.well-known/assetlinks.json` erreichbar
- [ ] Verifizieren mit:
  ```bash
  curl -s https://myarea365.de/.well-known/assetlinks.json | jq .
  ```

---

## Phase 7 — Internal Testing → Closed → Open → Production

### 7.1 Internal Testing (Tag 1)
- [ ] AAB hochladen unter „Tests → Internal Testing"
- [ ] Tester-Liste anlegen (1-100 Personen)
- [ ] Opt-in-Link teilen, Tester installieren via Play Store
- [ ] Mind. 24h beobachten — Crashes/Errors via Play Console „Crashes & ANRs"

### 7.2 Closed Testing (Tag 3-7)
- [ ] Beförderung via Console oder neuer Track
- [ ] 12+ Tester für mind. 14 Tage zwingend für späteren Production-Rollout

### 7.3 Production
- [ ] Erst beantragen wenn Closed Testing 14 Tage lief mit ≥12 aktiven Testern
- [ ] Roll-out in Stufen: 1% → 5% → 20% → 100% über 3-7 Tage

---

## Phase 8 — Compliance-Hooks

- [ ] **App ID Pflicht-Disclosure** (DSA Art. 30): Verkäuferinformationen in Impressum bestätigen
- [ ] **Account Deletion Endpoint** (DSGVO Art. 17): User-Flow im Profil + per E-Mail prüfen
- [ ] **Children's Privacy** (DSGVO Art. 8): Account ab 13+ — bei Registrierung Geburtsdatum?
  → Aktuell nicht abgefragt. Falls Bedenken, Hinweis in AGB ergänzen.
- [ ] **Werbung-Disclosure**: AdMob/AdSense im Privacy klar erwähnt ✓ (siehe DATA-SAFETY.md)

---

## Phase 9 — Häufige Reject-Gründe (Vorbeugung)

| Issue | Status |
|---|---|
| Privacy-URL nicht erreichbar | ✅ /privacy + /datenschutz |
| BACKGROUND_LOCATION ohne Justification | ✅ Permission entfernt |
| Foreground-Service ohne foregroundServiceType | ✅ Permission entfernt |
| Alpha im 512×512-Icon | ✅ removeAlpha() im Generator |
| Stripe-Käufe in Android-App ohne Play-Billing | ✅ IapNotAvailableNotice + Hard-Block in Capacitor |
| AdMob-APP-ID fehlend | ✅ Im Manifest |
| Asset-Links nicht published | ⚠️ Nach Phase 6.4 |
| Permissions nicht im Privacy erwähnt | ✅ DATA-SAFETY.md + de.json Privacy |
| User-Generated Content ohne Moderation | ✅ Server-Filter + Report-Button (siehe IARC-Block) |
| Veraltete targetSdk | ✅ targetSdk 35 (Android 15, August-2025-Mindeststand) |

---

## Phase 10 — Post-Launch Monitoring

- [ ] **Play Console:** Crash-Rate < 1% halten
- [ ] **Vercel Analytics:** Core Web Vitals beobachten
- [ ] **Supabase:** Query-Performance + Storage-Nutzung
- [ ] **User-Reports:** support@myarea365.de + Play-Reviews
- [ ] **Update-Cadence:** versionCode bei jedem Upload bumpen ($major*10000 + ...)

---

## Anhang — Files in diesem Ordner

| Datei | Zweck |
|---|---|
| `playstore-icon.png` | 512×512 Play-Icon (kein Alpha) |
| `feature-graphic.png` | 1024×500 Feature-Grafik |
| `STORE-LISTING.md` | App-Name + Beschreibungen DE/EN |
| `DATA-SAFETY.md` | Werte für Data-Safety-Form |
| `IARC-CONTENT-RATING.md` | Antworten für Content-Rating |
| `SUBMISSION-CHECKLIST.md` | Diese Datei |
