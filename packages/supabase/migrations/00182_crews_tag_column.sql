-- ══════════════════════════════════════════════════════════════════════════
-- Crews: echte `tag`-Spalte (Kürzel, max 5 Buchstaben, all caps)
-- Wird beim Anlegen aus dem Namen automatisch generiert (erste 4-5
-- Alphanumerics, uppercase). Crew-Owner kann später überschreiben.
-- ══════════════════════════════════════════════════════════════════════════

alter table public.crews
  add column if not exists tag text;

-- Backfill: alle Crews ohne tag bekommen das auto-generierte Kürzel
update public.crews
   set tag = upper(left(regexp_replace(coalesce(name, '?'), '[^a-zA-Z0-9]', '', 'g'), 5))
 where tag is null or tag = '';

-- Constraint: max 5 Zeichen, all caps alphanumerisch
alter table public.crews drop constraint if exists crews_tag_format_check;
alter table public.crews
  add constraint crews_tag_format_check
  check (tag is null or (char_length(tag) between 2 and 5 and tag ~ '^[A-Z0-9]+$'));

-- Trigger: bei Insert/Update von name → tag mitgenerieren falls leer
create or replace function public.crews_autotag()
returns trigger language plpgsql as $$
begin
  if new.tag is null or new.tag = '' then
    new.tag := upper(left(regexp_replace(coalesce(new.name, '?'), '[^a-zA-Z0-9]', '', 'g'), 5));
  end if;
  return new;
end $$;

drop trigger if exists trg_crews_autotag on public.crews;
create trigger trg_crews_autotag
  before insert or update on public.crews
  for each row execute function public.crews_autotag();

-- ── get_bases_in_bbox: liefert jetzt crew_tag pro Pin ───────────────────
-- Runner-Pin → Crew-Tag des Owners (aus crew_members → crews.tag)
-- Crew-Pin   → Crew-Tag der Crew selbst
create or replace function public.get_bases_in_bbox(
  p_min_lat double precision, p_min_lng double precision,
  p_max_lat double precision, p_max_lng double precision
) returns jsonb language plpgsql security definer as $$
declare v_runner jsonb; v_crew jsonb;
begin
  select coalesce(jsonb_agg(jsonb_build_object(
    'kind', 'runner',
    'id', b.id,
    'owner_user_id', b.owner_user_id,
    'lat', b.lat, 'lng', b.lng,
    'level', b.level,
    'theme_id', b.theme_id,
    'pin_label', coalesce(b.pin_label, u.display_name, 'Runner'),
    'crew_tag', oc.tag,
    'is_own', (b.owner_user_id = auth.uid())
  )), '[]'::jsonb) into v_runner
  from public.bases b
  left join public.users u on u.id = b.owner_user_id
  left join public.crew_members om on om.user_id = b.owner_user_id
  left join public.crews oc on oc.id = om.crew_id
  where b.lat is not null and b.lng is not null
    and b.lat between p_min_lat and p_max_lat
    and b.lng between p_min_lng and p_max_lng;

  select coalesce(jsonb_agg(jsonb_build_object(
    'kind', 'crew',
    'id', cb.id,
    'crew_id', cb.crew_id,
    'lat', cb.lat, 'lng', cb.lng,
    'level', cb.level,
    'theme_id', cb.theme_id,
    'pin_label', coalesce(cb.pin_label, c.name, 'Crew'),
    'crew_tag', c.tag,
    'is_own', exists (select 1 from public.crew_members m where m.crew_id = cb.crew_id and m.user_id = auth.uid())
  )), '[]'::jsonb) into v_crew
  from public.crew_bases cb
  left join public.crews c on c.id = cb.crew_id
  where cb.lat is not null and cb.lng is not null
    and cb.lat between p_min_lat and p_max_lat
    and cb.lng between p_min_lng and p_max_lng;

  return jsonb_build_object('ok', true, 'runner', v_runner, 'crew', v_crew);
end $$;
