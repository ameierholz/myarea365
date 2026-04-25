"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { UpgradeBody } from "@/components/upgrade-modal";
import { BoostShopBody } from "@/components/boost-shop";
import { GemShopBody } from "@/components/gem-shop-modal";

type TabId = "plus" | "power" | "gems";

export function ShopHubModal({ userId, onClose }: { userId: string; onClose: () => void }) {
  const tM = useTranslations("Modals");
  const [tab, setTab] = useState<TabId>("plus");
  const TABS: { id: TabId; label: string; icon: string; color: string }[] = useMemo(() => [
    { id: "plus",  label: tM("shTabPlus"),  icon: "💎", color: "#22D1C3" },
    { id: "power", label: tM("shTabPower"), icon: "⚡", color: "#FFD700" },
    { id: "gems",  label: tM("shTabGems"),  icon: "💠", color: "#5ddaf0" },
  ], [tM]);

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
            <div style={{ color: "#22D1C3", fontSize: 9, fontWeight: 900, letterSpacing: 2 }}>{tM("shKicker")}</div>
            <div style={{ color: "#FFF", fontSize: 16, fontWeight: 900 }}>{tM("shTitle")}</div>
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
          <div style={{
            padding: "10px 12px", borderRadius: 12, marginBottom: 14,
            background: "linear-gradient(135deg, rgba(34,209,195,0.10), rgba(93,218,240,0.08))",
            border: "1px solid rgba(34,209,195,0.25)",
          }}>
            <div style={{ color: "#22D1C3", fontSize: 9, fontWeight: 900, letterSpacing: 2, marginBottom: 4 }}>
              {tM("shGuideKicker")}
            </div>
            <div style={{ fontSize: 11, color: "#a8b4cf", lineHeight: 1.55 }}>
              {tM.rich("shGuideRich", {
                a: (chunks) => <>• <b style={{ color: "#22D1C3" }}>{chunks}</b></>,
                b: (chunks) => <>• <b style={{ color: "#FFD700" }}>{chunks}</b></>,
                c: (chunks) => <>• <b style={{ color: "#5ddaf0" }}>{chunks}</b></>,
                d: (chunks) => <span style={{ color: "#8B8FA3" }}>{chunks}</span>,
                br: () => <br />,
              })}
            </div>
          </div>
          {tab === "plus"  && <UpgradeBody mode="plus" userId={userId} onDone={onClose} />}
          {tab === "power" && <BoostShopBody userId={userId} onDone={onClose} />}
          {tab === "gems"  && <GemShopBody />}
        </div>
      </div>
    </div>
  );
}
