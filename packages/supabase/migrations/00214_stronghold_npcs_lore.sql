-- ══════════════════════════════════════════════════════════════════════════
-- Phase 5 — NPC-Wegelager mit Lore
--
-- 12 NPC-Charaktere: Berlin-spezifische Archetypen mit Sprüchen + Lore.
-- Strongholds bekommen deterministisch (id-hash) einen NPC zugewiesen.
-- ══════════════════════════════════════════════════════════════════════════

create table if not exists public.stronghold_npcs (
  id           text primary key,
  name         text not null,
  archetype    text not null,
  emoji        text not null,
  intro_line   text not null,
  fight_line   text not null,
  victory_line text not null,
  defeat_line  text not null,
  lore         text not null,
  rarity_min_level int not null default 1
);

insert into public.stronghold_npcs (id, name, archetype, emoji, intro_line, fight_line, victory_line, defeat_line, lore, rarity_min_level)
values
  ('hektor',     'Hektor "Der Kassenwart"', 'Späti-Boss',        '🍺',
    'Kommst hier nicht rein. Mein Eckspäti, meine Regeln.',
    'Du nimmst mir kein Bier weg, Bro!',
    'Pff. Aber respekt. Komm öfter vorbei.',
    'Hab ich dir doch gesagt. Mein Kiez.',
    'Hektor verkauft seit 1998 Sterni an dieser Ecke. Niemand kennt seinen vollen Namen, aber alle kennen seinen Tonfall.', 1),
  ('jasna',      'Jasna "Glasrose"',         'Punk-Diva',         '🌹',
    'Du in MEINEM Bunker? Frech. Frech!',
    'Mein Wagenburg-Fest endet nicht mit dir, Penner.',
    'Ok. Du hast mich. Diesmal.',
    'Geh heim, Plattenkind.',
    'Jasna leitet den Wagenburg-Kreis seit 12 Jahren. Sie hat bei jeder Räumung gewonnen.', 3),
  ('rashid',     'Rashid "U-Bahn-Schatten"', 'Tunnel-Wächter',    '🚇',
    'Kein Ticket — kein Durchgang.',
    'In meiner U-Bahn gewinne ich.',
    'Ehre. Du fährst kostenlos.',
    'Falsche Linie, Kollege.',
    'Rashid kennt jede Station von der Ringbahn bis Spandau. Manche sagen, er schläft im Tunnel.', 5),
  ('fritzi',     'Fritzi "Hinterhof-Königin"', 'Garten-Aktivistin', '🌿',
    'Mein Beet, meine Würde.',
    'Tomaten haben tiefere Wurzeln als du!',
    'Setz dich. Wir trinken Tee.',
    'Und jetzt giesst du nochmal.',
    'Fritzi rettet seit 2010 jeden Berliner Hinterhof vor dem Bagger. Ihre Kürbisse gewannen 3 Bezirkspreise.', 2),
  ('maxim',      'Maxim "Plattenpapst"',    'Plattenbau-Veteran', '🏢',
    'Meine 5. Etage. Mein Recht.',
    'Im Beton bin ich der Boss.',
    'Du läufst gut, junger Hund.',
    'Plattenkampf gewinnt der mit Ausdauer. Nicht du.',
    'Maxim wohnt in der gleichen WBS-50-Wohnung seit 1989. Er kennt jeden Aufzugsgeräusch persönlich.', 1),
  ('lina',       'Lina "Penthouse-Phönix"',  'Skyline-Königin',   '🌃',
    'So weit oben warst du noch nie, oder?',
    'Berlin gehört, wer am höchsten lebt.',
    'Tritt ein. Champagner ist kalt.',
    'Geh wieder runter. Für immer.',
    'Lina leitet drei Penthouse-Bars. Niemand weiß, wann sie schläft.', 8),
  ('bruno',      'Bruno "Der Schraubergott"', 'Werkstatt-Meister', '🔧',
    'Du in meiner Werkstatt? Ohne Termin?',
    'Mein Drehmoment ist höher als deins.',
    'Ich repariere dir die Knie kostenlos.',
    'Lehrling. Lerne erstmal Drehmoment.',
    'Bruno hat schon Trabis aus DDR-Zeiten zu Renn-Maschinen umgebaut. Sein Lehrling-Diplom ist von 1976.', 4),
  ('zara',       'Zara "Container-Pirat"',   'Streetart-Diva',    '📦',
    'Das ist MEIN Container. MEINE Wand.',
    'Ich tagge dein Gesicht in 3 Sekunden.',
    'Kunst gewinnt. Komm wieder.',
    'Bleib weg von meinen Wänden, Anfänger.',
    'Zaras Murals hängen in 4 Berliner Galerien. Sie selbst lebt im obersten Container ihres Stacks.', 6),
  ('omar',       'Omar "Bass-Hüter"',        'Techno-Veteran',    '🎶',
    '5 Uhr morgens. Du raus.',
    'Mein Bass schlägt härter als deins.',
    'Geh schlafen. Wir reden Sonntag.',
    'Falsche Track. Falsche Nacht.',
    'Omar steht seit 2003 hinter dem Booth. Er hat jeden Berliner Sonnenaufgang gehört, aber nie gesehen.', 7),
  ('dieter',     'Dieter "Altbau-Geist"',    'Stuck-Wächter',     '🏘️',
    'Hier wohnen seit 1898 Familien. Du nicht.',
    'Mein Altbau, meine Ehre!',
    'Komm rein. Es gibt Filterkaffee.',
    'Treppenhaus zu, Junge.',
    'Dieter ist Hausmeister im selben Altbau wie sein Vater und Großvater. Er kennt jede knarrende Diele.', 1),
  ('viktor',     'Viktor "Graffiti-Gott"',   'Mural-Legende',     '🎨',
    'Du tagst meine Wand? Frech.',
    'Meine Linie ist sauberer.',
    'Respekt. Spray weiter.',
    'Geh üben, Grünschnabel.',
    'Viktor war 2003 Teil der ersten East-Side-Gallery-Crew. Sein Tag lebt seit 22 Jahren auf 12 Berliner Brücken.', 5),
  ('helga',      'Helga "Dachterrassen-Drachin"', 'Pool-Queen',   '🏙️',
    'Mein Dach. Mein Cocktail.',
    'Aus dem Pool gewinnt eh ich.',
    'Setz dich. Aperol auf mich.',
    'Trockene Liege bekommst du nie.',
    'Helga organisiert seit 2009 die größte private Dachterrassen-Party Berlins. Einlass per Wort-Code.', 9)
on conflict (id) do update set
  name = excluded.name, intro_line = excluded.intro_line,
  fight_line = excluded.fight_line, victory_line = excluded.victory_line,
  defeat_line = excluded.defeat_line, lore = excluded.lore;

alter table public.strongholds add column if not exists npc_id text references public.stronghold_npcs(id);

update public.strongholds s
   set npc_id = (
     array['hektor','jasna','rashid','fritzi','maxim','lina','bruno','zara','omar','dieter','viktor','helga']
   )[1 + (abs(hashtext(s.id::text)) % 12)]
 where npc_id is null;

create or replace function public.get_stronghold_npc(p_stronghold_id uuid)
returns jsonb language plpgsql security definer as $$
declare
  v_npc record;
  v_npc_id text;
begin
  select npc_id into v_npc_id from public.strongholds where id = p_stronghold_id;
  if v_npc_id is null then
    v_npc_id := (array['hektor','jasna','rashid','fritzi','maxim','lina','bruno','zara','omar','dieter','viktor','helga'])
                [1 + (abs(hashtext(p_stronghold_id::text)) % 12)];
    update public.strongholds set npc_id = v_npc_id where id = p_stronghold_id;
  end if;

  select * into v_npc from public.stronghold_npcs where id = v_npc_id;
  if not found then return jsonb_build_object('ok', false); end if;

  return jsonb_build_object(
    'ok', true,
    'id', v_npc.id, 'name', v_npc.name, 'archetype', v_npc.archetype, 'emoji', v_npc.emoji,
    'intro_line', v_npc.intro_line, 'fight_line', v_npc.fight_line,
    'victory_line', v_npc.victory_line, 'defeat_line', v_npc.defeat_line,
    'lore', v_npc.lore
  );
end $$;

revoke all on function public.get_stronghold_npc(uuid) from public;
grant execute on function public.get_stronghold_npc(uuid) to anon, authenticated;
