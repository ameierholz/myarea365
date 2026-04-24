"use client";

import { useEffect, useState } from "react";

type Purchase = { id: string; sku: string; status: string; created_at: string };

/**
 * Zeigt dem Runner einen Hinweis, wenn eine Zahlung mit verzögerter
 * Zahlungsmethode (SEPA-Lastschrift, Banküberweisung, ACH) noch nicht
 * eingegangen ist. Wird automatisch ausgeblendet, sobald Stripe den
 * Zahlungseingang bestätigt hat (Webhook → status=completed).
 */
export function PurchaseStatusBanner() {
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
    const t = setInterval(load, 60_000);
    return () => { alive = false; clearInterval(t); };
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
            <b style={{ color: "#FF2D78" }}>Zahlung fehlgeschlagen</b>
            <div style={{ color: "#a8b4cf", marginTop: 2 }}>
              {failed.length} {failed.length === 1 ? "Kauf konnte" : "Käufe konnten"} nicht
              abgebucht werden. Bitte erneut versuchen oder Zahlungsart wechseln.
            </div>
          </>
        ) : (
          <>
            <b style={{ color: "#FFD700" }}>Zahlung wird verarbeitet</b>
            <div style={{ color: "#a8b4cf", marginTop: 2 }}>
              Dein Kauf ist registriert. Bei <b>SEPA-Lastschrift</b> dauert die
              Bestätigung 2–5 Werktage, bei <b>Banküberweisung</b> bis zu 7 Werktage.
              Die Freischaltung erfolgt automatisch, sobald das Geld eingegangen ist.
            </div>
          </>
        )}
      </div>
      <button onClick={() => setDismissed(true)} aria-label="Schließen" style={{
        background: "transparent", border: "none", color: "#8B8FA3",
        cursor: "pointer", fontSize: 16, padding: 0, lineHeight: 1,
      }}>✕</button>
    </div>
  );
}
