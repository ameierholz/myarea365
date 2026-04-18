"use client";

import { useEffect, useState, useCallback } from "react";
import { RARITY_META, type GuardianRarity } from "@/lib/guardian";
import { SLOT_META, type ItemSlot } from "@/lib/items";

type Catalog = {
  id: string; name: string; emoji: string; slot: ItemSlot; rarity: GuardianRarity;
  bonus_hp: number; bonus_atk: number; bonus_def: number; bonus_spd: number;
  lore: string | null;
};

type InvItem = {
  id: string; item_id: string; acquired_at: string; source: string;
  catalog: Catalog; equipped: boolean;
};

type InventoryResponse = {
  guardian_id: string | null;
  items: InvItem[];
  equipped: { helm: InvItem | null; armor: InvItem | null; amulet: InvItem | null };
};

export function GuardianEquipmentPanel({ onChange }: { onChange?: () => void }) {
  const [inv, setInv] = useState<InventoryResponse | null>(null);
  const [pickerSlot, setPickerSlot] = useState<ItemSlot | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch("/api/guardian/inventory");
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

  if (!inv) return <div style={{ padding: 20, textAlign: "center", color: "#8B8FA3", fontSize: 12 }}>Lade Ausrüstung…</div>;

  const slots: ItemSlot[] = ["helm", "armor", "amulet"];
  const totalBonus = { hp: 0, atk: 0, def: 0, spd: 0 };
  for (const s of slots) {
    const it = inv.equipped[s];
    if (it) {
      totalBonus.hp  += it.catalog.bonus_hp;
      totalBonus.atk += it.catalog.bonus_atk;
      totalBonus.def += it.catalog.bonus_def;
      totalBonus.spd += it.catalog.bonus_spd;
    }
  }

  return (
    <div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 10 }}>
        {slots.map((slot) => {
          const it = inv.equipped[slot];
          const meta = SLOT_META[slot];
          const rarityColor = it ? RARITY_META[it.catalog.rarity].color : "#8B8FA3";
          return (
            <button
              key={slot}
              onClick={() => setPickerSlot(slot)}
              disabled={busy}
              style={{
                padding: 10, borderRadius: 12,
                background: it
                  ? `linear-gradient(135deg, ${RARITY_META[it.catalog.rarity].glow}, rgba(15,17,21,0.7))`
                  : "rgba(70, 82, 122, 0.35)",
                border: `1px dashed ${rarityColor}${it ? "" : "55"}`,
                cursor: "pointer", textAlign: "center",
                transition: "transform 0.2s",
              }}
            >
              <div style={{ fontSize: 9, color: "#8B8FA3", fontWeight: 800, letterSpacing: 1 }}>
                {meta.label.toUpperCase()}
              </div>
              <div style={{ fontSize: 36, margin: "4px 0", opacity: it ? 1 : 0.3 }}>
                {it?.catalog.emoji ?? meta.icon}
              </div>
              <div style={{ color: rarityColor, fontSize: 10, fontWeight: 800, minHeight: 12 }}>
                {it?.catalog.name ?? "leer"}
              </div>
            </button>
          );
        })}
      </div>

      {(totalBonus.hp || totalBonus.atk || totalBonus.def || totalBonus.spd) ? (
        <div style={{
          padding: 10, borderRadius: 10,
          background: "rgba(255,215,0,0.08)",
          border: "1px solid rgba(255,215,0,0.3)",
          fontSize: 11, color: "#FFD700", fontWeight: 800,
          display: "flex", gap: 14, justifyContent: "center", flexWrap: "wrap",
        }}>
          {totalBonus.hp  > 0 && <span>+{totalBonus.hp} HP</span>}
          {totalBonus.atk > 0 && <span>+{totalBonus.atk} ATK</span>}
          {totalBonus.def > 0 && <span>+{totalBonus.def} DEF</span>}
          {totalBonus.spd > 0 && <span>+{totalBonus.spd} SPD</span>}
        </div>
      ) : (
        <div style={{ padding: 10, borderRadius: 10, background: "rgba(70,82,122,0.2)", textAlign: "center", color: "#8B8FA3", fontSize: 11 }}>
          Noch keine Ausrüstung — gewinn Rare+ Loot bei Einlösungen
        </div>
      )}

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
    </div>
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
            Noch kein {SLOT_META[slot].label}-Item im Inventar.<br />
            Lös Deals ein und hoff auf Rare+ Loot!
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {items.map((it) => {
              const rarity = RARITY_META[it.catalog.rarity];
              return (
                <button
                  key={it.id}
                  onClick={() => onEquip(it.id)}
                  disabled={it.equipped}
                  style={{
                    display: "flex", alignItems: "center", gap: 10, padding: 10, borderRadius: 10,
                    background: it.equipped
                      ? `linear-gradient(135deg, ${rarity.glow}, rgba(15,17,21,0.8))`
                      : "rgba(70,82,122,0.3)",
                    border: `1px solid ${rarity.color}${it.equipped ? "" : "44"}`,
                    color: "#FFF", cursor: it.equipped ? "default" : "pointer", textAlign: "left",
                  }}
                >
                  <span style={{ fontSize: 26 }}>{it.catalog.emoji}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ color: rarity.color, fontSize: 9, fontWeight: 900, letterSpacing: 1 }}>
                      {rarity.label.toUpperCase()}{it.equipped && " · AUSGERÜSTET"}
                    </div>
                    <div style={{ fontSize: 13, fontWeight: 900 }}>{it.catalog.name}</div>
                    <div style={{ color: "#a8b4cf", fontSize: 10, marginTop: 2 }}>
                      {it.catalog.bonus_hp  > 0 && <span style={{ color: "#4ade80", marginRight: 6 }}>+{it.catalog.bonus_hp} HP</span>}
                      {it.catalog.bonus_atk > 0 && <span style={{ color: "#FF6B4A", marginRight: 6 }}>+{it.catalog.bonus_atk} ATK</span>}
                      {it.catalog.bonus_def > 0 && <span style={{ color: "#5ddaf0", marginRight: 6 }}>+{it.catalog.bonus_def} DEF</span>}
                      {it.catalog.bonus_spd > 0 && <span style={{ color: "#FFD700" }}>+{it.catalog.bonus_spd} SPD</span>}
                    </div>
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
