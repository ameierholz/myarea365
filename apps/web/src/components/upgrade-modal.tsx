"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { createClient } from "@/lib/supabase/client";
import { PLANS, PLUS_FEATURES, CREW_PRO_FEATURES, formatPrice } from "@/lib/monetization";
import { StripeCheckoutModal } from "@/components/stripe-embedded-checkout";
import { appAlert } from "@/components/app-dialog";

type Mode = "plus" | "crew";

export function UpgradeBody({ mode, userId, crewId, onDone }: {
  mode: Mode; userId?: string; crewId?: string; onDone?: () => void;
}) {
  const t = useTranslations("Upgrade");
  const sb = createClient();
  const [billing, setBilling] = useState<"monthly" | "yearly" | "lifetime">("monthly");
  const [loading, setLoading] = useState(false);
  const [checkoutSecret, setCheckoutSecret] = useState<string | null>(null);

  const plans = mode === "plus"
    ? { monthly: PLANS.plus_monthly, yearly: PLANS.plus_yearly, lifetime: null }
    : { monthly: PLANS.crew_pro_monthly, yearly: PLANS.crew_pro_yearly, lifetime: null };

  const features = mode === "plus" ? PLUS_FEATURES : CREW_PRO_FEATURES;
  const active = plans[billing] || plans.yearly;
  const accent = mode === "plus" ? "#22D1C3" : "#FF2D78";

  async function purchase() {
    setLoading(true);
    try {
      if (process.env.NEXT_PUBLIC_STRIPE_ENABLED === "1") {
        const res = await fetch("/api/stripe/checkout", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            sku: active.sku, name: active.name, amount_cents: active.price, crew_id: crewId, ui_mode: "embedded",
          }),
        });
        const json = await res.json();
        if (json.client_secret) { setCheckoutSecret(json.client_secret); return; }
        if (json.url) { window.location.href = json.url; return; }
        throw new Error(json.error ?? t("checkoutFailed"));
      }

      const { data, error } = await sb.from("purchases").insert({
        user_id: userId, crew_id: crewId,
        product_sku: active.sku, product_name: active.name,
        amount_cents: active.price, currency: "EUR", status: "pending",
      }).select("id").single();
      if (error) throw error;

      const expiresAt = active.duration_days
        ? new Date(Date.now() + active.duration_days * 86400000).toISOString()
        : null;
      await sb.from("purchases").update({ status: "completed", applied_at: new Date().toISOString() }).eq("id", data.id);
      if (mode === "plus" && userId) {
        await sb.from("users").update({
          premium_tier: "plus",
          premium_expires_at: expiresAt,
          streak_freezes_remaining: 3,
        }).eq("id", userId);
      }
      if (mode === "crew" && crewId) {
        await sb.from("crews").update({ plan: "pro", plan_expires_at: expiresAt }).eq("id", crewId);
      }
      appAlert(t("demoActive"));
      onDone?.();
      location.reload();
    } catch (e) {
      appAlert(t("errorPrefix") + (e instanceof Error ? e.message : String(e)));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ color: "#F0F0F0" }}>
      {mode === "plus" && (
        <div style={{
          padding: 14, borderRadius: 14, marginBottom: 14,
          background: "linear-gradient(135deg, rgba(34,209,195,0.14), rgba(255,45,120,0.10))",
          border: "1px solid rgba(34,209,195,0.35)",
          display: "flex", alignItems: "flex-start", gap: 12,
        }}>
          <div style={{ fontSize: 26, lineHeight: 1, flexShrink: 0 }}>💛</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ color: "#FFF", fontSize: 14, fontWeight: 900, marginBottom: 4 }}>
              {t("plusKickerTitle")}
            </div>
            <div style={{ color: "#a8b4cf", fontSize: 12, lineHeight: 1.55 }}>
              {t("plusKickerBody1")} <b style={{ color: "#22D1C3" }}>{t("plusKickerBoldName")}</b> {t("plusKickerBody2")}
            </div>
          </div>
        </div>
      )}
      <div style={{ display: "flex", gap: 6, padding: 4, background: "rgba(255,255,255,0.05)", borderRadius: 10, marginBottom: 16 }}>
        <BillingTab active={billing === "monthly"} onClick={() => setBilling("monthly")} accent={accent}>
          {t("billingMonthly")}
        </BillingTab>
        <BillingTab active={billing === "yearly"} onClick={() => setBilling("yearly")} accent={accent}>
          {t("billingYearly")}
          <span style={{ marginLeft: 4, fontSize: 9, padding: "1px 5px", borderRadius: 4, background: accent, color: "#0F1115" }}>
            {t("billingSavings", { pct: plans.yearly?.savings_pct ?? 40 })}
          </span>
        </BillingTab>
        {plans.lifetime && (
          <BillingTab active={billing === "lifetime"} onClick={() => setBilling("lifetime")} accent={accent}>
            {t("billingLifetime")}
          </BillingTab>
        )}
      </div>

      <div style={{ textAlign: "center", padding: "14px 0", borderRadius: 14, background: `${accent}15`, border: `1px solid ${accent}44`, marginBottom: 16 }}>
        <div style={{ fontSize: 36, fontWeight: 900, color: accent }}>{formatPrice(active.price)}</div>
        <div style={{ fontSize: 12, color: "#a8b4cf" }}>
          {active.duration_days === 30 && t("perMonth")}
          {active.duration_days === 365 && t("perYear")}
          {active.duration_days === null && t("lifetimeNote")}
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 18 }}>
        {features.map((f) => {
          const status = (f as { status?: "live" | "soon" }).status;
          return (
            <div key={f.title} style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
              <span style={{ fontSize: 18 }}>{f.icon}</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 800, color: "#FFF", display: "flex", alignItems: "center", gap: 6 }}>
                  {f.title}
                  {status === "live" && (
                    <span style={{
                      fontSize: 8, fontWeight: 900, letterSpacing: 0.5,
                      padding: "2px 6px", borderRadius: 4,
                      background: "rgba(74,222,128,0.18)", color: "#4ade80",
                      border: "1px solid rgba(74,222,128,0.4)",
                    }}>{t("badgeLive")}</span>
                  )}
                  {status === "soon" && (
                    <span style={{
                      fontSize: 8, fontWeight: 900, letterSpacing: 0.5,
                      padding: "2px 6px", borderRadius: 4,
                      background: "rgba(255,215,0,0.15)", color: "#FFD700",
                      border: "1px solid rgba(255,215,0,0.4)",
                    }}>{t("badgeSoon")}</span>
                  )}
                </div>
                <div style={{ fontSize: 11, color: "#a8b4cf" }}>{f.desc}</div>
              </div>
            </div>
          );
        })}
      </div>

      <button
        onClick={purchase}
        disabled={loading}
        style={{
          width: "100%", padding: "14px 20px", borderRadius: 14,
          background: accent, color: "#0F1115", border: "none", cursor: "pointer",
          fontSize: 15, fontWeight: 900, letterSpacing: 0.3,
          opacity: loading ? 0.6 : 1,
        }}
      >
        {loading ? "…" : t("ctaUnlock", { price: formatPrice(active.price) })}
      </button>
      <div style={{ textAlign: "center", fontSize: 10, color: "#a8b4cf", marginTop: 8 }}>
        {t("footerStripe")}
      </div>

      {checkoutSecret && (
        <StripeCheckoutModal clientSecret={checkoutSecret} onClose={() => setCheckoutSecret(null)} />
      )}
    </div>
  );
}

export function UpgradeModal({ mode, userId, crewId, onClose }: {
  mode: Mode; userId?: string; crewId?: string; onClose: () => void;
}) {
  const t = useTranslations("Upgrade");
  const accent = mode === "plus" ? "#22D1C3" : "#FF2D78";
  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 1000, display: "flex", alignItems: "flex-end", justifyContent: "center",
      background: "rgba(15,17,21,0.75)", backdropFilter: "blur(6px)",
    }} onClick={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "100%", maxWidth: 520, maxHeight: "90vh", overflowY: "auto",
          background: "#1A1D23", border: `1px solid ${accent}55`, borderRadius: "20px 20px 0 0",
          padding: 24, color: "#F0F0F0",
          boxShadow: `0 -10px 40px ${accent}33`,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 18 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ fontSize: 28 }}>{mode === "plus" ? "💎" : "👥"}</span>
            <div>
              <div style={{ fontSize: 20, fontWeight: 900 }}>
                {mode === "plus" ? t("modalPlus") : t("modalCrew")}
              </div>
              <div style={{ fontSize: 11, color: "#a8b4cf" }}>
                {mode === "plus" ? t("modalSubPlus") : t("modalSubCrew")}
              </div>
            </div>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", color: "#a8b4cf", fontSize: 22, cursor: "pointer" }}>✕</button>
        </div>
        <UpgradeBody mode={mode} userId={userId} crewId={crewId} onDone={onClose} />
      </div>
    </div>
  );
}

function BillingTab({ active, onClick, children, accent }: { active: boolean; onClick: () => void; children: React.ReactNode; accent: string }) {
  return (
    <button
      onClick={onClick}
      style={{
        flex: 1, padding: "8px 10px", borderRadius: 8, border: "none", cursor: "pointer",
        background: active ? accent : "transparent",
        color: active ? "#0F1115" : "#F0F0F0",
        fontSize: 12, fontWeight: 800,
      }}
    >
      {children}
    </button>
  );
}
