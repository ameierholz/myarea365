"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { BOOST_PACKS, EXTRAS, formatPrice } from "@/lib/monetization";

export function BoostShopModal({ userId, onClose }: { userId: string; onClose: () => void }) {
  const sb = createClient();
  const [tab, setTab] = useState<"boosts" | "extras">("boosts");
  const [loading, setLoading] = useState<string | null>(null);

  async function buy(sku: string, name: string, price: number) {
    setLoading(sku);
    try {
      const { data, error } = await sb.from("purchases").insert({
        user_id: userId, product_sku: sku, product_name: name, amount_cents: price, status: "pending",
      }).select("id").single();
      if (error) throw error;
      await sb.from("purchases").update({ status: "completed", applied_at: new Date().toISOString() }).eq("id", data.id);

      // Effekt anwenden (Demo: direkt freischalten)
      if (sku.startsWith("boost_")) {
        const pack = (BOOST_PACKS as Record<string, { hours: number; multiplier: number }>)[sku];
        if (pack) {
          await sb.from("users").update({
            xp_boost_until: new Date(Date.now() + pack.hours * 3600 * 1000).toISOString(),
            xp_boost_multiplier: pack.multiplier,
          }).eq("id", userId);
        }
      } else if (sku === "streak_pack_5") {
        const { data: u } = await sb.from("users").select("streak_freezes_remaining").eq("id", userId).single();
        await sb.from("users").update({
          streak_freezes_remaining: (u?.streak_freezes_remaining ?? 0) + 5,
        }).eq("id", userId);
      }

      alert("Gekauft + aktiviert! (Stripe-Integration folgt)");
      onClose();
      location.reload();
    } catch (e) {
      alert("Fehler: " + (e instanceof Error ? e.message : String(e)));
    } finally {
      setLoading(null);
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
          width: "100%", maxWidth: 520, maxHeight: "85vh", overflowY: "auto",
          background: "#1A1D23", border: "1px solid rgba(255,215,0,0.4)", borderRadius: "20px 20px 0 0",
          padding: 24, color: "#F0F0F0",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ fontSize: 24 }}>⚡</span>
            <div>
              <div style={{ fontSize: 18, fontWeight: 900 }}>Power-Shop</div>
              <div style={{ fontSize: 11, color: "#a8b4cf" }}>XP-Boosts & Extras</div>
            </div>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", color: "#a8b4cf", fontSize: 22, cursor: "pointer" }}>✕</button>
        </div>

        <div style={{ display: "flex", gap: 6, padding: 4, background: "rgba(255,255,255,0.05)", borderRadius: 10, marginBottom: 14 }}>
          <TabBtn active={tab === "boosts"} onClick={() => setTab("boosts")}>⚡ XP-Boosts</TabBtn>
          <TabBtn active={tab === "extras"} onClick={() => setTab("extras")}>🎁 Extras</TabBtn>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {(tab === "boosts" ? Object.values(BOOST_PACKS) : Object.values(EXTRAS)).map((p) => {
            const desc = "hours" in p && "multiplier" in p ? `${p.multiplier}× XP · ${p.hours} h` : "";
            return (
              <div key={p.sku} style={{
                display: "flex", alignItems: "center", gap: 10,
                padding: 12, borderRadius: 12,
                background: "rgba(70, 82, 122, 0.45)",
                border: "1px solid rgba(255,255,255,0.1)",
              }}>
                <span style={{ fontSize: 22 }}>{tab === "boosts" ? "⚡" : "🎁"}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ color: "#FFF", fontSize: 13, fontWeight: 800 }}>{p.name}</div>
                  {desc && <div style={{ color: "#a8b4cf", fontSize: 10 }}>{desc}</div>}
                </div>
                <button
                  onClick={() => buy(p.sku, p.name, p.price)}
                  disabled={loading === p.sku}
                  style={{
                    background: "#FFD700", color: "#0F1115",
                    padding: "6px 14px", borderRadius: 8, border: "none", cursor: "pointer",
                    fontSize: 12, fontWeight: 900,
                    opacity: loading === p.sku ? 0.6 : 1,
                  }}
                >
                  {loading === p.sku ? "…" : formatPrice(p.price)}
                </button>
              </div>
            );
          })}
        </div>

        <div style={{ textAlign: "center", fontSize: 10, color: "#a8b4cf", marginTop: 12 }}>
          Stripe-Integration folgt · aktuell Demo-Aktivierung
        </div>
      </div>
    </div>
  );
}

function TabBtn({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick} style={{
      flex: 1, padding: "8px 10px", borderRadius: 8, border: "none", cursor: "pointer",
      background: active ? "#FFD700" : "transparent",
      color: active ? "#0F1115" : "#F0F0F0",
      fontSize: 12, fontWeight: 800,
    }}>{children}</button>
  );
}
