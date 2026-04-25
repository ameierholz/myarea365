"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { createClient } from "@/lib/supabase/client";
import { SHOP_PLANS, SHOP_BOOSTS, SHOP_FEATURES_BY_PLAN, formatPrice } from "@/lib/monetization";
import { appAlert } from "@/components/app-dialog";
import { StripeCheckoutModal } from "@/components/stripe-embedded-checkout";

type ShopTab = "plans" | "boosts";
const NORMALIZE_TAB: Record<string, ShopTab> = {
  plans: "plans",
  boosts: "boosts",
  marketing: "boosts",
  analytics: "plans",
};

type PanT = ReturnType<typeof useTranslations<"ShopPanels">>;

export function ShopProductsModal({ businessId, initialTab = "plans", onClose }: {
  businessId: string;
  initialTab?: string;
  onClose: () => void;
}) {
  const t = useTranslations("ShopPanels");
  const sb = createClient();
  const [tab, setTab] = useState<ShopTab>(NORMALIZE_TAB[initialTab] ?? "plans");
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
        throw new Error(json.error ?? t("prodCheckoutFailed"));
      }
      const { data, error } = await sb.from("purchases").insert({
        product_sku: sku, product_name: name, amount_cents: price, status: "pending",
      }).select("id").single();
      if (error) throw error;
      await sb.from("purchases").update({ status: "completed", applied_at: new Date().toISOString() }).eq("id", data.id);
      await applyShopEffectDemo(sb, sku, businessId);
      appAlert(t("prodCheckoutSuccess"));
      onClose();
      location.reload();
    } catch (e) {
      appAlert(t("prodErrorPrefix") + (e instanceof Error ? e.message : String(e)));
    } finally {
      setLoading(null);
    }
  }

  return (
    <div onClick={onClose} style={{
      position: "fixed", inset: 0, zIndex: 1000, display: "flex", alignItems: "flex-end", justifyContent: "center",
      background: "rgba(15,17,21,0.75)", backdropFilter: "blur(6px)",
    }}>
      <div onClick={(e) => e.stopPropagation()} style={{
        width: "100%", maxWidth: 720, maxHeight: "92vh", overflowY: "auto",
        background: "#1A1D23", border: "1px solid rgba(255,215,0,0.4)", borderRadius: "20px 20px 0 0",
        padding: 24, color: "#F0F0F0",
      }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ fontSize: 28 }}>🎯</span>
            <div>
              <div style={{ fontSize: 19, fontWeight: 900 }}>{t("prodModalTitle")}</div>
              <div style={{ fontSize: 11, color: "#a8b4cf" }}>{t("prodModalSub")}</div>
            </div>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", color: "#a8b4cf", fontSize: 22, cursor: "pointer" }}>✕</button>
        </div>

        <div style={{ display: "flex", gap: 6, padding: 4, background: "rgba(255,255,255,0.05)", borderRadius: 10, marginBottom: 16 }}>
          <Tab active={tab === "plans"}  onClick={() => setTab("plans")}>{t("prodTabPlans")}</Tab>
          <Tab active={tab === "boosts"} onClick={() => setTab("boosts")}>{t("prodTabBoosts")}</Tab>
        </div>

        {tab === "plans" && <PlansTab onBuy={buy} loading={loading} t={t} />}
        {tab === "boosts" && <BoostsTab onBuy={buy} loading={loading} t={t} />}

        <div style={{ textAlign: "center", fontSize: 10, color: "#a8b4cf", marginTop: 18 }}>
          {t("prodPaymentFooter")}
        </div>
      </div>
      {checkoutSecret && (
        <StripeCheckoutModal clientSecret={checkoutSecret} onClose={() => setCheckoutSecret(null)} />
      )}
    </div>
  );
}

function PlansTab({ onBuy, loading, t }: {
  onBuy: (sku: string, name: string, price: number) => void;
  loading: string | null;
  t: PanT;
}) {
  type PlanRow = { key: "free"|"basis"|"pro"|"ultra"; price: number; name: string; sku: string | null; color: string; featured?: boolean };
  const plans: PlanRow[] = [
    { key: "free",  price: 0,                    name: t("prodPlanFree"),          sku: null, color: "#8B8FA3" },
    { key: "basis", price: SHOP_PLANS.shop_basis.price, name: SHOP_PLANS.shop_basis.name, sku: "shop_basis", color: "#22D1C3" },
    { key: "pro",   price: SHOP_PLANS.shop_pro.price,   name: SHOP_PLANS.shop_pro.name,   sku: "shop_pro", color: "#FFD700", featured: true },
    { key: "ultra", price: SHOP_PLANS.shop_ultra.price, name: SHOP_PLANS.shop_ultra.name, sku: "shop_ultra", color: "#FF2D78" },
  ];

  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 10 }}>
      {plans.map((p) => {
        const features = SHOP_FEATURES_BY_PLAN[p.key as keyof typeof SHOP_FEATURES_BY_PLAN];
        return (
          <div key={p.key} style={{
            position: "relative",
            padding: 14, borderRadius: 14,
            background: p.featured
              ? `linear-gradient(135deg, ${p.color}28, rgba(15,17,21,0.6))`
              : "rgba(70, 82, 122, 0.3)",
            border: `1.5px solid ${p.featured ? p.color : "rgba(255,255,255,0.1)"}`,
            display: "flex", flexDirection: "column", gap: 10,
          }}>
            {p.featured && (
              <div style={{
                position: "absolute", top: -10, right: 10,
                padding: "3px 8px", borderRadius: 4,
                background: p.color, color: "#0F1115",
                fontSize: 9, fontWeight: 900, letterSpacing: 1,
              }}>{t("prodPlanRecommended")}</div>
            )}
            <div>
              <div style={{ fontSize: 16, fontWeight: 900, color: p.color }}>{p.name}</div>
              <div style={{ fontSize: 20, fontWeight: 900, color: "#FFF", marginTop: 2 }}>
                {p.price === 0 ? t("prodFreePrice") : t("prodEurFmt", { value: (p.price / 100).toFixed(0) })}
                <span style={{ fontSize: 11, color: "#a8b4cf", fontWeight: 600 }}> {t("prodPlanPerMonth")}</span>
              </div>
            </div>
            <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: 5, flex: 1 }}>
              {features.map((f, i) => (
                <li key={i} style={{ fontSize: 11, color: "#D0D0D5", lineHeight: 1.3 }}>{f}</li>
              ))}
            </ul>
            {p.sku ? (
              <button
                onClick={() => onBuy(p.sku!, p.name, p.price)}
                disabled={loading === p.sku}
                style={{
                  padding: "10px 12px", borderRadius: 8, border: "none",
                  background: p.color, color: "#0F1115",
                  fontSize: 12, fontWeight: 900, cursor: "pointer",
                  opacity: loading === p.sku ? 0.6 : 1,
                }}
              >
                {loading === p.sku ? "…" : t("prodPlanChoose", { name: p.name })}
              </button>
            ) : (
              <div style={{
                padding: "10px 12px", borderRadius: 8,
                background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)",
                color: "#8B8FA3", fontSize: 11, fontWeight: 700, textAlign: "center",
              }}>{t("prodPlanCurrentDefault")}</div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function BoostsTab({ onBuy, loading, t }: {
  onBuy: (sku: string, name: string, price: number) => void;
  loading: string | null;
  t: PanT;
}) {
  type BoostRow = { sku: string; name: string; icon: string; price: number; tagline: string; desc: string; duration: string; color: string; featured?: boolean };
  const boosts: BoostRow[] = [
    {
      sku: SHOP_BOOSTS.flash_push.sku,
      name: SHOP_BOOSTS.flash_push.name,
      icon: SHOP_BOOSTS.flash_push.icon,
      price: SHOP_BOOSTS.flash_push.price,
      tagline: t("prodBoostFlashTagline"),
      desc: t("prodBoostFlashDesc"),
      duration: t("prodBoostFlashDuration"),
      color: "#FF6B4A",
    },
    {
      sku: SHOP_BOOSTS.spotlight_3d.sku,
      name: SHOP_BOOSTS.spotlight_3d.name,
      icon: SHOP_BOOSTS.spotlight_3d.icon,
      price: SHOP_BOOSTS.spotlight_3d.price,
      tagline: t("prodBoostSpotTagline"),
      desc: t("prodBoostSpotDesc"),
      duration: t("prodBoostSpotDuration"),
      color: "#FFD700",
      featured: true,
    },
    {
      sku: SHOP_BOOSTS.event_host.sku,
      name: SHOP_BOOSTS.event_host.name,
      icon: SHOP_BOOSTS.event_host.icon,
      price: SHOP_BOOSTS.event_host.price,
      tagline: t("prodBoostEventTagline"),
      desc: t("prodBoostEventDesc"),
      duration: t("prodBoostEventDuration"),
      color: "#FF2D78",
    },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <div style={{
        padding: "10px 12px", borderRadius: 10, marginBottom: 4,
        background: "rgba(34,209,195,0.08)", border: "1px solid rgba(34,209,195,0.2)",
        color: "#a8b4cf", fontSize: 11, lineHeight: 1.5,
      }}>
        {t("prodBoostHint")}
      </div>

      {boosts.map((b) => (
        <div key={b.sku} style={{
          position: "relative",
          padding: 14, borderRadius: 12,
          background: b.featured
            ? `linear-gradient(135deg, ${b.color}18, rgba(15,17,21,0.5))`
            : "rgba(70, 82, 122, 0.3)",
          border: `1.5px solid ${b.featured ? b.color : "rgba(255,255,255,0.1)"}`,
        }}>
          {b.featured && (
            <div style={{
              position: "absolute", top: -8, right: 12,
              padding: "2px 8px", borderRadius: 4,
              background: b.color, color: "#0F1115",
              fontSize: 9, fontWeight: 900, letterSpacing: 1,
            }}>{t("prodBoostBestseller")}</div>
          )}
          <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
            <div style={{
              width: 48, height: 48, borderRadius: 12, flexShrink: 0,
              background: `${b.color}22`, border: `1px solid ${b.color}55`,
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 24,
            }}>{b.icon}</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
                <div style={{ fontSize: 15, fontWeight: 900, color: "#FFF" }}>{b.name}</div>
                <div style={{ fontSize: 16, fontWeight: 900, color: b.color }}>{formatPrice(b.price)}</div>
              </div>
              <div style={{ fontSize: 11, color: b.color, fontWeight: 700, marginTop: 1 }}>{b.tagline}</div>
              <div style={{ fontSize: 12, color: "#a8b4cf", marginTop: 6, lineHeight: 1.45 }}>{b.desc}</div>
              <div style={{ fontSize: 10, color: "#8B8FA3", marginTop: 4 }}>⏱ {b.duration}</div>
              <button
                onClick={() => onBuy(b.sku, b.name, b.price)}
                disabled={loading === b.sku}
                style={{
                  marginTop: 10, padding: "9px 14px", borderRadius: 8, border: "none",
                  background: b.color, color: "#0F1115",
                  fontSize: 12, fontWeight: 900, cursor: "pointer",
                  opacity: loading === b.sku ? 0.6 : 1,
                }}
              >
                {loading === b.sku ? "…" : t("prodBoostBookNow")}
              </button>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function Tab({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick} style={{
      flex: 1, padding: "10px 14px", borderRadius: 8, border: "none", cursor: "pointer",
      background: active ? "#FFD700" : "transparent",
      color: active ? "#0F1115" : "#F0F0F0",
      fontSize: 13, fontWeight: 800,
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
  } else if (sku === "flash_push") {
    const { data: b } = await sb.from("local_businesses").select("flash_push_credits").eq("id", businessId).single();
    await sb.from("local_businesses").update({ flash_push_credits: (b?.flash_push_credits ?? 0) + 1 }).eq("id", businessId);
  } else if (sku === "event_host") {
    const { data: b } = await sb.from("local_businesses").select("event_host_credits").eq("id", businessId).single();
    await sb.from("local_businesses").update({ event_host_credits: (b?.event_host_credits ?? 0) + 1 }).eq("id", businessId);
  }
}
