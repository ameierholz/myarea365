"use client";

import { use, useEffect, useState } from "react";
import QRCode from "qrcode";
import { Trophy, Flame, Gift, Smartphone, Map as MapIcon, QrCode as QrIcon, Apple, Play } from "lucide-react";
import { useTranslations } from "next-intl";

type QrT = ReturnType<typeof useTranslations<"ShopQr">>;

const STAND_VARIANTS_BASE = [
  { id: "a5_table", price: 1290, labelKey: "standA5Label", descKey: "standA5Desc" },
  { id: "a4_table", price: 1890, labelKey: "standA4Label", descKey: "standA4Desc" },
  { id: "a4_wall",  price: 2190, labelKey: "standWallLabel", descKey: "standWallDesc" },
] as const;

type StandVariant = { id: string; label: string; price: number; desc: string };

export default function ShopQrPrintPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const t = useTranslations("ShopQr");
  const payload = `myarea:redeem:${id}`;
  const [standOpen, setStandOpen] = useState(false);
  const [qrUrl, setQrUrl] = useState<string>("");

  useEffect(() => {
    QRCode.toDataURL(payload, {
      width: 600, margin: 2,
      errorCorrectionLevel: "H",
      color: { dark: "#0F1115", light: "#FFFFFF" },
    }).then(setQrUrl).catch(() => setQrUrl(""));
  }, [payload]);

  const variants: StandVariant[] = STAND_VARIANTS_BASE.map((v) => ({
    id: v.id, price: v.price,
    label: t(v.labelKey), desc: t(v.descKey),
  }));

  return (
    <div style={{
      minHeight: "100vh",
      background: "radial-gradient(ellipse at 20% 0%, #1a2340 0%, #0F1115 60%)",
      color: "#F0F0F0",
      display: "flex", alignItems: "center", justifyContent: "center",
      padding: 24, fontFamily: "system-ui, -apple-system, sans-serif",
    }}>
      <div style={{ maxWidth: 560, width: "100%" }}>
        <div className="print-poster" style={{
          position: "relative",
          padding: "30px 28px 22px",
          borderRadius: 18,
          background: "#141a28",
          border: "1px solid rgba(255,255,255,0.06)",
          boxShadow: "0 20px 60px rgba(0,0,0,0.5)",
          overflow: "hidden",
        }}>
          <div aria-hidden style={{
            position: "absolute", inset: 0,
            backgroundImage: "radial-gradient(rgba(255,255,255,0.05) 1px, transparent 1px)",
            backgroundSize: "12px 12px",
            pointerEvents: "none",
          }} />

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
            <path d="M -40 100 Q 20 300 -40 500" stroke="url(#streakCyan)" strokeWidth="3" fill="none" />
            <path d="M -30 80 Q 60 300 -30 520" stroke="#22D1C3" strokeOpacity="0.25" strokeWidth="1" fill="none" />
            <path d="M 440 100 Q 380 300 440 500" stroke="url(#streakMagenta)" strokeWidth="3" fill="none" />
            <path d="M 430 80 Q 340 300 430 520" stroke="#FF2D78" strokeOpacity="0.25" strokeWidth="1" fill="none" />
          </svg>

          <div style={{ display: "flex", alignItems: "flex-start", gap: 14, position: "relative" }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 36, fontWeight: 900, lineHeight: 0.98, color: "#FFF", letterSpacing: -0.8 }}>
                {t("checkIn")}
              </div>
              <div style={{ fontSize: 36, fontWeight: 900, lineHeight: 0.98, color: "#22D1C3", letterSpacing: -0.8 }}>
                {t("boost")}
              </div>
              <div style={{ fontSize: 42, fontWeight: 900, lineHeight: 0.98, color: "#FFD700", letterSpacing: -0.8, marginTop: 4 }}>
                {t("pickup")}
              </div>
              <div style={{ fontSize: 13, color: "#FFF", marginTop: 14, lineHeight: 1.4, maxWidth: 260, fontWeight: 700 }}>
                {t("tagline1")} <span style={{ color: "#FFD700" }}>{t("taglineWalk")}</span><br />
                {t("tagline2")} <span style={{ color: "#22D1C3" }}>{t("taglineDeals")}</span>{t("tagline3")}
              </div>
              <div style={{ fontSize: 11, color: "#a8b4cf", marginTop: 6, lineHeight: 1.4, maxWidth: 240 }}>
                {t("scanHint")}
              </div>
            </div>
            <div style={{ position: "relative", flexShrink: 0, textAlign: "center" }}>
              <div aria-hidden style={{
                position: "absolute", top: -14, left: -14, width: 178, height: 178, borderRadius: "50%",
                background: "radial-gradient(circle, rgba(34,209,195,0.35), transparent 65%)",
              }} />
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/logo.png" alt=""
                style={{
                  position: "relative",
                  width: 150, height: 150, borderRadius: "50%",
                  border: "3px solid rgba(34,209,195,0.55)",
                  boxShadow: "0 8px 28px rgba(34,209,195,0.33)",
                  objectFit: "cover",
                }} />
              <div style={{
                position: "relative",
                fontSize: 19, fontWeight: 900, color: "#FFF",
                letterSpacing: -0.3, marginTop: 9,
              }}>
                My<span style={{ color: "#22D1C3" }}>Area</span>365
              </div>
            </div>
          </div>

          <div style={{
            position: "relative",
            display: "flex", gap: 12, alignItems: "stretch",
            margin: "20px 0 14px",
          }}>
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
                {t("scanMe")}
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
                  <img src={qrUrl} alt="QR"
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

            <div style={{
              flex: 1, minWidth: 0,
              padding: 12, borderRadius: 12,
              background: "rgba(15,17,21,0.55)",
              border: "1px solid rgba(34,209,195,0.15)",
              display: "flex", flexDirection: "column", gap: 10,
              boxSizing: "border-box",
            }}>
              <div style={{ fontSize: 12, fontWeight: 900, letterSpacing: 1, color: "#22D1C3", textAlign: "center" }}>
                {t("howTo")}
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 11, flex: 1, justifyContent: "center" }}>
                <InlineStep n={1} Icon={Smartphone} text={<>{t("step1Open")} {t("step1App")} <b style={{ color: "#22D1C3" }}>{t("step1Name")}</b></>} />
                <InlineStep n={2} Icon={MapIcon} text={t("step2")} />
                <InlineStep n={3} Icon={QrIcon} text={t("step3")} />
              </div>
            </div>
          </div>

          <div style={{
            position: "relative",
            padding: "14px 16px", borderRadius: 12,
            background: "rgba(255,255,255,0.03)",
            border: "1px solid rgba(255,255,255,0.08)",
            marginBottom: 14,
          }}>
            <div style={{ fontSize: 13, fontWeight: 900, letterSpacing: 1.5, color: "#22D1C3", marginBottom: 12 }}>
              {t("rewardsTitle")}
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <BenefitLine Icon={Trophy} iconColor="#FFD700" text={<>+<b style={{ color: "#FFD700" }}>{t("reward1Coins")}</b> {t("reward1Suffix")}</>} />
              <BenefitLine Icon={Flame}  iconColor="#FF6B4A" text={<><b style={{ color: "#FF6B4A" }}>{t("reward2Boost")}</b> {t("reward2Suffix")}</>} />
              <BenefitLine Icon={Gift}   iconColor="#FF2D78" text={<><b style={{ color: "#FF2D78" }}>{t("reward3Exclusive")}</b> {t("reward3Suffix")}</>} />
            </div>
          </div>

          <div style={{
            position: "relative",
            padding: "18px 18px", borderRadius: 14,
            background: "linear-gradient(135deg, rgba(255,215,0,0.16), rgba(255,45,120,0.12))",
            border: "1.5px solid rgba(255,215,0,0.45)",
            marginBottom: 12,
            textAlign: "center",
          }}>
            <div style={{ fontSize: 13, fontWeight: 900, letterSpacing: 2, color: "#FFD700", marginBottom: 6 }}>
              {t("newKicker")}
            </div>
            <div style={{ fontSize: 15, fontWeight: 900, color: "#FFF", lineHeight: 1.3 }}>
              {t("newHook")} <span style={{ color: "#FFD700" }}>{t("newHookHighlight")}</span>.
            </div>
            <div style={{ fontSize: 12, fontWeight: 700, color: "#D0D0D5", marginTop: 6, lineHeight: 1.45 }}>
              {t("newSubLine1AppIs")} <b style={{ color: "#4ade80" }}>{t("newSubLine1Free")}</b> {t("newSubLine1Sep")} <b style={{ color: "#4ade80" }}>{t("newSubLine1NoSub")}</b> {t("newSubLine1Sep")} <b style={{ color: "#4ade80" }}>{t("newSubLine1NoTrack")}</b><br />
              {t("newSubLine2")}
            </div>

            <div style={{ display: "flex", gap: 8, justifyContent: "center", marginTop: 12 }}>
              <AppStoreBadge kind="ios" t={t} />
              <AppStoreBadge kind="android" t={t} />
            </div>

            <div style={{ color: "#FFF", fontWeight: 900, fontSize: 13, marginTop: 10 }}>
              {t("downloadNow")} <span style={{ color: "#22D1C3" }}>myarea365.de</span>
            </div>
          </div>

          <div style={{ position: "relative", textAlign: "center" }}>
            <div style={{ fontSize: 10, color: "#8B8FA3" }}>
              {t("footer")}
            </div>
          </div>
        </div>

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
            {t("printBtn")}
          </button>
          <div style={{
            padding: "6px 10px", borderRadius: 8, fontSize: 10, color: "#8B8FA3",
            border: "1px solid rgba(255,255,255,0.1)", alignSelf: "center",
          }}>
            {t("printNote1")} <b style={{ color: "#F0F0F0" }}>{t("printNote2")}</b> {t("printNote3")}
          </div>
        </div>
        <div className="no-print" style={{ fontSize: 10, color: "#6c7590", marginTop: 8, textAlign: "center", fontFamily: "ui-monospace, monospace" }}>
          {payload}
        </div>

        <div className="no-print" style={{
          marginTop: 20, padding: 20, borderRadius: 16,
          background: "linear-gradient(135deg, #0F1115, #1A1D23)",
          color: "#FFF", border: "1px solid rgba(34,209,195,0.35)",
          boxShadow: "0 8px 30px rgba(0,0,0,0.15)",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 10 }}>
            <div style={{ fontSize: 32 }}>✨</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 10, color: "#22D1C3", fontWeight: 900, letterSpacing: 2 }}>{t("premiumKicker")}</div>
              <div style={{ fontSize: 18, fontWeight: 900 }}>{t("premiumTitle")}</div>
            </div>
          </div>
          <p style={{ fontSize: 13, color: "#a8b4cf", lineHeight: 1.5, marginBottom: 14 }}>
            {t("premiumBody")} <b style={{ color: "#FFF" }}>{t("premiumBodyAcryl")}</b> {t("premiumBodyRest")}
          </p>

          {!standOpen ? (
            <button onClick={() => setStandOpen(true)} style={{
              width: "100%", padding: "12px 20px", borderRadius: 10, border: "none",
              background: "linear-gradient(135deg, #22D1C3, #5ddaf0)",
              color: "#0F1115", fontSize: 14, fontWeight: 900, letterSpacing: 0.5,
              cursor: "pointer",
            }}>
              {t("premiumOpenBtn")}
            </button>
          ) : (
            <StandOrderForm shopId={id} variants={variants} onCancel={() => setStandOpen(false)} t={t} />
          )}
        </div>
      </div>

      <style>{`
        @media print {
          @page { margin: 12mm; size: auto; }
          button, .no-print { display: none !important }
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
          .print-poster canvas { filter: none !important; }
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

function StandOrderForm({ shopId, variants, onCancel, t }: {
  shopId: string;
  variants: StandVariant[];
  onCancel: () => void;
  t: QrT;
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
        setError(j.error ?? t("errOrder"));
        return;
      }
      if (j.checkout_url) window.location.href = j.checkout_url;
    } catch (err) {
      setError(err instanceof Error ? err.message : t("errNetwork"));
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
        <span>{t("fQty")}</span>
        <input type="number" min={1} max={20} value={qty} onChange={(e) => setQty(Math.max(1, Math.min(20, Number(e.target.value) || 1)))}
          style={INPUT_DARK} />
      </label>

      <h3 style={{ fontSize: 12, color: "#a8b4cf", margin: "4px 0 0", letterSpacing: 1 }}>{t("address")}</h3>
      <label style={LABEL}><span>{t("fName")}</span><input name="recipient_name" required style={INPUT_DARK} /></label>
      <label style={LABEL}><span>{t("fCompany")}</span><input name="recipient_company" style={INPUT_DARK} /></label>
      <label style={LABEL}><span>{t("fStreet")}</span><input name="street" required style={INPUT_DARK} /></label>
      <div style={{ display: "grid", gridTemplateColumns: "120px 1fr", gap: 8 }}>
        <label style={LABEL}><span>{t("fZip")}</span><input name="zip" required pattern="\d{4,5}" style={INPUT_DARK} /></label>
        <label style={LABEL}><span>{t("fCity")}</span><input name="city" required style={INPUT_DARK} /></label>
      </div>
      <label style={LABEL}><span>{t("fNotes")}</span><textarea name="notes" rows={2} style={INPUT_DARK} /></label>

      <div style={{
        marginTop: 6, padding: 10, borderRadius: 8,
        background: "rgba(255,215,0,0.1)", border: "1px solid rgba(255,215,0,0.3)",
        display: "flex", justifyContent: "space-between", alignItems: "center",
      }}>
        <span style={{ fontSize: 12, fontWeight: 700, color: "#a8b4cf" }}>{t("totalLabel")}</span>
        <span style={{ fontSize: 18, fontWeight: 900, color: "#FFD700" }}>{(totalCents / 100).toFixed(2)} €</span>
      </div>

      {error && <div style={{ fontSize: 12, color: "#FF2D78", fontWeight: 700 }}>⚠️ {error}</div>}

      <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
        <button type="button" onClick={onCancel} style={{
          flex: 1, padding: "10px 16px", borderRadius: 8,
          background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.15)",
          color: "#F0F0F0", fontSize: 12, fontWeight: 700, cursor: "pointer",
        }}>{t("abort")}</button>
        <button type="submit" disabled={busy} style={{
          flex: 2, padding: "10px 16px", borderRadius: 8, border: "none",
          background: "linear-gradient(135deg, #FFD700, #FF6B4A)",
          color: "#0F1115", fontSize: 13, fontWeight: 900, cursor: "pointer", opacity: busy ? 0.6 : 1,
        }}>
          {busy ? t("submitBusy") : t("submit")}
        </button>
      </div>

      <p style={{ fontSize: 10, color: "#8B8FA3", marginTop: 4, lineHeight: 1.4 }}>
        {t("submitFootnote")}
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

function AppStoreBadge({ kind, t }: { kind: "ios" | "android"; t: QrT }) {
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
          {isIos ? t("appStoreIosKicker") : t("appStoreAndroidKicker")}
        </div>
        <div style={{ fontSize: 14, fontWeight: 800, marginTop: 1 }}>
          {isIos ? t("appStoreIos") : t("appStoreAndroid")}
        </div>
      </div>
    </div>
  );
}
