-- 00354_sanctuary_artwork.sql
-- Sanctuary-Artwork-Pool. cosmetic_artwork.kind um 'sanctuary' erweitern,
-- sanctuaries-Tabelle um image_url/video_url/artwork_slot_id (denormalisiert für
-- Frontend-Performance), rotate_sanctuaries pickt random aus dem Pool.

ALTER TABLE public.cosmetic_artwork
  DROP CONSTRAINT IF EXISTS cosmetic_artwork_kind_check;

ALTER TABLE public.cosmetic_artwork
  ADD CONSTRAINT cosmetic_artwork_kind_check
  CHECK (kind = any (array[
    'marker','light','pin_theme','siegel','potion','rank',
    'base_theme','building','resource','chest','stronghold',
    'nameplate','ui_icon','troop','base_ring','loot_drop',
    'resource_node','inventory_item','modal_background','sanctuary'
  ]));

ALTER TABLE public.sanctuaries
  ADD COLUMN IF NOT EXISTS image_url text,
  ADD COLUMN IF NOT EXISTS video_url text,
  ADD COLUMN IF NOT EXISTS artwork_slot_id text;

-- Helper: random artwork aus dem sanctuary-Pool picken
CREATE OR REPLACE FUNCTION public.pick_random_sanctuary_art(p_seed text)
RETURNS TABLE(slot_id text, image_url text, video_url text)
LANGUAGE plpgsql STABLE
SET search_path = public, pg_temp
AS $$
declare
  v_count int;
  v_idx int;
begin
  SELECT count(*) INTO v_count FROM public.cosmetic_artwork
    WHERE kind = 'sanctuary' AND (image_url IS NOT NULL OR video_url IS NOT NULL);
  IF v_count = 0 THEN
    RETURN;
  END IF;
  v_idx := abs(hashtext(p_seed)) % v_count;
  RETURN QUERY
    SELECT a.slot_id, a.image_url, a.video_url
    FROM public.cosmetic_artwork a
    WHERE a.kind = 'sanctuary' AND (a.image_url IS NOT NULL OR a.video_url IS NOT NULL)
    ORDER BY a.slot_id
    OFFSET v_idx
    LIMIT 1;
end $$;

GRANT EXECUTE ON FUNCTION public.pick_random_sanctuary_art(text) TO authenticated, service_role;

-- rotate_sanctuaries: pickt zusätzlich random artwork aus dem Pool.
-- Fallback: Emoji-Pool wie bisher, wenn kein Artwork hochgeladen ist.
CREATE OR REPLACE FUNCTION public.rotate_sanctuaries()
RETURNS int LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $$
declare
  d record;
  v_pt record;
  v_art record;
  v_count int := 0;
  v_today_end timestamptz := date_trunc('day', now() at time zone 'Europe/Berlin') + interval '1 day' - interval '1 second';
  v_emoji_pool text[] := ARRAY['⛩️','🏛️','🛕','⚜️','🗿'];
  v_emoji text;
  v_seed text;
begin
  for d in select id, name, city_slug from public.city_districts order by id loop
    select * into v_pt from public.random_point_in_district_urban(d.id);
    if v_pt.lat is null then continue; end if;

    v_seed := d.name || to_char(now(), 'YYYY-MM-DD');
    v_emoji := v_emoji_pool[1 + (abs(hashtext(v_seed)) % array_length(v_emoji_pool, 1))];
    select * into v_art from public.pick_random_sanctuary_art(v_seed);

    insert into public.sanctuaries (district_id, name, lat, lng, emoji, xp_reward, valid_until, rotated_at, image_url, video_url, artwork_slot_id)
    values (d.id, d.name, v_pt.lat, v_pt.lng, v_emoji, 5000, v_today_end, now(), v_art.image_url, v_art.video_url, v_art.slot_id)
    on conflict (district_id) do update set
      lat = excluded.lat,
      lng = excluded.lng,
      emoji = excluded.emoji,
      valid_until = excluded.valid_until,
      rotated_at = excluded.rotated_at,
      name = excluded.name,
      image_url = excluded.image_url,
      video_url = excluded.video_url,
      artwork_slot_id = excluded.artwork_slot_id;
    v_count := v_count + 1;
  end loop;
  return v_count;
end $$;

-- 12 leere Slots seeden (Image/Video kommt per Admin-Upload). PK = (kind, slot_id, variant).
INSERT INTO public.cosmetic_artwork (kind, slot_id, variant) VALUES
  ('sanctuary', 'torii', 'neutral'),
  ('sanctuary', 'temple', 'neutral'),
  ('sanctuary', 'stupa', 'neutral'),
  ('sanctuary', 'shrine', 'neutral'),
  ('sanctuary', 'statue', 'neutral'),
  ('sanctuary', 'obelisk', 'neutral'),
  ('sanctuary', 'crystal', 'neutral'),
  ('sanctuary', 'brazier', 'neutral'),
  ('sanctuary', 'runestone', 'neutral'),
  ('sanctuary', 'altar', 'neutral'),
  ('sanctuary', 'pagoda', 'neutral'),
  ('sanctuary', 'lantern', 'neutral')
ON CONFLICT (kind, slot_id, variant) DO NOTHING;
