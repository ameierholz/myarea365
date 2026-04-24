# MyArea365 Mobile (Capacitor)

Native Android-Shell, die `https://myarea365.de` in einem WebView hostet.
Gleicher Client-Code wie Web — jedes Vercel-Deploy ist sofort in der App live.

## Voraussetzungen (einmalig)

- Android Studio (≥ Hedgehog / 2023.1) mit Android SDK 34+
- JDK 17 (bundled mit Android Studio)
- `ANDROID_HOME` Environment-Variable gesetzt
- Physisches Android-Gerät oder Emulator

## Erstinstallation

```bash
# Im Monorepo-Root
pnpm install

# Android-Plattform hinzufügen (erzeugt apps/mobile/android/)
cd apps/mobile
pnpm cap:add:android

# Sync — kopiert Config + Plugins ins native Projekt
pnpm cap:sync
```

## Entwicklung

```bash
# Android Studio öffnen und Projekt starten (empfohlen für Debug)
pnpm cap:open

# Oder direkt deploy auf angeschlossenes Gerät
pnpm cap:run
```

## Release-Build für Play Store

```bash
# Debug-APK (zum Testen)
pnpm android:build
# Ergebnis: android/app/build/outputs/apk/debug/app-debug.apk

# Release-AAB (für Play Console)
pnpm android:release
# Ergebnis: android/app/build/outputs/bundle/release/app-release.aab
# Muss signiert werden — siehe docs/android-signing.md
```

## Architektur-Entscheidung: Remote-WebView

`capacitor.config.ts → server.url = "https://myarea365.de"`

Statt den Client-Code ins APK zu bundeln, lädt die App die Live-Site.
Vorteile:
- **Instant Updates**: Vercel-Deploy = App-Update, kein Store-Rollout nötig
- **Single Source of Truth**: Web + App teilen Code, Tests, Analytics
- **Schneller iterierbar**: Keine Build-Pipeline für Client-Änderungen

Nachteile:
- **Kein Offline-Modus**: App braucht Internet (für MyArea365 ok — Kern-Gameplay
  ist eh online)
- **Cold-Start langsamer** als bundled: ~500 ms Splash-Screen überbrückt das

## Native Features per Plugin

| Plugin | Wofür |
|---|---|
| `@capacitor/geolocation` | Map-Tracking, Gebiete erobern |
| `@capacitor/splash-screen` | App-Launch-Branding |
| `@capacitor/status-bar` | Dunkle Statusleiste, passt zu Brand-Theme |
| `@capacitor/preferences` | Offline-Cache für User-Settings, Locale |
| `@capacitor/app` | Deep-Links, Lifecycle, Hardware-Back-Button |

## Nächste Schritte

- [ ] Android-Plattform generieren (`pnpm cap:add:android`)
- [ ] App-Icon + Splash-Screen in `android/app/src/main/res/` hinterlegen
- [ ] Release-Keystore erzeugen + Passwort sicher speichern
- [ ] Google Play Console: Internal Testing Track anlegen
- [ ] Location-Permissions-Onboarding im Web ergänzen (wird in WebView angezeigt)
- [ ] Push-Notifications via FCM (später Phase 2)
