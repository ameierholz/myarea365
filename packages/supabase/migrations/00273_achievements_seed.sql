-- Erst-Seed Achievements für die 3 Tiers.
-- Bronze: Onboarding-Meilensteine (jeder neue Spieler kommt da früh hin)
-- Silver: Engagement (10er/30er-Schwellen, mittlere Spielzeit)
-- Gold: Echte Endgame-Meilensteine (Ära-Sieg, CvC-Champion etc.)

insert into public.achievements (slug, name, description, icon, xp_reward, tier) values
  -- Bronze
  ('first_base',        'Erste Base',          'Deine Base errichtet.',                     '🏠', 50,   'bronze'),
  ('heimat_set',        'Heimat gefunden',     'Heimat-Stadt zugewiesen.',                  '🏙️', 50,   'bronze'),
  ('first_march',       'Erster Marsch',       'Ersten Marsch über die Karte gestartet.',   '🚶', 50,   'bronze'),
  ('joined_crew',       'Crew-Mitglied',       'Einer Crew beigetreten.',                   '🤝', 50,   'bronze'),
  ('first_building',    'Bauarbeiter',         'Erstes Gebäude fertig gebaut.',             '🔨', 50,   'bronze'),
  ('first_research',    'Erstes Wissen',       'Erste Forschung abgeschlossen.',            '⚗️', 50,   'bronze'),
  ('first_bandit_kill', 'Erste Beute',         'Ersten Banditen besiegt.',                  '🥷', 50,   'bronze'),
  ('first_guardian',    'Begleiter erweckt',     'Ersten Begleiter freigeschaltet.',            '🐺', 50,   'bronze'),
  ('first_resource',    'Erster Fund',         'Erste Ressource gesammelt.',                '💎', 50,   'bronze'),
  -- Silver
  ('crew_founder',      'Crew-Gründerin',      'Eine eigene Crew gegründet.',               '👑', 200,  'silver'),
  ('node_collector',    'Sammler',             '10 Ressource-Nodes geleert.',               '⛏️', 200,  'silver'),
  ('researcher',        'Forscher',            '10 Forschungen abgeschlossen.',             '📚', 200,  'silver'),
  ('bandit_hunter',     'Banditen-Jägerin',    '50 Banditen besiegt.',                      '🏹', 200,  'silver'),
  ('wegelager_vet',     'Wegelager-Veteranin', '10 Wegelager-Kämpfe gewonnen.',             '⚔️', 200,  'silver'),
  ('city_pioneer',      'Stadt-Pionierin',     '30 Tage in deiner Heimat-Stadt aktiv.',     '📅', 200,  'silver'),
  ('full_aufgebot',     'Aufgebot voll',       'Aufgebot komplett ausgestattet.',           '🛡️', 200,  'silver'),
  ('research_master',   'Forschungsmeisterin', '50 Forschungen abgeschlossen.',             '🔬', 200,  'silver'),
  -- Gold
  ('era_winner',        'Ära-Siegerin',        'Mitglied der gewinnenden Crew einer Ära.',  '🏆', 1000, 'gold'),
  ('cvc_champion',      'CvC-Champion',        'Eine CvC-Saison gewonnen.',                 '⚜️', 1000, 'gold'),
  ('hof_member',        'Hall of Fame',        'In der Hall of Fame einer Ära verewigt.',   '🌟', 1000, 'gold'),
  ('legendary_guardian','Legendäre Begleiterin', 'Awakening eines Begleiters freigeschaltet.',  '✨', 1000, 'gold'),
  ('crypto_magnate',    'Krypto-Magnatin',     '1.000.000 Krypto gesammelt.',               '💰', 1000, 'gold'),
  ('imperator',         'Imperator',           'Anführerin einer Crew mit 50+ Mitgliedern.', '🦁', 1000, 'gold')
on conflict (slug) do update set
  name = excluded.name,
  description = excluded.description,
  icon = excluded.icon,
  xp_reward = excluded.xp_reward,
  tier = excluded.tier;

-- API-RPC: liefert ALLE Achievements + ob freigeschaltet (für Modal-Liste)
create or replace function public.list_achievements_for_user(p_user uuid default auth.uid())
returns table (
  id uuid,
  slug text,
  name text,
  description text,
  icon text,
  tier public.achievement_tier,
  xp_reward int,
  unlocked boolean,
  unlocked_at timestamptz
)
language sql
stable
security invoker
set search_path = public
as $$
  select
    a.id, a.slug, a.name, a.description, a.icon, a.tier, a.xp_reward,
    (ua.user_id is not null) as unlocked,
    ua.unlocked_at
  from public.achievements a
  left join public.user_achievements ua
    on ua.achievement_id = a.id and ua.user_id = p_user
  order by a.tier, a.name;
$$;

grant execute on function public.list_achievements_for_user(uuid) to authenticated, anon;

comment on function public.list_achievements_for_user(uuid) is
  'Listet alle Achievements + Freischalt-Status für den angegebenen User. Sortiert nach Tier dann Name.';
