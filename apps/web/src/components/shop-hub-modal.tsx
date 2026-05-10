"use client";

import { useEffect, useMemo, useState } from "react";
import { GemShopBody } from "@/components/gem-shop-modal";
import { DealsShopBody } from "@/components/deals-shop-modal";
import { CosmeticsHubBody } from "@/components/cosmetics-hub-body";
import { PremiumShopBody } from "@/components/premium-shop-body";
import { DiamondsBuyBody } from "@/components/diamonds-buy-body";
import { Modal, ModalHeader, ModalBody, Z } from "@/components/ui";

// Hinweis: Tab-IDs aus Legacy-Kompatibilität teilweise unverändert lassen.
// "plus" + "power" sind entfernt (Walking-App-Legacy), Mapping unten setzt sie auf "premium" um.
export type ShopHubTabId = "deals" | "diamonds" | "premium" | "items" | "cosmetics" | "plus" | "power" | "gems";

export function ShopHubModal({
  userId, onClose, initialTab = "deals", isAdmin = false,
}: {
  userId: string;
  onClose: () => void;
  initialTab?: ShopHubTabId;
  isAdmin?: boolean;
}) {
  // Legacy-Mapping: "plus" + "power" → "premium", "gems" → "items"
  const mapLegacy = (t: ShopHubTabId): ShopHubTabId => {
    if (t === "plus" || t === "power") return "premium";
    if (t === "gems") return "items";
    return t;
  };
  const [tab, setTab] = useState<ShopHubTabId>(mapLegacy(initialTab));

  useEffect(() => {
    const onSwitch = (e: Event) => {
      const ev = e as CustomEvent<{ tab: ShopHubTabId }>;
      if (ev.detail?.tab) setTab(mapLegacy(ev.detail.tab));
    };
    window.addEventListener("ma365:shophub-switch", onSwitch as EventListener);
    return () => window.removeEventListener("ma365:shophub-switch", onSwitch as EventListener);
  }, []);

  const TABS: { id: ShopHubTabId; label: string; icon: string; color: string }[] = useMemo(() => [
    { id: "deals",     label: "Angebote",   icon: "🔥", color: "#FF8A3C" },
    { id: "diamonds",  label: "Diamanten",  icon: "💎", color: "#FFD700" },
    { id: "premium",   label: "Premium",    icon: "👑", color: "#FF2D78" },
    { id: "items",     label: "Items",      icon: "🎁", color: "#22D1C3" },
    { id: "cosmetics", label: "Kosmetik",   icon: "🎨", color: "#a855f7" },
  ], []);

  return (
    <Modal open={true} onClose={onClose} size="lg" zIndex={Z.modal}>
      <ModalHeader
        kicker="SHOP"
        title={<span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>🛒 Alles auf einen Blick</span>}
        onClose={onClose}
        accent="primary"
      />
      <ModalBody padding="flush">
        <div style={{
          display: "flex", gap: 2, padding: "4px 6px 0", overflowX: "auto",
          borderBottom: "1px solid rgba(255,255,255,0.08)", flexShrink: 0,
          scrollbarWidth: "none",
        }}>
          {TABS.map((t) => {
            const active = tab === t.id;
            return (
              <button key={t.id} onClick={() => setTab(t.id)} style={{
                flexShrink: 0,
                background: "transparent", border: "none", cursor: "pointer",
                padding: "5px 8px 6px", color: active ? t.color : "#8B8FA3",
                fontSize: 9, fontWeight: 800,
                borderBottom: active ? `2px solid ${t.color}` : "2px solid transparent",
                display: "flex", flexDirection: "row", alignItems: "center", gap: 4,
                whiteSpace: "nowrap",
              }}>
                <span style={{ fontSize: 14 }}>{t.icon}</span>
                {t.label}
              </button>
            );
          })}
        </div>

        <div style={{ padding: "10px 10px" }}>
          {tab === "deals"     && <DealsShopBody />}
          {tab === "diamonds"  && <DiamondsBuyBody />}
          {tab === "premium"   && <PremiumShopBody />}
          {tab === "items"     && <GemShopBody />}
          {tab === "cosmetics" && <CosmeticsHubBody userId={userId} isAdmin={isAdmin} />}
        </div>
      </ModalBody>
    </Modal>
  );
}
