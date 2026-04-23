"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import QRCode from "qrcode";
import { Trophy, Flame, Gift, Smartphone, Map as MapIcon, QrCode as QrIcon, Apple, Play } from "lucide-react";

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
          padding: "30px 28px 22px",
          borderRadius: 18,
          background: "#141a28",
          border: "1px solid rgba(255,255,255,0.06)",
          boxShadow: "0 20px 60px rgba(0,0,0,0.5)",
          overflow: "hidden",
        }}>
          {/* Dezentes Punktmuster */}
          <div aria-hidden style={{
            position: "absolute", inset: 0,
            backgroundImage: "radial-gradient(rgba(255,255,255,0.05) 1px, transparent 1px)",
            backgroundSize: "12px 12px",
            pointerEvents: "none",
          }} />

          {/* Gebogene Neon-Streifen (wie in der Vorlage) */}
          <svg aria-hidden style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%", pointerEvents: "none" }}
            viewBox="0 0 400 600" preserveAspectRatio="xMidYMid slice">
            <defs>
              <linearGradient id="streakCyan" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="#22D1C3" stopOpacity="0.0" />
                <stop offset="40%" stopColor="#22D1C3" stopOpacity="0.55" />
                <stop offset="100%" stopColor="#22D1C3" stopOpacity="0.0" />
              </linearGradient>
              <linearGradient id="streakMagenta" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="#FF2D78" stopOpacity="0.0" />
                <stop offset="50%" stopColor="#FF2D78" stopOpacity="0.55" />
                <stop offset="100%" stopColor="#FF2D78" stopOpacity="0.0" />
              </linearGradient>
            </defs>
            {/* Links cyan Bogen */}
            <path d="M -40 100 Q 20 300 -40 500" stroke="url(#streakCyan)" strokeWidth="3" fill="none" />
            <path d="M -30 80 Q 60 300 -30 520" stroke="#22D1C3" strokeOpacity="0.25" strokeWidth="1" fill="none" />
            {/* Rechts magenta Bogen */}
            <path d="M 440 100 Q 380 300 440 500" stroke="url(#streakMagenta)" strokeWidth="3" fill="none" />
            <path d="M 430 80 Q 340 300 430 520" stroke="#FF2D78" strokeOpacity="0.25" strokeWidth="1" fill="none" />
          </svg>

          {/* Header */}
          <div style={{ display: "flex", alignItems: "flex-start", gap: 14, position: "relative" }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 36, fontWeight: 900, lineHeight: 0.98, color: "#FFF", letterSpacing: -0.8 }}>
                CHECK-IN
              </div>
              <div style={{ fontSize: 36, fontWeight: 900, lineHeight: 0.98, color: "#22D1C3", letterSpacing: -0.8 }}>
                &amp; BOOST
              </div>
              <div style={{ fontSize: 42, fontWeight: 900, lineHeight: 0.98, color: "#FFD700", letterSpacing: -0.8, marginTop: 4 }}>
                ABHOLEN!
              </div>
              <div style={{ fontSize: 13, color: "#FFF", marginTop: 14, lineHeight: 1.4, maxWidth: 260, fontWeight: 700 }}>
                Die App, bei der <span style={{ color: "#FFD700" }}>Gehen &amp; Laufen</span><br />
                zu <span style={{ color: "#22D1C3" }}>echten Rabatten</span> werden.
              </div>
              <div style={{ fontSize: 11, color: "#a8b4cf", marginTop: 6, lineHeight: 1.4, maxWidth: 240 }}>
                Scanne den Code für deine exklusive Belohnung.
              </div>
            </div>
            <div style={{ position: "relative", flexShrink: 0, textAlign: "center" }}>
              <div aria-hidden style={{
                position: "absolute", top: -12, left: -12, width: 140, height: 140, borderRadius: "50%",
                background: "radial-gradient(circle, rgba(34,209,195,0.32), transparent 65%)",
              }} />
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/logo.png" alt=""
                style={{
                  position: "relative",
                  width: 116, height: 116, borderRadius: "50%",
                  border: "2.5px solid rgba(34,209,195,0.5)",
                  boxShadow: "0 6px 24px rgba(34,209,195,0.3)",
                  objectFit: "cover",
                }} />
              <div style={{
                position: "relative",
                fontSize: 16, fontWeight: 900, color: "#FFF",
                letterSpacing: -0.3, marginTop: 8,
              }}>
                My<span style={{ color: "#22D1C3" }}>Area</span>365
              </div>
            </div>
          </div>

          {/* QR links · Schritte rechts — harmonisch, gleiche Höhe & Rahmen */}
          <div style={{
            position: "relative",
            display: "flex", gap: 12, alignItems: "stretch",
            margin: "20px 0 14px",
          }}>
            {/* QR-Panel mit Teal-Border + Scan-Hint oben */}
            <div style={{
              position: "relative",
              width: 220, flexShrink: 0,
              padding: 12, borderRadius: 12,
              background: "rgba(15,17,21,0.55)",
              border: "1px solid rgba(34,209,195,0.15)",
              display: "flex", flexDirection: "column", gap: 10,
              boxSizing: "border-box",
            }}>
              <div style={{ fontSize: 12, fontWeight: 900, letterSpacing: 1, color: "#22D1C3", textAlign: "center" }}>
                📷 SCAN MICH
              </div>
              <div style={{
                position: "relative",
                flex: 1,
                borderRadius: 10,
                background: "#FFF",
                padding: 10,
                boxSizing: "border-box",
                boxShadow: "0 6px 20px rgba(0,0,0,0.4)",
                display: "flex", alignItems: "center", justifyContent: "center",
              }}>
                {qrUrl && (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img src={qrUrl} alt="QR-Code"
                    style={{ width: "100%", height: "auto", display: "block" }} />
                )}
                <div style={{
                  position: "absolute", top: "50%", left: "50%", transform: "translate(-50%, -50%)",
                  width: 34, height: 34, borderRadius: 8,
                  background: "#0F1115", padding: 3,
                  boxSizing: "border-box",
                  boxShadow: "0 2px 8px rgba(0,0,0,0.3)",
                }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src="/logo.png" alt=""
                    style={{ width: "100%", height: "100%", borderRadius: 6, objectFit: "cover" }} />
                </div>
              </div>
            </div>

            {/* SO GEHT'S rechts daneben — gleicher Panel-Style */}
            <div style={{
              flex: 1, minWidth: 0,
              padding: 12, borderRadius: 12,
              background: "rgba(15,17,21,0.55)",
              border: "1px solid rgba(34,209,195,0.15)",
              display: "flex", flexDirection: "column", gap: 10,
              boxSizing: "border-box",
            }}>
              <div style={{ fontSize: 12, fontWeight: 900, letterSpacing: 1, color: "#22D1C3", textAlign: "center" }}>
                📱 SO GEHT&apos;S
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 11, flex: 1, justifyContent: "center" }}>
                <InlineStep n={1} Icon={Smartphone} text={<>App <b style={{ color: "#22D1C3" }}>MyArea365</b> öffnen</>} />
                <InlineStep n={2} Icon={MapIcon} text="Running-Point tippen" />
                <InlineStep n={3} Icon={QrIcon} text={<>Code scannen &amp;<br />Belohnung sichern!</>} />
              </div>
            </div>
          </div>

          {/* BELOHNUNGEN — volle Breite */}
          <div style={{
            position: "relative",
            padding: "14px 16px", borderRadius: 12,
            background: "rgba(255,255,255,0.03)",
            border: "1px solid rgba(255,255,255,0.08)",
            marginBottom: 14,
          }}>
            <div style={{ fontSize: 13, fontWeight: 900, letterSpacing: 1.5, color: "#22D1C3", marginBottom: 12 }}>
              🎁 DEINE BELOHNUNGEN
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <BenefitLine Icon={Trophy} iconColor="#FFD700" text={<>+<b style={{ color: "#FFD700" }}>1.000 Wegemünzen</b> für dich beim ersten Scan</>} />
              <BenefitLine Icon={Flame}  iconColor="#FF6B4A" text={<><b style={{ color: "#FF6B4A" }}>2× MÜNZEN-BOOST</b> (1 Stunde nach Scan)</>} />
              <BenefitLine Icon={Gift}   iconColor="#FF2D78" text={<><b style={{ color: "#FF2D78" }}>EXKLUSIVE SHOP-BELOHNUNGEN</b> — nur hier</>} />
            </div>
          </div>

          {/* NEU HIER? — großer Überzeugungs-Block für Nicht-User */}
          <div style={{
            position: "relative",
            padding: "18px 18px", borderRadius: 14,
            background: "linear-gradient(135deg, rgba(255,215,0,0.16), rgba(255,45,120,0.12))",
            border: "1.5px solid rgba(255,215,0,0.45)",
            marginBottom: 12,
            textAlign: "center",
          }}>
            <div style={{ fontSize: 13, fontWeight: 900, letterSpacing: 2, color: "#FFD700", marginBottom: 6 }}>
              ✨ NOCH NICHT DABEI?
            </div>
            <div style={{ fontSize: 15, fontWeight: 900, color: "#FFF", lineHeight: 1.3 }}>
              Spaziergang mit Kaffee zum <span style={{ color: "#FFD700" }}>halben Preis</span>.
            </div>
            <div style={{ fontSize: 12, fontWeight: 700, color: "#D0D0D5", marginTop: 6, lineHeight: 1.45 }}>
              Die App ist <b style={{ color: "#4ade80" }}>kostenlos</b> · <b style={{ color: "#4ade80" }}>kein Abo</b> · <b style={{ color: "#4ade80" }}>kein Tracking-Wahn</b><br />
              Unterstütze deine lokalen Geschäfte — nicht den nächsten Konzern.
            </div>

            {/* App-Store-Badges integriert in den Block */}
            <div style={{ display: "flex", gap: 8, justifyContent: "center", marginTop: 12 }}>
              <AppStoreBadge kind="ios" />
              <AppStoreBadge kind="android" />
            </div>

            <div style={{ color: "#FFF", fontWeight: 900, fontSize: 13, marginTop: 10 }}>
              Jetzt downloaden &middot; <span style={{ color: "#22D1C3" }}>myarea365.de</span>
            </div>
          </div>

          {/* Footer */}
          <div style={{ position: "relative", textAlign: "center" }}>
            <div style={{ fontSize: 10, color: "#8B8FA3" }}>
              Unterstützt von deinem Kiez.
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

type IconComp = React.ComponentType<{ size?: number; color?: string; strokeWidth?: number; fill?: string }>;

function BenefitLine({ Icon, iconColor, text }: { Icon: IconComp; iconColor: string; text: React.ReactNode }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
      <div style={{ width: 24, flexShrink: 0, display: "flex", justifyContent: "center" }}>
        <Icon size={22} color={iconColor} strokeWidth={2.25} fill={iconColor} />
      </div>
      <div style={{ fontSize: 13, color: "#FFF", fontWeight: 700, lineHeight: 1.35 }}>{text}</div>
    </div>
  );
}

function InlineStep({ n, Icon, text }: { n: number; Icon: IconComp; text: React.ReactNode }) {
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 10,
      padding: "8px 10px", borderRadius: 10,
      background: "rgba(34,209,195,0.05)",
      border: "1px solid rgba(34,209,195,0.12)",
    }}>
      <div style={{
        width: 26, height: 26, borderRadius: "50%",
        background: "linear-gradient(135deg, #22D1C3, #5ddaf0)",
        color: "#0F1115", fontSize: 13, fontWeight: 900,
        display: "flex", alignItems: "center", justifyContent: "center",
        flexShrink: 0,
        boxShadow: "0 2px 8px rgba(34,209,195,0.4)",
      }}>{n}</div>
      <div style={{ width: 20, display: "flex", justifyContent: "center", flexShrink: 0 }}>
        <Icon size={17} color="#22D1C3" strokeWidth={2.25} />
      </div>
      <div style={{ fontSize: 13, color: "#FFF", lineHeight: 1.3, fontWeight: 600 }}>{text}</div>
    </div>
  );
}

function AppStoreBadge({ kind }: { kind: "ios" | "android" }) {
  const isIos = kind === "ios";
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 8,
      padding: "7px 12px", borderRadius: 8,
      background: "#0F1115",
      border: "1px solid rgba(255,255,255,0.15)",
      color: "#FFF", minWidth: 120,
    }}>
      {isIos
        ? <Apple size={22} color="#FFF" fill="#FFF" strokeWidth={0} />
        : <Play size={22} color="#FFF" fill="#FFF" strokeWidth={0} />}
      <div style={{ lineHeight: 1, textAlign: "left" }}>
        <div style={{ fontSize: 7, color: "#a8b4cf", fontWeight: 600, letterSpacing: 0.5 }}>
          {isIos ? "Laden im" : "JETZT BEI"}
        </div>
        <div style={{ fontSize: 14, fontWeight: 800, marginTop: 1 }}>
          {isIos ? "App Store" : "Google Play"}
        </div>
      </div>
    </div>
  );
}
