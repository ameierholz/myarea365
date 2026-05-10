-- 00296_city_dons_versioned.sql
-- Don pro Stadt — versioniert für Cold-Start-Resilienz.
-- Bisher lebte das Schema NUR in der Live-DB (per MCP angewendet),
-- die Marker-Migration 00286 hat es nur erwähnt. Bei Cold-Start/Restore
-- wäre alles verloren. Diese Migration enthält das vollständige Schema +
-- alle RPCs, idempotent (CREATE IF NOT EXISTS / OR REPLACE).

-- 1) Aktive Stadt-Dons (1 Don pro Stadt-Server)
create table if not exists public.city_dons (
  city_slug      text primary key,
  user_id        uuid references auth.users(id) on delete set null,
  crew_id        uuid references public.crews(id) on delete set null,
  took_office_at timestamptz not null default now(),
  predecessor    uuid,
  total_terms    integer not null default 1,
  updated_at     timestamptz not null default now()
);

alter table public.city_dons enable row level security;
drop policy if exists "city_dons_read" on public.city_dons;
create policy "city_dons_read" on public.city_dons for select using (true);

-- 2) History
create table if not exists public.city_don_history (
  id             uuid primary key default gen_random_uuid(),
  city_slug      text not null,
  user_id        uuid not null,
  crew_id        uuid,
  took_office_at timestamptz not null,
  ended_at       timestamptz not null default now(),
  succeeded_by   uuid,
  created_at     timestamptz not null default now()
);

create index if not exists idx_don_hist_city on public.city_don_history(city_slug, took_office_at desc);
alter table public.city_don_history enable row level security;
drop policy if exists "don_hist_read" on public.city_don_history;
create policy "don_hist_read" on public.city_don_history for select using (true);


-- 3) get_city_don (rename to bestehend in DB)
create or replace function public.get_city_don(p_city_slug text)
returns jsonb
language plpgsql stable
set search_path = public, extensions, pg_temp
as $$
declare v_d jsonb;
begin
  select to_jsonb(x) into v_d from (
    select cd.city_slug, cd.user_id, cd.crew_id, cd.took_office_at, cd.total_terms,
           coalesce(u.display_name, u.username, '—') as don_name,
           c.name as crew_name,
           upper(left(regexp_replace(coalesce(c.name,'?'),'[^a-zA-Z0-9]','','g'), 4)) as crew_tag,
           coalesce(c.territory_color, '#FFD700') as crew_color
      from public.city_dons cd
      left join public.users u on u.id = cd.user_id
      left join public.crews c on c.id = cd.crew_id
     where cd.city_slug = p_city_slug
  ) x;
  return jsonb_build_object('ok', true, 'don', v_d);
end
$$;

grant execute on function public.get_city_don(text) to authenticated, anon;


-- 4) get_my_city_don
create or replace function public.get_my_city_don()
returns jsonb
language plpgsql stable
set search_path = public, extensions, pg_temp
as $$
declare
  v_user uuid := auth.uid();
  v_plz text;
  v_slug text;
begin
  if v_user is null then return jsonb_build_object('ok', false, 'error', 'auth_required'); end if;
  select heimat_plz into v_plz from public.users where id = v_user;
  if v_plz is null then return jsonb_build_object('ok', false, 'error', 'no_heimat_plz'); end if;
  select city_slug into v_slug from public.plz_to_city where plz_prefix = left(v_plz, 2);
  if v_slug is null then return jsonb_build_object('ok', false, 'error', 'no_city_mapping', 'plz', v_plz); end if;
  return public.get_city_don(v_slug) || jsonb_build_object('city_slug', v_slug);
end
$$;

grant execute on function public.get_my_city_don() to authenticated;


-- 5) claim_city_throne — wird vom Stronghold-Defeat-Trigger gerufen.
-- Sieger-Crew-Leader wird Don, alter Don (falls vorhanden) wandert in History.
create or replace function public.claim_city_throne(
  p_city_slug text,
  p_user_id uuid,
  p_crew_id uuid
) returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  v_old record;
begin
  if p_city_slug is null or p_user_id is null then
    return jsonb_build_object('ok', false, 'error', 'invalid_params');
  end if;

  select * into v_old from public.city_dons where city_slug = p_city_slug for update;

  if found then
    if v_old.user_id = p_user_id then
      -- Schon Don — Term-Counter +1, kein History-Insert
      update public.city_dons set total_terms = total_terms + 1, updated_at = now()
        where city_slug = p_city_slug;
      return jsonb_build_object('ok', true, 'noop', true);
    end if;

    -- Vorgänger archivieren
    insert into public.city_don_history (city_slug, user_id, crew_id, took_office_at, ended_at, succeeded_by)
      values (v_old.city_slug, v_old.user_id, v_old.crew_id, v_old.took_office_at, now(), p_user_id);

    update public.city_dons set
      user_id = p_user_id, crew_id = p_crew_id,
      took_office_at = now(), predecessor = v_old.user_id,
      total_terms = 1, updated_at = now()
    where city_slug = p_city_slug;
  else
    insert into public.city_dons (city_slug, user_id, crew_id, took_office_at, total_terms)
      values (p_city_slug, p_user_id, p_crew_id, now(), 1);
  end if;

  return jsonb_build_object('ok', true, 'city_slug', p_city_slug, 'user_id', p_user_id);
end
$$;

grant execute on function public.claim_city_throne(text, uuid, uuid) to service_role;


-- 6) Don-History-Liste (UI: "ehemalige Bosse")
create or replace function public.list_city_don_history(p_city_slug text, p_limit int default 20)
returns jsonb
language plpgsql stable
set search_path = public
as $$
begin
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'user_id', h.user_id,
      'don_name', coalesce(u.display_name, u.username, '—'),
      'crew_id', h.crew_id,
      'crew_name', c.name,
      'took_office_at', h.took_office_at,
      'ended_at', h.ended_at,
      'duration_hours', extract(epoch from (h.ended_at - h.took_office_at)) / 3600
    ) order by h.took_office_at desc)
    from public.city_don_history h
    left join public.users u on u.id = h.user_id
    left join public.crews c on c.id = h.crew_id
    where h.city_slug = p_city_slug
    limit p_limit
  ), '[]'::jsonb);
end
$$;

grant execute on function public.list_city_don_history(text, int) to authenticated, anon;
