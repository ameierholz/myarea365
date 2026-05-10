"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { ResourceIcon, useResourceArt } from "@/components/resource-icon";

/**
 * Lokaler Entity-Icon-Helper. Inlined statt aus resource-icon.tsx importiert,
 * damit der Forschungs-Tab nicht an die HMR-Chunk-Kette von resource-icon
 * gekoppelt ist (Turbopack hat new exports gelegentlich nicht hot-propagiert).
 */
function Art({
  imageUrl, videoUrl, fallback, size, alt,
}: {
  imageUrl?: string | null;
  videoUrl?: string | null;
  fallback: string;
  size: number;
  alt?: string;
}) {
  const baseStyle: React.CSSProperties = {
    width: size, height: size, objectFit: "contain",
    display: "inline-block", verticalAlign: "middle",
    filter: "url(#ma365-chroma-black)",
  };
  if (videoUrl) return <video src={videoUrl} autoPlay loop muted playsInline style={baseStyle} />;
  if (imageUrl) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={imageUrl} alt={alt ?? ""} style={baseStyle} />;
  }
  return <span style={{ fontSize: size, lineHeight: 1, display: "inline-block", verticalAlign: "middle" }}>{fallback}</span>;
}

type Def = {
  id: string; name: string; emoji: string; description: string; branch: string; tier: number;
  prereq_id: string | null; max_level: number;
  base_cost_wood: number; base_cost_stone: number; base_cost_gold: number; base_cost_mana: number;
  base_time_minutes: number;
  buildtime_growth?: number;
  effect_key: string | null; effect_per_level: number;
  required_burg_level: number;
  image_url?: string | null; video_url?: string | null;
};
type Progress = { research_id: string; level: number };
type QueueRow = { id: string; research_id: string; target_level: number; ends_at: string };
type Data = { ok: boolean; definitions: Def[]; progress: Progress[]; queue: QueueRow[] };

const RES_FB = {
  wood:  "⚙️", stone: "🔩", gold: "💸", mana: "📡",
} as const;

function fmtMin(m: number): string {
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  return m % 60 ? `${h}h${m % 60}m` : `${h}h`;
}

function compactNum(n: number): string {
  if (n < 1000) return n.toString();
  if (n < 1_000_000) return (n / 1000).toFixed(n < 10_000 ? 1 : 0) + "k";
  return (n / 1_000_000).toFixed(1) + "M";
}

/**
 * Liefert einen lesbaren Label für einen effect_key, damit der Spieler
 * sieht, WAS die Forschung tatsächlich verbessert. Fallback: rohe Key-Form.
 */
function effectLabel(key: string | null | undefined): string {
  if (!key) return "";
  // unlock_* — Truppen-Tier oder Special
  if (key.startsWith("unlock_")) {
    const m = /^unlock_(infantry|cavalry|marksman|siege)_t([2-5])$/.exec(key);
    if (m) {
      const type = ({ infantry: "Türsteher", cavalry: "Kuriere",
                      marksman: "Schütze", siege: "Brecher" } as const)[m[1] as "infantry"];
      return `${type} T${m[2]}`;
    }
    if (key === "unlock_gem_drops")     return "Diamanten-Drops";
    if (key === "unlock_troop_crit")    return "Truppen-Krit";
    if (key === "unlock_march_slot_4")  return "4. Marsch-Slot";
    if (key === "unlock_march_slot_5")  return "5. Marsch-Slot";
    return key.replace("unlock_", "").replace(/_/g, " ");
  }
  // Genormte Effekt-Labels
  const map: Record<string, string> = {
    wood_production_pct:        "Tech-Schrott-Produktion",
    stone_production_pct:       "Komponenten-Produktion",
    gold_production_pct:        "Krypto-Produktion",
    mana_production_pct:        "Bandbreite-Produktion",
    all_resources_pct:          "Alle Ressourcen",
    storage_cap_pct:            "Lager-Schutz",
    gather_speed_pct:           "Sammel-Tempo",
    gather_yield_pct:           "Sammel-Ausbeute",
    crew_donate_bonus_pct:      "Crew-Spende-Bonus",
    build_time_pct:             "Bauzeit",
    training_speed_pct:         "Trainings-Tempo",
    research_speed_pct:         "Forschungs-Tempo",
    march_speed_pct:            "Marsch-Tempo",
    march_capacity_pct:         "Marsch-Kapazität",
    march_atk_pct:              "Marsch-Angriff",
    rally_cap_pct:              "Sammelpunkt-Kapazität",
    rally_atk_pct:              "Sammelpunkt-Angriff",
    scout_speed_pct:            "Späher-Tempo",
    enemy_def_reduction_pct:    "Feind-Defense reduziert",
    crit_chance_pct:            "Krit-Chance",
    crit_dmg_pct:               "Krit-Schaden",
    fire_dmg_pct:               "Brand-Schaden",
    troop_revive_pct:           "Truppen-Wiederbelebung",
    troop_hp_pct:               "Truppen-HP",
    troop_heal_pct:             "Heil-Tempo",
    wall_hp_pct:                "Mauer-Lebenspunkte",
    wall_def_pct:               "Mauer-Verteidigung",
    watchtower_range_pct:       "Wachturm-Reichweite",
    garrison_def_pct:           "Garnison-Verteidigung",
    garrison_atk_pct:           "Garnison-Angriff",
    garrison_cap_pct:           "Garnison-Kapazität",
    reinforce_speed_pct:        "Verstärkungs-Tempo",
    counter_attack_pct:         "Konter-Schlag",
    trap_dmg_pct:               "Fallen-Schaden",
    infantry_train_speed_pct:   "Türsteher-Trainings-Tempo",
    cavalry_train_speed_pct:    "Kurier-Trainings-Tempo",
    marksman_train_speed_pct:   "Schütze-Trainings-Tempo",
    siege_train_speed_pct:      "Brecher-Trainings-Tempo",
    infantry_atk_pct:           "Türsteher-Angriff",
    cavalry_atk_pct:            "Kurier-Angriff",
    marksman_atk_pct:           "Schütze-Angriff",
    siege_atk_pct:              "Brecher-Angriff",
    infantry_def_pct:           "Türsteher-Verteidigung",
    cavalry_def_pct:            "Kurier-Verteidigung",
    marksman_def_pct:           "Schütze-Verteidigung",
    siege_def_pct:              "Brecher-Verteidigung",
    guardian_xp_pct:            "Wächter-Erfahrung",
    guardian_atk_pct:           "Wächter-Angriff",
    guardian_def_pct:           "Wächter-Verteidigung",
    guardian_hp_pct:            "Wächter-Lebenspunkte",
    guardian_skill_dmg_pct:     "Wächter-Fertigkeit-Schaden",
    guardian_skill_cooldown_pct:"Wächter-Fertigkeit-Abkühlung",
    guardian_active_dmg_pct:    "Aktiv-Fertigkeit-Schaden",
    guardian_passive_buff_pct:  "Passiv-Fertigkeit-Stärke",
    crew_atk_when_lead_pct:     "Crew-Angriff (als Anführer)",
  };
  return map[key] ?? key.replace(/_pct$/, "").replace(/_/g, " ");
}

/** Reduktions-Effekte: Anzeige als "-X%". Rest: "+X%". */
function isReductionKey(key: string | null | undefined): boolean {
  if (!key) return false;
  return key === "build_time_pct"
      || key === "guardian_skill_cooldown_pct"
      || key === "enemy_def_reduction_pct";
}

/** Formatiert einen Effekt-Wert als Prozentsatz mit korrektem Vorzeichen. */
function fmtEffect(key: string, value: number): string {
  if (value === 0) return "—";
  const pct = (value * 100).toFixed(value < 0.005 ? 1 : 0);
  if (isReductionKey(key)) return `−${pct}%`;
  return `+${pct}%`;
}

/**
 * Topologische Sortierung innerhalb eines Tiers: Vorgänger zuerst, dann
 * direkt seine Nachfolger (DFS). Items ohne Vorgänger im Tier werden als
 * "Roots" alphabetisch geordnet, dann werden ihre Children rekursiv eingehängt.
 * Verwaiste Ketten (Vorgänger in anderem Tier) landen am Ende.
 */
function topoSortChain(items: Def[]): Def[] {
  const idSet = new Set(items.map((i) => i.id));
  const byId = new Map(items.map((i) => [i.id, i]));
  const childrenOf = new Map<string, Def[]>();
  for (const i of items) {
    if (!i.prereq_id) continue;
    if (!idSet.has(i.prereq_id)) continue;
    const arr = childrenOf.get(i.prereq_id) ?? [];
    arr.push(i);
    childrenOf.set(i.prereq_id, arr);
  }
  for (const [k, arr] of childrenOf) {
    arr.sort((a, b) => a.name.localeCompare(b.name));
    childrenOf.set(k, arr);
  }
  const visited = new Set<string>();
  const out: Def[] = [];
  const visit = (item: Def) => {
    if (visited.has(item.id)) return;
    visited.add(item.id);
    out.push(item);
    for (const c of childrenOf.get(item.id) ?? []) visit(c);
  };
  // Roots: kein Vorgänger ODER Vorgänger in einem anderen Tier
  const roots = items
    .filter((i) => !i.prereq_id || !idSet.has(i.prereq_id))
    .sort((a, b) => a.name.localeCompare(b.name));
  for (const r of roots) visit(r);
  // Sicherheitsnetz: falls Cycle/orphans übrig bleiben, hinten anhängen
  for (const i of items) if (!visited.has(i.id)) out.push(byId.get(i.id)!);
  return out;
}

/**
 * Mobile-First-Forschung. Branches als Pills (sticky), Items als kompaktes
 * 3-Spalten-Grid pro Tier. Beschreibung + Kosten landen im Detail-Drawer
 * (Tap auf Card), damit die Übersicht in 412px Landscape ohne Scroll passt.
 */
export function ResearchTab({ accent, reload }: { accent: string; reload: () => Promise<void> }) {
  const t = useTranslations("BaseModal");
  const resourceArt = useResourceArt();
  const [data, setData] = useState<Data | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [activeBranch, setActiveBranch] = useState<string>("economy");
  const [detailId, setDetailId] = useState<string | null>(null);
  const [gems, setGems] = useState<number>(0);
  void accent;

  const load = useCallback(async () => {
    const r = await fetch("/api/base/research");
    setData(await r.json());
  }, []);
  useEffect(() => { void load(); }, [load]);

  // Diamanten-Saldo für Sofort-Button
  useEffect(() => {
    let cancelled = false;
    const loadGems = async () => {
      try {
        const r = await fetch("/api/shop/gems", { cache: "no-store" });
        if (!r.ok) return;
        const j = await r.json() as { gems?: { gems?: number } };
        if (!cancelled) setGems(j.gems?.gems ?? 0);
      } catch { /* ignore */ }
    };
    void loadGems();
    const onChange = () => void loadGems();
    window.addEventListener("ma365:gems-changed", onChange);
    return () => { cancelled = true; window.removeEventListener("ma365:gems-changed", onChange); };
  }, []);

  const branches = useMemo(() => ([
    { id: "economy",  label: t("researchBranchEconomy"),  color: "#FFD700" },
    { id: "military", label: t("researchBranchMilitary"), color: "#FF2D78" },
    { id: "defense",  label: t("researchBranchDefense"),  color: "#22D1C3" },
    { id: "combat",   label: t("researchBranchCombat"),   color: "#FF6B4A" },
    { id: "waechter", label: t("researchBranchWaechter"), color: "#a855f7" },
  ]), [t]);

  const progressMap = useMemo(
    () => new Map((data?.progress ?? []).map((p) => [p.research_id, p.level])),
    [data?.progress],
  );

  const branchStats = useMemo(() => {
    const out: Record<string, { done: number; total: number }> = {};
    for (const b of branches) out[b.id] = { done: 0, total: 0 };
    for (const d of data?.definitions ?? []) {
      const b = out[d.branch];
      if (!b) continue;
      b.total += 1;
      if ((progressMap.get(d.id) ?? 0) > 0) b.done += 1;
    }
    return out;
  }, [branches, data?.definitions, progressMap]);

  const itemsForActive = useMemo(() => {
    const list = (data?.definitions ?? []).filter((d) => d.branch === activeBranch);
    const tiers = Array.from(new Set(list.map((d) => d.tier))).sort((a, c) => a - c);
    return tiers.map((tier) => {
      const tierItems = list.filter((d) => d.tier === tier);
      // Topologische Sortierung: Vorgänger zuerst, Nachfolger direkt darunter.
      // So sieht der Spieler die Forschungs-Kette als zusammenhängenden Block.
      return { tier, items: topoSortChain(tierItems) };
    });
  }, [activeBranch, data?.definitions]);

  const detail = useMemo(
    () => (data?.definitions ?? []).find((d) => d.id === detailId) ?? null,
    [detailId, data?.definitions],
  );

  async function start(researchId: string) {
    setBusy(researchId); setMsg(null);
    try {
      const r = await fetch("/api/base/research", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ research_id: researchId }),
      });
      const j = await r.json() as { ok?: boolean; error?: string; minutes?: number };
      if (j.ok) {
        setMsg(t("researchStarted", { min: j.minutes ?? 0 }));
        setDetailId(null);
        await Promise.all([load(), reload()]);
      } else if (j.error === "prereq_missing") setMsg(t("researchErrPrereq"));
      else if (j.error === "burg_level_too_low") setMsg(t("researchErrBurgLow"));
      else if (j.error === "queue_full") setMsg(t("researchErrQueueFull"));
      else if (j.error === "not_enough_resources") setMsg(t("researchErrNotEnoughRes"));
      else setMsg(j.error ?? t("errGeneric"));
    } finally { setBusy(null); }
  }

  /** SOFORT: start + Diamanten-Skip in einem Klick. */
  async function instantStart(researchId: string) {
    setBusy(researchId); setMsg(null);
    try {
      const r = await fetch("/api/base/research", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ research_id: researchId }),
      });
      const j = await r.json() as { ok?: boolean; error?: string };
      if (!j.ok) {
        if (j.error === "prereq_missing") setMsg(t("researchErrPrereq"));
        else if (j.error === "burg_level_too_low") setMsg(t("researchErrBurgLow"));
        else if (j.error === "queue_full") setMsg(t("researchErrQueueFull"));
        else if (j.error === "not_enough_resources") setMsg(t("researchErrNotEnoughRes"));
        else setMsg(j.error ?? t("errGeneric"));
        return;
      }
      // Frische Queue holen, eigenen Eintrag finden
      const r2 = await fetch("/api/base/research");
      const j2 = await r2.json() as Data;
      const q = j2.queue.find((x) => x.research_id === researchId);
      if (!q) { setMsg(t("errGeneric")); return; }
      const r3 = await fetch("/api/base/research/instant", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ queue_id: q.id }),
      });
      const j3 = await r3.json() as { ok?: boolean; error?: string; gems_used?: number; gems_needed?: number };
      if (!j3.ok) {
        setMsg(j3.error === "not_enough_gems"
          ? `💎 ${j3.gems_needed ?? 0} fehlen.`
          : (j3.error ?? t("errGeneric")));
      } else {
        window.dispatchEvent(new CustomEvent("ma365:gems-changed"));
        setMsg(`✓ Sofort fertig (💎 ${j3.gems_used ?? 0})`);
        setDetailId(null);
      }
      await Promise.all([load(), reload()]);
    } finally { setBusy(null); }
  }

  if (!data) return <div className="text-[11px] text-[#a8b4cf] py-4 text-center">{t("troopsLoading")}</div>;

  const activeColor = branches.find((b) => b.id === activeBranch)?.color ?? "#22D1C3";

  return (
    <div className="flex flex-col gap-2" style={{ minHeight: 0 }}>
      {/* Branch-Pills — horizontal scrollbar wenn nötig, sonst 4-Up */}
      <div
        role="tablist"
        className="flex gap-1 overflow-x-auto"
        style={{ scrollbarWidth: "none", flexShrink: 0 }}
      >
        <style>{`.ma365-research-pills::-webkit-scrollbar { display: none; }`}</style>
        <div className="ma365-research-pills flex gap-1 w-full">
          {branches.map((b) => {
            const stats = branchStats[b.id] ?? { done: 0, total: 0 };
            const active = activeBranch === b.id;
            return (
              <button
                key={b.id}
                role="tab"
                aria-selected={active}
                onClick={() => setActiveBranch(b.id)}
                className="flex-1 min-w-0 px-2 py-1.5 rounded-md text-[10px] font-black flex flex-col items-center gap-0.5 transition"
                style={{
                  background: active ? `${b.color}26` : "rgba(255,255,255,0.04)",
                  border: `1px solid ${active ? b.color : "rgba(255,255,255,0.08)"}`,
                  color: active ? b.color : "#a8b4cf",
                  letterSpacing: 0.3,
                }}
              >
                <span className="truncate w-full text-center">{b.label}</span>
                <span className="text-[8px] font-bold opacity-80" style={{ fontVariantNumeric: "tabular-nums" }}>
                  {stats.done}/{stats.total}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Queue-Bar — sehr kompakt, nur wenn aktiv */}
      {data.queue.length > 0 && (
        <div
          className="rounded-md px-2 py-1 flex flex-col gap-0.5"
          style={{
            background: "rgba(34,209,195,0.10)",
            border: "1px solid rgba(34,209,195,0.40)",
            flexShrink: 0,
          }}
        >
          {data.queue.map((q) => {
            const d = data.definitions.find((x) => x.id === q.research_id);
            const remain = Math.max(0, Math.ceil((new Date(q.ends_at).getTime() - Date.now()) / 60000));
            return (
              <div key={q.id} className="flex items-center justify-between text-[10px] text-white gap-2">
                <span className="inline-flex items-center gap-1.5 min-w-0 flex-1">
                  <Art imageUrl={d?.image_url} videoUrl={d?.video_url} fallback={d?.emoji ?? "🔬"} size={14} alt={d?.name} />
                  <span className="truncate">
                    {t("researchToLevel", { name: d?.name ?? "", target: q.target_level })}
                  </span>
                </span>
                <span className="text-[#22D1C3] font-bold tabular-nums flex-shrink-0">{t("trainingMin", { n: remain })}</span>
              </div>
            );
          })}
        </div>
      )}

      {/* Toast-Message */}
      {msg && (
        <div
          className="rounded-md px-2 py-1 text-[10px] font-black text-center"
          style={{
            background: msg.startsWith("✓") ? "rgba(74,222,128,0.12)" : "rgba(255,45,120,0.12)",
            border: `1px solid ${msg.startsWith("✓") ? "rgba(74,222,128,0.4)" : "rgba(255,45,120,0.4)"}`,
            color: msg.startsWith("✓") ? "#4ade80" : "#FF2D78",
            flexShrink: 0,
          }}
        >
          {msg}
        </div>
      )}

      {/* Item-Grid — gruppiert per Tier */}
      <div className="flex flex-col gap-2" style={{ minHeight: 0 }}>
        {itemsForActive.length === 0 && (
          <div className="text-[10px] text-[#6c7590] text-center py-4">—</div>
        )}
        {itemsForActive.map(({ tier, items }) => (
          <div key={tier} className="flex flex-col gap-1">
            <div className="flex items-center gap-2 px-0.5">
              <span className="text-[8px] font-black tracking-widest text-[#6c7590]">
                {t("researchTier", { tier })}
              </span>
              <div className="flex-1 h-px" style={{ background: `${activeColor}33` }} />
            </div>
            <div
              className="grid gap-1.5"
              style={{ gridTemplateColumns: "repeat(auto-fill, minmax(110px, 1fr))" }}
            >
              {items.map((d) => {
                const lvl = progressMap.get(d.id) ?? 0;
                const prereqLvl = d.prereq_id ? (progressMap.get(d.prereq_id) ?? 0) : 1;
                const locked = d.prereq_id !== null && prereqLvl < 1;
                const maxed = lvl >= d.max_level;
                const inProgress = data.queue.some((q) => q.research_id === d.id);
                return (
                  <ItemCard
                    key={d.id}
                    def={d}
                    level={lvl}
                    locked={locked}
                    maxed={maxed}
                    inProgress={inProgress}
                    color={activeColor}
                    onTap={() => setDetailId(d.id)}
                  />
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* Detail-Drawer beim Tap auf Card */}
      {detail && (() => {
        const prereqDef = detail.prereq_id
          ? data.definitions.find((d) => d.id === detail.prereq_id) ?? null
          : null;
        const prereqLvl = prereqDef ? (progressMap.get(prereqDef.id) ?? 0) : 0;
        return (
          <DetailSheet
            def={detail}
            level={progressMap.get(detail.id) ?? 0}
            color={branches.find((b) => b.id === detail.branch)?.color ?? "#22D1C3"}
            locked={detail.prereq_id !== null && (progressMap.get(detail.prereq_id) ?? 0) < 1}
            maxed={(progressMap.get(detail.id) ?? 0) >= detail.max_level}
            busy={busy === detail.id}
            inProgress={data.queue.some((q) => q.research_id === detail.id)}
            gems={gems}
            prereqDef={prereqDef}
            prereqLvl={prereqLvl}
            onStart={() => void start(detail.id)}
            onInstant={() => void instantStart(detail.id)}
            onPrereqJump={prereqDef ? () => setDetailId(prereqDef.id) : undefined}
            onClose={() => setDetailId(null)}
            resourceArt={resourceArt}
            t={t}
          />
        );
      })()}
    </div>
  );
}

function ItemCard({
  def, level, locked, maxed, inProgress, color, onTap,
}: {
  def: Def;
  level: number;
  locked: boolean;
  maxed: boolean;
  inProgress: boolean;
  color: string;
  onTap: () => void;
}) {
  const dim = locked || maxed;
  const statusColor = maxed ? "#FFD700" : inProgress ? "#22D1C3" : level > 0 ? color : "#6c7590";
  return (
    <button
      onClick={onTap}
      className="rounded-md p-1.5 flex flex-col items-center gap-1 text-center transition active:scale-95"
      style={{
        background: dim ? "rgba(0,0,0,0.25)" : "rgba(15,17,21,0.7)",
        border: `1px solid ${maxed ? "#FFD70066" : inProgress ? "#22D1C366" : `${color}33`}`,
        opacity: dim ? 0.55 : 1,
        minHeight: 78,
      }}
    >
      {locked && (
        <span
          className="absolute text-[10px]"
          style={{ position: "absolute", top: 2, right: 4, color: "#FF6B4A" }}
          aria-label="Vorgänger erforderlich"
        >🔒</span>
      )}
      <Art imageUrl={def.image_url} videoUrl={def.video_url} fallback={def.emoji} size={28} alt={def.name} />
      <div
        className="text-[10px] font-black text-white w-full"
        style={{
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
          lineHeight: 1.1,
        }}
      >
        {def.name}
      </div>
      <div
        className="text-[9px] font-bold tabular-nums"
        style={{ color: statusColor, lineHeight: 1 }}
      >
        {maxed ? "MAX" : `${level}/${def.max_level}`}
      </div>
    </button>
  );
}

function DetailSheet({
  def, level, color, locked, maxed, inProgress, busy, gems,
  prereqDef, prereqLvl,
  onStart, onInstant, onPrereqJump, onClose, resourceArt, t,
}: {
  def: Def;
  level: number;
  color: string;
  locked: boolean;
  maxed: boolean;
  inProgress: boolean;
  busy: boolean;
  gems: number;
  /** Vorgänger-Definition (falls vorhanden), für Anzeige + Sprung-Button. */
  prereqDef: Def | null;
  /** Aktuelles Level des Vorgängers (für "Erforscht ✓" / "fehlt"-Anzeige). */
  prereqLvl: number;
  onStart: () => void;
  onInstant: () => void;
  /** Wenn gesetzt: Klick auf Vorgänger-Pill öffnet dessen DetailSheet. */
  onPrereqJump?: () => void;
  onClose: () => void;
  resourceArt: ReturnType<typeof useResourceArt>;
  t: ReturnType<typeof useTranslations<"BaseModal">>;
}) {
  // Kosten skalieren mit 1.55^level (matcht start_research). Zeit mit
  // def.buildtime_growth ^ level, capped auf 200 Tage (matcht Backend).
  const targetLvl = level + 1;
  const RESEARCH_CAP_MIN = 288000;
  const costMult = level === 0 ? 1 : Math.pow(1.55, level);
  const timeGrowth = def.buildtime_growth ?? 1.45;
  const timeMult = level === 0 ? 1 : Math.pow(timeGrowth, level);
  const costs = {
    wood:  Math.round(def.base_cost_wood * costMult),
    stone: Math.round(def.base_cost_stone * costMult),
    gold:  Math.round(def.base_cost_gold * costMult),
    mana:  Math.round(def.base_cost_mana * costMult),
  };
  const time = Math.min(RESEARCH_CAP_MIN, Math.max(1, Math.round(def.base_time_minutes * timeMult)));
  const gemsNeeded = Math.max(1, Math.ceil(time)); // 1 Diamant pro angefangene Minute
  const disabled = busy || locked || maxed || inProgress;
  const canInstant = !disabled && gems >= gemsNeeded;

  return (
    <div
      onClick={onClose}
      style={{
        position: "absolute", inset: 0,
        background: "rgba(0,0,0,0.78)",
        backdropFilter: "blur(6px)", WebkitBackdropFilter: "blur(6px)",
        zIndex: 50,
        display: "flex", alignItems: "flex-end", justifyContent: "center",
        padding: 6,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="rounded-lg w-full"
        style={{
          background: "linear-gradient(165deg, #2A2F4A 0%, #1E2238 60%, #14182A 100%)",
          border: `1px solid ${color}66`,
          boxShadow: `0 12px 40px rgba(0,0,0,0.6), 0 0 40px ${color}33`,
          maxWidth: 480,
        }}
      >
        {/* Header */}
        <div className="flex items-center gap-2 px-3 py-2 border-b border-white/8">
          <Art imageUrl={def.image_url} videoUrl={def.video_url} fallback={def.emoji} size={28} alt={def.name} />
          <div className="flex-1 min-w-0">
            <div className="text-[12px] font-black text-white truncate">{def.name}</div>
            <div className="text-[9px] font-bold" style={{ color }}>
              {t("researchItemMeta", { tier: def.tier, lvl: level, max: def.max_level, burg: def.required_burg_level })}
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Schließen"
            className="w-6 h-6 rounded-md text-white/85 text-sm font-black"
            style={{ background: "rgba(0,0,0,0.45)", border: "none" }}
          >×</button>
        </div>

        {/* Body */}
        <div className="p-3 flex flex-col gap-2">
          <div className="text-[11px] text-[#dde3f5] leading-relaxed">{def.description}</div>

          {/* Effekt-Block — zeigt was die Forschung tatsächlich verbessert.
              Pct-Effekte: Aktuell / Nächste Stufe / Max.
              Unlocks (max_level=1): "Aktiv ✓" oder "Schaltet frei". */}
          {def.effect_key && (
            (def.effect_key.startsWith("unlock_") || def.max_level === 1) ? (
              <div
                className="rounded-md px-2 py-1.5 flex items-center gap-2"
                style={{
                  background: level > 0 ? "rgba(74,222,128,0.10)" : "rgba(255,215,0,0.10)",
                  border: `1px solid ${level > 0 ? "rgba(74,222,128,0.4)" : "rgba(255,215,0,0.4)"}`,
                }}
              >
                <span className="text-[14px]">{level > 0 ? "✓" : "🔓"}</span>
                <div className="flex-1 min-w-0">
                  <div className="text-[8px] font-black tracking-widest" style={{ color: level > 0 ? "#4ade80" : "#FFD700" }}>
                    {level > 0 ? "AKTIVER UNLOCK" : "SCHALTET FREI"}
                  </div>
                  <div className="text-[11px] font-black text-white truncate">
                    {effectLabel(def.effect_key)}
                  </div>
                </div>
              </div>
            ) : (
              <div
                className="rounded-md px-2 py-1.5 flex flex-col gap-1"
                style={{ background: "rgba(34,209,195,0.08)", border: "1px solid rgba(34,209,195,0.30)" }}
              >
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px]">📈</span>
                  <span className="text-[10px] font-black tracking-wide text-[#22D1C3] truncate">
                    {effectLabel(def.effect_key)}
                  </span>
                  <span className="text-[8px] text-[#a8b4cf] tabular-nums ml-auto flex-shrink-0">
                    {fmtEffect(def.effect_key, def.effect_per_level)}/Lv
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-1 text-[9px] tabular-nums">
                  <div className="rounded px-1.5 py-1" style={{ background: "rgba(0,0,0,0.35)" }}>
                    <div className="text-[7px] font-black tracking-widest text-[#6c7590]">AKTUELL</div>
                    <div className="font-black" style={{ color: level > 0 ? "#22D1C3" : "#6c7590" }}>
                      {level > 0 ? fmtEffect(def.effect_key, def.effect_per_level * level) : "—"}
                    </div>
                  </div>
                  {!maxed && (
                    <div className="rounded px-1.5 py-1" style={{ background: "rgba(74,222,128,0.10)", border: "1px solid rgba(74,222,128,0.30)" }}>
                      <div className="text-[7px] font-black tracking-widest text-[#4ade80]">NÄCHSTE</div>
                      <div className="font-black text-[#86efac]">
                        {fmtEffect(def.effect_key, def.effect_per_level * targetLvl)}
                      </div>
                    </div>
                  )}
                  <div className="rounded px-1.5 py-1" style={{ background: "rgba(255,215,0,0.10)", border: "1px solid rgba(255,215,0,0.30)" }}>
                    <div className="text-[7px] font-black tracking-widest text-[#FFD700]">MAX</div>
                    <div className="font-black text-[#FFD700]">
                      {fmtEffect(def.effect_key, def.effect_per_level * def.max_level)}
                    </div>
                  </div>
                </div>
              </div>
            )
          )}

          {/* Vorgänger-Pill — immer sichtbar wenn vorhanden, mit Status-Farbe */}
          {prereqDef && (
            <button
              type="button"
              onClick={onPrereqJump}
              disabled={!onPrereqJump}
              className="rounded-md px-2 py-1.5 flex items-center gap-2 text-left transition active:scale-[0.98] disabled:opacity-100"
              style={{
                background: prereqLvl > 0 ? "rgba(74,222,128,0.10)" : "rgba(255,107,74,0.12)",
                border: `1px solid ${prereqLvl > 0 ? "rgba(74,222,128,0.4)" : "rgba(255,107,74,0.4)"}`,
                cursor: onPrereqJump ? "pointer" : "default",
              }}
            >
              <Art imageUrl={prereqDef.image_url} videoUrl={prereqDef.video_url} fallback={prereqDef.emoji} size={20} alt={prereqDef.name} />
              <div className="flex-1 min-w-0">
                <div className="text-[8px] font-black tracking-widest" style={{ color: prereqLvl > 0 ? "#4ade80" : "#FF6B4A" }}>
                  {prereqLvl > 0 ? "✓ VORGÄNGER ERFORSCHT" : "🔒 VORGÄNGER ERFORDERLICH"}
                </div>
                <div className="text-[11px] font-black text-white truncate">
                  {prereqDef.name}
                  <span className="text-[9px] text-[#a8b4cf] ml-1 font-normal">
                    Lv {prereqLvl}/{prereqDef.max_level}
                  </span>
                </div>
              </div>
              {onPrereqJump && <span className="text-[14px] text-white/60">›</span>}
            </button>
          )}

          {/* Kosten + Zeit — kompakt in einer Zeile */}
          {!maxed && (
            <div
              className="rounded-md px-2 py-1.5 flex items-center justify-between gap-2 flex-wrap"
              style={{ background: "rgba(0,0,0,0.35)", border: "1px solid rgba(255,255,255,0.06)" }}
            >
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[10px] text-white tabular-nums">
                {(["wood","stone","gold","mana"] as const).filter((k) => costs[k] > 0).map((k) => (
                  <span key={k} className="inline-flex items-center gap-1">
                    <ResourceIcon kind={k} size={12} fallback={RES_FB[k]} art={resourceArt} />
                    {compactNum(costs[k])}
                  </span>
                ))}
                {(costs.wood + costs.stone + costs.gold + costs.mana) === 0 && <span className="text-[#6c7590]">—</span>}
              </div>
              <span className="text-[10px] font-bold text-[#a8b4cf] tabular-nums flex-shrink-0">⏱ {fmtMin(time)}</span>
            </div>
          )}

          {/* Action-Buttons — SOFORT (Diamant) + FORSCHEN (Resourcen) */}
          {maxed ? (
            <button
              disabled
              className="w-full rounded-md py-2 text-[11px] font-black tracking-wide"
              style={{ background: "rgba(255,215,0,0.12)", color: "#FFD700", border: "1px solid rgba(255,215,0,0.4)" }}
            >MAX</button>
          ) : inProgress ? (
            <button
              disabled
              className="w-full rounded-md py-2 text-[11px] font-black tracking-wide"
              style={{ background: "rgba(34,209,195,0.12)", color: "#22D1C3", border: "1px solid rgba(34,209,195,0.4)" }}
            >⏱ läuft</button>
          ) : (
            <div className="grid grid-cols-2 gap-1.5">
              {/* SOFORT — Gold (Premium-Pay-Look) */}
              <button
                onClick={onInstant}
                disabled={!canInstant || busy}
                title={canInstant
                  ? `Sofort fertig für 💎 ${gemsNeeded.toLocaleString("de-DE")}`
                  : `Diamanten fehlen: ${gems.toLocaleString("de-DE")} / ${gemsNeeded.toLocaleString("de-DE")}`}
                className="rounded-md py-2 text-[11px] font-black tracking-wide transition active:scale-[0.97] disabled:opacity-40"
                style={{
                  background: canInstant ? "linear-gradient(180deg, #FFE066, #FFD700)" : "rgba(255,255,255,0.06)",
                  color: canInstant ? "#0F1115" : "#a8b4cf",
                  border: `1px solid ${canInstant ? "#FFD700" : "rgba(255,255,255,0.12)"}`,
                  boxShadow: canInstant ? "0 4px 12px rgba(255,215,0,0.55)" : "none",
                  display: "flex", alignItems: "center", justifyContent: "center", gap: 5,
                  whiteSpace: "nowrap",
                }}
              >
                <span>SOFORT</span>
                <span className="inline-flex items-center gap-0.5 tabular-nums">
                  <span style={{ fontSize: 11, lineHeight: 1 }}>💎</span>
                  {gemsNeeded.toLocaleString("de-DE")}
                </span>
              </button>
              {/* FORSCHEN — Grün (Standard-Confirm) */}
              <button
                onClick={onStart}
                disabled={disabled}
                className="rounded-md py-2 text-[11px] font-black tracking-wide transition active:scale-[0.97] disabled:opacity-40"
                style={{
                  background: disabled ? "rgba(255,255,255,0.06)" : "linear-gradient(180deg, #86efac, #22c55e)",
                  color: disabled ? "#a8b4cf" : "#0F1115",
                  border: `1px solid ${disabled ? "rgba(255,255,255,0.12)" : "#22c55e"}`,
                  boxShadow: disabled ? "none" : "0 4px 12px rgba(34,197,94,0.55)",
                  display: "flex", alignItems: "center", justifyContent: "center", gap: 5,
                  whiteSpace: "nowrap",
                }}
              >
                <span>{busy ? "…" : t("researchToNextLevel", { level: targetLvl })}</span>
                <span className="text-[10px] font-bold tabular-nums" style={{ color: disabled ? "#a8b4cf" : "rgba(15,17,21,0.75)" }}>
                  ⏱{fmtMin(time)}
                </span>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
