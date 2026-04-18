-- Denormalisierte Zaehler auf users-Tabelle fuer schnelle Achievement-Progress-Anzeige.
-- Trigger aktualisieren sie bei Insert in street_segments / streets_claimed / territory_polygons.

alter table public.users
  add column if not exists segments_total int not null default 0,
  add column if not exists streets_total int not null default 0,
  add column if not exists polygons_total int not null default 0;

create or replace function public.bump_user_segments() returns trigger language plpgsql as $$
begin
  update public.users set segments_total = segments_total + 1 where id = new.user_id;
  return new;
end $$;

create or replace function public.bump_user_streets() returns trigger language plpgsql as $$
begin
  update public.users set streets_total = streets_total + 1 where id = new.user_id;
  return new;
end $$;

create or replace function public.bump_user_polygons() returns trigger language plpgsql as $$
begin
  update public.users set polygons_total = polygons_total + 1 where id = new.claimed_by_user_id;
  return new;
end $$;

drop trigger if exists trg_bump_user_segments on public.street_segments;
create trigger trg_bump_user_segments after insert on public.street_segments
  for each row execute function public.bump_user_segments();

drop trigger if exists trg_bump_user_streets on public.streets_claimed;
create trigger trg_bump_user_streets after insert on public.streets_claimed
  for each row execute function public.bump_user_streets();

drop trigger if exists trg_bump_user_polygons on public.territory_polygons;
create trigger trg_bump_user_polygons after insert on public.territory_polygons
  for each row execute function public.bump_user_polygons();
