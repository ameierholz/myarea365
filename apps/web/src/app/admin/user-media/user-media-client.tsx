"use client";

import { useEffect, useState } from "react";

type Row = {
  id: string;
  username: string | null;
  display_name: string | null;
  banner_url: string | null;
  banner_status: "pending" | "approved" | "rejected" | null;
  avatar_url: string | null;
  avatar_status: "pending" | "approved" | "rejected" | null;
  media_rejection_reason: string | null;
};

type Filter = "pending" | "rejected" | "all";

export function UserMediaClient() {
  const [rows, setRows] = useState<Row[]>([]);
  const [filter, setFilter] = useState<Filter>("pending");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);

  async function reload() {
    setLoading(true);
    const res = await fetch(`/api/admin/user-media?filter=${filter}`, { cache: "no-store" });
    if (res.ok) setRows((await res.json()).users);
    setLoading(false);
  }
  useEffect(() => { reload(); }, [filter]); // eslint-disable-line react-hooks/exhaustive-deps

  async function act(userId: string, kind: "banner" | "avatar", action: "approve" | "reject" | "delete") {
    const reason = action === "reject"
      ? (prompt(`Grund der Ablehnung (wird dem User angezeigt)?`, "Unangemessener Inhalt") || "Unangemessener Inhalt")
      : undefined;
    setBusy(`${userId}-${kind}-${action}`);
    try {
      await fetch("/api/admin/user-media", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ user_id: userId, kind, action, reason }),
      });
      await reload();
    } finally { setBusy(null); }
  }

  const pendingCount = rows.filter(r =>
    (r.banner_url && r.banner_status === "pending") ||
    (r.avatar_url && r.avatar_status === "pending")
  ).length;

  return (
    <div>
      <h1 className="text-2xl font-black mb-1">📸 User-Media-Moderation</h1>
      <p className="text-sm text-[#a8b4cf] mb-4">
        Banner und Runner-Fotos werden erst nach Freigabe fuer andere sichtbar. Abgelehnte Medien bleiben beim User als &quot;abgelehnt&quot; sichtbar mit Grund.
        <span className="ml-2 px-2 py-0.5 rounded-full bg-[#FFD700]/15 text-[#FFD700] text-xs font-bold">
          {pendingCount} offen
        </span>
      </p>

      <div className="flex gap-2 mb-4 border-b border-white/10 pb-2">
        {(["pending", "rejected", "all"] as Filter[]).map((f) => (
          <button key={f} onClick={() => setFilter(f)}
            className={`px-3 py-2 rounded-lg text-sm font-bold transition ${
              filter === f
                ? "bg-[#22D1C3] text-[#0F1115]"
                : "bg-[#1A1D23] border border-white/10 text-[#a8b4cf] hover:text-white"
            }`}>
            {f === "pending" ? "⏳ Offen" : f === "rejected" ? "❌ Abgelehnt" : "🗂️ Alle"}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="p-10 text-center text-sm text-[#8B8FA3]">Lade…</div>
      ) : rows.length === 0 ? (
        <div className="p-10 text-center text-sm text-[#4ade80] font-bold">🎉 Keine offenen Pruefungen.</div>
      ) : (
        <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(340px, 1fr))" }}>
          {rows.map((u) => (
            <div key={u.id} className="p-4 rounded-xl bg-[#1A1D23] border border-white/10">
              <div className="flex items-center gap-3 mb-3">
                <div className="text-sm font-black text-white">{u.display_name || u.username || "Unknown"}</div>
                <div className="text-xs text-[#a8b4cf]">@{u.username}</div>
              </div>

              {u.banner_url && (
                <MediaBlock
                  label="BANNER"
                  url={u.banner_url}
                  status={u.banner_status ?? "pending"}
                  aspectRatio="3 / 1"
                  busyKey={`${u.id}-banner-`}
                  busy={busy}
                  onApprove={() => act(u.id, "banner", "approve")}
                  onReject={() => act(u.id, "banner", "reject")}
                  onDelete={() => act(u.id, "banner", "delete")}
                />
              )}
              {u.avatar_url && (
                <MediaBlock
                  label="AVATAR"
                  url={u.avatar_url}
                  status={u.avatar_status ?? "pending"}
                  aspectRatio="1 / 1"
                  busyKey={`${u.id}-avatar-`}
                  busy={busy}
                  onApprove={() => act(u.id, "avatar", "approve")}
                  onReject={() => act(u.id, "avatar", "reject")}
                  onDelete={() => act(u.id, "avatar", "delete")}
                />
              )}
              {u.media_rejection_reason && (
                <div className="mt-2 p-2 rounded-lg bg-[#FF2D78]/15 text-[#FF2D78] text-xs">
                  Letzter Ablehnungsgrund: {u.media_rejection_reason}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function MediaBlock({
  label, url, status, aspectRatio, busyKey, busy, onApprove, onReject, onDelete,
}: {
  label: string;
  url: string;
  status: "pending" | "approved" | "rejected";
  aspectRatio: string;
  busyKey: string;
  busy: string | null;
  onApprove: () => void;
  onReject: () => void;
  onDelete: () => void;
}) {
  const statusColor = status === "pending" ? "#FFD700" : status === "approved" ? "#4ade80" : "#FF2D78";
  const statusLabel = status === "pending" ? "⏳ OFFEN" : status === "approved" ? "✓ FREIGEGEBEN" : "❌ ABGELEHNT";
  return (
    <div className="mb-3">
      <div className="flex items-center justify-between mb-1">
        <div className="text-[10px] font-bold text-[#8B8FA3] tracking-wider">{label}</div>
        <div className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ background: `${statusColor}22`, color: statusColor }}>
          {statusLabel}
        </div>
      </div>
      <div className="rounded-lg overflow-hidden bg-[#0F1115]" style={{ aspectRatio }}>
        <img src={url} alt={label} className="w-full h-full object-cover" />
      </div>
      <div className="flex gap-2 mt-2">
        <button onClick={onApprove} disabled={!!busy} className="flex-1 py-1.5 rounded-lg bg-[#4ade80]/15 border border-[#4ade80]/40 text-[#4ade80] text-xs font-bold disabled:opacity-50">
          {busy === busyKey + "approve" ? "…" : "✓ Freigeben"}
        </button>
        <button onClick={onReject} disabled={!!busy} className="flex-1 py-1.5 rounded-lg bg-[#FFD700]/15 border border-[#FFD700]/40 text-[#FFD700] text-xs font-bold disabled:opacity-50">
          {busy === busyKey + "reject" ? "…" : "❌ Ablehnen"}
        </button>
        <button onClick={onDelete} disabled={!!busy} className="py-1.5 px-2 rounded-lg bg-[#FF2D78]/15 border border-[#FF2D78]/40 text-[#FF2D78] text-xs font-bold disabled:opacity-50">
          {busy === busyKey + "delete" ? "…" : "🗑️"}
        </button>
      </div>
    </div>
  );
}
