-- ══════════════════════════════════════════════════════════════════════════
-- BASE-LABELS: User können eigene Base benennen + Report-System für Mod
-- ══════════════════════════════════════════════════════════════════════════

-- ─── 1) Reports-Tabelle ──────────────────────────────────────────────────
create table if not exists public.base_label_reports (
  id              uuid primary key default gen_random_uuid(),
  base_id         uuid references public.bases(id) on delete cascade,
  crew_base_id    uuid references public.crew_bases(id) on delete cascade,
  reported_label  text not null,
  reason          text,
  reported_by     uuid not null references public.users(id) on delete cascade,
  reported_at     timestamptz not null default now(),
  status          text not null default 'pending' check (status in ('pending','dismissed','removed')),
  reviewed_by     uuid references public.users(id),
  reviewed_at     timestamptz,
  -- Genau eines von base_id ODER crew_base_id muss gesetzt sein
  check ((base_id is not null) <> (crew_base_id is not null))
);
create index if not exists idx_label_reports_status on public.base_label_reports(status, reported_at desc);
create index if not exists idx_label_reports_base on public.base_label_reports(base_id);
create index if not exists idx_label_reports_crew on public.base_label_reports(crew_base_id);

alter table public.base_label_reports enable row level security;
do $$ begin
  if not exists (select 1 from pg_policies where tablename='base_label_reports' and policyname='select_own') then
    create policy select_own on public.base_label_reports for select using (reported_by = auth.uid());
  end if;
  if not exists (select 1 from pg_policies where tablename='base_label_reports' and policyname='insert_own') then
    create policy insert_own on public.base_label_reports for insert with check (reported_by = auth.uid());
  end if;
end $$;

-- ─── 2) Validierung-Helper: Label-Sanity-Check ──────────────────────────
create or replace function public._validate_base_label(p_label text)
returns text language plpgsql immutable as $$
declare v text := trim(p_label);
begin
  if v is null or length(v) = 0 then return null; end if;
  if length(v) < 3  then raise exception 'label_too_short'; end if;
  if length(v) > 24 then raise exception 'label_too_long'; end if;
  -- Nur Buchstaben, Zahlen, Leerzeichen, einige Sonderzeichen
  if v !~ '^[A-Za-zÄÖÜäöüß0-9 ''!?.&-]+$' then raise exception 'label_bad_chars'; end if;
  return v;
end $$;

-- ─── 3) RPC: set_base_label (für Runner-Base) ────────────────────────────
create or replace function public.set_base_label(p_label text)
returns jsonb language plpgsql security definer as $$
declare
  v_user uuid := auth.uid();
  v_clean text;
begin
  if v_user is null then raise exception 'not_authenticated'; end if;
  v_clean := public._validate_base_label(p_label);  -- raises wenn ungültig
  update public.bases set pin_label = v_clean, updated_at = now() where owner_user_id = v_user;
  return jsonb_build_object('ok', true, 'pin_label', v_clean);
end $$;
revoke all on function public.set_base_label(text) from public;
grant execute on function public.set_base_label(text) to authenticated;

-- ─── 4) RPC: set_crew_base_label (nur Crew-Lead) ─────────────────────────
create or replace function public.set_crew_base_label(p_label text)
returns jsonb language plpgsql security definer as $$
declare
  v_user uuid := auth.uid();
  v_crew uuid; v_role text;
  v_clean text;
begin
  if v_user is null then raise exception 'not_authenticated'; end if;
  select cm.crew_id, cm.role into v_crew, v_role
    from public.crew_members cm where cm.user_id = v_user limit 1;
  if v_crew is null then raise exception 'no_crew'; end if;
  if v_role not in ('owner','admin') then raise exception 'not_crew_lead'; end if;
  v_clean := public._validate_base_label(p_label);
  update public.crew_bases set pin_label = v_clean, updated_at = now() where crew_id = v_crew;
  return jsonb_build_object('ok', true, 'pin_label', v_clean);
end $$;
revoke all on function public.set_crew_base_label(text) from public;
grant execute on function public.set_crew_base_label(text) to authenticated;

-- ─── 5) RPC: report_base_label ───────────────────────────────────────────
create or replace function public.report_base_label(
  p_base_id      uuid default null,
  p_crew_base_id uuid default null,
  p_reason       text default null
) returns jsonb language plpgsql security definer as $$
declare
  v_user uuid := auth.uid();
  v_label text;
begin
  if v_user is null then raise exception 'not_authenticated'; end if;
  if (p_base_id is null and p_crew_base_id is null) then raise exception 'missing_target'; end if;
  if (p_base_id is not null and p_crew_base_id is not null) then raise exception 'only_one_target'; end if;

  if p_base_id is not null then
    select pin_label into v_label from public.bases where id = p_base_id;
  else
    select pin_label into v_label from public.crew_bases where id = p_crew_base_id;
  end if;
  if v_label is null then raise exception 'no_label_to_report'; end if;

  -- Doppelte Reports vom selben User innerhalb 24h verhindern
  if exists (
    select 1 from public.base_label_reports
    where reported_by = v_user
      and reported_at > now() - interval '24 hours'
      and ((p_base_id is not null and base_id = p_base_id)
        or (p_crew_base_id is not null and crew_base_id = p_crew_base_id))
  ) then
    return jsonb_build_object('ok', false, 'error', 'already_reported');
  end if;

  insert into public.base_label_reports (base_id, crew_base_id, reported_label, reason, reported_by)
  values (p_base_id, p_crew_base_id, v_label, p_reason, v_user);

  return jsonb_build_object('ok', true);
end $$;
revoke all on function public.report_base_label(uuid, uuid, text) from public;
grant execute on function public.report_base_label(uuid, uuid, text) to authenticated;
