-- 00229_expire_event_items.sql
-- Event-Items mit Ablaufdatum: bei Expire wird Item aus Inventar entfernt
-- und in Konvertierungs-Resource (z.B. Krypto/Gold) umgewandelt.

create table if not exists public.event_items (
  item_id              text primary key references public.inventory_item_catalog(id) on delete cascade,
  expires_at           timestamptz not null,
  conversion_target    text not null default 'gold',  -- gold|wood|stone|mana|gems
  conversion_amount    int not null default 1
);

alter table public.event_items enable row level security;
drop policy if exists "event_items_read_all" on public.event_items;
create policy "event_items_read_all" on public.event_items for select using (true);

create or replace function public.expire_event_items()
returns int language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_item record;
  v_inv record;
  v_total_users int := 0;
  v_amount int;
begin
  for v_item in select * from public.event_items where expires_at <= now() loop
    for v_inv in select user_id, count from public.user_inventory_items where catalog_id = v_item.item_id and count > 0 loop
      v_amount := v_inv.count * v_item.conversion_amount;

      if v_item.conversion_target = 'gems' then
        insert into public.user_gems (user_id, gems) values (v_inv.user_id, v_amount)
        on conflict (user_id) do update set gems = user_gems.gems + v_amount, updated_at = now();
        insert into public.gem_transactions (user_id, delta, reason, metadata)
        values (v_inv.user_id, v_amount, 'event_item_expire', jsonb_build_object('item_id', v_item.item_id));
      elsif v_item.conversion_target in ('wood','stone','gold','mana') then
        insert into public.user_resources (user_id, wood, stone, gold, mana, updated_at)
        values (v_inv.user_id,
          case when v_item.conversion_target='wood' then v_amount else 0 end,
          case when v_item.conversion_target='stone' then v_amount else 0 end,
          case when v_item.conversion_target='gold' then v_amount else 0 end,
          case when v_item.conversion_target='mana' then v_amount else 0 end,
          now())
        on conflict (user_id) do update set
          wood  = user_resources.wood  + (case when v_item.conversion_target='wood'  then v_amount else 0 end),
          stone = user_resources.stone + (case when v_item.conversion_target='stone' then v_amount else 0 end),
          gold  = user_resources.gold  + (case when v_item.conversion_target='gold'  then v_amount else 0 end),
          mana  = user_resources.mana  + (case when v_item.conversion_target='mana'  then v_amount else 0 end),
          updated_at = now();
      end if;

      insert into public.user_inbox (user_id, title, body, category, kind, payload, from_label)
      values (v_inv.user_id, 'Event-Item abgelaufen',
        'Dein Item wurde in '||v_amount||' '||v_item.conversion_target||' umgewandelt.',
        'system', 'event_expire',
        jsonb_build_object('item_id', v_item.item_id, 'amount', v_amount, 'target', v_item.conversion_target),
        'System');

      v_total_users := v_total_users + 1;
    end loop;
    delete from public.user_inventory_items where catalog_id = v_item.item_id;
  end loop;
  return v_total_users;
end; $$;

revoke all on function public.expire_event_items() from public;
grant execute on function public.expire_event_items() to authenticated;

-- Beispiel-Item: 'Saison-Token' (catalog erstellen wenn nicht vorhanden)
insert into public.inventory_item_catalog (id, category, name, description, emoji, rarity, payload, sort_order, active)
values ('season_token_demo', 'token', 'Saison-Token', 'Wird bei Saison-Ende zu 1 Krypto.', '🪙', 'rare',
        '{}'::jsonb, 9000, true)
on conflict (id) do nothing;

insert into public.event_items (item_id, expires_at, conversion_target, conversion_amount) values
  ('season_token_demo', now() + interval '90 days', 'gold', 1)
on conflict (item_id) do nothing;
