-- 00037: Gender-Balance bei Wächter-Namen
-- Vorher: 4/40 weiblich. Nachher: ca. 20/40.
-- Die Namen-Heuristik in artwork-prompts.ts leitet daraus die Darstellung ab.

update public.guardian_archetypes set name = 'Clubwächterin'         where name = 'Clubwächter';
update public.guardian_archetypes set name = 'Schuldeneintreiberin'  where name = 'Schuldeneintreiber';
update public.guardian_archetypes set name = 'Asphalt-Kurierin'      where name = 'Asphalt-Kurier';
update public.guardian_archetypes set name = 'Deck-Reiterin'         where name = 'Deck-Reiter';
update public.guardian_archetypes set name = 'Mauerläuferin'         where name = 'Mauerläufer';
update public.guardian_archetypes set name = 'Sprühzauberin'         where name = 'Sprühzauberer';
update public.guardian_archetypes set name = 'Revier-Hüterin'        where name = 'Revier-Hüter';
update public.guardian_archetypes set name = 'Gärungs-Alchemistin'   where name = 'Gärungs-Alchemist';
update public.guardian_archetypes set name = 'Streifenreiterin'      where name = 'Streifenreiter';
update public.guardian_archetypes set name = 'Blitz-Botin'           where name = 'Blitz-Bote';
update public.guardian_archetypes set name = 'Giebel-Schützin'       where name = 'Giebel-Schütze';
update public.guardian_archetypes set name = 'Nachtpilotin'          where name = 'Nachtpilot';
update public.guardian_archetypes set name = 'Perspektiv-Meisterin'  where name = 'Perspektiv-Meister';
update public.guardian_archetypes set name = 'Trank-Meisterin'       where name = 'Trank-Meister';
update public.guardian_archetypes set name = 'Stadtschamanin'        where name = 'Stadtschamane';
update public.guardian_archetypes set name = 'Schlachten-Veteranin'  where name = 'Schlachten-Veteran';
update public.guardian_archetypes set name = 'Überschall-Botin'      where name = 'Überschall-Bote';
update public.guardian_archetypes set name = 'Wolken-Reiterin'       where name = 'Wolken-Reiter';
update public.guardian_archetypes set name = 'Dämmerjägerin'         where name = 'Dämmerjäger';
update public.guardian_archetypes set name = 'Phönix-Magierin'       where name = 'Phönix-Magier';

-- Nach dieser Migration ca. 20/40 je Geschlecht.
-- Die restlichen bleiben männlich (Altmetall-Krieger, Beatmacher, Faustkönig,
-- Eisenwall, Asphalt-König, Steingigant, etc.) damit auch klare männliche
-- Charaktere in der Rotation bleiben.
