-- Ausruestungs-System: Helm/Ruestung/Amulett pro Waechter.
-- item_catalog: statischer Katalog (24 Items, geseeded in guardian_items-Seed-File).
-- user_items:   Inventar pro User.
-- guardian_equipment: max 1 Item pro Slot pro aktivem Waechter.

create table if not exists public.item_catalog (
  id text primary key,
  name text not null,
  emoji text not null,
  slot text not null check (slot in ('helm','armor','amulet')),
  rarity text not null check (rarity in ('common','rare','epic','legend')),
  bonus_hp int not null default 0,
  bonus_atk int not null default 0,
  bonus_def int not null default 0,
  bonus_spd int not null default 0,
  lore text
);

create table if not exists public.user_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  item_id text not null references public.item_catalog(id),
  acquired_at timestamptz not null default now(),
  source text not null default 'drop' check (source in ('drop','purchased','crafted','initial'))
);

create index if not exists idx_user_items_user on public.user_items(user_id);

create table if not exists public.guardian_equipment (
  guardian_id uuid not null references public.user_guardians(id) on delete cascade,
  slot text not null check (slot in ('helm','armor','amulet')),
  user_item_id uuid not null references public.user_items(id) on delete cascade,
  equipped_at timestamptz not null default now(),
  primary key (guardian_id, slot)
);

alter table public.item_catalog        enable row level security;
alter table public.user_items          enable row level security;
alter table public.guardian_equipment  enable row level security;

do $$ begin
  if not exists (select 1 from pg_policies where tablename='item_catalog' and policyname='select_all') then
    create policy select_all on public.item_catalog for select using (true);
  end if;
  if not exists (select 1 from pg_policies where tablename='user_items' and policyname='select_own') then
    create policy select_own on public.user_items for select using (auth.uid() = user_id);
  end if;
  if not exists (select 1 from pg_policies where tablename='guardian_equipment' and policyname='select_all') then
    create policy select_all on public.guardian_equipment for select using (true);
  end if;
end $$;

-- Loot-RPC erweitern: rare+ mit 40% Chance Item statt XP
create or replace function public.award_redemption_loot(p_redemption_id uuid)
returns jsonb language plpgsql security definer as $$
declare
  v_user uuid; v_business uuid;
  v_roll float; v_rarity text; v_xp int; v_drop_id uuid;
  v_item_id text; v_user_item_id uuid;
begin
  select user_id, business_id into v_user, v_business from public.deal_redemptions where id = p_redemption_id;
  if v_user is null then return null; end if;
  if exists (select 1 from public.guardian_drops where redemption_id = p_redemption_id) then
    return (select to_jsonb(d) from public.guardian_drops d where redemption_id = p_redemption_id limit 1);
  end if;

  v_roll := random();
  if v_roll < 0.60 then v_rarity := 'none'; v_xp := 0;
  elsif v_roll < 0.85 then v_rarity := 'common'; v_xp := 100;
  elsif v_roll < 0.95 then v_rarity := 'rare'; v_xp := 300;
  elsif v_roll < 0.99 then v_rarity := 'epic'; v_xp := 800;
  else v_rarity := 'legend'; v_xp := 2500; end if;

  if v_rarity in ('rare','epic','legend') and random() < 0.40 then
    select id into v_item_id from public.item_catalog where rarity = v_rarity order by random() limit 1;
    if v_item_id is not null then
      insert into public.user_items (user_id, item_id, source) values (v_user, v_item_id, 'drop')
      returning id into v_user_item_id;
      v_xp := 0;
    end if;
  end if;

  insert into public.guardian_drops (user_id, redemption_id, business_id, rarity, xp_awarded)
  values (v_user, p_redemption_id, v_business, v_rarity, v_xp)
  returning id into v_drop_id;

  update public.deal_redemptions set loot_rarity = v_rarity, loot_xp = v_xp where id = p_redemption_id;
  if v_xp > 0 then
    update public.user_guardians set xp = xp + v_xp where user_id = v_user and is_active;
  end if;

  return jsonb_build_object(
    'id', v_drop_id, 'rarity', v_rarity, 'xp_awarded', v_xp,
    'item_id', v_item_id, 'user_item_id', v_user_item_id
  );
end $$;

-- Equip/Unequip-RPCs
create or replace function public.equip_item(p_user_item_id uuid, p_guardian_id uuid)
returns jsonb language plpgsql security definer as $$
declare v_slot text; v_owner uuid; v_guardian_owner uuid;
begin
  select ic.slot, ui.user_id into v_slot, v_owner
  from public.user_items ui join public.item_catalog ic on ic.id = ui.item_id
  where ui.id = p_user_item_id;
  if v_slot is null then return jsonb_build_object('ok', false, 'error', 'item_not_found'); end if;
  select user_id into v_guardian_owner from public.user_guardians where id = p_guardian_id;
  if v_guardian_owner <> v_owner then return jsonb_build_object('ok', false, 'error', 'not_yours'); end if;
  delete from public.guardian_equipment where guardian_id = p_guardian_id and slot = v_slot;
  insert into public.guardian_equipment (guardian_id, slot, user_item_id) values (p_guardian_id, v_slot, p_user_item_id);
  return jsonb_build_object('ok', true, 'slot', v_slot);
end $$;

create or replace function public.unequip_slot(p_guardian_id uuid, p_slot text)
returns jsonb language plpgsql security definer as $$
begin
  delete from public.guardian_equipment where guardian_id = p_guardian_id and slot = p_slot;
  return jsonb_build_object('ok', true);
end $$;
