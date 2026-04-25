"use client";

import { useEffect, useState, useCallback } from "react";
import { useTranslations } from "next-intl";
import { RARITY_META, type GuardianRarity } from "@/lib/guardian";
import { SLOT_META, type ItemSlot } from "@/lib/items";
import { ForgeModal } from "@/components/forge-modal";

type Catalog = {
  id: string; name: string; emoji: string; slot: ItemSlot; rarity: GuardianRarity;
  bonus_hp: number; bonus_atk: number; bonus_def: number; bonus_spd: number;
  lore: string | null; cosmetic_only?: boolean; image_url?: string | null;
};

type InvItem = {
  id: string; item_id: string; acquired_at: string; source: string;
  catalog: Catalog; equipped: boolean; upgrade_tier?: number;
};

type InventoryResponse = {
  guardian_id: string | null;
  items: InvItem[];
  equipped: Partial<Record<ItemSlot, InvItem | null>>;
};

const TIER_META: Array<{ color: string; name: string; glow: string }> = [
  { color: "#8B8FA3", name: "Grau", glow: "rgba(139,143,163,0.25)" },
  { color: "#4ade80", name: "Grün", glow: "rgba(74,222,128,0.4)"   },
  { color: "#a855f7", name: "Lila", glow: "rgba(168,85,247,0.5)"   },
  { color: "#FFD700", name: "Gold", glow: "rgba(255,215,0,0.6)"    },
];

// Paper-doll Layout: links + rechts vom Avatar
const LEFT_COLUMN: ItemSlot[]  = ["shoulders", "chest", "hands", "boots"];
const RIGHT_COLUMN: ItemSlot[] = ["neck",      "wrist", "ring",  "weapon"];

export function GuardianPaperDoll({
  avatar,
  onChange,
}: {
  avatar: React.ReactNode;
  onChange?: () => void;
}) {
  const tPD = useTranslations("PaperDoll");
  const [inv, setInv] = useState<InventoryResponse | null>(null);
  const [pickerSlot, setPickerSlot] = useState<ItemSlot | null>(null);
  const [showForge, setShowForge] = useState(false);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch("/api/guardian/inventory", { cache: "no-store" });
    if (!res.ok) return;
    setInv(await res.json() as InventoryResponse);
  }, []);

  useEffect(() => { load(); }, [load]);

  async function equip(userItemId: string) {
    setBusy(true);
    try {
      await fetch("/api/guardian/inventory", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "equip", user_item_id: userItemId }),
      });
      await load();
      setPickerSlot(null);
      onChange?.();
    } finally { setBusy(false); }
  }

  async function unequip(slot: ItemSlot) {
    setBusy(true);
    try {
      await fetch("/api/guardian/inventory", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "unequip", slot }),
      });
      await load();
      onChange?.();
    } finally { setBusy(false); }
  }

  if (!inv) return <div style={{ padding: 20, textAlign: "center", color: "#8B8FA3", fontSize: 12 }}>{tPD("loading")}</div>;

  const totalBonus = { hp: 0, atk: 0, def: 0, spd: 0 };
  for (const s of [...LEFT_COLUMN, ...RIGHT_COLUMN, "helm"] as ItemSlot[]) {
    const it = inv.equipped[s];
    if (!it || it.catalog.cosmetic_only) continue;
    const tierMult = [1.0, 1.5, 2.25, 3.5][it.upgrade_tier ?? 0];
    totalBonus.hp  += Math.round(it.catalog.bonus_hp  * tierMult);
    totalBonus.atk += Math.round(it.catalog.bonus_atk * tierMult);
    totalBonus.def += Math.round(it.catalog.bonus_def * tierMult);
    totalBonus.spd += Math.round(it.catalog.bonus_spd * tierMult);
  }

  return (
    <div>
      {/* Paper-Doll Layout */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "70px 1fr 70px",
        gap: 10, alignItems: "start",
        padding: "16px 12px",
      }}>
        {/* Linke Spalte */}
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {LEFT_COLUMN.map((slot) => (
            <SlotButton key={slot} slot={slot} item={inv.equipped[slot]} onClick={() => setPickerSlot(slot)} disabled={busy} />
          ))}
        </div>

        {/* Mitte: Helm oben + Avatar + Boots-Label */}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
          {/* Helm */}
          <div style={{ width: 70 }}>
            <SlotButton slot="helm" item={inv.equipped.helm} onClick={() => setPickerSlot("helm")} disabled={busy} />
          </div>
          {/* Avatar */}
          <div style={{ position: "relative", marginTop: 4 }}>
            {avatar}
          </div>
        </div>

        {/* Rechte Spalte */}
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {RIGHT_COLUMN.map((slot) => (
            <SlotButton key={slot} slot={slot} item={inv.equipped[slot]} onClick={() => setPickerSlot(slot)} disabled={busy} />
          ))}
        </div>
      </div>

      {/* Gesamt-Bonus */}
      {(totalBonus.hp || totalBonus.atk || totalBonus.def || totalBonus.spd) ? (
        <div style={{
          padding: 10, borderRadius: 10,
          background: "rgba(255,215,0,0.08)",
          border: "1px solid rgba(255,215,0,0.3)",
          fontSize: 11, color: "#FFD700", fontWeight: 800,
          display: "flex", gap: 14, justifyContent: "center", flexWrap: "wrap",
          margin: "0 12px",
        }}>
          {totalBonus.hp  > 0 && <span>+{totalBonus.hp} HP</span>}
          {totalBonus.atk > 0 && <span>+{totalBonus.atk} ATK</span>}
          {totalBonus.def > 0 && <span>+{totalBonus.def} DEF</span>}
          {totalBonus.spd > 0 && <span>+{totalBonus.spd} SPD</span>}
        </div>
      ) : (
        <div style={{ padding: 10, margin: "0 12px", borderRadius: 10, background: "rgba(70,82,122,0.2)", textAlign: "center", color: "#8B8FA3", fontSize: 11 }}>
          {tPD("noEquipmentHint")}
        </div>
      )}

      {/* Schmiede-Button */}
      <button
        onClick={() => setShowForge(true)}
        style={{
          display: "block", width: "calc(100% - 24px)", margin: "12px",
          padding: "14px 16px", borderRadius: 12,
          background: "linear-gradient(135deg, #FF6B4A 0%, #a855f7 50%, #FFD700 100%)",
          color: "#0F1115", border: "none", cursor: "pointer",
          fontSize: 14, fontWeight: 900, letterSpacing: 2,
          textShadow: "none",
          boxShadow: "0 4px 20px rgba(255,107,74,0.35), inset 0 1px 0 rgba(255,255,255,0.3)",
        }}
      >
        🔨 ZUR SCHMIEDE
      </button>

      {pickerSlot && (
        <ItemPickerModal
          slot={pickerSlot}
          items={inv.items.filter((i) => i.catalog.slot === pickerSlot)}
          onEquip={equip}
          onUnequip={() => unequip(pickerSlot)}
          hasEquipped={!!inv.equipped[pickerSlot]}
          onClose={() => setPickerSlot(null)}
        />
      )}

      {showForge && (
        <ForgeModal
          items={inv.items}
          onClose={() => setShowForge(false)}
          onUpgraded={async () => { await load(); onChange?.(); }}
        />
      )}
    </div>
  );
}

function SlotButton({ slot, item, onClick, disabled }: {
  slot: ItemSlot;
  item: InvItem | null | undefined;
  onClick: () => void;
  disabled: boolean;
}) {
  const meta = SLOT_META[slot];
  const tier = TIER_META[item?.upgrade_tier ?? 0];
  const rarityColor = item ? RARITY_META[item.catalog.rarity].color : "#4a5370";
  const accent = item ? tier.color : rarityColor;
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={`${meta.label}${item ? ` — ${item.catalog.name} (${tier.name})` : " — leer"}`}
      style={{
        position: "relative",
        width: "100%", aspectRatio: "1",
        borderRadius: 10,
        background: item
          ? `radial-gradient(circle at 30% 30%, ${tier.glow}, rgba(15,17,21,0.9))`
          : "rgba(20, 26, 44, 0.5)",
        border: `2px solid ${accent}${item ? "" : "55"}`,
        boxShadow: item ? `0 0 12px ${tier.glow}, inset 0 1px 0 rgba(255,255,255,0.08)` : "inset 0 2px 4px rgba(0,0,0,0.3)",
        display: "flex", flexDirection: "column",
        alignItems: "center", justifyContent: "center",
        cursor: "pointer", padding: 2,
        transition: "transform 0.15s ease",
      }}
      onMouseOver={(e) => { if (!disabled) e.currentTarget.style.transform = "scale(1.05)"; }}
      onMouseOut={(e) => { e.currentTarget.style.transform = "scale(1)"; }}
    >
      <div style={{ fontSize: 32, opacity: item ? 1 : 0.25, lineHeight: 1 }}>
        {item?.catalog.image_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={item.catalog.image_url} alt="" style={{ width: 44, height: 44, objectFit: "contain" }} />
        ) : (
          item?.catalog.emoji ?? meta.icon
        )}
      </div>
      {item && (
        <div style={{
          position: "absolute", bottom: 2, right: 2,
          width: 10, height: 10, borderRadius: 999,
          background: tier.color,
          border: "1px solid #0F1115",
          boxShadow: `0 0 4px ${tier.glow}`,
        }} />
      )}

      {/* Mini-Stats unter dem Slot-Icon */}
      {item && (() => {
        const tierMult = [1.0, 1.5, 2.25, 3.5][item.upgrade_tier ?? 0];
        const chips: Array<{ v: number; c: string; lbl: string }> = [];
        const hp = Math.round(item.catalog.bonus_hp * tierMult);
        const atk = Math.round(item.catalog.bonus_atk * tierMult);
        const def = Math.round(item.catalog.bonus_def * tierMult);
        const spd = Math.round(item.catalog.bonus_spd * tierMult);
        if (hp > 0)  chips.push({ v: hp,  c: "#4ade80", lbl: "HP" });
        if (atk > 0) chips.push({ v: atk, c: "#FF6B4A", lbl: "ATK" });
        if (def > 0) chips.push({ v: def, c: "#5ddaf0", lbl: "DEF" });
        if (spd > 0) chips.push({ v: spd, c: "#FFD700", lbl: "SPD" });
        if (chips.length === 0) return null;
        return (
          <div style={{
            position: "absolute", left: 2, right: 2, bottom: 2,
            display: "flex", flexWrap: "wrap", justifyContent: "center", gap: 2,
            pointerEvents: "none",
          }}>
            {chips.slice(0, 4).map((c, i) => (
              <span key={i} style={{
                fontSize: 8, fontWeight: 900, lineHeight: 1,
                padding: "1px 3px", borderRadius: 3,
                background: "rgba(15,17,21,0.85)",
                color: c.c,
              }}>+{c.v}</span>
            ))}
          </div>
        );
      })()}
      {!item && (
        <div style={{ position: "absolute", bottom: 3, fontSize: 7, color: "#8B8FA3", fontWeight: 900, letterSpacing: 1 }}>
          {meta.label.toUpperCase()}
        </div>
      )}
    </button>
  );
}

function ItemPickerModal({ slot, items, onEquip, onUnequip, hasEquipped, onClose }: {
  slot: ItemSlot;
  items: InvItem[];
  onEquip: (id: string) => void;
  onUnequip: () => void;
  hasEquipped: boolean;
  onClose: () => void;
}) {
  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 3700, background: "rgba(15,17,21,0.9)", backdropFilter: "blur(10px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: "100%", maxWidth: 480, maxHeight: "85vh", overflowY: "auto", background: "#1A1D23", borderRadius: 18, padding: 20, border: "1px solid rgba(168,85,247,0.4)", color: "#F0F0F0" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
          <span style={{ fontSize: 26 }}>{SLOT_META[slot].icon}</span>
          <div style={{ flex: 1 }}>
            <div style={{ color: "#FFF", fontSize: 16, fontWeight: 900 }}>{SLOT_META[slot].label} wählen</div>
            <div style={{ color: "#8B8FA3", fontSize: 10 }}>{items.length} Items im Inventar</div>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", color: "#8B8FA3", fontSize: 22, cursor: "pointer" }}>×</button>
        </div>

        {hasEquipped && (
          <button onClick={onUnequip} style={{ width: "100%", padding: "8px 12px", borderRadius: 10, background: "rgba(255,45,120,0.2)", border: "1px solid rgba(255,45,120,0.5)", color: "#FF2D78", fontSize: 12, fontWeight: 900, cursor: "pointer", marginBottom: 10 }}>
            Ausrüstung ablegen
          </button>
        )}

        {items.length === 0 ? (
          <div style={{ padding: 20, textAlign: "center", color: "#8B8FA3", fontSize: 12 }}>
            Noch kein {SLOT_META[slot].label}-Item im Inventar.
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {items.map((it) => {
              const tier = TIER_META[it.upgrade_tier ?? 0];
              const tierMult = [1.0, 1.5, 2.25, 3.5][it.upgrade_tier ?? 0];
              return (
                <button
                  key={it.id}
                  onClick={() => onEquip(it.id)}
                  disabled={it.equipped}
                  style={{
                    display: "flex", alignItems: "center", gap: 10, padding: 10, borderRadius: 10,
                    background: it.equipped
                      ? `linear-gradient(135deg, ${tier.glow}, rgba(15,17,21,0.8))`
                      : "rgba(70,82,122,0.3)",
                    border: `1px solid ${tier.color}${it.equipped ? "" : "44"}`,
                    color: "#FFF", cursor: it.equipped ? "default" : "pointer", textAlign: "left",
                  }}
                >
                  <span style={{ fontSize: 26 }}>
                    {it.catalog.image_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={it.catalog.image_url} alt="" style={{ width: 30, height: 30, objectFit: "contain" }} />
                    ) : it.catalog.emoji}
                  </span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ color: tier.color, fontSize: 9, fontWeight: 900, letterSpacing: 1 }}>
                      {tier.name.toUpperCase()}
                      {it.equipped && " · AUSGERÜSTET"}
                    </div>
                    <div style={{ fontSize: 13, fontWeight: 900 }}>{it.catalog.name}</div>
                    {!it.catalog.cosmetic_only && (
                      <div style={{ color: "#a8b4cf", fontSize: 10, marginTop: 2 }}>
                        {it.catalog.bonus_hp  > 0 && <span style={{ color: "#4ade80", marginRight: 6 }}>+{Math.round(it.catalog.bonus_hp*tierMult)} HP</span>}
                        {it.catalog.bonus_atk > 0 && <span style={{ color: "#FF6B4A", marginRight: 6 }}>+{Math.round(it.catalog.bonus_atk*tierMult)} ATK</span>}
                        {it.catalog.bonus_def > 0 && <span style={{ color: "#5ddaf0", marginRight: 6 }}>+{Math.round(it.catalog.bonus_def*tierMult)} DEF</span>}
                        {it.catalog.bonus_spd > 0 && <span style={{ color: "#FFD700" }}>+{Math.round(it.catalog.bonus_spd*tierMult)} SPD</span>}
                      </div>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
