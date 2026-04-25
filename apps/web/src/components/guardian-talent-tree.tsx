"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { BRANCH_META, type TalentBranch, type TalentNode, type GuardianTalent } from "@/lib/guardian";

type Props = {
  guardianId: string;
  nodes: TalentNode[];
  talents: GuardianTalent[];
  pointsAvailable: number;
  onSpend: (nodeId: string) => Promise<void>;
  onRespec: () => Promise<void>;
};

type TT = ReturnType<typeof useTranslations<"GuardianTalents">>;

export function GuardianTalentTree(props: Props) {
  const t = useTranslations("GuardianTalents");
  const { nodes, talents, pointsAvailable, onSpend, onRespec } = props;
  const [busy, setBusy] = useState<string | null>(null);

  const byBranch = useMemo(() => {
    const map: Record<TalentBranch, TalentNode[]> = { primary: [], secondary: [], utility: [] };
    for (const n of nodes) map[n.branch].push(n);
    for (const k of Object.keys(map) as TalentBranch[]) map[k].sort((a, b) => a.tier - b.tier);
    return map;
  }, [nodes]);

  const rankByNode = useMemo(() => {
    const m = new Map<string, number>();
    for (const tn of talents) m.set(tn.node_id, tn.rank);
    return m;
  }, [talents]);

  async function handleSpend(nodeId: string) {
    if (pointsAvailable < 1) return;
    setBusy(nodeId);
    try { await onSpend(nodeId); } finally { setBusy(null); }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{
        display: "flex", justifyContent: "space-between", alignItems: "center",
        padding: 10, borderRadius: 10,
        background: "linear-gradient(135deg, rgba(34,209,195,0.15), rgba(255,45,120,0.08))",
        border: "1px solid rgba(34,209,195,0.35)",
      }}>
        <div>
          <div style={{ color: "#22D1C3", fontSize: 9, fontWeight: 900, letterSpacing: 2 }}>{t("pointsHeader")}</div>
          <div style={{ color: "#FFF", fontSize: 22, fontWeight: 900 }}>{pointsAvailable}</div>
        </div>
        <button
          onClick={onRespec}
          style={{
            padding: "8px 12px", borderRadius: 10,
            background: "rgba(255,45,120,0.15)", border: "1px solid rgba(255,45,120,0.4)",
            color: "#FF2D78", fontSize: 11, fontWeight: 900, cursor: "pointer",
          }}
        >{t("respec")}</button>
      </div>

      {(Object.keys(byBranch) as TalentBranch[]).map((branch) => {
        const meta = BRANCH_META[branch];
        const branchNodes = byBranch[branch];
        if (branchNodes.length === 0) return null;
        return (
          <div key={branch} style={{
            padding: 10, borderRadius: 12,
            background: "rgba(15,17,21,0.55)",
            border: `1px solid ${meta.color}44`,
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
              <span style={{ fontSize: 18 }}>{meta.icon}</span>
              <div style={{ color: meta.color, fontSize: 11, fontWeight: 900, letterSpacing: 1.5 }}>
                {meta.label.toUpperCase()}
              </div>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {branchNodes.map((n) => {
                const rank = rankByNode.get(n.id) ?? 0;
                const maxed = rank >= n.max_rank;
                const prereqRank = n.requires_node_id ? (rankByNode.get(n.requires_node_id) ?? 0) : 1;
                const locked = prereqRank < 1;
                const canSpend = !maxed && !locked && pointsAvailable > 0;
                return (
                  <div key={n.id} style={{
                    display: "flex", alignItems: "center", gap: 10, padding: 8, borderRadius: 10,
                    background: maxed ? `${meta.color}18` : "rgba(26,29,35,0.8)",
                    border: `1px solid ${maxed ? meta.color : locked ? "rgba(255,255,255,0.05)" : `${meta.color}22`}`,
                    opacity: locked ? 0.55 : 1,
                  }}>
                    <div style={{
                      minWidth: 28, height: 28, borderRadius: 8,
                      display: "flex", alignItems: "center", justifyContent: "center",
                      background: maxed ? meta.color : "rgba(255,255,255,0.08)",
                      color: maxed ? "#0F1115" : "#FFF",
                      fontSize: 11, fontWeight: 900,
                    }}>{n.tier}</div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ color: "#FFF", fontSize: 12, fontWeight: 900, lineHeight: 1.2 }}>{n.name}</div>
                      <div style={{ color: "#a8b4cf", fontSize: 10, lineHeight: 1.3, marginTop: 2 }}>{n.description}</div>
                      {rank > 0 && (
                        <div style={{
                          color: meta.color, fontSize: 10, fontWeight: 900, marginTop: 3,
                          display: "inline-block", padding: "1px 6px", borderRadius: 999,
                          background: `${meta.color}18`, border: `1px solid ${meta.color}44`,
                        }}>
                          {t("activePrefix", { effect: formatTotalEffect(t, n, rank) })}
                        </div>
                      )}
                    </div>
                    <div style={{ textAlign: "right", display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4 }}>
                      <div style={{ color: maxed ? meta.color : "#a8b4cf", fontSize: 10, fontWeight: 900 }}>
                        {rank}/{n.max_rank}
                      </div>
                      <button
                        onClick={() => canSpend && handleSpend(n.id)}
                        disabled={!canSpend || busy === n.id}
                        style={{
                          padding: "4px 10px", borderRadius: 8,
                          background: canSpend ? meta.color : "rgba(255,255,255,0.06)",
                          color: canSpend ? "#0F1115" : "#6c7590",
                          border: "none", fontSize: 10, fontWeight: 900,
                          cursor: canSpend ? "pointer" : "not-allowed",
                        }}
                      >{maxed ? t("max") : locked ? "🔒" : "+1"}</button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

const EFFECT_KEY_MAP: Record<string, { labelKey: string; pct?: boolean; flat?: boolean }> = {
  hp_pct:          { labelKey: "lblHp",            pct: true },
  atk_pct:         { labelKey: "lblAtk",           pct: true },
  def_pct:         { labelKey: "lblDef",           pct: true },
  spd_pct:         { labelKey: "lblSpd",           pct: true },
  crit_pct:        { labelKey: "lblCritChance",    pct: true },
  crit_dmg:        { labelKey: "lblCritDmg",       pct: true },
  evade_pct:       { labelKey: "lblEvade",         pct: true },
  counter_pct:     { labelKey: "lblCounter",       pct: true },
  thorns_pct:      { labelKey: "lblThorns",        pct: true },
  heal_on_hit:     { labelKey: "lblHealOnHit",     pct: true },
  rage_gen:        { labelKey: "lblRageGen",       pct: true },
  rage_cost:       { labelKey: "lblRageCost",      pct: true },
  debuff_cleanse:  { labelKey: "lblCleanse",       pct: true },
  regen_pct:       { labelKey: "lblRegen",         pct: true },
  skill_dmg:       { labelKey: "lblSkillDmg",      pct: true },
  dot_dmg:         { labelKey: "lblDotDmg",        pct: true },
  dmg_reduction:   { labelKey: "lblDmgReduction",  pct: true },
  stun_resist:     { labelKey: "lblStunResist",    pct: true },
  r1_atk_pct:      { labelKey: "lblR1Atk",         pct: true },
  pen_pct:         { labelKey: "lblPen",           pct: true },
  late_atk:        { labelKey: "lblLateAtk",       pct: true },
  vs_weak:         { labelKey: "lblVsWeak",        pct: true },
  vs_full_hp:      { labelKey: "lblVsFullHp",      pct: true },
  vs_infantry:     { labelKey: "lblVsInfantry",    pct: true },
  vs_cavalry:      { labelKey: "lblVsCavalry",     pct: true },
  vs_marksman:     { labelKey: "lblVsMarksman",    pct: true },
  vs_mage:         { labelKey: "lblVsMage",        pct: true },
  all_stats_pct:   { labelKey: "lblAllStats",      pct: true },
  start_rage:      { labelKey: "lblStartRage",     flat: true },
  berserker_key:   { labelKey: "lblBerserker" },
  bollwerk_key:    { labelKey: "lblBollwerk" },
  awaken_key:      { labelKey: "lblAwaken" },
  symbiose_key:    { labelKey: "lblSymbiose" },
};

function formatTotalEffect(t: TT, n: TalentNode, rank: number): string {
  const total = n.effect_per_rank * rank;
  const e = EFFECT_KEY_MAP[n.effect_key];
  if (!e) return t("effectFallback", { sign: total > 0 ? "+" : "", total, key: n.effect_key });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const label = t(e.labelKey as any);
  if (e.pct)  return t("effectPct", { pct: Math.round(total * 1000) / 10, label });
  if (e.flat) return t("effectFlat", { total, label });
  return t("effectKeystone", { label });
}
