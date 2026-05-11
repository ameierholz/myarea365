-- 00358_boss_crew_claim.sql
-- Boss-Raid-Mechanik geändert: eine Crew "lockt" den Boss für 30 Min ab dem ersten
-- Angriff. Während dieser Claim können nur Mitglieder der Claim-Crew weiter
-- Schaden machen. Läuft Claim ab (Crew zu langsam / aufgegeben), ist Boss
-- wieder frei für die nächste Crew. Loot ist fix (Legend + Epic + Rare),
-- Staffelung nach Teilnehmerzahl entfällt, max-10-Limit entfällt.

ALTER TABLE public.boss_raids
  ADD COLUMN IF NOT EXISTS claimed_by_crew_id uuid REFERENCES public.crews(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS claim_expires_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_boss_raids_claim_expires
  ON public.boss_raids(claim_expires_at)
  WHERE claim_expires_at IS NOT NULL;

-- Claim-Dauer pro Angriff: jede Damage-Contribution verlängert um 30 Min vom now()
-- (rolling claim). Wenn Crew 30 Min gar nicht angreift, geht der Claim weg.

CREATE OR REPLACE FUNCTION public.contribute_boss_damage(
  p_raid_id uuid,
  p_damage int,
  p_user_lat double precision DEFAULT NULL,
  p_user_lng double precision DEFAULT NULL
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $$
declare
  v_raid record;
  v_new_hp int;
  v_crew_id uuid;
  v_guardian_id uuid;
  v_claim_active boolean;
  v_winner_user record;
  v_stones_granted int := 0;
begin
  select * into v_raid from public.boss_raids where id = p_raid_id and status = 'active' for update;
  if v_raid is null then return jsonb_build_object('error','raid_not_active'); end if;

  select current_crew_id into v_crew_id from public.users where id = auth.uid();
  if v_crew_id is null then
    return jsonb_build_object('error','crew_required');
  end if;
  select id into v_guardian_id from public.user_guardians where user_id = auth.uid() and is_active = true limit 1;

  -- Claim-Check: ist Boss von anderer Crew belegt?
  v_claim_active := v_raid.claim_expires_at is not null
                and v_raid.claim_expires_at > now()
                and v_raid.claimed_by_crew_id is not null;

  if v_claim_active and v_raid.claimed_by_crew_id <> v_crew_id then
    return jsonb_build_object(
      'error', 'claimed_by_other_crew',
      'claimed_by_crew_id', v_raid.claimed_by_crew_id,
      'claim_expires_at', v_raid.claim_expires_at
    );
  end if;

  -- Damage abziehen + Claim setzen/verlängern (rolling +30 min)
  v_new_hp := greatest(0, v_raid.current_hp - p_damage);
  update public.boss_raids
    set current_hp = v_new_hp,
        status = case when v_new_hp = 0 then 'defeated' else status end,
        claimed_by_crew_id = v_crew_id,
        claim_expires_at = now() + interval '30 minutes'
    where id = p_raid_id;

  insert into public.boss_raid_damage(raid_id, user_id, damage, crew_id, guardian_id)
    values (p_raid_id, auth.uid(), p_damage, v_crew_id, v_guardian_id);

  -- Bei Defeat: Loot fix an Claim-Crew (Legend + Epic + Rare). Beschwörungssteine
  -- 5% Chance pro Crew-Mitglied das mindestens 1× zugeschlagen hat.
  if v_new_hp = 0 then
    insert into public.crew_boss_loot(raid_id, crew_id, rarity) values
      (p_raid_id, v_crew_id, 'legend'),
      (p_raid_id, v_crew_id, 'epic'),
      (p_raid_id, v_crew_id, 'rare');

    for v_winner_user in
      select distinct user_id from public.boss_raid_damage
      where raid_id = p_raid_id and crew_id = v_crew_id
    loop
      if random() < 0.05 then
        update public.users set summoning_stones = summoning_stones + 1 where id = v_winner_user.user_id;
        v_stones_granted := v_stones_granted + 1;
      end if;
    end loop;
  end if;

  return jsonb_build_object(
    'ok', true, 'new_hp', v_new_hp, 'defeated', v_new_hp = 0,
    'stones_granted_to_winners', v_stones_granted,
    'claim_expires_at', now() + interval '30 minutes',
    'claimed_by_crew_id', v_crew_id
  );
end $$;

REVOKE ALL ON FUNCTION public.contribute_boss_damage(uuid, int, double precision, double precision) FROM public;
GRANT EXECUTE ON FUNCTION public.contribute_boss_damage(uuid, int, double precision, double precision) TO authenticated;

-- Cron-Helper: Boss-Claims freigeben wenn abgelaufen. Damit /api/map-features
-- die claim-Info konsistent liefert.
CREATE OR REPLACE FUNCTION public.release_expired_boss_claims()
RETURNS int LANGUAGE sql SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  with released as (
    UPDATE public.boss_raids
       SET claimed_by_crew_id = NULL,
           claim_expires_at = NULL
     WHERE claim_expires_at IS NOT NULL
       AND claim_expires_at < now()
       AND status = 'active'
    RETURNING id
  )
  select count(*)::int from released;
$$;

GRANT EXECUTE ON FUNCTION public.release_expired_boss_claims() TO authenticated, service_role;

-- Beim Respawn auch Claim zurücksetzen
CREATE OR REPLACE FUNCTION public.respawn_due_bosses()
RETURNS int LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
declare v_count int;
begin
  with respawned as (
    update public.boss_raids
       set current_hp = coalesce(base_max_hp, max_hp),
           max_hp     = coalesce(base_max_hp, max_hp),
           status     = 'active',
           respawn_at = null,
           starts_at  = now(),
           ends_at    = now() + interval '7 days',
           claimed_by_crew_id = null,
           claim_expires_at = null
     where status = 'defeated'
       and respawn_at is not null
       and respawn_at <= now()
    returning id
  )
  select count(*) into v_count from respawned;
  return v_count;
end $$;

GRANT EXECUTE ON FUNCTION public.respawn_due_bosses() TO authenticated, service_role;
