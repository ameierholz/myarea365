"use client";

import { useEffect, useState, useCallback } from "react";
import { Modal, Z } from "@/components/ui";

type Friend = { user_id: string; username: string | null; display_name: string | null; avatar_url: string | null; since: string };
type IncomingReq = { request_id: string; from_user: string; username: string | null; display_name: string | null; avatar_url: string | null; created_at: string };
type OutgoingReq = { request_id: string; to_user: string; username: string | null; display_name: string | null; avatar_url: string | null; created_at: string };
type SearchResult = { id: string; username: string | null; display_name: string | null; avatar_url: string | null };

const PRIMARY = "#22D1C3";
const ACCENT = "#FF2D78";

export function FriendsModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [friends, setFriends] = useState<Friend[]>([]);
  const [incoming, setIncoming] = useState<IncomingReq[]>([]);
  const [outgoing, setOutgoing] = useState<OutgoingReq[]>([]);
  const [tab, setTab] = useState<"friends" | "requests" | "add">("friends");
  const [search, setSearch] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [busy, setBusy] = useState(false);

  const reload = useCallback(async () => {
    try {
      const r = await fetch("/api/friends", { cache: "no-store" });
      if (!r.ok) return;
      const j = await r.json() as { ok?: boolean; friends?: Friend[]; incoming?: IncomingReq[]; outgoing?: OutgoingReq[] };
      if (j.ok) {
        setFriends(j.friends ?? []);
        setIncoming(j.incoming ?? []);
        setOutgoing(j.outgoing ?? []);
      }
    } catch { /* ignore */ }
  }, []);

  useEffect(() => { if (open) void reload(); }, [open, reload]);

  useEffect(() => {
    if (search.length < 2) { setResults([]); return; }
    const ctl = new AbortController();
    const t = window.setTimeout(async () => {
      try {
        const r = await fetch(`/api/users/search?q=${encodeURIComponent(search)}`, { cache: "no-store", signal: ctl.signal });
        if (!r.ok) return;
        const j = await r.json() as { ok?: boolean; results?: SearchResult[] };
        if (j.ok) setResults(j.results ?? []);
      } catch { /* aborted */ }
    }, 300);
    return () => { ctl.abort(); window.clearTimeout(t); };
  }, [search]);

  async function sendRequest(toUser: string) {
    setBusy(true);
    try {
      await fetch("/api/friends/request", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ to_user: toUser }),
      });
      await reload();
    } finally { setBusy(false); }
  }

  async function respond(requestId: string, action: "accept" | "decline") {
    setBusy(true);
    try {
      await fetch("/api/friends/respond", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ request_id: requestId, action }),
      });
      await reload();
    } finally { setBusy(false); }
  }

  async function removeFriend(otherUser: string) {
    setBusy(true);
    try {
      await fetch("/api/friends/remove", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ other_user: otherUser }),
      });
      await reload();
    } finally { setBusy(false); }
  }

  if (!open) return null;

  return (
    <Modal open={open} onClose={onClose} zIndex={Z.modal}>
      <div style={{ padding: 16, color: "#FFF", minHeight: 360 }}>
        <div style={{ fontSize: 16, fontWeight: 800, marginBottom: 12 }}>Freunde</div>
        <div style={{ display: "flex", gap: 6, marginBottom: 12 }}>
          {(["friends", "requests", "add"] as const).map((t) => (
            <button key={t} onClick={() => setTab(t)} style={{
              flex: 1, padding: "8px 10px", borderRadius: 8,
              background: tab === t ? `linear-gradient(135deg, ${PRIMARY}, ${ACCENT})` : "rgba(255,255,255,0.06)",
              color: "#FFF", fontSize: 12, fontWeight: 700, border: "none", cursor: "pointer",
            }}>
              {t === "friends" ? `Freunde (${friends.length})` : t === "requests" ? `Anfragen${incoming.length ? ` (${incoming.length})` : ""}` : "Hinzufügen"}
            </button>
          ))}
        </div>

        {tab === "friends" && (
          <div>
            {friends.length === 0 ? (
              <div style={{ fontSize: 12, color: "#a8b4cf", padding: "20px 0", textAlign: "center" }}>
                Noch keine Freunde — wechsle auf „Hinzufügen" und such jemanden.
              </div>
            ) : friends.map((f) => (
              <div key={f.user_id} style={{
                display: "flex", alignItems: "center", gap: 10, padding: "10px 8px",
                borderBottom: "1px solid rgba(255,255,255,0.08)",
              }}>
                <div style={{ flex: 1, fontSize: 13 }}>
                  <div style={{ fontWeight: 700 }}>{f.display_name || f.username || "—"}</div>
                  <div style={{ fontSize: 10, color: "#a8b4cf" }}>@{f.username}</div>
                </div>
                <button onClick={() => removeFriend(f.user_id)} disabled={busy} style={{
                  padding: "4px 10px", fontSize: 11, borderRadius: 6,
                  background: "rgba(255,45,120,0.15)", color: ACCENT,
                  border: `1px solid ${ACCENT}55`, cursor: "pointer",
                }}>Entfernen</button>
              </div>
            ))}
          </div>
        )}

        {tab === "requests" && (
          <div>
            {incoming.length === 0 && outgoing.length === 0 && (
              <div style={{ fontSize: 12, color: "#a8b4cf", padding: "20px 0", textAlign: "center" }}>
                Keine offenen Anfragen.
              </div>
            )}
            {incoming.length > 0 && (
              <div style={{ marginBottom: 12 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: "#a8b4cf", marginBottom: 6 }}>Eingehend</div>
                {incoming.map((r) => (
                  <div key={r.request_id} style={{
                    display: "flex", alignItems: "center", gap: 8, padding: "8px",
                    background: "rgba(34,209,195,0.06)", borderRadius: 8, marginBottom: 4,
                  }}>
                    <div style={{ flex: 1, fontSize: 13 }}>
                      <div style={{ fontWeight: 700 }}>{r.display_name || r.username || "—"}</div>
                      <div style={{ fontSize: 10, color: "#a8b4cf" }}>@{r.username}</div>
                    </div>
                    <button onClick={() => respond(r.request_id, "accept")} disabled={busy} style={{
                      padding: "4px 10px", fontSize: 11, borderRadius: 6,
                      background: PRIMARY, color: "#000", fontWeight: 700, border: "none", cursor: "pointer",
                    }}>Annehmen</button>
                    <button onClick={() => respond(r.request_id, "decline")} disabled={busy} style={{
                      padding: "4px 10px", fontSize: 11, borderRadius: 6,
                      background: "rgba(255,255,255,0.08)", color: "#FFF", border: "none", cursor: "pointer",
                    }}>Ablehnen</button>
                  </div>
                ))}
              </div>
            )}
            {outgoing.length > 0 && (
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, color: "#a8b4cf", marginBottom: 6 }}>Ausgehend</div>
                {outgoing.map((r) => (
                  <div key={r.request_id} style={{ padding: "6px 8px", fontSize: 12, color: "#a8b4cf" }}>
                    @{r.username} <span style={{ fontSize: 10 }}>(wartet auf Antwort)</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {tab === "add" && (
          <div>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Username suchen…"
              style={{
                width: "100%", padding: "10px 12px", borderRadius: 10,
                background: "rgba(0,0,0,0.3)", color: "#FFF",
                border: "1px solid rgba(255,255,255,0.1)", marginBottom: 10,
              }}
              autoFocus
            />
            {results.map((r) => {
              const alreadyFriend = friends.some((f) => f.user_id === r.id);
              const pending = outgoing.some((o) => o.to_user === r.id);
              return (
                <div key={r.id} style={{
                  display: "flex", alignItems: "center", gap: 10, padding: "8px",
                  borderBottom: "1px solid rgba(255,255,255,0.08)",
                }}>
                  <div style={{ flex: 1, fontSize: 13 }}>
                    <div style={{ fontWeight: 700 }}>{r.display_name || r.username || "—"}</div>
                    <div style={{ fontSize: 10, color: "#a8b4cf" }}>@{r.username}</div>
                  </div>
                  {alreadyFriend ? (
                    <span style={{ fontSize: 10, color: PRIMARY, fontWeight: 700 }}>✓ Freund</span>
                  ) : pending ? (
                    <span style={{ fontSize: 10, color: "#a8b4cf" }}>angefragt</span>
                  ) : (
                    <button onClick={() => sendRequest(r.id)} disabled={busy} style={{
                      padding: "4px 10px", fontSize: 11, borderRadius: 6,
                      background: PRIMARY, color: "#000", fontWeight: 700, border: "none", cursor: "pointer",
                    }}>Hinzufügen</button>
                  )}
                </div>
              );
            })}
            {search.length >= 2 && results.length === 0 && (
              <div style={{ fontSize: 11, color: "#a8b4cf", padding: "10px 0", textAlign: "center" }}>
                Niemand gefunden.
              </div>
            )}
          </div>
        )}
      </div>
    </Modal>
  );
}
