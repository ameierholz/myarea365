-- ══════════════════════════════════════════════════════════════════════════
-- Wächter-Klasse "Diebe" — 4 Spezialisten für RSS-Spots
-- ══════════════════════════════════════════════════════════════════════════
-- Jeder Dieb hat eine Spezialität (scrapyard/factory/atm/datacenter) und
-- gewährt beim Sammeln am passenden Spot Yield- + Speed-Bonus.
-- ══════════════════════════════════════════════════════════════════════════

-- 1) Spalten für Gather-Bonus auf Archetype-Level
alter table public.guardian_archetypes
  add column if not exists gather_specialty   text,        -- 'scrapyard' | 'factory' | 'atm' | 'datacenter' | null
  add column if not exists gather_yield_mult  numeric(3,2) default 1.0,  -- 1.0 = neutral, 1.5 = +50%
  add column if not exists gather_speed_mult  numeric(3,2) default 1.0;  -- 1.0 = neutral, 2.0 = halbierte Zeit

-- 2) Neue Klasse Diebe
insert into public.guardian_classes (id, label, icon, color, buff_name, buff_desc, counter_id)
values (
  'thief',
  'Diebe',
  '🥷',
  '#FFD700',
  'Plünderzug',
  'Bonus auf RSS-Spots — Yield + Sammelgeschwindigkeit, je nach Spezialität',
  null
)
on conflict (id) do update set
  label    = excluded.label,
  icon     = excluded.icon,
  color    = excluded.color,
  buff_name= excluded.buff_name,
  buff_desc= excluded.buff_desc;

-- 3) 4 Archetypes — einer pro RSS-Spot, gestaffelte Rarität
insert into public.guardian_archetypes (
  id, name, class_id, role, rarity, emoji,
  base_atk, base_def, base_hp, base_spd,
  ability_id, ability_name, ability_desc,
  gather_specialty, gather_yield_mult, gather_speed_mult,
  lore, species, gender, guardian_type
) values
  -- Common: Schrottplatz-Spezialist (+40% Yield)
  ('rax_schrottschlitzer', 'Rax Schrottschlitzer', 'thief', 'schurke', 'common', '⚙️',
   12, 8, 80, 22,
   'thief_scrapyard', 'Müllgriff',
   'Sammelt am Schrottplatz +40% Tech-Schrott. Kennt jede Ritze, jeden Container.',
   'scrapyard', 1.40, 1.10,
   'Wuchs in der Müllhalde unter dem Funkturm auf. Kennt das Eisen besser als Menschen.',
   'human', 'male', 'marksman'),

  -- Rare: Fabrik-Spezialist (2x Speed)
  ('vivi_maschinenhackerin', 'Vivi Maschinenhackerin', 'thief', 'schurke', 'rare', '🔩',
   14, 10, 90, 26,
   'thief_factory', 'Schichtwechsel',
   'Halbiert die Sammelzeit in Fabriken durch parallelisiertes Plündern.',
   'factory', 1.20, 2.00,
   'Tarnt sich als Schichtarbeiterin und schleust Komponenten unbemerkt aus den Werkshallen.',
   'human', 'female', 'marksman'),

  -- Epic: ATM/Krypto-Spezialist (+50% Yield)
  ('zero_kryptophantom', 'Zero Kryptophantom', 'thief', 'schurke', 'epic', '💸',
   16, 12, 100, 28,
   'thief_atm', 'Wallet-Drain',
   'Plündert ATMs mit +50% Krypto-Yield. Verschlüsselte Spuren, kein Forensik-Trail.',
   'atm', 1.50, 1.20,
   'Niemand hat sein Gesicht gesehen. Banken zucken zusammen, wenn sein Hash auftaucht.',
   'human', 'neutral', 'marksman'),

  -- Legendary: Datacenter-Spezialist (+30% Yield + 1.5x Speed)
  ('nyx_signaldieb', 'Nyx Signaldieb', 'thief', 'schurke', 'legendary', '📡',
   20, 15, 120, 32,
   'thief_datacenter', 'Bandbreiten-Heist',
   'Datacenter-Plünderung in 1.5x Zeit + 30% mehr Bandbreite. Ghost-Mode aktiv.',
   'datacenter', 1.30, 1.50,
   'Geistert durch Server-Racks wie Datenpakete. Niemand hat ihn je gefilmt.',
   'human', 'female', 'marksman')
on conflict (id) do update set
  name              = excluded.name,
  class_id          = excluded.class_id,
  role              = excluded.role,
  rarity            = excluded.rarity,
  emoji             = excluded.emoji,
  base_atk          = excluded.base_atk,
  base_def          = excluded.base_def,
  base_hp           = excluded.base_hp,
  base_spd          = excluded.base_spd,
  ability_id        = excluded.ability_id,
  ability_name      = excluded.ability_name,
  ability_desc      = excluded.ability_desc,
  gather_specialty  = excluded.gather_specialty,
  gather_yield_mult = excluded.gather_yield_mult,
  gather_speed_mult = excluded.gather_speed_mult,
  lore              = excluded.lore,
  species           = excluded.species,
  gender            = excluded.gender,
  guardian_type     = excluded.guardian_type;

-- 4) Helper: liest Bonus für (guardian, node-kind) — null-safe
create or replace function public.thief_bonus_for(
  p_guardian_id uuid, p_node_kind text
) returns table(yield_mult numeric, speed_mult numeric)
language sql stable as $$
  select
    coalesce(case when ga.gather_specialty = p_node_kind then ga.gather_yield_mult else 1.0 end, 1.0) as yield_mult,
    coalesce(case when ga.gather_specialty = p_node_kind then ga.gather_speed_mult else 1.0 end, 1.0) as speed_mult
  from public.user_guardians ug
  join public.guardian_archetypes ga on ga.id = ug.archetype_id
  where ug.id = p_guardian_id
  limit 1;
$$;
grant execute on function public.thief_bonus_for(uuid, text) to authenticated;

-- 5) start_gather_march: Speed-Bonus berücksichtigen
create or replace function public.start_gather_march(
  p_node_id     bigint,
  p_guardian_id uuid,
  p_troop_count int,
  p_user_lat    double precision,
  p_user_lng    double precision
) returns jsonb language plpgsql security definer as $$
declare
  v_user_id uuid := auth.uid();
  v_node    public.resource_nodes%rowtype;
  v_dist_m  double precision;
  v_walk_s  int;
  v_gather_s int;
  v_arrives timestamptz;
  v_finishes timestamptz;
  v_returns timestamptz;
  v_march_id bigint;
  v_speed_mult numeric := 1.0;
begin
  if v_user_id is null then return jsonb_build_object('error','not_authenticated'); end if;

  select * into v_node from public.resource_nodes where id = p_node_id;
  if not found then return jsonb_build_object('error','node_not_found'); end if;
  if v_node.depleted_at is not null then return jsonb_build_object('error','node_depleted'); end if;

  -- Thief-Speed-Bonus (1.0 wenn nicht passend)
  select coalesce(speed_mult, 1.0) into v_speed_mult
    from public.thief_bonus_for(p_guardian_id, v_node.kind);

  v_dist_m := st_distance(
    st_setsrid(st_makepoint(p_user_lng, p_user_lat), 4326)::geography,
    v_node.geom::geography
  );

  v_walk_s := greatest(60, (v_dist_m / 1.39)::int);
  -- Sammelzeit durch speed_mult teilen (2.0 = Halbierung)
  v_gather_s := greatest(60, ((v_node.current_yield / 1000 * 300 / greatest(1, p_troop_count / 100))::numeric / v_speed_mult)::int);

  v_arrives  := now() + (v_walk_s    || ' seconds')::interval;
  v_finishes := v_arrives + (v_gather_s || ' seconds')::interval;
  v_returns  := v_finishes + (v_walk_s || ' seconds')::interval;

  insert into public.gather_marches (user_id, node_id, guardian_id, troop_count, started_at, arrives_at, finishes_at, returns_at, status)
  values (v_user_id, p_node_id, p_guardian_id, p_troop_count, now(), v_arrives, v_finishes, v_returns, 'marching')
  returning id into v_march_id;

  return jsonb_build_object(
    'ok', true, 'march_id', v_march_id,
    'arrives_at', v_arrives, 'finishes_at', v_finishes, 'returns_at', v_returns,
    'walk_seconds', v_walk_s, 'gather_seconds', v_gather_s,
    'thief_speed_mult', v_speed_mult
  );
end $$;

-- 6) tick_gather_marches: Yield-Bonus auf collected anwenden
create or replace function public.tick_gather_marches() returns int language plpgsql security definer as $$
declare
  v_now timestamptz := now();
  v_count int := 0;
  v_m public.gather_marches%rowtype;
  v_node public.resource_nodes%rowtype;
  v_yield_per_tick bigint;
  v_collected bigint;
  v_yield_mult numeric;
begin
  update public.gather_marches set status = 'gathering'
   where status = 'marching' and v_now >= arrives_at;

  for v_m in select * from public.gather_marches where status = 'gathering' loop
    select * into v_node from public.resource_nodes where id = v_m.node_id;
    if not found then continue; end if;

    -- Thief-Yield-Bonus
    select coalesce(yield_mult, 1.0) into v_yield_mult
      from public.thief_bonus_for(v_m.guardian_id, v_node.kind);

    v_yield_per_tick := greatest(1, (v_node.total_yield / extract(epoch from (v_m.finishes_at - v_m.arrives_at)) * 60)::bigint);

    -- collected mit yield_mult skaliert (Boni werden "extra" oben drauf gepackt,
    -- ohne den Node-Pool stärker zu reduzieren)
    v_collected := least(
      ((v_node.current_yield + v_m.collected) * v_yield_mult)::bigint,
      ((v_node.total_yield * extract(epoch from (v_now - v_m.arrives_at)) / extract(epoch from (v_m.finishes_at - v_m.arrives_at))) * v_yield_mult)::bigint
    );

    update public.gather_marches set collected = v_collected where id = v_m.id;

    update public.resource_nodes
       set current_yield = greatest(0, current_yield - v_yield_per_tick),
           depleted_at = case when current_yield - v_yield_per_tick <= 0 then v_now else null end,
           respawn_at  = case when current_yield - v_yield_per_tick <= 0 then v_now + interval '36 hours' else null end
     where id = v_m.node_id;

    v_count := v_count + 1;
  end loop;

  update public.gather_marches m set status = 'returning'
   where status = 'gathering'
     and (v_now >= finishes_at or exists (select 1 from public.resource_nodes n where n.id = m.node_id and n.depleted_at is not null));

  for v_m in select * from public.gather_marches where status = 'returning' and v_now >= returns_at loop
    update public.gather_marches set status = 'completed', completed_at = v_now where id = v_m.id;
    v_count := v_count + 1;
  end loop;

  update public.resource_nodes
     set current_yield = total_yield, depleted_at = null, respawn_at = null
   where depleted_at is not null and respawn_at is not null and v_now >= respawn_at;

  return v_count;
end $$;
