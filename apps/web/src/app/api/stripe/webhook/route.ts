import { NextResponse, type NextRequest } from "next/server";
import { getStripe } from "@/lib/stripe";
import { createClient as createAdminClient, type SupabaseClient } from "@supabase/supabase-js";
import { BOOST_PACKS, XP_PACKS, PLANS } from "@/lib/monetization";
import type Stripe from "stripe";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

let _admin: SupabaseClient | null = null;
function admin(): SupabaseClient {
  if (_admin) return _admin;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Supabase admin creds missing");
  _admin = createAdminClient(url, key, { auth: { persistSession: false } });
  return _admin;
}

export async function POST(req: NextRequest) {
  const sig = req.headers.get("stripe-signature");
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!sig || !secret) return NextResponse.json({ error: "Missing signature" }, { status: 400 });

  const body = await req.text();
  let event: Stripe.Event;
  try {
    event = getStripe().webhooks.constructEvent(body, sig, secret);
  } catch (e) {
    return NextResponse.json({ error: `Webhook Error: ${e instanceof Error ? e.message : String(e)}` }, { status: 400 });
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;
    const sku = session.metadata?.sku;
    const userId = session.metadata?.user_id;
    const crewId = session.metadata?.crew_id || null;
    if (!sku || !userId) return NextResponse.json({ received: true });

    // Purchase auf completed setzen
    await admin().from("purchases").update({
      status: "completed",
      applied_at: new Date().toISOString(),
      stripe_payment_id: typeof session.payment_intent === "string" ? session.payment_intent : session.payment_intent?.id,
    }).eq("stripe_session_id", session.id);

    await applyPurchaseEffect(sku, userId, crewId);
  }

  if (event.type === "customer.subscription.deleted" || event.type === "customer.subscription.updated") {
    const sub = event.data.object as Stripe.Subscription;
    const sku = sub.metadata?.sku;
    const userId = sub.metadata?.user_id;
    if (sku?.startsWith("plus_") && userId) {
      const active = sub.status === "active" || sub.status === "trialing";
      await admin().from("users").update({
        premium_tier: active ? "plus" : "free",
        premium_expires_at: active && typeof (sub as unknown as { current_period_end?: number }).current_period_end === "number"
          ? new Date((sub as unknown as { current_period_end: number }).current_period_end * 1000).toISOString()
          : null,
      }).eq("id", userId);
    }
    if (sku?.startsWith("badge_") && userId) {
      const active = sub.status === "active" || sub.status === "trialing";
      const tier = sku === "badge_gold" ? "gold" : sku === "badge_silver" ? "silver" : "bronze";
      await admin().from("users").update({
        supporter_tier: active ? tier : null,
      }).eq("id", userId);
    }
  }

  return NextResponse.json({ received: true });
}

async function applyPurchaseEffect(sku: string, userId: string, crewId: string | null) {
  const sb = admin();
  if (sku === "plus_monthly" || sku === "plus_yearly" || sku === "plus_lifetime") {
    const plan = (PLANS as Record<string, { duration_days: number | null }>)[sku];
    const expiresAt = plan.duration_days
      ? new Date(Date.now() + plan.duration_days * 86400000).toISOString()
      : null;
    await sb.from("users").update({
      premium_tier: sku === "plus_lifetime" ? "lifetime" : "plus",
      premium_expires_at: expiresAt,
      streak_freezes_remaining: 3,
    }).eq("id", userId);
    return;
  }
  if ((sku === "crew_pro_monthly" || sku === "crew_pro_yearly") && crewId) {
    const plan = (PLANS as Record<string, { duration_days: number | null }>)[sku];
    const expiresAt = plan.duration_days
      ? new Date(Date.now() + plan.duration_days * 86400000).toISOString()
      : null;
    await sb.from("crews").update({
      plan: "pro",
      plan_expires_at: expiresAt,
    }).eq("id", crewId);
    return;
  }
  if (sku.startsWith("boost_")) {
    const pack = (BOOST_PACKS as Record<string, { hours: number; multiplier: number }>)[sku];
    if (pack) {
      await sb.from("users").update({
        xp_boost_until: new Date(Date.now() + pack.hours * 3600000).toISOString(),
        xp_boost_multiplier: pack.multiplier,
      }).eq("id", userId);
    }
    return;
  }
  if (sku === "crew_boost_24h") {
    const { data: u } = await sb.from("users").select("current_crew_id").eq("id", userId).single();
    if (u?.current_crew_id) {
      await sb.from("crews").update({
        xp_boost_until: new Date(Date.now() + 24 * 3600000).toISOString(),
        xp_boost_multiplier: 2,
      }).eq("id", u.current_crew_id);
    }
    return;
  }
  if (sku.startsWith("xp_")) {
    const pack = (XP_PACKS as Record<string, { xp: number }>)[sku];
    if (pack) {
      const { data: u } = await sb.from("users").select("xp").eq("id", userId).single();
      await sb.from("users").update({ xp: (u?.xp ?? 0) + pack.xp }).eq("id", userId);
    }
    return;
  }
  if (sku === "streak_pack_5" || sku === "streak_pack_15") {
    const add = sku === "streak_pack_15" ? 15 : 5;
    const { data: u } = await sb.from("users").select("streak_freezes_remaining").eq("id", userId).single();
    await sb.from("users").update({
      streak_freezes_remaining: (u?.streak_freezes_remaining ?? 0) + add,
    }).eq("id", userId);
    return;
  }
  if (sku === "shout_pack_10") {
    const { data: u } = await sb.from("users").select("shouts_remaining").eq("id", userId).single();
    await sb.from("users").update({ shouts_remaining: (u?.shouts_remaining ?? 0) + 10 }).eq("id", userId);
    return;
  }
  if (sku === "golden_trail" || sku === "neon_trail") {
    await sb.from("users").update({ equipped_trail: sku }).eq("id", userId);
    return;
  }
  if (sku === "aura_effect") {
    await sb.from("users").update({ aura_until: new Date(Date.now() + 30 * 86400000).toISOString() }).eq("id", userId);
    return;
  }
  if (sku === "rainbow_name") {
    await sb.from("users").update({ rainbow_name_until: new Date(Date.now() + 30 * 86400000).toISOString() }).eq("id", userId);
    return;
  }
  if (sku === "victory_dance") {
    await sb.from("users").update({ victory_dance_enabled: true }).eq("id", userId);
    return;
  }
  if (sku === "map_cyberpunk" || sku === "map_retro") {
    await sb.from("users").update({ map_theme: sku }).eq("id", userId);
    return;
  }
  if (sku === "ghost_mode") {
    const { data: u } = await sb.from("users").select("ghost_mode_charges").eq("id", userId).single();
    await sb.from("users").update({ ghost_mode_charges: (u?.ghost_mode_charges ?? 0) + 1 }).eq("id", userId);
    return;
  }
  if (sku === "double_claim") {
    const { data: u } = await sb.from("users").select("double_claim_charges").eq("id", userId).single();
    await sb.from("users").update({ double_claim_charges: (u?.double_claim_charges ?? 0) + 1 }).eq("id", userId);
    return;
  }
  if (sku === "reclaim_ticket") {
    const { data: u } = await sb.from("users").select("reclaim_tickets").eq("id", userId).single();
    await sb.from("users").update({ reclaim_tickets: (u?.reclaim_tickets ?? 0) + 1 }).eq("id", userId);
    return;
  }
  if (sku === "explorer_compass") {
    await sb.from("users").update({ explorer_compass_until: new Date(Date.now() + 7 * 86400000).toISOString() }).eq("id", userId);
    return;
  }
  if (sku === "faction_switch") {
    const { data: u } = await sb.from("users").select("faction").eq("id", userId).single();
    const newFaction = u?.faction === "syndicate" ? "vanguard" : "syndicate";
    await sb.from("users").update({ faction: newFaction, faction_switch_at: new Date().toISOString() }).eq("id", userId);
    return;
  }
}
