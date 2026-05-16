"use client";

import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { UiIcon, useUiIconArt, useArtworkReady, type ResourceArtMap } from "@/components/resource-icon";

const PRIMARY = "#22D1C3";
const ACCENT = "#FF2D78";
const BG = "#0F1115";
const TEXT = "#F0F0F0";
const MUTED = "#8B8FA3";

// ════════════════════════════════════════════════════════════════════
// Icon-Größen + horizontaler Offset pro Quick-Button — individuell tunen.
// SIZE  = Pixelgröße des Buttons UND des Artwork-Bildes (kein Padding).
// OFFSET_X = Verschiebung in X (negativ = nach links, positiv = nach rechts).
// ════════════════════════════════════════════════════════════════════
const ICON_SIZE: Record<string, number> = {
  base:    55,
  crew:    55,
  rally:   55,
  ranking: 52,
  shop:    57,
  inbox:   55,
};
const ICON_OFFSET_X: Record<string, number> = {
  base:    -4,
  crew:     0,
  rally:    0,
  ranking:  0,
  shop:     0,
  inbox:    0,
};

type RallyStatus = "preparing" | "marching" | "fighting";
type RepeaterRally = {
  rally_id: string; repeater_id: string; kind: "repeater";
  status: RallyStatus;
  leader_name: string; target_label: string | null;
  target_kind: "hq" | "repeater" | "mega";
  target_lat: number; target_lng: number;
  prep_ends_at: string; march_ends_at: string | null;
  total_atk: number; participants: number;
  i_joined: boolean; is_leader: boolean;
};
type BaseRally = {
  rally_id: string; kind: "base";
  status: RallyStatus;
  leader_name: string; target_label: string | null;
  target_avatar_url: string | null;
  target_pin_theme: string | null;
  target_lat: number; target_lng: number;
  prep_ends_at: string; march_ends_at: string | null;
  total_atk: number; participants: number;
  i_joined: boolean; is_leader: boolean;
};
type StrongholdRally = {
  rally_id: string; kind: "stronghold";
  status: RallyStatus;
  stronghold_id: string;
  leader_name: string; target_label: string | null;
  target_lat: number; target_lng: number;
  target_level?: number | null;
  prep_ends_at: string; march_ends_at: string | null;
  total_atk: number; participants: number;
  i_joined: boolean; is_leader: boolean;
};
type Joinable = { repeater: RepeaterRally[]; base: BaseRally[]; stronghold: StrongholdRally[] };

function fmtCountdown(iso: string | null): string {
  if (!iso) return "—";
  const ms = new Date(iso).getTime() - Date.now();
  if (ms <= 0) return "00:00";
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  return `${String(m).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
}

/**
 * Vertikaler Icon-Stack rechts unten auf der Map. Schnellzugriff für Base,
 * Crew-Angriffe, Crew-Modal, Inbox, Erfolge etc.
 *
 * Pro Icon: rundes Symbol, Tooltip-Label, optional roter Badge mit Anzahl.
 *
 * Komplett ausblendbar via users.show_map_action_hud.
 */
export function MapQuickAccess({
  onOpenProfile,
  onOpenCrewModal,
  onOpenInbox,
  onOpenAchievements,
  onOpenRanking,
  onJoinRepeaterRally,
  onJoinBaseRally,
  onFlyTo,
  onZoomCycle,
  zoomCycleIdx = 0,
  inboxUnread = 0,
  baseQueueReady = 0,
  achievementsReady = 0,
  strongholdsNearby = 0,
}: {
  /** Öffnet das Profil-Dashboard-Modal (zeigt Base/Wächter/Crew als Karten). */
  onOpenProfile: () => void;
  onOpenCrewModal: () => void;
  onOpenInbox: () => void;
  onOpenAchievements: () => void;
  onOpenRanking: () => void;
  onJoinRepeaterRally: (repeaterId: string) => void;
  onJoinBaseRally: (rallyId: string) => void;
  onFlyTo: (lat: number, lng: number) => void;
  /** Cycle-Click fuer Base-Zoom: dicht (Zoom 17) -> mittel (Zoom 13) -> raus (Zoom 9). */
  onZoomCycle?: () => void;
  /** Aktueller Cycle-Index: 0=dicht (naechster Klick), 1=mittel, 2=raus. */
  zoomCycleIdx?: 0 | 1 | 2;
  inboxUnread?: number;
  baseQueueReady?: number;
  achievementsReady?: number;
  strongholdsNearby?: number;
}) {
  const [enabled, setEnabled] = useState(true);
  const [rallies, setRallies] = useState<Joinable>({ repeater: [], base: [], stronghold: [] });
  const [openRallyList, setOpenRallyList] = useState(false);
  const uiArt = useUiIconArt();
  const [, setTick] = useState(0);
  const barRef = useRef<HTMLDivElement>(null);
  const [barRect, setBarRect] = useState<{ left: number; width: number } | null>(null);
  useEffect(() => {
    if (!openRallyList) return;
    const update = () => {
      const el = barRef.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      setBarRect({ left: r.left, width: r.width });
    };
    update();
    const ro = new ResizeObserver(update);
    if (barRef.current) ro.observe(barRef.current);
    window.addEventListener("resize", update);
    return () => { ro.disconnect(); window.removeEventListener("resize", update); };
  }, [openRallyList]);

  useEffect(() => {
    const sb = createClient();
    let cancelled = false;
    const loadPref = async () => {
      const { data: { user } } = await sb.auth.getUser();
      if (!user) return;
      const { data: u } = await sb.from("users").select("show_map_action_hud").eq("id", user.id).maybeSingle();
      if (!cancelled) setEnabled((u as { show_map_action_hud?: boolean } | null)?.show_map_action_hud ?? true);
    };
    const loadRallies = async () => {
      const { data } = await sb.rpc("get_joinable_rallies");
      if (!cancelled && data) setRallies(data as Joinable);
    };
    void loadPref();
    void loadRallies();
    const ivR = setInterval(loadRallies, 15000);
    const ivP = setInterval(loadPref, 30000);
    return () => { cancelled = true; clearInterval(ivR); clearInterval(ivP); };
  }, []);

  useEffect(() => {
    if (!openRallyList) return;
    const iv = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(iv);
  }, [openRallyList]);

  if (!enabled) return null;

  const rallyTotal = rallies.repeater.length + rallies.base.length + rallies.stronghold.length;

  // Artwork-basierte Icons (cosmetic_artwork kind=ui_icon, slot=quick_*).
  // Fallback-Emoji nur wenn noch kein Artwork hochgeladen ist.
  type Item = { key: string; slot: string; fallback: string; label: string; size: number; offsetX: number; badge?: number; onClick: () => void };
  const items: Item[] = [
    { key: "base",    slot: "quick_base",    fallback: "🏰", label: "Profilbild", size: ICON_SIZE.base,    offsetX: ICON_OFFSET_X.base,    badge: baseQueueReady, onClick: onOpenProfile },
    { key: "crew",    slot: "quick_crew",    fallback: "👥", label: "Crew",     size: ICON_SIZE.crew,    offsetX: ICON_OFFSET_X.crew,                           onClick: onOpenCrewModal },
    { key: "rally",   slot: "quick_rally",   fallback: "⚔",  label: "Angriffe", size: ICON_SIZE.rally,   offsetX: ICON_OFFSET_X.rally,   badge: rallyTotal,     onClick: () => setOpenRallyList(!openRallyList) },
    { key: "ranking", slot: "quick_ranking", fallback: "🏆", label: "Ranking",  size: ICON_SIZE.ranking, offsetX: ICON_OFFSET_X.ranking,                        onClick: onOpenRanking },
    { key: "shop",    slot: "quick_shop",    fallback: "🎁", label: "Shop",     size: ICON_SIZE.shop,    offsetX: ICON_OFFSET_X.shop,                           onClick: () => window.dispatchEvent(new CustomEvent("ma365:open-deals-shop")) },
    { key: "inbox",   slot: "quick_inbox",   fallback: "📬", label: "Inbox",    size: ICON_SIZE.inbox,   offsetX: ICON_OFFSET_X.inbox,   badge: inboxUnread,    onClick: onOpenInbox },
  ];

  return (
    <>
      {/* Quickaccess-Bar: rechts unten, dicht am Bildschirmrand. Mapbox-Controls
          sind links unten unter dem Chat-Widget — rechts ist hier komplett frei. */}
      <div
        ref={barRef}
        className="ma365-qa-bar"
        style={{
          position: "absolute",
          right: 8,
          bottom: 0,
          zIndex: 9001,
          display: "flex", flexDirection: "row",
          gap: 0, padding: 0,
          maxWidth: "calc(100vw - 16px)", overflowX: "auto",
          background: "transparent",
          border: "none",
          boxShadow: "none",
          pointerEvents: "auto",
          WebkitMaskImage: "linear-gradient(to right, black 0, black calc(100% - 16px), transparent 100%)",
          maskImage: "linear-gradient(to right, black 0, black calc(100% - 16px), transparent 100%)",
        }}
      >
        {items.map((it) => (
          <QuickButton
            key={it.key}
            slot={it.slot}
            fallback={it.fallback}
            art={uiArt}
            label={it.label}
            badge={it.badge}
            size={it.size}
            offsetX={it.offsetX}
            onClick={it.onClick}
          />
        ))}
        {onZoomCycle && (
          <ZoomCycleButton onClick={onZoomCycle} cycleIdx={zoomCycleIdx} />
        )}
        <style>{`
          .ma365-qa-bar::-webkit-scrollbar { display: none; }
          .ma365-qa-bar { scrollbar-width: none; }
        `}</style>
      </div>

      {openRallyList && (
        <div
          onClick={(e) => e.stopPropagation()}
          style={{
            position: "fixed",
            left: barRect?.left ?? 8,
            width: barRect?.width ?? undefined,
            right: barRect ? undefined : 58,
            bottom: 110,
            zIndex: 9002,
            maxHeight: "60vh",
            overflowY: "auto",
            background: "rgba(15,17,21,0.55)",
            border: "1px solid rgba(255,45,120,0.35)",
            borderRadius: 16,
            boxShadow: "0 12px 32px rgba(0,0,0,0.55)",
            backdropFilter: "blur(14px) saturate(140%)",
            WebkitBackdropFilter: "blur(14px) saturate(140%)",
            padding: 12,
          }}
        >
          <div style={{
            display: "flex", justifyContent: "space-between", alignItems: "center",
            marginBottom: 10, paddingBottom: 8,
            borderBottom: "1px solid rgba(255,255,255,0.08)",
          }}>
            <div style={{ color: TEXT, fontSize: 13, fontWeight: 800 }}>
              ⚔ Crew-Angriffe ({rallyTotal})
            </div>
            <button
              onClick={() => setOpenRallyList(false)}
              style={{ background: "transparent", border: "none", color: MUTED, fontSize: 18, cursor: "pointer" }}
            >✕</button>
          </div>

          {rallyTotal === 0 && (
            <div style={{ color: MUTED, fontSize: 12, textAlign: "center", padding: "16px 8px" }}>
              Aktuell keine offenen Crew-Angriffe.
            </div>
          )}

          {rallies.repeater.map((r) => {
            const slot = r.target_kind === "hq" ? "repeater_hq" : r.target_kind === "mega" ? "repeater_mega" : "repeater_normal";
            const fallback = r.target_kind === "hq" ? "🏛" : r.target_kind === "mega" ? "📡" : "📶";
            const countdownIso = r.status === "preparing" ? r.prep_ends_at : r.march_ends_at;
            return (
              <RallyRow
                key={r.rally_id}
                rallyId={r.rally_id}
                slot={slot}
                fallback={fallback}
                art={uiArt}
                title={r.target_label || "Repeater"}
                leaderName={r.leader_name}
                participants={r.participants}
                totalAtk={r.total_atk}
                countdown={fmtCountdown(countdownIso)}
                status={r.status}
                joined={r.i_joined}
                isLeader={r.is_leader}
                onJoin={r.status === "preparing" && !r.i_joined
                  ? () => { onJoinRepeaterRally(r.repeater_id); setOpenRallyList(false); }
                  : undefined}
                onShow={() => { onFlyTo(r.target_lat, r.target_lng); setOpenRallyList(false); }}
                onCancel={r.is_leader && r.status === "preparing"
                  ? async () => {
                      await fetch(`/api/crews/turf/rally/${r.rally_id}/cancel`, { method: "POST" });
                      const sb = createClient();
                      const { data } = await sb.rpc("get_joinable_rallies");
                      if (data) setRallies(data as Joinable);
                    }
                  : undefined}
              />
            );
          })}
          {rallies.base.map((r) => {
            const countdownIso = r.status === "preparing" ? r.prep_ends_at : r.march_ends_at;
            return (
              <RallyRow
                key={r.rally_id}
                rallyId={r.rally_id}
                slot="quick_base"
                fallback="🏰"
                art={uiArt}
                avatarUrl={r.target_avatar_url}
                title={r.target_label || "Spieler-Base"}
                leaderName={r.leader_name}
                participants={r.participants}
                totalAtk={r.total_atk}
                countdown={fmtCountdown(countdownIso)}
                status={r.status}
                joined={r.i_joined}
                isLeader={r.is_leader}
                onJoin={r.status === "preparing" && !r.i_joined
                  ? () => { onJoinBaseRally(r.rally_id); setOpenRallyList(false); }
                  : undefined}
                onShow={() => { onFlyTo(r.target_lat, r.target_lng); setOpenRallyList(false); }}
                onCancel={r.is_leader && r.status === "preparing"
                  ? async () => {
                      if (!confirm("Trupp wirklich abbrechen? Alle Truppen werden zurückgegeben.")) return;
                      await fetch(`/api/base/rally/${r.rally_id}/cancel`, { method: "POST" });
                      const sb = createClient();
                      const { data } = await sb.rpc("get_joinable_rallies");
                      if (data) setRallies(data as Joinable);
                    }
                  : undefined}
              />
            );
          })}
          {rallies.stronghold.map((r) => {
            const countdownIso = r.status === "preparing" ? r.prep_ends_at : r.march_ends_at;
            return (
              <RallyRow
                key={r.rally_id}
                rallyId={r.rally_id}
                slot="stronghold_pin"
                fallback="🏚"
                art={uiArt}
                title={`${r.target_label ?? "Wegelager"}${r.target_level ? ` Lv ${r.target_level}` : ""}`}
                leaderName={r.leader_name}
                participants={r.participants}
                totalAtk={r.total_atk}
                countdown={fmtCountdown(countdownIso)}
                status={r.status}
                joined={r.i_joined}
                isLeader={r.is_leader}
                onJoin={r.status === "preparing" && !r.i_joined
                  ? () => {
                      // Map-Dashboard fängt das Event und öffnet das Stronghold-Modal
                      window.dispatchEvent(new CustomEvent("ma365:open-stronghold", {
                        detail: { strongholdId: r.stronghold_id, lat: r.target_lat, lng: r.target_lng },
                      }));
                      setOpenRallyList(false);
                    }
                  : undefined}
                onShow={() => { onFlyTo(r.target_lat, r.target_lng); setOpenRallyList(false); }}
                onCancel={r.is_leader && r.status === "preparing"
                  ? async () => {
                      await fetch(`/api/rally/${r.rally_id}/cancel`, { method: "POST" });
                      const sb = createClient();
                      const { data } = await sb.rpc("get_joinable_rallies");
                      if (data) setRallies(data as Joinable);
                    }
                  : undefined}
              />
            );
          })}
        </div>
      )}
    </>
  );
}

function QuickButton({
  slot, fallback, art, label, badge, onClick, size, offsetX = 0,
}: {
  slot: string; fallback: string; art: ResourceArtMap;
  label: string; badge?: number; onClick: () => void; size: number; offsetX?: number;
}) {
  const hasBadge = (badge ?? 0) > 0;
  // Bild = Button-Größe (kein Padding — Artwork füllt den ganzen Button)
  const iconSize = size;
  return (
    <button
      onClick={onClick}
      title={label}
      aria-label={label}
      style={{
        position: "relative",
        width: size, height: size,
        background: "transparent",
        border: "none",
        padding: 0,
        color: "#FFF",
        display: "flex", alignItems: "center", justifyContent: "center",
        cursor: "pointer",
        flexShrink: 0,
        transform: offsetX ? `translateX(${offsetX}px)` : undefined,
      }}
    >
      <QuickButtonIcon slot={slot} fallback={fallback} art={art} size={iconSize} />
      {hasBadge && (
        <span style={{
          position: "absolute", top: 0, right: 0,
          minWidth: 16, height: 16, borderRadius: 8,
          padding: "0 4px",
          background: ACCENT,
          color: "#FFF",
          fontSize: 9, fontWeight: 800,
          display: "flex", alignItems: "center", justifyContent: "center",
          fontFamily: "-apple-system,BlinkMacSystemFont,'Segoe UI',Inter,Roboto,sans-serif",
          zIndex: 2,
        }}>
          {badge! > 99 ? "99+" : badge}
        </span>
      )}
    </button>
  );
}

function QuickButtonIcon({ slot, fallback, art, size }: {
  slot: string; fallback: string; art: ResourceArtMap; size: number;
}) {
  const ready = useArtworkReady();
  const sharedStyle: React.CSSProperties = {
    position: "relative", zIndex: 1,
    width: size, height: size,
    objectFit: "contain", display: "block",
    filter: "drop-shadow(0 1px 2px rgba(0,0,0,0.7))",
  };
  if (!ready) return <span style={{ position: "relative", zIndex: 1, display: "block", width: size, height: size }} aria-hidden />;
  const a = art[slot];
  if (a?.video_url) return <video src={a.video_url} autoPlay loop muted playsInline style={sharedStyle} />;
  if (a?.image_url) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={a.image_url} alt={slot} style={sharedStyle} />;
  }
  return <span style={{ position: "relative", zIndex: 1, fontSize: Math.round(size * 0.66), lineHeight: 1, display: "block" }}>{fallback}</span>;
}

type Participant = {
  user_id: string; name: string; troops_sent: Record<string, number>;
  troop_atk: number; joined_at: string; is_leader: boolean;
};

function RallyRow({
  rallyId, slot, fallback, art, avatarUrl, title, leaderName, participants, totalAtk, countdown,
  status, joined, isLeader, onJoin, onShow, onCancel,
}: {
  rallyId: string;
  slot: string; fallback: string; art: ResourceArtMap;
  avatarUrl?: string | null;
  title: string; leaderName: string; participants: number; totalAtk: number; countdown: string;
  status: "preparing" | "marching" | "fighting";
  joined: boolean; isLeader: boolean;
  onJoin?: () => void; onShow: () => void; onCancel?: () => void | Promise<void>;
}) {
  const [expanded, setExpanded] = useState(false);
  const [parts, setParts] = useState<Participant[] | null>(null);
  const [busyCancel, setBusyCancel] = useState(false);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [kickingId, setKickingId] = useState<string | null>(null);
  useEffect(() => {
    if (!confirmCancel) return;
    const t = setTimeout(() => setConfirmCancel(false), 3000);
    return () => clearTimeout(t);
  }, [confirmCancel]);

  const loadParticipants = async () => {
    const r = await fetch(`/api/crews/turf/rally/${rallyId}/participants`, { cache: "no-store" });
    if (!r.ok) return;
    const j = await r.json() as { participants?: Participant[] };
    setParts(j.participants ?? []);
  };

  useEffect(() => {
    if (!expanded || parts !== null) return;
    void loadParticipants();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expanded]);

  const kick = async (userId: string) => {
    if (kickingId) return;
    if (!confirm("Diesen Teilnehmer aus dem Trupp werfen? Die Truppen werden zurückgegeben.")) return;
    setKickingId(userId);
    try {
      const r = await fetch(`/api/crews/turf/rally/${rallyId}/kick`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: userId }),
      });
      if (r.ok) await loadParticipants();
    } finally {
      setKickingId(null);
    }
  };

  const statusBadge =
    status === "preparing" ? { label: "SAMMELN",  color: "#FFD700" } :
    status === "marching"  ? { label: "ANMARSCH", color: "#FF6B4A" } :
                              { label: "KAMPF",    color: "#FF2D78" };

  return (
    <div style={{
      padding: "10px 8px",
      borderBottom: "1px solid rgba(255,255,255,0.06)",
    }}>
      {/* Icon links, Title+Info-Spalte mitte, Atk-Block rechts (volle Höhe) */}
      <div style={{ display: "flex", alignItems: "stretch", gap: 4 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minWidth: 64, flexShrink: 0, marginLeft: -20, marginTop: -6 }}>
          {avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={avatarUrl} alt="" style={{
              width: 56, height: 56, borderRadius: "50%", objectFit: "cover",
              border: `2px solid ${ACCENT}66`,
              boxShadow: `0 0 8px ${ACCENT}55`,
            }} />
          ) : (
            <UiIcon slot={slot} fallback={fallback} art={art} size={56} />
          )}
        </div>
        <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", justifyContent: "center", gap: 5 }}>
          {/* Zeile 1: Titel + ZUM-ZIEL + Angriffskraft */}
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <div style={{ minWidth: 0, color: TEXT, fontSize: 13, fontWeight: 800, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {title}
            </div>
            <button
              onClick={onShow}
              style={{
                padding: "2px 6px", borderRadius: 4,
                background: `${PRIMARY}1f`,
                border: `1px solid ${PRIMARY}55`,
                color: PRIMARY,
                fontSize: 9, fontWeight: 900, letterSpacing: 0.6, cursor: "pointer",
                whiteSpace: "nowrap", flexShrink: 0, lineHeight: 1.4,
              }}
              title="Karte zentrieren"
            >📍 ZUM ZIEL</button>
            <span style={{
              padding: "2px 6px", borderRadius: 4,
              background: "rgba(255,107,74,0.12)",
              border: "1px solid rgba(255,107,74,0.45)",
              color: "#FF6B4A",
              fontSize: 9, fontWeight: 900, letterSpacing: 0.6,
              whiteSpace: "nowrap", flexShrink: 0, lineHeight: 1.4,
              fontVariantNumeric: "tabular-nums",
            }} title="Gesamt-Angriffskraft des Trupps">⚔ {totalAtk.toLocaleString("de-DE")}</span>
          </div>
          {/* Zeile 2: Leader · N dabei · Countdown · Status */}
          <div style={{ display: "flex", alignItems: "center", gap: 6, color: MUTED, fontSize: 11, flexWrap: "wrap" }}>
            <span style={{ color: TEXT, fontWeight: 700 }}>{leaderName}</span>
            <span>·</span>
            <button
              onClick={() => setExpanded((e) => !e)}
              style={{
                background: "transparent", border: "none", padding: 0,
                color: PRIMARY, fontSize: 11, fontWeight: 700, cursor: "pointer",
                textDecoration: "underline", textUnderlineOffset: 2,
              }}
              title={expanded ? "Zuklappen" : "Teilnehmer anzeigen"}
            >
              {participants} dabei {expanded ? "▲" : "▼"}
            </button>
            <span>·</span>
            <span style={{ color: TEXT, fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>⏱ {countdown}</span>
            <span style={{
              fontSize: 9, fontWeight: 900, letterSpacing: 0.6,
              color: statusBadge.color,
              padding: "2px 6px", borderRadius: 4,
              background: `${statusBadge.color}1f`, border: `1px solid ${statusBadge.color}55`,
              whiteSpace: "nowrap", lineHeight: 1.4,
            }}>{statusBadge.label}</span>
            {onCancel && (
              <button
                onClick={async () => {
                  if (busyCancel) return;
                  if (!confirmCancel) { setConfirmCancel(true); return; }
                  setBusyCancel(true);
                  try { await onCancel(); } finally { setBusyCancel(false); setConfirmCancel(false); }
                }}
                disabled={busyCancel}
                title={confirmCancel ? "Nochmal klicken zum Bestätigen" : "Trupp abbrechen (Truppen zurück)"}
                style={{
                  fontSize: 9, fontWeight: 900, letterSpacing: 0.6,
                  color: confirmCancel ? "#FFF" : "#FF6B9A",
                  padding: "2px 6px", borderRadius: 4,
                  background: confirmCancel ? "rgba(255,45,120,0.85)" : "rgba(255,45,120,0.12)",
                  border: `1px solid ${confirmCancel ? "rgba(255,45,120,1)" : "rgba(255,45,120,0.5)"}`,
                  whiteSpace: "nowrap", cursor: busyCancel ? "wait" : "pointer",
                  opacity: busyCancel ? 0.5 : 1, lineHeight: 1.4,
                  boxShadow: confirmCancel ? "0 0 8px rgba(255,45,120,0.6)" : "none",
                  transition: "background 0.15s, color 0.15s, box-shadow 0.15s",
                }}
              >{busyCancel ? "…" : confirmCancel ? "✕ BESTÄTIGEN?" : "✕ ABBRECHEN"}</button>
            )}
          </div>
        </div>
      </div>

      {/* Aktions-Zeile: nur Beitreten (Abbrechen wandert als Mini-Badge in Zeile 2) */}
      {onJoin && (
        <div style={{ display: "flex", gap: 6, marginTop: 8, marginLeft: 54 }}>
          <button
            onClick={onJoin}
            style={{
              flex: 1, padding: "6px 12px", borderRadius: 10,
              background: `linear-gradient(135deg, ${ACCENT}, #FF6B4A)`,
              border: "none", color: "#FFF",
              fontSize: 11, fontWeight: 900, cursor: "pointer",
              boxShadow: `0 4px 12px ${ACCENT}66`,
            }}
          >Beitreten</button>
        </div>
      )}

      {/* Aufgeklappte Teilnehmer-Liste */}
      {expanded && (
        <div style={{
          marginTop: 8, marginLeft: 36, padding: 8,
          background: "rgba(0,0,0,0.25)", borderRadius: 8,
          border: "1px solid rgba(255,255,255,0.05)",
        }}>
          {parts === null && <div style={{ color: MUTED, fontSize: 11, textAlign: "center", padding: 8 }}>Lade…</div>}
          {parts !== null && parts.length === 0 && <div style={{ color: MUTED, fontSize: 11, textAlign: "center", padding: 8 }}>Keine Teilnehmer.</div>}
          {parts !== null && parts.map((p) => {
            const total = Object.values(p.troops_sent ?? {}).reduce((s, n) => s + (n ?? 0), 0);
            const canKick = isLeader && status === "preparing" && !p.is_leader;
            return (
              <div key={p.user_id} style={{
                display: "flex", alignItems: "center", gap: 8,
                padding: "4px 0", fontSize: 11,
                borderBottom: "1px dashed rgba(255,255,255,0.05)",
              }}>
                <span style={{ color: p.is_leader ? "#FFD700" : TEXT, fontWeight: 800, flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {p.is_leader ? "👑 " : ""}{p.name}
                </span>
                <span style={{ color: MUTED, fontVariantNumeric: "tabular-nums" }}>
                  {total.toLocaleString("de-DE")} Trp.
                </span>
                <span style={{ color: "#FF6B4A", fontWeight: 800, fontVariantNumeric: "tabular-nums" }}>
                  {p.troop_atk.toLocaleString("de-DE")} Atk
                </span>
                {canKick && (
                  <button
                    onClick={() => void kick(p.user_id)}
                    disabled={kickingId === p.user_id}
                    title="Teilnehmer auswerfen"
                    style={{
                      padding: "2px 7px", borderRadius: 4,
                      background: "rgba(255,45,120,0.12)",
                      border: "1px solid rgba(255,45,120,0.4)",
                      color: "#FF6B9A",
                      fontSize: 10, fontWeight: 900, cursor: kickingId === p.user_id ? "wait" : "pointer",
                      opacity: kickingId === p.user_id ? 0.5 : 1,
                    }}
                  >{kickingId === p.user_id ? "…" : "✕"}</button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/**
 * ZoomCycleButton — runder Glass-Button rechts am Quick-Access-Bar-Ende. Cyclet
 * bei jedem Klick durch 3 Zoom-Stufen auf der Base: dicht (Zoom 17), mittel
 * (Zoom 13), raus (Zoom 9). RoK/CoD-Style: anderer Look als die Artwork-Quick-
 * Buttons — kompakter Kreis mit Glow-Border in Crew-Tuerkis.
 */
function ZoomCycleButton({ onClick, cycleIdx = 0 }: { onClick: () => void; cycleIdx?: 0 | 1 | 2 }) {
  // Icon zeigt den AKTUELLEN Zoom-Zustand (nicht die naechste Aktion).
  // cycleIdx 0 → Aktuell Zoom 17 (Base dicht) → naechster Klick faehrt zu 15
  // cycleIdx 1 → Aktuell Zoom 15 (mittel)     → naechster Klick faehrt zu 9
  // cycleIdx 2 → Aktuell Zoom 9  (ganz raus)  → naechster Klick faehrt zu 17
  const icon = cycleIdx === 0 ? "🎯" : cycleIdx === 1 ? "🛰" : "🌐";
  const label = cycleIdx === 0 ? "Etwas rauszoomen" : cycleIdx === 1 ? "Ganz rauszoomen (Berlin)" : "Base dicht zentrieren";
  return (
    <button
      onClick={onClick}
      aria-label={label}
      title={label}
      style={{
        // Kein Quick-Button-Stil: kompakter runder Glass-Button, sichtbar
        // abgesetzt vom Artwork-Stack daneben.
        width: 44, height: 44, marginLeft: 4, marginRight: 0,
        flexShrink: 0,
        display: "flex", alignItems: "center", justifyContent: "center",
        background: "rgba(15,17,21,0.6)",
        border: "1px solid rgba(34,209,195,0.45)",
        borderRadius: "50%",
        boxShadow: "0 2px 8px rgba(0,0,0,0.45), inset 0 0 6px rgba(34,209,195,0.18)",
        backdropFilter: "blur(6px)",
        WebkitBackdropFilter: "blur(6px)",
        cursor: "pointer",
        position: "relative",
        padding: 0,
        color: "#fff",
        fontSize: 40,
        lineHeight: 1,
      }}
    >
      <span style={{
        filter: "drop-shadow(0 1px 2px rgba(0,0,0,0.7))",
        // Welt-Icon (🌐) hat anderen Baseline als 🎯/🛰 — eigenes Offset.
        transform: cycleIdx === 2 ? "translate(0px, -1px)" : "translate(2px, -3px)",
      }}>{icon}</span>
    </button>
  );
}

