"use client";

import { useCallback, useEffect, useState } from "react";

type Report = {
  id: string;
  business_id: string;
  user_id: string;
  reason: string;
  comment: string | null;
  status: "open" | "reviewed" | "resolved" | "dismissed";
  created_at: string;
  resolved_at: string | null;
  business: { id: string; name: string; address: string | null } | { id: string; name: string; address: string | null }[] | null;
  reporter: { username: string | null; display_name: string | null } | { username: string | null; display_name: string | null }[] | null;
};

const REASON_LABELS: Record<string, { icon: string; label: string }> = {
  wrong_info:    { icon: "📝", label: "Info falsch" },
  closed:        { icon: "🚫", label: "Geschlossen" },
  not_honored:   { icon: "❌", label: "Deal nicht eingelöst" },
  unfriendly:    { icon: "😠", label: "Unhöflich" },
  inappropriate: { icon: "⚠️", label: "Unangemessen" },
  spam:          { icon: "🗑️", label: "Spam / Fake" },
  other:         { icon: "💬", label: "Sonstiges" },
};

const STATUS_META: Record<string, { label: string; color: string; bg: string }> = {
  open:      { label: "Offen",      color: "#FF6B4A", bg: "rgba(255,107,74,0.15)" },
  reviewed:  { label: "In Prüfung", color: "#FFD700", bg: "rgba(255,215,0,0.15)" },
  resolved:  { label: "Bearbeitet", color: "#4ade80", bg: "rgba(74,222,128,0.15)" },
  dismissed: { label: "Verworfen",  color: "#8B8FA3", bg: "rgba(139,143,163,0.15)" },
};

function unnest<T>(x: T | T[] | null): T | null {
  if (!x) return null;
  return Array.isArray(x) ? (x[0] ?? null) : x;
}

export function ShopReportsClient() {
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<"open" | "reviewed" | "resolved" | "dismissed" | "all">("open");
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch(`/api/admin/shop-reports?status=${status}`);
      const j = await r.json();
      setReports(j.reports ?? []);
    } finally { setLoading(false); }
  }, [status]);

  useEffect(() => { void load(); }, [load]);

  async function setRowStatus(id: string, newStatus: "open" | "reviewed" | "resolved" | "dismissed") {
    setBusy(id);
    try {
      await fetch("/api/admin/shop-reports", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ id, status: newStatus }),
      });
      await load();
    } finally { setBusy(null); }
  }

  const countByStatus = (s: string) => reports.filter((r) => r.status === s).length;

  return (
    <div className="p-8 max-w-6xl">
      <div className="mb-6">
        <h1 className="text-3xl font-black text-white mb-1">⚠️ Shop-Reports</h1>
        <p className="text-[13px] text-[#a8b4cf]">
          User-Meldungen zu problematischen Shops. Moderation &amp; Status-Wechsel hier.
        </p>
      </div>

      <div className="flex gap-2 mb-6 flex-wrap">
        {(["open", "reviewed", "resolved", "dismissed", "all"] as const).map((s) => {
          const meta = s === "all" ? { label: "Alle", color: "#22D1C3", bg: "rgba(34,209,195,0.12)" } : STATUS_META[s];
          const active = status === s;
          const n = s === "all" ? reports.length : countByStatus(s);
          return (
            <button
              key={s}
              onClick={() => setStatus(s)}
              className="px-4 py-2 rounded-lg text-xs font-bold border transition"
              style={{
                background: active ? meta.bg : "rgba(255,255,255,0.04)",
                borderColor: active ? meta.color : "rgba(255,255,255,0.1)",
                color: active ? meta.color : "#a8b4cf",
              }}
            >
              {meta.label} {status === s && n > 0 && <span className="opacity-70 ml-1">({n})</span>}
            </button>
          );
        })}
      </div>

      {loading ? (
        <div className="text-center py-12 text-[#8B8FA3]">Lade Reports…</div>
      ) : reports.length === 0 ? (
        <div className="text-center py-16 text-[#8B8FA3]">
          <div className="text-4xl mb-2">🎉</div>
          Keine Reports im Status „{status}".
        </div>
      ) : (
        <div className="space-y-2">
          {reports.map((r) => {
            const biz = unnest(r.business);
            const reporter = unnest(r.reporter);
            const reasonMeta = REASON_LABELS[r.reason] ?? { icon: "❓", label: r.reason };
            const statusMeta = STATUS_META[r.status];
            return (
              <div key={r.id} className="p-4 rounded-lg bg-white/5 border border-white/10">
                <div className="flex items-start gap-3">
                  <div className="text-3xl flex-shrink-0">{reasonMeta.icon}</div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span className="text-[10px] font-black tracking-wider px-2 py-0.5 rounded" style={{ background: statusMeta.bg, color: statusMeta.color }}>
                        {statusMeta.label.toUpperCase()}
                      </span>
                      <span className="text-[10px] text-[#a8b4cf]">{reasonMeta.label}</span>
                      <span className="text-[10px] text-[#6c7590]">{new Date(r.created_at).toLocaleString("de-DE")}</span>
                    </div>
                    <div className="text-white font-bold text-sm">{biz?.name ?? "Unbekannter Shop"}</div>
                    {biz?.address && <div className="text-[11px] text-[#a8b4cf]">{biz.address}</div>}
                    <div className="text-[11px] text-[#8B8FA3] mt-1">
                      Gemeldet von: <span className="text-white">{reporter?.display_name || reporter?.username || "—"}</span>
                    </div>
                    {r.comment && (
                      <div className="mt-2 p-2.5 rounded-md bg-black/30 border border-white/5 text-[12px] text-[#d0d0d5] whitespace-pre-wrap">
                        {r.comment}
                      </div>
                    )}
                  </div>
                  <div className="flex flex-col gap-1.5 flex-shrink-0">
                    {r.status !== "reviewed" && r.status !== "resolved" && r.status !== "dismissed" && (
                      <button onClick={() => setRowStatus(r.id, "reviewed")} disabled={busy === r.id} className="px-3 py-1.5 rounded-md bg-[#FFD700]/15 text-[#FFD700] hover:bg-[#FFD700]/25 text-[11px] font-bold">
                        In Prüfung
                      </button>
                    )}
                    {r.status !== "resolved" && (
                      <button onClick={() => setRowStatus(r.id, "resolved")} disabled={busy === r.id} className="px-3 py-1.5 rounded-md bg-[#4ade80]/15 text-[#4ade80] hover:bg-[#4ade80]/25 text-[11px] font-bold">
                        ✓ Erledigt
                      </button>
                    )}
                    {r.status !== "dismissed" && (
                      <button onClick={() => setRowStatus(r.id, "dismissed")} disabled={busy === r.id} className="px-3 py-1.5 rounded-md bg-white/5 text-[#8B8FA3] hover:bg-white/10 text-[11px] font-bold">
                        Verwerfen
                      </button>
                    )}
                    {r.status !== "open" && (
                      <button onClick={() => setRowStatus(r.id, "open")} disabled={busy === r.id} className="px-3 py-1.5 rounded-md bg-[#FF6B4A]/15 text-[#FF6B4A] hover:bg-[#FF6B4A]/25 text-[11px] font-bold">
                        Neu öffnen
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
