"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { buildInviteUrl, shareInvite } from "@/lib/referral";

export function ReferralWidget({ userId, referralCode, displayName }: {
  userId: string; referralCode: string | null; displayName: string;
}) {
  const sb = createClient();
  const [stats, setStats] = useState({ invited: 0, confirmed: 0, xp: 0 });
  const [code, setCode] = useState<string | null>(referralCode);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    (async () => {
      if (!code) {
        const newCode = Math.random().toString(36).slice(2, 8).toUpperCase();
        await sb.from("users").update({ referral_code: newCode }).eq("id", userId);
        setCode(newCode);
      }
      const { data } = await sb.from("referrals").select("status, reward_xp").eq("referrer_id", userId);
      const invited = data?.length ?? 0;
      const confirmed = data?.filter((r) => r.status !== "pending").length ?? 0;
      const xp = data?.filter((r) => r.status === "rewarded").reduce((s, r) => s + (r.reward_xp || 0), 0) ?? 0;
      setStats({ invited, confirmed, xp });
    })();
  }, [userId, code, sb]);

  if (!code) return null;
  const url = buildInviteUrl(code);

  return (
    <div style={{
      background: "linear-gradient(135deg, rgba(34,209,195,0.12) 0%, rgba(255,45,120,0.12) 100%)",
      border: "1px solid rgba(34,209,195,0.35)", borderRadius: 18, padding: 18, marginTop: 14,
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
        <span style={{ fontSize: 22 }}>🎁</span>
        <div style={{ flex: 1 }}>
          <div style={{ color: "#FFF", fontWeight: 900, fontSize: 14 }}>Freunde einladen</div>
          <div style={{ color: "#a8b4cf", fontSize: 11 }}>Pro Freund: du +500 🪙, Freund +500 🪙</div>
        </div>
      </div>

      <div style={{
        display: "flex", alignItems: "center", gap: 8,
        background: "rgba(0,0,0,0.35)", borderRadius: 10, padding: "10px 12px",
      }}>
        <code style={{ color: "#22D1C3", fontSize: 18, fontWeight: 900, letterSpacing: 2, flex: 1 }}>{code}</code>
        <button
          onClick={async () => { await navigator.clipboard.writeText(url); setCopied(true); setTimeout(() => setCopied(false), 1500); }}
          style={{ background: "#22D1C3", color: "#0F1115", padding: "6px 12px", borderRadius: 8, border: "none", fontSize: 12, fontWeight: 800, cursor: "pointer" }}
        >
          {copied ? "✓ Kopiert" : "Link kopieren"}
        </button>
        <button
          onClick={() => shareInvite(code, displayName)}
          style={{ background: "#FF2D78", color: "#FFF", padding: "6px 12px", borderRadius: 8, border: "none", fontSize: 12, fontWeight: 800, cursor: "pointer" }}
        >
          Teilen
        </button>
      </div>

      <div style={{ display: "flex", gap: 12, marginTop: 12 }}>
        <Stat label="Eingeladen" value={stats.invited} />
        <Stat label="Beigetreten" value={stats.confirmed} />
        <Stat label="🪙 erhalten" value={stats.xp} color="#FFD700" />
      </div>
    </div>
  );
}

function Stat({ label, value, color = "#22D1C3" }: { label: string; value: number; color?: string }) {
  return (
    <div style={{ flex: 1, textAlign: "center", padding: "8px 0", background: "rgba(255,255,255,0.05)", borderRadius: 10 }}>
      <div style={{ color, fontSize: 18, fontWeight: 900 }}>{value}</div>
      <div style={{ color: "#a8b4cf", fontSize: 10, fontWeight: 700, letterSpacing: 0.5, textTransform: "uppercase" }}>{label}</div>
    </div>
  );
}
