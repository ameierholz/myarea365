"use client";

import { use, useEffect, useRef, useState } from "react";
import Link from "next/link";
import QRCode from "qrcode";

const STAND_VARIANTS = [
  { id: "a5_table",  label: "A5 Tischaufsteller",   price: 1290, desc: "Perfekt für Theke / Tisch. Acryl-Halter mit gedrucktem QR-Einleger." },
  { id: "a4_table",  label: "A4 Tischaufsteller",   price: 1890, desc: "Größere Variante für Wartebereiche oder Eingang." },
  { id: "a4_wall",   label: "A4 Wand-Schild",       price: 2190, desc: "Zum Aufhängen — mit Klebestreifen + Schrauben-Set." },
] as const;

export default function ShopQrPrintPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const payload = `myarea:redeem:${id}`;
  const [standOpen, setStandOpen] = useState(false);

  useEffect(() => {
    if (!canvasRef.current) return;
    QRCode.toCanvas(canvasRef.current, payload, { width: 480, margin: 2, color: { dark: "#0F1115", light: "#FFFFFF" } }).catch(() => {});
  }, [payload]);

  return (
    <div style={{
      minHeight: "100vh", background: "#FFF", color: "#0F1115",
      display: "flex", alignItems: "center", justifyContent: "center", padding: 30,
    }}>
      <div style={{ maxWidth: 560, width: "100%" }}>
        {/* Haupt-QR (druckbar) */}
        <div style={{
          textAlign: "center",
          padding: 30, borderRadius: 16, border: "2px dashed #0F1115",
        }}>
          <div style={{ fontSize: 14, fontWeight: 900, letterSpacing: 2, color: "#22D1C3", marginBottom: 4 }}>MYAREA365 · EINLÖSEN</div>
          <div style={{ fontSize: 28, fontWeight: 900, marginBottom: 6 }}>Scanne mich für deinen Deal</div>
          <div style={{ fontSize: 13, color: "#555", marginBottom: 20 }}>
            Öffne die MyArea365-App → Shop öffnen → „Jetzt einlösen" → Kamera auf diesen Code
          </div>
          <canvas ref={canvasRef} width={480} height={480} style={{ margin: "0 auto" }} />
          <div style={{ fontSize: 11, color: "#888", marginTop: 16, fontFamily: "ui-monospace, monospace" }}>
            {payload}
          </div>
          <button
            onClick={() => window.print()}
            style={{
              marginTop: 20, padding: "12px 24px", borderRadius: 10,
              background: "#0F1115", color: "#FFF", border: "none",
              fontSize: 14, fontWeight: 900, cursor: "pointer",
            }}
          >
            🖨️ Selbst drucken
          </button>
        </div>

        {/* Acryl-Aufsteller-Bestellung (nicht druckbar) */}
        <div className="no-print" style={{
          marginTop: 20, padding: 20, borderRadius: 16,
          background: "linear-gradient(135deg, #0F1115, #1A1D23)",
          color: "#FFF", border: "1px solid rgba(34,209,195,0.35)",
          boxShadow: "0 8px 30px rgba(0,0,0,0.15)",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 10 }}>
            <div style={{ fontSize: 32 }}>✨</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 10, color: "#22D1C3", fontWeight: 900, letterSpacing: 2 }}>PREMIUM-OPTION</div>
              <div style={{ fontSize: 18, fontWeight: 900 }}>Professionellen Aufsteller bestellen</div>
            </div>
          </div>
          <p style={{ fontSize: 13, color: "#a8b4cf", lineHeight: 1.5, marginBottom: 14 }}>
            Lass dir einen fertig gedruckten, hochwertigen <b style={{ color: "#FFF" }}>Acryl-Aufsteller</b> mit
            deinem QR-Code per Post schicken. Sieht professionell aus, hält jahrelang, wird von Kunden sofort gesehen.
            Versand innerhalb 5–7 Werktagen.
          </p>

          {!standOpen ? (
            <button onClick={() => setStandOpen(true)} style={{
              width: "100%", padding: "12px 20px", borderRadius: 10, border: "none",
              background: "linear-gradient(135deg, #22D1C3, #5ddaf0)",
              color: "#0F1115", fontSize: 14, fontWeight: 900, letterSpacing: 0.5,
              cursor: "pointer",
            }}>
              📦 Aufsteller bestellen — ab 12,90 €
            </button>
          ) : (
            <StandOrderForm shopId={id} variants={STAND_VARIANTS} onCancel={() => setStandOpen(false)} />
          )}
        </div>
      </div>

      <style>{`@media print { button, .no-print { display: none !important } }`}</style>
    </div>
  );
}

function StandOrderForm({ shopId, variants, onCancel }: {
  shopId: string;
  variants: typeof STAND_VARIANTS;
  onCancel: () => void;
}) {
  const [variant, setVariant] = useState<string>(variants[0].id);
  const [qty, setQty] = useState(1);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true); setError(null);
    const fd = new FormData(e.currentTarget);
    try {
      const res = await fetch("/api/shop/stand-order", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({
          shop_id: shopId,
          variant,
          quantity: qty,
          recipient_name: String(fd.get("recipient_name") ?? "").trim(),
          recipient_company: String(fd.get("recipient_company") ?? "").trim() || null,
          street: String(fd.get("street") ?? "").trim(),
          zip: String(fd.get("zip") ?? "").trim(),
          city: String(fd.get("city") ?? "").trim(),
          notes: String(fd.get("notes") ?? "").trim() || null,
        }),
      });
      const j = await res.json();
      if (!j.ok) {
        setError(j.error ?? "Fehler beim Anlegen der Bestellung");
        return;
      }
      if (j.checkout_url) window.location.href = j.checkout_url;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Netzwerkfehler");
    } finally {
      setBusy(false);
    }
  }

  const selected = variants.find((v) => v.id === variant)!;
  const totalCents = selected.price * qty;

  return (
    <form onSubmit={submit} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <div style={{ display: "grid", gap: 6 }}>
        {variants.map((v) => (
          <label key={v.id} style={{
            padding: 10, borderRadius: 8,
            background: variant === v.id ? "rgba(34,209,195,0.15)" : "rgba(255,255,255,0.04)",
            border: `1px solid ${variant === v.id ? "#22D1C3" : "rgba(255,255,255,0.1)"}`,
            cursor: "pointer", display: "flex", alignItems: "center", gap: 10,
          }}>
            <input type="radio" name="variant" checked={variant === v.id} onChange={() => setVariant(v.id)} />
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, fontWeight: 900 }}>{v.label}</div>
              <div style={{ fontSize: 10, color: "#a8b4cf" }}>{v.desc}</div>
            </div>
            <div style={{ fontSize: 14, fontWeight: 900, color: "#FFD700" }}>
              {(v.price / 100).toFixed(2)} €
            </div>
          </label>
        ))}
      </div>

      <label style={LABEL}>
        <span>Anzahl</span>
        <input type="number" min={1} max={20} value={qty} onChange={(e) => setQty(Math.max(1, Math.min(20, Number(e.target.value) || 1)))}
          style={INPUT_DARK} />
      </label>

      <h3 style={{ fontSize: 12, color: "#a8b4cf", margin: "4px 0 0", letterSpacing: 1 }}>LIEFERADRESSE</h3>
      <label style={LABEL}><span>Name *</span><input name="recipient_name" required style={INPUT_DARK} /></label>
      <label style={LABEL}><span>Firma (optional)</span><input name="recipient_company" style={INPUT_DARK} /></label>
      <label style={LABEL}><span>Straße + Nr. *</span><input name="street" required style={INPUT_DARK} /></label>
      <div style={{ display: "grid", gridTemplateColumns: "120px 1fr", gap: 8 }}>
        <label style={LABEL}><span>PLZ *</span><input name="zip" required pattern="\d{4,5}" style={INPUT_DARK} /></label>
        <label style={LABEL}><span>Ort *</span><input name="city" required style={INPUT_DARK} /></label>
      </div>
      <label style={LABEL}><span>Anmerkungen (optional)</span><textarea name="notes" rows={2} style={INPUT_DARK} /></label>

      <div style={{
        marginTop: 6, padding: 10, borderRadius: 8,
        background: "rgba(255,215,0,0.1)", border: "1px solid rgba(255,215,0,0.3)",
        display: "flex", justifyContent: "space-between", alignItems: "center",
      }}>
        <span style={{ fontSize: 12, fontWeight: 700, color: "#a8b4cf" }}>Gesamt inkl. Versand</span>
        <span style={{ fontSize: 18, fontWeight: 900, color: "#FFD700" }}>{(totalCents / 100).toFixed(2)} €</span>
      </div>

      {error && <div style={{ fontSize: 12, color: "#FF2D78", fontWeight: 700 }}>⚠️ {error}</div>}

      <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
        <button type="button" onClick={onCancel} style={{
          flex: 1, padding: "10px 16px", borderRadius: 8,
          background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.15)",
          color: "#F0F0F0", fontSize: 12, fontWeight: 700, cursor: "pointer",
        }}>Abbrechen</button>
        <button type="submit" disabled={busy} style={{
          flex: 2, padding: "10px 16px", borderRadius: 8, border: "none",
          background: "linear-gradient(135deg, #FFD700, #FF6B4A)",
          color: "#0F1115", fontSize: 13, fontWeight: 900, cursor: "pointer", opacity: busy ? 0.6 : 1,
        }}>
          {busy ? "Wird gebucht…" : "Jetzt bestellen → Zahlung"}
        </button>
      </div>

      <p style={{ fontSize: 10, color: "#8B8FA3", marginTop: 4, lineHeight: 1.4 }}>
        Nach Klick öffnet sich Stripe-Checkout. Nach Zahlungseingang drucken & versenden wir innerhalb 5–7 Werktagen.
      </p>
    </form>
  );
}

const LABEL: React.CSSProperties = { display: "flex", flexDirection: "column", gap: 3, fontSize: 11, color: "#a8b4cf", fontWeight: 700 };
const INPUT_DARK: React.CSSProperties = {
  padding: "8px 10px", borderRadius: 6,
  background: "#0F1115", border: "1px solid rgba(255,255,255,0.15)",
  color: "#FFF", fontSize: 13, fontFamily: "inherit",
};
