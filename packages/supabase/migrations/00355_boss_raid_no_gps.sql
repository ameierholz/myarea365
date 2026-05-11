-- 00355_boss_raid_no_gps.sql
-- Boss-Raids sind ab sofort ortsunabhängig — Spieler können von überall in
-- ihrem Stadt-Server angreifen (kein "lauf hin"-Requirement). Crew-Limit (10),
-- Loot-Pool und Beschwörungssteine bleiben unverändert. GPS-Parameter werden
-- optional gehalten (Backwards-Compat mit altem Client), aber ignoriert.

-- Alte 2-arg-Variante aus Mig 00114 droppen, damit Supabase-RPC ohne benannte
-- p_user_lat/p_user_lng eindeutig die neue Logik wählt.
DROP FUNCTION IF EXISTS public.contribute_boss_damage(uuid, int);

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
  v_crew_count int;
  v_already_in boolean;
  v_winner_crew uuid;
  v_winner_participants int;
  v_winner_user record;
  v_stones_granted int := 0;
begin
  select * into v_raid from public.boss_raids where id = p_raid_id and status = 'active' for update;
  if v_raid is null then return jsonb_build_object('error','raid_not_active'); end if;

  -- GPS-Check entfernt: kein "too_far" / "location_required" mehr. p_user_lat/p_user_lng werden ignoriert.

  select current_crew_id into v_crew_id from public.users where id = auth.uid();
  select id into v_guardian_id from public.user_guardians where user_id = auth.uid() and is_active = true limit 1;

  if v_crew_id is not null then
    select exists (
      select 1 from public.boss_raid_damage
      where raid_id = p_raid_id and user_id = auth.uid()
    ) into v_already_in;

    if not v_already_in then
      select count(distinct user_id) into v_crew_count
      from public.boss_raid_damage where raid_id = p_raid_id and crew_id = v_crew_id;
      if v_crew_count >= 10 then
        return jsonb_build_object('error','crew_full','max_participants', 10);
      end if;
    end if;
  end if;

  v_new_hp := greatest(0, v_raid.current_hp - p_damage);
  update public.boss_raids
    set current_hp = v_new_hp,
        status = case when v_new_hp = 0 then 'defeated' else status end
    where id = p_raid_id;

  insert into public.boss_raid_damage(raid_id, user_id, damage, crew_id, guardian_id)
    values (p_raid_id, auth.uid(), p_damage, v_crew_id, v_guardian_id);

  if v_new_hp = 0 then
    select crew_id, least(count(distinct user_id), 10)
      into v_winner_crew, v_winner_participants
      from public.boss_raid_damage
      where raid_id = p_raid_id and crew_id is not null
      group by crew_id
      order by sum(damage) desc
      limit 1;

    if v_winner_crew is not null then
      if v_winner_participants >= 7 then
        insert into public.crew_boss_loot(raid_id, crew_id, rarity) values
          (p_raid_id, v_winner_crew, 'legend'),
          (p_raid_id, v_winner_crew, 'epic'),
          (p_raid_id, v_winner_crew, 'rare');
      elsif v_winner_participants >= 4 then
        insert into public.crew_boss_loot(raid_id, crew_id, rarity) values
          (p_raid_id, v_winner_crew, 'legend'),
          (p_raid_id, v_winner_crew, 'epic');
      else
        insert into public.crew_boss_loot(raid_id, crew_id, rarity) values
          (p_raid_id, v_winner_crew, 'legend');
      end if;

      for v_winner_user in
        select distinct user_id from public.boss_raid_damage
        where raid_id = p_raid_id and crew_id = v_winner_crew
      loop
        if random() < 0.05 then
          update public.users set summoning_stones = summoning_stones + 1 where id = v_winner_user.user_id;
          v_stones_granted := v_stones_granted + 1;
        end if;
      end loop;
    end if;
  end if;

  return jsonb_build_object(
    'ok', true, 'new_hp', v_new_hp, 'defeated', v_new_hp = 0,
    'stones_granted_to_winners', v_stones_granted
  );
end $$;

REVOKE ALL ON FUNCTION public.contribute_boss_damage(uuid, int, double precision, double precision) FROM public;
GRANT EXECUTE ON FUNCTION public.contribute_boss_damage(uuid, int, double precision, double precision) TO authenticated;
