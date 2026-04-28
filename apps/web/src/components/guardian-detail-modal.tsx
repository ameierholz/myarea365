"use client";

import { useCallback, useEffect, useState, useMemo } from "react";
import { useTranslations, useLocale } from "next-intl";
import { getNumberLocale } from "@/i18n/config";
import { GuardianAvatar } from "@/components/guardian-avatar";
import { GuardianPaperDoll } from "@/components/guardian-paper-doll";
import { GuardianTalentTree } from "@/components/guardian-talent-tree";
import { GuardianSkillsPanel } from "@/components/guardian-skills-panel";
import { GuardianXpItemsPanel } from "@/components/guardian-xp-items-panel";
import { ForgeModal } from "@/components/forge-modal";
import { MMR_TIERS } from "@/lib/mmr-tiers";
import { GUARDIAN_CLASSES, legacyTypeToClass, type GuardianClass } from "@/lib/guardian-classes";
import { FACTIONS, normalizeFaction } from "@/lib/factions";
import {
  rarityMeta, xpForLevel, TYPE_META,
  type GuardianArchetype, type GuardianTalent, type TalentNode,
  type ArchetypeSkill, type GuardianSkillLevel, type UserSiegel,
} from "@/lib/guardian";
import { computeEffectiveStats } from "@/lib/guardian-effective";

type Materials = { scrap: number; crystal: number; essence: number; relikt: number };
type MaterialCatalogEntry = { id: string; name: string; emoji: string; image_url: string | null; video_url: string | null };

// MATERIAL_META + SIEGEL_META werden i18n-fähig per Hook erstellt (s.u.).
const MATERIAL_DEFS: Array<{ id: keyof Materials; nameKey: string; emoji: string; color: string }> = [
  { id: "scrap",   nameKey: "materialScrap",   emoji: "🔩", color: "#8B8FA3" },
  { id: "crystal", nameKey: "materialCrystal", emoji: "💎", color: "#22D1C3" },
  { id: "essence", nameKey: "materialEssence", emoji: "🔮", color: "#a855f7" },
  { id: "relikt",  nameKey: "materialRelikt",  emoji: "✨", color: "#FFD700" },
];

const SIEGEL_DEFS: Array<{ key: keyof UserSiegel; labelKey: string; icon: string; color: string }> = [
  { key: "siegel_infantry",  labelKey: "siegelInfantry",  icon: "🛡️", color: "#4ade80" },
  { key: "siegel_cavalry",   labelKey: "siegelCavalry",   icon: "🐎", color: "#FF6B4A" },
  { key: "siegel_marksman",  labelKey: "siegelMarksman",  icon: "🏹", color: "#5ddaf0" },
  { key: "siegel_mage",      labelKey: "siegelMage",      icon: "🔮", color: "#a855f7" },
  { key: "siegel_universal", labelKey: "siegelUniversal", icon: "⭐", color: "#FFD700" },
];

type DetailResponse = {
  guardian: {
    id: string; level: number; xp: number; wins: number; losses: number;
    custom_name: string | null; talent_points_available: number; talent_points_spent: number;
    current_hp_pct: number | null; wounded_until: string | null;
    acquired_at: string | null;
    archetype: GuardianArchetype & { class_id?: string | null };
  };
  talent_nodes: TalentNode[];
  guardian_talents: GuardianTalent[];
  archetype_skills: ArchetypeSkill[];
  guardian_skill_levels: GuardianSkillLevel[];
  siegel: UserSiegel;
  user?: {
    faction: string | null;
    heimat_plz: string | null;
  };
};

type Tab = "overview" | "equipment" | "talents" | "skills";

export function GuardianDetailModal({ guardianId, onClose, onArena, onSwitch, onOpenRanking }: {
  guardianId: string;
  onClose: () => void;
  onArena?: () => void;
  onSwitch?: () => void;
  onOpenRanking?: () => void;
}) {
  const tGD = useTranslations("GuardianDetail");
  const [data, setData] = useState<DetailResponse | null>(null);
  const [tab, setTab] = useState<Tab>("overview");
  const [error, setError] = useState<string | null>(null);
  const [materials, setMaterials] = useState<Materials | null>(null);
  const [materialCatalog, setMaterialCatalog] = useState<MaterialCatalogEntry[] | null>(null);
  const [forgeOpen, setForgeOpen] = useState(false);
  type InventoryItem = {
    id: string; item_id: string;
    catalog: { id: string; name: string; emoji: string; slot: import("@/lib/items").ItemSlot; rarity: string; bonus_hp: number; bonus_atk: number; bonus_def: number; bonus_spd: number; image_url?: string | null };
    upgrade_tier?: number; equipped?: boolean;
    crafting_target_tier?: number | null; crafting_ends_at?: string | null;
  };
  const [inventory, setInventory] = useState<InventoryItem[] | null>(null);
  const [equipped, setEquipped] = useState<Record<string, InventoryItem | null> | null>(null);
  type MmrInfo = {
    mmr: number; games: number; wins: number; losses: number;
    peak_mmr: number; last_change: number; last_change_at: string | null;
    rank: number; total_players: number; percentile: number;
    tier: { id: string; label: string; color: string; icon: string };
  };
  const [mmr, setMmr] = useState<MmrInfo | null>(null);

  const load = useCallback(async () => {
    const res = await fetch(`/api/guardian/detail/${guardianId}`);
    if (!res.ok) { setError(tGD("loadFailed")); return; }
    setData(await res.json());
  }, [guardianId]);

  useEffect(() => { void load(); }, [load]);

  useEffect(() => {
    void (async () => {
      try {
        const res = await fetch("/api/guardian/materials", { cache: "no-store" });
        if (!res.ok) return;
        const j = await res.json() as Materials & { catalog?: MaterialCatalogEntry[] };
        setMaterials({ scrap: j.scrap, crystal: j.crystal, essence: j.essence, relikt: j.relikt });
        if (Array.isArray(j.catalog)) setMaterialCatalog(j.catalog);
      } catch { /* ignore */ }
    })();
    void (async () => {
      try {
        const res = await fetch("/api/runner/mmr", { cache: "no-store" });
        if (!res.ok) return;
        setMmr(await res.json() as MmrInfo);
      } catch { /* ignore */ }
    })();
    void (async () => {
      try {
        const res = await fetch("/api/guardian/inventory", { cache: "no-store" });
        if (!res.ok) return;
        const j = await res.json() as { items?: InventoryItem[]; equipped?: Record<string, InventoryItem | null> };
        setInventory(j.items ?? []);
        setEquipped(j.equipped ?? null);
      } catch { /* ignore */ }
    })();
  }, []);

  function openForge() {
    if (!inventory) { alert(tGD("inventoryLoading")); return; }
    setForgeOpen(true);
  }

  async function action(body: object) {
    const res = await fetch(`/api/guardian/detail/${guardianId}`, {
      method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body),
    });
    const json = await res.json() as { ok?: boolean; error?: string };
    if (!json.ok && json.error) alert(json.error);
    await load();
  }

  return (
    <div onClick={onClose} style={{
      position: "fixed", inset: 0, zIndex: 3700,
      background: "rgba(15,17,21,0.92)", backdropFilter: "blur(14px)",
      display: "flex", alignItems: "center", justifyContent: "center", padding: 16,
    }}>
      <div onClick={(e) => e.stopPropagation()} style={{
        width: "100%", maxWidth: 640, maxHeight: "92vh",
        display: "flex", flexDirection: "column",
        background: "#1A1D23", borderRadius: 20,
        border: "1px solid rgba(34,209,195,0.5)",
        boxShadow: "0 0 40px rgba(34,209,195,0.3)",
        color: "#F0F0F0", overflow: "hidden",
      }}>
        {error ? (
          <div style={{ padding: 30, textAlign: "center", color: "#FF2D78" }}>{error}</div>
        ) : !data ? (
          <div style={{ padding: 40, textAlign: "center", color: "#a8b4cf" }}>{tGD("loadingGuardian")}</div>
        ) : (
          <ModalContent
            data={data} tab={tab} setTab={setTab} onClose={onClose} action={action}
            onArena={onArena} onSwitch={onSwitch} onForge={openForge} onOpenRanking={onOpenRanking}
            materials={materials} materialCatalog={materialCatalog}
            mmr={mmr} equipped={equipped}
          />
        )}
      </div>
      {forgeOpen && inventory && (
        <ForgeModal
          items={inventory}
          onClose={() => setForgeOpen(false)}
          onUpgraded={async () => { await load(); }}
        />
      )}
    </div>
  );
}

type MmrInfo = {
  mmr: number; games: number; wins: number; losses: number;
  peak_mmr: number; last_change: number; last_change_at: string | null;
  rank: number; total_players: number; percentile: number;
  tier: { id: string; label: string; color: string; icon: string };
};

type EquippedItem = {
  id: string; item_id: string;
  catalog: { rarity: string; bonus_hp: number; bonus_atk: number; bonus_def: number; bonus_spd: number; name: string; emoji: string; slot: string };
  upgrade_tier?: number;
};

const RARITY_SCORE_MULT: Record<string, number> = {
  common: 1.0, rare: 1.0, elite: 1.0,
  epic: 1.5,
  legend: 2.25, legendary: 2.25,
};
const TIER_SCORE_MULT = [1.0, 1.25, 1.55, 2.0];

function gearScore(equipped: Record<string, EquippedItem | null> | null): { total: number; slots: number } {
  if (!equipped) return { total: 0, slots: 0 };
  let total = 0; let filled = 0;
  for (const slot of Object.keys(equipped)) {
    const it = equipped[slot];
    if (!it) continue;
    const c = it.catalog;
    const raw = c.bonus_hp + c.bonus_atk * 2 + c.bonus_def * 1.5 + c.bonus_spd * 1.2;
    const rMult = RARITY_SCORE_MULT[c.rarity] ?? 1.0;
    const tMult = TIER_SCORE_MULT[Math.max(0, Math.min(3, it.upgrade_tier ?? 0))];
    total += raw * rMult * tMult;
    filled++;
  }
  return { total: Math.round(total), slots: filled };
}

function ModalContent({ data, tab, setTab, onClose, action, onArena, onSwitch, onForge, onOpenRanking, materials, materialCatalog, mmr, equipped }: {
  data: DetailResponse; tab: Tab; setTab: (t: Tab) => void; onClose: () => void;
  action: (body: object) => Promise<void>;
  onArena?: () => void;
  onSwitch?: () => void;
  onForge?: () => void;
  onOpenRanking?: () => void;
  materials: Materials | null;
  materialCatalog: MaterialCatalogEntry[] | null;
  mmr: MmrInfo | null;
  equipped: Record<string, EquippedItem | null> | null;
}) {
  const tGD = useTranslations("GuardianDetail");
  const locale = useLocale();
  const numLocale = getNumberLocale(locale);
  const MATERIAL_META = useMemo(() => MATERIAL_DEFS.map((m) => ({ ...m, name: tGD(m.nameKey as "materialScrap" | "materialCrystal" | "materialEssence" | "materialRelikt") })), [tGD]);
  const SIEGEL_META = useMemo(() => SIEGEL_DEFS.map((s) => ({ ...s, label: tGD(s.labelKey as "siegelInfantry" | "siegelCavalry" | "siegelMarksman" | "siegelMage" | "siegelUniversal") })), [tGD]);
  const g = data.guardian;
  const a = g.archetype;
  const rarity = rarityMeta(a.rarity);
  const typeMeta = a.guardian_type ? TYPE_META[a.guardian_type] : null;
  const eff = computeEffectiveStats(
    a, g.level,
    data.guardian_skill_levels as unknown as Array<{ skill_id: string; level: number }>,
    data.archetype_skills as unknown as Array<{ id: string; skill_slot: "active" | "passive" | "combat" | "role" | "expertise" }>,
    data.guardian_talents as unknown as Array<{ node_id: string; rank: number }>,
    data.talent_nodes as unknown as Array<{ id: string; effect_key: string; effect_per_rank: number }>,
  );
  const xpNext = xpForLevel(g.level);
  const xpPct = Math.min(100, Math.round((g.xp / xpNext) * 100));

  return (
    <>
      {/* Hero: großer Avatar links + Stats/Meta rechts */}
      <div style={{
        position: "relative",
        padding: 16, display: "flex", gap: 14,
        background: `linear-gradient(135deg, ${rarity.glow}, transparent 75%)`,
        borderBottom: "1px solid rgba(255,255,255,0.08)",
      }}>
        <button onClick={onClose} style={{
          position: "absolute", top: 8, right: 8, zIndex: 2,
          background: "rgba(0,0,0,0.4)", border: "none",
          color: "#FFF", fontSize: 18, cursor: "pointer",
          width: 30, height: 30, borderRadius: 15,
        }}>×</button>

        <div style={{
          width: 180, height: 220, flexShrink: 0, borderRadius: 14, overflow: "hidden",
          background: `radial-gradient(circle at 50% 35%, ${rarity.color}33 0%, rgba(15,17,21,0.6) 70%)`,
          border: `1px solid ${rarity.color}55`,
          boxShadow: `0 0 22px ${rarity.glow}`,
        }}>
          <GuardianAvatar archetype={a} size={180} animation="idle" fillMode="cover" />
        </div>

        <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column" }}>
          <div style={{ color: rarity.color, fontSize: 9, fontWeight: 900, letterSpacing: 1.5 }}>
            {rarity.label.toUpperCase()}{typeMeta ? ` · ${typeMeta.icon} ${typeMeta.label.toUpperCase()}` : ""}
          </div>
          <div style={{ color: "#FFF", fontSize: 18, fontWeight: 900, lineHeight: 1.15, marginTop: 2 }}>
            {g.custom_name ?? a.name}
          </div>
          <div style={{ color: "#a8b4cf", fontSize: 11, marginTop: 2, display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <span>{tGD("level", { level: g.level })}</span>
            <span>·</span>
            <span><span style={{ color: "#4ade80", fontWeight: 800 }}>{g.wins}W</span> / <span style={{ color: "#FF2D78", fontWeight: 800 }}>{g.losses}L</span></span>
            {(() => {
              const gs = gearScore(equipped);
              const gsColor = gs.total >= 500 ? "#FFD700" : gs.total >= 250 ? "#a855f7" : gs.total >= 100 ? "#22D1C3" : "#8B8FA3";
              return (
                <span
                  title={tGD("gearScoreTooltip", { filled: gs.slots })}
                  style={{
                    marginLeft: "auto",
                    padding: "2px 8px", borderRadius: 999,
                    background: `${gsColor}22`,
                    border: `1px solid ${gsColor}77`,
                    color: gsColor, fontSize: 10, fontWeight: 900, letterSpacing: 0.5,
                  }}
                >
                  ⚙️ {gs.total} GS
                </span>
              );
            })()}
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, marginTop: 10 }}>
            <Stat label="Leben"        value={eff.effective.hp}  delta={eff.delta.hp}  color="#4ade80" />
            <Stat label="Angriff"      value={eff.effective.atk} delta={eff.delta.atk} color="#FF6B4A" />
            <Stat label="Verteidigung" value={eff.effective.def} delta={eff.delta.def} color="#5ddaf0" />
            <Stat label="Tempo"        value={eff.effective.spd} delta={eff.delta.spd} color="#FFD700" />
          </div>

          {(eff.bonusPct.crit > 0) && (
            <div style={{ fontSize: 9, color: "#a8b4cf", marginTop: 6 }}>
              {tGD("critBonus", { pct: Math.round(eff.bonusPct.crit * 100) })}
            </div>
          )}

          <div style={{ marginTop: "auto", paddingTop: 10 }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 9, color: "#a8b4cf" }}>
              <span>Erfahrung</span><span>{g.xp} / {xpNext}</span>
            </div>
            <div style={{ height: 5, background: "rgba(255,255,255,0.08)", borderRadius: 3, overflow: "hidden", marginTop: 2 }}>
              <div style={{ width: `${xpPct}%`, height: "100%", background: rarity.color }} />
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ padding: "8px 12px", display: "flex", gap: 6, borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
        {(["overview", "equipment", "talents", "skills"] as Tab[]).map((t) => (
          <button key={t} onClick={() => setTab(t)} style={{
            flex: 1, padding: "8px 4px", borderRadius: 10,
            background: tab === t ? "#22D1C3" : "rgba(255,255,255,0.06)",
            color: tab === t ? "#0F1115" : "#a8b4cf",
            border: "none", fontSize: 11, fontWeight: 900, letterSpacing: 1,
            cursor: "pointer",
          }}>
            {t === "overview" ? tGD("tabOverview") : t === "equipment" ? tGD("tabEquipment") : t === "talents" ? `${tGD("tabTalents")}${g.talent_points_available > 0 ? ` (${g.talent_points_available})` : ""}` : tGD("tabSkills")}
          </button>
        ))}
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflowY: "auto", padding: 14 }}>
        {tab === "overview" && (() => {
          const totalBattles = g.wins + g.losses;
          const winRate = totalBattles > 0 ? Math.round((g.wins / totalBattles) * 100) : 0;
          const hpPct = g.current_hp_pct ?? 100;
          const isWounded = g.wounded_until ? new Date(g.wounded_until) > new Date() : false;
          const skillPointsSpent = data.guardian_skill_levels.reduce((sum, s) => sum + (s.level ?? 0), 0);
          const talentSpent = g.talent_points_spent ?? 0;
          const talentAvail = g.talent_points_available ?? 0;
          const daysOwned = g.acquired_at
            ? Math.max(1, Math.floor((Date.now() - new Date(g.acquired_at).getTime()) / 86400000))
            : null;
          const hpColor = hpPct > 66 ? "#4ade80" : hpPct > 33 ? "#FFD700" : "#FF2D78";
          return (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {/* Ranked / Elo-MMR */}
              {mmr && (
                <div style={{
                  padding: 14, borderRadius: 14,
                  background: `linear-gradient(135deg, ${mmr.tier.color}22, rgba(15,17,21,0.85))`,
                  border: `1px solid ${mmr.tier.color}66`,
                  boxShadow: `0 0 18px ${mmr.tier.color}22`,
                }}>
                  <div
                    onClick={onOpenRanking}
                    role={onOpenRanking ? "button" : undefined}
                    style={{
                      display: "flex", alignItems: "center", gap: 12,
                      cursor: onOpenRanking ? "pointer" : "default",
                    }}
                  >
                    <div style={{
                      width: 48, height: 48, borderRadius: 12, flexShrink: 0,
                      background: `radial-gradient(circle, ${mmr.tier.color}44 0%, rgba(15,17,21,0.6) 75%)`,
                      border: `1px solid ${mmr.tier.color}`,
                      display: "flex", alignItems: "center", justifyContent: "center",
                      fontSize: 28,
                    }}>{mmr.tier.icon}</div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ color: mmr.tier.color, fontSize: 9, fontWeight: 900, letterSpacing: 1.5, display: "flex", alignItems: "center", gap: 6 }}>
                        {tGD("rankedHeader", { tier: mmr.tier.label.toUpperCase() })}
                        {onOpenRanking && <span style={{ color: "#8B8FA3", fontWeight: 700 }}>{tGD("leaderboardLink")}</span>}
                      </div>
                      <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginTop: 2 }}>
                        <span style={{ color: "#FFF", fontSize: 22, fontWeight: 900, lineHeight: 1 }}>
                          {mmr.mmr}
                        </span>
                        <span style={{ color: "#a8b4cf", fontSize: 10, fontWeight: 700 }}>Wertung</span>
                        {mmr.last_change !== 0 && mmr.last_change_at && (
                          <span style={{
                            color: mmr.last_change > 0 ? "#4ade80" : "#FF2D78",
                            fontSize: 11, fontWeight: 900,
                          }}>
                            {mmr.last_change > 0 ? "+" : ""}{mmr.last_change}
                          </span>
                        )}
                      </div>
                      <div style={{ color: "#8B8FA3", fontSize: 10, marginTop: 2 }}>
                        {mmr.games > 0 ? (
                          tGD.rich("rankPos", { rank: mmr.rank, total: mmr.total_players, percentile: mmr.percentile, b: (c) => <b style={{ color: "#FFF" }}>{c}</b> })
                        ) : (
                          tGD("unranked")
                        )}
                      </div>
                    </div>
                    <div style={{ textAlign: "right", flexShrink: 0 }}>
                      <div style={{ color: "#8B8FA3", fontSize: 8, fontWeight: 800, letterSpacing: 0.8 }}>{tGD("peakLabel")}</div>
                      <div style={{ color: "#FFD700", fontSize: 14, fontWeight: 900, lineHeight: 1 }}>{mmr.peak_mmr}</div>
                    </div>
                  </div>
                  {mmr.games < 30 && mmr.games > 0 && (
                    <div style={{ marginTop: 8, fontSize: 9, color: "#FFD700" }}>
                      {tGD("calibrationHint", { fightsLeft: 30 - mmr.games })}
                    </div>
                  )}

                  {/* Tier-Ladder Collapsible */}
                  <details style={{ marginTop: 10 }}>
                    <summary style={{
                      cursor: "pointer", color: "#a8b4cf", fontSize: 10, fontWeight: 700,
                      listStyle: "none", userSelect: "none",
                    }}>
                      {tGD("showAllRanks")}
                    </summary>
                    <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 4 }}>
                      {MMR_TIERS.map((t) => {
                        const isMine = t.id === mmr.tier.id;
                        const next = MMR_TIERS.find((x) => x.minMmr > t.minMmr);
                        const range = next ? `${t.minMmr}–${next.minMmr - 1}` : `${t.minMmr}+`;
                        return (
                          <div key={t.id} style={{
                            display: "flex", alignItems: "center", gap: 8,
                            padding: "4px 8px", borderRadius: 8,
                            background: isMine ? `${t.color}22` : "rgba(15,17,21,0.4)",
                            border: `1px solid ${isMine ? t.color : "rgba(255,255,255,0.04)"}`,
                          }}>
                            <span style={{ fontSize: 14 }}>{t.icon}</span>
                            <span style={{ color: t.color, fontSize: 11, fontWeight: 900, flex: 1 }}>{t.label}</span>
                            <span style={{ color: "#8B8FA3", fontSize: 10, fontFamily: "monospace" }}>{range} Wertung</span>
                            {isMine && <span style={{ color: t.color, fontSize: 9, fontWeight: 900 }}>{tGD("youBadge")}</span>}
                          </div>
                        );
                      })}
                    </div>
                  </details>
                </div>
              )}

              {/* Kampf-Statistik */}
              <div style={{ padding: 12, borderRadius: 12, background: "rgba(15,17,21,0.7)", border: "1px solid rgba(255,107,74,0.3)" }}>
                <div style={{ color: "#FF6B4A", fontSize: 10, fontWeight: 900, letterSpacing: 1.5, marginBottom: 10 }}>
                  {tGD("battleStatsHeader")}
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 6 }}>
                  <StatBox label={tGD("statWins")}     value={g.wins}         color="#4ade80" />
                  <StatBox label={tGD("statLosses")}   value={g.losses}       color="#FF2D78" />
                  <StatBox label={tGD("statWinRate")}  value={totalBattles > 0 ? `${winRate}%` : "–"} color="#FFD700" />
                  <StatBox label={tGD("statTotal")}    value={totalBattles}   color="#a855f7" />
                  <StatBox label={tGD("statTalents")}  value={talentAvail > 0 ? `${talentSpent} (+${talentAvail})` : `${talentSpent}`} color="#5ddaf0" />
                  <StatBox label={tGD("statSkills")}   value={skillPointsSpent} color="#22D1C3" />
                </div>
              </div>

              {/* Zustand */}
              <div style={{ padding: 12, borderRadius: 12, background: "rgba(15,17,21,0.7)", border: "1px solid rgba(255,255,255,0.08)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                  <div style={{ color: "#a8b4cf", fontSize: 10, fontWeight: 900, letterSpacing: 1.5 }}>
                    {tGD("conditionHeader")}
                  </div>
                  <div style={{ color: isWounded ? "#FF2D78" : hpColor, fontSize: 11, fontWeight: 900 }}>
                    {isWounded ? tGD("wounded") : hpPct >= 100 ? tGD("fullFit") : `${hpPct}% Leben`}
                  </div>
                </div>
                <div style={{ height: 8, background: "rgba(255,255,255,0.08)", borderRadius: 4, overflow: "hidden" }}>
                  <div style={{ width: `${hpPct}%`, height: "100%", background: hpColor, transition: "width 0.3s" }} />
                </div>
                {isWounded && g.wounded_until && (
                  <div style={{ fontSize: 10, color: "#FF2D78", marginTop: 6 }}>
                    {tGD("regenerationUntil", { time: new Date(g.wounded_until).toLocaleString(numLocale, { dateStyle: "short", timeStyle: "short" }) })}
                  </div>
                )}
                {daysOwned != null && (
                  <div style={{ fontSize: 10, color: "#6c7590", marginTop: 6 }}>
                    {daysOwned === 1 ? tGD("inTeamSinceOne", { days: daysOwned }) : tGD("inTeamSinceMany", { days: daysOwned })}
                  </div>
                )}
              </div>

              {/* Klassen-Buff */}
              {(() => {
                const classId: GuardianClass | null =
                  (a.class_id as GuardianClass | null | undefined) ??
                  legacyTypeToClass(a.guardian_type);
                if (!classId) return null;
                const cls = GUARDIAN_CLASSES[classId];
                const counter = GUARDIAN_CLASSES[cls.counter];
                return (
                  <div style={{ padding: 12, borderRadius: 12, background: `linear-gradient(135deg, ${cls.color}18, rgba(15,17,21,0.85))`, border: `1px solid ${cls.color}55` }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
                      <span style={{ fontSize: 22 }}>{cls.icon}</span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ color: cls.color, fontSize: 9, fontWeight: 900, letterSpacing: 1.5 }} title={tGD("classBuffTitle")}>{tGD("classBuffLabel", { label: cls.label.toUpperCase() })}</div>
                        <div style={{ color: "#FFF", fontSize: 13, fontWeight: 900 }}>{cls.buff_name}</div>
                      </div>
                      <span
                        title={tGD("strongAgainst", { label: counter.label })}
                        style={{
                          fontSize: 9, fontWeight: 900, color: counter.color,
                          padding: "2px 7px", borderRadius: 999,
                          border: `1px solid ${counter.color}66`,
                          background: `${counter.color}15`,
                        }}>
                        ⚔️ {counter.label}
                      </span>
                    </div>
                    <div style={{ color: "#a8b4cf", fontSize: 11, lineHeight: 1.45 }}>{cls.buff_desc}</div>
                  </div>
                );
              })()}

              {/* Fraktions-Buff */}
              {(() => {
                const fId = normalizeFaction(data.user?.faction);
                if (!fId) return null;
                const f = FACTIONS[fId];
                return (
                  <div style={{ padding: 12, borderRadius: 12, background: `linear-gradient(135deg, ${f.color}18, rgba(15,17,21,0.85))`, border: `1px solid ${f.color}55` }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
                      <span style={{ fontSize: 22 }}>{f.icon}</span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ color: f.color, fontSize: 9, fontWeight: 900, letterSpacing: 1.5 }} title={tGD("factionBuffTitle")}>{tGD("factionBuffLabel", { label: f.label.toUpperCase() })}</div>
                        <div style={{ color: "#FFF", fontSize: 13, fontWeight: 900 }}>{f.buff_name}</div>
                      </div>
                      {data.user?.heimat_plz && (
                        <span style={{
                          fontSize: 9, fontWeight: 900, color: "#a8b4cf",
                          padding: "2px 7px", borderRadius: 999,
                          border: "1px solid rgba(255,255,255,0.12)",
                        }}>
                          📍 {data.user.heimat_plz}
                        </span>
                      )}
                    </div>
                    <div style={{ color: "#a8b4cf", fontSize: 11, lineHeight: 1.45 }}>{f.buff_desc}</div>
                  </div>
                );
              })()}

              {/* Materialien */}
              <div style={{ padding: 12, borderRadius: 12, background: "rgba(15,17,21,0.7)", border: "1px solid rgba(255,215,0,0.25)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                  <div style={{ color: "#FFD700", fontSize: 10, fontWeight: 900, letterSpacing: 1.5 }}>
                    {tGD("materialsHeader")}
                  </div>
                  {onForge && (
                    <button onClick={onForge} style={{
                      padding: "4px 10px", borderRadius: 999, border: "1px solid rgba(255,107,74,0.55)",
                      background: "rgba(255,107,74,0.15)", color: "#FF6B4A",
                      fontSize: 10, fontWeight: 900, cursor: "pointer", letterSpacing: 0.5,
                    }}>{tGD("toForge")}</button>
                  )}
                </div>
                <div style={{ color: "#8B8FA3", fontSize: 10, lineHeight: 1.4, marginBottom: 10 }}>
                  {tGD("materialsHint")}
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 6 }}>
                  {MATERIAL_META.map((m) => {
                    const qty = materials?.[m.id] ?? 0;
                    const cat = materialCatalog?.find((c) => c.id === m.id);
                    return (
                      <div key={m.id} style={{
                        padding: "8px 6px", borderRadius: 10,
                        background: "rgba(15,17,21,0.7)",
                        border: `1px solid ${m.color}44`,
                        display: "flex", flexDirection: "column", alignItems: "center", gap: 4,
                      }}>
                        {cat?.video_url ? (
                          <video src={cat.video_url} autoPlay loop muted playsInline style={{ width: 28, height: 28, objectFit: "contain" }} />
                        ) : cat?.image_url ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={cat.image_url} alt={cat.name} style={{ width: 28, height: 28, objectFit: "contain" }} />
                        ) : (
                          <span style={{ fontSize: 22, lineHeight: 1 }}>{cat?.emoji ?? m.emoji}</span>
                        )}
                        <span style={{ color: m.color, fontSize: 14, fontWeight: 900, lineHeight: 1 }}>{qty}</span>
                        <span style={{ color: "#8B8FA3", fontSize: 8, fontWeight: 700, textAlign: "center", letterSpacing: 0.3 }}>
                          {(cat?.name ?? m.name).toUpperCase()}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Siegel-Übersicht */}
              <div style={{ padding: 12, borderRadius: 12, background: "rgba(15,17,21,0.7)", border: "1px solid rgba(168,85,247,0.3)" }}>
                <div style={{ color: "#a855f7", fontSize: 10, fontWeight: 900, letterSpacing: 1.5, marginBottom: 4 }}>
                  {tGD("siegelHeader")}
                </div>
                <div style={{ color: "#8B8FA3", fontSize: 10, lineHeight: 1.4, marginBottom: 10 }}>
                  {tGD("siegelHint")}
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 4 }}>
                  {SIEGEL_META.map((s) => {
                    const qty = (data.siegel as unknown as Record<string, number>)[s.key] ?? 0;
                    const isOwnType = a.guardian_type && `siegel_${a.guardian_type}` === s.key;
                    return (
                      <div key={s.key} style={{
                        padding: "6px 4px", borderRadius: 8,
                        background: isOwnType ? `${s.color}22` : "rgba(15,17,21,0.6)",
                        border: `1px solid ${isOwnType ? s.color : "rgba(255,255,255,0.05)"}`,
                        display: "flex", flexDirection: "column", alignItems: "center", gap: 2,
                      }}>
                        <span style={{ fontSize: 16, lineHeight: 1 }}>{s.icon}</span>
                        <span style={{ color: s.color, fontSize: 13, fontWeight: 900, lineHeight: 1 }}>{qty}</span>
                        <span style={{ color: "#8B8FA3", fontSize: 7, fontWeight: 700, textAlign: "center" }}>{s.label.toUpperCase()}</span>
                      </div>
                    );
                  })}
                </div>
                {a.guardian_type && (
                  <div style={{ fontSize: 9, color: "#6c7590", marginTop: 8, textAlign: "center" }}>
                    {tGD("siegelOwnTypeHint", { type: TYPE_META[a.guardian_type]?.label ?? "?" })}
                  </div>
                )}
              </div>

              {/* Signatur-Fähigkeit */}
              <div style={{ padding: 12, borderRadius: 12, background: "rgba(15,17,21,0.7)", border: `1px solid ${rarity.color}44` }}>
                <div style={{ color: rarity.color, fontSize: 10, fontWeight: 900, letterSpacing: 1.5 }} title={tGD("signatureTitle")}>
                  {tGD("signatureHeader")} <span style={{ color: "#8B8FA3", fontWeight: 700 }}>{tGD("signatureSub")}</span>
                </div>
                <div style={{ color: "#FFF", fontSize: 14, fontWeight: 900, marginTop: 2 }}>{a.ability_name}</div>
                <div style={{ color: "#a8b4cf", fontSize: 12, marginTop: 2 }}>{a.ability_desc}</div>
                {a.lore && (
                  <div style={{ color: "#6c7590", fontSize: 11, marginTop: 8, fontStyle: "italic" }}>„{a.lore}"</div>
                )}
              </div>
            </div>
          );
        })()}
        {tab === "equipment" && (
          <GuardianPaperDoll
            avatar={<GuardianAvatar archetype={a} size={140} animation="idle" />}
            onChange={() => { /* reload not needed, modal holds local state */ }}
          />
        )}
        {tab === "talents" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <GuardianXpItemsPanel guardianId={g.id} onApplied={() => { /* parent reload handled outside */ }} />
            <GuardianTalentTree
              guardianId={g.id}
              nodes={data.talent_nodes}
              talents={data.guardian_talents}
              pointsAvailable={g.talent_points_available}
              onSpend={(nodeId) => action({ action: "spend_talent", node_id: nodeId })}
              onRespec={() => action({ action: "respec", force: true })}
            />
          </div>
        )}
        {tab === "skills" && (
          <GuardianSkillsPanel
            skills={data.archetype_skills}
            skillLevels={data.guardian_skill_levels}
            guardianType={a.guardian_type}
            siegel={data.siegel}
            onUpgrade={(skillId) => action({ action: "upgrade_skill", skill_id: skillId })}
          />
        )}
      </div>

      {(onArena || onSwitch || onForge) && (
        <div style={{
          padding: 12, display: "flex", flexDirection: "column", gap: 8,
          borderTop: "1px solid rgba(255,255,255,0.08)",
          background: "rgba(15,17,21,0.55)",
        }}>
          {onArena && (
            <button onClick={onArena} style={{
              width: "100%", padding: "12px 14px", borderRadius: 10, border: "none",
              background: "linear-gradient(135deg, #FF2D78, #FF6B4A)",
              color: "#FFF", fontSize: 13, fontWeight: 900, cursor: "pointer",
              display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
              boxShadow: "0 0 14px rgba(255,45,120,0.45)",
            }}>{tGD("actionEnterArena")}</button>
          )}
          <div style={{ display: "flex", gap: 8 }}>
            {onForge && (
              <button onClick={onForge} style={{
                flex: 1, padding: "10px 10px", borderRadius: 10,
                background: "rgba(255,107,74,0.12)",
                border: "1px solid rgba(255,107,74,0.55)",
                color: "#FF6B4A", fontSize: 12, fontWeight: 900, cursor: "pointer",
              }}>{tGD("actionForge")}</button>
            )}
            {onSwitch && (
              <button onClick={onSwitch} style={{
                flex: 1, padding: "10px 10px", borderRadius: 10,
                background: "rgba(34,209,195,0.12)",
                border: "1px solid rgba(34,209,195,0.5)",
                color: "#22D1C3", fontSize: 12, fontWeight: 900, cursor: "pointer",
              }}>{tGD("actionSwitch")}</button>
            )}
          </div>
        </div>
      )}
    </>
  );
}

function StatBox({ label, value, color }: { label: string; value: number | string; color: string }) {
  return (
    <div style={{
      padding: "8px 6px", borderRadius: 8,
      background: "rgba(15,17,21,0.6)",
      border: `1px solid ${color}33`,
      display: "flex", flexDirection: "column", alignItems: "center", gap: 2,
    }}>
      <span style={{ color: "#8B8FA3", fontSize: 8, fontWeight: 800, letterSpacing: 0.8 }}>{label}</span>
      <span style={{ color, fontSize: 14, fontWeight: 900, lineHeight: 1 }}>{value}</span>
    </div>
  );
}

function Stat({ label, value, color, delta }: { label: string; value: number; color: string; delta?: number }) {
  const tGD = useTranslations("GuardianDetail");
  const tooltips: Record<string, string> = {
    Leben:        tGD("tooltipHp"),
    Angriff:      tGD("tooltipAtk"),
    Verteidigung: tGD("tooltipDef"),
    Tempo:        tGD("tooltipSpd"),
  };
  return (
    <div
      title={tooltips[label] ?? undefined}
      style={{
        padding: "8px 10px", borderRadius: 10,
        background: "rgba(15,17,21,0.65)",
        border: `1px solid ${color}33`,
        display: "flex", alignItems: "center", justifyContent: "space-between", gap: 6,
        cursor: tooltips[label] ? "help" : "default",
      }}
    >
      <span style={{ color: "#8B8FA3", fontSize: 10, fontWeight: 900, letterSpacing: 1 }}>{label}</span>
      <span style={{ display: "flex", alignItems: "baseline", gap: 4 }}>
        <span style={{ color, fontSize: 16, fontWeight: 900, lineHeight: 1 }}>{value}</span>
        {delta !== undefined && delta > 0 && (
          <span style={{ color: "#4ade80", fontSize: 9, fontWeight: 900 }}>+{delta}</span>
        )}
      </span>
    </div>
  );
}
