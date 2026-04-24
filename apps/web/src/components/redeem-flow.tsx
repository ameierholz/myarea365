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

type CrewStamp = {
  ok: boolean;
  no_crew?: boolean;
  crew_id?: string;
  crew_name?: string;
  stamp_count?: number;
  tier_unlocked?: number;
  new_unlocks?: Array<{ tier: number; label: string; threshold: number; kind: string; value_int: number | null; value_text: string | null }>;
};

type RedeemResult = {
  ok: boolean;
  error?: string;
  id?: string;
  code?: string;
  expires_at?: string;
  have?: number;
  need?: number;
  crew_stamp?: CrewStamp | null;
};

export function RedeemFlow(props: Props) {
  const { businessId, businessName, dealTitle, xpCost, userXp, onClose, onRedeemed } = props;
  const [step, setStep] = useState<Step>(userXp >= xpCost ? "confirm" : "expired");
  const [code, setCode] = useState("");
  const [redemptionId, setRedemptionId] = useState<string | null>(null);
  const [expiresAt, setExpiresAt] = useState<string | null>(null);
  const [autoVerified, setAutoVerified] = useState(false);
  const [minOrderCents, setMinOrderCents] = useState<number | null>(null);
  const [crewStamp, setCrewStamp] = useState<CrewStamp | null>(null);
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

  // Live-Poll: ob Shop verified hat (+ Loot einsammeln)
  const [loot, setLoot] = useState<{ rarity: "common"|"rare"|"epic"|"legend"|"none"; xp: number } | null>(null);
  const [territoryBonus, setTerritoryBonus] = useState<{ xp: number; siegel: boolean } | null>(null);
  useEffect(() => {
    if (step !== "active" || !redemptionId) return;
    const poll = async () => {
      const { data } = await sb.from("deal_redemptions")
        .select("status, loot_rarity, loot_xp, territory_bonus_xp, territory_bonus_siegel").eq("id", redemptionId).single<{ status: string; loot_rarity: string | null; loot_xp: number | null; territory_bonus_xp: number | null; territory_bonus_siegel: boolean | null }>();
      if (data?.status === "verified") {
        if (data.loot_rarity && data.loot_rarity !== "none") {
          setLoot({ rarity: data.loot_rarity as "common"|"rare"|"epic"|"legend", xp: data.loot_xp ?? 0 });
        }
        if ((data.territory_bonus_xp ?? 0) > 0 || data.territory_bonus_siegel) {
          setTerritoryBonus({ xp: data.territory_bonus_xp ?? 0, siegel: !!data.territory_bonus_siegel });
        }
        setStep("done");
      }
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
        const isHttps = typeof window !== "undefined" &&
          (window.location.protocol === "https:" || window.location.hostname === "localhost");
        let msg: string;
        if (e instanceof Error && e.name === "NotAllowedError") {
          msg = "Kamera-Zugriff wurde abgelehnt — bitte in den Browser-Einstellungen erlauben (Schloss-Symbol in der Adressleiste → Kamera → Zulassen). Alternativ unten Code manuell eingeben.";
        } else if (e instanceof Error && e.name === "NotFoundError") {
          msg = "Keine Kamera gefunden. Nutze stattdessen Code manuell eingeben.";
        } else if (!isHttps) {
          msg = "Kamera braucht HTTPS oder localhost — diese Seite lädt nicht über HTTPS. Code manuell eingeben.";
        } else {
          msg = "Kamera konnte nicht gestartet werden. Code manuell eingeben oder Seite neu laden.";
        }
        setScanError(msg);
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
      // Deal-ID holen (erster aktiver Deal dieses Shops)
      const { data: deal } = await sb.from("shop_deals")
        .select("id, title, xp_cost, min_order_amount_cents")
        .eq("shop_id", businessId)
        .eq("active", true)
        .limit(1)
        .maybeSingle<{ id: string; title: string; xp_cost: number; min_order_amount_cents: number | null }>();
      if (!deal) throw new Error("Kein aktiver Deal für diesen Shop");

      setMinOrderCents(deal.min_order_amount_cents ?? null);

      // GPS-Position holen (best-effort, 3 s Timeout) — erlaubt Auto-Verify
      const coords = await getCoordsBestEffort(3000);

      const res = await fetch("/api/deals/redeem", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          business_id: businessId,
          deal_id: deal.id,
          lat: coords?.lat ?? null,
          lng: coords?.lng ?? null,
        }),
      });
      const json = (await res.json()) as RedeemResult & {
        auto_verified?: boolean; distance_m?: number | null;
        shop_name?: string; deal_title?: string; min_order_cents?: number | null;
      };
      if (!json.ok) {
        appAlert(json.error ?? "Fehler beim Einlösen");
        setStep("confirm");
        return;
      }
      setRedemptionId(json.id!);
      setCode(json.code!);
      setExpiresAt(json.expires_at!);
      setAutoVerified(!!json.auto_verified);
      setMinOrderCents(json.min_order_cents ?? deal.min_order_amount_cents ?? null);
      setCrewStamp(json.crew_stamp ?? null);
      // Bei Auto-Verify ist die Einlösung direkt abgeschlossen → active
      // (der Live-Poll erkennt status='verified' und schaltet auf 'done' sobald Loot da ist)
      setStep("active");
      onRedeemed?.(userXp - xpCost);
    } catch (e) {
      appAlert(e instanceof Error ? e.message : String(e));
      setStep("confirm");
    }
  }

  async function getCoordsBestEffort(timeoutMs: number): Promise<{ lat: number; lng: number } | null> {
    if (typeof navigator === "undefined" || !navigator.geolocation) return null;
    return new Promise((resolve) => {
      const timer = setTimeout(() => resolve(null), timeoutMs);
      navigator.geolocation.getCurrentPosition(
        (pos) => { clearTimeout(timer); resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }); },
        () => { clearTimeout(timer); resolve(null); },
        { enableHighAccuracy: true, timeout: timeoutMs, maximumAge: 10000 },
      );
    });
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
            <div style={{ color: "#FFF", fontSize: 18, fontWeight: 900, marginBottom: 4 }}>Nicht genug Wegemünzen</div>
            <div style={{ color: "#a8b4cf", fontSize: 13, marginBottom: 16 }}>
              Du hast <b style={{ color: "#FFD700" }}>{userXp.toLocaleString("de-DE")} 🪙</b>, brauchst aber <b style={{ color: "#FFD700" }}>{xpCost.toLocaleString("de-DE")} 🪙</b> für „{dealTitle}".
              <br /><br />Sammel weitere <b>{(xpCost - userXp).toLocaleString("de-DE")} Wegemünzen</b> durch Läufe oder im Shop.
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
                <span style={{ color: "#FFD700", fontSize: 22, fontWeight: 900 }}>{xpCost.toLocaleString("de-DE")} 🪙 Wegemünzen</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", marginTop: 6, fontSize: 11, color: "#a8b4cf" }}>
                <span>Dein Stand</span>
                <span>{userXp.toLocaleString("de-DE")} 🪙 → <b style={{ color: "#22D1C3" }}>{(userXp - xpCost).toLocaleString("de-DE")} nach Einlösen</b></span>
              </div>
            </div>

            <TerritoryLordBadge businessId={businessId} />
            <ShopQuestsPreview businessId={businessId} />

            <div style={{ color: "#a8b4cf", fontSize: 12, lineHeight: 1.5, marginBottom: 14 }}>
              Im nächsten Schritt scannst du den <b>Shop-QR-Code</b> vor Ort. Wegemünzen werden erst bei erfolgreichem Scan abgezogen.
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

        {step === "active" && autoVerified && (
          <div style={{ padding: 18 }}>
            <div style={{ textAlign: "center", marginBottom: 8 }}>
              <div style={{ color: "#4ade80", fontSize: 11, fontWeight: 900, letterSpacing: 2 }}>
                ✓ AN DER KASSE VORZEIGEN
              </div>
            </div>

            {/* Grünes Freigegeben-Panel — Personal muss nichts tun */}
            <div style={{
              position: "relative",
              background: "linear-gradient(135deg, #4ade80, #22D1C3)",
              borderRadius: 18, padding: 22, textAlign: "center",
              color: "#0F1115", marginBottom: 12, overflow: "hidden",
            }}>
              {/* Live-Sekundenring: rotiert in Echtzeit, lässt sich nicht screenshotten */}
              <div style={{
                position: "absolute", inset: -40,
                background: "conic-gradient(from 0deg, rgba(255,255,255,0.55), transparent 25%, transparent 75%, rgba(255,255,255,0.55))",
                animation: "redeemSpin 2s linear infinite",
                pointerEvents: "none",
              }} />
              <div style={{ position: "relative" }}>
                <div style={{ fontSize: 48 }}>✓</div>
                <div style={{ fontSize: 22, fontWeight: 900, marginTop: 4, textShadow: "0 1px 4px rgba(0,0,0,0.2)" }}>
                  {businessName}
                </div>
                <div style={{ fontSize: 13, fontWeight: 800, marginTop: 4, opacity: 0.85 }}>
                  {dealTitle}
                </div>
                <div style={{
                  fontSize: 10, fontWeight: 900, letterSpacing: 1,
                  marginTop: 10, padding: "4px 10px", borderRadius: 999,
                  display: "inline-block",
                  background: "rgba(15,17,21,0.85)", color: "#4ade80",
                }}>
                  VOR ORT BESTÄTIGT · {new Date(now).toLocaleTimeString("de-DE")}
                </div>
              </div>
            </div>

            {/* Mindest-Einkauf groß */}
            {minOrderCents !== null && minOrderCents > 0 && (
              <div style={{
                padding: 14, borderRadius: 12,
                background: "rgba(255,215,0,0.14)",
                border: "1px solid rgba(255,215,0,0.45)",
                textAlign: "center", marginBottom: 10,
              }}>
                <div style={{ fontSize: 10, fontWeight: 900, letterSpacing: 2, color: "#FFD700" }}>
                  MINDESTUMSATZ
                </div>
                <div style={{ fontSize: 32, fontWeight: 900, color: "#FFD700", marginTop: 2, lineHeight: 1 }}>
                  {(minOrderCents / 100).toFixed(2).replace(".", ",")} €
                </div>
                <div style={{ fontSize: 10, color: "#a8b4cf", marginTop: 4 }}>
                  muss an der Kasse erreicht werden
                </div>
              </div>
            )}

            {/* Crew-Stempel */}
            {crewStamp && !crewStamp.no_crew && crewStamp.stamp_count != null && (
              <CrewStampWidget stamp={crewStamp} />
            )}

            {/* Countdown-Warnung (60 s hart) */}
            <div style={{
              padding: 10, borderRadius: 10,
              background: "rgba(255,45,120,0.1)",
              border: "1px solid rgba(255,45,120,0.3)",
              display: "flex", alignItems: "center", gap: 10, marginBottom: 10,
            }}>
              <span style={{ fontSize: 20 }}>⚠️</span>
              <div style={{ flex: 1 }}>
                <div style={{ color: "#FF2D78", fontSize: 12, fontWeight: 900 }}>
                  Gültig noch {mm}:{ss.toString().padStart(2, "0")}
                </div>
                <div style={{ color: "#a8b4cf", fontSize: 10 }}>
                  Der Live-Ring rotiert — Screenshot erkennt man an stehendem Ring.
                </div>
              </div>
              <PulseDot />
            </div>

            <div style={{ color: "#a8b4cf", fontSize: 11, textAlign: "center", lineHeight: 1.5 }}>
              Personal schaut nur auf diesen Screen: ✓ grün + rotierender Ring + Shop-Name = echt.
            </div>
            <style>{`@keyframes redeemSpin { to { transform: rotate(360deg) } }`}</style>
          </div>
        )}

        {step === "active" && !autoVerified && (
          <div style={{ padding: 18 }}>
            <div style={{ textAlign: "center", marginBottom: 8 }}>
              <div style={{ color: "#FFD700", fontSize: 11, fontWeight: 900, letterSpacing: 1.5 }}>⏳ CODE AN DER KASSE ZEIGEN</div>
              <div style={{ color: "#a8b4cf", fontSize: 10, marginTop: 2 }}>
                (GPS nicht bestätigt — Personal muss bestätigen)
              </div>
            </div>

            <div style={{
              position: "relative",
              background: "linear-gradient(135deg, #FFD700, #FF6B4A)",
              borderRadius: 18, padding: 24, textAlign: "center",
              color: "#0F1115", marginBottom: 14,
              overflow: "hidden",
            }}>
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
                  ✓ {xpCost.toLocaleString("de-DE")} 🪙 abgezogen
                </div>
              </div>
            </div>

            {minOrderCents !== null && minOrderCents > 0 && (
              <div style={{
                padding: 10, borderRadius: 10,
                background: "rgba(255,215,0,0.12)",
                border: "1px solid rgba(255,215,0,0.35)",
                textAlign: "center", marginBottom: 10,
              }}>
                <div style={{ fontSize: 9, fontWeight: 900, letterSpacing: 2, color: "#FFD700" }}>MINDESTUMSATZ</div>
                <div style={{ fontSize: 22, fontWeight: 900, color: "#FFD700", marginTop: 1 }}>
                  {(minOrderCents / 100).toFixed(2).replace(".", ",")} €
                </div>
              </div>
            )}

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

            {loot && loot.rarity !== "none" ? <LootReveal rarity={loot.rarity} xp={loot.xp} /> : (
              <div style={{ color: "#a8b4cf", fontSize: 11, marginTop: 14 }}>
                Kein Loot diesmal. Beim nächsten Einlösen wieder Glück haben!
              </div>
            )}

            {territoryBonus && (
              <div style={{
                marginTop: 12, padding: 12, borderRadius: 12,
                background: "linear-gradient(135deg, rgba(255,215,0,0.15), rgba(168,85,247,0.1))",
                border: "1px solid rgba(255,215,0,0.4)",
              }}>
                <div style={{ fontSize: 24, marginBottom: 4 }}>👑</div>
                <div style={{ color: "#FFD700", fontSize: 11, fontWeight: 900, letterSpacing: 2 }}>GEBIETSFÜRST-BONUS</div>
                {territoryBonus.xp > 0 && <div style={{ color: "#FFF", fontSize: 12, marginTop: 4 }}>+{territoryBonus.xp} XP</div>}
                {territoryBonus.siegel && <div style={{ color: "#FFF", fontSize: 12 }}>+1× Universal-Siegel</div>}
              </div>
            )}

            {redemptionId && (
              <ReceiptBonusSection redemptionId={redemptionId} onClose={onClose} />
            )}

            <button onClick={onClose} style={{ ...btnSecondary, marginTop: 14 }}>Schließen</button>
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

function TerritoryLordBadge({ businessId }: { businessId: string }) {
  const [state, setState] = useState<{ is_lord: boolean; active: boolean; radius_m: number; min_claims: number } | null>(null);
  useEffect(() => {
    fetch(`/api/shop/territory-lord?business_id=${businessId}`, { cache: "no-store" })
      .then((r) => r.ok ? r.json() : null)
      .then((d) => { if (d) setState(d); })
      .catch(() => {});
  }, [businessId]);
  if (!state || !state.active) return null;
  if (state.is_lord) {
    return (
      <div style={{
        padding: 10, borderRadius: 12, marginBottom: 10,
        background: "linear-gradient(135deg, rgba(255,215,0,0.2), rgba(168,85,247,0.15))",
        border: "1px solid rgba(255,215,0,0.4)", display: "flex", alignItems: "center", gap: 10,
      }}>
        <span style={{ fontSize: 24 }}>👑</span>
        <div style={{ flex: 1 }}>
          <div style={{ color: "#FFD700", fontSize: 11, fontWeight: 900, letterSpacing: 1.5 }}>GEBIETSFÜRST</div>
          <div style={{ color: "#a8b4cf", fontSize: 10 }}>Extra-XP & Siegel bei dieser Einlösung</div>
        </div>
      </div>
    );
  }
  return (
    <div style={{
      padding: 10, borderRadius: 12, marginBottom: 10,
      background: "rgba(139,143,163,0.1)", border: "1px dashed rgba(139,143,163,0.3)",
    }}>
      <div style={{ color: "#a8b4cf", fontSize: 11 }}>
        🗺️ Erobere <b>{state.min_claims}</b> Gebiete im <b>{state.radius_m}m</b>-Radius rings um diesen Shop (letzte 30 Tage) für den Gebietsfürst-Bonus.
      </div>
    </div>
  );
}

type QuestPreview = {
  id: string;
  title: string;
  description: string | null;
  article_pattern: string;
  reward_xp: number;
  reward_loot_rarity: string | null;
  my_completions: number;
  max_completions_per_user: number;
};

function ShopQuestsPreview({ businessId }: { businessId: string }) {
  const [quests, setQuests] = useState<QuestPreview[]>([]);
  useEffect(() => {
    fetch(`/api/shop/quests?business_id=${businessId}`, { cache: "no-store" })
      .then((r) => r.ok ? r.json() : null)
      .then((d) => { if (d) setQuests(d.quests ?? []); })
      .catch(() => {});
  }, [businessId]);
  const open = quests.filter((q) => q.my_completions < q.max_completions_per_user);
  if (open.length === 0) return null;
  return (
    <div style={{ padding: 12, borderRadius: 12, background: "rgba(34,209,195,0.08)", border: "1px solid rgba(34,209,195,0.3)", marginBottom: 14 }}>
      <div style={{ color: "#22D1C3", fontSize: 11, fontWeight: 900, letterSpacing: 1.5, marginBottom: 6 }}>🎯 OFFENE QUESTS</div>
      {open.slice(0, 3).map((q) => (
        <div key={q.id} style={{ padding: "6px 0", borderTop: "1px solid rgba(34,209,195,0.15)" }}>
          <div style={{ color: "#FFF", fontSize: 12, fontWeight: 800 }}>{q.title}</div>
          <div style={{ color: "#a8b4cf", fontSize: 10, marginTop: 2 }}>
            Tipp: Kaufe &quot;{q.article_pattern}&quot; → {q.reward_xp > 0 && `+${q.reward_xp} XP`}
            {q.reward_loot_rarity && ` + 🎁 ${q.reward_loot_rarity}-Item`}
          </div>
        </div>
      ))}
      <div style={{ color: "#8B8FA3", fontSize: 10, marginTop: 6 }}>
        Wird automatisch freigeschaltet wenn du den Bon hochlädst.
      </div>
    </div>
  );
}

type BonusResult = {
  ok: boolean;
  loot?: {
    rarity: "none" | "common" | "rare" | "epic" | "legendary";
    bonus_universal: number;
    bonus_typed: number;
    typed_rarity: string;
    item_id: string | null;
  };
  verified?: boolean;
  ocr_amount_cents?: number | null;
  ocr_confidence?: string;
  ocr_items?: string[];
  quests?: { ok: boolean; completed: Array<{ quest_id: string; title: string; matched_text: string; reward_xp: number; reward_loot_rarity: string | null; item_id: string | null }> } | null;
  error?: string;
  message?: string;
};

function ReceiptBonusSection({ redemptionId, onClose }: { redemptionId: string; onClose: () => void }) {
  const [expanded, setExpanded] = useState(false);
  const [amount, setAmount] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<BonusResult | null>(null);

  function pickFile(f: File) {
    setFile(f);
    const reader = new FileReader();
    reader.onload = () => setPreview(reader.result as string);
    reader.readAsDataURL(f);
  }

  async function submit() {
    if (!file || !amount) return;
    const cents = Math.round(parseFloat(amount.replace(",", ".")) * 100);
    if (!Number.isFinite(cents) || cents < 100) {
      appAlert("Bitte gültigen Betrag in € eingeben (mind. 1,00 €).");
      return;
    }
    setBusy(true);
    try {
      const buf = await file.arrayBuffer();
      const bytes = new Uint8Array(buf);
      let binary = "";
      for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
      const b64 = btoa(binary);
      const res = await fetch("/api/deals/receipt", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          redemption_id: redemptionId,
          amount_cents: cents,
          receipt_image_base64: b64,
          content_type: file.type,
        }),
      });
      const json = (await res.json()) as BonusResult;
      if (!json.ok) {
        appAlert(json.message ?? json.error ?? "Fehler beim Prüfen");
        setBusy(false);
        return;
      }
      setResult(json);
    } finally {
      setBusy(false);
    }
  }

  if (result) {
    const r = result.loot;
    const meta = r?.rarity === "legendary" ? { label: "LEGENDÄR", color: "#FFD700", emoji: "💎" }
              : r?.rarity === "epic"      ? { label: "EPISCH",   color: "#a855f7", emoji: "🔮" }
              : r?.rarity === "rare"      ? { label: "SELTEN",   color: "#22D1C3", emoji: "💠" }
              : r?.rarity === "common"    ? { label: "BONUS",    color: "#8B8FA3", emoji: "📦" }
              : { label: "KEIN BONUS",   color: "#8B8FA3", emoji: "—" };
    return (
      <div style={{ marginTop: 18, padding: 14, borderRadius: 14, background: `${meta.color}18`, border: `1px solid ${meta.color}55` }}>
        <div style={{ fontSize: 40 }}>{meta.emoji}</div>
        <div style={{ color: meta.color, fontSize: 11, fontWeight: 900, letterSpacing: 2, marginTop: 4 }}>{meta.label}</div>
        {r && r.rarity !== "none" && (
          <>
            {r.bonus_universal > 0 && <div style={{ color: "#FFF", fontSize: 13, marginTop: 6 }}>+{r.bonus_universal}× Universal-Siegel</div>}
            {r.bonus_typed > 0 && <div style={{ color: "#FFF", fontSize: 13 }}>+{r.bonus_typed}× {r.typed_rarity}-Siegel</div>}
            {r.item_id && <div style={{ color: "#FFD700", fontSize: 12, marginTop: 4, fontWeight: 700 }}>🎁 Ausrüstung erbeutet!</div>}
          </>
        )}
        {!result.verified && (
          <div style={{ color: "#FF6B4A", fontSize: 10, marginTop: 6 }}>
            ⚠️ Betrag konnte nicht eindeutig verifiziert werden — nur halber Bonus
          </div>
        )}
        {result.quests && result.quests.completed.length > 0 && (
          <div style={{ marginTop: 14, padding: 12, borderRadius: 12, background: "rgba(255,215,0,0.1)", border: "1px solid rgba(255,215,0,0.4)", textAlign: "left" }}>
            <div style={{ color: "#FFD700", fontSize: 11, fontWeight: 900, letterSpacing: 1.5, marginBottom: 6 }}>🎯 QUEST{result.quests.completed.length > 1 ? "S" : ""} ABGESCHLOSSEN!</div>
            {result.quests.completed.map((q) => (
              <div key={q.quest_id} style={{ padding: "6px 0", borderTop: "1px solid rgba(255,215,0,0.15)" }}>
                <div style={{ color: "#FFF", fontSize: 12, fontWeight: 800 }}>✓ {q.title}</div>
                <div style={{ color: "#a8b4cf", fontSize: 10, marginTop: 2 }}>
                  {q.reward_xp > 0 && <span>+{q.reward_xp} XP</span>}
                  {q.reward_loot_rarity && <span>{q.reward_xp > 0 ? " · " : ""}🎁 {q.reward_loot_rarity}-Item</span>}
                </div>
              </div>
            ))}
          </div>
        )}
        <button onClick={onClose} style={{ ...btnPrimary, marginTop: 12 }}>Fertig</button>
      </div>
    );
  }

  if (!expanded) {
    return (
      <button onClick={() => setExpanded(true)} style={{
        marginTop: 18, width: "100%", padding: "14px 16px", borderRadius: 12,
        background: "linear-gradient(135deg, rgba(34,209,195,0.18), rgba(255,215,0,0.2))",
        border: "1px dashed rgba(255,215,0,0.5)",
        color: "#FFF", cursor: "pointer", fontSize: 13, fontWeight: 800, textAlign: "left",
      }}>
        <div style={{ fontSize: 20, marginBottom: 2 }}>🧾 Bonus-Loot freischalten</div>
        <div style={{ fontSize: 11, fontWeight: 500, color: "#a8b4cf", lineHeight: 1.4 }}>
          Kassenbon hochladen → Extra-Siegel & Ausrüstung je nach Einkaufswert
        </div>
      </button>
    );
  }

  return (
    <div style={{ marginTop: 18, padding: 14, borderRadius: 14, background: "rgba(34,209,195,0.08)", border: "1px solid rgba(34,209,195,0.3)", textAlign: "left" }}>
      <div style={{ color: "#22D1C3", fontSize: 11, fontWeight: 900, letterSpacing: 1.5 }}>BONUS-LOOT</div>
      <div style={{ color: "#a8b4cf", fontSize: 11, margin: "4px 0 10px", lineHeight: 1.4 }}>
        Je höher dein Einkaufsbetrag, desto besser der Bonus. KI prüft den Bon automatisch.
      </div>

      <label style={{ display: "block", color: "#FFF", fontSize: 11, fontWeight: 800, marginBottom: 4 }}>Kaufbetrag (€)</label>
      <input
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
        placeholder="z.B. 38,50"
        inputMode="decimal"
        style={{
          width: "100%", padding: "10px 12px", borderRadius: 10,
          background: "#0F1115", border: "1px solid rgba(255,255,255,0.15)",
          color: "#FFF", fontSize: 14, marginBottom: 10,
        }}
      />

      <label style={{ display: "block", color: "#FFF", fontSize: 11, fontWeight: 800, marginBottom: 4 }}>Kassenbon-Foto</label>
      {preview ? (
        <div style={{ position: "relative", marginBottom: 10 }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={preview} alt="Bon" style={{ width: "100%", maxHeight: 200, objectFit: "contain", borderRadius: 10, background: "#0F1115" }} />
          <button onClick={() => { setFile(null); setPreview(null); }} style={{
            position: "absolute", top: 6, right: 6,
            background: "rgba(0,0,0,0.7)", color: "#FFF", border: "none",
            borderRadius: 999, width: 28, height: 28, cursor: "pointer",
          }}>✕</button>
        </div>
      ) : (
        <label style={{
          display: "block", padding: "14px 12px", borderRadius: 10,
          border: "1px dashed rgba(255,255,255,0.2)", textAlign: "center",
          cursor: "pointer", marginBottom: 10, color: "#a8b4cf", fontSize: 12,
        }}>
          📷 Foto aufnehmen oder auswählen
          <input type="file" accept="image/jpeg,image/png,image/webp" capture="environment"
            style={{ display: "none" }}
            onChange={(e) => { const f = e.target.files?.[0]; if (f) pickFile(f); }}
          />
        </label>
      )}

      <button
        onClick={submit}
        disabled={busy || !file || !amount}
        style={{ ...btnPrimary, opacity: (!file || !amount || busy) ? 0.5 : 1 }}
      >
        {busy ? "Prüfe Bon …" : "Bonus einlösen"}
      </button>
    </div>
  );
}

function LootReveal({ rarity, xp }: { rarity: "common" | "rare" | "epic" | "legend"; xp: number }) {
  const meta = rarity === "legend"
    ? { label: "LEGENDÄR", color: "#FFD700", glow: "rgba(255,215,0,0.8)", emoji: "💎" }
    : rarity === "epic"
    ? { label: "EPISCH", color: "#a855f7", glow: "rgba(168,85,247,0.7)", emoji: "🔮" }
    : rarity === "rare"
    ? { label: "SELTEN", color: "#22D1C3", glow: "rgba(34,209,195,0.7)", emoji: "💠" }
    : { label: "GEWÖHNLICH", color: "#8B8FA3", glow: "rgba(139,143,163,0.45)", emoji: "📦" };
  return (
    <div style={{
      marginTop: 18, padding: 16, borderRadius: 16,
      background: `linear-gradient(135deg, ${meta.glow}, rgba(15,17,21,0.7))`,
      border: `2px solid ${meta.color}`,
      boxShadow: `0 0 40px ${meta.glow}`,
      animation: "lootReveal 0.9s cubic-bezier(0.34, 1.56, 0.64, 1)",
    }}>
      <div style={{ fontSize: 48, marginBottom: 6, animation: "lootBounce 1.2s ease-in-out infinite" }}>{meta.emoji}</div>
      <div style={{ color: meta.color, fontSize: 11, fontWeight: 900, letterSpacing: 2 }}>{meta.label} LOOT</div>
      <div style={{ color: "#FFF", fontSize: 22, fontWeight: 900, marginTop: 4 }}>+{xp.toLocaleString("de-DE")} XP</div>
      <div style={{ color: "#a8b4cf", fontSize: 11, marginTop: 2 }}>auf deinen Wächter</div>
      <style>{`
        @keyframes lootReveal {
          0%   { transform: scale(0.4) rotate(-6deg); opacity: 0; }
          50%  { transform: scale(1.1) rotate(2deg);  opacity: 1; }
          100% { transform: scale(1)   rotate(0);      opacity: 1; }
        }
        @keyframes lootBounce {
          0%,100% { transform: translateY(0);    }
          50%     { transform: translateY(-6px); }
        }
      `}</style>
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

function CrewStampWidget({ stamp }: { stamp: CrewStamp }) {
  const hasUnlocks = (stamp.new_unlocks?.length ?? 0) > 0;
  return (
    <div style={{
      padding: 12, borderRadius: 12, marginBottom: 10,
      background: hasUnlocks
        ? "linear-gradient(135deg, rgba(255,215,0,0.2), rgba(34,209,195,0.12))"
        : "rgba(34,209,195,0.1)",
      border: `1px solid ${hasUnlocks ? "#FFD700" : "rgba(34,209,195,0.4)"}`,
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <div style={{ fontSize: 24 }}>{hasUnlocks ? "🏆" : "🗂️"}</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 10, fontWeight: 900, letterSpacing: 1.5, color: hasUnlocks ? "#FFD700" : "#22D1C3" }}>
            CREW-STEMPEL · {stamp.crew_name?.toUpperCase()}
          </div>
          <div style={{ fontSize: 14, fontWeight: 900, color: "#FFF", marginTop: 1 }}>
            +1 Stempel · <span style={{ color: "#FFD700" }}>{stamp.stamp_count} gesammelt</span>
          </div>
        </div>
      </div>
      {hasUnlocks && (
        <div style={{ marginTop: 10, padding: 10, borderRadius: 8, background: "rgba(15,17,21,0.4)" }}>
          <div style={{ fontSize: 10, fontWeight: 900, letterSpacing: 1.5, color: "#FFD700", marginBottom: 4 }}>
            🎉 FREIGESCHALTET!
          </div>
          {stamp.new_unlocks!.map((u, i) => (
            <div key={i} style={{ fontSize: 12, color: "#FFF", fontWeight: 700, marginTop: 2 }}>
              • <b>{u.label}</b>
              {u.kind === "discount_percent" && u.value_int ? ` — ${u.value_int} % Rabatt für alle Crew-Mitglieder` : ""}
              {u.kind === "free_item" && u.value_text ? ` — ${u.value_text}` : ""}
              {u.kind === "wegemuenzen_unlock" && u.value_int ? ` — +${u.value_int} 🪙 für jedes Mitglied` : ""}
              {u.kind === "gebietsruf_unlock" && u.value_int ? ` — +${u.value_int} 🏴 für jedes Mitglied` : ""}
              {u.kind === "crew_emblem" ? " — Crew-Emblem erscheint am Shop-Pin auf der Karte" : ""}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
