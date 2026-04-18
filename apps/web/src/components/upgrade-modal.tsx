"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { PLANS, PLUS_FEATURES, CREW_PRO_FEATURES, formatPrice } from "@/lib/monetization";
import { appAlert, appConfirm } from "@/components/app-dialog";

type Mode = "plus" | "crew";

export function UpgradeModal({ mode, userId, crewId, onClose }: {
  mode: Mode; userId?: string; crewId?: string; onClose: () => void;
}) {
  const sb = createClient();
  const [billing, setBilling] = useState<"monthly" | "yearly" | "lifetime">("monthly");
  const [loading, setLoading] = useState(false);

  const plans = mode === "plus"
    ? { monthly: PLANS.plus_monthly, yearly: PLANS.plus_yearly, lifetime: PLANS.plus_lifetime }
    : { monthly: PLANS.crew_pro_monthly, yearly: PLANS.crew_pro_yearly, lifetime: null };

  const features = mode === "plus" ? PLUS_FEATURES : CREW_PRO_FEATURES;
  const active = plans[billing] || plans.yearly;
  const accent = mode === "plus" ? "#22D1C3" : "#FF2D78";

  async function purchase() {
    setLoading(true);
    try {
      const { data, error } = await sb.from("purchases").insert({
        user_id: userId,
        crew_id: crewId,
        product_sku: active.sku,
        product_name: active.name,
        amount_cents: active.price,
        currency: "EUR",
        status: "pending",
      }).select("id").single();
      if (error) throw error;

      // Simulation: Stripe-Checkout folgt später.
      // Für Demo: sofort als completed markieren + Premium gewähren
      const expiresAt = active.duration_days
        ? new Date(Date.now() + active.duration_days * 86400000).toISOString()
        : null;
      await sb.from("purchases").update({ status: "completed", applied_at: new Date().toISOString() }).eq("id", data.id);
      if (mode === "plus" && userId) {
        await sb.from("users").update({
          premium_tier: active.sku === "plus_lifetime" ? "lifetime" : "plus",
          premium_expires_at: expiresAt,
          streak_freezes_remaining: 3,
        }).eq("id", userId);
      }
      if (mode === "crew" && crewId) {
        await sb.from("crews").update({
          plan: "pro",
          plan_expires_at: expiresAt,
        }).eq("id", crewId);
      }
      appAlert("Upgrade aktiv! (Stripe-Integration folgt — hier nur Demo.)");
      onClose();
      location.reload();
    } catch (e) {
      appAlert("Fehler: " + (e instanceof Error ? e.message : String(e)));
    } finally {
      setLoading(false);
    }
  }

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
                {mode === "plus" ? "MyArea+" : "Crew-Pro"}
              </div>
              <div style={{ fontSize: 11, color: "#a8b4cf" }}>
                {mode === "plus" ? "Werbefrei, mehr Features, Statistik-Pack" : "Mehr Mitglieder, Analytics, Custom-Branding"}
              </div>
            </div>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", color: "#a8b4cf", fontSize: 22, cursor: "pointer" }}>✕</button>
        </div>

        {/* Billing-Toggle */}
        <div style={{ display: "flex", gap: 6, padding: 4, background: "rgba(255,255,255,0.05)", borderRadius: 10, marginBottom: 16 }}>
          <BillingTab active={billing === "monthly"} onClick={() => setBilling("monthly")} accent={accent}>
            Monatlich
          </BillingTab>
          <BillingTab active={billing === "yearly"} onClick={() => setBilling("yearly")} accent={accent}>
            Jährlich
            <span style={{ marginLeft: 4, fontSize: 9, padding: "1px 5px", borderRadius: 4, background: accent, color: "#0F1115" }}>
              -{plans.yearly?.savings_pct ?? 40}%
            </span>
          </BillingTab>
          {plans.lifetime && (
            <BillingTab active={billing === "lifetime"} onClick={() => setBilling("lifetime")} accent={accent}>
              Lifetime
            </BillingTab>
          )}
        </div>

        {/* Preis */}
        <div style={{ textAlign: "center", padding: "14px 0", borderRadius: 14, background: `${accent}15`, border: `1px solid ${accent}44`, marginBottom: 16 }}>
          <div style={{ fontSize: 36, fontWeight: 900, color: accent }}>{formatPrice(active.price)}</div>
          <div style={{ fontSize: 12, color: "#a8b4cf" }}>
            {active.duration_days === 30 && "pro Monat"}
            {active.duration_days === 365 && "pro Jahr"}
            {active.duration_days === null && "einmalig, für immer"}
          </div>
        </div>

        {/* Features */}
        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 18 }}>
          {features.map((f) => (
            <div key={f.title} style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
              <span style={{ fontSize: 18 }}>{f.icon}</span>
              <div>
                <div style={{ fontSize: 13, fontWeight: 800, color: "#FFF" }}>{f.title}</div>
                <div style={{ fontSize: 11, color: "#a8b4cf" }}>{f.desc}</div>
              </div>
            </div>
          ))}
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
          {loading ? "…" : `Für ${formatPrice(active.price)} freischalten`}
        </button>
        <div style={{ textAlign: "center", fontSize: 10, color: "#a8b4cf", marginTop: 8 }}>
          Stripe-Checkout folgt · aktuell Demo-Aktivierung · jederzeit kündbar
        </div>
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
