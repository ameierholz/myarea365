-- ══════════════════════════════════════════════════════════════════════════
-- Realtime: base_attacks und gather_marches in supabase_realtime publication
-- → Client kann via WebSocket auf Änderungen lauschen, kein 5s-Polling mehr.
-- RLS regelt Sichtbarkeit: nur eigene Crew-Märsche bzw. eigene Gather-Märsche.
-- ══════════════════════════════════════════════════════════════════════════

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'base_attacks'
  ) then
    alter publication supabase_realtime add table public.base_attacks;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'gather_marches'
  ) then
    alter publication supabase_realtime add table public.gather_marches;
  end if;
end $$;
