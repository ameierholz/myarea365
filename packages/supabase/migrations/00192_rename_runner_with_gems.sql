-- ══════════════════════════════════════════════════════════════════════════
-- Runner-Anzeigename ändern: kostet 500 Edelsteine + Eindeutigkeitsprüfung
-- (case-insensitive, ignoriert eigenen aktuellen Namen).
--
-- Free für den allerersten Set (display_name war bisher null/leer).
-- ══════════════════════════════════════════════════════════════════════════

create or replace function public.rename_runner_with_gems(p_new_name text)
returns jsonb language plpgsql security definer as $$
declare
  v_user uuid := auth.uid();
  v_cost int := 500;
  v_clean text;
  v_current text;
  v_first_time boolean;
  v_gems int;
  v_taken boolean;
begin
  if v_user is null then
    return jsonb_build_object('ok', false, 'error', 'auth_required');
  end if;

  v_clean := btrim(coalesce(p_new_name, ''));
  if char_length(v_clean) < 2 or char_length(v_clean) > 15 then
    return jsonb_build_object('ok', false, 'error', 'name_length',
      'message', 'Name muss 2-15 Zeichen lang sein');
  end if;
  -- Erlaubte Zeichen: Buchstaben (auch Unicode), Zahlen, Leer/_/./-/Umlaute
  if v_clean !~ '^[\p{L}\p{N} _.\-äöüÄÖÜß]+$' then
    return jsonb_build_object('ok', false, 'error', 'name_invalid_chars',
      'message', 'Nur Buchstaben, Zahlen, Leerzeichen, _ . - erlaubt');
  end if;

  -- Aktueller Name + ist es das erste Mal?
  select display_name into v_current from public.users where id = v_user;
  v_first_time := (v_current is null or btrim(v_current) = '');

  -- Wenn neuer Name = aktueller Name → no-op (kein Cost)
  if not v_first_time and lower(btrim(v_current)) = lower(v_clean) then
    return jsonb_build_object('ok', true, 'unchanged', true, 'display_name', v_current);
  end if;

  -- Eindeutigkeit: andere User mit identischem Display-Name (case-insensitive)
  select exists(
    select 1 from public.users
     where id <> v_user
       and lower(btrim(coalesce(display_name, ''))) = lower(v_clean)
  ) into v_taken;
  if v_taken then
    return jsonb_build_object('ok', false, 'error', 'name_taken',
      'message', 'Dieser Name ist bereits vergeben');
  end if;
  -- Auch gegen username (Login-Slug) prüfen — verhindert Identitätsverwirrung
  select exists(
    select 1 from public.users
     where id <> v_user
       and lower(btrim(coalesce(username, ''))) = lower(v_clean)
  ) into v_taken;
  if v_taken then
    return jsonb_build_object('ok', false, 'error', 'name_taken',
      'message', 'Dieser Name ist bereits vergeben');
  end if;

  -- Erstes Setzen: kostenlos, danach 500 Gems.
  if not v_first_time then
    select coalesce(gems, 0) into v_gems from public.user_gems where user_id = v_user for update;
    if v_gems is null then
      insert into public.user_gems (user_id, gems) values (v_user, 0)
        on conflict (user_id) do nothing;
      v_gems := 0;
    end if;
    if v_gems < v_cost then
      return jsonb_build_object('ok', false, 'error', 'insufficient_gems',
        'message', format('Du brauchst %s Edelsteine (du hast %s)', v_cost, v_gems),
        'cost', v_cost, 'have', v_gems);
    end if;
    update public.user_gems
       set gems = gems - v_cost,
           total_spent = coalesce(total_spent, 0) + v_cost,
           updated_at = now()
     where user_id = v_user;
  end if;

  update public.users set display_name = v_clean where id = v_user;

  return jsonb_build_object('ok', true,
    'display_name', v_clean,
    'cost', case when v_first_time then 0 else v_cost end,
    'first_time', v_first_time);
end $$;

revoke all on function public.rename_runner_with_gems(text) from public;
grant execute on function public.rename_runner_with_gems(text) to authenticated;
