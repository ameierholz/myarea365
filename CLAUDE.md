# CLAUDE.md – myarea365.de

## Projekt-Kontext
Alle Base365-Standards gelten (Design, SEO, DSGVO, Sicherheit, Performance).

## Projekt-Info
- Domain: myarea365.de
- Typ: Web-First (Mobile-Responsive) → später Native App
- Stack: Next.js 16, TypeScript, Tailwind CSS v4, Supabase, Vercel, MapLibre
- Monorepo: Turborepo + pnpm
- Status: In Entwicklung

## Architektur
```
apps/web/         → Next.js (Vercel, Region fra1)
apps/mobile/      → Expo (später)
packages/shared/  → @myarea365/shared (Types, Utils)
packages/supabase/ → Migrations, Seeds
```

## Supabase
- Projekt-ID: dqxfbsgusydmaaxdrgxx
- Region: eu-central-1 (Frankfurt)
- URL: https://dqxfbsgusydmaaxdrgxx.supabase.co

## Vercel
- Team: ameierholz-8312s-projects
- Projekt: myarea365 (prj_ODCGSMzl8ynNzjKclFtD4kols5eq)
- Region: fra1 (Frankfurt)

## Zielgruppe
Geh- und Lauf-Communities, Menschen die durch Gehen, Spazieren oder Joggen
Gesundheit und Gemeinschaft erleben. Alle Altersstufen. Einzel- und Gruppennutzung.

## Kern-Funktion
Gamifizierte Geh- und Lauf-Community die spielerisch zu Bewegung motiviert
und Nutzer mit lokalen Geschäften vernetzt. Bewegung wird zur Währung.

## Gameplay-Mechanik
- Straßenzüge abgehen/joggen erschließt Gebiete auf der Karte → XP oder Macht
- Allein oder in Gruppen unterwegs – Gruppenleistung addiert sich
- Achievements für Bonus-XP (erste 5km, 10 Gebiete, 30 Tage Streak etc.)
- XP/Macht gegen Map-Icons oder Buffs einlösen (Progression-System)

## Lokale Geschäfte
- Geschäfte können sich registrieren und erscheinen als POI auf der Karte
- QR-Code Scan im Geschäft → Runner erhalten Rabatt-Prozente
- B2B: Geschäfte zahlen für Premium-Sichtbarkeit

## Social Features
- Gruppen gründen, beitreten, gemeinsam Gebiete erschließen
- Leaderboards (Gruppe / Stadt / Global)
- Freunde einladen, gemeinsam laufen

## Supabase Tabellen
users, groups, group_members, areas, area_claims, walks,
achievements, user_achievements, local_businesses, qr_codes,
xp_transactions, map_icons

## Design-Richtung
Energetisch, urban, spielerisch – aber nicht kindisch.
Dunkles Theme mit Karten-Ästhetik. Karte ist das Herzstück der UI.
Inspiration: Ingress/Pokémon GO Energie – aber eigenständige Identität.

### Farbschema (passend zum Logo)
- Background: #0F1115
- Card: #1A1D23
- Primary (Teal/Cyan): #22D1C3
- Accent (Pink/Magenta): #FF2D78
- Pin (Orange): #FF6B4A
- XP Gold: #FFD700
- Text: #F0F0F0 / Muted: #8B8FA3
- Logo-Gradient: Pink (#FF2D78) → Lila → Teal (#22D1C3)

## Monetarisierung
- Google Adsense (Web)
- AdMob (App) – während Entwicklung NUR Test-IDs verwenden!
- B2B: Lokale Geschäfte zahlen für Premium-Sichtbarkeit

## Befehle
```bash
pnpm dev:web        # Next.js Dev-Server
pnpm build          # Alles bauen
pnpm typecheck      # TypeScript prüfen
```
