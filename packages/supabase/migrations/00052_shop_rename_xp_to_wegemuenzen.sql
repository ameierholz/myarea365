-- 00052: Shop-Katalog auf Wegemünzen-Begriff umstellen.
--
-- Problem: Nach dem Currency-Split (00046) ist "XP" nicht mehr die Runner-
-- Währung. Im Gem-Shop, Daily-Deal-Packs und Leaderboard tauchen aber
-- weiterhin Labels wie "XP-Boost 1h", "Gesamt-XP" und "2× XP" auf — das
-- verwirrt neue Runner und widerspricht den Onboarding-Erklärungen.
--
-- Außerdem: Daily-Deal-Pack-Contents enthalten weiterhin alte englische
-- Rarity-Labels ("Trank (Common)" etc.), weil Migration 00022 diese
-- per jsonb-Append hinzugefügt statt ersetzt hat.
--
-- Fix: Items in gem_shop_items umbenennen + daily_deal_packs-Contents
-- von doppelten & englischen Einträgen bereinigen.

-- ═══════════════════════════════════════════════════════
-- 1) Gem-Shop-Items: Wegemünzen-Boost statt XP-Boost
-- ═══════════════════════════════════════════════════════
update public.gem_shop_items set
  name = 'Wegemünzen-Boost 1h',
  description = '2× 🪙 auf alle gelaufenen km für 1 Stunde'
where id = 'xp_boost_1h';

update public.gem_shop_items set
  name = 'Wegemünzen-Boost 4h',
  description = '2× 🪙 auf alle gelaufenen km für 4 Stunden'
where id = 'xp_boost_4h';

update public.gem_shop_items set
  name = 'Wegemünzen-Boost 24h',
  description = '2× 🪙 für einen ganzen Lauftag'
where id = 'xp_boost_24h';

-- Arena-Pass nutzt ebenfalls xp_multiplier-Wording
update public.gem_shop_items set
  description = 'Täglich 20 Edelsteine · 1,5× 🪙 · exklusive Skins'
where id = 'arena_pass_month';

-- ═══════════════════════════════════════════════════════
-- 2) Daily-Deal-Pack-Contents: englische Trank-Labels entfernen
-- ═══════════════════════════════════════════════════════
-- Alte "(Common)/(Rare)/(Epic)"-Einträge aus contents-JSONB entfernen.
-- Die deutschen Einträge ("(Gewöhnlich)"/"(Selten)"/"(Episch)") bleiben erhalten.
do $$
declare
  r record;
  v_new jsonb;
begin
  for r in select id, contents from public.daily_deal_packs loop
    select coalesce(jsonb_agg(elem), '[]'::jsonb) into v_new
    from jsonb_array_elements(r.contents) as elem
    where not (
      (elem->>'label') like '%(Common)%' or
      (elem->>'label') like '%(Rare)%'   or
      (elem->>'label') like '%(Epic)%'
    );
    if v_new is distinct from r.contents then
      update public.daily_deal_packs set contents = v_new where id = r.id;
    end if;
  end loop;
end $$;

-- ═══════════════════════════════════════════════════════
-- 3) Sicherheit: auch "XP" in Daily-Deal-Labels auf 🪙 umstellen
-- ═══════════════════════════════════════════════════════
do $$
declare
  r record;
  v_new jsonb;
  elem jsonb;
  arr jsonb;
begin
  for r in select id, contents from public.daily_deal_packs loop
    arr := '[]'::jsonb;
    for elem in select * from jsonb_array_elements(r.contents) loop
      -- "XP-Boost" → "Wegemünzen-Boost", "XP " → "🪙 "
      if elem ? 'label' then
        elem := jsonb_set(elem, '{label}',
          to_jsonb(
            replace(
              replace(elem->>'label', 'XP-Boost', 'Wegemünzen-Boost'),
              ' XP ', ' 🪙 '
            )
          )
        );
      end if;
      arr := arr || elem;
    end loop;
    if arr is distinct from r.contents then
      update public.daily_deal_packs set contents = arr where id = r.id;
    end if;
  end loop;
end $$;
