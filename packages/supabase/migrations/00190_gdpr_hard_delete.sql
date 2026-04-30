-- ══════════════════════════════════════════════════════════════════════════
-- DSGVO Art. 17 — Hard-Delete-Routine
-- Wird vom Cron-Job /api/cron/gdpr-purge täglich aufgerufen.
-- Entfernt physisch alle personenbezogenen Daten von Usern, deren
-- deletion_requested_at + 14 Tage abgelaufen ist.
-- ══════════════════════════════════════════════════════════════════════════

-- Audit-Log für Compliance-Nachweis
create table if not exists public.gdpr_purge_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  username_at_deletion text,
  deletion_requested_at timestamptz not null,
  purged_at timestamptz not null default now(),
  rows_removed jsonb not null default '{}'::jsonb
);

-- Nur Service-Role darf diese Tabelle lesen
alter table public.gdpr_purge_log enable row level security;
do $$ begin
  if not exists (select 1 from pg_policies where tablename='gdpr_purge_log' and policyname='gdpr_purge_log_service_only') then
    create policy gdpr_purge_log_service_only on public.gdpr_purge_log
      for all using (false);
  end if;
end $$;

-- ─── purge_user(p_user_id) — entfernt einen einzelnen User vollständig ──
create or replace function public.purge_user(p_user_id uuid)
returns jsonb language plpgsql security definer as $$
declare
  v_user record;
  v_rows jsonb := '{}'::jsonb;
  v_count int;
begin
  select id, username, deletion_requested_at into v_user from public.users where id = p_user_id;
  if v_user.id is null then
    return jsonb_build_object('ok', false, 'error', 'user_not_found');
  end if;
  if v_user.deletion_requested_at is null then
    return jsonb_build_object('ok', false, 'error', 'not_marked_for_deletion');
  end if;

  -- Alle abhängigen Tabellen anonymisieren/löschen.
  -- WICHTIG: Reihenfolge folgt FK-Abhängigkeiten (Kinder zuerst).
  -- Wenn ein Table nicht existiert, wirft EXECUTE einen Fehler — daher
  -- pro Tabelle mit IF FOUND IN information_schema absichern.

  -- Aktivitäts-Daten
  delete from public.walks where user_id = p_user_id;
  get diagnostics v_count = row_count; v_rows := v_rows || jsonb_build_object('walks', v_count);

  delete from public.xp_transactions where user_id = p_user_id;
  get diagnostics v_count = row_count; v_rows := v_rows || jsonb_build_object('xp_transactions', v_count);

  delete from public.user_achievements where user_id = p_user_id;
  get diagnostics v_count = row_count; v_rows := v_rows || jsonb_build_object('user_achievements', v_count);

  delete from public.user_missions where user_id = p_user_id;
  get diagnostics v_count = row_count; v_rows := v_rows || jsonb_build_object('user_missions', v_count);

  delete from public.user_guardians where user_id = p_user_id;
  get diagnostics v_count = row_count; v_rows := v_rows || jsonb_build_object('user_guardians', v_count);

  delete from public.user_items where user_id = p_user_id;
  get diagnostics v_count = row_count; v_rows := v_rows || jsonb_build_object('user_items', v_count);

  delete from public.user_prestige where user_id = p_user_id;
  get diagnostics v_count = row_count; v_rows := v_rows || jsonb_build_object('user_prestige', v_count);

  delete from public.deal_redemptions where user_id = p_user_id;
  get diagnostics v_count = row_count; v_rows := v_rows || jsonb_build_object('deal_redemptions', v_count);

  -- Bases + alles dran
  delete from public.bases where owner_user_id = p_user_id;
  get diagnostics v_count = row_count; v_rows := v_rows || jsonb_build_object('bases', v_count);

  delete from public.gather_marches where user_id = p_user_id;
  get diagnostics v_count = row_count; v_rows := v_rows || jsonb_build_object('gather_marches', v_count);

  -- Anonymisierung von Daten die wir nicht löschen können (z.B. Crew-Wars, Inbox-Sender)
  -- Hier nur Beispiel: setze attacker/defender_user_id auf null wo Foreign-Key dies erlaubt
  -- (Hängt vom Schema ab — bei Bedarf erweitern.)

  -- Profile-Stammdaten zuletzt
  delete from public.users where id = p_user_id;
  get diagnostics v_count = row_count; v_rows := v_rows || jsonb_build_object('users', v_count);

  -- Audit-Log
  insert into public.gdpr_purge_log (user_id, username_at_deletion, deletion_requested_at, rows_removed)
  values (p_user_id, v_user.username, v_user.deletion_requested_at, v_rows);

  return jsonb_build_object('ok', true, 'rows_removed', v_rows);
end $$;
revoke all on function public.purge_user(uuid) from public;
-- Nur service_role darf direkt aufrufen
grant execute on function public.purge_user(uuid) to service_role;

-- ─── Sammelfunktion für Cron-Job ───────────────────────────────────────
create or replace function public.purge_due_users(p_grace_days int default 14)
returns jsonb language plpgsql security definer as $$
declare
  v_user_id uuid;
  v_purged int := 0;
  v_failed int := 0;
  v_errors jsonb := '[]'::jsonb;
  v_result jsonb;
begin
  for v_user_id in
    select id from public.users
    where deletion_requested_at is not null
      and deletion_requested_at < now() - (p_grace_days || ' days')::interval
    limit 100
  loop
    begin
      v_result := public.purge_user(v_user_id);
      if (v_result->>'ok')::boolean then
        v_purged := v_purged + 1;
      else
        v_failed := v_failed + 1;
        v_errors := v_errors || jsonb_build_object('user_id', v_user_id, 'error', v_result->>'error');
      end if;
    exception when others then
      v_failed := v_failed + 1;
      v_errors := v_errors || jsonb_build_object('user_id', v_user_id, 'error', sqlerrm);
    end;
  end loop;

  return jsonb_build_object('ok', true, 'purged', v_purged, 'failed', v_failed, 'errors', v_errors);
end $$;
revoke all on function public.purge_due_users(int) from public;
grant execute on function public.purge_due_users(int) to service_role;
