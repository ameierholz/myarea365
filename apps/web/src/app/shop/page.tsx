"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations, useLocale } from "next-intl";
import { getDateLocale } from "@/i18n/config";

type ShopItem = {
  id: string;
  category: "cosmetic" | "booster" | "convenience" | "arena_pass" | "crew_emblem";
  name: string;
  description: string;
  icon: string;
  price_gems: number;
  duration_hours: number | null;
  payload: Record<string, unknown>;
  sort: number;
};

type Gems = {
  user_id: string;
  gems: number;
  arena_pass_expires_at: string | null;
  total_purchased: number;
  total_spent: number;
};

type Purchase = { id: string; shop_item_id: string; price_paid_gems: number; expires_at: string | null; created_at: string };

type CategoryKey = "arena_pass" | "booster" | "cosmetic" | "convenience" | "crew_emblem";

const CATEGORY_DEFS: Array<{ id: CategoryKey; icon: string; accent: string; labelKey: "catArenaPass" | "catBooster" | "catCosmetic" | "catConvenience" | "catCrewEmblem" }> = [
  { id: "arena_pass",  icon: "🎫", accent: "#FFD700", labelKey: "catArenaPass" },
  { id: "booster",     icon: "⚡", accent: "#22D1C3", labelKey: "catBooster" },
  { id: "cosmetic",    icon: "✨", accent: "#a855f7", labelKey: "catCosmetic" },
  { id: "convenience", icon: "🎯", accent: "#5ddaf0", labelKey: "catConvenience" },
  { id: "crew_emblem", icon: "🏳️", accent: "#FF6B4A", labelKey: "catCrewEmblem" },
];

export default function ShopPage() {
  const t = useTranslations("ShopGems");
  const locale = useLocale();
  const dateLocale = getDateLocale(locale);
  const router = useRouter();
  const [items, setItems] = useState<ShopItem[]>([]);
  const [gems, setGems] = useState<Gems | null>(null);
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await fetch("/api/shop/gems");
    if (!res.ok) return;
    const data = await res.json();
    setItems(data.items ?? []);
    setGems(data.gems ?? null);
    setPurchases(data.purchases ?? []);
  }, []);

  useEffect(() => { void load(); }, [load]);

  const grouped = useMemo(() => {
    const map: Record<CategoryKey, ShopItem[]> = {
      arena_pass: [], booster: [], cosmetic: [], convenience: [], crew_emblem: [],
    };
    for (const i of items) map[i.category].push(i);
    return map;
  }, [items]);

  const activePurchaseIds = useMemo(
    () => new Set(purchases.filter((p) => !p.expires_at || new Date(p.expires_at) > new Date()).map((p) => p.shop_item_id)),
    [purchases],
  );

  async function purchase(itemId: string) {
    setBusy(itemId);
    try {
      const res = await fetch("/api/shop/gems", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "purchase", item_id: itemId }),
      });
      const json = await res.json() as { ok?: boolean; error?: string; have?: number; need?: number };
      if (json.ok) { setToast(t("toastSuccess")); await load(); }
      else setToast(json.error === "not_enough_gems" ? t("toastNotEnough", { have: json.have ?? 0, need: json.need ?? 0 }) : (json.error ?? t("toastFailed")));
    } finally {
      setBusy(null);
      setTimeout(() => setToast(null), 3000);
    }
  }

  async function devTopup() {
    await fetch("/api/shop/gems", {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "topup", gems: 1000 }),
    });
    await load();
  }

  return (
    <div style={{ minHeight: "100vh", background: "#0F1115", color: "#F0F0F0", paddingBottom: 40 }}>
      <div style={{
        padding: "12px 14px",
        display: "flex", alignItems: "center", gap: 10,
        background: "linear-gradient(180deg, rgba(255,215,0,0.12), transparent)",
        borderBottom: "1px solid rgba(255,215,0,0.25)",
      }}>
        <button onClick={() => router.back()} style={{
          background: "rgba(255,255,255,0.08)", border: "none", color: "#FFF",
          width: 34, height: 34, borderRadius: 999, cursor: "pointer", fontSize: 16,
        }}>←</button>
        <div style={{ flex: 1 }}>
          <div style={{ color: "#FFD700", fontSize: 9, fontWeight: 900, letterSpacing: 2 }}>{t("headerKicker")}</div>
          <div style={{ color: "#FFF", fontSize: 16, fontWeight: 900 }}>{t("headerTitle")}</div>
        </div>
      </div>

      <div style={{
        margin: 14, padding: 14, borderRadius: 14,
        background: "linear-gradient(135deg, rgba(255,215,0,0.18), rgba(255,107,74,0.08))",
        border: "1px solid rgba(255,215,0,0.4)",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ fontSize: 40 }}>💎</div>
          <div style={{ flex: 1 }}>
            <div style={{ color: "#FFD700", fontSize: 9, fontWeight: 900, letterSpacing: 2 }}>{t("balanceLabel")}</div>
            <div style={{ color: "#FFF", fontSize: 28, fontWeight: 900 }}>{gems?.gems ?? 0}</div>
          </div>
          <button onClick={devTopup} style={{
            padding: "8px 12px", borderRadius: 10,
            background: "rgba(255,255,255,0.1)", border: "1px solid rgba(255,255,255,0.2)",
            color: "#FFF", fontSize: 11, fontWeight: 800, cursor: "pointer",
          }}>{t("devTopup")}</button>
        </div>
        {gems?.arena_pass_expires_at && new Date(gems.arena_pass_expires_at) > new Date() && (
          <div style={{ marginTop: 8, padding: 8, borderRadius: 8, background: "rgba(34,209,195,0.12)", border: "1px solid rgba(34,209,195,0.4)", fontSize: 11 }}>
            {t("passActive", { date: new Date(gems.arena_pass_expires_at).toLocaleDateString(dateLocale) })}
          </div>
        )}
      </div>

      <div style={{ margin: "0 14px 14px", padding: 10, borderRadius: 10, background: "rgba(34,209,195,0.08)", border: "1px dashed rgba(34,209,195,0.3)", fontSize: 11, color: "#a8b4cf", lineHeight: 1.5 }}>
        <b style={{ color: "#22D1C3" }}>{t("fairplayLead")}</b>{t("fairplayBody")}
      </div>

      {CATEGORY_DEFS.map((cd) => {
        const list = grouped[cd.id];
        if (list.length === 0) return null;
        return (
          <section key={cd.id} style={{ margin: "0 14px 16px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
              <span style={{ fontSize: 18 }}>{cd.icon}</span>
              <div style={{ color: cd.accent, fontSize: 11, fontWeight: 900, letterSpacing: 1.5 }}>{t(cd.labelKey).toUpperCase()}</div>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {list.map((i) => {
                const owned = activePurchaseIds.has(i.id);
                const cantAfford = (gems?.gems ?? 0) < i.price_gems;
                return (
                  <div key={i.id} style={{
                    display: "flex", alignItems: "center", gap: 10, padding: 12, borderRadius: 12,
                    background: "rgba(26,29,35,0.9)",
                    border: `1px solid ${owned ? cd.accent : "rgba(255,255,255,0.08)"}`,
                  }}>
                    <div style={{
                      width: 44, height: 44, borderRadius: 10,
                      background: `${cd.accent}22`,
                      display: "flex", alignItems: "center", justifyContent: "center",
                      fontSize: 24,
                    }}>{i.icon}</div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ color: "#FFF", fontSize: 13, fontWeight: 900 }}>{i.name}</div>
                      <div style={{ color: "#a8b4cf", fontSize: 11, marginTop: 2, lineHeight: 1.3 }}>{i.description}</div>
                    </div>
                    <button
                      onClick={() => !owned && !cantAfford && purchase(i.id)}
                      disabled={owned || cantAfford || busy === i.id}
                      style={{
                        padding: "8px 12px", borderRadius: 10,
                        background: owned ? "rgba(74,222,128,0.15)"
                          : cantAfford ? "rgba(255,255,255,0.06)"
                          : `linear-gradient(135deg, ${cd.accent}, #FFD700)`,
                        color: owned ? "#4ade80" : cantAfford ? "#6c7590" : "#0F1115",
                        border: owned ? "1px solid rgba(74,222,128,0.4)" : "none",
                        fontSize: 11, fontWeight: 900,
                        cursor: owned || cantAfford ? "not-allowed" : "pointer",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {owned ? t("btnOwned") : t("btnPrice", { price: i.price_gems })}
                    </button>
                  </div>
                );
              })}
            </div>
          </section>
        );
      })}

      {toast && (
        <div style={{
          position: "fixed", bottom: 20, left: "50%", transform: "translateX(-50%)",
          padding: "10px 14px", borderRadius: 10,
          background: "rgba(15,17,21,0.95)", border: "1px solid rgba(255,215,0,0.4)",
          color: "#FFF", fontSize: 12, fontWeight: 800, zIndex: 100,
        }}>{toast}</div>
      )}
    </div>
  );
}
