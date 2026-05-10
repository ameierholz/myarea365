"use client";

import { useEffect, useState } from "react";
import { Modal, Z } from "@/components/ui";

type Reward = {
  day_idx: number;
  gems: number;
  wood: number;
  stone: number;
  gold: number;
  mana: number;
  speed_token: number;
  label: string;
};

type Status = {
  ok: boolean;
  current_streak: number;
  longest_streak: number;
  total_claims: number;
  can_claim: boolean;
  next_day_idx: number;
  rewards: Reward[];
  last_claim_at?: string;
};

const PRIMARY = "#22D1C3";
const ACCENT = "#FF2D78";
const GOLD = "#FFD700";

export function LoginStreakModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [status, setStatus] = useState<Status | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    void load();
  }, [open]);

  async function load() {
    try {
      const r = await fetch("/api/login-streak", { cache: "no-store" });
      if (r.ok) setStatus(await r.json() as Status);
    } catch { /* ignore */ }
  }

  async function claim() {
    if (!status?.can_claim || busy) return;
    setBusy(true); setMsg(null);
    try {
      const r = await fetch("/api/login-streak", { method: "POST" });
      const j = await r.json() as { ok?: boolean; error?: string; gems?: number; speed_token?: number; label?: string };
      if (!j.ok) {
        setMsg(j.error ?? "Fehler beim Einlösen");
      } else {
        setMsg(`✓ ${j.label}`);
        try { window.dispatchEvent(new CustomEvent("ma365:gems-changed")); } catch {}
        try { window.dispatchEvent(new CustomEvent("ma365:resources-changed")); } catch {}
        await load();
      }
    } finally {
      setBusy(false);
    }
  }

  if (!open || !status) return null;

  return (
    <Modal open={open} onClose={onClose} zIndex={Z.modal}>
      <div style={{ padding: 16, color: "#FFF" }}>
        <div style={{ fontSize: 18, fontWeight: 800, marginBottom: 12 }}>Tägliche Belohnung</div>
        <div style={{ display: "flex", gap: 16, marginBottom: 16, alignItems: "center" }}>
          <div style={{
            width: 72, height: 72, borderRadius: 16,
            background: `linear-gradient(135deg, ${PRIMARY}, ${ACCENT})`,
            display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
            boxShadow: `0 0 24px ${PRIMARY}55`,
          }}>
            <div style={{ fontSize: 28, fontWeight: 900 }}>{status.current_streak}</div>
            <div style={{ fontSize: 9, opacity: 0.85 }}>Tage</div>
          </div>
          <div>
            <div style={{ fontSize: 16, fontWeight: 800 }}>Aktuelle Serie</div>
            <div style={{ fontSize: 11, color: "#a8b4cf" }}>
              Längste Serie: {status.longest_streak} · Insgesamt: {status.total_claims}
            </div>
          </div>
        </div>

        <div style={{
          display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 6, marginBottom: 16,
        }}>
          {status.rewards.map((r) => {
            const isPast = r.day_idx < status.next_day_idx || (r.day_idx === status.next_day_idx && !status.can_claim);
            const isToday = r.day_idx === status.next_day_idx && status.can_claim;
            return (
              <div key={r.day_idx} style={{
                padding: "10px 4px", borderRadius: 10, textAlign: "center",
                background: isToday ? `linear-gradient(135deg, ${PRIMARY}33, ${ACCENT}33)` : "rgba(255,255,255,0.04)",
                border: isToday ? `2px solid ${PRIMARY}` : isPast ? "1px solid rgba(34,209,195,0.4)" : "1px solid rgba(255,255,255,0.08)",
                opacity: isPast && !isToday ? 0.55 : 1,
              }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: "#a8b4cf", marginBottom: 4 }}>
                  Tag {r.day_idx}
                </div>
                <div style={{ fontSize: 14, marginBottom: 2 }}>
                  {r.speed_token > 0 ? "⏱️" : r.day_idx === 7 ? "💎" : "📦"}
                </div>
                <div style={{ fontSize: 9, color: GOLD, fontWeight: 700 }}>
                  {r.gems > 0 ? `${r.gems} 💎` : ""}
                </div>
                {r.speed_token > 0 && (
                  <div style={{ fontSize: 8, color: PRIMARY, fontWeight: 700 }}>+1 Token</div>
                )}
              </div>
            );
          })}
        </div>

        {msg && (
          <div style={{
            padding: 10, borderRadius: 8, marginBottom: 10, fontSize: 12,
            background: msg.startsWith("✓") ? "rgba(34,209,195,0.15)" : "rgba(255,45,120,0.15)",
            color: msg.startsWith("✓") ? PRIMARY : ACCENT,
          }}>{msg}</div>
        )}

        <button
          disabled={!status.can_claim || busy}
          onClick={claim}
          style={{
            width: "100%", padding: "14px 16px", borderRadius: 12,
            background: status.can_claim ? `linear-gradient(135deg, ${PRIMARY}, ${ACCENT})` : "rgba(255,255,255,0.08)",
            color: status.can_claim ? "#FFF" : "#8B8FA3",
            fontWeight: 800, fontSize: 14, border: "none",
            cursor: status.can_claim && !busy ? "pointer" : "not-allowed",
            opacity: busy ? 0.7 : 1,
          }}
        >
          {busy ? "..." : status.can_claim ? `Tag ${status.next_day_idx} einlösen` : "Heute schon eingelöst — komm morgen wieder"}
        </button>
      </div>
    </Modal>
  );
}
