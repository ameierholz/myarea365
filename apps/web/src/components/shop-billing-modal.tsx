"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type Shop = {
  id: string;
  name: string;
  plan: string | null;
  plan_expires_at: string | null;
  spotlight_until: string | null;
  flash_push_credits: number | null;
  status: string | null;
};

type Purchase = {
  id: string;
  product_name: string;
  amount_cents: number;
  status: string;
  created_at: string;
};

const PLAN_COLORS: Record<string, string> = {
  free:  "#8B8FA3",
  basis: "#22D1C3",
  pro:   "#FFD700",
  ultra: "#FF2D78",
};

const PLAN_PRICES: Record<string, string> = {
  free:  "0 €",
  basis: "29 € / Monat",
  pro:   "79 € / Monat",
  ultra: "199 € / Monat",
};

/**
 * Shop-Billing als Overlay — Owner bleibt im Dashboard-Kontext.
 * Zeigt aktuellen Plan, aktive Add-ons, Rechnungshistorie und
 * leitet zum Stripe-Customer-Portal (Self-Service-Billing).
 */
export function ShopBillingModal({ defaultShopId, onClose }: {
  defaultShopId?: string;
  onClose: () => void;
}) {
  const [shops, setShops] = useState<Shop[]>([]);
  const [selectedShopId, setSelectedShopId] = useState<string | null>(defaultShopId ?? null);
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/shop/my").then((r) => r.json()).then((d) => {
      setShops(d.shops ?? []);
      if (!selectedShopId && d.shops?.[0]) setSelectedShopId(d.shops[0].id);
    });
  }, [selectedShopId]);

  useEffect(() => {
    if (!selectedShopId) return;
    fetch(`/api/shop/purchases?business_id=${selectedShopId}`)
      .then((r) => r.ok ? r.json() : { purchases: [] })
      .then((d) => setPurchases(d.purchases ?? []))
      .catch(() => setPurchases([]));
  }, [selectedShopId]);

  async function openPortal() {
    if (!selectedShopId) return;
    setBusy(true); setError(null);
    try {
      const res = await fetch("/api/stripe/portal", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ business_id: selectedShopId }),
      });
      const j = await res.json();
      if (!res.ok) {
        setError(j.message ?? j.error ?? "Konnte Portal nicht öffnen");
        return;
      }
      window.location.href = j.url;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Netzwerkfehler");
    } finally {
      setBusy(false);
    }
  }

  const shop = shops.find((s) => s.id === selectedShopId);

  return (
    <div onClick={onClose} style={{
      position: "fixed", inset: 0, zIndex: 3900,
      background: "rgba(15,17,21,0.92)", backdropFilter: "blur(10px)",
      display: "flex", alignItems: "center", justifyContent: "center", padding: 16,
    }}>
      <div onClick={(e) => e.stopPropagation()} style={{
        width: "100%", maxWidth: 640, maxHeight: "92vh", overflowY: "auto",
        background: "#1A1D23", borderRadius: 20,
        border: "1px solid rgba(34,209,195,0.4)",
        color: "#F0F0F0", boxShadow: "0 20px 60px rgba(0,0,0,0.7)",
      }}>
        <div style={{ padding: "18px 22px", borderBottom: "1px solid rgba(255,255,255,0.08)", display: "flex", alignItems: "center", gap: 12, position: "sticky", top: 0, background: "#1A1D23", zIndex: 1 }}>
          <div style={{ fontSize: 26 }}>💳</div>
          <div style={{ flex: 1 }}>
            <div style={{ color: "#22D1C3", fontSize: 10, fontWeight: 900, letterSpacing: 2 }}>SHOP · BILLING</div>
            <div style={{ color: "#FFF", fontSize: 16, fontWeight: 900 }}>Abrechnung &amp; Paket</div>
          </div>
          <button onClick={onClose} style={{
            background: "rgba(255,255,255,0.08)", border: "none", color: "#a8b4cf",
            width: 32, height: 32, borderRadius: 999, cursor: "pointer", fontSize: 16,
          }}>✕</button>
        </div>

        <div style={{ padding: 20 }}>
          {shops.length === 0 ? (
            <div style={{ padding: 30, textAlign: "center", background: "#0F1115", borderRadius: 14, border: "1px solid rgba(255,255,255,0.06)" }}>
              <div style={{ fontSize: 40, marginBottom: 10 }}>🏪</div>
              <p style={{ color: "#a8b4cf", marginBottom: 16 }}>Du hast noch keinen Shop eingereicht.</p>
              <Link href="/shop/anmelden" style={BTN}>Shop jetzt eintragen</Link>
            </div>
          ) : (
            <>
              {shops.length > 1 && (
                <select value={selectedShopId ?? ""} onChange={(e) => setSelectedShopId(e.target.value)}
                  style={{ ...INPUT, marginBottom: 16 }}>
                  {shops.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              )}

              {shop && (
                <>
                  {/* Aktueller Plan */}
                  <div style={{
                    padding: 18, borderRadius: 14, marginBottom: 16,
                    background: `linear-gradient(135deg, ${PLAN_COLORS[shop.plan ?? "free"]}18, rgba(15,17,21,0.6))`,
                    border: `1px solid ${PLAN_COLORS[shop.plan ?? "free"]}55`,
                  }}>
                    <div style={{ fontSize: 10, letterSpacing: 2, color: PLAN_COLORS[shop.plan ?? "free"], fontWeight: 900 }}>
                      AKTUELLES PAKET
                    </div>
                    <div style={{ fontSize: 22, fontWeight: 900, marginTop: 4, color: PLAN_COLORS[shop.plan ?? "free"] }}>
                      {(shop.plan ?? "free").toUpperCase()}
                    </div>
                    <div style={{ fontSize: 13, color: "#a8b4cf", marginTop: 2 }}>
                      {PLAN_PRICES[shop.plan ?? "free"]}
                    </div>
                    {shop.plan_expires_at && (
                      <div style={{ fontSize: 12, color: "#a8b4cf", marginTop: 6 }}>
                        Läuft bis: <b style={{ color: "#FFF" }}>{new Date(shop.plan_expires_at).toLocaleDateString("de-DE")}</b>
                      </div>
                    )}
                    <div style={{ display: "flex", gap: 10, marginTop: 14, flexWrap: "wrap" }}>
                      <button onClick={openPortal} disabled={busy} style={{ ...BTN, opacity: busy ? 0.6 : 1 }}>
                        {busy ? "Öffne Portal…" : "💳 Rechnungen & Zahlung"}
                      </button>
                    </div>
                    {error && <div style={{ marginTop: 10, color: "#FF2D78", fontSize: 12 }}>⚠️ {error}</div>}
                  </div>

                  {/* Aktive Add-ons */}
                  <div style={{ marginBottom: 16 }}>
                    <h2 style={{ fontSize: 12, fontWeight: 900, marginBottom: 8, color: "#a8b4cf", letterSpacing: 1 }}>AKTIVE ADD-ONS</h2>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 10 }}>
                      <AddonChip label="Spotlight" active={shop.spotlight_until ? new Date(shop.spotlight_until) > new Date() : false}
                        sub={shop.spotlight_until ? `bis ${new Date(shop.spotlight_until).toLocaleDateString("de-DE")}` : "nicht gebucht"} />
                      <AddonChip label="Flash-Push Credits" active={(shop.flash_push_credits ?? 0) > 0}
                        sub={`${shop.flash_push_credits ?? 0} übrig`} />
                    </div>
                  </div>

                  {/* Rechnungs-Historie */}
                  <div>
                    <h2 style={{ fontSize: 12, fontWeight: 900, marginBottom: 8, color: "#a8b4cf", letterSpacing: 1 }}>
                      RECHNUNGEN (LETZTE 10)
                    </h2>
                    {purchases.length === 0 ? (
                      <div style={{ padding: 16, textAlign: "center", background: "#0F1115", borderRadius: 10, color: "#8B8FA3", fontSize: 13 }}>
                        Noch keine Rechnungen.
                      </div>
                    ) : (
                      <div style={{ background: "#0F1115", borderRadius: 10, overflow: "hidden" }}>
                        {purchases.slice(0, 10).map((p) => (
                          <div key={p.id} style={{
                            display: "flex", alignItems: "center", justifyContent: "space-between",
                            padding: "12px 14px", borderBottom: "1px solid rgba(255,255,255,0.05)",
                          }}>
                            <div>
                              <div style={{ fontSize: 13, fontWeight: 700 }}>{p.product_name}</div>
                              <div style={{ fontSize: 10, color: "#8B8FA3" }}>{new Date(p.created_at).toLocaleDateString("de-DE")}</div>
                            </div>
                            <div style={{ textAlign: "right" }}>
                              <div style={{ fontSize: 13, fontWeight: 900 }}>{(p.amount_cents / 100).toFixed(2)} €</div>
                              <StatusBadge status={p.status} />
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                    {purchases.some((p) => p.status === "pending_payment") && (
                      <div style={{
                        marginTop: 10, padding: "10px 12px", borderRadius: 10,
                        background: "rgba(255,215,0,0.08)", border: "1px solid rgba(255,215,0,0.3)",
                        fontSize: 11, color: "#FFD700", lineHeight: 1.45,
                      }}>
                        ⏳ <b>Zahlung wird verarbeitet</b> — SEPA-Lastschrift 2–5 Werktage,
                        Banküberweisung bis zu 7 Werktage. Freischaltung erfolgt automatisch,
                        sobald Stripe den Zahlungseingang bestätigt.
                      </div>
                    )}
                    <p style={{ fontSize: 10, color: "#8B8FA3", marginTop: 6 }}>
                      Für PDF-Rechnungen &amp; MwSt.-Ausweis öffne das Stripe-Portal oben.
                    </p>
                  </div>
                </>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

const BTN: React.CSSProperties = {
  padding: "10px 16px", borderRadius: 10, border: "none",
  background: "linear-gradient(135deg, #22D1C3, #5ddaf0)",
  color: "#0F1115", fontSize: 13, fontWeight: 900, letterSpacing: 0.5,
  cursor: "pointer", textDecoration: "none", display: "inline-block",
};
const INPUT: React.CSSProperties = {
  width: "100%", padding: "10px 12px", borderRadius: 8,
  background: "#0F1115", border: "1px solid rgba(255,255,255,0.12)",
  color: "#F0F0F0", fontSize: 14, fontFamily: "inherit",
};

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; color: string }> = {
    paid:            { label: "✓ BEZAHLT",       color: "#4ade80" },
    completed:       { label: "✓ ABGESCHLOSSEN", color: "#4ade80" },
    pending_payment: { label: "⏳ ZAHLUNG LÄUFT", color: "#FFD700" },
    pending:         { label: "… AUSSTEHEND",    color: "#8B8FA3" },
    failed:          { label: "✕ FEHLGESCHLAGEN", color: "#FF2D78" },
    payment_failed:  { label: "✕ FEHLGESCHLAGEN", color: "#FF2D78" },
    refunded:        { label: "↺ ERSTATTET",     color: "#8B8FA3" },
  };
  const m = map[status] ?? { label: status.toUpperCase(), color: "#FF2D78" };
  return <div style={{ fontSize: 9, color: m.color, fontWeight: 900, letterSpacing: 0.5 }}>{m.label}</div>;
}

function AddonChip({ label, active, sub }: { label: string; active: boolean; sub: string }) {
  return (
    <div style={{
      padding: 10, borderRadius: 10,
      background: active ? "rgba(74,222,128,0.12)" : "rgba(255,255,255,0.04)",
      border: `1px solid ${active ? "#4ade80" : "rgba(255,255,255,0.08)"}`,
    }}>
      <div style={{ fontSize: 11, color: active ? "#4ade80" : "#8B8FA3", fontWeight: 900, letterSpacing: 0.5 }}>
        {active ? "✓" : "○"} {label}
      </div>
      <div style={{ fontSize: 10, color: "#a8b4cf", marginTop: 2 }}>{sub}</div>
    </div>
  );
}
