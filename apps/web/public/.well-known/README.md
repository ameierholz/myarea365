# /.well-known/

## assetlinks.json

Digital Asset Links — verifiziert die Verbindung zwischen `myarea365.de`
und der Android-App `com.myarea365.app`. Ohne dieses File werden die
Deep-Links (`autoVerify="true"` im Manifest) nicht automatisch geöffnet,
sondern es erscheint der App-Chooser-Dialog.

### Aktualisierung nach Play-App-Signing

Sobald die App auf Google Play hochgeladen ist:

1. Play Console → App → "App-Signing" öffnen
2. SHA-256-Zertifikatsfingerabdruck (App-Signaturschlüssel) kopieren
3. In `assetlinks.json` den Platzhalter ersetzen:
   ```
   "REPLACE_WITH_YOUR_RELEASE_SHA256_FINGERPRINT"
   ```
4. Bei Mehrgeräte-Verifikation: Beide SHAs (Upload + App-Signing) als
   Array eintragen.
5. Deploy + verifizieren via:
   ```
   curl https://myarea365.de/.well-known/assetlinks.json
   ```
6. Optional Google's Tester:
   https://digitalassetlinks.googleapis.com/v1/statements:list?source.web.site=https://myarea365.de&relation=delegate_permission/common.handle_all_urls
