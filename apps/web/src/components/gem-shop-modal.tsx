"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

type ShopItem = {
  id: string;
  category: "cosmetic" | "booster" | "convenience" | "arena_pass" | "crew_emblem";
  name: string; description: string; icon: string; price_gems: number;
  duration_hours: number | null; payload: Record<string, unknown>; sort: number;
};
type Gems = { user_id: string; gems: number; arena_pass_expires_at: string | null; total_purchased: number; total_spent: number };
type Purchase = { id: string; shop_item_id: string; price_paid_gems: number; expires_at: string | null; created_at: string };
type CategoryKey = "arena_pass" | "booster" | "cosmetic" | "convenience" | "crew_emblem";

const CATEGORY_META: Record<CategoryKey, { label: string; icon: string; accent: string }> = {
  arena_pass:  { label: "Arena-Pass",       icon: "🎫", accent: "#FFD700" },
  booster:     { label: "XP-Booster",       icon: "⚡", accent: "#22D1C3" },
  cosmetic:    { label: "Skins & Designs",  icon: "✨", accent: "#a855f7" },
  convenience: { label: "Komfort",          icon: "🎯", accent: "#5ddaf0" },
  crew_emblem: { label: "Crew-Anpassung",   icon: "🏳️", accent: "#FF6B4A" },
};

export function GemShopModal({ onClose }: { onClose: () => void }) {
  const [items, setItems] = useState<ShopItem[]>([]);
  const [gems, setGems] = useState<Gems | null>(null);
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await fetch("/api/shop/gems");
    if (!res.ok) return;
    const data = await res.json();
    setItems(data.items ?? []); setGems(data.gems ?? null); setPurchases(data.purchases ?? []);
  }, []);
  useEffect(() => { void load(); }, [load]);

  const grouped = useMemo(() => {
    const map: Record<CategoryKey, ShopItem[]> = { arena_pass: [], booster: [], cosmetic: [], convenience: [], crew_emblem: [] };
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
      if (json.ok) { setToast("Kauf erfolgreich!"); await load(); }
      else setToast(json.error === "not_enough_gems" ? `Nicht genug Edelsteine (${json.have}/${json.need})` : (json.error ?? "Kauf fehlgeschlagen"));
    } finally {
      setBusy(null);
      setTimeout(() => setToast(null), 3000);
    }
  }

  async function devTopup() {
    await fetch("/api/shop/gems", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "topup", gems: 1000 }) });
    await load();
  }

  return (
    <div onClick={onClose} style={{
      position: "fixed", inset: 0, zIndex: 3700,
      background: "rgba(15,17,21,0.92)", backdropFilter: "blur(14px)",
      display: "flex", alignItems: "center", justifyContent: "center", padding: 16,
    }}>
      <div onClick={(e) => e.stopPropagation()} style={{
        width: "100%", maxWidth: 640, maxHeight: "92vh", display: "flex", flexDirection: "column",
        background: "#1A1D23", borderRadius: 20, border: "1px solid rgba(255,215,0,0.5)",
        boxShadow: "0 0 40px rgba(255,215,0,0.25)", color: "#F0F0F0", overflow: "hidden",
      }}>
        {/* Header */}
        <div style={{
          padding: "12px 16px", display: "flex", alignItems: "center", gap: 10,
          background: "linear-gradient(180deg, rgba(255,215,0,0.15), transparent)",
          borderBottom: "1px solid rgba(255,215,0,0.25)",
        }}>
          <div style={{ flex: 1 }}>
            <div style={{ color: "#FFD700", fontSize: 9, fontWeight: 900, letterSpacing: 2 }}>EDELSTEIN-SHOP</div>
            <div style={{ color: "#FFF", fontSize: 15, fontWeight: 900 }}>Fair-Play · kein Pay-to-Win</div>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", color: "#8B8FA3", fontSize: 22, cursor: "pointer", width: 32, height: 32 }}>×</button>
        </div>

        {/* Balance */}
        <div style={{
          margin: 14, padding: 12, borderRadius: 12,
          background: "linear-gradient(135deg, rgba(255,215,0,0.18), rgba(255,107,74,0.08))",
          border: "1px solid rgba(255,215,0,0.4)",
          display: "flex", alignItems: "center", gap: 12,
        }}>
          <div style={{ fontSize: 32 }}>💎</div>
          <div style={{ flex: 1 }}>
            <div style={{ color: "#FFD700", fontSize: 9, fontWeight: 900, letterSpacing: 2 }}>DEIN STAND</div>
            <div style={{ color: "#FFF", fontSize: 22, fontWeight: 900 }}>{gems?.gems ?? 0}</div>
          </div>
          <button onClick={devTopup} style={{
            padding: "6px 10px", borderRadius: 10,
            background: "rgba(255,255,255,0.1)", border: "1px solid rgba(255,255,255,0.2)",
            color: "#FFF", fontSize: 11, fontWeight: 800, cursor: "pointer",
          }}>+ 1000 (Dev)</button>
        </div>

        {/* Kategorien */}
        <div style={{ flex: 1, overflowY: "auto", padding: "0 14px 14px" }}>
          <div style={{ marginBottom: 10, padding: 8, borderRadius: 8, background: "rgba(34,209,195,0.08)", border: "1px dashed rgba(34,209,195,0.3)", fontSize: 11, color: "#a8b4cf" }}>
            <b style={{ color: "#22D1C3" }}>Fair-Play:</b> Edelsteine kaufen nur Skins, Booster, Komfort. Siegel, Wächter, XP — nur durchs Gehen.
          </div>
          {(Object.keys(CATEGORY_META) as CategoryKey[]).map((cat) => {
            const meta = CATEGORY_META[cat];
            const list = grouped[cat];
            if (list.length === 0) return null;
            return (
              <section key={cat} style={{ marginBottom: 14 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                  <span style={{ fontSize: 16 }}>{meta.icon}</span>
                  <div style={{ color: meta.accent, fontSize: 10, fontWeight: 900, letterSpacing: 1.5 }}>{meta.label.toUpperCase()}</div>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {list.map((i) => {
                    const owned = activePurchaseIds.has(i.id);
                    const cantAfford = (gems?.gems ?? 0) < i.price_gems;
                    return (
                      <div key={i.id} style={{
                        display: "flex", alignItems: "center", gap: 8, padding: 10, borderRadius: 10,
                        background: "rgba(26,29,35,0.9)",
                        border: `1px solid ${owned ? meta.accent : "rgba(255,255,255,0.08)"}`,
                      }}>
                        <div style={{ width: 38, height: 38, borderRadius: 10, background: `${meta.accent}22`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22 }}>{i.icon}</div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ color: "#FFF", fontSize: 12, fontWeight: 900 }}>{i.name}</div>
                          <div style={{ color: "#a8b4cf", fontSize: 10, marginTop: 1, lineHeight: 1.3 }}>{i.description}</div>
                        </div>
                        <button
                          onClick={() => !owned && !cantAfford && purchase(i.id)}
                          disabled={owned || cantAfford || busy === i.id}
                          style={{
                            padding: "7px 10px", borderRadius: 10,
                            background: owned ? "rgba(74,222,128,0.15)" : cantAfford ? "rgba(255,255,255,0.06)" : `linear-gradient(135deg, ${meta.accent}, #FFD700)`,
                            color: owned ? "#4ade80" : cantAfford ? "#6c7590" : "#0F1115",
                            border: owned ? "1px solid rgba(74,222,128,0.4)" : "none",
                            fontSize: 10, fontWeight: 900,
                            cursor: owned || cantAfford ? "not-allowed" : "pointer",
                            whiteSpace: "nowrap",
                          }}>
                          {owned ? "✓ Aktiv" : `💎 ${i.price_gems}`}
                        </button>
                      </div>
                    );
                  })}
                </div>
              </section>
            );
          })}
        </div>

        {toast && (
          <div style={{
            position: "absolute", bottom: 20, left: "50%", transform: "translateX(-50%)",
            padding: "8px 12px", borderRadius: 10,
            background: "rgba(15,17,21,0.95)", border: "1px solid rgba(255,215,0,0.4)",
            color: "#FFF", fontSize: 11, fontWeight: 800, zIndex: 100,
          }}>{toast}</div>
        )}
      </div>
    </div>
  );
}
