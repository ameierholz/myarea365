-- ══════════════════════════════════════════════════════════════════════════
-- Base-Themes: Rarity + Buffs (CoD-Style "Saal der Ordnung")
-- ══════════════════════════════════════════════════════════════════════════
-- Pro Theme jetzt:
--   rarity: advanced / epic / legendary
--   Buffs: ATK%, DEF%, HP%, March-Speed%, Training-Speed%, Training-Cost%
-- ══════════════════════════════════════════════════════════════════════════

alter table public.base_themes
  add column if not exists rarity text not null default 'advanced'
    check (rarity in ('advanced','epic','legendary')),
  add column if not exists buff_atk_pct       numeric(4,2) not null default 0,
  add column if not exists buff_def_pct       numeric(4,2) not null default 0,
  add column if not exists buff_hp_pct        numeric(4,2) not null default 0,
  add column if not exists buff_march_pct     numeric(4,2) not null default 0,
  add column if not exists buff_train_speed_pct numeric(4,2) not null default 0,
  add column if not exists buff_train_cost_pct  numeric(4,2) not null default 0,
  add column if not exists buff_gather_pct    numeric(4,2) not null default 0;

-- ─── Bestehende + neue Themes mit Rarity & Buffs ────────────────────────
update public.base_themes set rarity='advanced' where id='medieval';
update public.base_themes set rarity='epic',
       buff_atk_pct=2, buff_march_pct=3 where id='scifi';
update public.base_themes set rarity='epic',
       buff_gather_pct=5, buff_train_cost_pct=2 where id='pirate';
update public.base_themes set rarity='epic',
       buff_atk_pct=3, buff_hp_pct=2 where id='viking';
update public.base_themes set rarity='legendary',
       buff_atk_pct=2, buff_def_pct=2, buff_hp_pct=2, buff_march_pct=2 where id='ninja';
update public.base_themes set rarity='epic',
       buff_def_pct=3, buff_hp_pct=3 where id='halloween';

-- Neue Themes (CoD-inspiriert)
insert into public.base_themes
  (id, name, description, pin_emoji, pin_color, accent_color,
   resource_icon_wood, resource_icon_stone, resource_icon_gold, resource_icon_mana,
   unlock_kind, unlock_value, sort, rarity,
   buff_atk_pct, buff_def_pct, buff_hp_pct, buff_march_pct, buff_train_speed_pct, buff_train_cost_pct, buff_gather_pct)
values
  ('scarlet_palace',  'Scharlachroter Palast',
   'Goldene Türme mit roten Dächern. Aura: glühende Sonnenstrahlen.',
   '🏛️', '#E63946', '#FFD700', '🪵','🪨','🪙','💧',
   'vip', 8, 10, 'epic',
   5, 0, 0, 0, 3, 0, 0),
  ('hall_of_order',   'Saal der Ordnung',
   'Weißer Marmor mit türkisen Dächern. Heroischer Klassiker.',
   '⛩️', '#22D1C3', '#22D1C3', '🪵','🪨','🪙','💧',
   'vip', 6, 11, 'epic',
   2, 2, 2, 0, 2, 0, 0),
  ('eternal_garden',  'Garten der Ewigkeit',
   'Lebensbaum wächst um den Turm, goldene Blätter funkeln.',
   '🌳', '#FFD700', '#A78BFA', '🌿','🪨','🪙','✨',
   'vip', 12, 12, 'legendary',
   3, 0, 0, 0, 3, 2, 0),
  ('night_rose',      'Nachtrose',
   'Roter Blutmond + Rosenranken. Gothic-Eleganz.',
   '🌹', '#C71585', '#FF6B4A', '🪵','🪨','🪙','🥀',
   'vip', 15, 13, 'legendary',
   0, 5, 0, 2, 0, 0, 3),
  ('frost_keep',      'Frost-Festung',
   'Eis-Kristalle + Schneeflocken-Aura. Eiskalte Verteidigung.',
   '❄️', '#5ddaf0', '#FFFFFF', '🌲','🪨','💎','❄️',
   'event', 0, 14, 'epic',
   0, 4, 3, 0, 0, 0, 0),
  ('volcanic_forge',  'Vulkan-Schmiede',
   'Lava-Adern + Funkenflug. Aggression pur.',
   '🌋', '#FF4500', '#FFD700', '🪵','🔥','🪙','🧪',
   'vip', 10, 15, 'legendary',
   5, 0, 2, 0, 2, 0, 0)
on conflict (id) do update set
  name = excluded.name, description = excluded.description,
  pin_emoji = excluded.pin_emoji, pin_color = excluded.pin_color,
  accent_color = excluded.accent_color,
  unlock_kind = excluded.unlock_kind, unlock_value = excluded.unlock_value,
  sort = excluded.sort, rarity = excluded.rarity,
  buff_atk_pct = excluded.buff_atk_pct,
  buff_def_pct = excluded.buff_def_pct,
  buff_hp_pct  = excluded.buff_hp_pct,
  buff_march_pct = excluded.buff_march_pct,
  buff_train_speed_pct = excluded.buff_train_speed_pct,
  buff_train_cost_pct  = excluded.buff_train_cost_pct,
  buff_gather_pct = excluded.buff_gather_pct;

-- ─── RPC: Buff-Aggregator für aktives Theme ─────────────────────────────
create or replace function public.get_active_base_theme_buffs(p_user_id uuid default auth.uid())
returns jsonb language plpgsql security definer as $$
declare v_theme record;
begin
  select t.* into v_theme
    from public.base_themes t
    join public.bases b on b.theme_id = t.id
   where b.owner_user_id = p_user_id
   limit 1;
  if v_theme is null then
    return jsonb_build_object('atk_pct',0,'def_pct',0,'hp_pct',0,'march_pct',0,
                              'train_speed_pct',0,'train_cost_pct',0,'gather_pct',0);
  end if;
  return jsonb_build_object(
    'theme_id', v_theme.id, 'theme_name', v_theme.name, 'rarity', v_theme.rarity,
    'atk_pct', v_theme.buff_atk_pct,
    'def_pct', v_theme.buff_def_pct,
    'hp_pct',  v_theme.buff_hp_pct,
    'march_pct', v_theme.buff_march_pct,
    'train_speed_pct', v_theme.buff_train_speed_pct,
    'train_cost_pct',  v_theme.buff_train_cost_pct,
    'gather_pct', v_theme.buff_gather_pct
  );
end $$;
grant execute on function public.get_active_base_theme_buffs(uuid) to authenticated, anon;
