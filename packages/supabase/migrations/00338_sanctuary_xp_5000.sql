-- 00338_sanctuary_xp_5000.sql
-- XP-Reward 10000 → 5000. 10k war zu viel, macht andere XP-Quellen
-- (Quests, Trupps trainieren) vergleichsweise irrelevant.

ALTER TABLE public.sanctuaries ALTER COLUMN xp_reward SET DEFAULT 5000;
UPDATE public.sanctuaries SET xp_reward = 5000 WHERE xp_reward = 10000;

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
    values (d.id, d.name, v_pt.lat, v_pt.lng, v_emoji, 5000, v_today_end, now())
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

REVOKE ALL ON FUNCTION public.rotate_sanctuaries() FROM public;
GRANT EXECUTE ON FUNCTION public.rotate_sanctuaries() TO authenticated, service_role;
