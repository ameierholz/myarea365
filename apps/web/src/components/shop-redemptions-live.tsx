"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { createClient } from "@/lib/supabase/client";
import { appAlert } from "@/components/app-dialog";

type Pending = {
  id: string;
  one_time_code: string;
  user_id: string;
  xp_paid: number;
  expires_at: string;
  created_at: string;
};

export function ShopRedemptionsLive({ businessId }: { businessId: string }) {
  const t = useTranslations("ShopPanels");
  const sb = createClient();
  const [code, setCode] = useState("");
  const [pending, setPending] = useState<Pending[]>([]);
  const [verifying, setVerifying] = useState(false);
  const [verifiedFlash, setVerifiedFlash] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      const { data } = await sb
        .from("deal_redemptions")
        .select("id, one_time_code, user_id, xp_paid, expires_at, created_at")
        .eq("business_id", businessId)
        .eq("status", "pending")
        .gt("expires_at", new Date().toISOString())
        .order("created_at", { ascending: false })
        .limit(20);
      setPending((data ?? []) as Pending[]);
    }
    load();
    const id = setInterval(load, 2000);
    return () => clearInterval(id);
  }, [sb, businessId]);

  async function verify(codeToVerify: string) {
    if (!codeToVerify || codeToVerify.length < 4) { appAlert(t("redCodeRequired")); return; }
    setVerifying(true);
    try {
      const res = await fetch("/api/deals/verify", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ code: codeToVerify, business_id: businessId }),
      });
      const json = await res.json();
      if (!json.ok) { appAlert(json.error ?? t("redCodeInvalid")); return; }
      setVerifiedFlash(codeToVerify);
      setCode("");
      setTimeout(() => setVerifiedFlash(null), 2500);
    } finally { setVerifying(false); }
  }

  return (
    <div style={{
      background: "rgba(41, 51, 73, 0.55)", borderRadius: 14, padding: 14,
      border: "1px solid rgba(255,255,255,0.14)",
    }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
        <span style={{ color: "#FFF", fontSize: 14, fontWeight: 900 }}>{t("redConfirmTitle")}</span>
        <span style={{ color: "#22D1C3", fontSize: 10, fontWeight: 900, letterSpacing: 1, padding: "2px 8px", borderRadius: 999, background: "rgba(34,209,195,0.15)" }}>{t("redLive")}</span>
      </div>

      {verifiedFlash && (
        <div style={{
          padding: 12, borderRadius: 10,
          background: "rgba(74,222,128,0.18)", border: "1px solid rgba(74,222,128,0.45)",
          color: "#4ade80", fontWeight: 800, textAlign: "center", marginBottom: 10,
          animation: "verifyFlash 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)",
        }}>
          {t("redCodeOk", { code: verifiedFlash })}
          <style>{`@keyframes verifyFlash { from { transform: scale(0.9); opacity: 0 } to { transform: scale(1); opacity: 1 } }`}</style>
        </div>
      )}

      <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
        <input
          inputMode="numeric"
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
          placeholder={t("redCodePh")}
          style={{
            flex: 1, padding: "10px 12px", borderRadius: 10,
            background: "rgba(0,0,0,0.3)", border: "1px solid rgba(255,255,255,0.12)",
            color: "#FFF", fontSize: 16, fontWeight: 900, letterSpacing: 4, textAlign: "center",
            fontFamily: "ui-monospace, monospace",
          }}
        />
        <button
          onClick={() => verify(code)}
          disabled={verifying || code.length !== 6}
          style={{
            padding: "10px 18px", borderRadius: 10,
            background: code.length === 6 ? "#4ade80" : "rgba(74,222,128,0.3)",
            color: "#0F1115", border: "none", cursor: code.length === 6 ? "pointer" : "not-allowed",
            fontSize: 13, fontWeight: 900,
          }}
        >
          {verifying ? "…" : t("redConfirmBtn")}
        </button>
      </div>

      <div style={{ color: "#a8b4cf", fontSize: 10, fontWeight: 800, letterSpacing: 1, marginBottom: 6 }}>
        {t("redOpenHeading", { n: pending.length })}
      </div>
      {pending.length === 0 ? (
        <div style={{ padding: 20, textAlign: "center", color: "#a8b4cf", fontSize: 12 }}>
          {t("redEmpty")}
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {pending.map((p) => {
            const secondsLeft = Math.max(0, Math.floor((new Date(p.expires_at).getTime() - Date.now()) / 1000));
            const mm = Math.floor(secondsLeft / 60);
            const ss = secondsLeft % 60;
            return (
              <div key={p.id} style={{
                display: "flex", alignItems: "center", gap: 10,
                padding: "10px 12px", borderRadius: 10,
                background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)",
              }}>
                <span style={{
                  fontFamily: "ui-monospace, monospace",
                  fontSize: 18, fontWeight: 900, color: "#FFD700", letterSpacing: 3,
                }}>{p.one_time_code}</span>
                <div style={{ flex: 1 }}>
                  <div style={{ color: "#FFF", fontSize: 12, fontWeight: 700 }}>
                    {t("redRunner", { id: p.user_id.slice(0, 8) })}
                  </div>
                  <div style={{ color: secondsLeft < 60 ? "#FF2D78" : "#a8b4cf", fontSize: 11 }}>
                    {t("redTimeLeft", { mm, ss: ss.toString().padStart(2, "0"), xp: p.xp_paid })}
                  </div>
                </div>
                <button
                  onClick={() => verify(p.one_time_code)}
                  style={{
                    padding: "6px 12px", borderRadius: 8,
                    background: "#4ade80", color: "#0F1115",
                    border: "none", cursor: "pointer",
                    fontSize: 11, fontWeight: 900,
                  }}
                >
                  ✓
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
