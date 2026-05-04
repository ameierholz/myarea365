# Google Play — Data-Safety-Form (Pflicht ab 2024)

> Antworten direkt im Play-Console-Formular eintragen. Diese Datei spiegelt
> die Privacy-Policy unter https://myarea365.de/datenschutz wider.

---

## 1. Erhebt deine App Daten oder teilt sie?

**Antwort:** ✅ JA — Daten werden erhoben UND geteilt (Supabase, Stripe, Google).

---

## 2. Datenkategorien

### 📍 Location → **Approximate location** + **Precise location**
| Frage | Antwort |
|---|---|
| Collected? | ✅ Yes |
| Shared? | ❌ No (nur Server-side, kein 3rd-party-share) |
| Required? | ✅ Required (Kern-Funktionalität) |
| Purpose | App functionality, Analytics |
| User can delete? | ✅ Yes (Konto-Löschung) |

### 👤 Personal info → **Name** + **Email address** + **User IDs**
| Frage | Antwort |
|---|---|
| Collected? | ✅ Yes |
| Shared? | ❌ No |
| Required? | ✅ Required (Auth via Supabase) |
| Purpose | Account management, App functionality |
| User can delete? | ✅ Yes |

### 💳 Financial info → **Purchase history**
| Frage | Antwort |
|---|---|
| Collected? | ✅ Yes (über Stripe / Web-only) |
| Shared? | ✅ Shared with Stripe (PCI-DSS Provider) |
| Required? | ❌ Optional (User wählt Käufe) |
| Purpose | Account management, Fraud prevention, Compliance (Steuer/Buchhaltung) |
| User can delete? | ⚠️ Teilweise (Steuer-Aufbewahrung 10 Jahre, AO/HGB) |

> ⚠️ **App-spezifisch:** In der Android-App sind alle Käufe ausgeblendet
> (siehe `lib/capacitor.ts:isInAppPurchaseAllowed`). Käufe finden nur via
> myarea365.de im Browser statt. Trotzdem deklarieren, weil das Konto
> dieselbe Datenbank teilt.

### 📱 App activity → **App interactions** + **In-app search history** + **Other actions**
| Frage | Antwort |
|---|---|
| Collected? | ✅ Yes (Walks, Areas, Crew-Aktionen) |
| Shared? | ❌ No |
| Required? | ✅ Required (Game-State) |
| Purpose | App functionality |
| User can delete? | ✅ Yes |

### 📊 App info & performance → **Crash logs** + **Diagnostics**
| Frage | Antwort |
|---|---|
| Collected? | ⚠️ Conditional (nur bei Vercel-Analytics-Consent) |
| Shared? | ❌ No (Vercel-anonym) |
| Required? | ❌ Optional (Cookie-Banner, opt-in) |
| Purpose | Analytics |
| User can delete? | ✅ Yes (Consent zurückziehen) |

### 🔐 Device or other IDs → **Device or other IDs**
| Frage | Antwort |
|---|---|
| Collected? | ⚠️ Conditional (AdMob/AdSense bei Consent) |
| Shared? | ✅ Shared with Google (Ads) — wenn Consent erteilt |
| Required? | ❌ Optional |
| Purpose | Advertising or marketing (only with consent) |
| User can delete? | ✅ Yes (Consent widerrufen) |

---

## 3. Sicherheitspraktiken

| Frage | Antwort | Notiz |
|---|---|---|
| Daten verschlüsselt in transit? | ✅ Yes | TLS 1.3, HSTS preload |
| User can request deletion? | ✅ Yes | Konto-Löschung im Account-Tab + per E-Mail support@myarea365.de |
| Hält App Google Play Families Policy ein? | n/a | App ist nicht primär für Kinder |
| Verpflichtung zu Google Play Security Best Practices? | ✅ Ja |

---

## 4. Drittanbieter, mit denen Daten geteilt werden

| Anbieter | Daten | Zweck | Standort |
|---|---|---|---|
| Supabase Inc. (eu-central-1) | Auth, Profile, Walks, Crews, Storage | Backend (managed Postgres + Storage) | Frankfurt, DE |
| Vercel Inc. | Request-Logs, optional Analytics | Hosting + opt-in Telemetry | USA / EU-Edge |
| Stripe Inc. (Web only) | Email, Name, Zahlungsmittel | Payment Processing | USA (Standardvertragsklauseln) |
| Google Ireland Ltd. | (mit Consent) Werbe-IDs, IP | AdMob / AdSense | EU |
| Google Cloud Platform | Push-Tokens (FCM) | Push-Notifications | EU |
| Mapbox Inc. | IP, Map-Tile-Requests | Karten-Rendering | USA (DPA) |

---

## 5. Begründungen für sensible Permissions

### ACCESS_FINE_LOCATION
**Begründung:** „MyArea365 trackt deine Lauf-Strecke per GPS, um Straßenzüge in
deinem Quartier als 'erschlossenes Gebiet' zu markieren. Das ist die Kern-
Funktion der App. Standort wird ausschließlich während eines aktiven Laufs
abgefragt — nicht im Hintergrund. Daten bleiben auf unseren Servern in der EU."

### ACCESS_COARSE_LOCATION
**Begründung:** „Fallback wenn FINE_LOCATION nicht verfügbar oder vom User
verweigert; ermöglicht ungefähres Quartier-Matching für Crew-Vorschläge."

### POST_NOTIFICATIONS
**Begründung:** „Crew-Events, Streak-Erinnerungen, Achievement-Benachrichtigungen.
Opt-in, jederzeit deaktivierbar in den Einstellungen."

### VIBRATE / WAKE_LOCK
**Begründung:** „Haptisches Feedback bei Achievements; Bildschirm wach halten
während aktivem Lauf. Standard-Permissions, kein gesonderter Review nötig."
