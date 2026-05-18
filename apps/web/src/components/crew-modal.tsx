"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import { createClient } from "@/lib/supabase/client";
import { UiIcon, useUiIconArt, useResourceArt, useModalBackgroundArt, ResourceIcon, type ResourceArtMap } from "@/components/resource-icon";

const PRIMARY = "#22D1C3";
const BG = "#0F1115";
const TEXT = "#F0F0F0";
const MUTED = "#8B8FA3";

// Crew-Level-Schwellen (vereinfacht, falls noch nicht in DB): Ansehen-Total
// dient als XP-Proxy für die Crew-Stufe. Schwellen wachsen exponentiell.
function computeCrewLevel(ansehen: number): { level: number; pct: number; nextAt: number } {
  const thresholds = [0, 500, 1500, 3500, 7500, 15000, 30000, 60000, 120000, 250000, 500000];
  for (let i = thresholds.length - 1; i >= 0; i--) {
    if (ansehen >= thresholds[i]) {
      const next = thresholds[i + 1] ?? thresholds[i] * 2;
      const span = next - thresholds[i];
      const into = ansehen - thresholds[i];
      return { level: i + 1, pct: span > 0 ? Math.min(100, (into / span) * 100) : 100, nextAt: next };
    }
  }
  return { level: 1, pct: 0, nextAt: thresholds[1] };
}

type Tab = "uebersicht" | "mitglieder" | "tech" | "bauwerke" | "kopfgelder" | "shop" | "hilfe" | "diplomatie" | "nachrichten" | "einstellungen";

type Overview = {
  crew: { id: string; name: string; tag: string; color: string; zip: string; created_at: string };
  leader: { id: string; name: string; ansehen: number } | null;
  stats: { ansehen_total: number; member_count: number; repeater_count: number; territory_count: number };
  resources: { wood: number; stone: number; gold: number; mana: number } | null;
};
type TechDef = { id: string; name: string; description: string; category: "combat" | "economy" | "utility"; max_level: number; cost_gold_per_level: number; cost_wood_per_level: number; cost_stone_per_level: number; research_seconds_per_level: number; effect_per_level: number };
type TechProgress = { tech_id: string; level: number };
type TechQueue = { id: string; tech_id: string; target_level: number; ends_at: string };
type Bounty = { id: string; target_user_id: string; target_name: string; reward_gold: number; reason: string | null; posted_by_name: string; expires_at: string; created_at: string };
type ShopItem = { id: string; name: string; description: string; category: string; price_coins: number };

export function CrewModal({ onClose, onPlaceBuilding, onOpenWar }: { onClose: () => void; onPlaceBuilding?: (kind: "hq" | "mega" | "repeater" | "blackmarket" | "bunker" | "hangout" | "tunnel") => void; onOpenWar?: () => void }) {
  const t = useTranslations("CrewModal");
  const [tab, setTab] = useState<Tab>("uebersicht");
  const [overview, setOverview] = useState<Overview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const uiArt = useUiIconArt();
  const resourceArt = useResourceArt();

  useEffect(() => {
    const sb = createClient();
    void (async () => {
      const { data, error: e } = await sb.rpc("get_crew_overview", { p_crew_id: null });
      if (e) { setError(e.message); return; }
      const j = data as Overview | { error: string };
      if ("error" in j) { setError(j.error); return; }
      setOverview(j);
    })();
  }, []);

  // ESC schließt
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-[9100] bg-black/75 backdrop-blur-md flex items-stretch justify-center p-1.5 sm:p-6"
      style={{ maxHeight: "100dvh" }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md sm:max-w-2xl lg:max-w-4xl flex flex-col min-h-0"
        style={{ maxHeight: "100dvh" }}
      >
        <div className="bg-[#0F1115] border border-white/10 rounded-2xl shadow-2xl overflow-hidden flex flex-col flex-1 min-h-0">
          {error && (
            <div className="p-5 text-[#FF6B4A] text-sm font-bold">
              {t("errorPrefix", { msg: error })}
            </div>
          )}
          {!error && !overview && (
            <div className="p-5 text-[#8B8FA3] text-sm">{t("loading")}</div>
          )}
          {!error && overview && (
            <>
              <Header
                overview={overview}
                onClose={onClose}
                onOpenWar={onOpenWar}
                onOpenSettings={() => setTab("einstellungen")}
                showResourceHud={tab !== "uebersicht" && tab !== "einstellungen"}
                resourceArt={resourceArt}
              />

              <Tabs tab={tab} onChange={setTab} uiArt={uiArt} accent={overview.crew.color} />

              <div className="p-4 overflow-y-auto flex-1 ma365-no-scrollbar" style={{ scrollbarWidth: "none" }}>
                <style>{`.ma365-no-scrollbar::-webkit-scrollbar{display:none}`}</style>
                {tab === "uebersicht"   && <TabUebersicht overview={overview} />}
                {tab === "mitglieder"   && <TabMitglieder crewId={overview.crew.id} />}
                {tab === "tech"         && <TabTech />}
                {tab === "bauwerke"     && <TabBauwerke onPlaceBuilding={(kind) => { onPlaceBuilding?.(kind); onClose(); }} />}
                {tab === "kopfgelder"   && <TabKopfgelder crewId={overview.crew.id} />}
                {tab === "shop"         && <TabShop />}
                {tab === "hilfe"        && <TabHilfe />}
                {tab === "diplomatie"   && <TabDiplomatie crewId={overview.crew.id} />}
                {tab === "nachrichten"  && <TabNachrichten />}
                {tab === "einstellungen"&& <TabEinstellungen />}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function Header({
  overview,
  onClose,
  onOpenWar,
  onOpenSettings,
  showResourceHud,
  resourceArt,
}: {
  overview: Overview;
  onClose: () => void;
  onOpenWar?: () => void;
  onOpenSettings: () => void;
  showResourceHud: boolean;
  resourceArt: ResourceArtMap;
}) {
  const t = useTranslations("CrewModal");
  const { crew, leader, stats, resources } = overview;
  const uiArt = useUiIconArt();
  const bgArt = useModalBackgroundArt();
  const accent = crew.color;
  const { level, pct, nextAt } = computeCrewLevel(stats.ansehen_total);

  // Crew-Zentrum-Artwork als Header-Background (slot karte_crew_bg).
  // Liegt unter mehreren Layern: Image → dunkler Veil → Akzent-Gradient → Content.
  const crewBg = bgArt["karte_crew_bg"];
  const bgImageUrl = crewBg?.image_url ?? null;
  const bgVideoUrl = crewBg?.video_url ?? null;

  return (
    <div className="relative overflow-hidden">
      {/* Background-Layer: Crew-Zentrum-Artwork (Image oder Video) */}
      {bgImageUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={bgImageUrl}
          alt=""
          aria-hidden
          className="absolute inset-0 w-full h-full object-cover pointer-events-none"
          style={{ filter: "saturate(1.1) contrast(1.05)" }}
        />
      )}
      {!bgImageUrl && bgVideoUrl && (
        <video
          src={bgVideoUrl}
          autoPlay loop muted playsInline
          aria-hidden
          className="absolute inset-0 w-full h-full object-cover pointer-events-none"
          style={{ filter: "saturate(1.1) contrast(1.05)" }}
        />
      )}
      {/* Dark-Veil + Akzent-Gradient drüber für Lesbarkeit + Crew-Branding */}
      <div
        aria-hidden
        className="absolute inset-0 pointer-events-none"
        style={{
          background: `
            linear-gradient(135deg, ${accent}55 0%, ${accent}22 45%, rgba(15,17,21,0.85) 100%),
            linear-gradient(180deg, rgba(15,17,21,0.45) 0%, rgba(15,17,21,0.78) 100%)
          `,
        }}
      />
      {/* Akzent-Strip oben */}
      <div
        aria-hidden
        className="absolute top-0 left-0 right-0 h-[2px] pointer-events-none"
        style={{
          background: `linear-gradient(90deg, transparent, ${accent}, ${accent}, transparent)`,
          boxShadow: `0 0 12px ${accent}aa`,
        }}
      />

      {/* Content */}
      <div className="relative px-3 pt-3 pb-3 flex items-start gap-3">
        {/* Crew-Avatar-Tile mit Radial-Glow */}
        <div
          className="w-14 h-14 rounded-xl flex items-center justify-center shrink-0"
          style={{
            background: `radial-gradient(circle at 50% 30%, ${accent}cc, ${accent}55 50%, rgba(15,17,21,0.7))`,
            border: `2px solid ${accent}`,
            boxShadow: `0 0 18px ${accent}88, inset 0 1px 0 rgba(255,255,255,0.2)`,
            color: "#0F1115",
            fontSize: 26, fontWeight: 900,
            fontFamily: "var(--font-display-stack)",
            letterSpacing: 0.5,
            textShadow: "0 1px 2px rgba(0,0,0,0.3)",
          }}
        >
          {crew.tag.charAt(0)}
        </div>

        {/* Titel + Leader + Crew-Level-XP */}
        <div className="flex-1 min-w-0">
          <div className="text-[10px] font-black tracking-widest uppercase" style={{ color: accent, textShadow: `0 0 8px ${accent}55` }}>
            [{crew.tag}] · {t("zipPrefix", { zip: crew.zip })}
          </div>
          <div
            className="text-base sm:text-xl font-black text-white truncate mt-0.5"
            style={{ fontFamily: "var(--font-display-stack)", letterSpacing: 0.4, textShadow: "0 2px 6px rgba(0,0,0,0.6)" }}
          >
            {crew.name}
          </div>
          <div className="mt-1.5">
            <div className="flex justify-between text-[9px] text-[#cdd4e3] font-black mb-1">
              <span>STUFE {level} · {t("leaderLabel")} <span style={{ color: "#FFF" }}>{leader?.name ?? t("noLeader")}</span></span>
              <span>{level < 10 ? `→ ${nextAt.toLocaleString()}` : "MAX"}</span>
            </div>
            <div className="h-1.5 rounded-full bg-black/40 overflow-hidden">
              <div
                className="h-full rounded-full transition-all"
                style={{
                  width: `${pct}%`,
                  background: `linear-gradient(90deg, ${accent}, ${accent}cc)`,
                  boxShadow: `0 0 8px ${accent}`,
                }}
              />
            </div>
          </div>
        </div>

        {/* Ansehen-Total + Action-Cluster */}
        <div className="flex flex-col items-end gap-1.5 shrink-0">
          <div className="flex items-center gap-1">
            {onOpenWar && (
              <button
                onClick={onOpenWar}
                className="w-7 h-7 rounded-md bg-black/40 hover:bg-black/60 text-[#FF2D78] hover:text-white text-sm font-black transition-colors flex items-center justify-center"
                style={{ border: "1px solid rgba(255,45,120,0.45)" }}
                title="Kriege"
                aria-label="Kriege"
              >
                ⚔
              </button>
            )}
            <button
              onClick={onOpenSettings}
              className="w-7 h-7 rounded-md bg-black/40 hover:bg-black/60 text-white/80 hover:text-white text-sm font-black transition-colors flex items-center justify-center"
              title="Einstellungen"
              aria-label="Einstellungen"
            >
              ⚙
            </button>
            <button
              onClick={onClose}
              className="w-7 h-7 rounded-md bg-black/40 hover:bg-black/60 text-white/80 hover:text-white text-base font-black transition-colors flex items-center justify-center"
              title="Schließen"
              aria-label="Schließen"
            >
              ×
            </button>
          </div>
          <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-black/45 backdrop-blur-sm" style={{ border: `1px solid #FFD70066`, boxShadow: "0 0 10px rgba(255,215,0,0.25)" }}>
            <UiIcon slot="stat_ansehen" fallback="⚜" art={uiArt} size={16} />
            <span style={{ color: "#FFD700", fontSize: 14, fontWeight: 900, fontFamily: "var(--font-display-stack)", letterSpacing: 0.3 }}>
              {stats.ansehen_total.toLocaleString()}
            </span>
          </div>
        </div>
      </div>

      {/* Resource-HUD direkt unter Header (nur außerhalb von Übersicht/Settings) */}
      {showResourceHud && resources && (
        <div className="relative px-3 pb-3 grid grid-cols-4 gap-1.5">
          {(["wood", "stone", "gold", "mana"] as const).map((k) => (
            <div key={k} className="rounded-lg bg-black/45 backdrop-blur-sm px-2 py-1.5 text-center" style={{ border: "1px solid rgba(255,255,255,0.08)" }}>
              <div className="leading-none flex items-center justify-center" style={{ height: 32 }}>
                <ResourceIcon kind={k} size={32} fallback={k === "wood" ? "🔩" : k === "stone" ? "⚙️" : k === "gold" ? "💰" : "📡"} art={resourceArt} />
              </div>
              <div className="text-[11px] font-black mt-0.5" style={{ color: k === "gold" ? "#FFD700" : k === "mana" ? "#22D1C3" : "#FFF" }}>
                {compactNum(resources[k] ?? 0)}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// kompakter Zahl-Formatter wie im base-modal
function compactNum(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 10_000) return `${Math.round(n / 1000)}k`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return n.toLocaleString();
}

function Tabs({ tab, onChange, uiArt, accent }: { tab: Tab; onChange: (t: Tab) => void; uiArt: ReturnType<typeof useUiIconArt>; accent: string }) {
  const tt = useTranslations("CrewModal");
  // Settings ist im Header als ⚙-Button — fliegt aus der Tab-Bar raus,
  // damit es nicht doppelt erreichbar ist (Pattern wie base-modal).
  const tabs: Array<{ id: Tab; label: string; slot: string; fallback: string }> = [
    { id: "uebersicht",    label: tt("tabOverview"),  slot: "crew_tab_overview", fallback: "📋" },
    { id: "mitglieder",    label: tt("tabMembers"),   slot: "crew_tab_members",  fallback: "👥" },
    { id: "tech",          label: tt("tabResearch"),  slot: "crew_tab_research", fallback: "🧪" },
    { id: "bauwerke",      label: tt("tabBuildings"), slot: "crew_tab_buildings", fallback: "🏗" },
    { id: "kopfgelder",    label: tt("tabBounties"),  slot: "crew_tab_bounties", fallback: "🎯" },
    { id: "shop",          label: tt("tabShop"),      slot: "crew_tab_shop",     fallback: "📦" },
    { id: "hilfe",         label: "Hilfe",            slot: "crew_tab_help",     fallback: "🤝" },
    { id: "diplomatie",    label: "Diplomatie",       slot: "crew_tab_diplomacy", fallback: "🤝" },
    { id: "nachrichten",   label: "Nachrichten",      slot: "crew_tab_mail",     fallback: "✉" },
  ];
  return (
    <div
      className="flex border-y border-white/10 text-[10px] font-black tracking-wider bg-[#0F1115] shrink-0 overflow-x-auto"
      style={{ scrollbarWidth: "none" }}
    >
      <style>{`.crew-tabs-row::-webkit-scrollbar{display:none}`}</style>
      <div className="crew-tabs-row flex w-full">
        {tabs.map((tt) => {
          const active = tab === tt.id;
          return (
            <button
              key={tt.id}
              onClick={() => onChange(tt.id)}
              title={tt.label}
              className={`flex-1 min-w-[68px] py-2 px-2 whitespace-nowrap transition-colors inline-flex items-center justify-center gap-1.5 ${active ? "text-white" : "text-[#a8b4cf] hover:text-white"}`}
              style={
                active
                  ? { borderBottom: `2px solid ${accent}`, marginBottom: "-1px", background: `${accent}11`, boxShadow: `inset 0 -8px 16px -8px ${accent}55` }
                  : undefined
              }
            >
              <UiIcon slot={tt.slot} fallback={tt.fallback} art={uiArt} size={14} />
              <span>{tt.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function TabUebersicht({ overview }: { overview: Overview }) {
  const t = useTranslations("CrewModal");
  const { crew, stats, resources } = overview;
  const accent = crew.color;
  const resourceArt = useResourceArt();
  const { level, pct, nextAt } = computeCrewLevel(stats.ansehen_total);

  return (
    <div className="space-y-3">
      {/* Quick-Stats Grid — 4 hauptmetriken mit Progress wo sinnvoll */}
      <div className="grid grid-cols-2 gap-2">
        <StatCard
          icon="⚜"
          label={t("statAnsehen")}
          value={compactNum(stats.ansehen_total)}
          sub={level < 10 ? `STUFE ${level} → ${compactNum(nextAt)}` : `STUFE ${level} · MAX`}
          accent="#FFD700"
          progress={pct}
        />
        <StatCard
          icon="👥"
          label={t("statMembers")}
          value={stats.member_count.toString()}
          sub={`${stats.member_count}/50`}
          accent={accent}
          progress={(stats.member_count / 50) * 100}
        />
        <StatCard
          icon="📡"
          label={t("statRepeaters")}
          value={stats.repeater_count.toString()}
          sub={stats.repeater_count > 0 ? "im Einsatz" : "Kein Repeater"}
          accent="#22D1C3"
        />
        <StatCard
          icon="🗺"
          label={t("statTerritories")}
          value={stats.territory_count.toString()}
          sub={stats.territory_count > 0 ? "Crew-Turfs" : "Erobere Turf"}
          accent="#FF6B4A"
        />
      </div>

      {/* Crew-Schatzkammer (RSS) — modernes Grid mit Icons */}
      {resources && (
        <div className="rounded-xl bg-[#1A1D23] border border-white/10 p-3">
          <div className="text-[10px] font-black tracking-widest uppercase text-[#a8b4cf] mb-2">
            {t("rssHeader")}
          </div>
          <div className="grid grid-cols-4 gap-2">
            {([
              { k: "wood",  label: t("rssWood"),  fb: "🔩", color: "#FFF" },
              { k: "stone", label: t("rssStone"), fb: "⚙️", color: "#FFF" },
              { k: "gold",  label: t("rssGold"),  fb: "💰", color: "#FFD700" },
              { k: "mana",  label: t("rssMana"),  fb: "📡", color: "#22D1C3" },
            ] as const).map((r) => (
              <div
                key={r.k}
                className="rounded-lg bg-black/30 px-2 py-2 text-center"
                style={{ border: "1px solid rgba(255,255,255,0.06)" }}
              >
                <div className="flex items-center justify-center" style={{ height: 32 }}>
                  <ResourceIcon kind={r.k} size={32} fallback={r.fb} art={resourceArt} />
                </div>
                <div className="text-[12px] font-black mt-0.5" style={{ color: r.color }}>
                  {compactNum(resources[r.k] ?? 0)}
                </div>
                <div className="text-[8px] uppercase tracking-wider mt-0.5 text-[#8B8FA3] truncate">
                  {r.label}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Quick-Info-Card: Crew-Daten */}
      <div className="rounded-xl bg-[#1A1D23] border border-white/10 p-3 text-[11px] text-[#cdd4e3]">
        <div className="flex items-center justify-between">
          <span className="text-[#8B8FA3]">Crew-Tag</span>
          <span className="font-black" style={{ color: accent }}>[{crew.tag}]</span>
        </div>
        <div className="flex items-center justify-between mt-1.5">
          <span className="text-[#8B8FA3]">Heimat-PLZ</span>
          <span className="font-bold text-white">{crew.zip}</span>
        </div>
        <div className="flex items-center justify-between mt-1.5">
          <span className="text-[#8B8FA3]">Gegründet</span>
          <span className="font-bold text-white">{new Date(crew.created_at).toLocaleDateString("de-DE")}</span>
        </div>
      </div>
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
  sub,
  accent,
  progress,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  sub?: string;
  accent: string;
  progress?: number;
}) {
  return (
    <div className="rounded-xl bg-[#1A1D23] border border-white/10 p-3">
      <div className="flex items-center gap-2">
        {typeof icon === "string" ? (
          <span className="text-2xl shrink-0" style={{ filter: `drop-shadow(0 0 8px ${accent}55)` }}>{icon}</span>
        ) : (
          <span className="flex items-center justify-center shrink-0" style={{ width: 40, height: 40 }}>{icon}</span>
        )}
        <div className="flex-1 min-w-0">
          <div className="text-[9px] font-black tracking-wider text-[#a8b4cf] uppercase truncate">{label}</div>
          <div className="text-lg font-black truncate" style={{ color: accent, fontFamily: "var(--font-display-stack)", letterSpacing: 0.3 }}>
            {value}
          </div>
        </div>
      </div>
      {sub && <div className="text-[9px] text-[#a8b4cf] mt-1 truncate">{sub}</div>}
      {typeof progress === "number" && (
        <div className="mt-2 h-1 rounded-full bg-white/10 overflow-hidden">
          <div
            className="h-full rounded-full transition-all"
            style={{
              width: `${Math.min(100, Math.max(0, progress))}%`,
              background: `linear-gradient(90deg, ${accent}, ${accent}aa)`,
              boxShadow: `0 0 6px ${accent}88`,
            }}
          />
        </div>
      )}
    </div>
  );
}

function TabMitglieder({ crewId }: { crewId: string }) {
  const t = useTranslations("CrewModal");
  type Member = { id: string; display_name: string | null; username: string; ansehen: number };
  const [list, setList] = useState<Member[] | null>(null);
  const uiArt = useUiIconArt();
  useEffect(() => {
    const sb = createClient();
    void (async () => {
      const { data: members } = await sb.from("crew_members").select("user_id").eq("crew_id", crewId);
      const ids = (members ?? []).map((m: { user_id: string }) => m.user_id);
      if (ids.length === 0) { setList([]); return; }
      const { data: users } = await sb.from("users").select("id, display_name, username, ansehen").in("id", ids);
      const sorted = (users as Member[] ?? []).sort((a, b) => (b.ansehen ?? 0) - (a.ansehen ?? 0));
      setList(sorted);
    })();
  }, [crewId]);
  if (!list) return <div style={{ color: MUTED }}>{t("membersLoading")}</div>;
  if (list.length === 0) return <div style={{ color: MUTED }}>{t("membersEmpty")}</div>;
  return (
    <div>
      {list.map((m, i) => (
        <div key={m.id} style={{
          display: "flex", alignItems: "center", gap: 10, padding: "10px 8px",
          borderBottom: "1px solid rgba(255,255,255,0.06)",
        }}>
          <div style={{ color: MUTED, fontSize: 12, width: 24 }}>{i + 1}.</div>
          <div style={{ flex: 1, color: TEXT, fontSize: 13, fontWeight: 700 }}>
            {m.display_name || m.username}
          </div>
          <div style={{ color: "#FFD700", fontSize: 13, fontWeight: 900, display: "inline-flex", alignItems: "center", gap: 4 }}>
            <UiIcon slot="stat_ansehen" fallback="⚜" art={uiArt} size={14} />
            {(m.ansehen ?? 0).toLocaleString()}
          </div>
        </div>
      ))}
    </div>
  );
}

function fmtCountdown(iso: string, doneLabel: string): string {
  const ms = new Date(iso).getTime() - Date.now();
  if (ms <= 0) return doneLabel;
  const s = Math.floor(ms / 1000);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

export function TabTech() {
  const t = useTranslations("CrewModal");
  const [defs, setDefs] = useState<TechDef[]>([]);
  const [progress, setProgress] = useState<Record<string, number>>({});
  const [queue, setQueue] = useState<TechQueue[]>([]);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const load = useCallback(async () => {
    const sb = createClient();
    const { data } = await sb.rpc("get_crew_tech_state");
    if (!data) return;
    const j = data as { definitions: TechDef[]; progress: TechProgress[]; queue: TechQueue[] };
    setDefs(j.definitions);
    setProgress(Object.fromEntries(j.progress.map((p) => [p.tech_id, p.level])));
    setQueue(j.queue);
  }, []);
  useEffect(() => { void load(); }, [load]);

  async function start(techId: string) {
    setBusy(true); setMsg(null);
    const sb = createClient();
    const { data } = await sb.rpc("start_crew_tech", { p_tech_id: techId });
    const r = data as { ok: boolean; error?: string };
    if (!r?.ok) setMsg(t("techErrorPrefix", { msg: r?.error ?? t("techErrorUnknown") }));
    else setMsg(t("techStarted"));
    await load();
    setBusy(false);
  }

  const inQueue = queue[0];

  return (
    <div>
      {inQueue && (
        <div style={{
          padding: 12, borderRadius: 12, marginBottom: 12,
          background: `${PRIMARY}11`, border: `1px solid ${PRIMARY}55`,
          color: TEXT, fontSize: 13, fontWeight: 700,
        }}>
          {t("techInProgress", {
            name: defs.find((d) => d.id === inQueue.tech_id)?.name ?? "",
            level: inQueue.target_level,
            countdown: fmtCountdown(inQueue.ends_at, t("countdownDone")),
          })}
        </div>
      )}
      {msg && <div style={{ color: MUTED, fontSize: 12, marginBottom: 10 }}>{msg}</div>}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 10 }}>
        {defs.map((d) => {
          const lvl = progress[d.id] ?? 0;
          const next = lvl + 1;
          const maxed = lvl >= d.max_level;
          return (
            <div key={d.id} style={{
              padding: 12, borderRadius: 12,
              background: "rgba(255,255,255,0.04)",
              border: "1px solid rgba(255,255,255,0.08)",
            }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                <span style={{ color: TEXT, fontSize: 14, fontWeight: 900 }}>{d.name}</span>
                <span style={{ color: PRIMARY, fontSize: 12, fontWeight: 800 }}>{t("techLevelLabel", { level: lvl, max: d.max_level })}</span>
              </div>
              <div style={{ color: MUTED, fontSize: 11, marginBottom: 8 }}>{d.description}</div>
              {!maxed && (
                <button
                  disabled={busy || !!inQueue}
                  onClick={() => start(d.id)}
                  style={{
                    width: "100%", padding: "8px 12px", borderRadius: 10,
                    background: inQueue ? "rgba(255,255,255,0.06)" : `linear-gradient(135deg, ${PRIMARY}, #1ba89c)`,
                    border: "none", color: inQueue ? MUTED : BG, fontSize: 11, fontWeight: 900,
                    cursor: inQueue || busy ? "not-allowed" : "pointer",
                  }}
                >
                  {t("techResearchBtn", { level: next, cost: (d.cost_gold_per_level * next).toLocaleString() })}
                </button>
              )}
              {maxed && <div style={{ color: "#FFD700", fontSize: 11, fontWeight: 800 }}>{t("techMaxed")}</div>}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function TabKopfgelder({ crewId }: { crewId: string }) {
  const t = useTranslations("CrewModal");
  void crewId;
  const [list, setList] = useState<Bounty[] | null>(null);
  const [target, setTarget] = useState("");
  const [reward, setReward] = useState(500);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const load = useCallback(async () => {
    const sb = createClient();
    const { data } = await sb.rpc("get_crew_bounties");
    if (!data) return;
    setList((data as { bounties: Bounty[] }).bounties);
  }, []);
  useEffect(() => { void load(); }, [load]);

  async function post() {
    setBusy(true); setMsg(null);
    const sb = createClient();
    // Lookup target by username
    const { data: u } = await sb.from("users").select("id").eq("username", target).maybeSingle();
    if (!u) { setMsg(t("bountyNotFound")); setBusy(false); return; }
    const { data } = await sb.rpc("post_crew_bounty", { p_target_user_id: (u as { id: string }).id, p_reward_gold: reward, p_reason: reason || null });
    const r = data as { ok: boolean; error?: string };
    if (!r?.ok) setMsg(t("techErrorPrefix", { msg: r?.error ?? t("techErrorUnknown") }));
    else { setMsg(t("bountyPosted")); setTarget(""); setReason(""); }
    await load();
    setBusy(false);
  }

  return (
    <div>
      <div style={{
        padding: 12, borderRadius: 12, marginBottom: 14,
        background: "rgba(255,107,74,0.08)", border: "1px solid rgba(255,107,74,0.35)",
      }}>
        <div style={{ color: TEXT, fontSize: 13, fontWeight: 900, marginBottom: 8 }}>{t("bountyTitle")}</div>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          <input value={target} onChange={(e) => setTarget(e.target.value)} placeholder={t("bountyTargetPh")}
            style={{ flex: 1, minWidth: 140, padding: "8px 10px", borderRadius: 8, background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", color: TEXT, fontSize: 12 }} />
          <input type="number" value={reward} min={100} step={100} onChange={(e) => setReward(parseInt(e.target.value || "0"))}
            style={{ width: 110, padding: "8px 10px", borderRadius: 8, background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", color: TEXT, fontSize: 12 }} />
          <input value={reason} onChange={(e) => setReason(e.target.value)} placeholder={t("bountyReasonPh")}
            style={{ flex: 1, minWidth: 140, padding: "8px 10px", borderRadius: 8, background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", color: TEXT, fontSize: 12 }} />
          <button onClick={post} disabled={busy || !target || reward < 100}
            style={{ padding: "8px 14px", borderRadius: 8, background: "linear-gradient(135deg, #FF6B4A, #FF2D78)", border: "none", color: "#FFF", fontSize: 12, fontWeight: 900, cursor: busy ? "wait" : "pointer" }}>
            {t("bountyPostBtn")}
          </button>
        </div>
        {msg && <div style={{ color: MUTED, fontSize: 11, marginTop: 6 }}>{msg}</div>}
      </div>

      {!list && <div style={{ color: MUTED }}>{t("bountyLoading")}</div>}
      {list && list.length === 0 && <div style={{ color: MUTED }}>{t("bountyEmpty")}</div>}
      {list && list.map((b) => (
        <div key={b.id} style={{
          display: "flex", alignItems: "center", gap: 10, padding: "10px 8px",
          borderBottom: "1px solid rgba(255,255,255,0.06)",
        }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ color: TEXT, fontSize: 13, fontWeight: 800 }}>🎯 {b.target_name}</div>
            <div style={{ color: MUTED, fontSize: 11, marginTop: 2 }}>
              {t("bountyMeta", {
                by: b.posted_by_name,
                reason: b.reason ? t("bountyReasonInline", { reason: b.reason }) : "",
                countdown: fmtCountdown(b.expires_at, t("countdownDone")),
              })}
            </div>
          </div>
          <div style={{ color: "#FFD700", fontSize: 14, fontWeight: 900 }}>{t("bountyRewardSuffix", { gold: b.reward_gold.toLocaleString() })}</div>
        </div>
      ))}
    </div>
  );
}

export function TabShop() {
  const t = useTranslations("CrewModal");
  const [items, setItems] = useState<ShopItem[]>([]);
  const [crewGold, setCrewGold] = useState<number>(0);
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const load = useCallback(async () => {
    const sb = createClient();
    const { data } = await sb.rpc("get_crew_shop");
    if (!data) return;
    const j = data as { items: ShopItem[]; crew_gold: number };
    setItems(j.items); setCrewGold(j.crew_gold);
  }, []);
  useEffect(() => { void load(); }, [load]);

  async function buy(id: string) {
    setBusy(id); setMsg(null);
    const sb = createClient();
    const { data } = await sb.rpc("buy_crew_shop_item", { p_item_id: id });
    const r = data as { ok: boolean; error?: string };
    if (!r?.ok) setMsg(t("techErrorPrefix", { msg: r?.error ?? t("techErrorUnknown") }));
    else setMsg(t("shopBoughtMsg"));
    await load();
    setBusy(null);
  }

  return (
    <div>
      <div style={{ color: TEXT, fontSize: 13, fontWeight: 800, marginBottom: 10 }}>
        {t("shopGoldLabel", { gold: crewGold.toLocaleString() })}
      </div>
      {msg && <div style={{ color: MUTED, fontSize: 12, marginBottom: 8 }}>{msg}</div>}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 10 }}>
        {items.map((it) => {
          const ok = crewGold >= it.price_coins;
          return (
            <div key={it.id} style={{
              padding: 12, borderRadius: 12,
              background: "rgba(255,255,255,0.04)",
              border: "1px solid rgba(255,255,255,0.08)",
            }}>
              <div style={{ color: TEXT, fontSize: 13, fontWeight: 900 }}>{it.name}</div>
              <div style={{ color: MUTED, fontSize: 11, margin: "4px 0 8px" }}>{it.description}</div>
              <button
                disabled={!ok || busy === it.id}
                onClick={() => buy(it.id)}
                style={{
                  width: "100%", padding: "8px 10px", borderRadius: 10,
                  background: ok ? "linear-gradient(135deg, #FFD700, #FFA500)" : "rgba(255,255,255,0.06)",
                  border: "none", color: ok ? BG : MUTED, fontSize: 11, fontWeight: 900,
                  cursor: ok ? "pointer" : "not-allowed",
                }}
              >{t("shopBuyBtn", { price: it.price_coins.toLocaleString() })}</button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function TabEinstellungen() {
  const t = useTranslations("CrewModal");
  const [hudOn, setHudOn] = useState<boolean | null>(null);
  const [territoryColor, setTerritoryColor] = useState<string | null>(null);
  const [savingColor, setSavingColor] = useState(false);
  const [colorMsg, setColorMsg] = useState<string | null>(null);
  const [canEditColor, setCanEditColor] = useState(false);
  const [isOwner, setIsOwner] = useState(false);
  const [crewName, setCrewName] = useState("");
  const [crewTag, setCrewTag] = useState("");
  const [origName, setOrigName] = useState("");
  const [origTag, setOrigTag] = useState("");
  const [savingId, setSavingId] = useState(false);
  const [idMsg, setIdMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  useEffect(() => {
    const sb = createClient();
    void (async () => {
      const { data: { user } } = await sb.auth.getUser();
      if (!user) return;
      const { data: u } = await sb.from("users").select("show_map_action_hud").eq("id", user.id).maybeSingle();
      setHudOn((u as { show_map_action_hud?: boolean } | null)?.show_map_action_hud ?? true);

      const { data: cm } = await sb.from("crew_members").select("crew_id, role").eq("user_id", user.id).maybeSingle();
      const cmRow = cm as { crew_id?: string; role?: string } | null;
      if (cmRow?.crew_id) {
        setCanEditColor(cmRow.role === "leader" || cmRow.role === "officer" || cmRow.role === "admin");
        const { data: c } = await sb.from("crews").select("territory_color, name, tag, owner_id").eq("id", cmRow.crew_id).maybeSingle();
        const crew = c as { territory_color?: string | null; name: string; tag: string | null; owner_id: string } | null;
        setTerritoryColor(crew?.territory_color ?? "#22D1C3");
        setIsOwner(!!crew && crew.owner_id === user.id);
        if (crew) {
          setCrewName(crew.name);
          setOrigName(crew.name);
          setCrewTag(crew.tag ?? "");
          setOrigTag(crew.tag ?? "");
        }
      }
    })();
  }, []);

  async function saveIdentity() {
    setSavingId(true); setIdMsg(null);
    try {
      const body: { name?: string; tag?: string } = {};
      if (crewName.trim() !== origName) body.name = crewName.trim();
      if (crewTag.trim().toUpperCase() !== origTag) body.tag = crewTag.trim().toUpperCase();
      if (!body.name && !body.tag) { setSavingId(false); return; }
      const r = await fetch("/api/crew/rename", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const j = await r.json() as { ok?: boolean; error?: string; message?: string };
      if (!j.ok) { setIdMsg({ type: "err", text: j.message ?? j.error ?? t("settingsError") }); return; }
      if (body.name) setOrigName(body.name);
      if (body.tag) setOrigTag(body.tag);
      setIdMsg({ type: "ok", text: t("settingsSaved") });
      setTimeout(() => setIdMsg(null), 2500);
    } finally {
      setSavingId(false);
    }
  }

  async function toggle() {
    const next = !hudOn;
    setHudOn(next);
    const sb = createClient();
    const { data: { user } } = await sb.auth.getUser();
    if (!user) return;
    await sb.from("users").update({ show_map_action_hud: next }).eq("id", user.id);
  }

  async function saveColor(color: string) {
    setSavingColor(true);
    setColorMsg(null);
    const sb = createClient();
    const { data, error } = await sb.rpc("set_crew_territory_color", { p_color: color });
    setSavingColor(false);
    if (error || !(data as { ok?: boolean } | null)?.ok) {
      setColorMsg(error?.message || (data as { error?: string } | null)?.error || t("settingsError"));
      return;
    }
    setTerritoryColor(color);
    setColorMsg(t("settingsColorSaved"));
    // Map-Dashboard hört auf dieses Event und lädt das Turf neu (sonst wartet
    // der User auf den nächsten Polling-Tick, ~30s).
    window.dispatchEvent(new CustomEvent("ma365:refresh-turf"));
    setTimeout(() => setColorMsg(null), 2500);
  }

  // 12 Preset-Farben — kräftig, gut auf dunkler Map sichtbar
  const COLOR_PRESETS = [
    "#22D1C3", "#FF2D78", "#FFD700", "#FF6B4A",
    "#A855F7", "#5DDAF0", "#4ADE80", "#F472B6",
    "#FB923C", "#818CF8", "#34D399", "#F87171",
  ];

  const idDirty = crewName.trim() !== origName || crewTag.trim().toUpperCase() !== origTag;
  const tagOk = /^[A-Z0-9]{4}$/.test(crewTag.trim().toUpperCase());
  const nameOk = crewName.trim().length >= 2 && crewName.trim().length <= 12;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      {/* Crew-Identität (nur Owner) */}
      {isOwner && (
        <div>
          <div style={{ color: MUTED, fontSize: 11, fontWeight: 800, letterSpacing: 0.5, marginBottom: 8 }}>{t("settingsIdentityHeader")}</div>
          <div style={{ color: MUTED, fontSize: 11, marginBottom: 10 }}>{t("settingsIdentityHint")}</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 100px", gap: 8, marginBottom: 8 }}>
            <input
              value={crewName}
              onChange={(e) => setCrewName(e.target.value)}
              maxLength={12}
              placeholder={t("settingsCrewNamePh")}
              style={{ padding: "10px 12px", borderRadius: 10, background: "rgba(0,0,0,0.3)", color: "#fff", border: "1px solid rgba(255,255,255,0.1)", fontSize: 13 }}
            />
            <input
              value={crewTag}
              onChange={(e) => setCrewTag(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 4))}
              maxLength={4}
              placeholder={t("settingsCrewTagPh")}
              style={{ padding: "10px 12px", borderRadius: 10, background: "rgba(0,0,0,0.3)", color: "#FFD700", border: "1px solid rgba(255,255,255,0.1)", fontSize: 13, fontWeight: 800, letterSpacing: 1, textAlign: "center" }}
            />
          </div>
          <button
            disabled={savingId || !idDirty || !nameOk || !tagOk}
            onClick={() => void saveIdentity()}
            style={{ padding: "8px 14px", borderRadius: 8, background: "rgba(34,209,195,0.2)", color: PRIMARY, border: "1px solid rgba(34,209,195,0.4)", fontSize: 12, fontWeight: 800, cursor: savingId ? "wait" : "pointer", opacity: (idDirty && nameOk && tagOk) ? 1 : 0.5 }}
          >
            {savingId ? "…" : t("settingsSave")}
          </button>
          {idMsg && (
            <div style={{ marginTop: 8, fontSize: 11, fontWeight: 800, color: idMsg.type === "ok" ? "#4ade80" : "#FF6B4A" }}>
              {idMsg.text}
            </div>
          )}
        </div>
      )}

      {/* Crew-Farbe (nur Leader/Officer) */}
      <div>
        <div style={{ color: MUTED, fontSize: 11, fontWeight: 800, letterSpacing: 0.5, marginBottom: 8 }}>{t("settingsColorHeader")}</div>
        <div style={{ color: MUTED, fontSize: 11, marginBottom: 10, lineHeight: 1.4 }}>
          {t("settingsColorHint")}
          {!canEditColor && <span style={{ color: "#FF6B4A", fontWeight: 800 }}>{t("settingsColorLeaderOnly")}</span>}
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: 8 }}>
          {COLOR_PRESETS.map((c) => {
            const active = territoryColor === c;
            return (
              <button
                key={c}
                disabled={!canEditColor || savingColor}
                onClick={() => void saveColor(c)}
                style={{
                  aspectRatio: "1",
                  borderRadius: 10,
                  background: c,
                  border: active ? "3px solid #FFF" : "2px solid rgba(255,255,255,0.08)",
                  boxShadow: active ? `0 0 14px ${c}cc, inset 0 0 6px rgba(255,255,255,0.3)` : `0 2px 6px ${c}44`,
                  cursor: canEditColor && !savingColor ? "pointer" : "not-allowed",
                  opacity: canEditColor ? 1 : 0.5,
                  transition: "all 0.15s",
                }}
                title={c}
              />
            );
          })}
        </div>
        {colorMsg && (
          <div style={{ marginTop: 8, fontSize: 11, fontWeight: 800, color: colorMsg.startsWith("✓") ? "#4ade80" : "#FF6B4A" }}>
            {colorMsg}
          </div>
        )}
      </div>

      {/* Anzeige-Toggles */}
      <div>
        <div style={{ color: MUTED, fontSize: 11, fontWeight: 800, letterSpacing: 0.5, marginBottom: 8 }}>{t("settingsDisplayHeader")}</div>
        <button
          onClick={toggle}
          style={{
            width: "100%", padding: 14, borderRadius: 12,
            background: "rgba(255,255,255,0.04)",
            border: "1px solid rgba(255,255,255,0.08)",
            display: "flex", justifyContent: "space-between", alignItems: "center",
            cursor: "pointer",
          }}
        >
          <div style={{ textAlign: "left" }}>
            <div style={{ color: "#FFF", fontSize: 13, fontWeight: 800 }}>{t("settingsHudTitle")}</div>
            <div style={{ color: MUTED, fontSize: 11, marginTop: 2 }}>
              {t("settingsHudHint")}
            </div>
          </div>
          <div style={{
            width: 48, height: 26, borderRadius: 13, position: "relative",
            background: hudOn ? PRIMARY : "rgba(255,255,255,0.15)",
            transition: "background 0.2s",
          }}>
            <div style={{
              position: "absolute", top: 2, left: hudOn ? 24 : 2,
              width: 22, height: 22, borderRadius: 11, background: "#FFF",
              transition: "left 0.2s",
            }} />
          </div>
        </button>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────
   TAB: BAUWERKE — Crew-Strukturen (HQ/Mega/Repeater + geplante)
   ───────────────────────────────────────────────────────────────── */
type RepeaterRow = { id: string; kind: "hq" | "repeater" | "mega"; label: string | null; hp: number; max_hp: number; lat: number; lng: number };
type PlannedBuilding = { slot: string; fallback: string; nameKey: string; taglineKey: string; descKey: string };

const PLANNED_BUILDINGS: PlannedBuilding[] = [
  { slot: "building_siege_repeater", fallback: "🚀", nameKey: "plannedSiegeName",       taglineKey: "plannedSiegeTagline",       descKey: "plannedSiegeDesc" },
  { slot: "building_bunker",         fallback: "🛡", nameKey: "plannedBunkerName",      taglineKey: "plannedBunkerTagline",      descKey: "plannedBunkerDesc" },
  { slot: "building_blackmarket",    fallback: "💰", nameKey: "plannedBlackmarketName", taglineKey: "plannedBlackmarketTagline", descKey: "plannedBlackmarketDesc" },
  { slot: "building_hangout",        fallback: "🍻", nameKey: "plannedHangoutName",     taglineKey: "plannedHangoutTagline",     descKey: "plannedHangoutDesc" },
  { slot: "building_tunnel",         fallback: "🚇", nameKey: "plannedTunnelName",      taglineKey: "plannedTunnelTagline",      descKey: "plannedTunnelDesc" },
];

export type BuildingKind = "hq" | "mega" | "repeater" | "blackmarket" | "bunker" | "hangout" | "tunnel";
type BuildingRow = { id: string; kind: string; label: string | null; hp: number; max_hp: number; lat: number; lng: number };

export function TabBauwerke({ onPlaceBuilding }: { onPlaceBuilding?: (kind: BuildingKind) => void }) {
  const t = useTranslations("CrewModal");
  const [reps, setReps] = useState<RepeaterRow[] | null>(null);
  const [buildings, setBuildings] = useState<BuildingRow[] | null>(null);
  const uiArt = useUiIconArt();

  useEffect(() => {
    void (async () => {
      const sb = createClient();
      const { data: { user } } = await sb.auth.getUser();
      if (!user) { setReps([]); return; }
      const { data: cm } = await sb.from("crew_members").select("crew_id").eq("user_id", user.id).maybeSingle();
      const crewId = (cm as { crew_id?: string } | null)?.crew_id;
      if (!crewId) { setReps([]); return; }
      const [{ data: repData }, { data: bldData }] = await Promise.all([
        sb.from("crew_repeaters")
          .select("id, kind, label, hp, max_hp, lat, lng")
          .eq("crew_id", crewId)
          .is("destroyed_at", null)
          .order("kind", { ascending: false })
          .order("created_at", { ascending: true }),
        sb.from("crew_buildings")
          .select("id, kind, label, hp, max_hp, lat, lng")
          .eq("crew_id", crewId)
          .is("destroyed_at", null)
          .order("created_at", { ascending: true }),
      ]);
      setReps((repData as RepeaterRow[] | null) ?? []);
      setBuildings((bldData as BuildingRow[] | null) ?? []);
    })();
  }, []);

  const grouped = {
    hq:       reps?.filter((r) => r.kind === "hq") ?? [],
    mega:     reps?.filter((r) => r.kind === "mega") ?? [],
    repeater: reps?.filter((r) => r.kind === "repeater") ?? [],
  };

  function flyTo(lat: number, lng: number) {
    window.dispatchEvent(new CustomEvent("ma365:fly-to-coords", { detail: { lat, lng, zoom: 17 } }));
  }

  if (reps === null || buildings === null) return <div style={{ color: MUTED }}>{t("buildingsLoading")}</div>;
  const groupedBld = {
    blackmarket: buildings.filter((b) => b.kind === "blackmarket"),
    bunker:      buildings.filter((b) => b.kind === "bunker"),
    hangout:     buildings.filter((b) => b.kind === "hangout"),
    tunnel:      buildings.filter((b) => b.kind === "tunnel"),
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      {/* Existierende Bauwerke */}
      <BuildingGroup
        slot="repeater_hq" fallback="🏛"
        name={t("buildingHq")}
        meta={t("buildingHqMeta", { count: grouped.hq.length })}
        items={grouped.hq}
        onItemClick={flyTo}
        onErrichten={grouped.hq.length === 0 ? () => onPlaceBuilding?.("hq") : undefined}
        uiArt={uiArt}
      />
      <BuildingGroup
        slot="repeater_mega" fallback="📡"
        name={t("buildingMega")}
        meta={t("buildingMegaMeta", { count: grouped.mega.length })}
        items={grouped.mega}
        onItemClick={flyTo}
        onErrichten={() => onPlaceBuilding?.("mega")}
        uiArt={uiArt}
      />
      <BuildingGroup
        slot="repeater_normal" fallback="📶"
        name={t("buildingRepeater")}
        meta={t("buildingRepeaterMeta", { count: grouped.repeater.length })}
        items={grouped.repeater}
        onItemClick={flyTo}
        onErrichten={() => onPlaceBuilding?.("repeater")}
        uiArt={uiArt}
      />

      <div style={{ marginTop: 8 }}>
        <div style={{ color: MUTED, fontSize: 11, fontWeight: 800, letterSpacing: 0.5, marginBottom: 8 }}>
          {t("buildingsAlphaHeader")}
        </div>
      </div>

      <BuildingGroup
        slot="building_blackmarket" fallback="💰"
        name={t("buildingBlackmarket")}
        meta={t("buildingBlackmarketMeta", { count: groupedBld.blackmarket.length })}
        items={groupedBld.blackmarket}
        onItemClick={flyTo}
        onErrichten={groupedBld.blackmarket.length === 0 ? () => onPlaceBuilding?.("blackmarket") : undefined}
        uiArt={uiArt}
      />
      <BuildingGroup
        slot="building_bunker" fallback="🛡"
        name={t("buildingBunker")}
        meta={t("buildingBunkerMeta", { count: groupedBld.bunker.length })}
        items={groupedBld.bunker}
        onItemClick={flyTo}
        onErrichten={groupedBld.bunker.length < 6 ? () => onPlaceBuilding?.("bunker") : undefined}
        uiArt={uiArt}
      />
      <BuildingGroup
        slot="building_hangout" fallback="🍻"
        name={t("buildingHangout")}
        meta={t("buildingHangoutMeta", { count: groupedBld.hangout.length })}
        items={groupedBld.hangout}
        onItemClick={flyTo}
        onErrichten={groupedBld.hangout.length < 3 ? () => onPlaceBuilding?.("hangout") : undefined}
        uiArt={uiArt}
      />
      <BuildingGroup
        slot="building_tunnel" fallback="🚇"
        name={t("buildingTunnel")}
        meta={t("buildingTunnelMeta", { count: groupedBld.tunnel.length })}
        items={groupedBld.tunnel}
        onItemClick={flyTo}
        onErrichten={groupedBld.tunnel.length < 10 ? () => onPlaceBuilding?.("tunnel") : undefined}
        uiArt={uiArt}
      />

      {/* Belagerungs-Repeater = Upgrade, kein Place-Flow — Hinweis als PlannedRow */}
      <div style={{ marginTop: 12 }}>
        <PlannedRow building={PLANNED_BUILDINGS[0]} uiArt={uiArt} />
      </div>
    </div>
  );
}

function BuildingGroup({ slot, fallback, name, meta, items, onItemClick, onErrichten, uiArt }: {
  slot: string; fallback: string; name: string; meta: string;
  items: Array<{ id: string; label: string | null; hp: number; max_hp: number; lat: number; lng: number }>;
  onItemClick: (lat: number, lng: number) => void;
  onErrichten?: () => void;
  uiArt: ReturnType<typeof useUiIconArt>;
}) {
  const t = useTranslations("CrewModal");
  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 6 }}>
        <UiIcon slot={slot} fallback={fallback} art={uiArt} size={48} />
        <div style={{ flex: 1 }}>
          <div style={{ color: TEXT, fontSize: 14, fontWeight: 800 }}>{name}</div>
          <div style={{ color: MUTED, fontSize: 11 }}>{meta}</div>
        </div>
        {onErrichten && (
          <button
            onClick={onErrichten}
            style={{
              padding: "6px 12px", borderRadius: 8,
              background: `linear-gradient(135deg, ${PRIMARY}, #1ba89c)`,
              border: "none", color: BG,
              fontSize: 11, fontWeight: 900, letterSpacing: 0.5,
              cursor: "pointer",
              boxShadow: `0 2px 8px ${PRIMARY}66`,
            }}
          >
            {t("buildErectBtn")}
          </button>
        )}
      </div>
      {items.length === 0 ? (
        <div style={{ color: MUTED, fontSize: 11, padding: "10px 12px",
          borderRadius: 8, background: "rgba(255,255,255,0.03)",
          border: "1px dashed rgba(255,255,255,0.1)", textAlign: "center" }}>
          {t("buildEmpty")}
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          {items.map((r) => {
            const hpPct = Math.max(0, Math.min(100, (r.hp / Math.max(r.max_hp, 1)) * 100));
            return (
              <button
                key={r.id}
                onClick={() => onItemClick(r.lat, r.lng)}
                style={{
                  display: "flex", alignItems: "center", gap: 10,
                  padding: "8px 10px", borderRadius: 8,
                  background: "rgba(255,255,255,0.04)",
                  border: "1px solid rgba(255,255,255,0.06)",
                  cursor: "pointer", textAlign: "left",
                }}
              >
                <div style={{ flex: 1 }}>
                  <div style={{ color: TEXT, fontSize: 12, fontWeight: 700 }}>
                    {r.label || name}
                  </div>
                  <div style={{ color: MUTED, fontSize: 10 }}>
                    {t("buildHpLabel", { hp: r.hp.toLocaleString(), max: r.max_hp.toLocaleString() })}
                  </div>
                </div>
                <div style={{ width: 50, height: 4, borderRadius: 2, background: "rgba(255,255,255,0.08)", overflow: "hidden" }}>
                  <div style={{ width: `${hpPct}%`, height: "100%",
                    background: hpPct > 50 ? "#22D1C3" : hpPct > 20 ? "#FFD700" : "#FF2D78" }} />
                </div>
                <div style={{ color: MUTED, fontSize: 10, fontWeight: 700 }}>📍</div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function PlannedRow({ building, uiArt }: { building: PlannedBuilding; uiArt: ReturnType<typeof useUiIconArt> }) {
  const t = useTranslations("CrewModal");
  const [open, setOpen] = useState(false);
  return (
    <div style={{
      borderRadius: 10,
      background: "rgba(255,255,255,0.025)",
      border: "1px dashed rgba(255,255,255,0.1)",
      overflow: "hidden",
    }}>
      <button
        onClick={() => setOpen(!open)}
        style={{
          width: "100%", padding: "10px 12px",
          display: "flex", alignItems: "center", gap: 10,
          background: "transparent", border: "none", cursor: "pointer", textAlign: "left",
        }}
      >
        <UiIcon slot={building.slot} fallback={building.fallback} art={uiArt} size={42} />
        <div style={{ flex: 1, opacity: 0.7 }}>
          <div style={{ color: TEXT, fontSize: 13, fontWeight: 700 }}>{t(building.nameKey)}</div>
          <div style={{ color: MUTED, fontSize: 10 }}>{t(building.taglineKey)}</div>
        </div>
        <span style={{ color: "#FFD700", fontSize: 10, fontWeight: 800,
          padding: "2px 6px", borderRadius: 6,
          background: "rgba(255,215,0,0.12)", border: "1px solid rgba(255,215,0,0.3)",
        }}>{t("buildPlanned")}</span>
        <span style={{ color: MUTED, fontSize: 12 }}>{open ? "▲" : "▼"}</span>
      </button>
      {open && (
        <div style={{ padding: "0 12px 12px 48px", color: MUTED, fontSize: 11, lineHeight: 1.5 }}>
          {t(building.descKey)}
        </div>
      )}
    </div>
  );
}

// ───────────────────────── HILFE-TAB (Crew-Help) ─────────────────────────────
function TabHilfe() {
  type HelpReq = { id: string; user_id: string; user_name: string; job_kind: string; job_label: string; helps_received: number; max_helps: number; expires_at: string; created_at: string };
  const [list, setList] = useState<HelpReq[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const load = useCallback(async () => {
    const r = await fetch("/api/crew/help", { cache: "no-store" });
    const j = await r.json() as { ok?: boolean; requests?: HelpReq[]; error?: string } | HelpReq[];
    if (Array.isArray(j)) setList(j);
    else setList(j?.requests ?? []);
  }, []);
  useEffect(() => { void load(); const id = setInterval(load, 15_000); return () => clearInterval(id); }, [load]);

  async function give(reqId: string) {
    setBusy(reqId); setMsg(null);
    try {
      const r = await fetch("/api/crew/help", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "give", request_id: reqId }),
      });
      const j = await r.json() as { ok?: boolean; error?: string; reduced_seconds?: number };
      if (j.ok) {
        setMsg(`✓ -${j.reduced_seconds ?? 0}s · danke!`);
        await load();
      } else if (j.error === "cooldown_active") setMsg("⏳ 30s Cooldown.");
      else if (j.error === "max_helps_reached") setMsg("ℹ Schon voll.");
      else if (j.error === "self_help_not_allowed") setMsg("✋ Eigene Aufträge nicht.");
      else setMsg(`⚠ ${j.error ?? "Fehler"}`);
    } finally { setBusy(null); }
  }

  if (!list) return <div style={{ color: MUTED, fontSize: 12 }}>Lade Hilfe-Anfragen…</div>;
  return (
    <div>
      <div style={{ background: "rgba(34,209,195,0.08)", border: "1px solid rgba(34,209,195,0.3)", borderRadius: 12, padding: 12, marginBottom: 12 }}>
        <div style={{ color: PRIMARY, fontSize: 12, fontWeight: 900, marginBottom: 4 }}>🤝 Crew-Hilfe</div>
        <div style={{ color: MUTED, fontSize: 11, lineHeight: 1.5 }}>
          Hilf Crew-Mitgliedern und reduziere ihre Bauzeit/Forschung um 1% pro Klick. <b style={{ color: TEXT }}>30s Cooldown</b> zwischen Klicks.
        </div>
      </div>
      {msg && <div style={{ color: msg.startsWith("✓") ? "#4ade80" : "#FF6B9A", fontSize: 12, fontWeight: 700, marginBottom: 8 }}>{msg}</div>}
      {list.length === 0 ? (
        <div style={{ color: MUTED, fontSize: 12, textAlign: "center", padding: 24 }}>
          Keine offenen Hilfe-Anfragen. Wenn du baust/forschst kannst du selbst eine senden — passiert automatisch.
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {list.map((r) => {
            const pct = Math.min(100, (r.helps_received / Math.max(1, r.max_helps)) * 100);
            return (
              <div key={r.id} style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 12, padding: 12 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                  <div style={{ color: TEXT, fontSize: 13, fontWeight: 800 }}>{r.user_name}</div>
                  <div style={{ color: MUTED, fontSize: 10 }}>{r.job_label || r.job_kind}</div>
                </div>
                <div style={{ height: 6, borderRadius: 4, background: "rgba(0,0,0,0.4)", overflow: "hidden", marginBottom: 6 }}>
                  <div style={{ height: "100%", width: `${pct}%`, background: PRIMARY }} />
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ color: MUTED, fontSize: 10 }}>{r.helps_received}/{r.max_helps} Hilfen</span>
                  <button onClick={() => void give(r.id)} disabled={busy === r.id}
                    style={{ background: PRIMARY, color: BG, fontSize: 11, fontWeight: 900, padding: "6px 12px", borderRadius: 8, border: "none", cursor: "pointer" }}>
                    {busy === r.id ? "…" : "HELFEN"}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ───────────────────────── DIPLOMATIE-TAB ─────────────────────────────
function TabDiplomatie({ crewId }: { crewId: string }) {
  type Dipl = { other_crew_id: string; other_crew_name: string; other_crew_tag: string; status: "nap" | "allied" | "enemy"; expires_at: string | null };
  const [list, setList] = useState<Dipl[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [allCrews, setAllCrews] = useState<Array<{ id: string; name: string; tag: string }>>([]);
  const [picker, setPicker] = useState<{ crewId: string; status: string }>({ crewId: "", status: "nap" });

  const load = useCallback(async () => {
    const r = await fetch(`/api/crew/diplomacy?crew_id=${crewId}`, { cache: "no-store" });
    const j = await r.json() as { ok?: boolean; diplomacy?: Dipl[] };
    setList(j.diplomacy ?? []);
  }, [crewId]);
  useEffect(() => { void load(); }, [load]);
  useEffect(() => {
    const sb = createClient();
    void (async () => {
      const { data } = await sb.from("crews").select("id, name, tag").neq("id", crewId).limit(50);
      setAllCrews((data as Array<{ id: string; name: string; tag: string }>) ?? []);
    })();
  }, [crewId]);

  async function setStatus(otherCrew: string, status: string) {
    setBusy(otherCrew); setMsg(null);
    try {
      const r = await fetch("/api/crew/diplomacy", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ other_crew: otherCrew, status, duration_hours: status === "nap" ? 168 : null }),
      });
      const j = await r.json() as { ok?: boolean; error?: string };
      if (j.ok) { setMsg("✓ Aktualisiert."); await load(); }
      else if (j.error === "not_leader") setMsg("⚠ Nur Crew-Leader darf das.");
      else setMsg(`⚠ ${j.error ?? "Fehler"}`);
    } finally { setBusy(null); }
  }

  const STATUS_STYLE: Record<string, { color: string; bg: string; label: string }> = {
    nap: { color: "#FFD700", bg: "rgba(255,215,0,0.15)", label: "NAP" },
    allied: { color: "#4ade80", bg: "rgba(74,222,128,0.15)", label: "VERBÜNDET" },
    enemy: { color: "#FF2D78", bg: "rgba(255,45,120,0.15)", label: "FEIND" },
  };

  if (!list) return <div style={{ color: MUTED, fontSize: 12 }}>Lade Diplomatie…</div>;
  return (
    <div>
      <div style={{ background: "rgba(34,209,195,0.08)", border: "1px solid rgba(34,209,195,0.3)", borderRadius: 12, padding: 12, marginBottom: 12 }}>
        <div style={{ color: PRIMARY, fontSize: 12, fontWeight: 900, marginBottom: 4 }}>🤝 Diplomatie</div>
        <div style={{ color: MUTED, fontSize: 11, lineHeight: 1.5 }}>
          Setze NAP (Nicht-Angriffs-Pakt, 7 Tage), Bündnisse (kein Schaden zwischen Crews) oder erkläre offiziell Krieg. <b style={{ color: TEXT }}>Nur Crew-Leader.</b>
        </div>
      </div>
      {msg && <div style={{ color: msg.startsWith("✓") ? "#4ade80" : "#FF6B9A", fontSize: 12, fontWeight: 700, marginBottom: 8 }}>{msg}</div>}

      {/* Liste */}
      {list.length === 0 ? (
        <div style={{ color: MUTED, fontSize: 12, textAlign: "center", padding: 16 }}>Noch keine Diplomatie-Beziehungen.</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 16 }}>
          {list.map((d) => {
            const st = STATUS_STYLE[d.status] ?? { color: MUTED, bg: "transparent", label: d.status };
            return (
              <div key={d.other_crew_id} style={{ display: "flex", alignItems: "center", gap: 10, padding: 10, borderRadius: 10, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}>
                <div style={{ flex: 1, color: TEXT, fontSize: 13, fontWeight: 700 }}>[{d.other_crew_tag}] {d.other_crew_name}</div>
                <span style={{ color: st.color, background: st.bg, padding: "3px 8px", borderRadius: 6, fontSize: 10, fontWeight: 900 }}>{st.label}</span>
                <button onClick={() => void setStatus(d.other_crew_id, "nap")} disabled={busy === d.other_crew_id}
                  style={{ background: "rgba(255,215,0,0.15)", color: "#FFD700", border: "1px solid rgba(255,215,0,0.4)", borderRadius: 6, padding: "4px 8px", fontSize: 9, fontWeight: 800, cursor: "pointer" }}>NAP</button>
                <button onClick={() => void setStatus(d.other_crew_id, "allied")} disabled={busy === d.other_crew_id}
                  style={{ background: "rgba(74,222,128,0.15)", color: "#4ade80", border: "1px solid rgba(74,222,128,0.4)", borderRadius: 6, padding: "4px 8px", fontSize: 9, fontWeight: 800, cursor: "pointer" }}>Verb.</button>
                <button onClick={() => void setStatus(d.other_crew_id, "enemy")} disabled={busy === d.other_crew_id}
                  style={{ background: "rgba(255,45,120,0.15)", color: "#FF2D78", border: "1px solid rgba(255,45,120,0.4)", borderRadius: 6, padding: "4px 8px", fontSize: 9, fontWeight: 800, cursor: "pointer" }}>Feind</button>
              </div>
            );
          })}
        </div>
      )}

      {/* Neuer Eintrag */}
      <div style={{ background: "rgba(0,0,0,0.3)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 12, padding: 12 }}>
        <div style={{ color: TEXT, fontSize: 12, fontWeight: 800, marginBottom: 8 }}>Neue Beziehung</div>
        <div style={{ display: "flex", gap: 6 }}>
          <select value={picker.crewId} onChange={(e) => setPicker({ ...picker, crewId: e.target.value })}
            style={{ flex: 1, background: "rgba(0,0,0,0.5)", color: TEXT, border: "1px solid rgba(255,255,255,0.15)", borderRadius: 6, padding: "6px 10px", fontSize: 11 }}>
            <option value="">— Crew wählen —</option>
            {allCrews.map((c) => <option key={c.id} value={c.id}>[{c.tag}] {c.name}</option>)}
          </select>
          <select value={picker.status} onChange={(e) => setPicker({ ...picker, status: e.target.value })}
            style={{ background: "rgba(0,0,0,0.5)", color: TEXT, border: "1px solid rgba(255,255,255,0.15)", borderRadius: 6, padding: "6px 10px", fontSize: 11 }}>
            <option value="nap">NAP</option>
            <option value="allied">Verbündet</option>
            <option value="enemy">Feind</option>
          </select>
          <button onClick={() => picker.crewId && void setStatus(picker.crewId, picker.status)} disabled={!picker.crewId || busy === picker.crewId}
            style={{ background: PRIMARY, color: BG, border: "none", borderRadius: 6, padding: "6px 14px", fontSize: 11, fontWeight: 900, cursor: "pointer" }}>
            Setzen
          </button>
        </div>
      </div>
    </div>
  );
}

// ───────────────────────── NACHRICHTEN-TAB (Crew-Mail) ─────────────────────────────
function TabNachrichten() {
  type Mail = { id: string; sender_id: string; kind: string; title: string; body: string; created_at: string };
  const [list, setList] = useState<Mail[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [composer, setComposer] = useState<{ open: boolean; kind: string; title: string; body: string }>({ open: false, kind: "announcement", title: "", body: "" });

  const load = useCallback(async () => {
    const r = await fetch("/api/crew/mail", { cache: "no-store" });
    const j = await r.json() as { ok?: boolean; mails?: Mail[] };
    setList(j.mails ?? []);
  }, []);
  useEffect(() => { void load(); }, [load]);

  async function send() {
    if (!composer.title.trim() || !composer.body.trim()) return;
    setBusy(true); setMsg(null);
    try {
      const r = await fetch("/api/crew/mail", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ kind: composer.kind, title: composer.title, body: composer.body }),
      });
      const j = await r.json() as { ok?: boolean; error?: string };
      if (j.ok) {
        setMsg("✓ Versendet.");
        setComposer({ open: false, kind: "announcement", title: "", body: "" });
        await load();
      } else setMsg(`⚠ ${j.error ?? "Fehler"}`);
    } finally { setBusy(false); }
  }

  const KIND_LABEL: Record<string, string> = {
    announcement: "📢 Ankündigung",
    war: "⚔ Krieg",
    event: "🎉 Event",
    raid: "👹 Raid",
  };

  if (!list) return <div style={{ color: MUTED, fontSize: 12 }}>Lade Nachrichten…</div>;
  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <div style={{ color: TEXT, fontSize: 13, fontWeight: 800 }}>✉ Crew-Mail ({list.length})</div>
        <button onClick={() => setComposer((s) => ({ ...s, open: !s.open }))}
          style={{ background: PRIMARY, color: BG, border: "none", borderRadius: 8, padding: "6px 14px", fontSize: 11, fontWeight: 900, cursor: "pointer" }}>
          {composer.open ? "Abbrechen" : "+ Schreiben"}
        </button>
      </div>
      {msg && <div style={{ color: msg.startsWith("✓") ? "#4ade80" : "#FF6B9A", fontSize: 12, fontWeight: 700, marginBottom: 8 }}>{msg}</div>}

      {composer.open && (
        <div style={{ background: "rgba(0,0,0,0.3)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 12, padding: 12, marginBottom: 12 }}>
          <div style={{ display: "flex", gap: 6, marginBottom: 8 }}>
            <select value={composer.kind} onChange={(e) => setComposer({ ...composer, kind: e.target.value })}
              style={{ background: "rgba(0,0,0,0.5)", color: TEXT, border: "1px solid rgba(255,255,255,0.15)", borderRadius: 6, padding: "6px 10px", fontSize: 11 }}>
              {Object.entries(KIND_LABEL).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
            </select>
            <input value={composer.title} onChange={(e) => setComposer({ ...composer, title: e.target.value })}
              placeholder="Titel"
              style={{ flex: 1, background: "rgba(0,0,0,0.5)", color: TEXT, border: "1px solid rgba(255,255,255,0.15)", borderRadius: 6, padding: "6px 10px", fontSize: 11 }} />
          </div>
          <textarea value={composer.body} onChange={(e) => setComposer({ ...composer, body: e.target.value })}
            placeholder="Nachricht…" rows={4}
            style={{ width: "100%", background: "rgba(0,0,0,0.5)", color: TEXT, border: "1px solid rgba(255,255,255,0.15)", borderRadius: 6, padding: "8px 10px", fontSize: 12, resize: "vertical", marginBottom: 8 }} />
          <button onClick={() => void send()} disabled={busy || !composer.title.trim() || !composer.body.trim()}
            style={{ background: PRIMARY, color: BG, border: "none", borderRadius: 8, padding: "8px 16px", fontSize: 12, fontWeight: 900, cursor: "pointer", opacity: busy ? 0.5 : 1 }}>
            {busy ? "…" : "Senden"}
          </button>
        </div>
      )}

      {list.length === 0 ? (
        <div style={{ color: MUTED, fontSize: 12, textAlign: "center", padding: 24 }}>Noch keine Nachrichten.</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {list.map((m) => (
            <div key={m.id} style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 12, padding: 12 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                <span style={{ color: TEXT, fontSize: 13, fontWeight: 800 }}>{KIND_LABEL[m.kind] ?? m.kind} · {m.title}</span>
                <span style={{ color: MUTED, fontSize: 10 }}>{new Date(m.created_at).toLocaleString("de-DE")}</span>
              </div>
              <div style={{ color: MUTED, fontSize: 12, lineHeight: 1.5, whiteSpace: "pre-wrap" }}>{m.body}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
