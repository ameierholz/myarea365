-- ══════════════════════════════════════════════════════════════════════════
-- FIX: buildings_catalog ist ein statischer Referenz-Katalog — alle
-- authenticated + anon User dürfen lesen. Vorher fehlte die SELECT-Policy
-- → API-Calls bekamen 0 Zeilen → Modal zeigte "Vorschau-Modus".
-- ══════════════════════════════════════════════════════════════════════════

alter table public.buildings_catalog enable row level security;

do $$ begin
  if not exists (select 1 from pg_policies where tablename='buildings_catalog' and policyname='select_all') then
    create policy select_all on public.buildings_catalog for select using (true);
  end if;
end $$;

grant select on public.buildings_catalog to anon, authenticated;
