"use client";

import { useState } from "react";
import { UpgradeBody } from "@/components/upgrade-modal";
import { BoostShopBody } from "@/components/boost-shop";
import { GemShopBody } from "@/components/gem-shop-modal";

type TabId = "plus" | "power" | "gems";

const TABS: { id: TabId; label: string; icon: string; color: string }[] = [
  { id: "plus",  label: "MyArea+",   icon: "💎", color: "#22D1C3" },
  { id: "power", label: "Power",     icon: "⚡", color: "#FFD700" },
  { id: "gems",  label: "Diamanten", icon: "💠", color: "#5ddaf0" },
];

export function ShopHubModal({ userId, onClose }: { userId: string; onClose: () => void }) {
  const [tab, setTab] = useState<TabId>("plus");

  return (
    <div onClick={onClose} style={{
      position: "fixed", inset: 0, zIndex: 3600,
      background: "rgba(15,17,21,0.88)", backdropFilter: "blur(10px)",
      display: "flex", alignItems: "center", justifyContent: "center", padding: 16,
    }}>
      <div onClick={(e) => e.stopPropagation()} style={{
        width: "100%", maxWidth: 640, maxHeight: "92vh",
        display: "flex", flexDirection: "column",
        background: "#1A1D23", borderRadius: 20,
        border: "1px solid rgba(34,209,195,0.35)",
        boxShadow: "0 8px 40px rgba(0,0,0,0.7)",
        color: "#F0F0F0", overflow: "hidden",
      }}>
        <div style={{ padding: "14px 18px", display: "flex", alignItems: "center", gap: 10, borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
          <span style={{ fontSize: 22 }}>💎</span>
          <div style={{ flex: 1 }}>
            <div style={{ color: "#22D1C3", fontSize: 9, fontWeight: 900, letterSpacing: 2 }}>MYAREA365</div>
            <div style={{ color: "#FFF", fontSize: 16, fontWeight: 900 }}>Shop</div>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", color: "#8B8FA3", fontSize: 22, cursor: "pointer", width: 32, height: 32 }}>×</button>
        </div>

        <div style={{ display: "flex", borderBottom: "1px solid rgba(255,255,255,0.08)", flexShrink: 0 }}>
          {TABS.map((t) => {
            const active = tab === t.id;
            return (
              <button key={t.id} onClick={() => setTab(t.id)} style={{
                flex: 1, background: "transparent", border: "none", cursor: "pointer",
                padding: "12px 8px", color: active ? t.color : "#8B8FA3",
                fontSize: 12, fontWeight: 800,
                borderBottom: active ? `2px solid ${t.color}` : "2px solid transparent",
                display: "flex", flexDirection: "column", alignItems: "center", gap: 4,
              }}>
                <span style={{ fontSize: 20 }}>{t.icon}</span>
                {t.label}
              </button>
            );
          })}
        </div>

        <div style={{ flex: 1, overflowY: "auto", padding: 18 }}>
          {tab === "plus"  && <UpgradeBody mode="plus" userId={userId} onDone={onClose} />}
          {tab === "power" && <BoostShopBody userId={userId} onDone={onClose} />}
          {tab === "gems"  && <GemShopBody />}
        </div>
      </div>
    </div>
  );
}
