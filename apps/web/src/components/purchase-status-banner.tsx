"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";

type Purchase = { id: string; sku: string; status: string; created_at: string };

export function PurchaseStatusBanner() {
  const t = useTranslations("PurchaseBanner");
  const [pending, setPending] = useState<Purchase[]>([]);
  const [failed, setFailed] = useState<Purchase[]>([]);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    let alive = true;
    const load = () => fetch("/api/purchases/mine")
      .then((r) => r.ok ? r.json() : { purchases: [] })
      .then((d: { purchases: Purchase[] }) => {
        if (!alive) return;
        setPending(d.purchases.filter((p) => p.status === "pending_payment"));
        setFailed(d.purchases.filter((p) => p.status === "failed"));
      })
      .catch(() => {});
    load();
    const tt = setInterval(load, 60_000);
    return () => { alive = false; clearInterval(tt); };
  }, []);

  if (dismissed || (pending.length === 0 && failed.length === 0)) return null;

  return (
    <div style={{
      position: "fixed", top: 10, left: "50%", transform: "translateX(-50%)",
      zIndex: 3000, maxWidth: 520, width: "calc(100% - 20px)",
      padding: "12px 14px", borderRadius: 12, fontSize: 12, lineHeight: 1.45,
      background: failed.length > 0 ? "rgba(255,45,120,0.12)" : "rgba(255,215,0,0.1)",
      border: `1px solid ${failed.length > 0 ? "rgba(255,45,120,0.4)" : "rgba(255,215,0,0.35)"}`,
      backdropFilter: "blur(10px)",
      color: "#F0F0F0",
      display: "flex", gap: 10, alignItems: "flex-start",
    }}>
      <div style={{ fontSize: 18, lineHeight: 1 }}>
        {failed.length > 0 ? "⚠️" : "⏳"}
      </div>
      <div style={{ flex: 1 }}>
        {failed.length > 0 ? (
          <>
            <b style={{ color: "#FF2D78" }}>{t("failedTitle")}</b>
            <div style={{ color: "#a8b4cf", marginTop: 2 }}>
              {failed.length === 1 ? t("failedOne", { n: 1 }) : t("failedMany", { n: failed.length })}
            </div>
          </>
        ) : (
          <>
            <b style={{ color: "#FFD700" }}>{t("pendingTitle")}</b>
            <div style={{ color: "#a8b4cf", marginTop: 2 }}>
              {t("pendingBody1")} <b>{t("pendingBoldSepa")}</b> {t("pendingBody2")} <b>{t("pendingBoldBank")}</b> {t("pendingBody3")}
            </div>
          </>
        )}
      </div>
      <button onClick={() => setDismissed(true)} aria-label={t("ariaClose")} style={{
        background: "transparent", border: "none", color: "#8B8FA3",
        cursor: "pointer", fontSize: 16, padding: 0, lineHeight: 1,
      }}>✕</button>
    </div>
  );
}
