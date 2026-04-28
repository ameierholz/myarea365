"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { UiIcon, useUiIconArt, type ResourceArtMap } from "@/components/resource-icon";

const PRIMARY = "#22D1C3";
const ACCENT = "#FF2D78";
const BG = "#0F1115";
const TEXT = "#F0F0F0";
const MUTED = "#8B8FA3";

type RepeaterRally = {
  rally_id: string; repeater_id: string; kind: "repeater";
  leader_name: string; target_label: string | null;
  target_kind: "hq" | "repeater" | "mega";
  target_lat: number; target_lng: number;
  prep_ends_at: string; total_atk: number; participants: number;
};
type BaseRally = {
  rally_id: string; kind: "base";
  leader_name: string; target_label: string | null;
  target_lat: number; target_lng: number;
  prep_ends_at: string; total_atk: number; participants: number;
};
type Joinable = { repeater: RepeaterRally[]; base: BaseRally[] };

function fmtCountdown(iso: string): string {
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
  onOpenOwnBase,
  onOpenCrewModal,
  onOpenInbox,
  onOpenAchievements,
  onOpenShop,
  onJoinRepeaterRally,
  onJoinBaseRally,
  onFlyTo,
  inboxUnread = 0,
  baseQueueReady = 0,
  achievementsReady = 0,
  strongholdsNearby = 0,
}: {
  onOpenOwnBase: () => void;
  onOpenCrewModal: () => void;
  onOpenInbox: () => void;
  onOpenAchievements: () => void;
  onOpenShop: () => void;
  onJoinRepeaterRally: (repeaterId: string) => void;
  onJoinBaseRally: (rallyId: string) => void;
  onFlyTo: (lat: number, lng: number) => void;
  inboxUnread?: number;
  baseQueueReady?: number;
  achievementsReady?: number;
  strongholdsNearby?: number;
}) {
  const [enabled, setEnabled] = useState(true);
  const [rallies, setRallies] = useState<Joinable>({ repeater: [], base: [] });
  const [openRallyList, setOpenRallyList] = useState(false);
  const uiArt = useUiIconArt();
  const [collapsed, setCollapsed] = useState<boolean>(() => {
    try {
      if (typeof window === "undefined") return false;
      const stored = window.localStorage.getItem("ma365_qa_collapsed");
      if (stored === "1") return true;
      if (stored === "0") return false;
      // kein gespeicherter Wert → auf Mobile default collapsed (kollidiert sonst mit Losgehen-Button)
      return window.innerWidth < 640;
    } catch { return false; }
  });
  function toggleCollapsed() {
    setCollapsed((prev) => {
      const next = !prev;
      try { window.localStorage.setItem("ma365_qa_collapsed", next ? "1" : "0"); } catch { /* ignore */ }
      if (next) setOpenRallyList(false);
      return next;
    });
  }
  const [, setTick] = useState(0);

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

  const rallyTotal = rallies.repeater.length + rallies.base.length;

  // Kurz halten — passt in 60er-Tiles und bleibt lesbar.
  // Icons kommen aus dem Artwork-System (cosmetic_artwork kind=ui_icon),
  // Emojis sind nur Fallback solange noch kein Artwork hochgeladen ist.
  type Item = { key: string; slot: string; fallback: string; label: string; badge?: number; color: string; onClick: () => void };
  const items: Item[] = [
    { key: "base",    slot: "quick_base",      fallback: "🏰", label: "Base",      badge: baseQueueReady,    color: "#FFD700", onClick: onOpenOwnBase },
    { key: "rally",   slot: "quick_rally",     fallback: "⚔",  label: "Angriff",   badge: rallyTotal,        color: ACCENT,    onClick: () => setOpenRallyList(!openRallyList) },
    { key: "crew",    slot: "quick_crew",      fallback: "👥", label: "Crew",      color: PRIMARY,           onClick: onOpenCrewModal },
    { key: "wegel",   slot: "quick_wegelager", fallback: "📜", label: "Lager",     badge: strongholdsNearby, color: "#FF6B4A", onClick: () => { /* zukünftig: Liste */ } },
    { key: "shop",    slot: "quick_shop",      fallback: "🎁", label: "Shop",      color: "#a855f7",         onClick: onOpenShop },
    { key: "inbox",   slot: "quick_inbox",     fallback: "📬", label: "Inbox",     badge: inboxUnread,       color: "#22D1C3", onClick: onOpenInbox },
    { key: "achieve", slot: "quick_achieve",   fallback: "🏅", label: "Erfolge",   badge: achievementsReady, color: "#FFD700", onClick: onOpenAchievements },
  ];

  // Gesamt-Badge-Summe für eingeklappten Toggle-Knopf
  const totalBadges = items.reduce((sum, it) => sum + (it.badge ?? 0), 0);

  return (
    <>
      {/* Stadt/Straßen-Style Quickaccess: rechts auf gleicher Höhe wie "Losgehen" (bottom 30) */}
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
              color: "#FFF", fontSize: 10, fontWeight: 900,
              display: "flex", alignItems: "center", justifyContent: "center",
              boxShadow: `0 0 8px ${ACCENT}aa`,
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
            position: "absolute",
            right: 8,
            bottom: 110,
            zIndex: 9002,
            width: "min(340px, calc(100vw - 24px))",
            maxHeight: "60vh",
            overflowY: "auto",
            background: "rgba(15,17,21,0.96)",
            border: "1px solid rgba(255,255,255,0.14)",
            borderRadius: 16,
            boxShadow: "0 12px 32px rgba(0,0,0,0.55)",
            backdropFilter: "blur(14px)",
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
            return (
              <RallyRow
                key={r.rally_id}
                slot={slot}
                fallback={fallback}
                art={uiArt}
                title={r.target_label || "Repeater"}
                subtitle={`${r.leader_name} · ${r.participants} dabei`}
                countdown={fmtCountdown(r.prep_ends_at)}
                onJoin={() => { onJoinRepeaterRally(r.repeater_id); setOpenRallyList(false); }}
                onShow={() => { onFlyTo(r.target_lat, r.target_lng); setOpenRallyList(false); }}
              />
            );
          })}
          {rallies.base.map((r) => (
            <RallyRow
              key={r.rally_id}
              slot="quick_base"
              fallback="🏰"
              art={uiArt}
              title={r.target_label || "Spieler-Base"}
              subtitle={`${r.leader_name} · ${r.participants} dabei`}
              countdown={fmtCountdown(r.prep_ends_at)}
              onJoin={() => { onJoinBaseRally(r.rally_id); setOpenRallyList(false); }}
              onShow={() => { onFlyTo(r.target_lat, r.target_lng); setOpenRallyList(false); }}
            />
          ))}
        </div>
      )}
    </>
  );
}

function QuickButton({
  slot, fallback, art, label, badge, color, onClick,
}: {
  slot: string; fallback: string; art: ResourceArtMap;
  label: string; badge?: number; color: string; onClick: () => void;
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
        <UiIcon slot={slot} fallback={fallback} art={art} size={26} />
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
          fontSize: 10, fontWeight: 900,
          display: "flex", alignItems: "center", justifyContent: "center",
          boxShadow: `0 0 8px ${ACCENT}aa, 0 1px 3px rgba(0,0,0,0.5)`,
        }}>
          {badge! > 99 ? "99+" : badge}
        </span>
      )}
    </button>
  );
}

function RallyRow({
  slot, fallback, art, title, subtitle, countdown, onJoin, onShow,
}: {
  slot: string; fallback: string; art: ResourceArtMap;
  title: string; subtitle: string; countdown: string;
  onJoin: () => void; onShow: () => void;
}) {
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 10,
      padding: "10px 8px",
      borderBottom: "1px solid rgba(255,255,255,0.06)",
    }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 28 }}>
        <UiIcon slot={slot} fallback={fallback} art={art} size={22} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ color: TEXT, fontSize: 13, fontWeight: 800, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {title}
        </div>
        <div style={{ color: MUTED, fontSize: 11, marginTop: 2 }}>
          {subtitle} · ⏱ {countdown}
        </div>
      </div>
      <button
        onClick={onShow}
        style={{
          padding: "6px 10px", borderRadius: 10,
          background: `${PRIMARY}22`,
          border: `1px solid ${PRIMARY}`,
          color: PRIMARY,
          fontSize: 11, fontWeight: 800, cursor: "pointer",
        }}
      >Map</button>
      <button
        onClick={onJoin}
        style={{
          padding: "6px 12px", borderRadius: 10,
          background: `linear-gradient(135deg, ${ACCENT}, #FF6B4A)`,
          border: "none",
          color: "#FFF",
          fontSize: 11, fontWeight: 900, cursor: "pointer",
          boxShadow: `0 4px 12px ${ACCENT}66`,
        }}
      >Beitreten</button>
    </div>
  );
}
