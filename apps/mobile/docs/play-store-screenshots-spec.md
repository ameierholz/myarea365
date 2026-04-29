# Play Store Screenshots — Spezifikation

## Anforderungen Google Play (Phone)
- Format: **PNG oder JPEG** (keine Transparenz)
- Min. Auflösung: **320 px** kürzere Seite
- Max. Auflösung: **3840 px** längere Seite
- Empfohlen: **1080×1920** (Portrait) oder **1080×2400** für moderne Phones
- Mindestens **2** Screenshots, max. **8**
- Aspect Ratio: 16:9 bis 19.5:9 (nicht zu breit)

## Vorgeschlagene 6 Screenshots

### 1. Map mit Pin-Theme + Live-Lauf
**Inhalt:**
- Karte zentriert auf Berlin-Standort
- Eigene Base-Pin (Mittelalter-Burg) sichtbar
- 2-3 Crew-Polygon-Felder bunt eingefärbt
- Live-Pace-HUD oben rechts mit km-Wert
- Quickaccess-Bar rechts unten

**Caption-Overlay (oben, schwarz/weiß-Balken):**
> JEDER SCHRITT ZÄHLT.

### 2. Crew-Modal mit Bauwerken-Tab
**Inhalt:**
- Crew-Modal offen, Tab "Bauwerke"
- Schwarzmarkt + Bunker + Hangout sichtbar mit Errichten-Buttons
- Crew-Tag im Header

**Caption:**
> ERRICHTE DEIN HAUPTQUARTIER.

### 3. Profil-Tab mit Wächter-Karte
**Inhalt:**
- Profil-Modal offen
- "AKTIVER WÄCHTER"-Karte mit animiertem Wächter-Artwork
- Stats: Lvl, Win/Loss, Siegel
- Details-Button sichtbar

**Caption:**
> WÄCHTER LEVELN MIT DIR.

### 4. Crew-Turf auf der Karte
**Inhalt:**
- Karte rausgezoomt (z=14)
- Großes orange Crew-Turf-Polygon das einen ganzen Kiez einfärbt
- HQ + Repeater in Silhouette-Stage
- Senftenberger Ring oder ähnlich als Grenze

**Caption:**
> EROBERE GANZE KIEZE.

### 5. Repeater-Info-Popup mit Animation
**Inhalt:**
- Großes Hero-Repeater-Artwork mit Animation
- HP-Bar
- "Erbaut vor 2h · Kaelthor Malven · 5.000 Ansehen"
- ANGREIFEN- oder REPARIEREN-Button rot/teal

**Caption:**
> CREW-WARS · 7-TAGE-FEHDEN.

### 6. Achievements + Wegemünzen
**Inhalt:**
- Achievements-Liste oder Profil-Übersicht
- Goldene Wegemünzen-Anzeige
- Recent Runs Liste mit Distanzen

**Caption:**
> SAMMLE WEGEMÜNZEN. SCHALTE ALLES FREI.

---

## Methode 1: Manuell aus dem Browser

1. Dev-Server starten: `pnpm dev:web`
2. Chrome DevTools → Device Toolbar → Custom: 1080 × 1920
3. Pro Screenshot Szene aufbauen, dann:
   - Chrome: `Cmd/Ctrl+Shift+P` → "Capture full size screenshot"
4. PNG abspeichern unter `apps/mobile/docs/screenshots/01_map.png` etc.

## Methode 2: Playwright-Skript

```ts
// apps/mobile/scripts/capture-store-screenshots.ts
import { chromium } from "playwright";

const SCENES = [
  { name: "01_map",      url: "http://localhost:3000/dashboard?tab=map" },
  { name: "02_crew",     url: "http://localhost:3000/dashboard?tab=map&crew=open" },
  { name: "03_profil",   url: "http://localhost:3000/dashboard?tab=profil" },
  // ...
];

const browser = await chromium.launch();
const ctx = await browser.newContext({
  viewport: { width: 1080, height: 1920 },
  deviceScaleFactor: 1,
});
for (const scene of SCENES) {
  const page = await ctx.newPage();
  await page.goto(scene.url);
  await page.waitForTimeout(3000); // Animationen settlen lassen
  await page.screenshot({
    path: `apps/mobile/docs/screenshots/${scene.name}.png`,
    fullPage: false,
  });
  await page.close();
}
await browser.close();
```

Aufruf: `pnpm exec tsx apps/mobile/scripts/capture-store-screenshots.ts`

## Methode 3: Echtes Gerät / Emulator

Für authentische Screenshots:
1. Capacitor-App auf Pixel-Emulator installieren (Pixel 7 = 1080×2400)
2. App starten, Szene aufbauen
3. Android Studio: Logcat → Camera-Icon (Screenshot) → speichert PNG
4. Oder ADB: `adb exec-out screencap -p > screenshot.png`

## Caption-Overlay (optional, aber empfohlen)

Wenn du Captions möchtest, am besten als separate Layer in Photopea oder
Figma einbauen. Format-Vorlage:
- Schwarzer halbtransparenter Balken (rgba(0,0,0,0.7)) oben oder unten
- Höhe: 180-220px
- Schrift: Bold sans-serif, weiß, ~52px
- Akzent-Wort in Crew-Farbe (#22D1C3 oder #FF2D78)

Tools:
- Photopea (kostenlos, browser-based)
- Figma
- AppFollow / Screenshot Studio (paid, automatisiert mehrsprachig)
