"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import {
  SKILL_SLOT_META, SIEGEL_META, skillUpgradeCost, siegelForType,
  type ArchetypeSkill, type GuardianSkillLevel, type GuardianType, type UserSiegel,
} from "@/lib/guardian";

type Props = {
  skills: ArchetypeSkill[];
  skillLevels: GuardianSkillLevel[];
  guardianType: GuardianType | null;
  siegel: UserSiegel | null;
  onUpgrade: (skillId: string) => Promise<void>;
};

export function GuardianSkillsPanel(props: Props) {
  const t = useTranslations("GuardianSkills");
  const { skills, skillLevels, guardianType, siegel, onUpgrade } = props;
  const [busy, setBusy] = useState<string | null>(null);

  const levelMap = useMemo(() => {
    const m = new Map<string, number>();
    for (const s of skillLevels) m.set(s.skill_id, s.level);
    return m;
  }, [skillLevels]);

  const sorted = useMemo(
    () => [...skills].sort((a, b) => SKILL_SLOT_META[a.skill_slot].order - SKILL_SLOT_META[b.skill_slot].order),
    [skills],
  );

  const expertiseUnlocked = useMemo(() => {
    return sorted.filter((s) => s.skill_slot !== "expertise").every((s) => (levelMap.get(s.id) ?? 0) >= 5);
  }, [sorted, levelMap]);

  const availableSiegel = guardianType ? siegelForType(siegel, guardianType) : 0;
  const siegelMeta = guardianType ? SIEGEL_META[guardianType] : null;

  async function handleUpgrade(id: string) {
    setBusy(id);
    try { await onUpgrade(id); } finally { setBusy(null); }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <div style={{
        display: "flex", alignItems: "center", gap: 10, padding: 10, borderRadius: 10,
        background: "rgba(15,17,21,0.7)", border: "1px solid rgba(255,255,255,0.08)",
      }}>
        <div style={{ fontSize: 20 }}>{siegelMeta?.icon ?? "🔒"}</div>
        <div style={{ flex: 1 }}>
          <div style={{ color: "#a8b4cf", fontSize: 9, fontWeight: 900, letterSpacing: 1.5 }}>
            {siegelMeta?.label ?? t("noType")}
          </div>
          <div style={{ color: "#FFF", fontSize: 16, fontWeight: 900 }}>{availableSiegel}</div>
        </div>
        <div style={{ fontSize: 20 }}>{SIEGEL_META.universal.icon}</div>
        <div>
          <div style={{ color: "#a8b4cf", fontSize: 9, fontWeight: 900, letterSpacing: 1.5 }}>{t("universal")}</div>
          <div style={{ color: "#FFD700", fontSize: 16, fontWeight: 900 }}>{siegel?.siegel_universal ?? 0}</div>
        </div>
      </div>

      {sorted.map((s) => {
        const level = levelMap.get(s.id) ?? 0;
        const maxed = level >= 5;
        const locked = s.skill_slot === "expertise" && !expertiseUnlocked;
        const cost = skillUpgradeCost(level, s.skill_slot === "expertise");
        const canAfford = availableSiegel >= cost;
        const canUpgrade = !maxed && !locked && canAfford;
        const meta = SKILL_SLOT_META[s.skill_slot];
        return (
          <div key={s.id} style={{
            padding: 10, borderRadius: 10,
            background: locked ? "rgba(15,17,21,0.45)" : "rgba(26,29,35,0.9)",
            border: `1px solid ${maxed ? "#FFD700" : s.skill_slot === "expertise" ? "rgba(255,215,0,0.4)" : "rgba(255,255,255,0.08)"}`,
            opacity: locked ? 0.55 : 1,
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: 18 }}>{meta.icon}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ color: "#a8b4cf", fontSize: 9, fontWeight: 900, letterSpacing: 1.5 }}>{meta.label.toUpperCase()}</div>
                <div style={{ color: "#FFF", fontSize: 13, fontWeight: 900, lineHeight: 1.2 }}>{s.name}</div>
              </div>
              <div style={{ color: maxed ? "#FFD700" : "#a8b4cf", fontSize: 11, fontWeight: 900 }}>
                {level}/5
              </div>
            </div>
            <div style={{ color: "#a8b4cf", fontSize: 11, marginTop: 4, lineHeight: 1.4 }}>{s.description}</div>

            {(() => {
              const base = Number(s.base_value ?? 0);
              const perLvl = Number(s.per_level_value ?? 0);
              if (base === 0 && perLvl === 0) return null;
              const currentEffect = level > 0 ? base + (level - 1) * perLvl : 0;
              const nextEffect = !maxed ? base + level * perLvl : null;
              const fmt = (n: number) => Number.isInteger(n) ? `${n}` : n.toFixed(1);
              return (
                <div style={{
                  marginTop: 6, padding: "5px 8px", borderRadius: 6,
                  background: "rgba(34,209,195,0.07)", border: "1px solid rgba(34,209,195,0.18)",
                  display: "flex", alignItems: "baseline", gap: 8, flexWrap: "wrap",
                }}>
                  <span style={{ color: "#8B8FA3", fontSize: 9, fontWeight: 800, letterSpacing: 0.5 }}>{t("current")}</span>
                  <span style={{ color: level > 0 ? "#22D1C3" : "#6c7590", fontSize: 13, fontWeight: 900 }}>
                    {level > 0 ? fmt(currentEffect) : "—"}
                  </span>
                  {nextEffect !== null && (
                    <>
                      <span style={{ color: "#6c7590", fontSize: 11 }}>→</span>
                      <span style={{ color: "#a8b4cf", fontSize: 9, fontWeight: 800, letterSpacing: 0.5 }}>{t("level", { n: level + 1 })}</span>
                      <span style={{ color: "#FFD700", fontSize: 13, fontWeight: 900 }}>
                        {fmt(nextEffect)} <span style={{ color: "#4ade80", fontSize: 10 }}>(+{fmt(nextEffect - currentEffect)})</span>
                      </span>
                    </>
                  )}
                </div>
              );
            })()}

            {s.rage_cost > 0 && (
              <div style={{ color: "#FF6B4A", fontSize: 10, marginTop: 4, fontWeight: 800 }}>
                {t("rageCost", { n: s.rage_cost })}
              </div>
            )}
            <div style={{ marginTop: 8, display: "flex", alignItems: "center", gap: 8 }}>
              <div style={{ flex: 1, height: 5, background: "rgba(255,255,255,0.08)", borderRadius: 3, overflow: "hidden" }}>
                <div style={{
                  width: `${(level / 5) * 100}%`, height: "100%",
                  background: maxed ? "#FFD700" : "#22D1C3", transition: "width 0.3s",
                }} />
              </div>
              <button
                onClick={() => canUpgrade && handleUpgrade(s.id)}
                disabled={!canUpgrade || busy === s.id}
                style={{
                  padding: "5px 10px", borderRadius: 8,
                  background: canUpgrade ? "linear-gradient(135deg, #22D1C3, #FFD700)" : "rgba(255,255,255,0.06)",
                  color: canUpgrade ? "#0F1115" : "#6c7590",
                  border: "none", fontSize: 10, fontWeight: 900,
                  cursor: canUpgrade ? "pointer" : "not-allowed",
                  whiteSpace: "nowrap",
                }}
              >
                {maxed ? t("max")
                  : locked ? t("lockedExpertise")
                  : t("upgradeBtn", { cost, icon: siegelMeta?.icon ?? "⚡" })}
              </button>
            </div>
            {!canAfford && !maxed && !locked && (
              <div style={{ color: "#FF2D78", fontSize: 10, marginTop: 4 }}>
                {t("notEnoughSiegel", { have: availableSiegel, need: cost })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
