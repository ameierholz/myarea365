-- 00330_sanctuary_per_district.sql
-- Sanctuary-Refactor: pro Bezirk eine Sanctuary, tägliche Rotation, 10k XP.
-- Vorher: 2 hardcodierte Sanctuaries für ganz Berlin, 50 XP each.
-- Neu: 1 pro Bezirk (Berlin 12, Hamburg 7, München 25), 10k XP, jede Nacht
-- 00:00 Europe/Berlin neuer Random-Spawn-Punkt innerhalb des Bezirks-Polygons.

ALTER TABLE public.sanctuaries
  ADD COLUMN IF NOT EXISTS district_id bigint REFERENCES public.city_districts(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS valid_until timestamptz,
  ADD COLUMN IF NOT EXISTS rotated_at  timestamptz;

CREATE INDEX IF NOT EXISTS sanctuaries_district_idx ON public.sanctuaries(district_id) WHERE district_id IS NOT NULL;

ALTER TABLE public.sanctuaries ALTER COLUMN xp_reward SET DEFAULT 10000;
UPDATE public.sanctuaries SET xp_reward = 10000 WHERE xp_reward < 10000;

CREATE OR REPLACE FUNCTION public.rotate_sanctuaries()
RETURNS int LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $$
declare
  d record;
  v_pt record;
  v_count int := 0;
  v_today_end timestamptz := date_trunc('day', now() at time zone 'Europe/Berlin') + interval '1 day' - interval '1 second';
  v_emoji_pool text[] := ARRAY['⛩️','🏛️','🛕','⚜️','🗿'];
  v_emoji text;
begin
  for d in select id, name, city_slug from public.city_districts order by id loop
    select * into v_pt from public.random_point_in_district(d.id);
    if v_pt.lat is null then continue; end if;

    v_emoji := v_emoji_pool[1 + (abs(hashtext(d.name || to_char(now(), 'YYYY-MM-DD'))) % array_length(v_emoji_pool, 1))];

    insert into public.sanctuaries (district_id, name, lat, lng, emoji, xp_reward, valid_until, rotated_at)
    values (d.id, d.name, v_pt.lat, v_pt.lng, v_emoji, 10000, v_today_end, now())
    on conflict (district_id) do update set
      lat = excluded.lat,
      lng = excluded.lng,
      emoji = excluded.emoji,
      valid_until = excluded.valid_until,
      rotated_at = excluded.rotated_at,
      name = excluded.name;
    v_count := v_count + 1;
  end loop;
  return v_count;
end $$;

CREATE UNIQUE INDEX IF NOT EXISTS sanctuaries_district_unique ON public.sanctuaries(district_id) WHERE district_id IS NOT NULL;

REVOKE ALL ON FUNCTION public.rotate_sanctuaries() FROM public;
GRANT EXECUTE ON FUNCTION public.rotate_sanctuaries() TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.train_at_sanctuary(p_sanctuary_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
declare
  v_xp int;
  v_valid timestamptz;
  v_today date := current_date;
begin
  if exists (select 1 from public.sanctuary_visits
             where sanctuary_id = p_sanctuary_id and user_id = auth.uid()
             and date_trunc('day', visited_at) = v_today) then
    return jsonb_build_object('error','already_trained_today');
  end if;
  select xp_reward, valid_until into v_xp, v_valid
    from public.sanctuaries where id = p_sanctuary_id;
  if v_xp is null then return jsonb_build_object('error','sanctuary_not_found'); end if;
  if v_valid is not null and v_valid < now() then
    return jsonb_build_object('error','sanctuary_expired');
  end if;
  insert into public.sanctuary_visits(sanctuary_id, user_id) values (p_sanctuary_id, auth.uid());
  update public.user_guardians set xp = xp + v_xp
    where user_id = auth.uid() and is_active = true;
  return jsonb_build_object('ok', true, 'xp_gained', v_xp);
end $$;

GRANT EXECUTE ON FUNCTION public.train_at_sanctuary(uuid) TO authenticated;
