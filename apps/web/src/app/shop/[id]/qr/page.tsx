"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import QRCode from "qrcode";
import { Trophy, Flame, Gift, Smartphone, Map, QrCode, CreditCard } from "lucide-react";

const STAND_VARIANTS = [
  { id: "a5_table",  label: "A5 Tischaufsteller",   price: 1290, desc: "Perfekt für Theke / Tisch. Acryl-Halter mit gedrucktem QR-Einleger." },
  { id: "a4_table",  label: "A4 Tischaufsteller",   price: 1890, desc: "Größere Variante für Wartebereiche oder Eingang." },
  { id: "a4_wall",   label: "A4 Wand-Schild",       price: 2190, desc: "Zum Aufhängen — mit Klebestreifen + Schrauben-Set." },
] as const;

export default function ShopQrPrintPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const payload = `myarea:redeem:${id}`;
  const [standOpen, setStandOpen] = useState(false);
  const [qrUrl, setQrUrl] = useState<string>("");

  useEffect(() => {
    QRCode.toDataURL(payload, {
      width: 600, margin: 2,
      errorCorrectionLevel: "H",  // hoch, damit Logo-Overlay in der Mitte möglich ist
      color: { dark: "#0F1115", light: "#FFFFFF" },
    }).then(setQrUrl).catch(() => setQrUrl(""));
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
          padding: "28px 28px 24px",
          borderRadius: 20,
          background: "linear-gradient(160deg, #0c1424 0%, #0a0e1a 45%, #12172c 100%)",
          border: "1px solid rgba(34,209,195,0.25)",
          boxShadow: "0 20px 60px rgba(0,0,0,0.5), 0 0 80px rgba(34,209,195,0.08)",
          overflow: "hidden",
        }}>
          {/* Dezentes Punktmuster im Hintergrund */}
          <div aria-hidden style={{
            position: "absolute", inset: 0,
            backgroundImage: "radial-gradient(rgba(255,255,255,0.05) 1px, transparent 1px)",
            backgroundSize: "14px 14px",
            pointerEvents: "none",
          }} />
          {/* Brand-Akzente: kräftigere Eck-Glows */}
          <div aria-hidden style={{
            position: "absolute", top: -80, right: -80, width: 320, height: 320,
            borderRadius: "50%",
            background: "radial-gradient(circle, rgba(34,209,195,0.32), transparent 65%)",
            pointerEvents: "none",
          }} />
          <div aria-hidden style={{
            position: "absolute", bottom: -100, left: -80, width: 320, height: 320,
            borderRadius: "50%",
            background: "radial-gradient(circle, rgba(255,45,120,0.28), transparent 65%)",
            pointerEvents: "none",
          }} />

          {/* Header — 2-spaltig, Markenwort-Bar */}
          <div style={{ display: "flex", alignItems: "center", gap: 14, position: "relative" }}>
            <div style={{ flex: 1 }}>
              <div style={{
                display: "inline-block",
                fontSize: 9, fontWeight: 900, letterSpacing: 3, color: "#22D1C3",
                padding: "3px 8px", borderRadius: 4,
                background: "rgba(34,209,195,0.12)", border: "1px solid rgba(34,209,195,0.4)",
                marginBottom: 10,
              }}>MYAREA365</div>
              <div style={{ fontSize: 30, fontWeight: 900, lineHeight: 1, color: "#FFF", letterSpacing: -0.5 }}>
                SCANNE &<br />
                <span style={{ color: "#FFD700", fontSize: 34 }}>KASSIEREN!</span>
              </div>
              <div style={{ fontSize: 12, color: "#a8b4cf", marginTop: 8, lineHeight: 1.4, maxWidth: 240 }}>
                Scanne den Code für deine<br />exklusive Belohnung.
              </div>
            </div>
            <div style={{ position: "relative", flexShrink: 0 }}>
              <div aria-hidden style={{
                position: "absolute", inset: -10, borderRadius: 20,
                background: "radial-gradient(circle, rgba(34,209,195,0.3), transparent 70%)",
              }} />
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/logo.png" alt="MyArea365"
                style={{
                  position: "relative",
                  width: 68, height: 68, borderRadius: 16,
                  border: "1.5px solid rgba(34,209,195,0.4)",
                  boxShadow: "0 4px 20px rgba(34,209,195,0.3)",
                  objectFit: "cover",
                }} />
            </div>
          </div>

          {/* QR-Code mit Logo-Overlay */}
          <div style={{
            position: "relative",
            margin: "24px auto 20px",
            width: 280, height: 280,
            borderRadius: 20,
            background: "#FFF",
            padding: 16,
            boxSizing: "border-box",
            boxShadow: "0 12px 40px rgba(0,0,0,0.55), 0 0 0 4px rgba(34,209,195,0.25)",
          }}>
            {qrUrl && (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img src={qrUrl} alt="QR-Code" width={248} height={248}
                style={{ width: "100%", height: "100%", display: "block", objectFit: "contain" }} />
            )}
            <div style={{
              position: "absolute", top: "50%", left: "50%", transform: "translate(-50%, -50%)",
              width: 50, height: 50, borderRadius: 10,
              background: "#FFF", padding: 4,
              boxSizing: "border-box",
              boxShadow: "0 2px 10px rgba(0,0,0,0.25)",
            }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/logo.png" alt=""
                style={{ width: "100%", height: "100%", borderRadius: 6, objectFit: "cover" }} />
            </div>
          </div>

          {/* Benefits — in container mit leichtem Frame */}
          <div style={{
            position: "relative",
            padding: "14px 16px", borderRadius: 14,
            background: "rgba(255,255,255,0.03)",
            border: "1px solid rgba(255,255,255,0.08)",
            marginBottom: 14,
            display: "flex", flexDirection: "column", gap: 12,
          }}>
            <BenefitRow Icon={Trophy} color="#FFD700"
              title="Wegemünzen + Rabatt"
              body="Runner zahlt 🪙 — du gibst Rabatt an der Kasse" />
            <BenefitRow Icon={Flame} color="#22D1C3"
              title="Crew-Stempel"
              body="Stammkunden-Bindung für Nachbarschafts-Crews" />
            <BenefitRow Icon={Gift} color="#FF2D78"
              title="Bonus-Loot"
              body="Kassenbon fotografieren = extra Belohnung" />
          </div>

          {/* Steps — in container */}
          <div style={{
            position: "relative",
            padding: "14px 16px", borderRadius: 14,
            background: "rgba(15,17,21,0.55)",
            border: "1px solid rgba(34,209,195,0.15)",
            marginBottom: 14,
          }}>
            <div style={{ fontSize: 9, fontWeight: 900, letterSpacing: 2, color: "#22D1C3", marginBottom: 10 }}>
              IN 4 SCHRITTEN EINLÖSEN
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
              <StepRow n={1} Icon={Smartphone} body={<>App <b style={{ color: "#22D1C3" }}>MyArea365</b> öffnen</>} />
              <StepRow n={2} Icon={Map} body="Shop auf der Karte antippen" />
              <StepRow n={3} Icon={QrCode} body="Code scannen · GPS bestätigt automatisch" />
              <StepRow n={4} Icon={CreditCard} body="Rabatt an der Kasse abholen" />
            </div>
          </div>

          {/* Footer */}
          <div style={{
            position: "relative",
            paddingTop: 12,
            textAlign: "center",
          }}>
            <div style={{ color: "#F0F0F0", fontWeight: 900, fontSize: 15, letterSpacing: 0.3 }}>
              myarea365.de
            </div>
            <div style={{ fontSize: 11, color: "#8B8FA3", marginTop: 3 }}>
              Jetzt downloaden — unterstützt von deinem Kiez.
            </div>
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

type IconComp = React.ComponentType<{ size?: number; color?: string; strokeWidth?: number }>;

function BenefitRow({ Icon, color, title, body }: { Icon: IconComp; color: string; title: string; body: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
      <div style={{
        width: 38, height: 38, borderRadius: 10, flexShrink: 0,
        background: `${color}1a`,
        border: `1px solid ${color}55`,
        display: "flex", alignItems: "center", justifyContent: "center",
        boxShadow: `0 0 16px ${color}33`,
      }}>
        <Icon size={20} color={color} strokeWidth={2.25} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 15, fontWeight: 900, color, letterSpacing: 0.2 }}>{title}</div>
        <div style={{ fontSize: 11.5, color: "#a8b4cf", marginTop: 1, lineHeight: 1.4 }}>{body}</div>
      </div>
    </div>
  );
}

function StepRow({ n, Icon, body }: { n: number; Icon: IconComp; body: React.ReactNode }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
      <div style={{
        width: 24, height: 24, borderRadius: "50%",
        background: "linear-gradient(135deg, #22D1C3, #5ddaf0)",
        color: "#0F1115", fontSize: 11, fontWeight: 900,
        display: "flex", alignItems: "center", justifyContent: "center",
        flexShrink: 0,
      }}>{n}</div>
      <div style={{ width: 22, display: "flex", justifyContent: "center", flexShrink: 0 }}>
        <Icon size={16} color="#a8b4cf" strokeWidth={2} />
      </div>
      <div style={{ fontSize: 12.5, color: "#D0D0D5", lineHeight: 1.4 }}>{body}</div>
    </div>
  );
}
