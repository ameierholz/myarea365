-- ══════════════════════════════════════════════════════════════════════════
-- BASE-LABEL: Uniqueness + strenge Validierung (3-10 Zeichen, nur Buchstaben)
-- ══════════════════════════════════════════════════════════════════════════

-- Eindeutiger Index — case-insensitive (lower) + ignoriert NULL.
create unique index if not exists idx_bases_pin_label_unique
  on public.bases(lower(pin_label)) where pin_label is not null;

create unique index if not exists idx_crew_bases_pin_label_unique
  on public.crew_bases(lower(pin_label)) where pin_label is not null;

-- Validierung anpassen: 3-10 Zeichen, nur Buchstaben (inkl. Umlaute/ß)
create or replace function public._validate_base_label(p_label text)
returns text language plpgsql immutable as $$
declare v text := trim(p_label);
begin
  if v is null or length(v) = 0 then return null; end if;
  if length(v) < 3  then raise exception 'label_too_short'; end if;
  if length(v) > 10 then raise exception 'label_too_long'; end if;
  if v !~ '^[A-Za-zÄÖÜäöüß]+$' then raise exception 'label_bad_chars'; end if;
  return v;
end $$;

-- set_base_label: Uniqueness gegenüber bases + crew_bases prüfen
create or replace function public.set_base_label(p_label text)
returns jsonb language plpgsql security definer as $$
declare
  v_user uuid := auth.uid();
  v_clean text;
begin
  if v_user is null then raise exception 'not_authenticated'; end if;
  v_clean := public._validate_base_label(p_label);
  if v_clean is not null then
    if exists (select 1 from public.bases where lower(pin_label) = lower(v_clean) and owner_user_id <> v_user) then
      raise exception 'label_taken';
    end if;
    if exists (select 1 from public.crew_bases where lower(pin_label) = lower(v_clean)) then
      raise exception 'label_taken';
    end if;
  end if;
  update public.bases set pin_label = v_clean, updated_at = now() where owner_user_id = v_user;
  return jsonb_build_object('ok', true, 'pin_label', v_clean);
end $$;

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
  if v_clean is not null then
    if exists (select 1 from public.crew_bases where lower(pin_label) = lower(v_clean) and crew_id <> v_crew) then
      raise exception 'label_taken';
    end if;
    if exists (select 1 from public.bases where lower(pin_label) = lower(v_clean)) then
      raise exception 'label_taken';
    end if;
  end if;
  update public.crew_bases set pin_label = v_clean, updated_at = now() where crew_id = v_crew;
  return jsonb_build_object('ok', true, 'pin_label', v_clean);
end $$;

-- RPC: schneller Verfügbarkeits-Check (für Live-Feedback im Input)
create or replace function public.check_base_label_available(p_label text)
returns jsonb language plpgsql security definer as $$
declare
  v_user uuid := auth.uid();
  v_clean text;
begin
  if v_user is null then raise exception 'not_authenticated'; end if;
  begin
    v_clean := public._validate_base_label(p_label);
  exception when others then
    return jsonb_build_object('ok', false, 'error', sqlerrm);
  end;
  if v_clean is null then return jsonb_build_object('ok', true, 'available', true); end if;
  if exists (select 1 from public.bases where lower(pin_label) = lower(v_clean) and owner_user_id <> v_user) then
    return jsonb_build_object('ok', true, 'available', false);
  end if;
  if exists (select 1 from public.crew_bases where lower(pin_label) = lower(v_clean)) then
    return jsonb_build_object('ok', true, 'available', false);
  end if;
  return jsonb_build_object('ok', true, 'available', true);
end $$;
revoke all on function public.check_base_label_available(text) from public;
grant execute on function public.check_base_label_available(text) to authenticated;
