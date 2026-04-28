-- ════════════════════════════════════════════════════════════════════
-- HOTFIX: troops_catalog RLS — read-Policy für alle (Public-Catalog)
-- ════════════════════════════════════════════════════════════════════
-- RLS war auf troops_catalog aktiviert (vermutlich via Supabase-Dashboard),
-- aber keine SELECT-Policy vorhanden → alle Reads für anon/authenticated
-- gaben 0 Zeilen zurück. /api/base/troops lieferte daher catalog: [].
-- Truppen-Picker in Attack-/Rally-/Stronghold-Modals war komplett leer.
--
-- Fix: SELECT-Policy "lesbar für alle" — der Catalog ist statisch und nicht
-- sensitiv (kein User-spezifischer Inhalt).
-- ════════════════════════════════════════════════════════════════════

-- RLS sicherheitshalber explizit aktivieren (falls noch nicht)
alter table public.troops_catalog enable row level security;

do $$ begin
  if not exists (select 1 from pg_policies where tablename='troops_catalog' and policyname='troops_catalog_read_all') then
    create policy troops_catalog_read_all on public.troops_catalog for select using (true);
  end if;
end $$;
