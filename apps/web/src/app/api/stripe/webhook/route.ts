import { NextResponse, type NextRequest } from "next/server";
import { getStripe } from "@/lib/stripe";
import { createClient as createAdminClient, type SupabaseClient } from "@supabase/supabase-js";
import { PLANS } from "@/lib/monetization";
import { normalizePlaystyle, type PlaystyleId } from "@/lib/playstyles";
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

  // IDEMPOTENZ: Stripe retried Events bis zu 3×. Ein Insert in stripe_processed_events
  // mit Primary-Key-Konflikt zeigt an, dass wir dieses Event schon verarbeitet haben.
  const { data: claim } = await admin()
    .from("stripe_processed_events")
    .insert({ event_id: event.id, event_type: event.type })
    .select("event_id")
    .maybeSingle();
  if (!claim) {
    // Bereits verarbeitet — 200 zurückgeben, damit Stripe nicht weiter retried.
    return NextResponse.json({ received: true, duplicate: true });
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;
    // Bei verzögerten Zahlarten (SEPA, Banküberweisung, ACH) ist payment_status
    // hier "unpaid" oder "no_payment_required". Erst async_payment_succeeded aktiviert.
    if (session.payment_status !== "paid") {
      // shop_stand_orders archived (pivot 2026-05-05)
      if (session.metadata?.type !== "stand_order") {
        await admin().from("purchases").update({ status: "pending_payment" })
          .eq("stripe_session_id", session.id);
      }
      return NextResponse.json({ received: true, pending_payment: true });
    }
    const result = await activateFromSession(session);
    if (result) return result;
  }

  if (event.type === "checkout.session.async_payment_succeeded") {
    const session = event.data.object as Stripe.Checkout.Session;
    const result = await activateFromSession(session);
    if (result) return result;
  }

  if (event.type === "checkout.session.async_payment_failed") {
    const session = event.data.object as Stripe.Checkout.Session;
    // shop_stand_orders archived (pivot 2026-05-05) — nur normale Purchases werden gemarkt
    if (session.metadata?.type !== "stand_order") {
      await admin().from("purchases").update({
        status: "failed",
        failed_at: new Date().toISOString(),
      }).eq("stripe_session_id", session.id);
    }
    return NextResponse.json({ received: true, payment_failed: true });
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
    // 3 SKU-Tier-Subs aus monetization_subscriptions
    if (sku?.startsWith("subscription:") && userId) {
      const subId = sku.split(":")[1];
      const isActive = sub.status === "active" || sub.status === "trialing";
      const periodEnd = (sub as unknown as { current_period_end?: number }).current_period_end;
      await admin().from("monetization_subscription_status").upsert({
        user_id: userId,
        subscription_id: subId,
        status: isActive ? "active" : "cancelled",
        next_renewal_at: isActive && typeof periodEnd === "number"
          ? new Date(periodEnd * 1000).toISOString()
          : null,
        cancelled_at: isActive ? null : new Date().toISOString(),
      }, { onConflict: "user_id,subscription_id" });
    }
  }

  return NextResponse.json({ received: true });
}

async function activateFromSession(session: Stripe.Checkout.Session): Promise<NextResponse | null> {
  // shop_stand_orders archived (pivot 2026-05-05) — Stand-Orders sind kein Flow mehr
  if (session.metadata?.type === "stand_order") {
    return NextResponse.json({ received: true, stand_order_archived: true });
  }

  const sku = session.metadata?.sku;
  const userId = session.metadata?.user_id;
  const crewId = session.metadata?.crew_id || null;
  const businessId = session.metadata?.business_id || null;
  if (!sku || !userId) return NextResponse.json({ received: true });

  await admin().from("purchases").update({
    status: "completed",
    applied_at: new Date().toISOString(),
    stripe_payment_id: typeof session.payment_intent === "string" ? session.payment_intent : session.payment_intent?.id,
  }).eq("stripe_session_id", session.id);

  const wahlboxChoice = session.metadata?.wahlbox_choice ?? null;
  await applyPurchaseEffect(sku, userId, crewId, businessId, { wahlboxChoice });
  return null;
}

async function applyPurchaseEffect(
  sku: string, userId: string, crewId: string | null,
  businessId: string | null = null,
  extras: { wahlboxChoice?: string | null } = {},
) {
  const sb = admin();
  if (sku === "plus_monthly" || sku === "plus_yearly") {
    const plan = (PLANS as Record<string, { duration_days: number | null }>)[sku];
    const expiresAt = plan.duration_days
      ? new Date(Date.now() + plan.duration_days * 86400000).toISOString()
      : null;
    await sb.from("users").update({
      premium_tier: "plus",
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
  // Crew-Diamanten-Pakete → landen direkt im Crew-Pool
  if (sku.startsWith("crew_gems_") && crewId) {
    const { CREW_GEM_PACKS } = await import("@/lib/monetization");
    const pack = (CREW_GEM_PACKS as Record<string, { gems: number; bonus: number }>)[sku];
    if (pack) {
      const add = pack.gems + pack.bonus;
      await sb.rpc("crew_gem_pool_topup", { p_crew_id: crewId, p_gems: add, p_reason: sku });
    }
    return;
  }
  // Crew-Slot-Packs → erhöhen member_cap
  if (sku.startsWith("crew_slots_") && crewId) {
    const { CREW_SLOT_PACKS } = await import("@/lib/monetization");
    const pack = (CREW_SLOT_PACKS as Record<string, { slots: number }>)[sku];
    if (pack) {
      await sb.rpc("crew_increase_member_cap", { p_crew_id: crewId, p_delta: pack.slots });
    }
    return;
  }
  if (sku.startsWith("gems_")) {
    // Diamant-Kauf — Basis + Bonus anschreiben
    const { findGemBundle, totalGemsOfBundle } = await import("@/lib/gem-bundles");
    const bundle = findGemBundle(sku);
    if (bundle) {
      let add = totalGemsOfBundle(bundle);
      // First-Purchase-Bonus +100% Gems
      const { data: u } = await sb.from("users").select("first_purchase_at, first_purchase_bonus_used, total_gems_purchased").eq("id", userId).maybeSingle<{ first_purchase_at: string | null; first_purchase_bonus_used: boolean; total_gems_purchased: number }>();
      const isFirstPurchase = !u?.first_purchase_at && !u?.first_purchase_bonus_used;
      let firstPurchaseBonus = 0;
      if (isFirstPurchase) {
        firstPurchaseBonus = add; // +100%
        add += firstPurchaseBonus;
        await sb.from("users").update({
          first_purchase_at: new Date().toISOString(),
          first_purchase_bonus_used: true,
        }).eq("id", userId);
        // Popup-Trigger (best-effort)
        try { await sb.rpc("grant_popup_for_event", { p_user_id: userId, p_event: "first_purchase" }); } catch { /* ignore */ }
      }
      // Atomar: gems UND total_purchased werden in einer RPC inkrementiert.
      await sb.rpc("add_gems_to_user", {
        p_user_id: userId, p_delta: add, p_track_purchased: true,
      });
      // Tracker für Recharge-Milestones
      await sb.from("users").update({ total_gems_purchased: (u?.total_gems_purchased ?? 0) + add }).eq("id", userId);
      await sb.from("gem_transactions").insert({
        user_id: userId, delta: add, reason: "stripe_purchase",
        metadata: { sku, base: bundle.gems, bonus: bundle.bonus, first_purchase_bonus: firstPurchaseBonus, price_cents: bundle.price_cents },
      });
    }
    return;
  }

  // ═══ Battle-Pass-Unlock ═══
  if (sku.startsWith("battle_pass:")) {
    // SKU-Format: "battle_pass:<season_id>:<track>"
    const parts = sku.split(":");
    const seasonId = parts[1];
    const track = parts[2];
    if (seasonId && (track === "premium" || track === "premium_plus")) {
      await sb.rpc("unlock_battle_pass_track", {
        p_user_id: userId, p_season_id: seasonId, p_track: track,
      });
    }
    return;
  }

  // ═══ Monthly Pack ═══
  if (sku.startsWith("monthly_pack:")) {
    const packSku = sku.split(":")[1];
    if (packSku) {
      await sb.from("user_monthly_packs").insert({
        user_id: userId, sku: packSku, started_at: new Date().toISOString(),
        expires_at: new Date(Date.now() + 30 * 24 * 3600 * 1000).toISOString(),
      });
    }
    return;
  }

  // ═══ Growth Fund ═══
  if (sku === "growth_fund" || sku.startsWith("growth_fund:")) {
    await sb.from("user_growth_fund").upsert({
      user_id: userId, purchased_at: new Date().toISOString(), total_paid_cents: 999,
    }, { onConflict: "user_id" });
    return;
  }

  // ═══ Saisonale / Themed / Gem-Tier-Packs ═══
  if (sku.startsWith("seasonal:") || sku.startsWith("themed:") || sku.startsWith("gem_tier:")) {
    const [kind, dealId] = sku.split(":");
    // Pack laden + rewards.gems gutschreiben (vereinfacht)
    const tableName = kind === "seasonal" ? "monetization_seasonal_packs"
      : kind === "themed" ? "monetization_themed_packs"
      : "monetization_gem_tiers";
    const { data: pack } = await sb.from(tableName).select("rewards, bonus_gems, gems_total").eq("id", dealId).maybeSingle<{ rewards?: Record<string, number>; bonus_gems?: number; gems_total?: number }>();
    if (pack) {
      const gems = (pack.gems_total ?? 0) + (pack.bonus_gems ?? 0);
      if (gems > 0) {
        await sb.rpc("add_gems_to_user", { p_user_id: userId, p_delta: gems, p_track_purchased: true });
      }
      // RSS aus rewards-blob
      if (pack.rewards) {
        const r = pack.rewards;
        const wood = Number(r.wood ?? 0); const stone = Number(r.stone ?? 0);
        const gold = Number(r.gold ?? 0); const mana = Number(r.mana ?? 0);
        const speed = Number(r.speed_token ?? 0);
        if (wood + stone + gold + mana + speed > 0) {
          try {
            await sb.rpc("add_resources_to_user", { p_user_id: userId, p_wood: wood, p_stone: stone, p_gold: gold, p_mana: mana, p_speed_token: speed });
          } catch {
            await sb.from("user_resources").update({ wood, stone, gold, mana, speed_tokens: speed }).eq("user_id", userId);
          }
        }
      }
      try {
        await sb.from("monetization_themed_pack_purchases").insert({
          user_id: userId, pack_id: dealId, kind, purchased_at: new Date().toISOString(),
        });
      } catch { /* table evtl. anders */ }
    }
    return;
  }

  // ═══ Subscription (3 Tier-SKUs) ═══
  if (sku.startsWith("subscription:")) {
    const subId = sku.split(":")[1];
    if (subId) {
      await sb.from("monetization_subscription_status").upsert({
        user_id: userId, subscription_id: subId,
        status: "active", started_at: new Date().toISOString(),
        next_renewal_at: new Date(Date.now() + 30 * 24 * 3600 * 1000).toISOString(),
      }, { onConflict: "user_id,subscription_id" });
    }
    return;
  }

  // Spielstil-Wechsel — Cycle durch architect → warlord → strategist → diplomat
  if (sku === "faction_switch") {
    const { data: u } = await sb.from("users").select("faction").eq("id", userId).single();
    const current: PlaystyleId | null = normalizePlaystyle(u?.faction);
    const order: PlaystyleId[] = ["architect", "warlord", "strategist", "diplomat"];
    const idx = current ? order.indexOf(current) : -1;
    const next = order[(idx + 1) % order.length];
    await sb.from("users").update({ faction: next, faction_switch_at: new Date().toISOString() }).eq("id", userId);
    return;
  }
  // mystery_box — User wählt im Frontend, Wahl wandert via session.metadata
  if (sku === "mystery_box") {
    const choice = extras.wahlboxChoice;
    if (!choice) return;
    // Wahl-Inhalte: speed_token | gem_pack_small | rss_pack | gem_pack_large
    // Alle Pfade nutzen atomare RPCs — kein Lost-Update bei parallelen Webhooks.
    if (choice === "speed_token") {
      await sb.rpc("add_resources_to_user", {
        p_user_id: userId, p_wood: 0, p_stone: 0, p_gold: 0, p_mana: 0, p_speed_token: 5,
      });
    } else if (choice === "gem_pack_small") {
      await sb.rpc("add_gems_to_user", { p_user_id: userId, p_delta: 250 });
    } else if (choice === "gem_pack_large") {
      await sb.rpc("add_gems_to_user", { p_user_id: userId, p_delta: 600 });
    } else if (choice === "rss_pack") {
      await sb.rpc("add_resources_to_user", {
        p_user_id: userId, p_wood: 5000, p_stone: 5000, p_gold: 5000, p_mana: 5000, p_speed_token: 0,
      });
    }
    await sb.from("gem_transactions").insert({
      user_id: userId, delta: 0, reason: "mystery_box_choice",
      metadata: { sku, choice },
    });
    return;
  }

  // ═══ SHOP-OWNER PURCHASES — alle archiviert (pivot 2026-05-05)
  // local_businesses + shop_arenas sind in runner_legacy. Stripe-Sessions mit
  // businessId-Metadata werden nicht mehr aktiv verarbeitet.
  if (businessId) {
    if (sku.startsWith("shop_") || ["spotlight_3d","radius_boost_7d","top_listing_7d","homepage_banner",
        "flash_push","event_host","challenge_sponsor","email_campaign","social_pro_monthly",
        "analytics_pro_monthly","competitor_monthly","kiez_report","qr_print_service",
        "arena_daily","arena_monthly","custom_pin"].includes(sku)) {
      return;
    }
  }
  // Waechter-Shop (Runner-Level via userId)
  if (sku === "revival_token" && userId) {
    await sb.from("user_guardians").update({ wounded_until: null, current_hp_pct: 100 })
      .eq("user_id", userId).eq("is_active", true);
    return;
  }
  if (sku === "guardian_xp" && userId) {
    const { data: g } = await sb.from("user_guardians").select("id, xp, level").eq("user_id", userId).eq("is_active", true).maybeSingle<{ id: string; xp: number; level: number }>();
    if (g) await sb.from("user_guardians").update({ xp: g.xp + 2500 }).eq("id", g.id);
    return;
  }
}
