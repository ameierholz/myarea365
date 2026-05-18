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
  base:      55,
  crew:      55,
  rally:     55,
  ranking:   52,
  inbox:     55,
  inventory: 55,
};
const ICON_OFFSET_X: Record<string, number> = {
  base:      -4,
  crew:       0,
  rally:      0,
  ranking:    0,
  inbox:      0,
  inventory:  0,
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
type MutantRally = {
  rally_id: string; kind: "mutant";
  // mutant-rallies haben 4 phasen: preparing → marching → fighting → returning
  status: "preparing" | "marching" | "fighting" | "returning";
  mutant_id: number;
  leader_name: string; target_label: string | null;
  target_lat: number; target_lng: number;
  target_level?: number | null;
  loot_tier: "bronze" | "silver" | "gold" | "platinum";
  prep_ends_at: string;
  march_ends_at: string | null;
  fight_ends_at: string | null;
  return_ends_at: string | null;
  total_atk: number; participants: number;
  i_joined: boolean; is_leader: boolean;
};
type Joinable = { repeater: RepeaterRally[]; base: BaseRally[]; stronghold: StrongholdRally[]; mutant: MutantRally[] };

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
  onOpenInventory,
  onOpenAchievements,
  onOpenRanking,
  onJoinRepeaterRally,
  onJoinBaseRally,
  onFlyTo,
  onZoomCycle,
  zoomCycleIdx = 0,
  inboxUnread = 0,
  baseQueueReady = 0,
  basePendingRss = 0,
  achievementsReady = 0,
  strongholdsNearby = 0,
}: {
  /** Öffnet das Profil-Dashboard-Modal (zeigt Base/Wächter/Crew als Karten). */
  onOpenProfile: () => void;
  onOpenCrewModal: () => void;
  onOpenInbox: () => void;
  onOpenInventory: () => void;
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
  /** Sammelbares RSS (Summe Wood+Stone+Gold+Mana) aus _per_hour-Buildings.
   *  Wenn > 0, erscheint ein pulsierender Gold-Coin-Badge unten-links am Base-Icon. */
  basePendingRss?: number;
  achievementsReady?: number;
  strongholdsNearby?: number;
}) {
  const [enabled, setEnabled] = useState(true);
  const [rallies, setRallies] = useState<Joinable>({ repeater: [], base: [], stronghold: [], mutant: [] });
  const [openRallyList, setOpenRallyList] = useState(false);
  // Collapsed-State persistiert in localStorage damit die Map-View bei
  // schmalen Mobile-Viewports nicht jedes Mal mit voller Toolbar startet.
  const [collapsed, setCollapsed] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return window.localStorage.getItem("ma365:qa-collapsed") === "1";
  });
  const toggleCollapsed = () => {
    setCollapsed((v) => {
      const next = !v;
      try { window.localStorage.setItem("ma365:qa-collapsed", next ? "1" : "0"); } catch { /* ignore */ }
      return next;
    });
  };
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

  const rallyTotal = rallies.repeater.length + rallies.base.length + rallies.stronghold.length + rallies.mutant.length;

  // Artwork-basierte Icons (cosmetic_artwork kind=ui_icon, slot=quick_*).
  // Fallback-Emoji nur wenn noch kein Artwork hochgeladen ist.
  type Item = { key: string; slot: string; fallback: string; label: string; size: number; offsetX: number; badge?: number; pendingRss?: number; onClick: () => void };
  // Shop ist NICHT mehr in der Quick-Access-Bar — er sitzt jetzt prominent
  // im oberen HUD (siehe karten-hud.tsx). Quick-Access bleibt für Gameplay-
  // nahe Aktionen (Base/Crew/Angriffe/Ranking/Inbox/Inventar).
  const items: Item[] = [
    { key: "base",      slot: "quick_base",      fallback: "🏰", label: "Profilbild", size: ICON_SIZE.base,      offsetX: ICON_OFFSET_X.base,      badge: baseQueueReady, pendingRss: basePendingRss, onClick: onOpenProfile },
    { key: "crew",      slot: "quick_crew",      fallback: "👥", label: "Crew",     size: ICON_SIZE.crew,      offsetX: ICON_OFFSET_X.crew,                             onClick: onOpenCrewModal },
    { key: "rally",     slot: "quick_rally",     fallback: "⚔",  label: "Angriffe", size: ICON_SIZE.rally,     offsetX: ICON_OFFSET_X.rally,     badge: rallyTotal,     onClick: () => setOpenRallyList(!openRallyList) },
    { key: "ranking",   slot: "quick_ranking",   fallback: "🏆", label: "Ranking",  size: ICON_SIZE.ranking,   offsetX: ICON_OFFSET_X.ranking,                          onClick: onOpenRanking },
    { key: "inbox",     slot: "quick_inbox",     fallback: "📬", label: "Inbox",    size: ICON_SIZE.inbox,     offsetX: ICON_OFFSET_X.inbox,     badge: inboxUnread,    onClick: onOpenInbox },
    { key: "inventory", slot: "quick_inventory", fallback: "🎒", label: "Inventar", size: ICON_SIZE.inventory, offsetX: ICON_OFFSET_X.inventory,                        onClick: onOpenInventory },
  ];

  return (
    <>
      {/* Quickaccess-Bar: nur Icons. Bei collapsed komplett ausgeblendet.
          right-Offset 82px = ZoomCycle (56) + Gap (8) + Trigger (14) + Gap (4),
          damit die Icons direkt am Trigger anschließen ohne Padding. */}
      <div
        ref={barRef}
        className="ma365-qa-bar"
        style={{
          position: "absolute",
          right: 82,
          bottom: 0,
          zIndex: 9001,
          display: collapsed ? "none" : "flex",
          flexDirection: "row", alignItems: "center",
          gap: 0, padding: 0,
          maxWidth: "calc(100vw - 98px)", overflowX: "auto",
          background: "transparent",
          border: "none",
          boxShadow: "none",
          pointerEvents: "auto",
          // KEIN Fade-Out-Mask — verschluckte das Inbox-Badge auf dem rechten
          // Icon (1-Indikator). Overflow-Scroll bleibt aktiv falls die Bar
          // breiter als der Viewport ist.
          // overflowY visible damit das Badge oben/rechts aus dem Icon raus-
          // ragen darf (sonst clippt scroll-container).
          overflowY: "visible",
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
            pendingRss={it.pendingRss}
            size={it.size}
            offsetX={it.offsetX}
            onClick={it.onClick}
          />
        ))}
        <style>{`
          .ma365-qa-bar::-webkit-scrollbar { display: none; }
          .ma365-qa-bar { scrollbar-width: none; }
        `}</style>
      </div>

      {/* Collapse-Trigger: schlanke vertikale Pille (Drawer-Handle-Style).
          Kompakter als ein Kreis, klar als Schubladen-Griff erkennbar. */}
      <button
        onClick={toggleCollapsed}
        aria-label={collapsed ? "Aktions-Leiste einblenden" : "Aktions-Leiste ausblenden"}
        title={collapsed ? "Einblenden" : "Ausblenden"}
        style={{
          position: "absolute",
          right: 68,         // links neben ZoomCycle: 8 + 56 + 4 gap = 68
          bottom: 10,        // bottom 10 + height/2 (18) = 28 = ZoomCycle-Mitte
          zIndex: 9002,
          width: 14, height: 36,
          padding: 0,
          display: "flex", alignItems: "center", justifyContent: "center",
          background: "rgba(15,17,21,0.65)",
          border: "1px solid rgba(34,209,195,0.45)",
          borderRadius: 7,
          boxShadow: "0 2px 6px rgba(0,0,0,0.45), inset 0 0 4px rgba(34,209,195,0.18)",
          backdropFilter: "blur(6px)",
          WebkitBackdropFilter: "blur(6px)",
          cursor: "pointer",
          color: "#22D1C3",
          fontSize: 11,
          lineHeight: 1,
        }}
      >
        <span style={{ filter: "drop-shadow(0 1px 1px rgba(0,0,0,0.6))" }}>
          {collapsed ? "◀" : "▶"}
        </span>
      </button>

      {/* ZoomCycle bleibt IMMER sichtbar — unabhängig vom Collapse-Zustand
          der Quick-Access-Bar. Sitzt direkt links neben dem Mapbox-Info-(i),
          oben rechts daneben der Collapse-Toggle wenn ausgeklappt. */}
      {onZoomCycle && (
        <div
          style={{
            position: "absolute",
            right: 8,
            bottom: 0,
            zIndex: 9001,
            pointerEvents: "auto",
          }}
        >
          <ZoomCycleButton onClick={onZoomCycle} cycleIdx={zoomCycleIdx} />
        </div>
      )}

      {openRallyList && (
        <div
          onClick={(e) => e.stopPropagation()}
          style={{
            position: "fixed",
            // CoD-Style: breites Modal-artiges Panel statt schmaler Pille rechts.
            // Bei Mobile passt es sich mit calc-Padding an, bei Desktop max 720px.
            left: "50%",
            transform: "translateX(-50%)",
            width: "min(720px, calc(100vw - 24px))",
            bottom: 110,
            zIndex: 9002,
            maxHeight: "70vh",
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
          {rallies.mutant.map((r) => {
            const countdownIso =
              r.status === "preparing" ? r.prep_ends_at
              : r.status === "fighting" ? r.fight_ends_at
              : r.status === "returning" ? r.return_ends_at
              : r.march_ends_at;
            return (
              <RallyRow
                key={r.rally_id}
                rallyId={r.rally_id}
                slot={`mutant_${r.loot_tier}`}
                fallback="👹"
                art={uiArt}
                // Mutant-Sprite-Sheet: erster Frame als Avatar via CSS-Background-
                // Trick — Sheet ist 12×128 px breit, wir zeigen nur den ersten Frame.
                spriteSheet="/sprites/mutant_idle_12x128.png"
                title={`${r.target_label ?? "Mutant"}`}
                leaderName={r.leader_name}
                participants={r.participants}
                totalAtk={r.total_atk}
                countdown={fmtCountdown(countdownIso)}
                status={r.status}
                joined={r.i_joined}
                isLeader={r.is_leader}
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
  slot, fallback, art, label, badge, pendingRss, onClick, size, offsetX = 0,
}: {
  slot: string; fallback: string; art: ResourceArtMap;
  label: string; badge?: number; pendingRss?: number; onClick: () => void; size: number; offsetX?: number;
}) {
  const hasBadge = (badge ?? 0) > 0;
  const hasPending = (pendingRss ?? 0) > 0;
  // Kompakter Zahl-Formatter: 1.2k / 850 / 12k
  const fmtPending = (n: number): string => {
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
    if (n >= 10_000) return `${Math.round(n / 1000)}k`;
    if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
    return String(n);
  };
  // Bild = Button-Größe (kein Padding — Artwork füllt den ganzen Button)
  const iconSize = size;
  return (
    <button
      onClick={onClick}
      title={hasPending ? `${label} · ${pendingRss} Resources zum Einsammeln` : label}
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
      {hasPending && (
        <span style={{
          position: "absolute", bottom: -2, left: -2,
          minWidth: 22, height: 16, borderRadius: 8,
          padding: "0 5px 0 3px",
          display: "inline-flex", alignItems: "center", gap: 2,
          background: "linear-gradient(135deg, #FFD700 0%, #FFA500 100%)",
          color: "#0F1115",
          fontSize: 9, fontWeight: 900, letterSpacing: 0.3,
          fontFamily: "var(--font-display-stack)",
          boxShadow: "0 1px 4px rgba(255,165,0,0.55), 0 0 10px rgba(255,215,0,0.6), inset 0 1px 0 rgba(255,255,255,0.45)",
          border: "1px solid #5a3f10",
          animation: "ma365-pending-pulse 1.6s ease-in-out infinite",
          zIndex: 2,
        }}>
          <span style={{ fontSize: 10, lineHeight: 1 }}>🪙</span>
          <span>{fmtPending(pendingRss!)}</span>
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
  rallyId, slot, fallback, art, avatarUrl, spriteSheet, title, leaderName, participants, totalAtk, countdown,
  status, joined, isLeader, onJoin, onShow, onCancel,
}: {
  rallyId: string;
  slot: string; fallback: string; art: ResourceArtMap;
  avatarUrl?: string | null;
  /** Optional: Sprite-Sheet (z. B. Mutant) — wir zeigen Frame 0 als Avatar.
      Sheet muss 12 Frames horizontal x 128px sein (mutant_idle_12x128.png-Format). */
  spriteSheet?: string;
  title: string; leaderName: string; participants: number; totalAtk: number; countdown: string;
  status: "preparing" | "marching" | "fighting" | "returning";
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
    status === "returning" ? { label: "RÜCKWEG",  color: "#22D1C3" } :
                              { label: "KAMPF",    color: "#FF2D78" };

  return (
    <div style={{
      padding: "10px 8px",
      borderBottom: "1px solid rgba(255,255,255,0.06)",
    }}>
      {/* Icon links, Title+Info-Spalte mitte, Atk-Block rechts (volle Höhe) */}
      <div style={{ display: "flex", alignItems: "stretch", gap: 4 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minWidth: 64, flexShrink: 0, marginLeft: -20, marginTop: -6 }}>
          {spriteSheet ? (
            // Sprite-Sheet-Frame 0: Sheet ist 1536×128 (12 Frames × 128 px).
            // background-size 672×56 → jeder Frame wird 56×56, position 0,0 = erster Frame.
            <div
              style={{
                width: 56, height: 56, borderRadius: "50%",
                border: `2px solid ${ACCENT}66`,
                boxShadow: `0 0 8px ${ACCENT}55`,
                background: `url(${spriteSheet}) 0 0 / 672px 56px no-repeat, rgba(15,17,21,0.6)`,
                backgroundBlendMode: "normal",
              }}
              aria-label="Mutant"
            />
          ) : avatarUrl ? (
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
        <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", justifyContent: "center", gap: 3 }}>
          {/* Zeile 1: Titel + Countdown + Status — alles in einer Zeile, kein Wrap */}
          <div style={{ display: "flex", alignItems: "center", gap: 6, minWidth: 0 }}>
            <div style={{ flex: 1, minWidth: 0, color: TEXT, fontSize: 13, fontWeight: 800, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {title}
            </div>
            <span style={{
              color: TEXT, fontWeight: 700, fontVariantNumeric: "tabular-nums",
              fontSize: 11, flexShrink: 0,
            }}>⏱ {countdown}</span>
            <span style={{
              fontSize: 9, fontWeight: 900, letterSpacing: 0.6,
              color: statusBadge.color,
              padding: "2px 6px", borderRadius: 4,
              background: `${statusBadge.color}1f`, border: `1px solid ${statusBadge.color}55`,
              whiteSpace: "nowrap", lineHeight: 1.4, flexShrink: 0,
            }}>{statusBadge.label}</span>
          </div>
          {/* Zeile 2: Leader · N dabei · Angriffskraft + Action-Buttons rechts */}
          <div style={{ display: "flex", alignItems: "center", gap: 6, color: MUTED, fontSize: 11, minWidth: 0 }}>
            <span style={{ color: TEXT, fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flexShrink: 1, minWidth: 0 }}>
              {leaderName}
            </span>
            <button
              onClick={() => setExpanded((e) => !e)}
              style={{
                background: "transparent", border: "none", padding: 0,
                color: PRIMARY, fontSize: 11, fontWeight: 700, cursor: "pointer",
                flexShrink: 0,
              }}
              title={expanded ? "Zuklappen" : "Teilnehmer anzeigen"}
            >
              · {participants} {expanded ? "▲" : "▼"}
            </button>
            <span style={{
              color: "#FF6B4A", fontWeight: 800, fontVariantNumeric: "tabular-nums",
              fontSize: 10, flexShrink: 0,
            }} title="Gesamt-Angriffskraft">⚔ {totalAtk.toLocaleString("de-DE")}</span>
            <span style={{ flex: 1 }} />
            <button
              onClick={onShow}
              style={{
                padding: "2px 6px", borderRadius: 4,
                background: `${PRIMARY}1f`, border: `1px solid ${PRIMARY}55`,
                color: PRIMARY, fontSize: 9, fontWeight: 900, letterSpacing: 0.4,
                cursor: "pointer", whiteSpace: "nowrap", flexShrink: 0, lineHeight: 1.4,
              }}
              title="Karte zentrieren"
            >📍</button>
            {onCancel && (
              <button
                onClick={async () => {
                  if (busyCancel) return;
                  if (!confirmCancel) { setConfirmCancel(true); return; }
                  setBusyCancel(true);
                  try { await onCancel(); } finally { setBusyCancel(false); setConfirmCancel(false); }
                }}
                disabled={busyCancel}
                title={confirmCancel ? "Nochmal klicken zum Bestätigen" : "Trupp abbrechen"}
                style={{
                  fontSize: 9, fontWeight: 900, letterSpacing: 0.4,
                  color: confirmCancel ? "#FFF" : "#FF6B9A",
                  padding: "2px 6px", borderRadius: 4,
                  background: confirmCancel ? "rgba(255,45,120,0.85)" : "rgba(255,45,120,0.12)",
                  border: `1px solid ${confirmCancel ? "rgba(255,45,120,1)" : "rgba(255,45,120,0.5)"}`,
                  whiteSpace: "nowrap", cursor: busyCancel ? "wait" : "pointer",
                  opacity: busyCancel ? 0.5 : 1, lineHeight: 1.4, flexShrink: 0,
                }}
              >{busyCancel ? "…" : confirmCancel ? "?" : "✕"}</button>
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
        width: 56, height: 56, marginLeft: 4, marginRight: 0,
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
        fontSize: 52,
        lineHeight: 1,
      }}
    >
      <span style={{
        filter: "drop-shadow(0 1px 2px rgba(0,0,0,0.7))",
        // Welt-Icon (🌐) hat anderen Baseline als 🎯/🛰 — eigenes Offset.
        transform: cycleIdx === 2 ? "translate(1px, 0px)" : "translate(2px, -3px)",
      }}>{icon}</span>
    </button>
  );
}

