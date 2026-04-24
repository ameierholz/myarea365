-- Erweitert Status-CHECK-Constraints um Zwischenzustände für verzögerte
-- Zahlungsmethoden (SEPA, Banküberweisung, ACH).
--
-- purchases:         + 'pending_payment'
-- shop_stand_orders: + 'pending_payment', 'payment_failed'
--
-- Der Stripe-Webhook setzt bei checkout.session.completed mit payment_status
-- != 'paid' den Status auf 'pending_payment' und aktiviert erst bei
-- checkout.session.async_payment_succeeded.

ALTER TABLE public.purchases DROP CONSTRAINT IF EXISTS purchases_status_check;
ALTER TABLE public.purchases ADD CONSTRAINT purchases_status_check
  CHECK (status = ANY (ARRAY[
    'pending'::text,
    'pending_payment'::text,
    'completed'::text,
    'refunded'::text,
    'failed'::text
  ]));

ALTER TABLE public.shop_stand_orders DROP CONSTRAINT IF EXISTS shop_stand_orders_status_check;
ALTER TABLE public.shop_stand_orders ADD CONSTRAINT shop_stand_orders_status_check
  CHECK (status = ANY (ARRAY[
    'pending'::text,
    'pending_payment'::text,
    'paid'::text,
    'payment_failed'::text,
    'shipped'::text,
    'cancelled'::text
  ]));
