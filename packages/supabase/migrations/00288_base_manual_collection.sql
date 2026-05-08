-- ════════════════════════════════════════════════════════════════════════
-- Phase B: Manuelles Einsammeln aus _per_hour-Buildings
-- ════════════════════════════════════════════════════════════════════════
-- Walking ist weg, RSS kommt aus passiven _per_hour-Buildings (saegewerk/
-- steinbruch/goldmine/mana_quelle) — User muss aktiv sammeln, mit Capacity-
-- Cap nach 6 Stunden.
--
-- Anker: base_buildings.last_collected_at (existiert schon seit Phase 1).
-- Kein Cron-Tick nötig — pending wird on-demand berechnet beim Collect.
--
-- Rate = effect_per_level * level
-- Pending = min(elapsed_hours * rate, 6 * rate)
-- ════════════════════════════════════════════════════════════════════════

-- ─── Helper: Production-Resource aus effect_key ─────────────────────────
create or replace function public._production_resource(p_effect_key text)
returns text language sql immutable as $$
  select case p_effect_key
    when 'wood_per_hour'  then 'wood'
    when 'stone_per_hour' then 'stone'
    when 'gold_per_hour'  then 'gold'
    when 'mana_per_hour'  then 'mana'
    else null
  end;
$$;

-- ─── Helper: Internal Collect für 1 Building-Row ────────────────────────
-- Gibt (resource, amount, capped) zurück. Locked die row und transferiert.
create or replace function public._collect_one_building(p_bb_id uuid)
returns table (resource text, amount int, capped boolean)
language plpgsql security definer set search_path = public
as $$
declare
  v_user      uuid;
  v_bb        public.base_buildings%rowtype;
  v_cat       public.buildings_catalog%rowtype;
  v_resource  text;
  v_rate      numeric;
  v_cap       numeric;
  v_anchor    timestamptz;
  v_elapsed_h numeric;
  v_raw       numeric;
  v_amount    int;
  v_capped    boolean;
begin
  -- Lock building row
  select * into v_bb from public.base_buildings where id = p_bb_id for update;
  if not found then raise exception 'building_not_found'; end if;

  -- Owner check via base
  select owner_user_id into v_user from public.bases where id = v_bb.base_id;
  if v_user is null then raise exception 'orphan_base'; end if;
  if v_user <> auth.uid() then raise exception 'not_owner'; end if;

  -- Catalog lookup
  select * into v_cat from public.buildings_catalog where id = v_bb.building_id;
  if not found then raise exception 'catalog_missing'; end if;

  v_resource := public._production_resource(v_cat.effect_key);
  if v_resource is null then
    -- Kein Production-Building — nichts zu tun
    return query select null::text, 0, false;
    return;
  end if;

  -- Rate + 6h-Cap
  v_rate := v_cat.effect_per_level * v_bb.level;
  v_cap  := 6 * v_rate;

  -- Anker
  v_anchor    := coalesce(v_bb.last_collected_at, v_bb.created_at);
  v_elapsed_h := greatest(0, extract(epoch from (now() - v_anchor)) / 3600.0);

  v_raw    := v_elapsed_h * v_rate;
  v_capped := v_raw >= v_cap;
  v_amount := floor(least(v_raw, v_cap))::int;

  if v_amount <= 0 then
    return query select v_resource, 0, v_capped;
    return;
  end if;

  -- Transfer in user_resources
  insert into public.user_resources (user_id) values (v_user) on conflict do nothing;
  update public.user_resources set
    wood        = wood        + case when v_resource = 'wood'  then v_amount else 0 end,
    stone       = stone       + case when v_resource = 'stone' then v_amount else 0 end,
    gold        = gold        + case when v_resource = 'gold'  then v_amount else 0 end,
    mana        = mana        + case when v_resource = 'mana'  then v_amount else 0 end,
    updated_at  = now()
  where user_id = v_user;

  -- Anker zurücksetzen
  update public.base_buildings set last_collected_at = now() where id = p_bb_id;

  return query select v_resource, v_amount, v_capped;
end $$;

-- ─── Public RPC: 1 Building einsammeln ──────────────────────────────────
create or replace function public.collect_building(p_building_id text)
returns table (resource text, amount int, capped boolean)
language plpgsql security definer set search_path = public
as $$
declare
  v_user    uuid := auth.uid();
  v_base_id uuid;
  v_bb_id   uuid;
begin
  if v_user is null then raise exception 'not_authenticated'; end if;

  select id into v_base_id from public.bases where owner_user_id = v_user;
  if v_base_id is null then raise exception 'no_base'; end if;

  select id into v_bb_id from public.base_buildings
    where base_id = v_base_id and building_id = p_building_id;
  if v_bb_id is null then raise exception 'building_not_built'; end if;

  return query select * from public._collect_one_building(v_bb_id);
end $$;

grant execute on function public.collect_building(text) to authenticated;

-- ─── Public RPC: Alle Production-Buildings einsammeln ───────────────────
create or replace function public.collect_all_buildings()
returns table (
  collected_count int,
  totals          jsonb
)
language plpgsql security definer set search_path = public
as $$
declare
  v_user      uuid := auth.uid();
  v_base_id   uuid;
  v_count     int := 0;
  v_totals    jsonb := jsonb_build_object('wood', 0, 'stone', 0, 'gold', 0, 'mana', 0);
  rec         record;
  one_result  record;
begin
  if v_user is null then raise exception 'not_authenticated'; end if;

  select id into v_base_id from public.bases where owner_user_id = v_user;
  if v_base_id is null then raise exception 'no_base'; end if;

  for rec in
    select bb.id
    from public.base_buildings bb
    join public.buildings_catalog c on c.id = bb.building_id
    where bb.base_id = v_base_id
      and c.effect_key in ('wood_per_hour','stone_per_hour','gold_per_hour','mana_per_hour')
  loop
    select * into one_result from public._collect_one_building(rec.id);
    if one_result.amount > 0 and one_result.resource is not null then
      v_count := v_count + 1;
      v_totals := jsonb_set(
        v_totals,
        array[one_result.resource],
        to_jsonb((v_totals->>one_result.resource)::numeric + one_result.amount)
      );
    end if;
  end loop;

  return query select v_count, v_totals;
end $$;

grant execute on function public.collect_all_buildings() to authenticated;

-- ─── Sanity: Rate-Liste pro User-Base ──────────────────────────────────
-- Gibt für jedes Production-Building die rate + last_collected_at
-- zurück, damit Frontend pending live anzeigen kann ohne den Cap zu kennen.
create or replace function public.get_building_production_rates()
returns table (
  building_id        text,
  resource           text,
  rate               numeric,
  cap                numeric,
  last_collected_at  timestamptz
)
language plpgsql security definer set search_path = public stable
as $$
declare
  v_user    uuid := auth.uid();
  v_base_id uuid;
begin
  if v_user is null then raise exception 'not_authenticated'; end if;
  select id into v_base_id from public.bases where owner_user_id = v_user;
  if v_base_id is null then return; end if;

  return query
  select bb.building_id,
         public._production_resource(c.effect_key) as resource,
         (c.effect_per_level * bb.level)::numeric as rate,
         (6 * c.effect_per_level * bb.level)::numeric as cap,
         coalesce(bb.last_collected_at, bb.created_at) as last_collected_at
  from public.base_buildings bb
  join public.buildings_catalog c on c.id = bb.building_id
  where bb.base_id = v_base_id
    and c.effect_key in ('wood_per_hour','stone_per_hour','gold_per_hour','mana_per_hour');
end $$;

grant execute on function public.get_building_production_rates() to authenticated;
