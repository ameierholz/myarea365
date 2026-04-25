"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { GuardianAvatar } from "@/components/guardian-avatar";
import { GuardianTalentTree } from "@/components/guardian-talent-tree";
import { GuardianSkillsPanel } from "@/components/guardian-skills-panel";
import {
  rarityMeta, statsAtLevel, xpForLevel, TYPE_META,
  type GuardianArchetype, type GuardianTalent, type TalentNode,
  type ArchetypeSkill, type GuardianSkillLevel, type UserSiegel,
} from "@/lib/guardian";

type DetailResponse = {
  guardian: {
    id: string; level: number; xp: number; wins: number; losses: number;
    custom_name: string | null; talent_points_available: number; talent_points_spent: number;
    archetype: GuardianArchetype;
  };
  talent_nodes: TalentNode[];
  guardian_talents: GuardianTalent[];
  archetype_skills: ArchetypeSkill[];
  guardian_skill_levels: GuardianSkillLevel[];
  siegel: UserSiegel;
};

type Tab = "overview" | "talents" | "skills";

export default function GuardianDetailPage() {
  const t = useTranslations("GuardianDetail");
  const params = useParams<{ guardianId: string }>();
  const router = useRouter();
  const [data, setData] = useState<DetailResponse | null>(null);
  const [tab, setTab] = useState<Tab>("overview");
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await fetch(`/api/guardian/detail/${params.guardianId}`);
    if (!res.ok) { setError(t("errorLoad")); return; }
    setData(await res.json());
  }, [params.guardianId, t]);

  useEffect(() => { void load(); }, [load]);

  async function action(body: object) {
    const res = await fetch(`/api/guardian/detail/${params.guardianId}`, {
      method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body),
    });
    const json = await res.json() as { ok?: boolean; error?: string };
    if (!json.ok && json.error) alert(json.error);
    await load();
  }

  if (error) return <div style={{ padding: 20, color: "#FF2D78" }}>{error}</div>;
  if (!data) return <div style={{ padding: 40, textAlign: "center", color: "#a8b4cf" }}>{t("loading")}</div>;

  const g = data.guardian;
  const a = g.archetype;
  const rarity = rarityMeta(a.rarity);
  const typeMeta = a.guardian_type ? TYPE_META[a.guardian_type] : null;
  const stats = statsAtLevel(a, g.level);
  const xpNext = xpForLevel(g.level);
  const xpPct = Math.min(100, Math.round((g.xp / xpNext) * 100));

  return (
    <div style={{ minHeight: "100vh", background: "#0F1115", color: "#F0F0F0", paddingBottom: 40 }}>
      {/* Header */}
      <div style={{
        padding: "12px 14px",
        background: `linear-gradient(180deg, ${rarity.glow}, transparent)`,
        display: "flex", alignItems: "center", gap: 10,
      }}>
        <button onClick={() => router.back()} style={{
          background: "rgba(255,255,255,0.08)", border: "none", color: "#FFF",
          width: 34, height: 34, borderRadius: 999, cursor: "pointer", fontSize: 16,
        }}>←</button>
        <div style={{ flex: 1 }}>
          <div style={{ color: rarity.color, fontSize: 9, fontWeight: 900, letterSpacing: 1.5 }}>
            {rarity.label.toUpperCase()}{typeMeta ? ` · ${typeMeta.icon} ${typeMeta.label.toUpperCase()}` : ""}
          </div>
          <div style={{ color: "#FFF", fontSize: 16, fontWeight: 900 }}>{g.custom_name ?? a.name}</div>
        </div>
      </div>

      {/* Avatar + Stats */}
      <div style={{ padding: "6px 14px 12px", display: "flex", gap: 12 }}>
        <div style={{ width: 110, flexShrink: 0 }}>
          <GuardianAvatar archetype={a} size={110} animation="idle" />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ color: "#a8b4cf", fontSize: 11 }}>{t("levelLine", { level: g.level, wins: g.wins, losses: g.losses })}</div>
          <div style={{ marginTop: 6 }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 9, color: "#a8b4cf" }}>
              <span>XP</span><span>{g.xp} / {xpNext}</span>
            </div>
            <div style={{ height: 5, background: "rgba(255,255,255,0.08)", borderRadius: 3, overflow: "hidden", marginTop: 2 }}>
              <div style={{ width: `${xpPct}%`, height: "100%", background: rarity.color }} />
            </div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 4, marginTop: 8 }}>
            <Stat label="HP"  value={stats.hp}  color="#4ade80" />
            <Stat label="ATK" value={stats.atk} color="#FF6B4A" />
            <Stat label="DEF" value={stats.def} color="#5ddaf0" />
            <Stat label="SPD" value={stats.spd} color="#FFD700" />
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ padding: "0 14px", display: "flex", gap: 6, marginBottom: 10 }}>
        {(["overview", "talents", "skills"] as Tab[]).map((tk) => (
          <button key={tk} onClick={() => setTab(tk)} style={{
            flex: 1, padding: "8px 4px", borderRadius: 10,
            background: tab === tk ? "#22D1C3" : "rgba(255,255,255,0.06)",
            color: tab === tk ? "#0F1115" : "#a8b4cf",
            border: "none", fontSize: 11, fontWeight: 900, letterSpacing: 1,
            cursor: "pointer",
          }}>
            {tk === "overview"
              ? t("tabOverview")
              : tk === "talents"
                ? (g.talent_points_available > 0 ? t("tabTalentsWithPoints", { n: g.talent_points_available }) : t("tabTalents"))
                : t("tabSkills")}
          </button>
        ))}
      </div>

      <div style={{ padding: "0 14px" }}>
        {tab === "overview" && (
          <div style={{ padding: 12, borderRadius: 12, background: "rgba(15,17,21,0.7)", border: `1px solid ${rarity.color}44` }}>
            <div style={{ color: rarity.color, fontSize: 10, fontWeight: 900, letterSpacing: 1.5 }}>{t("signatureKicker")}</div>
            <div style={{ color: "#FFF", fontSize: 14, fontWeight: 900, marginTop: 2 }}>{a.ability_name}</div>
            <div style={{ color: "#a8b4cf", fontSize: 12, marginTop: 2 }}>{a.ability_desc}</div>
            {a.lore && (
              <div style={{ color: "#6c7590", fontSize: 11, marginTop: 8, fontStyle: "italic" }}>„{a.lore}"</div>
            )}
          </div>
        )}
        {tab === "talents" && (
          <GuardianTalentTree
            guardianId={g.id}
            nodes={data.talent_nodes}
            talents={data.guardian_talents}
            pointsAvailable={g.talent_points_available}
            onSpend={(nodeId) => action({ action: "spend_talent", node_id: nodeId })}
            onRespec={() => action({ action: "respec", force: true })}
          />
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
    </div>
  );
}

function Stat({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div style={{ padding: "5px 3px", borderRadius: 8, background: "rgba(15,17,21,0.6)", textAlign: "center" }}>
      <div style={{ color: "#8B8FA3", fontSize: 8, fontWeight: 800, letterSpacing: 1 }}>{label}</div>
      <div style={{ color, fontSize: 14, fontWeight: 900, marginTop: 2 }}>{value}</div>
    </div>
  );
}
