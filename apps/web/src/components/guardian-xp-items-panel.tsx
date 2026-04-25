"use client";

import { useEffect, useState, useCallback } from "react";

type CatalogItem = {
  id: string;
  name: string;
  emoji: string;
  description: string;
  rarity: "common" | "rare" | "epic";
  xp_amount: number;
  sort: number;
};

type InventoryRow = { item_id: string; count: number };

const RARITY_BG: Record<string, string> = {
  common: "rgba(34,209,195,0.10)",
  rare:   "rgba(168,85,247,0.12)",
  epic:   "rgba(255,215,0,0.12)",
};
const RARITY_BORDER: Record<string, string> = {
  common: "rgba(34,209,195,0.40)",
  rare:   "rgba(168,85,247,0.40)",
  epic:   "rgba(255,215,0,0.40)",
};

export function GuardianXpItemsPanel({ guardianId, onApplied }: { guardianId: string; onApplied?: (xpAdded: number) => void }) {
  const [catalog, setCatalog]   = useState<CatalogItem[]>([]);
  const [inv, setInv]           = useState<Record<string, number>>({});
  const [busy, setBusy]         = useState<string | null>(null);
  const [msg, setMsg]           = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await fetch("/api/guardian/xp-items", { cache: "no-store" });
    if (!res.ok) return;
    const j = await res.json() as { catalog: CatalogItem[]; inventory: InventoryRow[] };
    setCatalog(j.catalog);
    const m: Record<string, number> = {};
    for (const r of j.inventory) m[r.item_id] = r.count;
    setInv(m);
  }, []);

  useEffect(() => { void load(); }, [load]);

  async function apply(itemId: string) {
    setBusy(itemId); setMsg(null);
    try {
      const res = await fetch("/api/guardian/xp-items", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ item_id: itemId, guardian_id: guardianId, count: 1 }),
      });
      const j = await res.json();
      if (!res.ok || j.ok === false) {
        setMsg(`❌ ${j.error ?? "Fehler"}`);
      } else {
        setMsg(`✅ +${j.xp_added} XP`);
        setInv((prev) => ({ ...prev, [itemId]: Math.max(0, (prev[itemId] ?? 0) - 1) }));
        onApplied?.(j.xp_added);
      }
    } finally {
      setBusy(null);
      setTimeout(() => setMsg(null), 2500);
    }
  }

  const ownedCatalog = catalog.filter((c) => (inv[c.id] ?? 0) > 0);
  if (ownedCatalog.length === 0) {
    return (
      <div style={{ padding: 12, borderRadius: 10, background: "rgba(15,17,21,0.6)", border: "1px solid rgba(255,255,255,0.05)" }}>
        <div style={{ color: "#a8b4cf", fontSize: 11, fontWeight: 800, letterSpacing: 1.5 }}>WÄCHTER-XP-ELIXIERE</div>
        <div style={{ color: "#6c7590", fontSize: 11, marginTop: 4 }}>Noch keine — droppen bei Deal-Einlösungen (rare+).</div>
      </div>
    );
  }

  return (
    <div style={{ padding: 10, borderRadius: 10, background: "rgba(15,17,21,0.6)", border: "1px solid rgba(255,255,255,0.05)" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
        <div style={{ color: "#FFD700", fontSize: 11, fontWeight: 900, letterSpacing: 1.5 }}>WÄCHTER-XP-ELIXIERE</div>
        {msg && <div style={{ fontSize: 10, color: msg.startsWith("✅") ? "#4ade80" : "#FF2D78" }}>{msg}</div>}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {ownedCatalog.map((it) => {
          const have = inv[it.id] ?? 0;
          return (
            <div key={it.id} style={{
              display: "flex", alignItems: "center", gap: 8, padding: 8, borderRadius: 8,
              background: RARITY_BG[it.rarity], border: `1px solid ${RARITY_BORDER[it.rarity]}`,
            }}>
              <span style={{ fontSize: 18 }}>{it.emoji}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ color: "#FFF", fontSize: 12, fontWeight: 900 }}>{it.name}</div>
                <div style={{ color: "#a8b4cf", fontSize: 10 }}>+{it.xp_amount} XP · {have}× im Inventar</div>
              </div>
              <button
                onClick={() => void apply(it.id)}
                disabled={busy !== null || have < 1}
                style={{
                  padding: "5px 10px", borderRadius: 8,
                  background: have > 0 ? "linear-gradient(135deg, #22D1C3, #FFD700)" : "rgba(255,255,255,0.06)",
                  color: have > 0 ? "#0F1115" : "#6c7590",
                  border: "none", fontSize: 10, fontWeight: 900,
                  cursor: have > 0 ? "pointer" : "not-allowed",
                }}
              >
                {busy === it.id ? "…" : `+${it.xp_amount} XP`}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
