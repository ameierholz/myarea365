-- 00314 — Atomic Gem-Grant RPC (race-safe)
-- Ersetzt das Select+Update-Pair im Stripe-Webhook durch eine atomare RPC mit
-- FOR UPDATE-Lock. Verhindert verlorene Gems wenn 2 Webhooks parallel laufen.

create or replace function public.add_gems_to_user(p_user_id uuid, p_delta int)
returns void
language plpgsql
security definer
set search_path = public as $$
begin
  if p_delta = 0 then return; end if;

  -- Lock-then-upsert: kein Lost-Update zwischen Read+Write möglich
  insert into public.user_gems (user_id, gems)
    values (p_user_id, greatest(0, p_delta))
    on conflict (user_id) do update
      set gems = greatest(0, public.user_gems.gems + excluded.gems);
end $$;

grant execute on function public.add_gems_to_user(uuid, int) to service_role;
revoke all on function public.add_gems_to_user(uuid, int) from public;
revoke all on function public.add_gems_to_user(uuid, int) from authenticated;
