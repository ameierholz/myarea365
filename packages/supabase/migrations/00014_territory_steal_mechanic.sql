-- Steal-Mechanic: Ein Territorium kann nur einem Runner ODER einer Crew gehoeren.
-- Wenn ein neues Polygon ein bestehendes ueberlappt, wird das alte auf 'stolen' gesetzt
-- und der neue Claimer wird neuer Besitzer.

alter table public.territory_polygons
  add column if not exists status text not null default 'active'
    check (status in ('active','stolen','expired')),
  add column if not exists stolen_from_user_id uuid references public.users(id) on delete set null,
  add column if not exists stolen_from_crew_id uuid references public.crews(id) on delete set null,
  add column if not exists stolen_at timestamptz,
  add column if not exists perimeter_m int;

create index if not exists idx_territory_polygons_status on public.territory_polygons(status);
