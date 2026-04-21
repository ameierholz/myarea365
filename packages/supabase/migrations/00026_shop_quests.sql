-- ═══════════════════════════════════════════════════════════════════
-- Shop-Quests: Partner definieren wöchentliche Quests ("Kaufe Artikel X → +500 XP"),
-- Runner lösen sie bei Bon-Upload automatisch ein (OCR-Match).
-- ═══════════════════════════════════════════════════════════════════

create table if not exists public.shop_quests (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.local_businesses(id) on delete cascade,
  title text not null,
  description text,
  article_pattern text not null,        -- Substring-Match auf Bon-Items (case-insensitive)
  reward_xp int not null default 0 check (reward_xp >= 0 and reward_xp <= 5000),
  reward_loot_rarity text check (reward_loot_rarity is null or reward_loot_rarity in ('common','rare','epic','legendary')),
  active boolean not null default true,
  starts_at timestamptz not null default now(),
  expires_at timestamptz,
  max_completions_per_user int not null default 1,
  total_completions int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_shop_quests_active on public.shop_quests(business_id) where active;

create table if not exists public.shop_quest_completions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  quest_id uuid not null references public.shop_quests(id) on delete cascade,
  redemption_id uuid references public.deal_redemptions(id) on delete set null,
  completed_at timestamptz not null default now(),
  matched_text text,
  reward_xp int not null default 0,
  reward_loot_rarity text
);

create index if not exists idx_quest_completions_user on public.shop_quest_completions(user_id);
create index if not exists idx_quest_completions_quest on public.shop_quest_completions(quest_id);
create unique index if not exists uq_quest_completion_redemption on public.shop_quest_completions(quest_id, redemption_id) where redemption_id is not null;

alter table public.shop_quests               enable row level security;
alter table public.shop_quest_completions    enable row level security;

do $$ begin
  if not exists (select 1 from pg_policies where tablename='shop_quests' and policyname='quests_public_read') then
    create policy quests_public_read on public.shop_quests for select using (active = true);
  end if;
  if not exists (select 1 from pg_policies where tablename='shop_quests' and policyname='quests_owner_manage') then
    create policy quests_owner_manage on public.shop_quests for all
      using (exists (select 1 from public.local_businesses b where b.id = business_id and b.owner_id = auth.uid()))
      with check (exists (select 1 from public.local_businesses b where b.id = business_id and b.owner_id = auth.uid()));
  end if;
  if not exists (select 1 from pg_policies where tablename='shop_quest_completions' and policyname='completions_self_read') then
    create policy completions_self_read on public.shop_quest_completions for select using (user_id = auth.uid());
  end if;
end $$;

-- ─── RPC: Quest-Matching auf Bon-Items ──────────────────────────────
-- Erwartet Array von Artikel-Zeilen (aus OCR). Matched Quests → gewährt Belohnung + loggt Completion.
create or replace function public.match_shop_quests(
  p_user_id uuid,
  p_business_id uuid,
  p_redemption_id uuid,
  p_items text[]
) returns jsonb language plpgsql security definer as $$
declare
  q record;
  v_completed jsonb := '[]'::jsonb;
  v_match_text text;
  v_user_item_id uuid;
  v_item_id text;
  v_count int;
begin
  if p_items is null or array_length(p_items, 1) is null then
    return jsonb_build_object('ok', true, 'completed', v_completed);
  end if;

  for q in
    select id, title, article_pattern, reward_xp, reward_loot_rarity, max_completions_per_user
      from public.shop_quests
     where business_id = p_business_id
       and active = true
       and starts_at <= now()
       and (expires_at is null or expires_at > now())
  loop
    -- Max-Completions-Check
    select count(*) into v_count from public.shop_quest_completions
      where user_id = p_user_id and quest_id = q.id;
    if v_count >= q.max_completions_per_user then continue; end if;

    -- Items nach Pattern durchsuchen (case-insensitive substring)
    v_match_text := null;
    for v_match_text in
      select unnest(p_items) as t
    loop
      if v_match_text is not null and lower(v_match_text) like '%' || lower(q.article_pattern) || '%' then
        exit;
      else
        v_match_text := null;
      end if;
    end loop;
    if v_match_text is null then continue; end if;

    -- XP auf aktiven Wächter
    if q.reward_xp > 0 then
      update public.user_guardians
         set xp = xp + q.reward_xp
       where user_id = p_user_id and is_active;
    end if;

    -- Item-Drop (falls Rarität gesetzt)
    v_item_id := null; v_user_item_id := null;
    if q.reward_loot_rarity is not null then
      select id into v_item_id from public.item_catalog
        where rarity = case when q.reward_loot_rarity = 'legendary' then 'legend' else q.reward_loot_rarity end
        order by random() limit 1;
      if v_item_id is not null then
        insert into public.user_items (user_id, item_id, source)
          values (p_user_id, v_item_id, 'quest') returning id into v_user_item_id;
      end if;
    end if;

    insert into public.shop_quest_completions (user_id, quest_id, redemption_id, matched_text, reward_xp, reward_loot_rarity)
      values (p_user_id, q.id, p_redemption_id, v_match_text, q.reward_xp, q.reward_loot_rarity);

    update public.shop_quests set total_completions = total_completions + 1, updated_at = now() where id = q.id;

    v_completed := v_completed || jsonb_build_object(
      'quest_id', q.id,
      'title', q.title,
      'matched_text', v_match_text,
      'reward_xp', q.reward_xp,
      'reward_loot_rarity', q.reward_loot_rarity,
      'item_id', v_item_id,
      'user_item_id', v_user_item_id
    );
  end loop;

  return jsonb_build_object('ok', true, 'completed', v_completed);
end $$;

grant execute on function public.match_shop_quests(uuid, uuid, uuid, text[]) to authenticated, anon;
