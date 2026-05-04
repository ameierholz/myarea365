# CSP-Nonces — Migrations-Plan (M15)

**Status:** geplant, post-launch.
**Audit-Risk-Level:** medium.
**Aktueller Zustand:** `script-src 'self' 'unsafe-inline' 'unsafe-eval' …`
in [next.config.ts](../apps/web/next.config.ts).

`unsafe-inline` + `unsafe-eval` neutralisieren CSP weitgehend gegen XSS.
Migration auf Per-Request-Nonces hebt das Schutzniveau auf den heutigen
Webstandard.

---

## Warum nicht jetzt

- Nonce-Migration touched **alle** inline `<script>`/`<style>`-Blöcke,
  next/script Tags, third-party-Skripte (AdSense, Funding Choices,
  Vercel Analytics, Maplibre/Mapbox-Inline-Worker)
- Einige Dependencies (z.B. AdSense) kennen kein Nonce-API → Workarounds
  via `script-src-elem` und Hash-basierten Allow-Lists nötig
- 1-2 Tage fokussierte Arbeit + Browser-Smoke-Test über alle Routes

---

## Vorbereitung (kann jetzt geschehen)

- [ ] **Inventar aller Inline-Scripts** durchsuchen:
  ```bash
  grep -rn "dangerouslySetInnerHTML" apps/web/src
  ```
  - layout.tsx (JSON-LD Schema, googlefcPresent, AdSense-Init)
  - service-worker-register.tsx
  - stripe-embedded-checkout.tsx (?)
  - ggf. weitere

- [ ] **Inventar Inline-Styles** (style={{...}} ist kein Problem,
  `<style>...</style>` schon):
  ```bash
  grep -rn "<style>" apps/web/src
  ```

- [ ] **Verstehen welche Skripte unsafe-inline brauchen** (third-party, die
  inline-Eval ausführen — z.B. Stripe.js, AdSense)

---

## Migrations-Schritte (post-launch)

1. Middleware um `nonce` erweitern (Random per Request, in Header + an
   Layout durchgereicht):
   ```ts
   // middleware.ts
   const nonce = crypto.randomUUID().replace(/-/g, "");
   res.headers.set("x-nonce", nonce);
   res.headers.set("Content-Security-Policy",
     `script-src 'self' 'nonce-${nonce}' 'strict-dynamic' …`);
   ```

2. `app/layout.tsx` liest Nonce aus Header und gibt sie an alle inline
   Scripts:
   ```tsx
   import { headers } from "next/headers";
   const nonce = (await headers()).get("x-nonce") ?? "";
   <script nonce={nonce} dangerouslySetInnerHTML={...} />
   ```

3. Alle `<Script>`-Aufrufe (next/script) bekommen ebenfalls `nonce`:
   ```tsx
   <Script nonce={nonce} src="…" strategy="afterInteractive" />
   ```

4. `next.config.ts` CSP-Header entfernen — wird per-request in
   middleware gesetzt.

5. Manuelles Testen: Login-Flow, Stripe-Checkout, AdSense-Render,
   Map-Load, Service-Worker-Registration.

6. Falls Third-Party blockiert wird, gezielt per Hash freigeben statt
   `unsafe-inline` wiederherzustellen:
   ```
   script-src 'self' 'nonce-…' 'sha256-…' 'strict-dynamic';
   ```

---

## Acceptance Criteria

- [ ] CSP-Header enthält keinen `'unsafe-inline'` und kein `'unsafe-eval'`
- [ ] Alle Routen rendern ohne CSP-Violations in Browser-Console
- [ ] Stripe-Checkout funktioniert (Embedded + Hosted)
- [ ] AdSense Ad-Slot rendert (mit Consent)
- [ ] Service-Worker registriert sich
- [ ] Lighthouse Best-Practices behält 100

---

## Aufwand-Schätzung

- Inventar + Plan: 2h
- Migration + Bugfix-Iterationen: 6-10h
- Cross-Browser-Smoke: 2h
- **Gesamt: 10-14 Stunden**

---

## Referenzen

- https://nextjs.org/docs/app/building-your-application/configuring/content-security-policy
- https://content-security-policy.com/strict-dynamic/
- https://web.dev/articles/strict-csp
