"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { SHOP_PLANS, SHOP_BOOSTS, SHOP_MARKETING, SHOP_ANALYTICS, formatPrice } from "@/lib/monetization";
import { appAlert } from "@/components/app-dialog";
import { StripeCheckoutModal } from "@/components/stripe-embedded-checkout";

type ShopTab = "plans" | "boosts" | "marketing" | "analytics";

export function ShopProductsModal({ businessId, initialTab = "plans", onClose }: { businessId: string; initialTab?: ShopTab; onClose: () => void }) {
  const sb = createClient();
  const [tab, setTab] = useState<ShopTab>(initialTab);
  const [loading, setLoading] = useState<string | null>(null);
  const [checkoutSecret, setCheckoutSecret] = useState<string | null>(null);

  async function buy(sku: string, name: string, price: number) {
    setLoading(sku);
    try {
      if (process.env.NEXT_PUBLIC_STRIPE_ENABLED === "1") {
        const res = await fetch("/api/stripe/checkout", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ sku, name, amount_cents: price, business_id: businessId, ui_mode: "embedded" }),
        });
        const json = await res.json();
        if (json.client_secret) { setCheckoutSecret(json.client_secret); return; }
        if (json.url) { window.location.href = json.url; return; }
        throw new Error(json.error ?? "Checkout fehlgeschlagen");
      }
      // Demo-Fallback
      const { data, error } = await sb.from("purchases").insert({
        product_sku: sku, product_name: name, amount_cents: price, status: "pending",
      }).select("id").single();
      if (error) throw error;
      await sb.from("purchases").update({ status: "completed", applied_at: new Date().toISOString() }).eq("id", data.id);
      await applyShopEffectDemo(sb, sku, businessId);
      appAlert("Gekauft + aktiviert! (Demo)");
      onClose();
      location.reload();
    } catch (e) {
      appAlert("Fehler: " + (e instanceof Error ? e.message : String(e)));
    } finally {
      setLoading(null);
    }
  }

  const items = tab === "plans" ? Object.values(SHOP_PLANS)
    : tab === "boosts" ? Object.values(SHOP_BOOSTS)
    : tab === "marketing" ? Object.values(SHOP_MARKETING)
    : Object.values(SHOP_ANALYTICS);

  return (
    <div onClick={onClose} style={{
      position: "fixed", inset: 0, zIndex: 1000, display: "flex", alignItems: "flex-end", justifyContent: "center",
      background: "rgba(15,17,21,0.75)", backdropFilter: "blur(6px)",
    }}>
      <div onClick={(e) => e.stopPropagation()} style={{
        width: "100%", maxWidth: 640, maxHeight: "90vh", overflowY: "auto",
        background: "#1A1D23", border: "1px solid rgba(255,215,0,0.4)", borderRadius: "20px 20px 0 0",
        padding: 24, color: "#F0F0F0",
      }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ fontSize: 24 }}>🏪</span>
            <div>
              <div style={{ fontSize: 18, fontWeight: 900 }}>Shop-Power-Up</div>
              <div style={{ fontSize: 11, color: "#a8b4cf" }}>Pläne · Boosts · Marketing · Analytics</div>
            </div>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", color: "#a8b4cf", fontSize: 22, cursor: "pointer" }}>✕</button>
        </div>

        <div style={{ display: "flex", gap: 4, padding: 4, background: "rgba(255,255,255,0.05)", borderRadius: 10, marginBottom: 14, overflowX: "auto" }}>
          <Tab active={tab === "plans"} onClick={() => setTab("plans")}>💎 Pläne</Tab>
          <Tab active={tab === "boosts"} onClick={() => setTab("boosts")}>⚡ Boosts</Tab>
          <Tab active={tab === "marketing"} onClick={() => setTab("marketing")}>📣 Marketing</Tab>
          <Tab active={tab === "analytics"} onClick={() => setTab("analytics")}>📊 Analytics</Tab>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {items.map((p) => {
            const pp = p as { sku: string; name: string; price: number; icon?: string; desc?: string; duration_days?: number };
            const durationBadge = pp.duration_days
              ? `· ${pp.duration_days}d`
              : "";
            return (
              <div key={pp.sku} style={{
                display: "flex", alignItems: "center", gap: 10,
                padding: 14, borderRadius: 12,
                background: "rgba(70, 82, 122, 0.45)",
                border: "1px solid rgba(255,255,255,0.1)",
              }}>
                <span style={{ fontSize: 24 }}>{pp.icon ?? "🎁"}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ color: "#FFF", fontSize: 14, fontWeight: 800, display: "flex", alignItems: "center", gap: 6 }}>
                    {pp.name}
                    {tab === "plans" && (
                      <span style={{
                        fontSize: 9, fontWeight: 900, letterSpacing: 0.5,
                        padding: "2px 6px", borderRadius: 4,
                        background: "rgba(34,209,195,0.2)", color: "#22D1C3",
                        border: "1px solid rgba(34,209,195,0.4)",
                      }}>ABO</span>
                    )}
                  </div>
                  {pp.desc && <div style={{ color: "#a8b4cf", fontSize: 11, marginTop: 2 }}>{pp.desc}</div>}
                  {tab === "plans" && <div style={{ color: "#a8b4cf", fontSize: 10, marginTop: 2 }}>pro Monat {durationBadge} · jederzeit kündbar</div>}
                </div>
                <button
                  onClick={() => buy(pp.sku, pp.name, pp.price)}
                  disabled={loading === pp.sku}
                  style={{
                    background: "#FFD700", color: "#0F1115",
                    padding: "8px 16px", borderRadius: 8, border: "none", cursor: "pointer",
                    fontSize: 12, fontWeight: 900, whiteSpace: "nowrap",
                    opacity: loading === pp.sku ? 0.6 : 1,
                  }}
                >
                  {loading === pp.sku ? "…" : formatPrice(pp.price)}
                </button>
              </div>
            );
          })}
        </div>

        <div style={{ textAlign: "center", fontSize: 10, color: "#a8b4cf", marginTop: 14 }}>
          Sichere Zahlung via Stripe · Abos jederzeit kündbar
        </div>
      </div>
      {checkoutSecret && (
        <StripeCheckoutModal clientSecret={checkoutSecret} onClose={() => setCheckoutSecret(null)} />
      )}
    </div>
  );
}

function Tab({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick} style={{
      flexShrink: 0, padding: "8px 14px", borderRadius: 8, border: "none", cursor: "pointer",
      background: active ? "#FFD700" : "transparent",
      color: active ? "#0F1115" : "#F0F0F0",
      fontSize: 12, fontWeight: 800, whiteSpace: "nowrap",
    }}>{children}</button>
  );
}

async function applyShopEffectDemo(sb: ReturnType<typeof createClient>, sku: string, businessId: string) {
  const days = (d: number) => new Date(Date.now() + d * 86400000).toISOString();
  if (sku === "shop_basis" || sku === "shop_pro" || sku === "shop_ultra") {
    await sb.from("local_businesses").update({
      plan: sku.replace("shop_", ""),
      plan_expires_at: days(30),
    }).eq("id", businessId);
  } else if (sku === "spotlight_3d") {
    await sb.from("local_businesses").update({ spotlight_until: days(3) }).eq("id", businessId);
  } else if (sku === "radius_boost_7d") {
    await sb.from("local_businesses").update({ radius_boost_until: days(7) }).eq("id", businessId);
  } else if (sku === "top_listing_7d") {
    await sb.from("local_businesses").update({ top_listing_until: days(7) }).eq("id", businessId);
  } else if (sku === "homepage_banner") {
    await sb.from("local_businesses").update({ banner_until: days(7) }).eq("id", businessId);
  } else if (sku === "flash_push") {
    const { data: b } = await sb.from("local_businesses").select("flash_push_credits").eq("id", businessId).single();
    await sb.from("local_businesses").update({ flash_push_credits: (b?.flash_push_credits ?? 0) + 1 }).eq("id", businessId);
  } else if (sku === "event_host") {
    const { data: b } = await sb.from("local_businesses").select("event_host_credits").eq("id", businessId).single();
    await sb.from("local_businesses").update({ event_host_credits: (b?.event_host_credits ?? 0) + 1 }).eq("id", businessId);
  } else if (sku === "challenge_sponsor") {
    const { data: b } = await sb.from("local_businesses").select("challenge_sponsor_credits").eq("id", businessId).single();
    await sb.from("local_businesses").update({ challenge_sponsor_credits: (b?.challenge_sponsor_credits ?? 0) + 1 }).eq("id", businessId);
  } else if (sku === "email_campaign") {
    const { data: b } = await sb.from("local_businesses").select("email_campaign_credits").eq("id", businessId).single();
    await sb.from("local_businesses").update({ email_campaign_credits: (b?.email_campaign_credits ?? 0) + 1 }).eq("id", businessId);
  } else if (sku === "social_pro_monthly") {
    await sb.from("local_businesses").update({ social_pro_until: days(30) }).eq("id", businessId);
  } else if (sku === "analytics_pro_monthly") {
    await sb.from("local_businesses").update({ analytics_pro_until: days(30) }).eq("id", businessId);
  } else if (sku === "competitor_monthly") {
    await sb.from("local_businesses").update({ competitor_analysis_until: days(30) }).eq("id", businessId);
  } else if (sku === "kiez_report") {
    await sb.from("local_businesses").update({ kiez_report_last: new Date().toISOString() }).eq("id", businessId);
  } else if (sku === "qr_print_service") {
    await sb.from("local_businesses").update({ qr_print_ordered_at: new Date().toISOString() }).eq("id", businessId);
  } else if (sku === "custom_pin") {
    await sb.from("local_businesses").update({ custom_pin_url: "pending" }).eq("id", businessId);
  }
}
