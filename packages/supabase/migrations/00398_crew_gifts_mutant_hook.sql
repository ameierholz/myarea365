-- ────────────────────────────────────────────────────────────────────────
-- 00398: Crew-Gifts — Hook auf Mutant-Defeat (AFTER UPDATE Trigger)
-- ────────────────────────────────────────────────────────────────────────
-- Statt resolve_due_rallies (~290 LOC) komplett zu recreateen, hängen wir
-- einen AFTER-Trigger an public.rallies: sobald eine Mutant-Rally auf
-- status='done' mit outcome='victory' wechselt, erstellen wir EIN
-- Crew-Gift für jedes aktive Crew-Mitglied (CoD-Stil).
-- ────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public._on_mutant_rally_done()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
DECLARE
  v_mut record;
BEGIN
  IF NEW.target_mutant_id IS NOT NULL
     AND NEW.crew_id IS NOT NULL
     AND NEW.outcome = 'victory'
  THEN
    SELECT level, loot_tier INTO v_mut FROM public.mutants WHERE id = NEW.target_mutant_id;
    IF v_mut.level IS NOT NULL THEN
      PERFORM public.create_crew_mutant_gift(
        NEW.crew_id, v_mut.level, v_mut.loot_tier, NEW.leader_user_id
      );
    END IF;
  END IF;
  RETURN NEW;
END $function$;

DROP TRIGGER IF EXISTS trg_mutant_rally_done ON public.rallies;
CREATE TRIGGER trg_mutant_rally_done
  AFTER UPDATE OF status ON public.rallies
  FOR EACH ROW
  WHEN (NEW.status = 'done' AND OLD.status IS DISTINCT FROM 'done')
  EXECUTE FUNCTION public._on_mutant_rally_done();
