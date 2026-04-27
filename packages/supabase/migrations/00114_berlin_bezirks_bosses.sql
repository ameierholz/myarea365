-- ══════════════════════════════════════════════════════════════════════════
-- Berlin-Bezirks-Bosse: 12 Boss-Raids an bekannten Orten + Respawn-System
-- ══════════════════════════════════════════════════════════════════════════
-- Pro Bezirk 1 Boss mit eigenem Namen, Emoji und Landmark-Position.
-- Nach Defeat: zufälliger Respawn-Timer (3–18 h), dann full HP.
-- ══════════════════════════════════════════════════════════════════════════

-- ─── Schema-Erweiterung: Respawn-Timer ──────────────────────────────────
alter table public.boss_raids
  add column if not exists respawn_at timestamptz,
  add column if not exists base_max_hp int;

-- base_max_hp speichert den Original-HP-Wert (für Full-Reset bei Respawn).
update public.boss_raids set base_max_hp = max_hp where base_max_hp is null;

create index if not exists idx_boss_raids_respawn on public.boss_raids(respawn_at)
  where status = 'defeated' and respawn_at is not null;
create index if not exists idx_boss_raids_active on public.boss_raids(status)
  where status = 'active';

-- ─── contribute_boss_damage erweitern: setze respawn_at bei Defeat ─────
create or replace function public.contribute_boss_damage(p_raid_id uuid, p_damage int)
returns jsonb language plpgsql security definer as $$
declare
  v_raid record;
  v_new_hp int;
  v_respawn_at timestamptz;
begin
  select * into v_raid from public.boss_raids where id = p_raid_id and status = 'active' for update;
  if v_raid is null then return jsonb_build_object('error','raid_not_active'); end if;
  v_new_hp := greatest(0, v_raid.current_hp - p_damage);
  if v_new_hp = 0 then
    -- Zufälliger Respawn-Timer: 60 Min – 6 Std (in Minuten-Granularität)
    v_respawn_at := now() + (60 + floor(random() * 301))::int * interval '1 minute';
    update public.boss_raids
       set current_hp = 0, status = 'defeated', respawn_at = v_respawn_at
     where id = p_raid_id;
  else
    update public.boss_raids set current_hp = v_new_hp where id = p_raid_id;
  end if;
  insert into public.boss_raid_damage(raid_id, user_id, damage)
    values (p_raid_id, auth.uid(), p_damage);
  return jsonb_build_object('ok', true, 'new_hp', v_new_hp, 'defeated', v_new_hp = 0,
                            'respawn_at', v_respawn_at);
end $$;
grant execute on function public.contribute_boss_damage(uuid, int) to authenticated;

-- ─── Respawn-RPC (cron-fähig) ───────────────────────────────────────────
create or replace function public.respawn_due_bosses()
returns int language plpgsql security definer as $$
declare v_count int;
begin
  with respawned as (
    update public.boss_raids
       set current_hp = coalesce(base_max_hp, max_hp),
           max_hp     = coalesce(base_max_hp, max_hp),
           status     = 'active',
           respawn_at = null,
           starts_at  = now(),
           ends_at    = now() + interval '7 days'
     where status = 'defeated'
       and respawn_at is not null
       and respawn_at <= now()
    returning id
  )
  select count(*) into v_count from respawned;
  return v_count;
end $$;
revoke all on function public.respawn_due_bosses() from public;
grant execute on function public.respawn_due_bosses() to authenticated;

-- ─── Seed: 12 Bezirks-Bosse an Berliner Wahrzeichen ─────────────────────
-- Idempotent via unique-key auf name (legen Constraint an, falls fehlt)
do $$ begin
  if not exists (
    select 1 from pg_indexes where indexname = 'uniq_boss_raids_name'
  ) then
    create unique index uniq_boss_raids_name on public.boss_raids(name);
  end if;
end $$;

insert into public.boss_raids(name, emoji, lat, lng, max_hp, current_hp, base_max_hp, reward_loot_rarity, status)
values
  ('Schattenwächter des Alex',     '👹', 52.5208, 13.4094, 250000, 250000, 250000, 'legendary', 'active'),  -- Mitte / Fernsehturm
  ('Berserker am Brandenburger Tor','🦾', 52.5163, 13.3777, 220000, 220000, 220000, 'legendary', 'active'),  -- Mitte / Brandenburger Tor
  ('Brückenbestie der Oberbaum',   '🐗', 52.5023, 13.4451, 180000, 180000, 180000, 'epic',      'active'),  -- Friedrichshain-Kreuzberg
  ('Mauerpark-Schrecken',          '🐺', 52.5441, 13.4023, 160000, 160000, 160000, 'epic',      'active'),  -- Pankow / Mauerpark
  ('Hexe von Charlottenburg',      '🧙', 52.5208, 13.2961, 200000, 200000, 200000, 'legendary', 'active'),  -- Charlottenburg-Wilmersdorf
  ('Zitadellen-Drache',            '🐲', 52.5407, 13.2128, 240000, 240000, 240000, 'legendary', 'active'),  -- Spandau
  ('Geist vom Schlachtensee',      '👻', 52.4344, 13.2073, 150000, 150000, 150000, 'epic',      'active'),  -- Steglitz-Zehlendorf
  ('Tempelhofer Titan',            '🤖', 52.4753, 13.4029, 220000, 220000, 220000, 'legendary', 'active'),  -- Tempelhof-Schöneberg
  ('Hermannplatz-Hydra',           '🐍', 52.4865, 13.4248, 190000, 190000, 190000, 'epic',      'active'),  -- Neukölln
  ('Müggelturm-Moloch',            '👁', 52.4174, 13.6450, 170000, 170000, 170000, 'epic',      'active'),  -- Treptow-Köpenick
  ('Marzahner Maschinist',         '⚙', 52.5396, 13.5640, 160000, 160000, 160000, 'epic',      'active'),  -- Marzahn-Hellersdorf
  ('Tierpark-Tyrann',              '🐯', 52.4995, 13.5278, 200000, 200000, 200000, 'legendary', 'active'),  -- Lichtenberg
  ('Tegeler Seeungeheuer',         '🐙', 52.5879, 13.2587, 180000, 180000, 180000, 'epic',      'active')   -- Reinickendorf
on conflict (name) do nothing;

-- Direkt Respawn-Check ausführen (resettet ggf. überfällige Bosse)
select public.respawn_due_bosses();
