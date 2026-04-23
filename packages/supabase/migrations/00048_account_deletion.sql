-- 00048: Self-Service-Konto-Löschung (DSGVO Art. 17) mit 14-Tage-Grace.
-- Adressiert DSGVO-Audit #H1.

alter table public.users
  add column if not exists deletion_requested_at timestamptz;

create index if not exists idx_users_deletion_pending
  on public.users(deletion_requested_at)
  where deletion_requested_at is not null;

comment on column public.users.deletion_requested_at is
  'Zeitpunkt des Self-Service-Löschantrags. 14 Tage später wird das Konto per Cron hart gelöscht.';

-- Hard-Delete: entfernt alle personenbezogenen Daten und den auth.users-Eintrag.
-- Aggregate (crew_members, walks) bleiben anonymisiert über ON DELETE CASCADE bzw.
-- haben keinen Personenbezug mehr, nachdem users.id entfernt ist.
create or replace function public.finalize_account_deletions()
returns int language plpgsql security definer as $$
declare
  v_count int := 0;
  r record;
begin
  for r in
    select id from public.users
    where deletion_requested_at is not null
      and deletion_requested_at < now() - interval '14 days'
  loop
    -- Rohe GPS-Strecken sofort entfernen.
    update public.walks set route = null where user_id = r.id;
    -- auth.users-Cascade entfernt public.users automatisch (FK auf auth.users).
    delete from auth.users where id = r.id;
    v_count := v_count + 1;
  end loop;
  return v_count;
end $$;

grant execute on function public.finalize_account_deletions() to service_role;

-- pg_cron: einmal pro Tag um 02:30.
do $$ begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.schedule(
      'finalize-account-deletions',
      '30 2 * * *',
      $cron$ select public.finalize_account_deletions(); $cron$
    );
  end if;
end $$;
