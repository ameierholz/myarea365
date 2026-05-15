-- 00387_saga_camps_and_walls.sql
-- RoK Heroic-Anthem-Style: feste Camp-Zuordnung jeder Zone (Voronoi um Spawn).
-- camp_crew_id ist STATISCH (Map-Generation-Zeitpunkt), owner_crew_id ist dynamisch
-- (flippt im Kampf). Frontend rendert Camp-Tönung als Hintergrund + Wand-Linien
-- zwischen unterschiedlichen Camps = visuelle Eiswand/Felsen-Trennung.

-- 1) camp_crew_id auf saga_zones — fix zur Generation, nicht änderbar.
ALTER TABLE public.saga_zones
  ADD COLUMN IF NOT EXISTS camp_crew_id uuid REFERENCES public.crews(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_saga_zones_camp ON public.saga_zones(bracket_id, camp_crew_id);

-- 2) Camp-Meta pro Bracket-Crew (Element + Banner-Emoji + Name) — analog
--    RoK Fire/Ice/Storm/Earth. Wird beim Map-Generator deterministisch zugewiesen.
ALTER TABLE public.saga_bracket_crews
  ADD COLUMN IF NOT EXISTS camp_element text,
  ADD COLUMN IF NOT EXISTS camp_emoji text,
  ADD COLUMN IF NOT EXISTS camp_name text;

-- 3) saga_camp_walls — vorberechnete Wand-Segmente zwischen Zonen
--    verschiedener Camps. Frontend rendert als Eiswand/Felsen-Linien.
CREATE TABLE IF NOT EXISTS public.saga_camp_walls (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bracket_id uuid NOT NULL REFERENCES public.saga_brackets(id) ON DELETE CASCADE,
  zone_a uuid NOT NULL REFERENCES public.saga_zones(id) ON DELETE CASCADE,
  zone_b uuid NOT NULL REFERENCES public.saga_zones(id) ON DELETE CASCADE,
  wall_kind text NOT NULL DEFAULT 'rock'
    CHECK (wall_kind IN ('rock','ice','forest','wall','river')),
  -- Mittelpunkt + Endpunkte des Wand-Segments (Linie zwischen Zone-Centroiden)
  midpoint_lat numeric NOT NULL,
  midpoint_lng numeric NOT NULL,
  point_a_lat numeric NOT NULL,
  point_a_lng numeric NOT NULL,
  point_b_lat numeric NOT NULL,
  point_b_lng numeric NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_saga_camp_walls_bracket ON public.saga_camp_walls(bracket_id);

ALTER TABLE public.saga_camp_walls ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='saga_camp_walls' AND policyname='saga_camp_walls_public_read') THEN
    CREATE POLICY saga_camp_walls_public_read ON public.saga_camp_walls FOR SELECT USING (true);
  END IF;
END $$;
