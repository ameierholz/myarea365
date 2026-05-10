-- ────────────────────────────────────────────────────────────────────────────
-- 00304 — Artwork-Rendering: APIs liefern image_url/video_url für Player-UI
-- ────────────────────────────────────────────────────────────────────────────
-- Mig 00303 hat image_url/video_url-Spalten in alle Asset-Tabellen gepackt.
-- Diese Migration zieht die Spalten in die Read-RPCs nach, damit das Frontend
-- nicht weiter Emoji-Fallbacks rendert wo eigentlich Artwork existiert.
-- ────────────────────────────────────────────────────────────────────────────

-- ─── 1) Achievements: image_url + video_url in der Tabelle ergänzen ──────────
-- list_achievements_for_user um image_url/video_url erweitern. RETURNS TABLE
-- ist immutable, also drop+recreate.

drop function if exists public.list_achievements_for_user(uuid);

create or replace function public.list_achievements_for_user(p_user uuid default auth.uid())
returns table (
  id uuid,
  slug text,
  name text,
  description text,
  icon text,
  image_url text,
  video_url text,
  tier public.achievement_tier,
  xp_reward int,
  unlocked boolean,
  unlocked_at timestamptz
)
language sql
stable
security invoker
set search_path = public
as $$
  select
    a.id, a.slug, a.name, a.description, a.icon, a.image_url, a.video_url,
    a.tier, a.xp_reward,
    (ua.user_id is not null) as unlocked,
    ua.unlocked_at
  from public.achievements a
  left join public.user_achievements ua
    on ua.achievement_id = a.id and ua.user_id = p_user
  order by a.tier, a.name;
$$;

grant execute on function public.list_achievements_for_user(uuid) to authenticated, anon;

comment on function public.list_achievements_for_user(uuid) is
  'Listet alle Achievements + image_url/video_url + Freischalt-Status. Sortiert nach Tier dann Name.';
