-- ══════════════════════════════════════════════════════════════════════════
-- Pop-Up-Angebote: Spontane Bundle-Angebote bei Achievements
-- ══════════════════════════════════════════════════════════════════════════
-- Trigger-basierte Einmal-Angebote (CoD-Style "Pop-Ups"). Werden bei
-- bestimmten Spieler-Events erstellt (Rang-Aufstieg, Wächter freigeschaltet,
-- erste Crew gegründet, …). Jeder Trigger feuert höchstens 1× pro User.
--
-- Inhalt jedes Angebots: 1-5 Stripe-Pakete (z.B. 4,99/9,99/19,99 €) mit
-- jeweils Reward-JSON (gems, monete, items, etc.).
-- ══════════════════════════════════════════════════════════════════════════

create table if not exists public.popup_offer_templates (
  id text primary key,
  trigger_event text not null,         -- z.B. 'rank_reached_3', 'first_guardian', 'first_crew'
  title text not null,
  subtitle text,
  emoji text,
  -- packs[] = array of { sku, price_eur, label, rewards: { gems, coins, item_grants: [{catalog_id, count}] } }
  packs jsonb not null default '[]'::jsonb,
  duration_hours int not null default 72,    -- wie lange das Angebot offen bleibt
  active boolean not null default true,
  sort_order int not null default 0
);

create index if not exists idx_popup_tpl_trigger on public.popup_offer_templates(trigger_event) where active;

create table if not exists public.user_popup_offers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  template_id text not null references public.popup_offer_templates(id) on delete cascade,
  trigger_event text not null,
  status text not null default 'open' check (status in ('open', 'purchased', 'dismissed', 'expired')),
  packs_purchased jsonb not null default '[]'::jsonb,    -- liste der gekauften pack-skus
  granted_at timestamptz not null default now(),
  expires_at timestamptz not null,
  closed_at timestamptz,
  unique (user_id, template_id)                          -- jedes Pop-Up nur 1× pro User
);

create index if not exists idx_user_popup_open on public.user_popup_offers(user_id) where status = 'open';

alter table public.popup_offer_templates enable row level security;
alter table public.user_popup_offers     enable row level security;

drop policy if exists "popup_tpl_read"  on public.popup_offer_templates;
drop policy if exists "popup_user_read" on public.user_popup_offers;
drop policy if exists "popup_user_upd"  on public.user_popup_offers;

create policy "popup_tpl_read"  on public.popup_offer_templates for select to authenticated using (active);
create policy "popup_user_read" on public.user_popup_offers     for select to authenticated using (auth.uid() = user_id);
create policy "popup_user_upd"  on public.user_popup_offers     for update to authenticated using (auth.uid() = user_id);

-- ─── RPC: vergibt Pop-Up bei Trigger-Event (idempotent pro Template) ─────
create or replace function public.grant_popup_for_event(
  p_user_id uuid, p_event text
) returns int
language plpgsql
security definer
set search_path = public
as $$
declare v_count int := 0; r record;
begin
  for r in
    select id, duration_hours
    from public.popup_offer_templates
    where active and trigger_event = p_event
  loop
    insert into public.user_popup_offers (user_id, template_id, trigger_event, expires_at)
    values (p_user_id, r.id, p_event, now() + (r.duration_hours || ' hours')::interval)
    on conflict (user_id, template_id) do nothing;
    if found then v_count := v_count + 1; end if;
  end loop;
  return v_count;
end $$;

grant execute on function public.grant_popup_for_event(uuid, text) to authenticated, service_role;

-- ─── Auto-Expire (best-effort, called by API on read) ───────────────────
create or replace function public.expire_old_popups() returns void
language sql
security definer
set search_path = public
as $$
  update public.user_popup_offers
    set status = 'expired', closed_at = now()
    where status = 'open' and expires_at < now();
$$;

grant execute on function public.expire_old_popups() to authenticated, service_role;

-- ─── Seed: 6 Pop-Up-Templates ────────────────────────────────────────────
insert into public.popup_offer_templates (id, trigger_event, title, subtitle, emoji, packs, duration_hours, sort_order) values
  ('popup_first_run', 'first_run',
   'Willkommen, Runner!', 'Dein erster Lauf — Starter-Boost wartet', '🎉',
   '[
     {"sku":"popup_first_run_499","price_eur":4.99,"label":"Starter-Pack","rewards":{"gems":500,"coins":2500,"items":[{"catalog_id":"speedup_build_60m","count":3}]}},
     {"sku":"popup_first_run_999","price_eur":9.99,"label":"Großer Starter","rewards":{"gems":1200,"coins":6000,"items":[{"catalog_id":"speedup_build_60m","count":8},{"catalog_id":"chest_silver","count":2}]}}
   ]'::jsonb, 72, 10),
  ('popup_rank_5', 'rank_reached_5',
   'Erkunder-Stufe!', 'Du hast Rang 5 erreicht — exklusive Pakete', '⭐',
   '[
     {"sku":"popup_rank5_499","price_eur":4.99,"label":"Bronze","rewards":{"gems":600,"items":[{"catalog_id":"speedup_uni_15m","count":5},{"catalog_id":"chest_silver","count":1}]}},
     {"sku":"popup_rank5_1999","price_eur":19.99,"label":"Silber","rewards":{"gems":3000,"items":[{"catalog_id":"speedup_uni_60m","count":4},{"catalog_id":"chest_gold","count":2}]}},
     {"sku":"popup_rank5_4999","price_eur":49.99,"label":"Gold","rewards":{"gems":8000,"items":[{"catalog_id":"speedup_build_8h","count":3},{"catalog_id":"chest_legendary","count":1},{"catalog_id":"key_gold","count":3}]}}
   ]'::jsonb, 72, 20),
  ('popup_guardian_first', 'first_guardian',
   'Erster Wächter!', 'Stärke deinen neuen Begleiter', '🛡',
   '[
     {"sku":"popup_guardian_499","price_eur":4.99,"label":"Wächter-Boost","rewards":{"items":[{"catalog_id":"boost_xp_24h","count":1},{"catalog_id":"speedup_heal_60m","count":3}]}},
     {"sku":"popup_guardian_1999","price_eur":19.99,"label":"Wächter-Premium","rewards":{"gems":2000,"items":[{"catalog_id":"boost_xp_24h","count":3},{"catalog_id":"chest_gold","count":2}]}}
   ]'::jsonb, 72, 30),
  ('popup_crew_founded', 'crew_founded',
   'Crew gegründet!', 'Dein Team braucht Ressourcen', '🏴',
   '[
     {"sku":"popup_crew_499","price_eur":4.99,"label":"Crew-Starter","rewards":{"items":[{"catalog_id":"boost_gather_24h","count":1},{"catalog_id":"speedup_build_60m","count":3}]}},
     {"sku":"popup_crew_999","price_eur":9.99,"label":"Crew-Power","rewards":{"gems":1000,"items":[{"catalog_id":"boost_gather_24h","count":2},{"catalog_id":"boost_shield_8h","count":1}]}}
   ]'::jsonb, 72, 40),
  ('popup_first_arena_win', 'first_arena_win',
   'Arena-Sieg!', 'Dein erster Triumph — exklusive Boost', '⚔',
   '[
     {"sku":"popup_arena_499","price_eur":4.99,"label":"Arena-Pack","rewards":{"items":[{"catalog_id":"boost_xp_24h","count":1},{"catalog_id":"chest_silver","count":2}]}},
     {"sku":"popup_arena_1999","price_eur":19.99,"label":"Arena-Legende","rewards":{"gems":2500,"items":[{"catalog_id":"boost_xp_24h","count":3},{"catalog_id":"chest_legendary","count":1}]}}
   ]'::jsonb, 72, 50),
  ('popup_first_territory', 'first_territory',
   'Erstes Gebiet!', 'Sichere dein Turf mit Premium-Boost', '🗺',
   '[
     {"sku":"popup_terr_499","price_eur":4.99,"label":"Territorial","rewards":{"coins":1500,"items":[{"catalog_id":"boost_shield_8h","count":1}]}},
     {"sku":"popup_terr_999","price_eur":9.99,"label":"Defender","rewards":{"gems":800,"coins":3500,"items":[{"catalog_id":"boost_shield_24h","count":1}]}}
   ]'::jsonb, 72, 60)
on conflict (id) do nothing;
