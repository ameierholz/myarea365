"use client";

import { useCallback, useEffect, useState } from "react";

type CatalogEntry = {
  id: string;
  name: string;
  icon: string;
  description: string;
  rarity: "common" | "rare" | "epic";
  effect_key: string;
  effect_value: number;
  duration_min: number;
};

type InventoryEntry = {
  id: string;
  potion_id: string;
  acquired_at: string;
  activated_at: string | null;
  expires_at: string | null;
  used_at: string | null;
};

const RARITY_META: Record<CatalogEntry["rarity"], { label: string; color: string; glow: string }> = {
  common: { label: "GEWÖHNLICH", color: "#a8b4cf", glow: "rgba(168,180,207,0.25)" },
  rare:   { label: "SELTEN",     color: "#5ddaf0", glow: "rgba(93,218,240,0.35)" },
  epic:   { label: "EPISCH",     color: "#a855f7", glow: "rgba(168,85,247,0.45)" },
};

export function PotionInventoryModal({ onClose }: { onClose: () => void }) {
  const [catalog, setCatalog] = useState<Record<string, CatalogEntry>>({});
  const [inventory, setInventory] = useState<InventoryEntry[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [now, setNow] = useState(Date.now());

  const load = useCallback(async () => {
    const r = await fetch("/api/arena/potions");
    if (!r.ok) return;
    const j = await r.json() as { catalog: CatalogEntry[]; inventory: InventoryEntry[] };
    const map: Record<string, CatalogEntry> = {};
    for (const c of j.catalog) map[c.id] = c;
    setCatalog(map);
    setInventory(j.inventory);
  }, []);
  useEffect(() => { void load(); }, [load]);

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  async function activate(instanceId: string) {
    setBusy(instanceId);
    try {
      const r = await fetch("/api/arena/potions", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "activate", instance_id: instanceId }),
      });
      const j = await r.json() as { ok?: boolean; error?: string };
      if (j.ok) { setToast("🧪 Trank aktiviert — 1h Haltbarkeit"); await load(); }
      else setToast(j.error ?? "Fehler");
    } finally {
      setBusy(null);
      setTimeout(() => setToast(null), 2600);
    }
  }

  const active = inventory.filter((i) => i.activated_at && i.expires_at && new Date(i.expires_at).getTime() > now);
  const stored = inventory.filter((i) => !i.activated_at);

  return (
    <div onClick={onClose} style={{
      position: "fixed", inset: 0, zIndex: 4500,
      background: "rgba(15,17,21,0.88)", backdropFilter: "blur(10px)",
      display: "flex", alignItems: "center", justifyContent: "center", padding: 16,
    }}>
      <div onClick={(e) => e.stopPropagation()} style={{
        width: "100%", maxWidth: 600, maxHeight: "92vh",
        display: "flex", flexDirection: "column",
        background: "#141a2d", borderRadius: 20,
        border: "1px solid rgba(168,85,247,0.4)",
        color: "#F0F0F0", overflow: "hidden",
      }}>
        <div style={{ padding: "14px 18px", display: "flex", alignItems: "center", gap: 10, borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
          <span style={{ fontSize: 24 }}>🧪</span>
          <div style={{ flex: 1 }}>
            <div style={{ color: "#a855f7", fontSize: 9, fontWeight: 900, letterSpacing: 2 }}>ARENA</div>
            <div style={{ color: "#FFF", fontSize: 16, fontWeight: 900 }}>Trank-Inventar</div>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", color: "#8B8FA3", fontSize: 22, cursor: "pointer", width: 32, height: 32 }}>×</button>
        </div>

        <div style={{ flex: 1, overflowY: "auto", padding: 16, display: "flex", flexDirection: "column", gap: 14 }}>
          <div style={{
            padding: 10, borderRadius: 10,
            background: "rgba(168,85,247,0.08)", border: "1px dashed rgba(168,85,247,0.3)",
            fontSize: 11, color: "#a8b4cf", lineHeight: 1.5,
          }}>
            🧪 Tränke geben <b style={{ color: "#FFF" }}>1 Stunde</b> temporären Kampf-Bonus (Arena + Boss). Bei <b style={{ color: "#FF2D78" }}>verlorenem Kampf</b> werden aktive Tränke verbraucht.
          </div>

          {/* Aktive Tränke */}
          <section>
            <div style={{ color: "#4ade80", fontSize: 10, fontWeight: 900, letterSpacing: 1.2, marginBottom: 6 }}>
              ✅ AKTIV ({active.length})
            </div>
            {active.length === 0 ? (
              <div style={{ color: "#8B8FA3", fontSize: 11 }}>Keine aktiven Tränke.</div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {active.map((p) => {
                  const c = catalog[p.potion_id];
                  if (!c) return null;
                  const rm = RARITY_META[c.rarity];
                  const remainMs = new Date(p.expires_at!).getTime() - now;
                  const remainMin = Math.max(0, Math.floor(remainMs / 60000));
                  const remainSec = Math.max(0, Math.floor((remainMs % 60000) / 1000));
                  return (
                    <PotionCard key={p.id} potion={c} rarity={rm} action={
                      <div style={{ color: "#4ade80", fontSize: 11, fontWeight: 800 }}>
                        ⏱️ {remainMin}m {String(remainSec).padStart(2, "0")}s
                      </div>
                    } />
                  );
                })}
              </div>
            )}
          </section>

          {/* Verfügbare Tränke */}
          <section>
            <div style={{ color: "#a855f7", fontSize: 10, fontWeight: 900, letterSpacing: 1.2, marginBottom: 6 }}>
              🎒 INVENTAR ({stored.length})
            </div>
            {stored.length === 0 ? (
              <div style={{ color: "#8B8FA3", fontSize: 11 }}>
                Keine Tränke im Inventar. <br/>
                Erhältlich durch Tagesangebote, Loot-Drops oder Diamanten-Shop.
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {stored.map((p) => {
                  const c = catalog[p.potion_id];
                  if (!c) return null;
                  const rm = RARITY_META[c.rarity];
                  return (
                    <PotionCard key={p.id} potion={c} rarity={rm} action={
                      <button
                        onClick={() => activate(p.id)}
                        disabled={busy === p.id}
                        style={{
                          padding: "6px 10px", borderRadius: 8, border: "none", cursor: "pointer",
                          background: `linear-gradient(135deg, ${rm.color}, #FFD700)`,
                          color: "#0F1115", fontSize: 11, fontWeight: 900,
                          opacity: busy === p.id ? 0.5 : 1,
                        }}
                      >
                        Aktivieren
                      </button>
                    } />
                  );
                })}
              </div>
            )}
          </section>

          {toast && (
            <div style={{
              padding: "8px 12px", borderRadius: 10, textAlign: "center",
              background: "rgba(15,17,21,0.95)", border: "1px solid rgba(168,85,247,0.4)",
              color: "#FFF", fontSize: 11, fontWeight: 800,
            }}>{toast}</div>
          )}
        </div>
      </div>
    </div>
  );
}

function PotionCard({ potion, rarity, action }: {
  potion: CatalogEntry;
  rarity: { label: string; color: string; glow: string };
  action: React.ReactNode;
}) {
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 10,
      padding: 10, borderRadius: 10,
      background: "rgba(26,29,35,0.9)",
      border: `1px solid ${rarity.color}`,
      boxShadow: `0 0 10px ${rarity.glow}`,
    }}>
      <div style={{
        width: 40, height: 40, borderRadius: 10,
        background: `${rarity.color}22`, border: `1px solid ${rarity.color}66`,
        display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, flexShrink: 0,
      }}>{potion.icon}</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ color: "#FFF", fontSize: 12, fontWeight: 900 }}>{potion.name}</span>
          <span style={{
            fontSize: 8, fontWeight: 900, letterSpacing: 0.5,
            padding: "1px 5px", borderRadius: 3,
            background: `${rarity.color}22`, color: rarity.color, border: `1px solid ${rarity.color}`,
          }}>{rarity.label}</span>
        </div>
        <div style={{ color: "#a8b4cf", fontSize: 10, marginTop: 2, lineHeight: 1.4 }}>{potion.description}</div>
      </div>
      <div style={{ flexShrink: 0 }}>{action}</div>
    </div>
  );
}
