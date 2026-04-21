"use client";

import { useCallback, useEffect, useState } from "react";
import { GuardianAvatar } from "@/components/guardian-avatar";
import { GuardianTalentTree } from "@/components/guardian-talent-tree";
import { GuardianSkillsPanel } from "@/components/guardian-skills-panel";
import {
  rarityMeta, statsAtLevel, xpForLevel, TYPE_META,
  type GuardianArchetype, type GuardianTalent, type TalentNode,
  type ArchetypeSkill, type GuardianSkillLevel, type UserSiegel,
} from "@/lib/guardian";
import { computeEffectiveStats } from "@/lib/guardian-effective";

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

export function GuardianDetailModal({ guardianId, onClose }: { guardianId: string; onClose: () => void }) {
  const [data, setData] = useState<DetailResponse | null>(null);
  const [tab, setTab] = useState<Tab>("overview");
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await fetch(`/api/guardian/detail/${guardianId}`);
    if (!res.ok) { setError("Laden fehlgeschlagen"); return; }
    setData(await res.json());
  }, [guardianId]);

  useEffect(() => { void load(); }, [load]);

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
          <div style={{ padding: 40, textAlign: "center", color: "#a8b4cf" }}>Lade Wächter …</div>
        ) : (
          <ModalContent data={data} tab={tab} setTab={setTab} onClose={onClose} action={action} />
        )}
      </div>
    </div>
  );
}

function ModalContent({ data, tab, setTab, onClose, action }: {
  data: DetailResponse; tab: Tab; setTab: (t: Tab) => void; onClose: () => void;
  action: (body: object) => Promise<void>;
}) {
  const g = data.guardian;
  const a = g.archetype;
  const rarity = rarityMeta(a.rarity);
  const typeMeta = a.guardian_type ? TYPE_META[a.guardian_type] : null;
  const stats = statsAtLevel(a, g.level);
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
      {/* Header */}
      <div style={{
        padding: "12px 16px", display: "flex", alignItems: "center", gap: 10,
        background: `linear-gradient(135deg, ${rarity.glow}, transparent)`,
        borderBottom: "1px solid rgba(255,255,255,0.08)",
      }}>
        <div style={{ width: 70, height: 88, flexShrink: 0 }}>
          <GuardianAvatar archetype={a} size={70} animation="idle" />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ color: rarity.color, fontSize: 9, fontWeight: 900, letterSpacing: 1.5 }}>
            {rarity.label.toUpperCase()}{typeMeta ? ` · ${typeMeta.icon} ${typeMeta.label.toUpperCase()}` : ""}
          </div>
          <div style={{ color: "#FFF", fontSize: 16, fontWeight: 900 }}>{g.custom_name ?? a.name}</div>
          <div style={{ color: "#a8b4cf", fontSize: 11 }}>Level {g.level} · {g.wins}W / {g.losses}L</div>
        </div>
        <button onClick={onClose} style={{ background: "none", border: "none", color: "#8B8FA3", fontSize: 22, cursor: "pointer", width: 32, height: 32 }}>×</button>
      </div>

      {/* Stats + XP */}
      <div style={{ padding: "8px 16px", borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 4, marginBottom: 6 }}>
          <Stat label="HP"  value={eff.effective.hp}  delta={eff.delta.hp}  color="#4ade80" />
          <Stat label="ATK" value={eff.effective.atk} delta={eff.delta.atk} color="#FF6B4A" />
          <Stat label="DEF" value={eff.effective.def} delta={eff.delta.def} color="#5ddaf0" />
          <Stat label="SPD" value={eff.effective.spd} delta={eff.delta.spd} color="#FFD700" />
        </div>
        {(eff.bonusPct.crit > 0) && (
          <div style={{ fontSize: 9, color: "#a8b4cf", marginBottom: 4 }}>
            +{Math.round(eff.bonusPct.crit * 100)}% Krit-Chance durch Talente/Skills
          </div>
        )}
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 9, color: "#a8b4cf" }}>
          <span>XP</span><span>{g.xp} / {xpNext}</span>
        </div>
        <div style={{ height: 5, background: "rgba(255,255,255,0.08)", borderRadius: 3, overflow: "hidden", marginTop: 2 }}>
          <div style={{ width: `${xpPct}%`, height: "100%", background: rarity.color }} />
        </div>
      </div>

      {/* Tabs */}
      <div style={{ padding: "8px 12px", display: "flex", gap: 6, borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
        {(["overview", "talents", "skills"] as Tab[]).map((t) => (
          <button key={t} onClick={() => setTab(t)} style={{
            flex: 1, padding: "8px 4px", borderRadius: 10,
            background: tab === t ? "#22D1C3" : "rgba(255,255,255,0.06)",
            color: tab === t ? "#0F1115" : "#a8b4cf",
            border: "none", fontSize: 11, fontWeight: 900, letterSpacing: 1,
            cursor: "pointer",
          }}>
            {t === "overview" ? "ÜBERSICHT" : t === "talents" ? `TALENTE${g.talent_points_available > 0 ? ` (${g.talent_points_available})` : ""}` : "FÄHIGKEITEN"}
          </button>
        ))}
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflowY: "auto", padding: 14 }}>
        {tab === "overview" && (
          <div style={{ padding: 12, borderRadius: 12, background: "rgba(15,17,21,0.7)", border: `1px solid ${rarity.color}44` }}>
            <div style={{ color: rarity.color, fontSize: 10, fontWeight: 900, letterSpacing: 1.5 }}>⚡ SIGNATUR-FÄHIGKEIT</div>
            <div style={{ color: "#FFF", fontSize: 14, fontWeight: 900, marginTop: 2 }}>{a.ability_name}</div>
            <div style={{ color: "#a8b4cf", fontSize: 12, marginTop: 2 }}>{a.ability_desc}</div>
            {a.lore && (
              <div style={{ color: "#6c7590", fontSize: 11, marginTop: 8, fontStyle: "italic" }}>„{a.lore}"</div>
            )}
            <div style={{ marginTop: 12, padding: 10, borderRadius: 10, background: "rgba(34,209,195,0.08)", border: "1px dashed rgba(34,209,195,0.3)", fontSize: 11, color: "#a8b4cf" }}>
              💡 Wechsle zum <b>Talente</b>- oder <b>Fähigkeiten</b>-Tab, um deinen Wächter zu optimieren.
            </div>
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
    </>
  );
}

function Stat({ label, value, color, delta }: { label: string; value: number; color: string; delta?: number }) {
  return (
    <div style={{ padding: "5px 3px", borderRadius: 8, background: "rgba(15,17,21,0.6)", textAlign: "center" }}>
      <div style={{ color: "#8B8FA3", fontSize: 8, fontWeight: 800, letterSpacing: 1 }}>{label}</div>
      <div style={{ color, fontSize: 14, fontWeight: 900, marginTop: 2 }}>{value}</div>
      {delta !== undefined && delta > 0 && (
        <div style={{ color: "#4ade80", fontSize: 8, fontWeight: 900, marginTop: 1 }}>+{delta}</div>
      )}
    </div>
  );
}
