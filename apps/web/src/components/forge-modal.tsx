"use client";

import { useEffect, useState } from "react";
import { SLOT_META, type ItemSlot } from "@/lib/items";

type Catalog = {
  id: string; name: string; emoji: string; slot: ItemSlot; rarity: string;
  bonus_hp: number; bonus_atk: number; bonus_def: number; bonus_spd: number;
  image_url?: string | null;
};

type Item = {
  id: string; item_id: string; catalog: Catalog; upgrade_tier?: number; equipped?: boolean;
  crafting_target_tier?: number | null;
  crafting_ends_at?: string | null;
};

type Materials = {
  scrap: number; crystal: number; essence: number; relikt: number;
};

type MaterialCatalogEntry = {
  id: string; name: string; emoji: string; image_url: string | null; video_url: string | null;
};

// Hardcoded Defaults — werden vom material_catalog überschrieben sobald der
// Admin eigene Grafiken hochgeladen hat (image_url/video_url auf der Tabelle).
const MATERIAL_META: Array<{ id: keyof Materials; name: string; emoji: string; color: string }> = [
  { id: "scrap",   name: "Schrott",         emoji: "🔩", color: "#8B8FA3" },
  { id: "crystal", name: "Stadtkristall",   emoji: "💎", color: "#22D1C3" },
  { id: "essence", name: "Schatten-Essenz", emoji: "🔮", color: "#a855f7" },
  { id: "relikt",  name: "Relikt-Splitter", emoji: "✨", color: "#FFD700" },
];

/**
 * Render-Helper: zeigt das Custom-Image/Video aus material_catalog,
 * fallback auf das Emoji aus MATERIAL_META.
 */
function MaterialIcon({ id, catalog, size = 22 }: { id: keyof Materials; catalog: MaterialCatalogEntry[] | null; size?: number }) {
  const cat = catalog?.find((c) => c.id === id);
  if (cat?.video_url) {
    return <video src={cat.video_url} autoPlay loop muted playsInline style={{ width: size, height: size, objectFit: "contain" }} />;
  }
  if (cat?.image_url) {
    return <img src={cat.image_url} alt={cat.name} style={{ width: size, height: size, objectFit: "contain" }} />;
  }
  const meta = MATERIAL_META.find((m) => m.id === id);
  return <span style={{ fontSize: size, lineHeight: 1 }}>{cat?.emoji ?? meta?.emoji ?? "❓"}</span>;
}

const TIER_META = [
  { color: "#8B8FA3", name: "GRAU",  next: "GRÜN" },
  { color: "#4ade80", name: "GRÜN",  next: "LILA" },
  { color: "#a855f7", name: "LILA",  next: "GOLD" },
  { color: "#FFD700", name: "GOLD",  next: null   },
];

const UPGRADE_COST: Array<Record<string, number>> = [
  { scrap: 8 },
  { scrap: 2, crystal: 6 },
  { crystal: 3, essence: 5 },
];

// Muss mit packages/supabase/migrations/00053 forge_duration_seconds() matchen.
const FORGE_DURATION_HOURS: number[] = [0, 4, 12];

function formatRemaining(ms: number): string {
  if (ms <= 0) return "fertig";
  const totalSec = Math.ceil(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  if (h > 0) return `${h}h ${m.toString().padStart(2, "0")}m`;
  if (m > 0) return `${m}m ${s.toString().padStart(2, "0")}s`;
  return `${s}s`;
}

export function ForgeModal({ items, onClose, onUpgraded }: {
  items: Item[];
  onClose: () => void;
  onUpgraded: () => void | Promise<void>;
}) {
  const [materials, setMaterials] = useState<Materials | null>(null);
  const [catalog, setCatalog] = useState<MaterialCatalogEntry[] | null>(null);
  const [filterSlot, setFilterSlot] = useState<ItemSlot | "ALL">("ALL");
  const [forgingId, setForgingId] = useState<string | null>(null);
  const [successId, setSuccessId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function loadMaterials() {
    const res = await fetch("/api/guardian/materials", { cache: "no-store" });
    if (res.ok) {
      const j = await res.json() as Materials & { catalog?: MaterialCatalogEntry[] };
      setMaterials({ scrap: j.scrap, crystal: j.crystal, essence: j.essence, relikt: j.relikt });
      if (Array.isArray(j.catalog)) setCatalog(j.catalog);
    }
  }
  useEffect(() => { void loadMaterials(); }, []);

  async function forge(itemId: string) {
    setForgingId(itemId);
    setError(null);
    // Kurze Animations-Verzögerung
    await new Promise((r) => setTimeout(r, 1200));
    try {
      const res = await fetch("/api/guardian/upgrade", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ user_item_id: itemId }),
      });
      const j = await res.json();
      if (!j.ok) {
        const errorMsg = j.error === "not_enough_materials" ? "Nicht genug Materialien."
          : j.error === "already_crafting" ? "Schmiedet bereits — warte bis fertig."
          : j.error ?? "Fehler";
        setError(errorMsg);
        setForgingId(null);
        return;
      }
      // Instant (Tier 0→1): Success-Animation zeigen
      if (j.instant) {
        setSuccessId(itemId);
        await loadMaterials();
        await onUpgraded();
        setTimeout(() => { setForgingId(null); setSuccessId(null); }, 1600);
      } else {
        // Zeit-Gate: Parent neu laden (zeigt Timer), keine Success-Animation
        await loadMaterials();
        await onUpgraded();
        setForgingId(null);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unbekannter Fehler");
      setForgingId(null);
    }
  }

  async function finalize(itemId: string) {
    setError(null);
    try {
      const res = await fetch("/api/guardian/finalize", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ user_item_id: itemId }),
      });
      const j = await res.json();
      if (!j.ok) {
        setError(j.error === "still_crafting" ? "Noch nicht fertig." : j.error ?? "Fehler");
        return;
      }
      setSuccessId(itemId);
      await onUpgraded();
      setTimeout(() => { setSuccessId(null); }, 1600);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unbekannter Fehler");
    }
  }

  const filtered = filterSlot === "ALL" ? items : items.filter((i) => i.catalog.slot === filterSlot);

  return (
    <div onClick={onClose} style={{
      position: "fixed", inset: 0, zIndex: 3800,
      background: "rgba(15,17,21,0.95)", backdropFilter: "blur(14px)",
      display: "flex", alignItems: "center", justifyContent: "center", padding: 16,
    }}>
      <div onClick={(e) => e.stopPropagation()} style={{
        width: "100%", maxWidth: 640, maxHeight: "92vh", overflow: "hidden",
        background: "radial-gradient(ellipse at top, rgba(255,107,74,0.18), #0F1115 70%)",
        borderRadius: 20,
        border: "1px solid rgba(255,107,74,0.45)",
        boxShadow: "0 20px 60px rgba(0,0,0,0.8), 0 0 60px rgba(255,107,74,0.25)",
        color: "#F0F0F0",
        display: "flex", flexDirection: "column",
      }}>
        {/* Header */}
        <div style={{
          padding: "18px 20px 14px",
          borderBottom: "1px solid rgba(255,107,74,0.25)",
          background: "linear-gradient(180deg, rgba(255,107,74,0.12), transparent)",
          display: "flex", alignItems: "center", gap: 12,
        }}>
          <div style={{ fontSize: 40, animation: "forgeFlicker 1.2s ease-in-out infinite" }}>🔥</div>
          <div style={{ flex: 1 }}>
            <div style={{ color: "#FF6B4A", fontSize: 11, fontWeight: 900, letterSpacing: 2 }}>SCHMIEDE</div>
            <div style={{ color: "#FFF", fontSize: 18, fontWeight: 900 }}>Veredle deine Ausrüstung</div>
          </div>
          <button onClick={onClose} style={{ background: "rgba(255,255,255,0.08)", border: "none", color: "#a8b4cf", width: 32, height: 32, borderRadius: 999, cursor: "pointer", fontSize: 16 }}>✕</button>
        </div>

        {/* Material-Balance */}
        <div style={{
          display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8,
          padding: "14px 16px",
          borderBottom: "1px solid rgba(255,255,255,0.06)",
          background: "rgba(0,0,0,0.2)",
        }}>
          {MATERIAL_META.map((m) => {
            const qty = materials?.[m.id] ?? 0;
            return (
              <div key={m.id} style={{
                padding: "8px 6px", borderRadius: 10, textAlign: "center",
                background: `${m.color}12`, border: `1px solid ${m.color}33`,
              }}>
                <div style={{ height: 22, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <MaterialIcon id={m.id} catalog={catalog} size={22} />
                </div>
                <div style={{ color: m.color, fontSize: 15, fontWeight: 900, marginTop: 4 }}>{qty.toLocaleString("de-DE")}</div>
                <div style={{ color: "#a8b4cf", fontSize: 8.5, letterSpacing: 0.5, marginTop: 2 }}>{m.name}</div>
              </div>
            );
          })}
        </div>

        {/* Filter */}
        <div style={{ padding: "10px 16px", display: "flex", gap: 4, flexWrap: "wrap", borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
          <FilterChip label="Alle" active={filterSlot === "ALL"} onClick={() => setFilterSlot("ALL")} />
          {(["helm","chest","shoulders","hands","boots","wrist","neck","ring","weapon"] as ItemSlot[]).map((s) => (
            <FilterChip key={s} label={`${SLOT_META[s].icon} ${SLOT_META[s].label}`} active={filterSlot === s} onClick={() => setFilterSlot(s)} />
          ))}
        </div>

        {/* Item-Liste (scrollable) */}
        <div style={{ flex: 1, overflowY: "auto", padding: "12px 16px" }}>
          {filtered.length === 0 ? (
            <div style={{ padding: 40, textAlign: "center", color: "#8B8FA3" }}>
              Kein Item für diesen Slot. Lauf Gebiete ab und gewinn Kämpfe, um Ausrüstung zu finden.
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {filtered.map((it) => (
                <ForgeItemRow
                  key={it.id}
                  item={it}
                  materials={materials}
                  catalog={catalog}
                  forging={forgingId === it.id}
                  success={successId === it.id}
                  onForge={() => forge(it.id)}
                  onFinalize={() => finalize(it.id)}
                />
              ))}
            </div>
          )}
        </div>

        {error && (
          <div style={{ padding: "8px 16px", background: "rgba(255,45,120,0.15)", color: "#FF2D78", fontSize: 12, fontWeight: 800, textAlign: "center" }}>
            ⚠️ {error}
          </div>
        )}
      </div>

      <style>{`
        @keyframes forgeFlicker {
          0%, 100% { transform: scale(1)    rotate(-2deg); filter: brightness(1.1); }
          50%      { transform: scale(1.08) rotate(2deg);  filter: brightness(1.4); }
        }
        @keyframes forgeHammer {
          0%, 100% { transform: rotate(0)      translateY(0); }
          20%      { transform: rotate(-35deg) translateY(-10px); }
          40%      { transform: rotate(10deg)  translateY(4px); }
          60%      { transform: rotate(-20deg) translateY(-6px); }
          80%      { transform: rotate(5deg)   translateY(2px); }
        }
        @keyframes forgeSparks {
          0%   { opacity: 0; transform: scale(0); }
          30%  { opacity: 1; transform: scale(1); }
          100% { opacity: 0; transform: scale(2.2); }
        }
        @keyframes forgeGlow {
          0%, 100% { box-shadow: 0 0 20px rgba(255,107,74,0.4); }
          50%      { box-shadow: 0 0 40px rgba(255,215,0,0.8), 0 0 80px rgba(255,107,74,0.6); }
        }
        @keyframes forgeSuccess {
          0%   { transform: scale(0.4) rotate(-15deg); opacity: 0; }
          50%  { transform: scale(1.3) rotate(4deg);   opacity: 1; }
          100% { transform: scale(1)   rotate(0);      opacity: 1; }
        }
        @keyframes forgeRise {
          0%   { transform: translateY(100%); opacity: 0; }
          100% { transform: translateY(0);    opacity: 1; }
        }
      `}</style>
    </div>
  );
}

function ForgeItemRow({ item, materials, catalog, forging, success, onForge, onFinalize }: {
  item: Item;
  materials: Materials | null;
  catalog: MaterialCatalogEntry[] | null;
  forging: boolean;
  success: boolean;
  onForge: () => void;
  onFinalize: () => void;
}) {
  const tier = item.upgrade_tier ?? 0;
  const tierM = TIER_META[tier];
  const nextTier = TIER_META[tier + 1];
  const cost = UPGRADE_COST[tier];
  const maxed = tier >= 3;
  const hasMaterials = !maxed && cost && materials && Object.entries(cost).every(
    ([k, v]) => (materials[k as keyof Materials] ?? 0) >= (v as number),
  );

  const crafting = !!item.crafting_target_tier && !!item.crafting_ends_at;
  const craftEndsAt = item.crafting_ends_at ? new Date(item.crafting_ends_at).getTime() : 0;
  const [now, setNow] = useState<number>(() => Date.now());
  useEffect(() => {
    if (!crafting) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [crafting]);
  const craftRemainingMs = craftEndsAt - now;
  const craftReady = crafting && craftRemainingMs <= 0;

  const tierMult = [1.0, 1.5, 2.25, 3.5][tier];

  return (
    <div style={{
      position: "relative",
      padding: 12, borderRadius: 12,
      background: success
        ? `radial-gradient(ellipse at center, ${nextTier?.color ?? tierM.color}33, rgba(15,17,21,0.8))`
        : `linear-gradient(135deg, ${tierM.color}12, rgba(15,17,21,0.7))`,
      border: `1px solid ${success ? nextTier?.color : tierM.color}55`,
      animation: forging ? "forgeGlow 0.6s ease-in-out infinite" : success ? "forgeSuccess 1s cubic-bezier(0.34, 1.56, 0.64, 1)" : undefined,
      transition: "border-color 0.4s ease",
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <div style={{
          width: 52, height: 52, borderRadius: 10,
          background: `radial-gradient(circle, ${tierM.color}22, rgba(15,17,21,0.9))`,
          border: `2px solid ${success ? nextTier?.color : tierM.color}`,
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 32, flexShrink: 0,
          position: "relative",
          transition: "border-color 0.4s ease",
        }}>
          {item.catalog.image_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={item.catalog.image_url} alt="" style={{ width: 40, height: 40, objectFit: "contain" }} />
          ) : item.catalog.emoji}
          {/* Hammer-Animation beim Schmieden */}
          {forging && (
            <div style={{
              position: "absolute", top: -14, right: -14, fontSize: 24,
              animation: "forgeHammer 0.6s ease-in-out infinite",
              filter: "drop-shadow(0 2px 4px rgba(0,0,0,0.5))",
            }}>🔨</div>
          )}
          {/* Sparks */}
          {forging && [0, 90, 180, 270].map((angle, i) => (
            <div key={i} style={{
              position: "absolute", top: "50%", left: "50%",
              width: 3, height: 3, borderRadius: 999, background: "#FFD700",
              boxShadow: "0 0 6px #FFD700",
              transform: `rotate(${angle}deg) translate(0, -24px)`,
              animation: `forgeSparks 0.7s ease-out infinite`,
              animationDelay: `${i * 80}ms`,
            }} />
          ))}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
            <span style={{ color: success ? nextTier?.color : tierM.color, fontSize: 9, fontWeight: 900, letterSpacing: 1 }}>
              {success ? nextTier?.name : tierM.name}
            </span>
            <span style={{ color: "#8B8FA3", fontSize: 9 }}>· {SLOT_META[item.catalog.slot].label}</span>
            {item.equipped && <span style={{ color: "#4ade80", fontSize: 9, fontWeight: 900 }}>· AUSGERÜSTET</span>}
          </div>
          <div style={{ color: "#FFF", fontSize: 13, fontWeight: 900 }}>{item.catalog.name}</div>
          <div style={{ fontSize: 10, color: "#a8b4cf", marginTop: 2 }}>
            {item.catalog.bonus_hp  > 0 && <span style={{ color: "#4ade80", marginRight: 6 }}>+{Math.round(item.catalog.bonus_hp*tierMult)} HP</span>}
            {item.catalog.bonus_atk > 0 && <span style={{ color: "#FF6B4A", marginRight: 6 }}>+{Math.round(item.catalog.bonus_atk*tierMult)} ATK</span>}
            {item.catalog.bonus_def > 0 && <span style={{ color: "#5ddaf0", marginRight: 6 }}>+{Math.round(item.catalog.bonus_def*tierMult)} DEF</span>}
            {item.catalog.bonus_spd > 0 && <span style={{ color: "#FFD700" }}>+{Math.round(item.catalog.bonus_spd*tierMult)} SPD</span>}
          </div>
        </div>
      </div>

      {/* Crafting-Timer (aktives Upgrade in Arbeit) */}
      {!maxed && crafting && (
        <div style={{
          marginTop: 10, padding: "10px 12px", borderRadius: 8,
          background: craftReady
            ? `linear-gradient(135deg, ${nextTier?.color}22, rgba(15,17,21,0.6))`
            : "rgba(255,107,74,0.12)",
          border: `1px solid ${craftReady ? nextTier?.color : "#FF6B4A"}55`,
          display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap",
        }}>
          <div style={{ fontSize: 18 }}>{craftReady ? "✨" : "⏳"}</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 10, color: craftReady ? nextTier?.color : "#FF6B4A", fontWeight: 900, letterSpacing: 1 }}>
              {craftReady ? `BEREIT → ${nextTier?.name}` : `SCHMIEDET → ${nextTier?.name}`}
            </div>
            <div style={{ fontSize: 11, color: "#FFF", fontWeight: 700, marginTop: 1 }}>
              {craftReady ? "Tippe Fertig zum Abholen." : `Noch ${formatRemaining(craftRemainingMs)}`}
            </div>
          </div>
          <button
            onClick={onFinalize}
            disabled={!craftReady}
            style={{
              padding: "6px 14px", borderRadius: 8, border: "none",
              background: craftReady
                ? `linear-gradient(180deg, ${nextTier?.color}, ${nextTier?.color}88)`
                : "rgba(255,255,255,0.05)",
              color: craftReady ? "#0F1115" : "#6c7590",
              fontSize: 11, fontWeight: 900, letterSpacing: 1,
              cursor: craftReady ? "pointer" : "not-allowed",
            }}
          >
            {craftReady ? "✓ FERTIG" : "⏳ WARTEN"}
          </button>
        </div>
      )}

      {/* Upgrade-Row (nur wenn nicht gerade geschmiedet wird) */}
      {!maxed && !crafting && cost && (
        <div style={{
          marginTop: 10, padding: "8px 10px", borderRadius: 8,
          background: "rgba(0,0,0,0.3)",
          display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap",
        }}>
          <div style={{ fontSize: 10, color: "#a8b4cf", fontWeight: 700 }}>
            → {nextTier?.name}
            {FORGE_DURATION_HOURS[tier] > 0 && (
              <span style={{ color: "#FF6B4A", marginLeft: 4 }}>
                · {FORGE_DURATION_HOURS[tier]}h Schmiede-Zeit
              </span>
            )}
            :
          </div>
          {Object.entries(cost).map(([k, v]) => {
            const m = MATERIAL_META.find((x) => x.id === k);
            const have = materials?.[k as keyof Materials] ?? 0;
            const has = have >= (v as number);
            return (
              <div key={k} style={{
                display: "flex", alignItems: "center", gap: 4,
                fontSize: 11, fontWeight: 900,
                color: has ? m?.color : "#FF2D78",
                opacity: has ? 1 : 0.6,
              }}>
                <MaterialIcon id={k as keyof Materials} catalog={catalog} size={14} />
                <span>{v as number}</span>
                {!has && <span style={{ fontSize: 9, opacity: 0.7 }}>(hast {have})</span>}
              </div>
            );
          })}
          <div style={{ flex: 1, minWidth: 100, textAlign: "right" }}>
            <button
              onClick={onForge}
              disabled={!hasMaterials || forging}
              style={{
                padding: "6px 14px", borderRadius: 8,
                background: success
                  ? `linear-gradient(180deg, ${nextTier?.color}, ${nextTier?.color}88)`
                  : hasMaterials
                    ? "linear-gradient(180deg, #FF6B4A, #a80d3c)"
                    : "rgba(255,255,255,0.05)",
                color: hasMaterials ? "#FFF" : "#6c7590",
                border: "none", cursor: hasMaterials && !forging ? "pointer" : "not-allowed",
                fontSize: 11, fontWeight: 900, letterSpacing: 1,
                boxShadow: hasMaterials ? "inset 0 1px 0 rgba(255,255,255,0.25), inset 0 -2px 4px rgba(0,0,0,0.3)" : "none",
              }}
            >
              {success ? "✓ ERFOLG" : forging ? "🔨 SCHMIEDE…" : "🔨 SCHMIEDEN"}
            </button>
          </div>
        </div>
      )}
      {maxed && (
        <div style={{ marginTop: 10, padding: 8, borderRadius: 8, background: "rgba(255,215,0,0.1)", textAlign: "center", color: "#FFD700", fontSize: 11, fontWeight: 900, letterSpacing: 1 }}>
          👑 MAX-STUFE ERREICHT
        </div>
      )}
    </div>
  );
}

function FilterChip({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} style={{
      padding: "4px 10px", borderRadius: 999, border: "none",
      background: active ? "#FF6B4A" : "rgba(255,255,255,0.05)",
      color: active ? "#0F1115" : "#a8b4cf",
      fontSize: 10, fontWeight: 900, cursor: "pointer",
    }}>{label}</button>
  );
}
