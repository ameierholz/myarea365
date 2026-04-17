# E-Mail & Newsletter-Setup

**Ziel:** Registrierung mit E-Mail-Bestätigung, Welcome-Mail und monatlicher Newsletter an Runner.

**Stack:** Supabase Auth (Verify-Mail) · Resend (Welcome + Newsletter) · Supabase Edge Function (Trigger) · DNS-Einträge für Absender-Domain.

---

## 1. Resend-Account einrichten

1. Konto auf https://resend.com anlegen (kostenlos 100 Mails/Tag, 3.000/Monat)
2. **Domain hinzufügen**: `myarea365.de`
3. Resend zeigt DNS-Einträge:
   - **MX** (optional)
   - **SPF (TXT)**: `v=spf1 include:amazonses.com ~all`
   - **DKIM (TXT)** 3 Einträge: `resend._domainkey.myarea365.de` etc.
   - **DMARC (TXT)**: `v=DMARC1; p=none; rua=mailto:a.meierholz@gmail.com`
4. DNS bei deinem Registrar eintragen (bei IONOS, Strato etc.)
5. Warten bis Resend "verified" zeigt (5–60 Min)
6. **API-Key erstellen** → kopieren, in Secret-Manager

---

## 2. Supabase Auth: Custom SMTP konfigurieren

Supabase Dashboard → **Project → Auth → SMTP Settings**:

| Feld | Wert |
|---|---|
| Enable Custom SMTP | ✅ |
| Sender email | `hello@myarea365.de` |
| Sender name | `MyArea365` |
| Host | `smtp.resend.com` |
| Port | `465` |
| Username | `resend` |
| Password | `<RESEND_API_KEY>` |

**Warum?** Die Default-Supabase-Mails kommen von `noreply@mail.app.supabase.io` — landet oft im Spam und sieht unseriös aus. Mit Resend+eigener Domain kommen Mails professionell von `hello@myarea365.de`.

---

## 3. Verify-Email-Template in Supabase setzen

Supabase Dashboard → **Auth → Email Templates → Confirm signup**.

Inhalt von `apps/web/emails/verify.html` kopieren und einfügen.

Variablen die Supabase ersetzt:
- `{{ .ConfirmationURL }}` — Aktivierungs-Link
- `{{ .Email }}` — User-Mail
- `{{ .Data.display_name }}` — aus `options.data` beim signup

**Subject:** `Bestätige deine E-Mail — MyArea365`

Auch die anderen Templates anpassen:
- **Magic Link**: optional anpassen
- **Change Email Address**: anpassen
- **Reset Password**: anpassen

Template-Dateien liegen alle in `apps/web/emails/`.

---

## 4. DB-Migration ausführen

```bash
# Lokal
supabase db push

# oder manuell in Dashboard → SQL-Editor
```

Migration: `packages/supabase/migrations/00002_newsletter_email_prefs.sql`

Fügt hinzu:
- `users.newsletter_opt_in` (bool)
- `users.welcome_email_sent_at` (timestamptz)
- `users.email_locale` (de/en/…)
- `users.email_notif_*` (feingranulare Benachrichtigungen)
- `newsletter_subscribers` (für Marketing-Landing ohne Account)
- `email_events` (Log für Debug + Bounce)
- Trigger der `newsletter_subscribers` automatisch bei opt-in füllt

---

## 5. Welcome-Mail-Function deployen

```bash
# Supabase CLI installieren falls nicht vorhanden
npm install -g supabase

# Im Projekt-Root:
supabase login
supabase link --project-ref dqxfbsgusydmaaxdrgxx

# Function deployen
supabase functions deploy send-welcome-email \
  --project-ref dqxfbsgusydmaaxdrgxx

# Secrets setzen
supabase secrets set RESEND_API_KEY=re_xxxxxxxxxxxx
# SUPABASE_URL und SUPABASE_SERVICE_ROLE_KEY sind automatisch verfügbar
```

Function-Datei: `packages/supabase/functions/send-welcome-email/index.ts`

---

## 6. Database-Webhook einrichten

Dashboard → **Database → Webhooks → Create a new hook**:

| Feld | Wert |
|---|---|
| Name | `welcome-email-on-verify` |
| Table | `auth.users` |
| Events | ✅ `UPDATE` |
| HTTP Method | `POST` |
| HTTP URL | `https://dqxfbsgusydmaaxdrgxx.supabase.co/functions/v1/send-welcome-email` |
| HTTP Headers | `Authorization: Bearer <ANON_KEY>` |

Der Webhook feuert bei jedem UPDATE auf `auth.users`. Die Function filtert intern auf
`email_confirmed_at: null → timestamp`.

---

## 7. Monatlicher Newsletter (pg_cron Job)

Wird später aufgesetzt — erfordert Content-Pipeline. Placeholder:

```sql
-- supabase sql editor
select cron.schedule(
  'monthly-newsletter',
  '0 10 1 * *',  -- 1. jedes Monats 10:00 UTC
  $$
    select net.http_post(
      url := 'https://dqxfbsgusydmaaxdrgxx.supabase.co/functions/v1/send-monthly-newsletter',
      headers := '{"Authorization": "Bearer ..."}'::jsonb
    );
  $$
);
```

Function `send-monthly-newsletter` bauen wir wenn Content-Prozess steht.

---

## 8. Testing-Checkliste

- [ ] Resend-Domain verified
- [ ] Supabase SMTP-Settings gespeichert + Test-Mail gesendet
- [ ] Verify-Template in Supabase eingesetzt (Screenshot der Preview)
- [ ] Migration 00002 ausgeführt (prüfen: `select column_name from information_schema.columns where table_name='users' and column_name like 'newsletter%'` → Ergebnis)
- [ ] Function deployed (`supabase functions list`)
- [ ] Webhook angelegt
- [ ] **Test-Registrierung auf Prod** — E-Mail kommt mit MyArea365-Design?
- [ ] Nach Verify: Welcome-Mail kommt binnen 30 Sek?
- [ ] `users.welcome_email_sent_at` ist gesetzt?
- [ ] `email_events` enthält "sent"-Eintrag?
- [ ] Spam-Check (https://mail-tester.com): Score ≥ 9/10

---

## 9. Kosten-Überschlag

| Komponente | Kostenpunkt |
|---|---|
| Resend | Free: 3.000 Mails/Monat · Pro: 20€/Monat = 50.000 Mails |
| Supabase | Free-Tier reicht für Start (2 GB DB + 500k Edge-Function-Invocations) |
| Domain + DNS | ~10€/Jahr (schon vorhanden) |

**Für erste 1.000 User praktisch kostenlos.**

---

## 10. Was noch zu bauen ist (Backlog)

- [ ] `/unsubscribe` Page mit Token-Validation
- [ ] Double-Opt-In für Newsletter-Subscribes von Nicht-Registrierten
- [ ] Monatlicher Content-Prozess (welche News, welche Shops featuren)
- [ ] Reminder-Mails: Streak broken, Wochen-Report, Challenge endet bald
- [ ] Abo-Center im Profil (welche Mails ja/nein)
- [ ] i18n für E-Mails (Englisch-Templates)
