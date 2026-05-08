-- Translation-Cache: speichert übersetzte User-Texte (Marker-Labels, Inbox-Messages, Chat).

create table if not exists public.translation_cache (
  source_hash text not null,
  source_lang text not null,
  target_lang text not null,
  source_text text not null,
  translated_text text not null,
  service text not null default 'mymemory',
  match_quality real,
  created_at timestamptz not null default now(),
  primary key (source_hash, source_lang, target_lang)
);

create index if not exists translation_cache_lang_idx on public.translation_cache(source_lang, target_lang);
create index if not exists translation_cache_created_idx on public.translation_cache(created_at);

alter table public.translation_cache enable row level security;
drop policy if exists "auth read translations" on public.translation_cache;
create policy "auth read translations" on public.translation_cache for select using (auth.role() = 'authenticated');

comment on table public.translation_cache is
  'Cache für maschinell übersetzte User-Texte. Key: sha256(text)+(src,target). Wird vom /api/translate-Endpoint befüllt.';

-- ════════════════════════════════════════════════════════════════════
-- RPC: Crew-Marker mit Creator-Locale (für Auto-Übersetzung)
-- ════════════════════════════════════════════════════════════════════

create or replace function public.list_crew_markers_with_locale(p_user uuid default auth.uid())
returns table (
  id uuid, crew_id uuid, created_by uuid,
  lat double precision, lng double precision,
  action_kind text, label text, is_urgent boolean,
  cost_paid jsonb, expires_at timestamptz, created_at timestamptz,
  creator_locale text, creator_name text
)
language sql stable security invoker set search_path = public
as $$
  with my_crew as (
    select crew_id from public.crew_members where user_id = p_user limit 1
  )
  select
    m.id, m.crew_id, m.created_by,
    m.lat, m.lng, m.action_kind, m.label, m.is_urgent,
    m.cost_paid, m.expires_at, m.created_at,
    coalesce(u.setting_language, u.email_locale, 'de') as creator_locale,
    coalesce(u.display_name, u.username, 'Spieler') as creator_name
  from public.crew_map_markers m
  left join public.users u on u.id = m.created_by
  where m.crew_id = (select crew_id from my_crew)
    and (m.expires_at is null or m.expires_at > now())
  order by m.created_at desc;
$$;

grant execute on function public.list_crew_markers_with_locale(uuid) to authenticated;

-- ════════════════════════════════════════════════════════════════════
-- RPC: Inbox mit Sender-Locale
-- ════════════════════════════════════════════════════════════════════

create or replace function public.list_inbox_with_locale(p_user uuid default auth.uid())
returns table (
  id uuid, user_id uuid, broadcast_id uuid,
  title text, body text, category text, subcategory text, kind text,
  payload jsonb, reward_payload jsonb,
  is_starred boolean, read_at timestamptz, claimed_at timestamptz, deleted_at timestamptz,
  from_user_id uuid, from_label text,
  sender_name text, sender_locale text,
  created_at timestamptz
)
language sql stable security invoker set search_path = public
as $$
  select
    m.id, m.user_id, m.broadcast_id,
    m.title, m.body, m.category, m.subcategory, m.kind,
    m.payload, m.reward_payload,
    m.is_starred, m.read_at, m.claimed_at, m.deleted_at,
    m.from_user_id, m.from_label,
    coalesce(s.display_name, s.username, m.from_label) as sender_name,
    coalesce(s.setting_language, s.email_locale, 'de') as sender_locale,
    m.created_at
  from public.user_inbox m
  left join public.users s on s.id = m.from_user_id
  where m.user_id = p_user
    and m.deleted_at is null
  order by m.created_at desc;
$$;

grant execute on function public.list_inbox_with_locale(uuid) to authenticated;
