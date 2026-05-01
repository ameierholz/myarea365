"use client";

// Kosmetik-Tab im SHOPS-Hub. Übersicht mit 6 Kacheln, jede öffnet den
// bestehenden Picker. Ziel: ein Entry-Point für alle Cosmetic-Slots.

import { useState } from "react";
import { LightPickerModal } from "@/components/light-picker-modal";
import { MarkerPickerModal } from "@/components/marker-picker-modal";
import { NameplatePickerModal } from "@/components/nameplate-picker-modal";
import { BaseRingPickerModal } from "@/components/base-ring-picker-modal";
import { BaseThemeShopModal } from "@/components/base-theme-shop-modal";

type SlotId = "marker" | "light" | "pin_theme" | "base_theme" | "base_ring" | "nameplate";

const SLOTS: Array<{
  id: SlotId;
  label: string;
  icon: string;
  color: string;
  hint: string;
  group: "runner" | "base";
}> = [
  { id: "marker",     label: "Avatar",     icon: "📍", color: "#FF6B4A", hint: "Map-Icon beim Laufen", group: "runner" },
  { id: "light",      label: "Lauflinie",  icon: "✨", color: "#5ddaf0", hint: "Trail hinter dir",     group: "runner" },
  { id: "pin_theme",  label: "Pin-Aura",   icon: "💠", color: "#a855f7", hint: "Glow um deinen Pin",   group: "runner" },
  { id: "base_theme", label: "Base-Theme", icon: "🏰", color: "#FFD700", hint: "Gebäude-Skin",         group: "base" },
  { id: "base_ring",  label: "Base-Ring",  icon: "💍", color: "#22D1C3", hint: "Aura um die Base",     group: "base" },
  { id: "nameplate",  label: "Banner",     icon: "🎀", color: "#FF2D78", hint: "Namensschild",         group: "base" },
];

export function CosmeticsHubBody({ userId: _userId, isAdmin = false }: { userId: string; isAdmin?: boolean }) {
  const [open, setOpen] = useState<SlotId | null>(null);

  const renderGroup = (group: "runner" | "base", title: string, subtitle: string) => {
    const items = SLOTS.filter((s) => s.group === group);
    return (
      <div style={{ marginBottom: 18 }}>
        <div style={{ marginBottom: 8 }}>
          <div style={{ color: "#5ddaf0", fontSize: 10, fontWeight: 900, letterSpacing: 2 }}>{title}</div>
          <div style={{ color: "#8B8FA3", fontSize: 11, fontWeight: 600, marginTop: 2 }}>{subtitle}</div>
        </div>
        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(min(100px, 100%), 1fr))",
          gap: 8,
        }}>
          {items.map((s) => (
            <button key={s.id} onClick={() => setOpen(s.id)} style={{
              padding: "12px 8px", borderRadius: 14,
              background: `linear-gradient(135deg, ${s.color}22 0%, rgba(15,17,21,0.7) 100%)`,
              border: `1px solid ${s.color}55`,
              color: "#FFF", cursor: "pointer", textAlign: "center",
              display: "flex", flexDirection: "column", alignItems: "center", gap: 4,
              minHeight: 88,
            }}>
              <div style={{ fontSize: 24 }}>{s.icon}</div>
              <div style={{ fontSize: 12, fontWeight: 900 }}>{s.label}</div>
              <div style={{ fontSize: 9, color: "#a8b4cf", lineHeight: 1.2 }}>{s.hint}</div>
            </button>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div>
      <div style={{
        padding: "10px 12px", borderRadius: 12, marginBottom: 14,
        background: "linear-gradient(135deg, rgba(255,45,120,0.10), rgba(168,85,247,0.08))",
        border: "1px solid rgba(255,45,120,0.25)",
      }}>
        <div style={{ color: "#FF2D78", fontSize: 9, fontWeight: 900, letterSpacing: 2, marginBottom: 4 }}>
          KOSMETIK
        </div>
        <div style={{ fontSize: 11, color: "#a8b4cf", lineHeight: 1.5 }}>
          Sechs Slots — drei beim Laufen sichtbar, drei an deiner Base.
          Items mit XP/Wegemünzen freischalten oder im Gem-Shop kaufen.
        </div>
      </div>

      {renderGroup("runner", "AUF DER KARTE", "Sichtbar wenn du läufst")}
      {renderGroup("base",   "AN DEINER BASE", "Sichtbar wenn du nicht läufst")}

      {open === "marker" && (
        <MarkerPickerModal
          userXp={0}
          currentId="default"
          onPick={() => setOpen(null)}
          onClose={() => setOpen(null)}
          isAdmin={isAdmin}
        />
      )}
      {open === "light" && (
        <LightPickerModal
          userXp={0}
          currentId="classic"
          onPick={() => setOpen(null)}
          onClose={() => setOpen(null)}
          isAdmin={isAdmin}
        />
      )}
      {open === "pin_theme" && (
        // Pin-Theme-Picker liegt aktuell inline in loadout-trio. Vorerst Hinweis.
        <SimpleNotice msg="Pin-Aura wählst du im Loadout (Profil → Pin-Aura)." onClose={() => setOpen(null)} />
      )}
      {open === "base_theme" && (
        <BaseThemeShopModal onClose={() => setOpen(null)} onChanged={() => {}} />
      )}
      {open === "base_ring" && (
        <BaseRingPickerModal isAdmin={isAdmin} onClose={() => setOpen(null)} />
      )}
      {open === "nameplate" && (
        <NameplatePickerModal isAdmin={isAdmin} onClose={() => setOpen(null)} />
      )}
    </div>
  );
}

function SimpleNotice({ msg, onClose }: { msg: string; onClose: () => void }) {
  return (
    <div onClick={onClose} style={{
      position: "fixed", inset: 0, zIndex: 3700,
      background: "rgba(0,0,0,0.7)",
      display: "flex", alignItems: "center", justifyContent: "center", padding: 16,
    }}>
      <div onClick={(e) => e.stopPropagation()} style={{
        background: "#1A1D23", borderRadius: 14, padding: 18, maxWidth: 340,
        border: "1px solid rgba(255,255,255,0.1)",
      }}>
        <div style={{ color: "#FFF", fontSize: 14, fontWeight: 800, marginBottom: 14 }}>{msg}</div>
        <button onClick={onClose} style={{
          width: "100%", padding: "10px 14px", borderRadius: 10,
          background: "#22D1C3", color: "#0F1115", border: "none",
          fontSize: 13, fontWeight: 900, cursor: "pointer",
        }}>OK</button>
      </div>
    </div>
  );
}
