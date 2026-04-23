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
    // Brand-Gradient im QR — dark-teal Module auf weißem Tile
    QRCode.toCanvas(canvasRef.current, payload, {
      width: 560, margin: 2,
      errorCorrectionLevel: "H",  // hoch, damit Logo-Overlay in der Mitte möglich ist
      color: { dark: "#0F1115", light: "#FFFFFF" },
    }).catch(() => {});
  }, [payload]);

  return (
    <div style={{
      minHeight: "100vh",
      background: "radial-gradient(ellipse at 20% 0%, #1a2340 0%, #0F1115 60%)",
      color: "#F0F0F0",
      display: "flex", alignItems: "center", justifyContent: "center",
      padding: 24, fontFamily: "system-ui, -apple-system, sans-serif",
    }}>
      <div style={{ maxWidth: 560, width: "100%" }}>
        {/* Haupt-Poster (druckbar) */}
        <div className="print-poster" style={{
          position: "relative",
          padding: 32,
          borderRadius: 20,
          background: "linear-gradient(145deg, #111826 0%, #0F1115 60%, #141b2e 100%)",
          border: "1px solid rgba(34,209,195,0.25)",
          boxShadow: "0 20px 60px rgba(0,0,0,0.5), 0 0 80px rgba(34,209,195,0.08)",
          overflow: "hidden",
        }}>
          {/* Brand-Akzente: Eck-Glows */}
          <div style={{
            position: "absolute", top: -60, right: -60, width: 260, height: 260,
            borderRadius: "50%",
            background: "radial-gradient(circle, rgba(34,209,195,0.22), transparent 70%)",
            pointerEvents: "none",
          }} />
          <div style={{
            position: "absolute", bottom: -80, left: -60, width: 260, height: 260,
            borderRadius: "50%",
            background: "radial-gradient(circle, rgba(255,45,120,0.18), transparent 70%)",
            pointerEvents: "none",
          }} />

          {/* Header */}
          <div style={{ display: "flex", alignItems: "flex-start", gap: 14, position: "relative" }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 32, fontWeight: 900, lineHeight: 1.05, color: "#FFF", letterSpacing: -0.5 }}>
                SCANNE &<br />
                <span style={{ color: "#FFD700" }}>KASSIERE!</span>
              </div>
              <div style={{ fontSize: 12, color: "#a8b4cf", marginTop: 8, lineHeight: 1.4, maxWidth: 240 }}>
                Scanne den Code für<br />deine exklusive Belohnung.
              </div>
            </div>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo.png" alt="MyArea365"
              style={{ width: 64, height: 64, borderRadius: 16, flexShrink: 0, boxShadow: "0 4px 20px rgba(34,209,195,0.3)" }} />
          </div>
          <div style={{
            fontSize: 10, fontWeight: 900, letterSpacing: 3,
            color: "#22D1C3", marginTop: 14, display: "flex", gap: 10, alignItems: "center",
          }}>
            <span style={{ display: "inline-block", width: 28, height: 1, background: "#22D1C3" }} />
            MYAREA365
            <span style={{ display: "inline-block", flex: 1, height: 1, background: "rgba(34,209,195,0.3)" }} />
          </div>

          {/* QR-Code mit Logo-Overlay */}
          <div style={{
            margin: "18px auto 0",
            width: 260, height: 260,
            borderRadius: 18,
            background: "#FFF",
            padding: 14,
            position: "relative",
            boxShadow: "0 8px 30px rgba(0,0,0,0.4)",
          }}>
            <canvas ref={canvasRef} width={560} height={560}
              style={{ width: "100%", height: "100%", display: "block" }} />
            {/* Logo-Overlay in der Mitte (Error-Correction H verzeiht bis zu ~25 %) */}
            <div style={{
              position: "absolute", top: "50%", left: "50%", transform: "translate(-50%, -50%)",
              width: 52, height: 52, borderRadius: 12,
              background: "#FFF", padding: 6,
              boxShadow: "0 2px 10px rgba(0,0,0,0.2)",
            }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/logo.png" alt="" style={{ width: "100%", height: "100%", borderRadius: 8 }} />
            </div>
          </div>

          {/* Benefits */}
          <div style={{ marginTop: 22, display: "flex", flexDirection: "column", gap: 8 }}>
            <Benefit icon="🏆" color="#FFD700"
              title="Wegemünzen + Rabatt" body="Runner zahlt 🪙, du gibst Rabatt an der Kasse" />
            <Benefit icon="🗂️" color="#22D1C3"
              title="Crew-Stempel" body="Stammkunden-Bindung für Nachbarschafts-Crews" />
            <Benefit icon="🎁" color="#FF2D78"
              title="Bonus-Loot" body="Kassenbon fotografieren = extra Belohnung" />
          </div>

          {/* Steps */}
          <div style={{
            marginTop: 20, padding: 14, borderRadius: 12,
            background: "rgba(15,17,21,0.55)",
            border: "1px solid rgba(255,255,255,0.08)",
          }}>
            <div style={{ fontSize: 9, fontWeight: 900, letterSpacing: 2, color: "#8B8FA3", marginBottom: 8 }}>
              SO FUNKTIONIERT&apos;S
            </div>
            <ol style={{ margin: 0, paddingLeft: 20, color: "#D0D0D5", fontSize: 12, lineHeight: 1.7 }}>
              <li>App <b style={{ color: "#22D1C3" }}>MyArea365</b> öffnen</li>
              <li>Shop auf der Karte antippen</li>
              <li>Code scannen &middot; GPS bestätigt automatisch</li>
              <li>Rabatt an der Kasse abholen</li>
            </ol>
          </div>

          {/* Footer */}
          <div style={{
            marginTop: 18, textAlign: "center",
            fontSize: 11, color: "#8B8FA3", lineHeight: 1.5,
          }}>
            <div style={{ color: "#F0F0F0", fontWeight: 900, fontSize: 13 }}>
              myarea365.de · Jetzt downloaden
            </div>
            <div style={{ marginTop: 2 }}>Unterstützt von deinem Kiez.</div>
          </div>
        </div>

        {/* Aktions-Buttons (nicht druckbar) */}
        <div className="no-print" style={{ marginTop: 14, display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button
            onClick={() => window.print()}
            style={{
              flex: "1 1 auto", minWidth: 180,
              padding: "12px 18px", borderRadius: 10,
              background: "linear-gradient(135deg, #22D1C3, #5ddaf0)",
              color: "#0F1115", border: "none",
              fontSize: 13, fontWeight: 900, cursor: "pointer",
            }}
          >
            🖨️ Selbst drucken (A5 / A4)
          </button>
          <div style={{
            padding: "6px 10px", borderRadius: 8, fontSize: 10, color: "#8B8FA3",
            border: "1px solid rgba(255,255,255,0.1)", alignSelf: "center",
          }}>
            Druckt automatisch in <b style={{ color: "#F0F0F0" }}>tinten-sparend weiß</b> — für das dunkle Premium-Design bestell den Acryl-Aufsteller.
          </div>
        </div>
        <div className="no-print" style={{ fontSize: 10, color: "#6c7590", marginTop: 8, textAlign: "center", fontFamily: "ui-monospace, monospace" }}>
          {payload}
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

      <style>{`
        @media print {
          @page { margin: 12mm; size: auto; }
          button, .no-print { display: none !important }

          /* Tinten-sparend weiß drucken — dunkle Hintergründe + Glows aushebeln */
          html, body { background: #FFF !important; color: #0F1115 !important; }
          .print-poster {
            background: #FFF !important;
            border: 2px dashed #0F1115 !important;
            box-shadow: none !important;
          }
          .print-poster > div[aria-hidden],
          .print-poster > div:first-of-type ~ div[style*="radial-gradient"],
          .print-poster div[style*="radial-gradient"] {
            display: none !important;
          }
          .print-poster * {
            color: #0F1115 !important;
            background: transparent !important;
            border-color: #0F1115 !important;
            box-shadow: none !important;
            text-shadow: none !important;
          }
          /* QR-Code-Tile bleibt weiß mit schwarzem Code */
          .print-poster canvas { filter: none !important; }
          /* Farbige Accent-Texte print-schwarz */
          .print-poster [style*="color: #FFD700"],
          .print-poster [style*="color: #22D1C3"],
          .print-poster [style*="color: #FF2D78"],
          .print-poster [style*="color: #a8b4cf"],
          .print-poster [style*="color: #8B8FA3"],
          .print-poster [style*="color: #D0D0D5"] {
            color: #0F1115 !important;
          }
        }
      `}</style>
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

function Benefit({ icon, color, title, body }: { icon: string; color: string; title: string; body: string }) {
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 10,
      padding: 10, borderRadius: 10,
      background: "rgba(255,255,255,0.03)",
      border: `1px solid ${color}33`,
    }}>
      <div style={{
        width: 36, height: 36, borderRadius: 10,
        background: `${color}22`, border: `1px solid ${color}55`,
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: 18, flexShrink: 0,
      }}>{icon}</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 900, color }}>{title}</div>
        <div style={{ fontSize: 11, color: "#a8b4cf", marginTop: 1 }}>{body}</div>
      </div>
    </div>
  );
}
