# Deals & Bundles — Konzept (CoD-inspiriert, an myarea365 angepasst)

## Preisstruktur (6 Tiers)

| Tier | Preis | Zielgruppe | Wert-Multiplikator |
|------|-------|-----------|--------------------|
| Mikro | 4,99 € | Gelegenheitsspieler | 1× |
| Klein | 9,99 € | Aktive Spieler | 2.2× (Wert: ~22 €) |
| Mittel | 14,99 € | Engagiert | 3.5× (Wert: ~52 €) |
| Groß | 24,99 € | Crew-Officer | 6× (Wert: ~150 €) |
| Premium | 49,99 € | Whales | 13× (Wert: ~650 €) |
| Mega | 99,99 € | Top-Whales | 30× (Wert: ~3000 €) |

Wichtig: höhere Tiers haben besseren €/Wert-Ratio (klassischer Whale-Bait), aber NIE Pay2Win — das Endgame muss auch ohne Geld erreichbar sein, nur langsamer.

---

## Deal-Kategorien (Sidebar-Tabs wie CoD)

### 1. 🥚 **Saisonales Pack** (rotiert wöchentlich)
Großes Hero-Banner. Aktuell-Highlight wechselt jede Woche. Premium-Preis (4,99 €) gibt Saisonal-Truhe + Speedups + Wegemünzen.

**Mai-Beispiel**: "Frühlings-Erwachen"
- 1.250 Edelsteine
- 1× Saisonal-Wächter-Ei
- 16× Speedup-Token (60 Min)
- 17× XP-Boost-Trank
- 30× Mana-Trank
- Wert: ~30.000 Edelsteine | Preis: 4,99 €

### 2. 💰 **Edelstein-Schwelle** (Cashback-Ladder)
Für jeden Edelstein-Kauf in dieser Woche bekommst du Geschenk-Schwellen freigeschaltet. Sammelt sich bis zur höchsten Schwelle erreicht ist.

| Gekaufte Edelsteine | Bonus-Geschenk |
|---------------------|----------------|
| 2.400 | Bronze-Truhe + 5 Speedups |
| 4.800 | Silber-Truhe + Wächter-Ei |
| 8.000 | Gold-Truhe + 10 Speedups + Skin |
| 12.000 | Pin-Theme exklusiv |
| 16.000 | Legendäres Wächter-Ei + Marker-Skin |

Cashback-Mechanik bindet User an die Plattform.

### 3. 🏆 **Themen-Pakete** (3 Stück, 4,99 € pro Paket, 1×/Tag)
Cinematic Pack-Karten mit Hero-Artwork. Jedes Paket hat einen Fokus:
- **Stadt-Erkunder** — Resourcen + Speedups + Map-Rabatte
- **Krieger-Pfad** — Combat-Boosts + Truppen-Truhe + Crew-Buff
- **Wissens-Pfad** — XP-Booster + Tränke + Forschungs-Beschleunigung

Alle 3 zusammen = Volldeckung. User kann auch nur 1 kaufen.

### 4. 💎 **Wert-Stufen** (6 Tiers, hauptsächlich Edelsteine + Bonus)
Klassisches Gem-Pack-System:

| Preis | Edelsteine | Bonus |
|-------|-----------|-------|
| 4,99 € | 1.250 | +5% First-Time |
| 9,99 € | 2.750 | +10% |
| 14,99 € | 4.500 | +20% + Speedup-Bundle |
| 24,99 € | 8.000 | +30% + Wächter-Ei |
| 49,99 € | 18.000 | +50% + Pin-Theme + 7d Premium |
| 99,99 € | 40.000 | +75% + Legendäres Ei + Marker-Set + 30d Premium |

### 5. 🔥 **Tagesangebote** (Daily-Reset)
3-5 Mini-Deals die täglich rotieren. Niedriger Preis (0,99-2,99 €), hoher Wert relativ. Verschwinden nach 24h.

Beispiele:
- Doppel-Wegemünzen für 24h — 0,99 €
- Wächter-Ticket-Bundle (10 Stück) — 1,99 €
- Speedup-Pack (15× 60min) — 2,99 €

### 6. 📜 **Battle Pass** (Saison-Pass, monatlich)
Wie üblich: free track + premium track (4,99 €) + premium-plus track (14,99 €). User schaltet Belohnungen durch Walking + Aktivitäten frei.

### 7. 🎒 **Monats-Abos** (Subscription-Tier)

| Tier | Preis/Monat | Vorteile |
|------|-------------|----------|
| Wanderer | 2,99 € | 200 Edelsteine täglich, 1× XP-Boost/Tag, Werbefrei |
| Pfadfinder | 4,99 € | 500 Edelsteine täglich, 2× XP, Premium-Marker, +50% Loot-Drops |
| Stadtmeister | 9,99 € | 1.500 Edelsteine täglich, 3× XP, exklusive Pin-Themes, Crew-Boost |

---

## Banner-Hierarchie auf der Map / im Shop

**Map-Floating-Badge** (statt aktuelles Daily-Deal-Badge):
- Zeigt das aktuelle saisonale Pack-Hero (rotiert wöchentlich)
- Klick → Shop öffnet auf "Saisonales Pack"-Tab
- Versteckt während Walking + offene Modals

**Shop-Modal Sidebar** (vertikal links, wie in CoD-Screens):
1. 🥚 Saison-Spotlight (immer oben)
2. 💰 Edelstein-Schwellen
3. 🏆 Themen-Pakete
4. 💎 Edelstein-Shop
5. 🔥 Tagesangebote (rote Badge mit Anzahl)
6. 📜 Battle Pass
7. 🎒 Abos

**Hero-Cards** (rechts vom Sidebar):
Pro Tab große Cinematic-Card mit:
- Hintergrund-Artwork passend zum Theme
- Großer Preis-Button (gold/orange Gradient)
- "und Geschenke im Wert von X Edelsteinen!" Linie
- Item-Liste mit Mengen + Icons
- Resterzeit (Countdown-Timer)
- Verbleibende Käufe (1×/Tag oder begrenzt)

---

## Was wir technisch brauchen

### DB-Schema (Migration)
```sql
-- Saisonale Pakete + ihre Inhalte
create table monetization_seasonal_packs (
  id text primary key,
  title text, subtitle text,
  hero_image_url text, hero_subject text,
  starts_at timestamptz, ends_at timestamptz,
  price_cents int,
  bonus_gems int,
  rewards jsonb -- [{kind:'gem',qty:1250}, {kind:'speedup',qty:16}, ...]
);

-- Themen-Pakete (immer verfügbar, daily-limit)
create table monetization_themed_packs (
  id text primary key,
  title text, theme text, -- 'explorer'|'warrior'|'wisdom'
  hero_image_url text,
  price_cents int,
  daily_limit int default 1,
  rewards jsonb
);

-- Edelstein-Schwellen-Tracker pro User
create table monetization_gem_threshold_progress (
  user_id uuid references auth.users,
  week_iso text, -- '2026-W18'
  gems_purchased int default 0,
  thresholds_claimed int[] default '{}',
  primary key (user_id, week_iso)
);
```

### Stripe-Produkte
6 Preis-Tiers + Subscription-Pläne (3 Stück) im Stripe-Dashboard anlegen.

### Artwork (für Banner)
Pro Pack 1× Hero-Image (1024×512 oder ähnlich):
- Saison-Pack: passend zur Saison (Frühling, Sommer, Halloween, Winter)
- Themen-Pakete: 3 Hero-Bilder (Stadt, Schwert, Buch)
- Tagesangebote: kleine 256×256-Tiles

Lassen sich mit unserem AI-Pipeline (Veo/Midjourney) machen.

---

## Empfehlung: Reihenfolge umsetzen

1. **Edelstein-Tier-Pricing erweitern** (heutiger Stand: nur ein paar Packs, fehlt 49.99/99.99)
2. **Themen-Pakete** als Konzept (3 Stück, je 4,99 €)
3. **Saisonales Pack** mit Cinematic-Banner
4. **Edelstein-Schwellen-Cashback**
5. **Battle Pass** (separater Sprint, ist groß)
6. **Subscription-Pläne** (separater Sprint, Stripe-Recurring)

Erste 4 Punkte = realistisch in 1-2 Wochen umsetzbar mit existierender Infrastruktur (gem-shop-modal + stripe-checkout sind schon da).
