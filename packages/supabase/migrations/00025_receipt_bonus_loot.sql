-- ═══════════════════════════════════════════════════════════════════
-- Bon-Bonus-Loot: Runner lädt Kassenbon nach Einlösung hoch,
-- bekommt je nach Einkaufswert bessere Siegel/Items. KI-OCR prüft Betrag.
-- ═══════════════════════════════════════════════════════════════════

alter table public.deal_redemptions
  add column if not exists purchase_amount_cents int,
  add column if not exists receipt_url text,
  add column if not exists receipt_verified boolean,
  add column if not exists receipt_bonus_rarity text
    check (receipt_bonus_rarity is null or receipt_bonus_rarity in ('none','common','rare','epic','legendary')),
  add column if not exists receipt_ocr_amount_cents int,
  add column if not exists receipt_submitted_at timestamptz;

create index if not exists idx_redemptions_receipt_pending
  on public.deal_redemptions(user_id, verified_at)
  where receipt_submitted_at is null and verified_at is not null;

-- ─── Bonus-Loot RPC ─────────────────────────────────────────────────
-- Gibt abhängig von verifiziertem Betrag Siegel/Items. Idempotent pro Redemption.
create or replace function public.grant_receipt_bonus_loot(
  p_redemption_id uuid,
  p_amount_cents int,
  p_verified boolean
) returns jsonb language plpgsql security definer as $$
declare
  v_user uuid;
  v_existing text;
  v_rarity text;
  v_bonus_universal int := 0;
  v_bonus_typed int := 0;
  v_typed_rarity text := 'common';
  v_item_id text;
  v_user_item_id uuid;
  v_amount int;
begin
  select user_id, receipt_bonus_rarity into v_user, v_existing
    from public.deal_redemptions where id = p_redemption_id;
  if v_user is null then
    return jsonb_build_object('ok', false, 'error', 'redemption_not_found');
  end if;
  if v_existing is not null and v_existing <> 'none' then
    return jsonb_build_object('ok', false, 'error', 'already_claimed');
  end if;

  -- Unverifiziert = nur halber Betrag zählt
  v_amount := coalesce(p_amount_cents, 0);
  if not p_verified then v_amount := v_amount / 2; end if;

  -- Stufen (in Cent)
  if v_amount >= 15000 then
    v_rarity := 'legendary'; v_bonus_typed := 2; v_typed_rarity := 'epic';
    if random() < 0.20 then v_typed_rarity := 'legendary'; end if;
  elsif v_amount >= 5000 then
    v_rarity := 'epic'; v_bonus_typed := 2; v_typed_rarity := 'rare';
    if random() < 0.25 then v_typed_rarity := 'epic'; end if;
  elsif v_amount >= 1500 then
    v_rarity := 'rare'; v_bonus_typed := 1; v_typed_rarity := 'rare';
    v_bonus_universal := 1;
  elsif v_amount >= 500 then
    v_rarity := 'common'; v_bonus_universal := 2;
  elsif v_amount >= 100 then
    v_rarity := 'common'; v_bonus_universal := 1;
  else
    v_rarity := 'none';
  end if;

  -- Siegel gutschreiben
  if v_bonus_universal > 0 or v_bonus_typed > 0 then
    insert into public.user_siegel (user_id) values (v_user) on conflict (user_id) do nothing;
    if v_bonus_universal > 0 then
      update public.user_siegel set siegel_universal = siegel_universal + v_bonus_universal, updated_at = now() where user_id = v_user;
    end if;
    if v_bonus_typed > 0 then
      -- verteile auf zufälligen Typ
      perform case (floor(random()*4)::int)
        when 0 then (update public.user_siegel set siegel_infantry = siegel_infantry + v_bonus_typed, updated_at = now() where user_id = v_user)
        when 1 then (update public.user_siegel set siegel_cavalry  = siegel_cavalry  + v_bonus_typed, updated_at = now() where user_id = v_user)
        when 2 then (update public.user_siegel set siegel_marksman = siegel_marksman + v_bonus_typed, updated_at = now() where user_id = v_user)
        else      (update public.user_siegel set siegel_mage      = siegel_mage      + v_bonus_typed, updated_at = now() where user_id = v_user)
      end;
    end if;
  end if;

  -- Epic/Legendary: zusätzlich Ausrüstungs-Drop
  if v_rarity in ('epic','legendary') then
    select id into v_item_id from public.item_catalog
      where rarity = case when v_rarity = 'legendary' then 'legend' else 'epic' end
      order by random() limit 1;
    if v_item_id is not null then
      insert into public.user_items (user_id, item_id, source)
        values (v_user, v_item_id, 'drop') returning id into v_user_item_id;
    end if;
  end if;

  update public.deal_redemptions
    set receipt_bonus_rarity = v_rarity,
        purchase_amount_cents = p_amount_cents,
        receipt_verified = p_verified,
        receipt_submitted_at = now()
    where id = p_redemption_id;

  return jsonb_build_object(
    'ok', true,
    'rarity', v_rarity,
    'bonus_universal', v_bonus_universal,
    'bonus_typed', v_bonus_typed,
    'typed_rarity', v_typed_rarity,
    'item_id', v_item_id,
    'user_item_id', v_user_item_id
  );
end $$;

grant execute on function public.grant_receipt_bonus_loot(uuid, int, boolean) to authenticated, anon;
