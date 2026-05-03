"use client";

import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { UiIcon, useUiIconArt, useArtworkReady, type ResourceArtMap } from "@/components/resource-icon";

const PRIMARY = "#22D1C3";
const ACCENT = "#FF2D78";
const BG = "#0F1115";
const TEXT = "#F0F0F0";
const MUTED = "#8B8FA3";

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
  onOpenShop,
  onOpenRanking,
  onJoinRepeaterRally,
  onJoinBaseRally,
  onFlyTo,
  inboxUnread = 0,
  baseQueueReady = 0,
  achievementsReady = 0,
  strongholdsNearby = 0,
  profileIcon,
}: {
  /** Öffnet das Profil-Dashboard-Modal (zeigt Base/Wächter/Crew als Karten). */
  onOpenProfile: () => void;
  onOpenCrewModal: () => void;
  onOpenInbox: () => void;
  onOpenAchievements: () => void;
  onOpenShop: () => void;
  onOpenRanking: () => void;
  onJoinRepeaterRally: (repeaterId: string) => void;
  onJoinBaseRally: (rallyId: string) => void;
  onFlyTo: (lat: number, lng: number) => void;
  inboxUnread?: number;
  baseQueueReady?: number;
  achievementsReady?: number;
  strongholdsNearby?: number;
  /** Pin-Theme-Artwork des Runners (eigenes Base-Theme), wird als Profil-Icon verwendet. */
  profileIcon?: { image_url: string | null; video_url: string | null } | null;
}) {
  const [enabled, setEnabled] = useState(true);
  const [rallies, setRallies] = useState<Joinable>({ repeater: [], base: [], stronghold: [] });
  const [openRallyList, setOpenRallyList] = useState(false);
  const uiArt = useUiIconArt();
  // SSR-sicher: starte immer mit false, hydratisiere dann clientseitig.
  // Verhindert hydration-mismatch (Server kennt weder localStorage noch innerWidth).
  const [collapsed, setCollapsed] = useState<boolean>(false);
  useEffect(() => {
    try {
      const stored = window.localStorage.getItem("ma365_qa_collapsed");
      if (stored === "1") { setCollapsed(true); return; }
      if (stored === "0") { setCollapsed(false); return; }
      if (window.innerWidth < 640) setCollapsed(true);
    } catch { /* ignore */ }
  }, []);
  function toggleCollapsed() {
    setCollapsed((prev) => {
      const next = !prev;
      try { window.localStorage.setItem("ma365_qa_collapsed", next ? "1" : "0"); } catch { /* ignore */ }
      if (next) setOpenRallyList(false);
      return next;
    });
  }
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

  // Kurz halten — passt in 60er-Tiles und bleibt lesbar.
  // Icons kommen aus dem Artwork-System (cosmetic_artwork kind=ui_icon),
  // Emojis sind nur Fallback solange noch kein Artwork hochgeladen ist.
  type Item = { key: string; slot: string; fallback: string; label: string; badge?: number; color: string; onClick: () => void; customIcon?: { image_url: string | null; video_url: string | null } | null };
  const items: Item[] = [
    { key: "profil",  slot: "quick_base",      fallback: "👤", label: "Profil",  badge: baseQueueReady,    color: "#FFD700", onClick: onOpenProfile, customIcon: profileIcon },
    { key: "crew",    slot: "quick_crew",      fallback: "👥", label: "Crew",    color: PRIMARY,           onClick: onOpenCrewModal },
    { key: "rally",   slot: "quick_rally",     fallback: "⚔",  label: "Angriffe", badge: rallyTotal,        color: ACCENT,    onClick: () => setOpenRallyList(!openRallyList) },
    { key: "ranking", slot: "quick_ranking",   fallback: "🏆", label: "Ranking", color: "#FF6B4A",         onClick: onOpenRanking },
    { key: "shop",    slot: "quick_shop",      fallback: "🎁", label: "Shop",    color: "#a855f7",         onClick: () => window.dispatchEvent(new CustomEvent("ma365:open-deals-shop")) },
    { key: "deals",   slot: "quick_deals",     fallback: "🔥", label: "Deals",   color: "#FFD700",         onClick: onOpenShop },
    { key: "inbox",   slot: "quick_inbox",     fallback: "📬", label: "Inbox",   badge: inboxUnread,       color: "#22D1C3", onClick: onOpenInbox },
  ];

  // Gesamt-Badge-Summe für eingeklappten Toggle-Knopf
  const totalBadges = items.reduce((sum, it) => sum + (it.badge ?? 0), 0);

  return (
    <>
      {/* Stadt/Straßen-Style Quickaccess: rechts auf gleicher Höhe wie "Losgehen" */}
      <div style={{
        position: "absolute",
        right: 8,
        bottom: 30,
        zIndex: 9001,
        display: "flex", flexDirection: "row", alignItems: "center", gap: 6,
        pointerEvents: "auto",
        maxWidth: "calc(100vw - 16px)",
      }}>
        {!collapsed && (
          <div
            ref={barRef}
            className="ma365-qa-bar"
            style={{
              display: "flex", flexDirection: "row",
              gap: 6, padding: "6px 8px",
              maxWidth: "calc(100vw - 80px)", overflowX: "auto",
              background: "transparent",
              border: "1px solid rgba(255,255,255,0.04)",
              borderRadius: 14,
              boxShadow: "0 4px 12px rgba(0,0,0,0.18)",
              backdropFilter: "blur(4px)",
              WebkitBackdropFilter: "blur(4px)",
              // Mobile-Hint: rechter Rand fadet aus, signalisiert Scrollbarkeit
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
                color={it.color}
                onClick={it.onClick}
                customIcon={it.customIcon ?? null}
              />
            ))}
          </div>
        )}

        {/* Toggle-Knopf — Spray-Tag-Style, immer sichtbar */}
        <button
          onClick={toggleCollapsed}
          title={collapsed ? "Aufklappen" : "Einklappen"}
          style={{
            position: "relative",
            width: 44, height: 64, borderRadius: 12,
            background: `
              radial-gradient(circle at 30% 25%, rgba(34,209,195,0.28) 0%, rgba(34,209,195,0.06) 35%, transparent 60%),
              radial-gradient(circle at 70% 75%, rgba(255,45,120,0.22) 0%, rgba(255,45,120,0.05) 30%, transparent 55%),
              rgba(15,17,21,0.18)
            `,
            border: "1px solid rgba(255,255,255,0.08)",
            backdropFilter: "blur(6px) saturate(120%)",
            color: "#FFF", fontSize: 22, fontWeight: 900, cursor: "pointer",
            display: "flex", alignItems: "center", justifyContent: "center",
            boxShadow: "0 4px 14px rgba(0,0,0,0.55), inset 0 1px 0 rgba(255,255,255,0.18)",
            flexShrink: 0,
            fontFamily: "var(--font-display-stack)",
          }}
        >
          {collapsed ? "‹" : "›"}
          {collapsed && totalBadges > 0 && (
            <span style={{
              position: "absolute", top: -5, right: -5,
              minWidth: 20, height: 20, borderRadius: 10, padding: "0 5px",
              background: `radial-gradient(circle at 35% 30%, #ff5b8d, ${ACCENT})`,
              border: "1.5px solid rgba(0,0,0,0.6)",
              color: "#FFF", fontSize: 10, fontWeight: 700,
              display: "flex", alignItems: "center", justifyContent: "center",
              boxShadow: `0 0 8px ${ACCENT}aa`,
              fontFamily: "-apple-system,BlinkMacSystemFont,'Segoe UI',Inter,Roboto,sans-serif",
            }}>{totalBadges > 99 ? "99+" : totalBadges}</span>
          )}
        </button>
        <style>{`
          .ma365-qa-bar::-webkit-scrollbar { display: none; }
          .ma365-qa-bar { scrollbar-width: none; }
        `}</style>
      </div>

      {openRallyList && !collapsed && (
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
                      if (!confirm("Aufgebot wirklich abbrechen? Alle Truppen werden zurückgegeben.")) return;
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
  slot, fallback, art, label, badge, color, onClick, customIcon,
}: {
  slot: string; fallback: string; art: ResourceArtMap;
  label: string; badge?: number; color: string; onClick: () => void;
  customIcon?: { image_url: string | null; video_url: string | null } | null;
}) {
  const hasBadge = (badge ?? 0) > 0;
  return (
    <button
      onClick={onClick}
      title={label}
      style={{
        position: "relative",
        width: 64, height: 64,
        borderRadius: 12,
        // Spray-Bombe: 2 versetzte radiale Sprayspots in Akzentfarbe
        // + diagonal Glas-Highlight + dunkles Glas drunter
        background: `
          radial-gradient(circle at 25% 35%, ${color}77 0%, ${color}33 18%, transparent 38%),
          radial-gradient(circle at 75% 65%, ${color}55 0%, ${color}22 14%, transparent 32%),
          radial-gradient(circle at 50% 50%, ${color}18 0%, transparent 65%),
          linear-gradient(135deg, rgba(255,255,255,0.10) 0%, rgba(255,255,255,0.03) 50%, rgba(0,0,0,0.20) 100%),
          rgba(15,17,21,0.65)
        `,
        backdropFilter: "blur(14px) saturate(150%)",
        WebkitBackdropFilter: "blur(14px) saturate(150%)",
        border: "1px solid rgba(255,255,255,0.18)",
        borderBottom: `3px solid ${color}`,
        color: TEXT,
        display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
        gap: 3, padding: "4px 0",
        cursor: "pointer",
        boxShadow: hasBadge
          ? `0 0 16px ${color}55, 0 4px 14px rgba(0,0,0,0.55), inset 0 1px 0 rgba(255,255,255,0.18)`
          : `0 4px 14px rgba(0,0,0,0.55), inset 0 1px 0 rgba(255,255,255,0.18)`,
        flexShrink: 0,
        overflow: "visible",
      }}
    >
      {/* Spray-Splatter-Tröpfchen-Cluster oben-rechts (CSS box-shadows = mehrere Punkte) */}
      <span style={{
        position: "absolute", top: 6, right: 6,
        width: 2, height: 2, borderRadius: "50%",
        background: color,
        boxShadow: `
          ${color} 4px 2px 0 -0.3px,
          ${color}aa -3px 4px 0 0,
          ${color}88 6px 6px 0 -0.5px,
          ${color}55 -5px -2px 0 0,
          ${color}66 1px 8px 0 -0.5px
        `,
        opacity: 0.85,
        pointerEvents: "none",
      }} />
      <span style={{
        lineHeight: 1,
        filter: `drop-shadow(0 1px 2px rgba(0,0,0,0.7)) drop-shadow(0 0 8px ${color}aa)`,
      }}>
        <QuickButtonIcon customIcon={customIcon} slot={slot} fallback={fallback} art={art} />
      </span>
      <span style={{
        fontSize: 12, fontWeight: 400, letterSpacing: 0.8,
        color: "#FFF",
        textTransform: "uppercase",
        textShadow: `0 0 4px ${color}, 0 1px 2px rgba(0,0,0,0.9)`,
        fontFamily: "var(--font-display-stack)",
        lineHeight: 1,
      }}>{label}</span>
      {hasBadge && (
        <span style={{
          position: "absolute", top: -5, right: -5,
          minWidth: 20, height: 20, borderRadius: 10,
          padding: "0 5px",
          // Spray-Paint-Tropfen-Optik
          background: `radial-gradient(circle at 35% 30%, #ff5b8d, ${ACCENT})`,
          border: "1.5px solid rgba(0,0,0,0.6)",
          color: "#FFF",
          fontSize: 10, fontWeight: 700,
          display: "flex", alignItems: "center", justifyContent: "center",
          boxShadow: `0 0 8px ${ACCENT}aa, 0 1px 3px rgba(0,0,0,0.5)`,
          fontFamily: "-apple-system,BlinkMacSystemFont,'Segoe UI',Inter,Roboto,sans-serif",
        }}>
          {badge! > 99 ? "99+" : badge}
        </span>
      )}
    </button>
  );
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
    if (!confirm("Diesen Teilnehmer aus dem Aufgebot werfen? Die Truppen werden zurückgegeben.")) return;
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
            }} title="Gesamt-Angriffskraft des Aufgebots">⚔ {totalAtk.toLocaleString("de-DE")}</span>
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
                title={confirmCancel ? "Nochmal klicken zum Bestätigen" : "Aufgebot abbrechen (Truppen zurück)"}
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


function QuickButtonIcon({ customIcon, slot, fallback, art }: {
  customIcon?: { image_url: string | null; video_url: string | null } | null;
  slot: string; fallback: string; art: ResourceArtMap;
}) {
  const ready = useArtworkReady();
  const sharedStyle: React.CSSProperties = { width: 24, height: 24, objectFit: "contain", filter: "url(#ma365-chroma-black)", transform: "scale(1.9)", transformOrigin: "center center" };
  if (customIcon?.image_url) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={customIcon.image_url} alt="" style={sharedStyle} />;
  }
  if (customIcon?.video_url) {
    return <video src={customIcon.video_url} autoPlay loop muted playsInline style={sharedStyle} />;
  }
  // Solange Cache (oder Caller-Profil-Marker) noch nicht da ist → Platzhalter,
  // damit kein Emoji-Fallback aufblitzt bevor das hochgeladene Bild lädt.
  if (!ready) return <span style={{ display: "inline-block", width: 26, height: 26 }} aria-hidden />;
  return <UiIcon slot={slot} fallback={fallback} art={art} size={26} />;
}
