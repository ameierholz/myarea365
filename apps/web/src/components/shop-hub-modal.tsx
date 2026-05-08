"use client";

import { useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { UpgradeBody } from "@/components/upgrade-modal";
import { BoostShopBody } from "@/components/boost-shop";
import { GemShopBody } from "@/components/gem-shop-modal";
import { DealsShopBody } from "@/components/deals-shop-modal";
import { CosmeticsHubBody } from "@/components/cosmetics-hub-body";
import { Modal, ModalHeader, ModalBody, Z } from "@/components/ui";

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
    <Modal open={true} onClose={onClose} size="lg" zIndex={Z.modal}>
      <ModalHeader
        kicker="SHOP"
        title={<span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>🛒 Alles auf einen Blick</span>}
        onClose={onClose}
        accent="primary"
      />
      <ModalBody padding="flush">
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
        <div style={{ padding: 14 }}>
          {tab === "deals"     && <DealsShopBody />}
          {tab === "plus"      && <UpgradeBody mode="plus" userId={userId} onDone={onClose} />}
          {tab === "power"     && <BoostShopBody userId={userId} onDone={onClose} />}
          {tab === "gems"      && <GemShopBody />}
          {tab === "cosmetics" && <CosmeticsHubBody userId={userId} isAdmin={isAdmin} />}
        </div>
      </ModalBody>
    </Modal>
  );
}
