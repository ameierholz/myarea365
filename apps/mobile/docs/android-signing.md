# Android Release Signing

Google Play verlangt signierte AAB-Builds. Jede App-Identität ist an **genau einen Keystore** gebunden — geht dieser verloren, kannst du die App nicht mehr updaten (nur als neue App mit neuer Package-ID neu veröffentlichen). **Keystore + Passwörter sichern!**

## 1. Keystore erzeugen (einmalig)

Im Ordner `apps/mobile/android/` ausführen:

```bash
keytool -genkey -v \
  -keystore myarea365-release.keystore \
  -alias myarea365 \
  -keyalg RSA -keysize 2048 \
  -validity 10000
```

`keytool` ist Teil von JDK 17 (liegt z. B. unter `C:\Program Files\Android\Android Studio\jbr\bin\keytool.exe`).

Du wirst nach folgenden Werten gefragt:
- **Keystore-Passwort** (min. 6 Zeichen) — sicher speichern!
- **Key-Passwort** — am besten identisch mit Keystore-Passwort
- Vor-/Nachname, Organisation, Stadt, Land → darf beliebig sein (wird nicht angezeigt im Store)

Ergebnis: `apps/mobile/android/myarea365-release.keystore`

## 2. keystore.properties anlegen

Kopiere `keystore.properties.example` → `keystore.properties` und trage die Passwörter ein:

```properties
storeFile=myarea365-release.keystore
storePassword=DEIN_PASSWORT
keyAlias=myarea365
keyPassword=DEIN_PASSWORT
```

Beide Dateien (`*.keystore` und `keystore.properties`) sind **gitignored** — niemals committen.

## 3. Backup

- Keystore-Datei an einen sicheren Ort kopieren (Password-Manager, verschlüsselter Cloud-Ordner)
- Passwörter separat speichern
- Ohne diese Datei + Passwörter ist kein App-Update mehr möglich

## 4. Release-AAB bauen

```bash
cd apps/mobile
pnpm android:release
```

Ergebnis: `android/app/build/outputs/bundle/release/app-release.aab` → bei Play Console hochladen.

## 5. Play App Signing (empfohlen)

Beim ersten Upload in der Play Console kannst du **Play App Signing** aktivieren. Google übernimmt dann die finale Signierung — dein lokaler Keystore wird nur zum „Upload-Key". Das schützt vor Verlust: geht dein Upload-Key verloren, kann Google einen neuen ausstellen.
