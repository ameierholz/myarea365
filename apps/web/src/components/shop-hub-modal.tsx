"use client";

import { useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { UpgradeBody } from "@/components/upgrade-modal";
import { BoostShopBody } from "@/components/boost-shop";
import { GemShopBody } from "@/components/gem-shop-modal";
import { DealsShopBody } from "@/components/deals-shop-modal";
import { CosmeticsHubBody } from "@/components/cosmetics-hub-body";

export type ShopHubTabId = "deals" | "plus" | "power" | "gems" | "cosmetics";

export function ShopHubModal({
  userId, onClose, initialTab = "deals", isAdmin = false,
}: {
  userId: string;
  onClose: () => void;
  initialTab?: ShopHubTabId;
  isAdmin?: boolean;
}) {
  const tM = useTranslations("Modals");
  const [tab, setTab] = useState<ShopHubTabId>(initialTab);

  // Globale Events: andere Komponenten dürfen den Tab umschalten ohne neuen Hub zu öffnen
  useEffect(() => {
    const onSwitch = (e: Event) => {
      const ev = e as CustomEvent<{ tab: ShopHubTabId }>;
      if (ev.detail?.tab) setTab(ev.detail.tab);
    };
    window.addEventListener("ma365:shophub-switch", onSwitch as EventListener);
    return () => window.removeEventListener("ma365:shophub-switch", onSwitch as EventListener);
  }, []);

  const TABS: { id: ShopHubTabId; label: string; icon: string; color: string }[] = useMemo(() => [
    { id: "deals",     label: "Angebote",  icon: "🔥", color: "#FF8A3C" },
    { id: "gems",      label: tM("shTabGems"),  icon: "💠", color: "#5ddaf0" },
    { id: "plus",      label: tM("shTabPlus"),  icon: "💎", color: "#22D1C3" },
    { id: "power",     label: tM("shTabPower"), icon: "⚡", color: "#FFD700" },
    { id: "cosmetics", label: "Kosmetik",  icon: "🎨", color: "#FF2D78" },
  ], [tM]);

  return (
    <div onClick={onClose} style={{
      position: "fixed", inset: 0, zIndex: 3600,
      background: "rgba(15,17,21,0.88)", backdropFilter: "blur(10px)",
      display: "flex", alignItems: "center", justifyContent: "center", padding: 8,
    }}>
      <div onClick={(e) => e.stopPropagation()} style={{
        width: "100%", maxWidth: 720, maxHeight: "94vh",
        display: "flex", flexDirection: "column",
        background: "#1A1D23", borderRadius: 16,
        border: "1px solid rgba(34,209,195,0.35)",
        boxShadow: "0 8px 40px rgba(0,0,0,0.7)",
        color: "#F0F0F0", overflow: "hidden",
      }}>
        {/* Header */}
        <div style={{ padding: "12px 14px", display: "flex", alignItems: "center", gap: 10, borderBottom: "1px solid rgba(255,255,255,0.08)", flexShrink: 0 }}>
          <span style={{ fontSize: 22 }}>🛒</span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ color: "#22D1C3", fontSize: 9, fontWeight: 900, letterSpacing: 2 }}>SHOP</div>
            <div style={{ color: "#FFF", fontSize: 16, fontWeight: 900 }}>Alles auf einen Blick</div>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", color: "#8B8FA3", fontSize: 22, cursor: "pointer", width: 36, height: 36, display: "flex", alignItems: "center", justifyContent: "center" }}>×</button>
        </div>

        {/* Tabs — Mobile: horizontal scrollbar, Desktop: full row */}
        <div style={{
          display: "flex", gap: 4, padding: "8px 8px 0", overflowX: "auto",
          borderBottom: "1px solid rgba(255,255,255,0.08)", flexShrink: 0,
          scrollbarWidth: "none",
        }}>
          {TABS.map((t) => {
            const active = tab === t.id;
            return (
              <button key={t.id} onClick={() => setTab(t.id)} style={{
                flexShrink: 0,
                background: "transparent", border: "none", cursor: "pointer",
                padding: "10px 12px", color: active ? t.color : "#8B8FA3",
                fontSize: 11, fontWeight: 800,
                borderBottom: active ? `2px solid ${t.color}` : "2px solid transparent",
                display: "flex", flexDirection: "column", alignItems: "center", gap: 3,
                minWidth: 64,
              }}>
                <span style={{ fontSize: 18 }}>{t.icon}</span>
                {t.label}
              </button>
            );
          })}
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflowY: "auto", padding: 14 }}>
          {tab === "deals"     && <DealsShopBody />}
          {tab === "plus"      && <UpgradeBody mode="plus" userId={userId} onDone={onClose} />}
          {tab === "power"     && <BoostShopBody userId={userId} onDone={onClose} />}
          {tab === "gems"      && <GemShopBody />}
          {tab === "cosmetics" && <CosmeticsHubBody userId={userId} isAdmin={isAdmin} />}
        </div>
      </div>
    </div>
  );
}
