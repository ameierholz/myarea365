"use client";

/**
 * HEIMAT-CHAT-WIDGET
 *
 * Floating Bottom-Left Chat-Hub mit Tabs:
 *   - Heimat (PLZ / Bezirk / Stadt)
 *   - Crew
 *   - DM (PMs + Custom-Gruppen)
 *   - CvC (nur wenn aktiv)
 *
 * Features (Phase 1 MVP):
 *   ✅ Realtime via Supabase Channels
 *   ✅ Send/Read, Reply, Edit, Delete
 *   ✅ Reactions (long-press emoji bar)
 *   ✅ @-Mentions (auto-extract via Server-RPC)
 *   ✅ Markdown-lite (**bold** / *italic* / `code` / ~~strike~~)
 *   ✅ Pinned-Messages
 *   ✅ Polls + Scheduled-Messages + Saved (Self-DM)
 *   ✅ Report-Message (7 Reasons) + Block-User
 *   ✅ Read-Receipts mit Avatar-Stack
 *   ✅ Typing-Indicator
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { MessageSquare, X, Hash, Users, MapPin, Sword, Inbox, Send, Smile, AtSign, Paperclip, MoreVertical, Reply, Edit3, Trash2, Pin, Flag, UserX, Save, Clock, BarChart3 } from "lucide-react";
import { useChatRealtime } from "./use-chat-realtime";

// ════════════════════════════════════════════════════════════════════
// TYPES
// ════════════════════════════════════════════════════════════════════

type Room = {
  room_id: string;
  kind: "heimat_plz"|"heimat_bezirk"|"heimat_stadt"|"crew"|"pm"|"group"|"cvc"|"saved";
  name: string | null;
  avatar_url: string | null;
  last_message_at: string | null;
  last_message_preview: string | null;
  last_message_user: string | null;
  unread_count: number;
  member_count: number;
  has_mention: boolean;
  archived?: boolean;
  muted?: boolean;
};

type Author = {
  username: string | null;
  display_name: string | null;
  avatar_url: string | null;
  crew_tag?: string | null;
  equipped_marker_id?: string | null;
  equipped_marker_variant?: string | null;
  equipped_base_ring_id?: string | null;
};
type Art = { image_url: string | null; video_url: string | null };
type CosmeticArt = {
  marker?: Record<string, Record<string, Art>>;
  base_ring?: Record<string, Art>;
};
type Reaction = { emoji: string; user_id: string };
type PollVote = { user_id: string; option_index: number };
type Poll = {
  question: string; options: string[]; multi_choice: boolean;
  closes_at: string | null; closed_at: string | null;
  votes: PollVote[];
};

type Message = {
  id: string; room_id: string; user_id: string | null; kind: string;
  body: string | null; attachments: unknown;
  reply_to_id: string | null;
  edited_at: string | null; deleted_at: string | null;
  pinned_at: string | null; pinned_by: string | null;
  created_at: string;
  author: Author | null;
  reactions: Reaction[];
  poll: Poll | null;
};

type TabKey = "heimat" | "crew" | "dm" | "cvc";

// ════════════════════════════════════════════════════════════════════
// MAIN
// ════════════════════════════════════════════════════════════════════

export function ChatWidget({ currentUserId }: { currentUserId: string }) {
  const [open, setOpen] = useState(true);
  // mode: "preview" = kompakte Vorschau-Lasche auf Karte (Default, RoK-Stil),
  //       "expanded" = großes Modal mit Tabs/Räumen/Input
  const [mode, setMode] = useState<"preview" | "expanded">("preview");
  const [rooms, setRooms] = useState<Room[]>([]);
  const [tab, setTab] = useState<TabKey>("heimat");
  const [activeRoomId, setActiveRoomId] = useState<string | null>(null);
  const [previewRoomId, setPreviewRoomId] = useState<string | null>(null);
  const [unreadTotal, setUnreadTotal] = useState(0);
  const [cosmeticArt, setCosmeticArt] = useState<CosmeticArt>({});

  useEffect(() => {
    void (async () => {
      try {
        const r = await fetch("/api/cosmetic-artwork", { cache: "force-cache" });
        if (r.ok) setCosmeticArt(await r.json() as CosmeticArt);
      } catch { /* noop */ }
    })();
  }, []);

  const refreshRooms = useCallback(async () => {
    try {
      const r = await fetch("/api/chat/rooms", { cache: "no-store" });
      if (!r.ok) return;
      const j = await r.json() as { rooms: Room[] };
      setRooms(j.rooms);
      setUnreadTotal(j.rooms.reduce((sum, r) => sum + (r.unread_count || 0), 0));
    } catch { /* noop */ }
  }, []);

  useEffect(() => { void refreshRooms(); const id = setInterval(refreshRooms, 30000); return () => clearInterval(id); }, [refreshRooms]);

  // Auto-Join: Geo + CvC + Saved — läuft bei jedem Open. RPC ist idempotent
  // und räumt alte Geo-Memberships auf, wenn sich PLZ/Bezirk/Stadt geändert hat
  // (z.B. weil Bezirks-Extraktion verbessert wurde).
  useEffect(() => {
    if (!open) return;
    void (async () => {
      // Heimat-Geo: PLZ via /api/base/me, Bezirk/Stadt via reverse-geo (best effort)
      try {
        const baseRes = await fetch("/api/base/me", { cache: "no-store" });
        if (baseRes.ok) {
          const base = await baseRes.json() as { base?: { lat?: number; lng?: number; plz?: string } };
          // Heimat-Räume basieren auf der PLZ aus den Einstellungen (Base) — NICHT auf
          // dem aktuellen Standort. Wir leiten Bezirk+Stadt aus der Base-Position ab,
          // joinen aber NUR Bezirk + Stadt — keine PLZ-Räume (sonst sammelt der Runner
          // beim Reisen 100 PLZ-Chats an).
          let bezirk: string | null = null;
          let city: string | null = null;
          if (base.base?.lat && base.base?.lng) {
            try {
              const poiRes = await fetch(`/api/heimat/poi?lat=${base.base.lat}&lng=${base.base.lng}`);
              if (poiRes.ok) {
                const j = await poiRes.json() as { address?: { city?: string; suburb?: string; district?: string; postcode?: string } };
                bezirk = j.address?.district ?? j.address?.suburb ?? null;
                city = j.address?.city ?? null;
              }
            } catch { /* noop */ }
          }
          if (bezirk || city) {
            await fetch("/api/chat/geo", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ plz: null, bezirk, city }) });
          }
        }
      } catch { /* noop */ }
      try { await fetch("/api/chat/cvc", { method: "POST" }); } catch { /* noop */ }
      try { await fetch("/api/chat/saved", { method: "POST" }); } catch { /* noop */ }
      void refreshRooms();
    })();
  }, [open, refreshRooms]);

  const filteredRooms = useMemo(() => {
    if (tab === "heimat") return rooms.filter((r) => r.kind === "heimat_bezirk" || r.kind === "heimat_stadt");
    if (tab === "crew") return rooms.filter((r) => r.kind === "crew");
    if (tab === "dm") return rooms.filter((r) => r.kind === "pm" || r.kind === "group" || r.kind === "saved");
    if (tab === "cvc") return rooms.filter((r) => r.kind === "cvc");
    return [];
  }, [rooms, tab]);

  // Auto-Open: nur Crew/CvC (genau 1 Room). Heimat ist jetzt Liste (PLZ+Bezirk+Stadt+History).
  const autoOpenSingle = (tab === "crew" || tab === "cvc") && filteredRooms.length === 1;
  useEffect(() => {
    if (!autoOpenSingle) return;
    if (activeRoomId === filteredRooms[0]?.room_id) return;
    setActiveRoomId(filteredRooms[0]!.room_id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoOpenSingle, filteredRooms[0]?.room_id]);

  // Bei Tab-Wechsel: vorherigen activeRoomId resetten wenn er nicht mehr in diesem Tab ist
  useEffect(() => {
    if (!activeRoomId) return;
    const stillVisible = filteredRooms.some((r) => r.room_id === activeRoomId);
    if (!stillVisible) setActiveRoomId(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  if (!open) {
    return (
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); setOpen(true); }}
        style={{ position: "fixed", bottom: 12, left: 12, zIndex: 99999 }}
        className="w-12 h-12 rounded-full bg-gradient-to-br from-[#22D1C3] to-[#FF2D78] text-white shadow-2xl flex items-center justify-center hover:scale-105 active:scale-95 transition"
        aria-label="Chat öffnen"
      >
        <MessageSquare size={20} />
        {unreadTotal > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[20px] h-5 rounded-full bg-[#FF2D78] text-white text-[10px] font-bold flex items-center justify-center px-1 ring-2 ring-[#0F1115]">
            {unreadTotal > 99 ? "99+" : unreadTotal}
          </span>
        )}
      </button>
    );
  }

  // Preview-Mode (Default) — kompakte Lasche auf Karte, RoK-Stil
  if (mode === "preview") {
    // Primary-Room: gewählter Preview-Room, sonst Crew → CvC → Heimat-Stadt/Bezirk → erste
    const defaultRoom =
      rooms.find((r) => r.kind === "crew") ??
      rooms.find((r) => r.kind === "cvc") ??
      rooms.find((r) => r.kind === "heimat_stadt") ??
      rooms.find((r) => r.kind === "heimat_bezirk") ??
      rooms[0] ??
      null;
    const activePreview = (previewRoomId && rooms.find((r) => r.room_id === previewRoomId)) || defaultRoom;
    // Channel-Liste — alle Räume in Preview-Pills
    return (
      <div
        onClick={() => {
          if (activePreview) setActiveRoomId(activePreview.room_id);
          setMode("expanded");
        }}
        style={{
          position: "fixed",
          bottom: 12,
          left: 12,
          zIndex: 99998,
          width: "min(340px, 60vw)",
          maxHeight: 150,
          background: "linear-gradient(180deg, rgba(15,17,21,0.55) 0%, rgba(15,17,21,0.35) 100%)",
          backdropFilter: "blur(10px) saturate(1.2)",
          WebkitBackdropFilter: "blur(10px) saturate(1.2)",
          borderRadius: 14,
          border: "1px solid rgba(255,255,255,0.1)",
          boxShadow: "0 4px 20px rgba(0,0,0,0.45), inset 0 1px 0 rgba(255,255,255,0.08)",
          cursor: "pointer",
          overflow: "hidden",
        }}
        className="flex flex-col"
        title="Klick zum Öffnen"
      >
        {/* Channel-Tabs (horizontal scroll) — Klick wechselt Channel im Preview, ohne Modal zu öffnen */}
        <div
          className="flex items-center px-1 py-1"
          style={{
            borderBottom: "1px solid rgba(255,255,255,0.06)",
            background: "rgba(34,209,195,0.06)",
            gap: 2,
            overflowX: "auto",
            scrollbarWidth: "none",
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {rooms.length === 0 ? (
            <span className="text-[9px] text-[#8B8FA3] px-2 py-0.5">Keine Räume</span>
          ) : rooms.map((r) => {
            const isActive = activePreview?.room_id === r.room_id;
            const labelKind = r.kind === "saved" ? "📝" : r.kind === "pm" ? "💬" : r.kind === "group" ? "👥" : r.kind === "crew" ? "🛡" : r.kind === "cvc" ? "⚔" : r.kind === "heimat_plz" ? "📍" : r.kind === "heimat_bezirk" ? "🏘" : "🏙";
            return (
              <button
                key={r.room_id}
                type="button"
                onClick={(e) => { e.stopPropagation(); setPreviewRoomId(r.room_id); }}
                className="flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[8px] font-bold flex-shrink-0 transition"
                style={{
                  background: isActive ? "rgba(34,209,195,0.25)" : "transparent",
                  color: isActive ? "#22D1C3" : "#C8CDD9",
                  border: isActive ? "1px solid rgba(34,209,195,0.6)" : "1px solid transparent",
                  textShadow: "0 1px 2px rgba(0,0,0,0.7)",
                  maxWidth: 110,
                }}
                title={r.name ?? ""}
              >
                <span>{labelKind}</span>
                <span className="truncate">{r.name ?? "Chat"}</span>
                {r.unread_count > 0 && !r.muted && (
                  <span
                    className="min-w-[12px] h-[12px] rounded-full text-[8px] font-bold flex items-center justify-center px-0.5"
                    style={{ background: r.has_mention ? "#FFD700" : "#FF2D78", color: r.has_mention ? "#0F1115" : "#FFF" }}
                  >
                    {r.unread_count > 99 ? "99+" : r.unread_count}
                  </span>
                )}
              </button>
            );
          })}
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); setOpen(false); }}
            className="ml-auto text-[#8B8FA3] hover:text-white p-0.5 flex-shrink-0"
            aria-label="Chat ausblenden"
          >
            <X size={10} />
          </button>
        </div>
        {/* Letzte Nachrichten (Stream) */}
        {activePreview ? (
          <ChatPreviewStream roomId={activePreview.room_id} cosmeticArt={cosmeticArt} />
        ) : (
          <div className="text-[9px] text-[#C8CDD9] text-center py-3 px-3" style={{ textShadow: "0 1px 2px rgba(0,0,0,0.6)" }}>
            Keine Räume verfügbar.
          </div>
        )}
      </div>
    );
  }

  // Expanded-Mode — großes Modal mit Tabs + Räumen + Input
  return (
    <>
      {/* Backdrop — Klick außerhalb schließt zurück zur Preview */}
      <div
        onClick={() => setMode("preview")}
        style={{
          position: "fixed", inset: 0, zIndex: 99997,
          background: "rgba(0,0,0,0.45)",
          backdropFilter: "blur(2px)", WebkitBackdropFilter: "blur(2px)",
        }}
      />
      <div
        style={{
          position: "fixed",
          bottom: 12,
          left: 12,
          zIndex: 99998,
          width: "min(560px, 90vw)",
          height: "min(560px, calc(100vh - 24px))",
          background: "linear-gradient(180deg, rgba(26,29,35,0.92) 0%, rgba(15,17,21,0.88) 100%)",
          backdropFilter: "blur(14px) saturate(1.3)",
          WebkitBackdropFilter: "blur(14px) saturate(1.3)",
          borderRadius: 18,
          border: "1px solid rgba(255,255,255,0.1)",
          boxShadow: "0 12px 48px rgba(0,0,0,0.6), 0 0 32px rgba(34,209,195,0.18)",
        }}
        className="flex flex-col overflow-hidden"
      >
        {/* Subtle top-edge cyan glow */}
        <div style={{
          position: "absolute", top: 0, left: 0, right: 0, height: 1,
          background: "linear-gradient(90deg, transparent, rgba(34,209,195,0.6), rgba(255,45,120,0.4), transparent)",
          pointerEvents: "none", zIndex: 1,
        }} />
        {!activeRoomId ? (
          <>
            {/* Tabs */}
            <div
              className="flex items-center px-1 py-1"
              style={{
                background: "rgba(26,29,35,0.55)",
                borderBottom: "1px solid rgba(255,255,255,0.08)",
              }}
            >
              <TabBtn active={tab === "heimat"} onClick={() => setTab("heimat")} icon={<MapPin size={14} />} label="Heimat" />
              <TabBtn active={tab === "crew"} onClick={() => setTab("crew")} icon={<Users size={14} />} label="Crew" />
              <TabBtn active={tab === "dm"} onClick={() => setTab("dm")} icon={<Hash size={14} />} label="DM" />
              <TabBtn active={tab === "cvc"} onClick={() => setTab("cvc")} icon={<Sword size={14} />} label="CvC" />
              <button onClick={() => setMode("preview")} className="ml-auto text-[#8B8FA3] hover:text-white p-1.5" aria-label="Schließen"><X size={14} /></button>
            </div>
            <div className="flex-1 overflow-y-auto">
              {tab === "heimat" && (
                <div
                  className="text-[10px] px-3 py-1.5 leading-snug"
                  style={{
                    color: "#FFFFFF",
                    background: "rgba(34,209,195,0.05)",
                    borderBottom: "1px solid rgba(255,255,255,0.05)",
                    textShadow: "0 1px 3px rgba(0,0,0,0.85)",
                  }}
                >
                  💡 Heimat-Räume richten sich nach der <b>Postleitzahl in deinen Einstellungen</b>.
                </div>
              )}
              {filteredRooms.length === 0 ? (
                <div className="text-xs text-[#C8CDD9] text-center py-8 px-4" style={{ textShadow: "0 1px 2px rgba(0,0,0,0.6)" }}>
                  {tab === "cvc" ? "Kein aktiver Saga-Round." : "Keine Räume hier."}
                </div>
              ) : filteredRooms.map((r) => (
                <RoomRow key={r.room_id} room={r} onClick={() => { setActiveRoomId(r.room_id); void refreshRooms(); }} onAfterAction={() => void refreshRooms()} />
              ))}
            </div>
          </>
        ) : (
          <RoomView
            roomId={activeRoomId}
            currentUserId={currentUserId}
            room={rooms.find((r) => r.room_id === activeRoomId)}
            cosmeticArt={cosmeticArt}
            onBack={() => { setActiveRoomId(null); void refreshRooms(); }}
            onAfterAction={() => void refreshRooms()}
          />
        )}
      </div>
    </>
  );
}

// Kompakte Vorschau-Liste der letzten Nachrichten eines Rooms — Polling alle 8s, kein Realtime
// (Realtime-Channel bleibt dem Expanded-Mode vorbehalten, sonst hätten wir 2 Subscriptions parallel).
type PreviewMsg = {
  id: string;
  body: string | null;
  created_at: string;
  author: {
    display_name: string | null;
    username: string | null;
    avatar_url?: string | null;
    crew_tag?: string | null;
    equipped_marker_id?: string | null;
    equipped_marker_variant?: string | null;
    equipped_base_ring_id?: string | null;
  } | null;
};
function ChatPreviewStream({ roomId, cosmeticArt }: { roomId: string; cosmeticArt: CosmeticArt }) {
  const [msgs, setMsgs] = useState<PreviewMsg[]>([]);

  useEffect(() => {
    let alive = true;
    const load = async () => {
      try {
        const r = await fetch(`/api/chat/rooms/${roomId}/messages?limit=8`, { cache: "no-store" });
        if (!r.ok || !alive) return;
        const j = await r.json() as { messages?: PreviewMsg[] };
        if (alive) setMsgs((j.messages ?? []).slice(-8));
      } catch { /* noop */ }
    };
    void load();
    const id = setInterval(load, 8000);
    return () => { alive = false; clearInterval(id); };
  }, [roomId]);

  if (msgs.length === 0) {
    return (
      <div className="text-[9px] text-[#8B8FA3] text-center py-3 px-3" style={{ textShadow: "0 1px 2px rgba(0,0,0,0.6)" }}>
        Noch keine Nachrichten.
      </div>
    );
  }

  return (
    <div className="overflow-y-auto" style={{ maxHeight: 112, padding: "2px 6px" }}>
      {msgs.map((m) => {
        const name = m.author?.display_name || m.author?.username || "—";
        const tag = m.author?.crew_tag;
        const markerId = m.author?.equipped_marker_id || "foot";
        const variant = (m.author?.equipped_marker_variant || "neutral") as "neutral" | "male" | "female";
        const markerAsset = cosmeticArt.marker?.[markerId]?.[variant] ?? cosmeticArt.marker?.[markerId]?.neutral;
        const ringId = m.author?.equipped_base_ring_id;
        const ringAsset = ringId && ringId !== "default" ? cosmeticArt.base_ring?.[ringId] : null;
        return (
          <div
            key={m.id}
            className="flex items-start gap-1.5 py-0.5"
            style={{ color: "#F0F0F0", textShadow: "0 1px 2px rgba(0,0,0,0.85)" }}
          >
            {/* Avatar mit Base-Ring */}
            <div style={{ position: "relative", width: 16, height: 16, flexShrink: 0, marginTop: 1 }}>
              {ringAsset?.video_url ? (
                <video
                  src={ringAsset.video_url}
                  autoPlay loop muted playsInline
                  style={{ position: "absolute", inset: -2, width: 20, height: 20, objectFit: "contain", filter: "url(#ma365-chroma-black)", pointerEvents: "none" }}
                />
              ) : ringAsset?.image_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={ringAsset.image_url}
                  alt=""
                  style={{ position: "absolute", inset: -2, width: 20, height: 20, objectFit: "contain", filter: "url(#ma365-chroma-black)", pointerEvents: "none" }}
                />
              ) : null}
              <div
                style={{
                  position: "absolute", inset: 0,
                  borderRadius: "50%",
                  background: "radial-gradient(circle at 30% 30%, rgba(255,255,255,0.15), rgba(70,82,122,0.4))",
                  border: ringAsset ? "none" : "1px solid rgba(255,255,255,0.25)",
                  overflow: "hidden",
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}
              >
                {markerAsset?.video_url ? (
                  <video src={markerAsset.video_url} autoPlay loop muted playsInline style={{ width: 14, height: 14, objectFit: "contain", filter: "url(#ma365-chroma-black)" }} />
                ) : markerAsset?.image_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={markerAsset.image_url} alt="" style={{ width: 14, height: 14, objectFit: "contain", filter: "url(#ma365-chroma-black)" }} />
                ) : m.author?.avatar_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={m.author.avatar_url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                ) : (
                  <span style={{ fontSize: 9, color: "#FFE4B8", fontWeight: 900 }}>{(name[0] ?? "?").toUpperCase()}</span>
                )}
              </div>
            </div>
            {/* Nachricht-Inhalt */}
            <div className="flex-1 min-w-0 text-[7.5px] leading-tight">
              {tag && <span className="text-[#22D1C3] font-bold">[{tag}]</span>}
              <span className="font-bold text-white">{tag ? " " : ""}{name}:</span>
              <span className="text-[#E8E8EE] ml-1">{m.body ?? ""}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function TabBtn({ active, onClick, icon, label }: { active: boolean; onClick: () => void; icon: React.ReactNode; label: string }) {
  return (
    <button onClick={onClick}
      className={`flex-1 px-2 py-1.5 text-[10px] font-bold flex items-center justify-center gap-1 transition ${active ? "text-[#22D1C3] border-b-2 border-[#22D1C3]" : "text-[#8B8FA3] hover:text-[#F0F0F0]"}`}>
      {icon}<span>{label}</span>
    </button>
  );
}
function RoomRow({ room, onClick, onAfterAction }: { room: Room; onClick: () => void; onAfterAction: () => void }) {
  const labelKind = room.kind === "saved" ? "📝" : room.kind === "pm" ? "💬" : room.kind === "group" ? "👥" : room.kind === "crew" ? "🛡" : room.kind === "cvc" ? "⚔️" : room.kind === "heimat_plz" ? "📍" : room.kind === "heimat_bezirk" ? "🏘" : "🏙";
  const [menuOpen, setMenuOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const lpTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lpFiredRef = useRef(false);
  const startLP = () => {
    if (lpTimer.current) clearTimeout(lpTimer.current);
    lpFiredRef.current = false;
    lpTimer.current = setTimeout(() => {
      lpFiredRef.current = true;
      setMenuOpen(true);
    }, 500);
  };
  const cancelLP = () => { if (lpTimer.current) { clearTimeout(lpTimer.current); lpTimer.current = null; } };
  const handleClick = () => {
    if (lpFiredRef.current) { lpFiredRef.current = false; return; }
    onClick();
  };

  async function patchState(patch: { archive?: boolean; mute?: boolean; hide?: boolean }) {
    await fetch(`/api/chat/rooms/${room.room_id}/state`, {
      method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(patch),
    });
    setMenuOpen(false);
    onAfterAction();
  }

  return (
    <div className="relative">
      <button
        onClick={handleClick}
        onMouseDown={startLP} onMouseUp={cancelLP} onMouseLeave={cancelLP}
        onTouchStart={startLP} onTouchEnd={cancelLP} onTouchCancel={cancelLP}
        onContextMenu={(e) => { e.preventDefault(); lpFiredRef.current = true; setMenuOpen(true); }}
        className="w-full px-3 py-2.5 flex items-center gap-2.5 text-left hover:bg-white/[0.05] transition"
        style={{ borderBottom: "1px solid rgba(255,255,255,0.05)", opacity: room.archived ? 0.55 : 1 }}>
        <div
          className="w-9 h-9 rounded-full flex items-center justify-center text-base flex-shrink-0"
          style={{
            background: "linear-gradient(135deg, rgba(34,209,195,0.18), rgba(255,45,120,0.14))",
            border: "1px solid rgba(255,255,255,0.18)",
            boxShadow: "0 2px 6px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.15)",
            backdropFilter: "blur(8px)", WebkitBackdropFilter: "blur(8px)",
          }}>
          {labelKind}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <div className="text-xs font-bold text-[#FFFFFF] truncate flex items-center gap-1" style={{ textShadow: "0 1px 2px rgba(0,0,0,0.7)" }}>
              {room.muted && <span title="Stumm">🔕</span>}
              {room.archived && <span title="Archiviert" className="text-[#8B8FA3]">📦</span>}
              <span className="truncate">{room.name ?? "Chat"}</span>
            </div>
            {room.unread_count > 0 && !room.muted && (
              <span className={`min-w-[18px] h-[18px] rounded-full text-[9px] font-bold flex items-center justify-center px-1 ${room.has_mention ? "bg-[#FFD700] text-[#0F1115]" : "bg-[#FF2D78] text-white"}`}>
                {room.unread_count > 99 ? "99+" : room.unread_count}
              </span>
            )}
          </div>
          {room.last_message_preview && (
            <div className="text-[10px] text-[#C8CDD9] truncate" style={{ textShadow: "0 1px 2px rgba(0,0,0,0.6)" }}>
              {room.last_message_user && <b>{room.last_message_user}: </b>}{room.last_message_preview}
            </div>
          )}
        </div>
      </button>
      {menuOpen && (
        <>
          <div className="fixed inset-0 z-[10000]" onClick={() => setMenuOpen(false)} />
          <div
            className="absolute right-2 top-1/2 z-[10001] rounded-lg py-1 shadow-xl"
            style={{
              minWidth: 160, transform: "translateY(-10%)",
              background: "rgba(15,17,21,0.95)", border: "1px solid rgba(34,209,195,0.3)",
              backdropFilter: "blur(12px)", WebkitBackdropFilter: "blur(12px)",
            }}
          >
            <MoreItem icon={<span>{room.archived ? "📤" : "📦"}</span>} label={room.archived ? "Wiederherstellen" : "Archivieren"} onClick={() => patchState({ archive: !room.archived })} />
            <MoreItem icon={<span>{room.muted ? "🔔" : "🔕"}</span>} label={room.muted ? "Stumm aus" : "Stummen"} onClick={() => patchState({ mute: !room.muted })} />
            <MoreItem icon={<Flag size={12} />} label="Melden" onClick={() => { setMenuOpen(false); setReportOpen(true); }} />
            <MoreItem icon={<Trash2 size={12} />} label="Löschen" danger onClick={() => patchState({ hide: true })} />
          </div>
        </>
      )}
      {reportOpen && (
        <RoomReportModal roomId={room.room_id} onClose={() => setReportOpen(false)} onSent={() => { setReportOpen(false); onAfterAction(); }} />
      )}
    </div>
  );
}

function RoomReportModal({ roomId, onClose, onSent }: { roomId: string; onClose: () => void; onSent: () => void }) {
  const REASONS = [
    { k: "spam", l: "Spam" }, { k: "harassment", l: "Belästigung" }, { k: "hate", l: "Hass" },
    { k: "sexual", l: "Sexueller Inhalt" }, { k: "violence", l: "Gewalt" }, { k: "other", l: "Sonstiges" },
  ];
  const [reason, setReason] = useState("spam");
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  async function submit() {
    setBusy(true);
    await fetch(`/api/chat/rooms/${roomId}/report`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ reason, body: body.trim() || null }) });
    setBusy(false); setDone(true);
    setTimeout(onSent, 1200);
  }
  return (
    <div className="fixed inset-0 z-[10002] bg-black/60 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-[#0F1115] border border-[#FF2D78]/30 rounded-2xl p-4 w-full max-w-sm" onClick={(e) => e.stopPropagation()}>
        <div className="text-sm font-bold text-[#F0F0F0] mb-3 flex items-center gap-2"><Flag size={14} className="text-[#FF2D78]" /> Chat melden</div>
        {done ? <div className="text-xs text-[#22D1C3] py-3 text-center">✓ Vielen Dank, wird geprüft.</div> : (
          <>
            <select value={reason} onChange={(e) => setReason(e.target.value)} className="w-full mb-2 bg-[#1A1D23] border border-white/10 rounded px-3 py-1.5 text-sm text-[#F0F0F0]">
              {REASONS.map((r) => <option key={r.k} value={r.k}>{r.l}</option>)}
            </select>
            <textarea value={body} onChange={(e) => setBody(e.target.value)} placeholder="Details (optional)" rows={2} className="w-full bg-[#1A1D23] border border-white/10 rounded px-3 py-1.5 text-xs text-[#F0F0F0] resize-none" />
            <div className="flex gap-2 mt-3">
              <button onClick={onClose} className="flex-1 bg-white/5 text-[#8B8FA3] py-2 rounded text-xs">Abbrechen</button>
              <button onClick={submit} disabled={busy} className="flex-1 bg-[#FF2D78] text-white py-2 rounded text-xs font-bold disabled:opacity-50">Melden</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════
// ROOM VIEW
// ════════════════════════════════════════════════════════════════════

function RoomView({ roomId, room, currentUserId, cosmeticArt, onBack, onAfterAction }: {
  roomId: string; room: Room | undefined; currentUserId: string; cosmeticArt: CosmeticArt; onBack: () => void; onAfterAction: () => void;
}) {
  const [headerMenuOpen, setHeaderMenuOpen] = useState(false);
  const [headerReportOpen, setHeaderReportOpen] = useState(false);
  async function patchRoom(patch: { archive?: boolean; mute?: boolean; hide?: boolean }) {
    await fetch(`/api/chat/rooms/${roomId}/state`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(patch) });
    setHeaderMenuOpen(false);
    onAfterAction();
    if (patch.hide) onBack();
  }
  const [messages, setMessages] = useState<Message[]>([]);
  const [composeText, setComposeText] = useState("");
  const [replyTo, setReplyTo] = useState<Message | null>(null);
  const [editing, setEditing] = useState<Message | null>(null);
  const [moreMenuFor, setMoreMenuFor] = useState<string | null>(null);
  const [emojiPickerFor, setEmojiPickerFor] = useState<string | null>(null);
  const [typingUsers, setTypingUsers] = useState<Set<string>>(new Set());
  const [showPollComposer, setShowPollComposer] = useState(false);
  const [showSchedule, setShowSchedule] = useState(false);
  const [showRally, setShowRally] = useState(false);
  const [reportFor, setReportFor] = useState<Message | null>(null);
  const [showPinnedList, setShowPinnedList] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  useEffect(() => { if (!toast) return; const t = setTimeout(() => setToast(null), 3000); return () => clearTimeout(t); }, [toast]);
  const scrollRef = useRef<HTMLDivElement>(null);

  const loadMessages = useCallback(async () => {
    const r = await fetch(`/api/chat/rooms/${roomId}/messages?limit=80`, { cache: "no-store" });
    if (!r.ok) return;
    const j = await r.json() as { messages: Message[] };
    setMessages(j.messages);
    // Mark read
    void fetch("/api/chat/read", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ room_id: roomId, message_id: j.messages.at(-1)?.id }) });
  }, [roomId]);

  useEffect(() => { void loadMessages(); }, [loadMessages]);

  useChatRealtime(roomId, useCallback((kind, _payload) => {
    if (kind === "message" || kind === "reaction") void loadMessages();
    if (kind === "typing") {
      // Refresh typing users
      void (async () => {
        const sb = await import("@/lib/supabase/client").then((m) => m.createClient());
        const since = new Date(Date.now() - 6000).toISOString();
        const { data } = await sb.from("chat_typing")
          .select("user_id, started_at")
          .eq("room_id", roomId).gte("started_at", since);
        const set = new Set<string>();
        for (const t of (data ?? []) as Array<{ user_id: string }>) {
          if (t.user_id !== currentUserId) set.add(t.user_id);
        }
        setTypingUsers(set);
      })();
    }
  }, [roomId, currentUserId, loadMessages]));

  // Auto-scroll bei neuen Messages
  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages]);

  // Typing-Ping debounced
  const typingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  function onComposeChange(v: string) {
    setComposeText(v);
    if (!typingTimer.current) {
      void fetch("/api/chat/typing", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ room_id: roomId }) });
      typingTimer.current = setTimeout(() => { typingTimer.current = null; }, 3000);
    }
  }

  async function sendMessage() {
    const text = composeText.trim();
    if (!text) return;
    if (editing) {
      const r = await fetch(`/api/chat/messages/${editing.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ body: text }) });
      if (!r.ok) {
        const j = await r.json().catch(() => ({})) as { error?: string };
        setToast(j.error === "edit_window_expired" ? "Bearbeitung nur in der ersten Minute möglich" : "Fehler: " + (j.error ?? "unbekannt"));
        return;
      }
      setEditing(null);
    } else {
      await fetch(`/api/chat/rooms/${roomId}/messages`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ body: text, reply_to_id: replyTo?.id ?? null }) });
      setReplyTo(null);
    }
    setComposeText("");
    void loadMessages();
  }

  const pinnedMessages = useMemo(() => messages.filter((m) => m.pinned_at && !m.deleted_at).sort((a, b) => (b.pinned_at ?? "").localeCompare(a.pinned_at ?? "")), [messages]);

  return (
    <>
      {/* Sub-Header mit Back + Room-Name + Pinned-Toggle */}
      <div
        className="flex items-center justify-between px-3 py-2"
        style={{
          background: "linear-gradient(90deg, rgba(34,209,195,0.06), rgba(255,45,120,0.04))",
          borderBottom: "1px solid rgba(255,255,255,0.06)",
        }}
      >
        <button onClick={onBack} className="text-[#22D1C3] text-xs font-bold" style={{ textShadow: "0 1px 3px rgba(0,0,0,0.7)" }}>← Zurück</button>
        <div className="text-xs font-bold text-[#F0F0F0] truncate flex-1 text-center px-2 flex items-center justify-center gap-1" style={{ textShadow: "0 1px 3px rgba(0,0,0,0.6)" }}>
          {room?.muted && <span title="Stumm">🔕</span>}
          {room?.archived && <span title="Archiviert" className="text-[#8B8FA3]">📦</span>}
          <span className="truncate">{room?.name ?? "Chat"}</span>
        </div>
        {pinnedMessages.length > 0 && (
          <button onClick={() => setShowPinnedList(!showPinnedList)} className="text-[#FFD700] mr-1">
            <Pin size={14} />
            <span className="text-[10px] ml-0.5">{pinnedMessages.length}</span>
          </button>
        )}
        <div className="relative">
          <button onClick={() => setHeaderMenuOpen(!headerMenuOpen)} className="text-[#C8CDD9] hover:text-white p-0.5" title="Mehr"><MoreVertical size={16} /></button>
          {headerMenuOpen && (
            <>
              <div className="fixed inset-0 z-[10000]" onClick={() => setHeaderMenuOpen(false)} />
              <div
                className="absolute right-0 top-full mt-1 z-[10001] rounded-lg py-1 shadow-xl"
                style={{
                  minWidth: 170,
                  background: "rgba(15,17,21,0.95)",
                  border: "1px solid rgba(34,209,195,0.3)",
                  backdropFilter: "blur(12px)",
                  WebkitBackdropFilter: "blur(12px)",
                }}
              >
                <MoreItem icon={<span>{room?.archived ? "📤" : "📦"}</span>} label={room?.archived ? "Wiederherstellen" : "Archivieren"} onClick={() => patchRoom({ archive: !room?.archived })} />
                <MoreItem icon={<span>{room?.muted ? "🔔" : "🔕"}</span>} label={room?.muted ? "Stumm aus" : "Stummen"} onClick={() => patchRoom({ mute: !room?.muted })} />
                <MoreItem icon={<Flag size={12} />} label="Melden" onClick={() => { setHeaderMenuOpen(false); setHeaderReportOpen(true); }} />
                <MoreItem icon={<Trash2 size={12} />} label="Aus Liste entfernen" danger onClick={() => patchRoom({ hide: true })} />
              </div>
            </>
          )}
        </div>
      </div>
      {headerReportOpen && (
        <RoomReportModal roomId={roomId} onClose={() => setHeaderReportOpen(false)} onSent={() => { setHeaderReportOpen(false); onAfterAction(); }} />
      )}

      {/* Pinned Drop-Down */}
      {showPinnedList && pinnedMessages.length > 0 && (
        <div className="border-b border-[#FFD700]/30 bg-[#FFD700]/5 max-h-[120px] overflow-y-auto">
          {pinnedMessages.map((m) => (
            <div key={m.id} className="px-3 py-1.5 text-xs text-[#F0F0F0] border-b border-white/5 flex items-start gap-2">
              <Pin size={11} className="text-[#FFD700] mt-0.5 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <b className="text-[#FFD700]">{m.author?.display_name ?? m.author?.username}: </b>
                <span className="text-[#F0F0F0]">{m.body}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-2 py-1.5">
        {messages.length === 0 && <div className="text-xs text-[#8B8FA3] text-center py-6">Sag „Hallo" 👋</div>}
        {messages.map((m, idx) => {
          const prev = messages[idx - 1];
          const sameAuthor = prev && prev.user_id === m.user_id && prev.kind !== "system";
          return (
            <MessageRow
              key={m.id} m={m} sameAuthor={sameAuthor} currentUserId={currentUserId}
              messages={messages} cosmeticArt={cosmeticArt}
              onReply={() => setReplyTo(m)}
              onEdit={() => {
                if (Date.now() - new Date(m.created_at).getTime() > 60_000) {
                  setToast("Bearbeitung nur in der ersten Minute möglich");
                  return;
                }
                setEditing(m); setComposeText(m.body ?? "");
              }}
              onDelete={async () => { await fetch(`/api/chat/messages/${m.id}`, { method: "DELETE" }); void loadMessages(); }}
              onReact={async (emoji) => { await fetch(`/api/chat/messages/${m.id}/react`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ emoji }) }); void loadMessages(); }}
              onPin={async () => { await fetch(`/api/chat/messages/${m.id}/pin`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ unpin: !!m.pinned_at }) }); void loadMessages(); }}
              onReport={() => setReportFor(m)}
              onBlock={async () => { if (m.user_id) { await fetch("/api/chat/block", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ user_id: m.user_id }) }); } }}
              onPollVote={async (idx) => { await fetch("/api/chat/poll/vote", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ message_id: m.id, option_index: idx }) }); void loadMessages(); }}
              moreOpen={moreMenuFor === m.id} setMoreOpen={(v) => setMoreMenuFor(v ? m.id : null)}
              emojiOpen={emojiPickerFor === m.id} setEmojiOpen={(v) => setEmojiPickerFor(v ? m.id : null)}
            />
          );
        })}
        {typingUsers.size > 0 && (
          <div className="text-[11px] text-[#8B8FA3] italic flex items-center gap-1">
            <span className="inline-flex gap-0.5">
              <span className="w-1 h-1 bg-[#22D1C3] rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
              <span className="w-1 h-1 bg-[#22D1C3] rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
              <span className="w-1 h-1 bg-[#22D1C3] rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
            </span>
            <span>schreibt …</span>
          </div>
        )}
      </div>

      {/* Reply / Edit Banner */}
      {(replyTo || editing) && (
        <div className="px-3 py-1.5 border-t border-white/10 bg-[#1A1D23] text-[11px] text-[#8B8FA3] flex items-center justify-between gap-2">
          <span className="truncate">
            {editing ? "✏️ Bearbeiten" : `↩️ Antwort an ${replyTo?.author?.display_name ?? "?"}: ${replyTo?.body?.slice(0, 50)}…`}
          </span>
          <button onClick={() => { setReplyTo(null); setEditing(null); setComposeText(""); }} className="text-[#FF2D78]">✕</button>
        </div>
      )}

      {/* Compose */}
      <div
        className="p-2 flex items-center gap-1.5"
        style={{
          background: "linear-gradient(180deg, rgba(15,17,21,0.25), rgba(15,17,21,0.45))",
          borderTop: "1px solid rgba(255,255,255,0.06)",
        }}
      >
        <button onClick={() => setShowPollComposer(true)} className="text-[#8B8FA3] hover:text-[#22D1C3] p-1.5" title="Umfrage"><BarChart3 size={16} /></button>
        <button onClick={() => setShowSchedule(true)} className="text-[#8B8FA3] hover:text-[#22D1C3] p-1.5" title="Geplant senden"><Clock size={16} /></button>
        {(room?.kind === "crew" || room?.kind === "cvc") && (
          <button onClick={() => setShowRally(true)} className="text-[#8B8FA3] hover:text-[#FF2D78] p-1.5" title="Rally setzen"><MapPin size={16} /></button>
        )}
        <input
          value={composeText}
          onChange={(e) => onComposeChange(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void sendMessage(); } }}
          placeholder="Nachricht..."
          className="flex-1 rounded-full px-3 py-1.5 text-sm text-[#F0F0F0] placeholder:text-[#C8CDD9] focus:outline-none"
          style={{
            background: "rgba(255,255,255,0.08)",
            border: "1px solid rgba(255,255,255,0.15)",
            backdropFilter: "blur(6px)",
            WebkitBackdropFilter: "blur(6px)",
          }}
        />
        <button onClick={() => void sendMessage()} disabled={!composeText.trim()}
          className="w-8 h-8 rounded-full bg-gradient-to-br from-[#22D1C3] to-[#FF2D78] text-white flex items-center justify-center disabled:opacity-30">
          <Send size={14} />
        </button>
      </div>

      {showPollComposer && (
        <PollComposer roomId={roomId} onClose={() => setShowPollComposer(false)} onSent={() => { setShowPollComposer(false); void loadMessages(); }} />
      )}
      {showSchedule && (
        <ScheduleComposer roomId={roomId} onClose={() => setShowSchedule(false)} onSent={() => setShowSchedule(false)} />
      )}
      {showRally && (
        <RallyComposer roomId={roomId} onClose={() => setShowRally(false)} onSent={() => { setShowRally(false); void loadMessages(); }} />
      )}
      {reportFor && (
        <ReportModal message={reportFor} onClose={() => setReportFor(null)} onSent={() => setReportFor(null)} />
      )}
      {toast && (
        <div
          style={{
            position: "absolute", bottom: 56, left: "50%", transform: "translateX(-50%)",
            background: "rgba(15,17,21,0.95)", border: "1px solid rgba(255,107,74,0.5)",
            color: "#F0F0F0", padding: "6px 12px", borderRadius: 8, fontSize: 11,
            boxShadow: "0 4px 14px rgba(0,0,0,0.5)", zIndex: 50, pointerEvents: "none",
            whiteSpace: "nowrap",
          }}
        >
          ⏱ {toast}
        </div>
      )}
    </>
  );
}

// ════════════════════════════════════════════════════════════════════
// MESSAGE ROW
// ════════════════════════════════════════════════════════════════════

function MessageRow({ m, sameAuthor, currentUserId, messages, cosmeticArt, onReply, onEdit, onDelete, onReact, onPin, onReport, onBlock, onPollVote, moreOpen, setMoreOpen, emojiOpen, setEmojiOpen }: {
  m: Message; sameAuthor: boolean; currentUserId: string; messages: Message[]; cosmeticArt: CosmeticArt;
  onReply: () => void; onEdit: () => void; onDelete: () => void;
  onReact: (e: string) => void; onPin: () => void; onReport: () => void; onBlock: () => void;
  onPollVote: (idx: number) => void;
  moreOpen: boolean; setMoreOpen: (v: boolean) => void;
  emojiOpen: boolean; setEmojiOpen: (v: boolean) => void;
}) {
  const isOwn = m.user_id === currentUserId;
  const isSystem = m.kind === "system";
  const replyTo = m.reply_to_id ? messages.find((x) => x.id === m.reply_to_id) : null;
  const lpTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const bubbleRef = useRef<HTMLDivElement>(null);
  const [menuPos, setMenuPos] = useState<{ top: number; left: number; right: number } | null>(null);
  const openMenu = () => {
    const r = bubbleRef.current?.getBoundingClientRect();
    if (r) setMenuPos({ top: r.top, left: r.left, right: window.innerWidth - r.right });
    setMoreOpen(true);
  };
  const startLP = () => {
    if (lpTimer.current) clearTimeout(lpTimer.current);
    lpTimer.current = setTimeout(openMenu, 450);
  };
  const cancelLP = () => { if (lpTimer.current) { clearTimeout(lpTimer.current); lpTimer.current = null; } };

  if (isSystem) {
    return (
      <div className="text-[10px] text-[#8B8FA3] text-center py-1 italic">{m.body}</div>
    );
  }

  // Reactions zusammenfassen
  const rxMap = new Map<string, number>();
  let myRx = new Set<string>();
  for (const r of m.reactions ?? []) {
    rxMap.set(r.emoji, (rxMap.get(r.emoji) ?? 0) + 1);
    if (r.user_id === currentUserId) myRx.add(r.emoji);
  }

  return (
    <div className="flex gap-1.5 mt-1" style={{ flexDirection: isOwn ? "row-reverse" : "row" }}>
      <div style={{ width: 28, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", overflow: "visible" }}>
        <ChatAvatar author={m.author} cosmeticArt={cosmeticArt} />
      </div>
      <div className={`flex-1 min-w-0 flex flex-col ${isOwn ? "items-end" : "items-start"}`}>
        <div
          className={`group relative inline-block max-w-[260px] rounded-lg px-2 py-1 text-[11px] leading-snug ${m.kind === "rally" ? "text-[#F0F0F0] cursor-pointer hover:scale-[1.02]" : isOwn ? "bg-[#22D1C3]/15 border border-[#22D1C3]/30 text-[#F0F0F0]" : "bg-[#1A1D23] border border-white/10 text-[#F0F0F0]"} ${m.pinned_at ? "ring-1 ring-[#FFD700]/40" : ""}`}
          style={m.kind === "rally" ? {
            background: "linear-gradient(135deg, rgba(255,45,120,0.22), rgba(255,107,74,0.18) 60%, rgba(255,215,0,0.18))",
            border: "1px dashed rgba(255,107,74,0.6)",
            boxShadow: "0 0 12px rgba(255,107,74,0.3), inset 0 0 12px rgba(255,45,120,0.15)",
            backgroundImage: "linear-gradient(135deg, rgba(255,45,120,0.22), rgba(255,107,74,0.18) 60%, rgba(255,215,0,0.18)), repeating-linear-gradient(45deg, transparent 0 12px, rgba(255,255,255,0.04) 12px 13px)",
            transition: "transform 0.15s",
          } : undefined}
          onMouseDown={startLP} onMouseUp={cancelLP} onMouseLeave={cancelLP}
          onTouchStart={startLP} onTouchEnd={cancelLP} onTouchCancel={cancelLP}
          onContextMenu={(e) => { e.preventDefault(); openMenu(); }}
          ref={bubbleRef}
          onClick={() => {
            if (m.kind !== "rally" || m.attachments == null) return;
            const a = m.attachments as { lat?: number; lng?: number };
            if (a.lat != null && a.lng != null) {
              window.dispatchEvent(new CustomEvent("ma365-map-fly-to", { detail: { lat: a.lat, lng: a.lng, zoom: 18 } }));
            }
          }}
        >
          {replyTo && (
            <div className="text-[10px] border-l-2 border-[#22D1C3] pl-1.5 mb-1 text-[#8B8FA3]">
              <b>{replyTo.author?.display_name ?? "?"}</b>: {replyTo.body?.slice(0, 60)}…
            </div>
          )}
          {m.deleted_at ? (
            <span className="italic text-[#8B8FA3]">[gelöscht]</span>
          ) : (
            <span>
              <span style={{ color: "#8B8FA3" }}>{new Date(m.created_at).toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" })}</span>
              {m.author?.crew_tag && <> <span style={{ color: "#22D1C3" }} className="font-bold">[{m.author.crew_tag}]</span></>}
              {" "}<span style={{ color: "#FFFFFF" }} className="font-semibold">{m.author?.display_name ?? m.author?.username ?? "?"}</span>
              <span style={{ color: "#8B8FA3" }}>{" · "}</span>
              <MessageBody body={m.body ?? ""} />
              <TranslateInline text={m.body ?? ""} />
            </span>
          )}
          {/* Rally-Posts: keine fette Card mehr — Body enthält bereits "hat ANGRIFF gesetzt", Klick fliegt auf Map */}
          {m.poll && (
            <PollBlock poll={m.poll} currentUserId={currentUserId} onVote={onPollVote} />
          )}
          {m.edited_at && !m.deleted_at && <span className="text-[9px] text-[#8B8FA3] ml-1">(bearbeitet)</span>}
          {/* Reactions */}
          {rxMap.size > 0 && (
            <div className="flex flex-wrap gap-1 mt-1">
              {Array.from(rxMap.entries()).map(([emoji, count]) => (
                <button key={emoji} onClick={() => onReact(emoji)}
                  className={`text-[11px] px-1.5 py-0.5 rounded-full border ${myRx.has(emoji) ? "bg-[#22D1C3]/20 border-[#22D1C3]" : "bg-white/5 border-white/10"}`}>
                  {emoji} {count}
                </button>
              ))}
            </div>
          )}
          {/* Hover-Actions */}
          <div className={`absolute ${isOwn ? "left-0 -translate-x-full" : "right-0 translate-x-full"} top-0 hidden group-hover:flex items-center gap-0.5 px-1`}>
            <button onClick={() => setEmojiOpen(!emojiOpen)} className="w-6 h-6 rounded-full bg-[#1A1D23] border border-white/10 text-[#8B8FA3] hover:text-[#FFD700] flex items-center justify-center" title="Reaktion"><Smile size={12} /></button>
            <button onClick={onReply} className="w-6 h-6 rounded-full bg-[#1A1D23] border border-white/10 text-[#8B8FA3] hover:text-[#22D1C3] flex items-center justify-center" title="Antworten"><Reply size={12} /></button>
            <button onClick={() => setMoreOpen(!moreOpen)} className="w-6 h-6 rounded-full bg-[#1A1D23] border border-white/10 text-[#8B8FA3] hover:text-white flex items-center justify-center" title="Mehr"><MoreVertical size={12} /></button>
          </div>
          {emojiOpen && (
            <div className={`absolute z-10 ${isOwn ? "right-0" : "left-0"} top-full mt-1 bg-[#0F1115] border border-white/10 rounded-lg p-1.5 flex gap-1 shadow-xl`} onClick={(e) => e.stopPropagation()}>
              {["👍","❤️","😂","🔥","😢","🎉","👎","💯"].map((e) => (
                <button key={e} onClick={() => { onReact(e); setEmojiOpen(false); }} className="text-base hover:scale-125 transition">{e}</button>
              ))}
            </div>
          )}
          {moreOpen && menuPos && typeof document !== "undefined" && createPortal(
            <>
              <div style={{ position: "fixed", inset: 0, zIndex: 100000 }} onClick={() => setMoreOpen(false)} />
              <div
                className="rounded-xl shadow-2xl flex items-stretch p-1 gap-0.5"
                style={{
                  position: "fixed",
                  zIndex: 100001,
                  ...(isOwn ? { right: menuPos.right } : { left: menuPos.left }),
                  top: Math.max(8, menuPos.top - 56),
                  background: "rgba(15,17,21,0.82)",
                  border: "1px solid rgba(255,255,255,0.1)",
                  boxShadow: "0 4px 14px rgba(0,0,0,0.4)",
                  backdropFilter: "blur(16px) saturate(1.4)",
                  WebkitBackdropFilter: "blur(16px) saturate(1.4)",
                }}
                onClick={(e) => e.stopPropagation()}
              >
                <MenuTile icon="📋" label="Kopieren" onClick={() => { void navigator.clipboard.writeText(m.body ?? ""); setMoreOpen(false); }} />
                <MenuTile icon={<Reply size={14} />} label="Antworten" onClick={() => { onReply(); setMoreOpen(false); }} />
                <MenuTile icon={<Pin size={14} />} label={m.pinned_at ? "Lösen" : "Pin"} onClick={() => { onPin(); setMoreOpen(false); }} />
                {isOwn && <MenuTile icon={<Edit3 size={14} />} label="Edit" onClick={() => { onEdit(); setMoreOpen(false); }} />}
                {isOwn && <MenuTile icon={<Trash2 size={14} />} label="Löschen" danger onClick={() => { onDelete(); setMoreOpen(false); }} />}
                {!isOwn && <MenuTile icon={<Flag size={14} />} label="Melden" danger onClick={() => { onReport(); setMoreOpen(false); }} />}
                {!isOwn && <MenuTile icon={<UserX size={14} />} label="Block" danger onClick={() => { onBlock(); setMoreOpen(false); }} />}
              </div>
            </>,
            document.body
          )}
        </div>
      </div>
    </div>
  );
}

function ChatAvatar({ author, cosmeticArt }: { author: Author | null; cosmeticArt: CosmeticArt }) {
  const SIZE = 28;
  const RING_SCALE = 1.7;
  const RING_SIZE = Math.round(SIZE * RING_SCALE);
  const ringId = author?.equipped_base_ring_id ?? "default";
  const ringArt = cosmeticArt.base_ring?.[ringId] ?? null;
  const markerId = author?.equipped_marker_id ?? "foot";
  const variant = author?.equipped_marker_variant ?? "neutral";
  const markerArt = cosmeticArt.marker?.[markerId]?.[variant] ?? cosmeticArt.marker?.[markerId]?.neutral ?? null;
  const initial = (author?.display_name ?? author?.username ?? "?")[0]?.toUpperCase();

  return (
    <div style={{ position: "relative", width: SIZE, height: SIZE, display: "flex", alignItems: "center", justifyContent: "center" }}>
      {/* Inner badge — Map-Icon (centered) */}
      <div
        style={{
          position: "absolute", top: "50%", left: "50%", transform: "translate(-50%, -50%)",
          width: SIZE - 6, height: SIZE - 6,
          borderRadius: 9999, overflow: "hidden",
          background: "radial-gradient(circle at 35% 30%, #2A2F38, #0F1115)",
          border: "2px solid rgba(255,255,255,0.85)",
          boxShadow: "0 2px 6px rgba(0,0,0,0.6), inset 0 0 6px rgba(34,209,195,0.3)",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 12, color: "#F0F0F0", fontWeight: 700, zIndex: 2,
        }}
      >
        {markerArt?.image_url ? (
          <img
            src={markerArt.image_url}
            alt=""
            style={{ width: "100%", height: "100%", objectFit: "contain", filter: "url(#ma365-chroma-black)" }}
          />
        ) : author?.avatar_url ? (
          <img src={author.avatar_url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        ) : (
          initial
        )}
      </div>
      {/* Ring (overlay around badge — same center, larger) */}
      {ringArt?.image_url ? (
        <img
          src={ringArt.image_url}
          alt=""
          style={{
            position: "absolute", top: "50%", left: "50%",
            transform: "translate(-50%, -50%)",
            width: RING_SIZE, height: RING_SIZE,
            objectFit: "contain", pointerEvents: "none", zIndex: 3,
            filter: "url(#ma365-chroma-black) drop-shadow(0 0 4px rgba(34,209,195,0.5))",
          }}
        />
      ) : (
        <div
          style={{
            position: "absolute", top: "50%", left: "50%", transform: "translate(-50%, -50%)",
            width: SIZE, height: SIZE, borderRadius: 9999,
            background: "linear-gradient(135deg, #22D1C3 0%, #B026FF 50%, #FF2D78 100%)",
            WebkitMask: "radial-gradient(circle, transparent 62%, black 64%)",
            mask: "radial-gradient(circle, transparent 62%, black 64%)",
            zIndex: 3, pointerEvents: "none",
          }}
        />
      )}
    </div>
  );
}

function MenuTile({ icon, label, onClick, danger, sub }: { icon: React.ReactNode; label: string; onClick: () => void; danger?: boolean; sub?: string }) {
  return (
    <button
      onClick={onClick}
      className="relative flex flex-col items-center justify-center gap-0.5 px-2.5 py-1.5 rounded-lg hover:bg-white/10 transition min-w-[56px]"
      style={{ color: danger ? "#FF2D78" : "#F0F0F0" }}
    >
      <span className="text-base leading-none flex items-center justify-center" style={{ width: 16, height: 16 }}>{icon}</span>
      <span className="text-[9px] font-semibold whitespace-nowrap">{label}</span>
      {sub && <span className="absolute top-0 right-0.5 text-[7px] text-[#8B8FA3] font-bold">{sub}</span>}
    </button>
  );
}

function MoreItem({ icon, label, onClick, danger }: { icon: React.ReactNode; label: string; onClick: () => void; danger?: boolean }) {
  return (
    <button onClick={onClick}
      className={`w-full px-3 py-1.5 text-left text-[11px] flex items-center gap-2 hover:bg-white/5 ${danger ? "text-[#FF2D78]" : "text-[#F0F0F0]"}`}>
      {icon}{label}
    </button>
  );
}

// Markdown-lite Rendering
function MessageBody({ body }: { body: string }) {
  // **bold** *italic* `code` ~~strike~~ + @mention highlight
  const parts: React.ReactNode[] = [];
  let i = 0; let buf = ""; const flush = () => { if (buf) parts.push(buf); buf = ""; };
  while (i < body.length) {
    const ch = body[i];
    const next2 = body.slice(i, i + 2);
    if (next2 === "**") {
      const end = body.indexOf("**", i + 2);
      if (end > 0) { flush(); parts.push(<b key={i}>{body.slice(i + 2, end)}</b>); i = end + 2; continue; }
    } else if (next2 === "~~") {
      const end = body.indexOf("~~", i + 2);
      if (end > 0) { flush(); parts.push(<s key={i}>{body.slice(i + 2, end)}</s>); i = end + 2; continue; }
    } else if (ch === "*") {
      const end = body.indexOf("*", i + 1);
      if (end > 0) { flush(); parts.push(<i key={i}>{body.slice(i + 1, end)}</i>); i = end + 1; continue; }
    } else if (ch === "`") {
      const end = body.indexOf("`", i + 1);
      if (end > 0) { flush(); parts.push(<code key={i} className="bg-black/40 px-1 rounded text-[#22D1C3] font-mono text-[12px]">{body.slice(i + 1, end)}</code>); i = end + 1; continue; }
    } else if (ch === "@") {
      const m = body.slice(i).match(/^@(\w+)/);
      if (m) { flush(); parts.push(<span key={i} className="text-[#FFD700] font-semibold">@{m[1]}</span>); i += m[0].length; continue; }
    }
    buf += ch; i++;
  }
  flush();
  return <>{parts}</>;
}

// ════════════════════════════════════════════════════════════════════
// TRANSLATE BUTTON
// ════════════════════════════════════════════════════════════════════

function TranslateInline({ text }: { text: string }) {
  const [translated, setTranslated] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(false);
  const target = useMemo(() => (typeof navigator !== "undefined" ? navigator.language.slice(0, 2) : "de"), []);
  if (!text || text.trim().length < 2) return null;
  async function go(e: React.MouseEvent) {
    e.stopPropagation();
    if (translated || busy) return;
    setBusy(true); setErr(false);
    try {
      const r = await fetch("/api/chat/translate", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text, target }) });
      if (!r.ok) { setErr(true); return; }
      const j = await r.json() as { text?: string };
      if (j.text && j.text.trim() !== text.trim()) setTranslated(j.text);
      else setTranslated(text);
    } catch { setErr(true); } finally { setBusy(false); }
  }
  return (
    <>
      <button
        onClick={go}
        disabled={busy || !!translated}
        title={translated ? "Übersetzt" : err ? "Fehler — nochmal" : "Übersetzen"}
        className="ml-1 inline-flex items-center justify-center align-middle text-[11px] transition hover:opacity-100"
        style={{
          width: 16, height: 16, lineHeight: 1,
          opacity: translated ? 1 : 0.6,
          filter: "drop-shadow(0 1px 1px rgba(0,0,0,0.6))",
        }}
      >
        {busy ? "⏳" : translated ? "✓" : "🌐"}
      </button>
      {translated && (
        <div
          className="mt-1 px-2 py-1 rounded text-[12px] text-[#F0F0F0]"
          style={{
            background: "rgba(34,209,195,0.12)",
            border: "1px solid rgba(34,209,195,0.4)",
          }}
        >
          {translated}
        </div>
      )}
    </>
  );
}

// ════════════════════════════════════════════════════════════════════
// RALLY CARD
// ════════════════════════════════════════════════════════════════════

function RallyCard({ messageId, attachments }: { messageId: string; attachments: unknown }) {
  const a = attachments as { lat?: number; lng?: number; action?: string; label?: string; urgent?: boolean };
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  if (a.lat == null || a.lng == null) return null;
  async function place() {
    setBusy(true);
    try {
      await fetch(`/api/chat/rally/${messageId}/place`, { method: "POST" });
      setDone(true);
    } catch { /* noop */ } finally { setBusy(false); }
  }
  return (
    <div className="mt-1 px-2 py-1.5 rounded border" style={{
      background: a.urgent ? "rgba(255,45,120,0.12)" : "rgba(34,209,195,0.10)",
      borderColor: a.urgent ? "rgba(255,45,120,0.4)" : "rgba(34,209,195,0.4)",
    }}>
      <div className="text-[11px] font-bold text-[#F0F0F0] flex items-center gap-1">
        {a.urgent ? "🚨" : "📍"} {(a.action ?? "rally").toUpperCase()}
        {a.label && <span className="text-[#C8CDD9] font-normal"> · {a.label}</span>}
      </div>
      <div className="text-[10px] text-[#8B8FA3] mt-0.5">
        {a.lat.toFixed(4)}, {a.lng.toFixed(4)}
      </div>
      <button
        onClick={place} disabled={busy || done}
        className="mt-1 w-full text-[10px] font-bold py-1 rounded disabled:opacity-50"
        style={{ background: "linear-gradient(90deg, #22D1C3, #FF2D78)", color: "#fff" }}
      >
        {done ? "✓ Auf Karte gesetzt" : busy ? "..." : "Auf Karte setzen"}
      </button>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════
// POLL BLOCK
// ════════════════════════════════════════════════════════════════════

function PollBlock({ poll, currentUserId, onVote }: { poll: Poll; currentUserId: string; onVote: (idx: number) => void }) {
  const totalVotes = poll.votes.length;
  const myVotes = new Set(poll.votes.filter((v) => v.user_id === currentUserId).map((v) => v.option_index));
  return (
    <div className="mt-1.5 bg-black/30 rounded-lg p-2">
      <div className="text-[11px] font-bold text-[#FFD700] mb-1.5">📊 {poll.question}</div>
      {poll.options.map((opt, idx) => {
        const count = poll.votes.filter((v) => v.option_index === idx).length;
        const pct = totalVotes ? Math.round((count / totalVotes) * 100) : 0;
        const voted = myVotes.has(idx);
        return (
          <button key={idx} onClick={() => onVote(idx)}
            className={`w-full mb-1 text-left text-[11px] rounded px-2 py-1 relative overflow-hidden border ${voted ? "border-[#FFD700]/50" : "border-white/10 hover:border-white/30"}`}>
            <div className="absolute inset-y-0 left-0 bg-[#FFD700]/15" style={{ width: `${pct}%` }} />
            <div className="relative flex items-center justify-between gap-2">
              <span className="text-[#F0F0F0]">{voted ? "● " : "○ "}{opt}</span>
              <span className="text-[#8B8FA3] text-[10px]">{count} ({pct}%)</span>
            </div>
          </button>
        );
      })}
      <div className="text-[9px] text-[#8B8FA3] mt-1">{totalVotes} Stimmen{poll.multi_choice ? " · Mehrfach" : ""}{poll.closes_at ? ` · schließt ${new Date(poll.closes_at).toLocaleString()}` : ""}</div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════
// COMPOSER MODALS (Poll / Schedule / Report)
// ════════════════════════════════════════════════════════════════════

function PollComposer({ roomId, onClose, onSent }: { roomId: string; onClose: () => void; onSent: () => void }) {
  const [question, setQuestion] = useState("");
  const [options, setOptions] = useState(["", ""]);
  const [multi, setMulti] = useState(false);
  const [busy, setBusy] = useState(false);
  async function submit() {
    setBusy(true);
    const opts = options.map((o) => o.trim()).filter(Boolean);
    if (!question.trim() || opts.length < 2) { setBusy(false); return; }
    await fetch("/api/chat/poll", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ room_id: roomId, question, options: opts, multi_choice: multi }) });
    setBusy(false); onSent();
  }
  return (
    <div className="fixed inset-0 z-[9000] bg-black/60 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-[#0F1115] border border-[#22D1C3]/30 rounded-2xl p-4 w-full max-w-sm" onClick={(e) => e.stopPropagation()}>
        <div className="text-sm font-bold text-[#F0F0F0] mb-3 flex items-center gap-2"><BarChart3 size={14} /> Umfrage</div>
        <input value={question} onChange={(e) => setQuestion(e.target.value)} placeholder="Frage..." className="w-full mb-2 bg-[#1A1D23] border border-white/10 rounded px-3 py-1.5 text-sm text-[#F0F0F0]" />
        {options.map((opt, idx) => (
          <input key={idx} value={opt} onChange={(e) => { const c = [...options]; c[idx] = e.target.value; setOptions(c); }}
            placeholder={`Option ${idx + 1}`} className="w-full mb-1.5 bg-[#1A1D23] border border-white/10 rounded px-3 py-1.5 text-xs text-[#F0F0F0]" />
        ))}
        {options.length < 10 && <button onClick={() => setOptions([...options, ""])} className="text-[11px] text-[#22D1C3]">+ Option</button>}
        <label className="flex items-center gap-2 text-[11px] text-[#F0F0F0] mt-2 cursor-pointer">
          <input type="checkbox" checked={multi} onChange={(e) => setMulti(e.target.checked)} className="accent-[#22D1C3]" />Mehrfach-Wahl
        </label>
        <div className="flex gap-2 mt-3">
          <button onClick={onClose} className="flex-1 bg-white/5 text-[#8B8FA3] py-2 rounded text-xs">Abbrechen</button>
          <button onClick={submit} disabled={busy} className="flex-1 bg-gradient-to-r from-[#22D1C3] to-[#FF2D78] text-white py-2 rounded text-xs font-bold disabled:opacity-50">Senden</button>
        </div>
      </div>
    </div>
  );
}

function ScheduleComposer({ roomId, onClose, onSent }: { roomId: string; onClose: () => void; onSent: () => void }) {
  const [body, setBody] = useState("");
  const [when, setWhen] = useState("");
  const [busy, setBusy] = useState(false);
  async function submit() {
    setBusy(true);
    if (!body.trim() || !when) { setBusy(false); return; }
    await fetch("/api/chat/schedule", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ room_id: roomId, body, scheduled_for: new Date(when).toISOString() }) });
    setBusy(false); onSent();
  }
  return (
    <div className="fixed inset-0 z-[9000] bg-black/60 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-[#0F1115] border border-[#22D1C3]/30 rounded-2xl p-4 w-full max-w-sm" onClick={(e) => e.stopPropagation()}>
        <div className="text-sm font-bold text-[#F0F0F0] mb-3 flex items-center gap-2"><Clock size={14} /> Geplant senden</div>
        <textarea value={body} onChange={(e) => setBody(e.target.value)} placeholder="Nachricht..." rows={3} className="w-full mb-2 bg-[#1A1D23] border border-white/10 rounded px-3 py-1.5 text-sm text-[#F0F0F0] resize-none" />
        <input type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} className="w-full bg-[#1A1D23] border border-white/10 rounded px-3 py-1.5 text-sm text-[#F0F0F0]" />
        <div className="flex gap-2 mt-3">
          <button onClick={onClose} className="flex-1 bg-white/5 text-[#8B8FA3] py-2 rounded text-xs">Abbrechen</button>
          <button onClick={submit} disabled={busy} className="flex-1 bg-gradient-to-r from-[#22D1C3] to-[#FF2D78] text-white py-2 rounded text-xs font-bold disabled:opacity-50">Planen</button>
        </div>
      </div>
    </div>
  );
}

function RallyComposer({ roomId, onClose, onSent }: { roomId: string; onClose: () => void; onSent: () => void }) {
  const ACTIONS = [
    { k: "wichtig",     l: "🚩 Wichtig", c: "#FFD700" },
    { k: "angriff",     l: "⚔️ Angriff", c: "#FF2D78" },
    { k: "verteidigen", l: "🛡 Verteidigen", c: "#22D1C3" },
    { k: "sammeln",     l: "💰 Sammeln", c: "#FFB627" },
    { k: "warnung",     l: "⚠️ Warnung", c: "#A78BFA" },
  ];
  const [action, setAction] = useState("wichtig");
  const [label, setLabel] = useState("");
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [urgent, setUrgent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      // Versuche aktuelle Geo-Position; fallback Base
      try {
        const pos = await new Promise<GeolocationPosition>((res, rej) => navigator.geolocation.getCurrentPosition(res, rej, { timeout: 5000 }));
        setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        return;
      } catch { /* fallback */ }
      try {
        const r = await fetch("/api/base/me", { cache: "no-store" });
        if (r.ok) {
          const j = await r.json() as { base?: { lat?: number; lng?: number } };
          if (j.base?.lat && j.base?.lng) setCoords({ lat: j.base.lat, lng: j.base.lng });
        }
      } catch { /* noop */ }
    })();
  }, []);

  async function submit() {
    if (!coords) { setErr("Keine Position verfügbar"); return; }
    setBusy(true); setErr(null);
    const r = await fetch("/api/chat/rally", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ room_id: roomId, lat: coords.lat, lng: coords.lng, action, label: label.trim() || null, urgent }),
    });
    setBusy(false);
    if (!r.ok) { const j = await r.json().catch(() => ({})); setErr(j.error ?? "Fehler"); return; }
    onSent();
  }

  return (
    <div className="fixed inset-0 z-[10002] bg-black/60 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-[#0F1115] border border-[#22D1C3]/30 rounded-2xl p-4 w-full max-w-sm" onClick={(e) => e.stopPropagation()}>
        <div className="text-sm font-bold text-[#F0F0F0] mb-3 flex items-center gap-2"><MapPin size={14} /> Rally an Crew</div>
        <div className="grid grid-cols-2 gap-1.5 mb-3">
          {ACTIONS.map((a) => (
            <button key={a.k} onClick={() => setAction(a.k)}
              className={`text-[11px] py-1.5 rounded font-bold transition ${action === a.k ? "border" : "border border-white/10"}`}
              style={action === a.k ? { background: `${a.c}22`, borderColor: a.c, color: a.c } : { color: "#C8CDD9" }}>
              {a.l}
            </button>
          ))}
        </div>
        <input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Notiz (z.B. Truhe, Gegner-Base)..." className="w-full mb-2 bg-[#1A1D23] border border-white/10 rounded px-3 py-1.5 text-xs text-[#F0F0F0]" />
        <label className="flex items-center gap-2 text-[11px] text-[#F0F0F0] mb-2 cursor-pointer">
          <input type="checkbox" checked={urgent} onChange={(e) => setUrgent(e.target.checked)} className="accent-[#FF2D78]" />🚨 Dringend (kostet Krypto)
        </label>
        <div className="text-[10px] text-[#8B8FA3]">
          {coords ? `📍 ${coords.lat.toFixed(4)}, ${coords.lng.toFixed(4)}` : "Position wird geladen..."}
        </div>
        {err && <div className="text-[11px] text-[#FF2D78] mt-2">⚠ {err}</div>}
        <div className="flex gap-2 mt-3">
          <button onClick={onClose} className="flex-1 bg-white/5 text-[#8B8FA3] py-2 rounded text-xs">Abbrechen</button>
          <button onClick={submit} disabled={busy || !coords} className="flex-1 text-white py-2 rounded text-xs font-bold disabled:opacity-50"
            style={{ background: "linear-gradient(90deg, #22D1C3, #FF2D78)" }}>
            {busy ? "..." : "Senden"}
          </button>
        </div>
      </div>
    </div>
  );
}

function ReportModal({ message, onClose, onSent }: { message: Message; onClose: () => void; onSent: () => void }) {
  const REASONS: Array<{ k: string; l: string }> = [
    { k: "spam", l: "Spam" }, { k: "harassment", l: "Belästigung" }, { k: "hate", l: "Hass" },
    { k: "sexual", l: "Sexueller Inhalt" }, { k: "violence", l: "Gewalt" }, { k: "self_harm", l: "Selbstverletzung" }, { k: "other", l: "Sonstiges" }
  ];
  const [reason, setReason] = useState("spam");
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  async function submit() {
    setBusy(true);
    await fetch(`/api/chat/messages/${message.id}/report`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ reason, body: body.trim() || null }) });
    setBusy(false); setDone(true);
    setTimeout(onSent, 1200);
  }
  return (
    <div className="fixed inset-0 z-[9000] bg-black/60 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-[#0F1115] border border-[#FF2D78]/30 rounded-2xl p-4 w-full max-w-sm" onClick={(e) => e.stopPropagation()}>
        <div className="text-sm font-bold text-[#F0F0F0] mb-3 flex items-center gap-2"><Flag size={14} className="text-[#FF2D78]" /> Nachricht melden</div>
        {done ? <div className="text-xs text-[#22D1C3] py-3 text-center">✓ Vielen Dank, wird geprüft.</div> : (
          <>
            <select value={reason} onChange={(e) => setReason(e.target.value)} className="w-full mb-2 bg-[#1A1D23] border border-white/10 rounded px-3 py-1.5 text-sm text-[#F0F0F0]">
              {REASONS.map((r) => <option key={r.k} value={r.k}>{r.l}</option>)}
            </select>
            <textarea value={body} onChange={(e) => setBody(e.target.value)} placeholder="Details (optional)" rows={2} className="w-full bg-[#1A1D23] border border-white/10 rounded px-3 py-1.5 text-xs text-[#F0F0F0] resize-none" />
            <div className="flex gap-2 mt-3">
              <button onClick={onClose} className="flex-1 bg-white/5 text-[#8B8FA3] py-2 rounded text-xs">Abbrechen</button>
              <button onClick={submit} disabled={busy} className="flex-1 bg-[#FF2D78] text-white py-2 rounded text-xs font-bold disabled:opacity-50">Melden</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
