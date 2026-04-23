-- 00058: Fix — min_order_amount_cents auf shop_deals hinzufügen.
--
-- Die Spalte wurde ursprünglich in 00023 auf einer alten "deals"-Tabelle
-- angelegt. Migration 00054 hat aber eine neue "shop_deals"-Tabelle ohne
-- diese Spalte erstellt. 00056 (search_deals RPC) und der Client-Code
-- (redeem-flow, dashboard) referenzieren die Spalte trotzdem auf
-- shop_deals → Fehler "column d.min_order_amount_cents does not exist".

alter table public.shop_deals
  add column if not exists min_order_amount_cents int;

comment on column public.shop_deals.min_order_amount_cents is
  'Optionaler Mindest-Bestellwert für die Einlösung. NULL = kein Limit.';
