"use client";

import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { appAlert } from "@/components/app-dialog";

type Step = "confirm" | "scan" | "redeeming" | "active" | "done" | "expired";

type Props = {
  businessId: string;
  businessName: string;
  dealTitle: string;
  xpCost: number;
  userXp: number;
  onClose: () => void;
  onRedeemed?: (xpLeft: number) => void;
};

type RedeemResult = {
  ok: boolean;
  error?: string;
  id?: string;
  code?: string;
  expires_at?: string;
  have?: number;
  need?: number;
};

export function RedeemFlow(props: Props) {
  const { businessId, businessName, dealTitle, xpCost, userXp, onClose, onRedeemed } = props;
  const [step, setStep] = useState<Step>(userXp >= xpCost ? "confirm" : "expired");
  const [code, setCode] = useState("");
  const [redemptionId, setRedemptionId] = useState<string | null>(null);
  const [expiresAt, setExpiresAt] = useState<string | null>(null);
  const [now, setNow] = useState(Date.now());
  const [scanError, setScanError] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const scanIntervalRef = useRef<number | null>(null);
  const sb = createClient();

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(id);
  }, []);

  // Live-Poll: ob Shop verified hat
  useEffect(() => {
    if (step !== "active" || !redemptionId) return;
    const poll = async () => {
      const { data } = await sb.from("deal_redemptions")
        .select("status").eq("id", redemptionId).single();
      if (data?.status === "verified") setStep("done");
    };
    const id = setInterval(poll, 2000);
    return () => clearInterval(id);
  }, [step, redemptionId, sb]);

  // Auto-expire wenn Zeit abläuft
  useEffect(() => {
    if (step !== "active" || !expiresAt) return;
    if (new Date(expiresAt).getTime() < now) setStep("expired");
  }, [step, expiresAt, now]);

  // Kamera starten wenn step === scan
  useEffect(() => {
    if (step !== "scan") return;
    let cancelled = false;
    (async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "environment" }, audio: false,
        });
        if (cancelled) { stream.getTracks().forEach((t) => t.stop()); return; }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }
        // QR-Scan-Schleife
        const detector = typeof window !== "undefined" && "BarcodeDetector" in window
          ? new (window as unknown as { BarcodeDetector: new (opts: { formats: string[] }) => { detect(src: HTMLVideoElement): Promise<Array<{ rawValue: string }>> } }).BarcodeDetector({ formats: ["qr_code"] })
          : null;
        if (!detector) {
          setScanError("QR-Scanner nicht verfügbar. Bitte Code manuell eingeben oder Browser updaten.");
          return;
        }
        scanIntervalRef.current = window.setInterval(async () => {
          if (!videoRef.current) return;
          try {
            const results = await detector.detect(videoRef.current);
            const first = results[0]?.rawValue;
            if (first) {
              // Erwartet: myarea:redeem:<businessId> ODER eine URL mit ?shop=<id>
              const m = first.match(/myarea:redeem:([0-9a-f-]{36})/i) ||
                        first.match(/[?&]shop=([0-9a-f-]{36})/i);
              const scannedId = m?.[1];
              if (scannedId === businessId) {
                cleanupCamera();
                void doRedeem();
              } else if (scannedId) {
                setScanError("Dieser QR gehört zu einem anderen Shop.");
              }
            }
          } catch { /* ignore single-frame errors */ }
        }, 500);
      } catch (e) {
        setScanError(
          e instanceof Error && e.name === "NotAllowedError"
            ? "Kamera-Zugriff wurde abgelehnt."
            : "Kamera konnte nicht gestartet werden.",
        );
      }
    })();
    return () => {
      cancelled = true;
      cleanupCamera();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step]);

  function cleanupCamera() {
    if (scanIntervalRef.current) { clearInterval(scanIntervalRef.current); scanIntervalRef.current = null; }
    if (streamRef.current) { streamRef.current.getTracks().forEach((t) => t.stop()); streamRef.current = null; }
  }

  async function doRedeem() {
    setStep("redeeming");
    try {
      // Deal-ID holen (erster aktiver Deal dieses Shops, der passt)
      const { data: deal } = await sb.from("deals")
        .select("id, title, xp_cost")
        .eq("business_id", businessId)
        .eq("active", true)
        .limit(1)
        .maybeSingle();
      if (!deal) throw new Error("Kein aktiver Deal für diesen Shop");

      const res = await fetch("/api/deals/redeem", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ business_id: businessId, deal_id: deal.id }),
      });
      const json = (await res.json()) as RedeemResult;
      if (!json.ok) {
        appAlert(json.error ?? "Fehler beim Einlösen");
        setStep("confirm");
        return;
      }
      setRedemptionId(json.id!);
      setCode(json.code!);
      setExpiresAt(json.expires_at!);
      setStep("active");
      onRedeemed?.(userXp - xpCost);
    } catch (e) {
      appAlert(e instanceof Error ? e.message : String(e));
      setStep("confirm");
    }
  }

  async function doManualCode() {
    const manual = prompt("Manueller Shop-Code (von Shop-Inhaber):");
    if (!manual) return;
    if (manual === businessId.slice(0, 8).toUpperCase() || manual === businessId) {
      cleanupCamera();
      void doRedeem();
    } else {
      setScanError("Shop-Code falsch.");
    }
  }

  const secondsLeft = expiresAt ? Math.max(0, Math.floor((new Date(expiresAt).getTime() - now) / 1000)) : 0;
  const mm = Math.floor(secondsLeft / 60);
  const ss = secondsLeft % 60;

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed", inset: 0, zIndex: 2500,
        background: "rgba(15,17,21,0.92)", backdropFilter: "blur(12px)",
        display: "flex", alignItems: "center", justifyContent: "center", padding: 16,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "100%", maxWidth: 460, maxHeight: "92vh", overflowY: "auto",
          background: "#1A1D23", borderRadius: 20,
          border: "1px solid rgba(255,215,0,0.5)",
          boxShadow: "0 20px 60px rgba(0,0,0,0.6), 0 0 40px rgba(255,215,0,0.25)",
          color: "#F0F0F0",
        }}
      >
        {/* Header */}
        <div style={{ padding: "16px 18px", borderBottom: "1px solid rgba(255,255,255,0.08)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <div style={{ color: "#FFD700", fontSize: 10, fontWeight: 900, letterSpacing: 1.5 }}>EINLÖSEN</div>
            <div style={{ color: "#FFF", fontSize: 14, fontWeight: 900 }}>{businessName}</div>
          </div>
          <button onClick={onClose} style={{ background: "rgba(255,255,255,0.08)", border: "none", color: "#a8b4cf", width: 32, height: 32, borderRadius: 999, cursor: "pointer", fontSize: 16 }}>✕</button>
        </div>

        {step === "expired" && userXp < xpCost && (
          <div style={{ padding: 24, textAlign: "center" }}>
            <div style={{ fontSize: 48, marginBottom: 8 }}>⚡</div>
            <div style={{ color: "#FFF", fontSize: 18, fontWeight: 900, marginBottom: 4 }}>Nicht genug XP</div>
            <div style={{ color: "#a8b4cf", fontSize: 13, marginBottom: 16 }}>
              Du hast <b style={{ color: "#FFD700" }}>{userXp.toLocaleString("de-DE")} XP</b>, brauchst aber <b style={{ color: "#FFD700" }}>{xpCost.toLocaleString("de-DE")} XP</b> für "{dealTitle}".
              <br /><br />Sammel weitere <b>{(xpCost - userXp).toLocaleString("de-DE")} XP</b> durch Läufe oder im Shop.
            </div>
            <button onClick={onClose} style={btnSecondary}>Zurück</button>
          </div>
        )}

        {step === "confirm" && (
          <div style={{ padding: 20 }}>
            <div style={{ padding: 16, borderRadius: 14, background: "rgba(255,215,0,0.1)", border: "1px solid rgba(255,215,0,0.4)", marginBottom: 16 }}>
              <div style={{ color: "#a8b4cf", fontSize: 10, fontWeight: 800, letterSpacing: 1 }}>AKTUELLER DEAL</div>
              <div style={{ color: "#FFF", fontSize: 16, fontWeight: 900, margin: "4px 0 10px" }}>{dealTitle}</div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ color: "#FFF", fontSize: 13 }}>Kosten</span>
                <span style={{ color: "#FFD700", fontSize: 22, fontWeight: 900 }}>{xpCost.toLocaleString("de-DE")} XP</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", marginTop: 6, fontSize: 11, color: "#a8b4cf" }}>
                <span>Dein XP-Stand</span>
                <span>{userXp.toLocaleString("de-DE")} XP → <b style={{ color: "#22D1C3" }}>{(userXp - xpCost).toLocaleString("de-DE")} nach Einlösen</b></span>
              </div>
            </div>

            <div style={{ color: "#a8b4cf", fontSize: 12, lineHeight: 1.5, marginBottom: 14 }}>
              Im nächsten Schritt scannst du den <b>Shop-QR-Code</b> vor Ort. XP werden erst bei erfolgreichem Scan abgezogen.
              Eine Bestätigung bleibt <b>5 Minuten gültig</b>.
            </div>

            <button onClick={() => setStep("scan")} style={btnPrimary}>
              📷 Kamera öffnen & QR scannen
            </button>
          </div>
        )}

        {step === "scan" && (
          <div style={{ padding: 20 }}>
            <div style={{
              position: "relative", aspectRatio: "1 / 1",
              borderRadius: 14, overflow: "hidden",
              background: "#000", marginBottom: 12,
              border: "2px solid rgba(255,215,0,0.5)",
            }}>
              <video ref={videoRef} playsInline muted style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              {/* Scan-Rahmen */}
              <div style={{
                position: "absolute", inset: "15%", borderRadius: 14,
                border: "3px solid #FFD700",
                boxShadow: "0 0 0 9999px rgba(0,0,0,0.4)",
                animation: "redeemScanPulse 1.6s ease-in-out infinite",
              }} />
            </div>
            <div style={{ color: "#a8b4cf", fontSize: 12, textAlign: "center", marginBottom: 10 }}>
              Richte die Kamera auf den QR-Code am Shop-Tresen.
            </div>
            {scanError && (
              <div style={{ padding: 10, borderRadius: 10, background: "rgba(255,45,120,0.15)", border: "1px solid rgba(255,45,120,0.4)", color: "#FF2D78", fontSize: 12, marginBottom: 10 }}>
                {scanError}
              </div>
            )}
            <button onClick={doManualCode} style={btnSecondary}>Code manuell eingeben</button>
            <style>{`@keyframes redeemScanPulse { 0%,100% { opacity: 1 } 50% { opacity: 0.5 } }`}</style>
          </div>
        )}

        {step === "redeeming" && (
          <div style={{ padding: 40, textAlign: "center" }}>
            <div style={{ fontSize: 36, animation: "spin 1s linear infinite" }}>⟳</div>
            <div style={{ color: "#FFF", fontSize: 14, fontWeight: 800, marginTop: 10 }}>Prüfe & ziehe XP ab …</div>
            <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
          </div>
        )}

        {step === "active" && (
          <div style={{ padding: 18 }}>
            <div style={{ textAlign: "center", marginBottom: 8 }}>
              <div style={{ color: "#22D1C3", fontSize: 11, fontWeight: 900, letterSpacing: 1.5 }}>⏳ ZEIGE DIESEN SCREEN AN DER KASSE</div>
            </div>

            <div style={{
              position: "relative",
              background: "linear-gradient(135deg, #FFD700, #FF6B4A)",
              borderRadius: 18, padding: 24, textAlign: "center",
              color: "#0F1115", marginBottom: 14,
              overflow: "hidden",
            }}>
              {/* Rotating glow */}
              <div style={{
                position: "absolute", inset: -40,
                background: "conic-gradient(from 0deg, rgba(255,255,255,0.4), transparent 30%, transparent 70%, rgba(255,255,255,0.4))",
                animation: "redeemSpin 4s linear infinite",
                pointerEvents: "none",
              }} />
              <div style={{ position: "relative" }}>
                <div style={{ fontSize: 11, fontWeight: 900, letterSpacing: 2, opacity: 0.8 }}>EIN-MAL-CODE</div>
                <div style={{
                  fontSize: 56, fontWeight: 900, letterSpacing: 8,
                  marginTop: 4, fontFamily: "ui-monospace, monospace",
                  textShadow: "0 2px 8px rgba(0,0,0,0.25)",
                }}>{code}</div>
                <div style={{ fontSize: 14, fontWeight: 800, marginTop: 6 }}>{dealTitle}</div>
                <div style={{ fontSize: 11, marginTop: 4, opacity: 0.75 }}>
                  ✓ {xpCost.toLocaleString("de-DE")} XP abgezogen
                </div>
              </div>
            </div>

            {/* Countdown */}
            <div style={{
              padding: 12, borderRadius: 12,
              background: secondsLeft < 60 ? "rgba(255,45,120,0.15)" : "rgba(34,209,195,0.12)",
              border: `1px solid ${secondsLeft < 60 ? "rgba(255,45,120,0.4)" : "rgba(34,209,195,0.4)"}`,
              display: "flex", alignItems: "center", gap: 10, marginBottom: 10,
            }}>
              <span style={{ fontSize: 24 }}>{secondsLeft < 60 ? "⚠️" : "⏱️"}</span>
              <div style={{ flex: 1 }}>
                <div style={{ color: secondsLeft < 60 ? "#FF2D78" : "#22D1C3", fontSize: 13, fontWeight: 900 }}>
                  Gültig noch {mm}:{ss.toString().padStart(2, "0")}
                </div>
                <div style={{ color: "#a8b4cf", fontSize: 10 }}>
                  Live-Code · Screenshot verfällt mit Zeitablauf
                </div>
              </div>
              <PulseDot />
            </div>

            <div style={{ color: "#a8b4cf", fontSize: 11, textAlign: "center", lineHeight: 1.4 }}>
              Kassierer gibt den 6-stelligen Code in seinem Dashboard ein. <br />
              Bei Bestätigung → grüner ✓-Screen erscheint automatisch.
            </div>
            <style>{`@keyframes redeemSpin { to { transform: rotate(360deg) } }`}</style>
          </div>
        )}

        {step === "done" && (
          <div style={{ padding: 30, textAlign: "center" }}>
            <div style={{
              fontSize: 80, marginBottom: 10,
              animation: "redeemPop 0.6s cubic-bezier(0.34, 1.56, 0.64, 1)",
            }}>✅</div>
            <div style={{ color: "#4ade80", fontSize: 22, fontWeight: 900 }}>Eingelöst!</div>
            <div style={{ color: "#FFF", fontSize: 14, marginTop: 4 }}>{dealTitle}</div>
            <div style={{ color: "#a8b4cf", fontSize: 12, marginTop: 10 }}>Viel Spaß im Shop!</div>
            <button onClick={onClose} style={{ ...btnPrimary, marginTop: 20 }}>Schließen</button>
            <style>{`@keyframes redeemPop { 0% { transform: scale(0.3); opacity: 0 } 60% { transform: scale(1.2) } 100% { transform: scale(1); opacity: 1 } }`}</style>
          </div>
        )}

        {step === "expired" && userXp >= xpCost && (
          <div style={{ padding: 24, textAlign: "center" }}>
            <div style={{ fontSize: 40, marginBottom: 8 }}>⌛</div>
            <div style={{ color: "#FF2D78", fontSize: 18, fontWeight: 900, marginBottom: 6 }}>Zeit abgelaufen</div>
            <div style={{ color: "#a8b4cf", fontSize: 12, marginBottom: 16 }}>
              Die Einlösung wurde nicht innerhalb von 5 Minuten bestätigt.
              Die XP-Abbuchung wird am nächsten Werktag automatisch rückerstattet.
            </div>
            <button onClick={onClose} style={btnSecondary}>Schließen</button>
          </div>
        )}
      </div>
    </div>
  );
}

function PulseDot() {
  return (
    <span style={{
      display: "inline-block", width: 10, height: 10, borderRadius: 999,
      background: "#4ade80", animation: "redeemDot 1s ease-in-out infinite",
    }}>
      <style>{`@keyframes redeemDot { 0%,100% { transform: scale(1); opacity: 1 } 50% { transform: scale(1.3); opacity: 0.6 } }`}</style>
    </span>
  );
}

const btnPrimary: React.CSSProperties = {
  width: "100%", padding: "14px 18px", borderRadius: 12,
  background: "linear-gradient(135deg, #FFD700, #FF6B4A)",
  color: "#0F1115", border: "none", cursor: "pointer",
  fontSize: 14, fontWeight: 900,
};

const btnSecondary: React.CSSProperties = {
  width: "100%", padding: "12px 16px", borderRadius: 12,
  background: "transparent", color: "#a8b4cf",
  border: "1px solid rgba(255,255,255,0.15)", cursor: "pointer",
  fontSize: 13, fontWeight: 700,
};
