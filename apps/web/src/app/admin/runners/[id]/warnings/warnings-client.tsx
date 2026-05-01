"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, Badge, Button, Select, Textarea } from "../../../_components/ui";

type Row = {
  id: string;
  level: string; // string instead of literal union to accept input from server
  reason: string;
  issued_by: string;
  expires_at: string | null;
  active: boolean;
  created_at: string;
  issuer: { username: string | null } | null;
};

const LEVEL_META: Record<string, { label: string; tone: "warning" | "danger"; emoji: string; hint: string }> = {
  warning:        { label: "Warning",       tone: "warning", emoji: "⚠️", hint: "Verwarnung ohne technische Konsequenz" },
  timeout_24h:    { label: "24h-Timeout",   tone: "danger",  emoji: "⏰", hint: "User ist 24h gesperrt, automatisch entsperrt" },
  timeout_7d:     { label: "7-Tage-Timeout", tone: "danger", emoji: "📅", hint: "User ist 7 Tage gesperrt, automatisch entsperrt" },
  permanent_ban:  { label: "Permanent-Ban", tone: "danger",  emoji: "🚫", hint: "User dauerhaft gesperrt — manuelle Aufhebung nötig" },
};

export function WarningsClient({ userId, initial }: { userId: string; initial: Row[] }) {
  const router = useRouter();
  const [level, setLevel] = useState<keyof typeof LEVEL_META>("warning");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);

  // Eskalations-Empfehlung: was sollte als nächstes Level kommen?
  const activeOnly = initial.filter((r) => r.active && r.level !== "warning");
  const lastLevel = initial[0]?.level;
  const recommended: typeof level = lastLevel === "warning" ? "timeout_24h"
    : lastLevel === "timeout_24h" ? "timeout_7d"
    : lastLevel === "timeout_7d" ? "permanent_ban"
    : "warning";

  async function issue() {
    if (!reason.trim()) return;
    setBusy(true);
    try {
      const r = await fetch("/api/admin/warnings", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "issue", user_id: userId, level, reason: reason.trim() }),
      });
      if (r.ok) { setReason(""); router.refresh(); }
    } finally { setBusy(false); }
  }

  async function revoke(warningId: string) {
    if (!confirm("Warning/Timeout aufheben?")) return;
    setBusy(true);
    try {
      const r = await fetch("/api/admin/warnings", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "revoke", warning_id: warningId }),
      });
      if (r.ok) router.refresh();
    } finally { setBusy(false); }
  }

  return (
    <div className="grid md:grid-cols-2 gap-6">
      <Card>
        <h2 className="font-bold mb-3">Neue Eskalation</h2>
        <div className="mb-2 text-[11px] text-[#22D1C3]">
          💡 Empfohlen basierend auf Historie: <b>{LEVEL_META[recommended].label}</b>
        </div>
        <label className="text-[11px] uppercase text-[#8b8fa3]">Level</label>
        <Select value={level} onChange={(e) => setLevel(e.target.value as keyof typeof LEVEL_META)} className="w-full mb-2">
          {Object.entries(LEVEL_META).map(([k, m]) => (
            <option key={k} value={k}>{m.emoji} {m.label}</option>
          ))}
        </Select>
        <div className="text-[10px] text-[#8b8fa3] mb-3">{LEVEL_META[level].hint}</div>
        <label className="text-[11px] uppercase text-[#8b8fa3]">Begründung (an User sichtbar)</label>
        <Textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={3} placeholder="z.B. Beleidigung in Crew-Chat am 30.04." />
        <div className="mt-3"><Button variant="danger" onClick={issue} disabled={busy || !reason.trim()}>{busy ? "Vergebe…" : `${LEVEL_META[level].emoji} ${LEVEL_META[level].label} aussprechen`}</Button></div>
      </Card>

      <Card>
        <h2 className="font-bold mb-3">Historie ({initial.length})</h2>
        {initial.length === 0 && <p className="text-sm text-[#8b8fa3]">Saubere Weste — keine Warnings.</p>}
        <div className="space-y-2">
          {initial.map((w) => {
            const m = LEVEL_META[w.level] ?? LEVEL_META.warning;
            const isExpired = w.expires_at && new Date(w.expires_at) < new Date();
            return (
              <div key={w.id} className={`p-3 rounded-lg border ${w.active && !isExpired ? "border-[#FF2D78]/30 bg-[#FF2D78]/5" : "border-white/5 bg-white/[0.02]"}`}>
                <div className="flex items-center justify-between gap-2 mb-1">
                  <Badge tone={m.tone}>{m.emoji} {m.label}</Badge>
                  <span className="text-[10px] text-[#8b8fa3]">{new Date(w.created_at).toLocaleString("de-DE")}</span>
                </div>
                <div className="text-xs text-[#dde3f5]">{w.reason}</div>
                <div className="flex items-center justify-between mt-2">
                  <div className="text-[10px] text-[#8b8fa3]">
                    durch @{w.issuer?.username ?? "?"}
                    {w.expires_at && (
                      <> · {isExpired ? "abgelaufen" : "endet"} {new Date(w.expires_at).toLocaleString("de-DE")}</>
                    )}
                    {!w.active && <> · <span className="text-[#4ade80]">aufgehoben</span></>}
                  </div>
                  {w.active && !isExpired && (
                    <Button size="sm" variant="ghost" onClick={() => revoke(w.id)} disabled={busy}>Aufheben</Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </Card>
    </div>
  );
}
