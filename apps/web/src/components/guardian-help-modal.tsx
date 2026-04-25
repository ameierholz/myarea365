"use client";

import { useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { RARITY_META, type GuardianArchetype } from "@/lib/guardian";
import { createClient } from "@/lib/supabase/client";

type Tab = "overview" | "guardians" | "talents" | "skills" | "arena" | "boss" | "effects" | "fair";

export function GuardianHelpButton() {
  const tH = useTranslations("GuardianHelp");
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        onClick={() => setOpen(true)}
        style={{
          width: 22, height: 22, borderRadius: "50%",
          background: "rgba(168, 85, 247, 0.25)",
          border: "1px solid rgba(168, 85, 247, 0.6)",
          color: "#a855f7", fontSize: 13, fontWeight: 900,
          cursor: "pointer", lineHeight: "20px", padding: 0,
        }}
        aria-label={tH("buttonAria")}
        title={tH("buttonTitle")}
      >?</button>
      {open && <GuardianHelpModal onClose={() => setOpen(false)} />}
    </>
  );
}

export function GuardianGuideBanner() {
  const tH = useTranslations("GuardianHelp");
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<Tab>("overview");
  const chips: Array<{ icon: string; label: string; tab: Tab }> = [
    { icon: "⚔️", label: tH("chipPlay"),      tab: "overview" },
    { icon: "🛡️", label: tH("chipGuardians"), tab: "guardians" },
    { icon: "🌟", label: tH("chipTalents"),   tab: "talents" },
    { icon: "⚡", label: tH("chipSkills"),    tab: "skills" },
    { icon: "🏟️", label: tH("chipArena"),     tab: "arena" },
    { icon: "👹", label: tH("chipBoss"),      tab: "boss" },
  ];
  return (
    <>
      <div style={{
        padding: 14, borderRadius: 14,
        background: "linear-gradient(135deg, rgba(168,85,247,0.2), rgba(34,209,195,0.1))",
        border: "1px solid rgba(168,85,247,0.4)",
        marginBottom: 14,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
          <span style={{ fontSize: 22 }}>📖</span>
          <div style={{ color: "#FFF", fontSize: 14, fontWeight: 900 }}>{tH("guideHeader")}</div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 8 }}>
          {chips.map((chip) => (
            <button
              key={chip.tab}
              onClick={() => { setTab(chip.tab); setOpen(true); }}
              style={{
                display: "flex", alignItems: "center", gap: 6,
                padding: "8px 10px", borderRadius: 10,
                background: "rgba(15,17,21,0.5)",
                border: "1px solid rgba(168,85,247,0.3)",
                color: "#FFF", fontSize: 11, fontWeight: 800,
                cursor: "pointer", textAlign: "left",
              }}
            >
              <span style={{ fontSize: 16 }}>{chip.icon}</span>
              <span>{chip.label}</span>
            </button>
          ))}
        </div>
      </div>
      {open && <GuardianHelpModal initialTab={tab} onClose={() => setOpen(false)} />}
    </>
  );
}

export function GuardianHelpModal({ onClose, initialTab = "overview" }: { onClose: () => void; initialTab?: Tab }) {
  const tH = useTranslations("GuardianHelp");
  const [tab, setTab] = useState<Tab>(initialTab);
  const TABS: Array<{ id: Tab; icon: string; label: string }> = [
    { id: "overview",  icon: "🧭", label: tH("tabOverview") },
    { id: "guardians", icon: "🛡️", label: tH("tabGuardians") },
    { id: "talents",   icon: "🌟", label: tH("tabTalents") },
    { id: "skills",    icon: "⚡", label: tH("tabSkills") },
    { id: "arena",     icon: "🏟️", label: tH("tabArena") },
    { id: "boss",      icon: "👹", label: tH("tabBoss") },
    { id: "effects",   icon: "✨", label: tH("tabEffects") },
    { id: "fair",      icon: "⚖️", label: tH("tabFair") },
  ];
  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed", inset: 0, zIndex: 3600,
        background: "rgba(15,17,21,0.92)", backdropFilter: "blur(14px)",
        display: "flex", alignItems: "center", justifyContent: "center", padding: 16,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "100%", maxWidth: 640, maxHeight: "92vh",
          display: "flex", flexDirection: "column",
          background: "#1A1D23", borderRadius: 20,
          border: "1px solid rgba(168,85,247,0.5)",
          boxShadow: "0 0 40px rgba(168,85,247,0.3)",
          color: "#F0F0F0", overflow: "hidden",
        }}
      >
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "16px 20px 10px", borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
          <span style={{ fontSize: 26 }}>🛡️</span>
          <div style={{ flex: 1 }}>
            <div style={{ color: "#FFF", fontSize: 16, fontWeight: 900 }}>{tH("modalTitle")}</div>
            <div style={{ color: "#a855f7", fontSize: 9, fontWeight: 800, letterSpacing: 1 }}>{tH("modalKicker")}</div>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", color: "#8B8FA3", fontSize: 22, cursor: "pointer" }}>×</button>
        </div>

        {/* Tabs */}
        <div style={{ display: "flex", gap: 4, padding: "8px 12px", borderBottom: "1px solid rgba(255,255,255,0.08)", overflowX: "auto", flexShrink: 0 }}>
          {TABS.map((t) => {
            const active = tab === t.id;
            return (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                style={{
                  flex: "0 0 auto",
                  padding: "7px 11px", borderRadius: 9,
                  background: active ? "#a855f7" : "transparent",
                  color: active ? "#FFF" : "#a8b4cf",
                  border: "1px solid " + (active ? "#a855f7" : "rgba(255,255,255,0.08)"),
                  fontSize: 11, fontWeight: 800, cursor: "pointer",
                  whiteSpace: "nowrap",
                  display: "inline-flex", alignItems: "center", gap: 5,
                }}
              >
                <span style={{ fontSize: 13 }}>{t.icon}</span>
                <span>{t.label}</span>
              </button>
            );
          })}
        </div>

        {/* Content */}
        <div style={{ flex: 1, overflowY: "auto", padding: "16px 20px" }}>
          {tab === "overview"  && <OverviewTab />}
          {tab === "guardians" && <GuardiansTab />}
          {tab === "talents"   && <TalentsTab />}
          {tab === "skills"    && <SkillsTab />}
          {tab === "arena"     && <ArenaTab />}
          {tab === "boss"      && <BossTab />}
          {tab === "effects"   && <EffectsTab />}
          {tab === "fair"      && <FairTab />}
        </div>

        {/* Footer */}
        <div style={{ padding: 14, borderTop: "1px solid rgba(255,255,255,0.08)", display: "flex", gap: 8 }}>
          <button onClick={onClose} style={{
            flex: 1, padding: 12, borderRadius: 10,
            background: "#22D1C3", color: "#0F1115",
            border: "none", fontSize: 13, fontWeight: 900, cursor: "pointer",
          }}>{tH("gotIt")}</button>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════
   TAB: ÜBERSICHT — Der Haupt-Loop
   ═══════════════════════════════════════════════════════ */
const richB = { b: (chunks: React.ReactNode) => <b>{chunks}</b> };
const richAB = {
  a: (chunks: React.ReactNode) => <b style={{ color: "#4ade80" }}>{chunks}</b>,
  b: (chunks: React.ReactNode) => <b style={{ color: "#FF6B4A" }}>{chunks}</b>,
};

function OverviewTab() {
  const tH = useTranslations("GuardianHelp");
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <Hero>{tH.rich("ovHeroRich", richB)}</Hero>

      <StepLoop steps={[
        { icon: "🏃", title: tH("ovStep1Title"), text: tH("ovStep1Text") },
        { icon: "📈", title: tH("ovStep2Title"), text: tH("ovStep2Text") },
        { icon: "⚔️", title: tH("ovStep3Title"), text: tH("ovStep3Text") },
        { icon: "⚡", title: tH("ovStep4Title"), text: tH("ovStep4Text") },
      ]} />

      <Card title={tH("ovSpecialTitle")} color="#a855f7">
        <ul style={{ margin: 0, paddingLeft: 18, lineHeight: 1.7 }}>
          <li>{tH.rich("ovSpecial1Rich", richB)}</li>
          <li>{tH.rich("ovSpecial2Rich", richB)}</li>
          <li>{tH.rich("ovSpecial3Rich", richB)}</li>
          <li>{tH.rich("ovSpecial4Rich", richB)}</li>
          <li>{tH.rich("ovSpecial5Rich", richB)}</li>
          <li>{tH.rich("ovSpecial6Rich", richB)}</li>
        </ul>
      </Card>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════
   TAB: WÄCHTER — 60 Archetypen nach Typ
   ═══════════════════════════════════════════════════════ */
function GuardiansTab() {
  const tH = useTranslations("GuardianHelp");
  const [archetypes, setArchetypes] = useState<Array<GuardianArchetype & { guardian_type?: string | null; role?: string | null }>>([]);
  useEffect(() => {
    const sb = createClient();
    sb.from("guardian_archetypes").select("*").order("rarity").order("name")
      .then(({ data }) => { if (data) setArchetypes(data as Array<GuardianArchetype & { guardian_type?: string | null; role?: string | null }>); });
  }, []);

  const byType = useMemo(() => {
    const map = new Map<string, typeof archetypes>();
    for (const a of archetypes) {
      const t = a.guardian_type ?? "unknown";
      const list = map.get(t) ?? [];
      list.push(a);
      map.set(t, list);
    }
    return map;
  }, [archetypes]);

  const typeMeta: Record<string, { label: string; color: string; emoji: string; desc: string }> = {
    infantry: { label: tH("gdInfantryLabel"), color: "#60a5fa", emoji: "🛡️", desc: tH("gdInfantryDesc") },
    cavalry:  { label: tH("gdCavalryLabel"),  color: "#fb923c", emoji: "🐎", desc: tH("gdCavalryDesc") },
    marksman: { label: tH("gdMarksmanLabel"), color: "#4ade80", emoji: "🏹", desc: tH("gdMarksmanDesc") },
    mage:     { label: tH("gdMageLabel"),     color: "#c084fc", emoji: "🔮", desc: tH("gdMageDesc") },
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <Hero>{tH.rich("gdHeroRich", richB)}</Hero>

      <Card title={tH("gdRpsTitle")} color="#FFD700">
        {tH.rich("gdRpsBodyRich", richB)}
        <div style={{ color: "#a8b4cf", fontSize: 11, marginTop: 6 }}>
          {tH.rich("gdRpsAdvDmgRich", richAB)}
        </div>
      </Card>

      {(["infantry","cavalry","marksman","mage"] as const).map((type) => {
        const meta = typeMeta[type];
        const list = byType.get(type) ?? [];
        if (list.length === 0) return null;
        return (
          <Card key={type} title={tH("gdTypeHeader", { emoji: meta.emoji, label: meta.label, count: list.length })} color={meta.color}>
            <div style={{ fontSize: 11, color: "#a8b4cf", marginBottom: 8, fontStyle: "italic" }}>{meta.desc}</div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(110px, 1fr))", gap: 6 }}>
              {list.map((a) => {
                const r = RARITY_META[a.rarity];
                return (
                  <div key={a.id} title={a.lore ?? a.ability_desc ?? ""} style={{
                    padding: 7, borderRadius: 8,
                    background: `linear-gradient(135deg, ${r.glow}, rgba(15,17,21,0.7))`,
                    border: `1px solid ${r.color}55`,
                    textAlign: "center",
                  }}>
                    <div style={{ fontSize: 20 }}>{a.emoji}</div>
                    <div style={{ color: r.color, fontSize: 8, fontWeight: 900, letterSpacing: 0.8 }}>{r.label.toUpperCase()}</div>
                    <div style={{ color: "#FFF", fontSize: 10, fontWeight: 800, marginTop: 1 }}>{a.name}</div>
                    {a.role && (
                      <div style={{ color: "#a8b4cf", fontSize: 8, marginTop: 1 }}>{a.role}</div>
                    )}
                  </div>
                );
              })}
            </div>
          </Card>
        );
      })}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════
   TAB: TALENTE — Talentbaum erklären
   ═══════════════════════════════════════════════════════ */
function TalentsTab() {
  const tH = useTranslations("GuardianHelp");
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <Hero>{tH.rich("talHeroRich", richB)}</Hero>

      <Card title={tH("talBranchesTitle")} color="#22D1C3">
        <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 6 }}>
          <BranchRow icon="⚔️" color="#FF2D78" label={tH("talBranchSpecLabel")} desc={tH("talBranchSpecDesc")} />
          <BranchRow icon="🔷" color="#22D1C3" label={tH("talBranchSynergyLabel")} desc={tH("talBranchSynergyDesc")} />
          <BranchRow icon="✨" color="#FFD700" label={tH("talBranchUtilityLabel")} desc={tH("talBranchUtilityDesc")} />
        </div>
      </Card>

      <Card title={tH("talNodesTitle")} color="#a855f7">
        <ul style={{ margin: 0, paddingLeft: 18, lineHeight: 1.7, fontSize: 12 }}>
          <li>{tH.rich("talNode1Rich", richB)}</li>
          <li>{tH.rich("talNode2Rich", richB)}</li>
          <li>{tH.rich("talNode3Rich", richB)}</li>
          <li>{tH.rich("talNode4Rich", richB)}</li>
        </ul>
      </Card>
    </div>
  );
}

function BranchRow({ icon, color, label, desc }: { icon: string; color: string; label: string; desc: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 10px", borderRadius: 8, background: "rgba(15,17,21,0.6)", border: `1px solid ${color}33` }}>
      <span style={{ fontSize: 18 }}>{icon}</span>
      <div style={{ flex: 1 }}>
        <div style={{ color, fontSize: 11, fontWeight: 900 }}>{label}</div>
        <div style={{ color: "#a8b4cf", fontSize: 10, marginTop: 1 }}>{desc}</div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════
   TAB: FÄHIGKEITEN — 5 Skills × 5 Stufen
   ═══════════════════════════════════════════════════════ */
function SkillsTab() {
  const tH = useTranslations("GuardianHelp");
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <Hero>{tH.rich("skHeroRich", richB)}</Hero>

      <Card title={tH("skSlotsTitle")} color="#22D1C3">
        <SkillRow icon="⚡"  color="#FFD700" label={tH("skSlotActiveLabel")}    desc={tH("skSlotActiveDesc")} />
        <SkillRow icon="🛡️" color="#60a5fa" label={tH("skSlotPassiveLabel")}   desc={tH("skSlotPassiveDesc")} />
        <SkillRow icon="⚔️" color="#FF2D78" label={tH("skSlotCombatLabel")}    desc={tH("skSlotCombatDesc")} />
        <SkillRow icon="🎭" color="#4ade80" label={tH("skSlotRoleLabel")}      desc={tH("skSlotRoleDesc")} />
        <SkillRow icon="💎" color="#c084fc" label={tH("skSlotExpertiseLabel")} desc={tH("skSlotExpertiseDesc")} />
      </Card>

      <Card title={tH("skSiegelTitle")} color="#FFD700">
        <div style={{ fontSize: 12, lineHeight: 1.6 }}>
          {tH.rich("skSiegelBodyRich", richB)}
        </div>
        <ul style={{ margin: "6px 0", paddingLeft: 18, fontSize: 11, lineHeight: 1.5, color: "#a8b4cf" }}>
          <li>{tH.rich("skSiegel1Rich", richB)}</li>
          <li>{tH.rich("skSiegel2Rich", richB)}</li>
          <li>{tH.rich("skSiegel3Rich", richB)}</li>
          <li>{tH.rich("skSiegel4Rich", richB)}</li>
        </ul>
        <div style={{ fontSize: 10, color: "#22D1C3", fontStyle: "italic" }}>
          {tH("skSiegelCost")}
        </div>
      </Card>

      <Card title={tH("skRageTitle")} color="#FF6B4A">
        <div style={{ fontSize: 12, lineHeight: 1.6 }}>
          {tH.rich("skRageBodyRich", richB)}
        </div>
      </Card>
    </div>
  );
}

function SkillRow({ icon, color, label, desc }: { icon: string; color: string; label: string; desc: string }) {
  return (
    <div style={{ display: "flex", alignItems: "flex-start", gap: 8, padding: "6px 10px", borderRadius: 8, background: "rgba(15,17,21,0.6)", border: `1px solid ${color}33`, marginBottom: 4 }}>
      <span style={{ fontSize: 16 }}>{icon}</span>
      <div style={{ flex: 1 }}>
        <div style={{ color, fontSize: 11, fontWeight: 900 }}>{label}</div>
        <div style={{ color: "#a8b4cf", fontSize: 10, marginTop: 1 }}>{desc}</div>
      </div>
    </div>
  );
}


/* ═══════════════════════════════════════════════════════
   TAB: ARENA
   ═══════════════════════════════════════════════════════ */
function ArenaTab() {
  const tH = useTranslations("GuardianHelp");
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <Hero>{tH.rich("arHeroRich", richB)}</Hero>

      <Card title={tH("arRulesTitle")} color="#FFD700">
        <ul style={{ margin: 0, paddingLeft: 18, lineHeight: 1.7 }}>
          <li>{tH.rich("arRule1Rich", richB)}</li>
          <li>{tH.rich("arRule2Rich", richB)}</li>
          <li>{tH.rich("arRule3Rich", richB)}</li>
          <li>{tH.rich("arRule4Rich", richB)}</li>
          <li>{tH.rich("arRule5Rich", richB)}</li>
          <li>{tH.rich("arRule6Rich", richB)}</li>
        </ul>
      </Card>

      <Card title={tH("arRewardsTitle")} color="#4ade80">
        <ul style={{ margin: 0, paddingLeft: 18, lineHeight: 1.7 }}>
          <li>{tH.rich("arReward1Rich", richB)}</li>
          <li>{tH.rich("arReward2Rich", richB)}</li>
          <li>{tH.rich("arReward3Rich", richB)}</li>
          <li>{tH.rich("arReward4Rich", richB)}</li>
          <li>{tH.rich("arReward5Rich", richB)}</li>
          <li>{tH.rich("arReward6Rich", richB)}</li>
          <li>{tH.rich("arReward7Rich", richB)}</li>
        </ul>
      </Card>

      <Card title={tH("arLeagueTitle")} color="#FF6B4A">
        <div style={{ fontSize: 12, lineHeight: 1.55 }}>
          {tH.rich("arLeagueBodyRich", richB)}
        </div>
        <ul style={{ margin: "6px 0 0 0", paddingLeft: 18, lineHeight: 1.7, fontSize: 12 }}>
          <li>{tH.rich("arLeague1Rich", richB)}</li>
          <li>{tH.rich("arLeague2Rich", richB)}</li>
          <li>{tH.rich("arLeague3Rich", richB)}</li>
          <li>{tH.rich("arLeague4Rich", richB)}</li>
        </ul>
      </Card>

      <Card title={tH("arSpecialTitle")} color="#a855f7">
        {tH.rich("arSpecialBodyRich", richB)}
      </Card>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════
   TAB: AREA-BOSS
   ═══════════════════════════════════════════════════════ */
function BossTab() {
  const tH = useTranslations("GuardianHelp");
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <Hero>{tH.rich("bsHeroRich", richB)}</Hero>

      <Card title={tH("bsWinnerTitle")} color="#FFD700">
        <div style={{ fontSize: 12, lineHeight: 1.6 }}>
          {tH.rich("bsWinnerBodyRich", richB)}
        </div>
        <ul style={{ margin: "6px 0 0 0", paddingLeft: 18, lineHeight: 1.7 }}>
          <li>{tH.rich("bsWinner1Rich", richB)}</li>
          <li>{tH("bsWinner2")}</li>
          <li>{tH("bsWinner3")}</li>
        </ul>
      </Card>

      <Card title={tH("bsParticipantsTitle")} color="#a855f7">
        <div style={{ fontSize: 12, lineHeight: 1.6 }}>
          {tH.rich("bsParticipantsBodyRich", richB)}
        </div>
      </Card>

      <Card title={tH("bsLootTitle")} color="#FF2D78">
        <div style={{ display: "flex", flexDirection: "column", gap: 5, fontSize: 12 }}>
          <LootRow participants={tH("bsLootRowMany")} badges={[
            { label: tH("bsLootBadgeLegend"), color: "#FFD700" },
            { label: tH("bsLootBadgeEpic"),   color: "#a855f7" },
            { label: tH("bsLootBadgeRare"),   color: "#22D1C3" },
          ]} />
          <LootRow participants={tH("bsLootRowMid")} badges={[
            { label: tH("bsLootBadgeLegend"), color: "#FFD700" },
            { label: tH("bsLootBadgeEpic"),   color: "#a855f7" },
          ]} />
          <LootRow participants={tH("bsLootRowFew")} badges={[
            { label: tH("bsLootBadgeLegend"), color: "#FFD700" },
          ]} />
        </div>
        <div style={{ fontSize: 10, color: "#8B8FA3", marginTop: 8, fontStyle: "italic" }}>
          {tH("bsLootNote")}
        </div>
      </Card>

      <Card title={tH("bsRolesTitle")} color="#5ddaf0">
        <ul style={{ margin: 0, paddingLeft: 18, lineHeight: 1.7 }}>
          <li>{tH.rich("bsRole1Rich", richB)}</li>
          <li>{tH.rich("bsRole2Rich", richB)}</li>
          <li>{tH.rich("bsRole3Rich", richB)}</li>
          <li>{tH.rich("bsRole4Rich", richB)}</li>
        </ul>
      </Card>

      <Card title={tH("bsImportantTitle")} color="#FF6B4A">
        {tH.rich("bsImportantBodyRich", richB)}
      </Card>
    </div>
  );
}

function LootRow({ participants, badges }: { participants: string; badges: Array<{ label: string; color: string }> }) {
  return (
    <div style={{
      display: "flex", alignItems: "center", justifyContent: "space-between",
      padding: "6px 10px", borderRadius: 8,
      background: "rgba(15,17,21,0.5)",
      border: "1px solid rgba(255,255,255,0.06)",
    }}>
      <span style={{ color: "#DDD", fontSize: 11, fontWeight: 700 }}>{participants}</span>
      <div style={{ display: "flex", gap: 4 }}>
        {badges.map((b) => (
          <span key={b.label} style={{
            padding: "2px 7px", borderRadius: 999,
            background: `${b.color}22`, color: b.color,
            border: `1px solid ${b.color}55`,
            fontSize: 9, fontWeight: 900, letterSpacing: 0.4,
          }}>{b.label}</span>
        ))}
      </div>
    </div>
  );
}


/* ═══════════════════════════════════════════════════════
   TAB: FAIR-PLAY
   ═══════════════════════════════════════════════════════ */
function EffectsTab() {
  const tH = useTranslations("GuardianHelp");
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <Hero>{tH.rich("efHeroRich", richB)}</Hero>

      <Card title={tH("efDebuffsTitle")} color="#FF2D78">
        <EffectRow icon="😵" name={tH("efDebuffStunName")}   color="#FFD700" desc={tH("efDebuffStunDesc")} />
        <EffectRow icon="☠️" name={tH("efDebuffPoisonName")} color="#a855f7" desc={tH("efDebuffPoisonDesc")} />
        <EffectRow icon="🔥" name={tH("efDebuffFlameName")}  color="#FF6B4A" desc={tH("efDebuffFlameDesc")} />
      </Card>

      <Card title={tH("efSurvivalTitle")} color="#4ade80">
        <EffectRow icon="💚" name={tH("efRegenName")}     color="#4ade80" desc={tH("efRegenDesc")} />
        <EffectRow icon="🩸" name={tH("efLifestealName")} color="#FF2D78" desc={tH("efLifestealDesc")} />
        <EffectRow icon="🪽" name={tH("efRebirthName")}   color="#FF6B4A" desc={tH("efRebirthDesc")} />
        <EffectRow icon="🐈" name={tH("efNineLivesName")} color="#FFD700" desc={tH("efNineLivesDesc")} />
        <EffectRow icon="✨" name={tH("efCleanseName")}   color="#a855f7" desc={tH("efCleanseDesc")} />
      </Card>

      <Card title={tH("efOffensiveTitle")} color="#FFD700">
        <EffectRow icon="💥" name={tH("efCritName")}        color="#FFD700" desc={tH("efCritDesc")} />
        <EffectRow icon="🔥" name={tH("efBerserkerName")}   color="#FF2D78" desc={tH("efBerserkerDesc")} />
        <EffectRow icon="☯️" name={tH("efSymbioseName")}    color="#4ade80" desc={tH("efSymbioseDesc")} />
        <EffectRow icon="🌵" name={tH("efThornsName")}      color="#FFD700" desc={tH("efThornsDesc")} />
        <EffectRow icon="⚔️" name={tH("efCounterName")}     color="#5ddaf0" desc={tH("efCounterDesc")} />
        <EffectRow icon="🎯" name={tH("efFirstStrikeName")} color="#FFD700" desc={tH("efFirstStrikeDesc")} />
        <EffectRow icon="⚰️" name={tH("efMercyStrikeName")} color="#FF2D78" desc={tH("efMercyStrikeDesc")} />
      </Card>

      <Card title={tH("efDefensiveTitle")} color="#60a5fa">
        <EffectRow icon="🛡️" name={tH("efBulwarkName")} color="#60a5fa" desc={tH("efBulwarkDesc")} />
        <EffectRow icon="🍃" name={tH("efDodgeName")}   color="#22D1C3" desc={tH("efDodgeDesc")} />
        <EffectRow icon="💪" name={tH("efDmgRedName")}  color="#60a5fa" desc={tH("efDmgRedDesc")} />
      </Card>

      <Card title={tH("efRageTitle")} color="#a855f7">
        <EffectRow icon="⚡" name={tH("efRageName")}      color="#a855f7" desc={tH("efRageDesc")} />
        <EffectRow icon="✨" name={tH("efAwakeningName")} color="#a855f7" desc={tH("efAwakeningDesc")} />
        <EffectRow icon="💥" name={tH("efUltName")}       color="#FF2D78" desc={tH("efUltDesc")} />
      </Card>

      <Card title={tH("efTypeRoleTitle")} color="#22D1C3">
        <EffectRow icon="⚔️" name={tH("efTypeAdvName")}    color="#4ade80" desc={tH("efTypeAdvDesc")} />
        <EffectRow icon="🎭" name={tH("efRoleBonusName")}  color="#22D1C3" desc={tH("efRoleBonusDesc")} />
        <EffectRow icon="🌍" name={tH("efPowerZoneName")}  color="#22D1C3" desc={tH("efPowerZoneDesc")} />
      </Card>
    </div>
  );
}

function EffectRow({ icon, name, color, desc }: { icon: string; name: string; color: string; desc: string }) {
  return (
    <div style={{ display: "flex", gap: 10, padding: "8px 0", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
      <div style={{
        flexShrink: 0, width: 32, height: 32, borderRadius: 8,
        background: `${color}22`, border: `1px solid ${color}66`,
        display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16,
      }}>{icon}</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ color, fontSize: 12, fontWeight: 900 }}>{name}</div>
        <div style={{ color: "#a8b4cf", fontSize: 11, lineHeight: 1.45, marginTop: 1 }}>{desc}</div>
      </div>
    </div>
  );
}

function FairTab() {
  const tH = useTranslations("GuardianHelp");
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <Hero>{tH.rich("frHeroRich", richB)}</Hero>

      <Card title={tH("frP2WTitle")} color="#4ade80">
        <ul style={{ margin: 0, paddingLeft: 18, lineHeight: 1.7 }}>
          <li>{tH.rich("frP2W1Rich", richB)}</li>
          <li>{tH.rich("frP2W2Rich", richB)}</li>
          <li>{tH.rich("frP2W3Rich", richB)}</li>
        </ul>
      </Card>

      <Card title={tH("frDropsTitle")} color="#FFD700">
        <div style={{ fontSize: 12, lineHeight: 1.6, marginBottom: 8 }}>
          {tH("frDropsBody")}
        </div>
        <Link href="/loot-drops" style={{
          display: "inline-block", padding: "8px 12px", borderRadius: 8,
          background: "rgba(255,215,0,0.15)", border: "1px solid #FFD700",
          color: "#FFD700", fontSize: 11, fontWeight: 900, textDecoration: "none",
        }}>{tH("frDropsBtn")}</Link>
      </Card>

      <Card title={tH("frGpsTitle")} color="#a855f7">
        {tH("frGpsBody")}
        <ul style={{ margin: "4px 0 0 0", paddingLeft: 18, lineHeight: 1.7 }}>
          <li>{tH.rich("frGps1Rich", richB)}</li>
          <li>{tH.rich("frGps2Rich", richB)}</li>
          <li>{tH.rich("frGps3Rich", richB)}</li>
          <li>{tH.rich("frGps4Rich", richB)}</li>
        </ul>
      </Card>

      <Card title={tH("frMonetTitle")} color="#5ddaf0">
        {tH.rich("frMonetBodyRich", richB)}
      </Card>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════
   Shared Components
   ═══════════════════════════════════════════════════════ */
function Hero({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      padding: 14, borderRadius: 12,
      background: "linear-gradient(135deg, rgba(168,85,247,0.18), rgba(34,209,195,0.10))",
      border: "1px solid rgba(168,85,247,0.3)",
      fontSize: 13, lineHeight: 1.55, color: "#E5E8ED",
    }}>
      {children}
    </div>
  );
}

function Card({ title, color, children }: { title: string; color: string; children: React.ReactNode }) {
  return (
    <div style={{
      padding: 12, borderRadius: 12,
      background: "rgba(70, 82, 122, 0.22)",
      border: `1px solid ${color}33`,
    }}>
      <div style={{ color, fontSize: 12, fontWeight: 900, marginBottom: 8, letterSpacing: 0.3 }}>{title}</div>
      <div style={{ color: "#D4D8E0", fontSize: 12, lineHeight: 1.55 }}>{children}</div>
    </div>
  );
}

function StepLoop({ steps }: { steps: Array<{ icon: string; title: string; text: string }> }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      {steps.map((s, i) => (
        <div key={i} style={{
          display: "flex", gap: 10, alignItems: "flex-start",
          padding: "10px 12px", borderRadius: 10,
          background: "rgba(15,17,21,0.5)",
          border: "1px solid rgba(255,255,255,0.06)",
        }}>
          <div style={{ fontSize: 20, flexShrink: 0 }}>{s.icon}</div>
          <div style={{ flex: 1 }}>
            <div style={{ color: "#FFF", fontSize: 12, fontWeight: 900 }}>{s.title}</div>
            <div style={{ color: "#a8b4cf", fontSize: 11, marginTop: 2, lineHeight: 1.4 }}>{s.text}</div>
          </div>
        </div>
      ))}
    </div>
  );
}
