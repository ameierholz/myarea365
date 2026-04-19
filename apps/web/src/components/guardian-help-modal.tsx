"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { RARITY_META, type GuardianArchetype } from "@/lib/guardian";
import { createClient } from "@/lib/supabase/client";

type Tab = "overview" | "guardians" | "talents" | "skills" | "arena" | "boss" | "fair";

const TABS: Array<{ id: Tab; icon: string; label: string }> = [
  { id: "overview",  icon: "🧭", label: "Übersicht" },
  { id: "guardians", icon: "🛡️", label: "60 Wächter" },
  { id: "talents",   icon: "🌟", label: "Talente" },
  { id: "skills",    icon: "⚡", label: "Fähigkeiten" },
  { id: "arena",     icon: "🏟️", label: "Arena" },
  { id: "boss",      icon: "👹", label: "Area-Boss" },
  { id: "fair",      icon: "⚖️", label: "Fair-Play" },
];

export function GuardianHelpButton() {
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
        aria-label="Wächter-Hilfe"
        title="Wie funktioniert der Wächter?"
      >?</button>
      {open && <GuardianHelpModal onClose={() => setOpen(false)} />}
    </>
  );
}

export function GuardianGuideBanner() {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<Tab>("overview");
  const chips: Array<{ icon: string; label: string; tab: Tab }> = [
    { icon: "⚔️", label: "So spielst du",          tab: "overview" },
    { icon: "🛡️", label: "60 Wächter · 4 Typen",  tab: "guardians" },
    { icon: "🌟", label: "Talentbaum",             tab: "talents" },
    { icon: "⚡", label: "5 Fähigkeiten",          tab: "skills" },
    { icon: "🏟️", label: "Arena-Kämpfe",          tab: "arena" },
    { icon: "👹", label: "Area-Boss-Raids",        tab: "boss" },
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
          <div style={{ color: "#FFF", fontSize: 14, fontWeight: 900 }}>Kompletter Wächter-Guide</div>
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

function GuardianHelpModal({ onClose, initialTab = "overview" }: { onClose: () => void; initialTab?: Tab }) {
  const [tab, setTab] = useState<Tab>(initialTab);
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
            <div style={{ color: "#FFF", fontSize: 16, fontWeight: 900 }}>Wächter-Guide</div>
            <div style={{ color: "#a855f7", fontSize: 9, fontWeight: 800, letterSpacing: 1 }}>KIEZ-KÄMPFER-SYSTEM</div>
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
          {tab === "fair"      && <FairTab />}
        </div>

        {/* Footer */}
        <div style={{ padding: 14, borderTop: "1px solid rgba(255,255,255,0.08)", display: "flex", gap: 8 }}>
          <button onClick={onClose} style={{
            flex: 1, padding: 12, borderRadius: 10,
            background: "#22D1C3", color: "#0F1115",
            border: "none", fontSize: 13, fontWeight: 900, cursor: "pointer",
          }}>Verstanden</button>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════
   TAB: ÜBERSICHT — Der Haupt-Loop
   ═══════════════════════════════════════════════════════ */
function OverviewTab() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <Hero>
        Dein <b>Wächter</b> ist dein persönlicher Kiez-Kämpfer. Er levelt mit jedem Lauf, wird stärker durch Ausrüstung und kämpft für dich & deine Crew.
      </Hero>

      <StepLoop steps={[
        { icon: "🏃", title: "1. Laufen",        text: "Erobere Straßen → XP für dich + Wächter-XP" },
        { icon: "📈", title: "2. Level-Up",      text: "Jedes Level (max 60) = +1 Talentpunkt zum Vergeben" },
        { icon: "⚔️", title: "3. Kämpfen",       text: "Arena-Shops (vor Ort) oder Area-Boss mit der Crew" },
        { icon: "⚡", title: "4. Upgraden",      text: "Siegel aus Kämpfen → Fähigkeiten auf Stufe 5 maxen" },
      ]} />

      <Card title="Was macht das System besonders?" color="#a855f7">
        <ul style={{ margin: 0, paddingLeft: 18, lineHeight: 1.7 }}>
          <li><b>60 Wächter</b> in <b>4 Typen</b> (🛡️ Infanterie · 🐎 Kavallerie · 🏹 Scharfschütze · 🔮 Magier)</li>
          <li><b>Stein-Schere-Papier</b>: ±25% Schaden bei Typ-Vorteil/-Nachteil (Magier neutral)</li>
          <li><b>Talentbaum</b> pro Wächter — 3 Äste × 5 Tiers = individueller Build</li>
          <li><b>5 Fähigkeiten</b> pro Wächter (Aktiv/Passiv/Kampf/Rolle/Expertise) × 5 Stufen</li>
          <li><b>Rage-Kampfsystem</b> — bei voll (1000) feuert der Aktiv-Skill automatisch</li>
          <li><b>Kein Pay-to-Win</b> — Siegel & XP nur durch Laufen + Kämpfen</li>
        </ul>
      </Card>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════
   TAB: WÄCHTER — 60 Archetypen nach Typ
   ═══════════════════════════════════════════════════════ */
function GuardiansTab() {
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
    infantry: { label: "Infanterie",    color: "#60a5fa", emoji: "🛡️", desc: "Schild & Stahl — hält Treffer aus und kontert" },
    cavalry:  { label: "Kavallerie",    color: "#fb923c", emoji: "🐎", desc: "Schnell & wendig — schlägt als erster zu" },
    marksman: { label: "Scharfschütze", color: "#4ade80", emoji: "🏹", desc: "Präziser Fernkampf — hohe Krit-Chance" },
    mage:     { label: "Magier",        color: "#c084fc", emoji: "🔮", desc: "Wildcard — neutral gegen alle Typen-Counter" },
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <Hero>
        <b>60 humanoide Wächter</b> in 4 Typen und 3 Raritäten (Elite / Episch / Legendär). Du beginnst mit einem Elite-Starter deiner Wahl und sammelst neue durch Kämpfe und Meilensteine.
      </Hero>

      <Card title="⚔️ Stein-Schere-Papier" color="#FFD700">
        Jeder Typ hat einen natürlichen Gegner: <b>Infanterie schlägt Kavallerie</b>, <b>Kavallerie schlägt Scharfschützen</b>, <b>Scharfschützen schlagen Infanterie</b>. Magier ist neutral — er kann nicht gekontert werden.
        <div style={{ color: "#a8b4cf", fontSize: 11, marginTop: 6 }}>
          Typ-Vorteil: <b style={{ color: "#4ade80" }}>+25% Schaden</b> · Typ-Nachteil: <b style={{ color: "#FF6B4A" }}>-25% Schaden</b>
        </div>
      </Card>

      {(["infantry","cavalry","marksman","mage"] as const).map((type) => {
        const meta = typeMeta[type];
        const list = byType.get(type) ?? [];
        if (list.length === 0) return null;
        return (
          <Card key={type} title={`${meta.emoji} ${meta.label} (${list.length})`} color={meta.color}>
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
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <Hero>
        Jedes Level-Up bringt <b>1 Talentpunkt</b>. Du vergibst ihn im individuellen <b>Talentbaum</b> deines Wächters — bis Level 60 (Max) hast du 59 Punkte zum Investieren.
      </Hero>

      <Card title="3 Äste pro Wächter" color="#22D1C3">
        <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 6 }}>
          <BranchRow icon="⚔️" color="#FF2D78" label="Spezialisierung" desc="Rollen-basiert (DPS / Tank / Support) — endet in einem Keystone" />
          <BranchRow icon="🔷" color="#22D1C3" label="Typ-Synergie"    desc="Typ-spezifische Buffs (Infanterie/Kavallerie/Scharfschütze/Magier)" />
          <BranchRow icon="✨" color="#FFD700" label="Utility"         desc="Generische Stat-Boni (HP / ATK / DEF / SPD / Krit)" />
        </div>
      </Card>

      <Card title="Nodes + Keystones" color="#a855f7">
        <ul style={{ margin: 0, paddingLeft: 18, lineHeight: 1.7, fontSize: 12 }}>
          <li><b>Stat-Nodes</b> (5 Ränge): +3% HP/ATK/DEF/SPD pro Rang</li>
          <li><b>Keystones</b> (Tier 5): einzigartige Buffs wie „Berserker" (bei HP&lt;30% +50% ATK) oder „Bollwerk" (absorbiert 1× tödlichen Treffer)</li>
          <li><b>Prereq</b>: Tier N kann nur freigeschaltet werden, wenn Tier N-1 mindestens Rang 1 hat</li>
          <li><b>Respec</b>: alle 7 Tage kostenlos — danach Universal-Siegel-Kosten</li>
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
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <Hero>
        Jeder Wächter hat <b>5 Fähigkeiten</b>. Stufe 1–4 sind sofort freigeschaltet, Stufe 5 (Expertise) erst wenn die anderen 4 maxed sind. Upgrades kosten <b>Siegel</b> — kein Geld.
      </Hero>

      <Card title="5 Slots pro Wächter" color="#22D1C3">
        <SkillRow icon="⚡"  color="#FFD700" label="Aktiv"     desc="Feuert bei voller Rage (1000) automatisch — massive Wirkung" />
        <SkillRow icon="🛡️" color="#60a5fa" label="Passiv"   desc="Immer aktiv: +Stat je nach Typ (DEF/SPD/Krit/Skill-Schaden)" />
        <SkillRow icon="⚔️" color="#FF2D78" label="Kampf"     desc="Triggert bei Event: Krit-Treffer, erlittener Treffer, HP&lt;50% …" />
        <SkillRow icon="🎭" color="#4ade80" label="Rolle"     desc="Typ-Counter-Bonus: +Schaden gegen den natürlichen Gegner" />
        <SkillRow icon="💎" color="#c084fc" label="Expertise" desc="Endgame: Aktiv-Skill löst Zweitwirkung aus (freigeschaltet bei Skills 1-4 auf Max)" />
      </Card>

      <Card title="Siegel — die Upgrade-Währung" color="#FFD700">
        <div style={{ fontSize: 12, lineHeight: 1.6 }}>
          Jede Skill-Stufe kostet <b>typ-spezifische Siegel</b> — nicht kaufbar, nur durch Spielen verdienbar.
        </div>
        <ul style={{ margin: "6px 0", paddingLeft: 18, fontSize: 11, lineHeight: 1.5, color: "#a8b4cf" }}>
          <li><b>Arena-Siege</b>: 1–3 Siegel vom Typ des Gegners</li>
          <li><b>Area-Boss-Loot</b>: 5–15 Siegel (Typ gemischt) + Universal-Siegel für Winner</li>
          <li><b>Walking-Meilensteine</b>: 10/30/100 km → Siegel-Pakete</li>
          <li><b>Tages-Missionen</b>: 1–2 Siegel pro Tag</li>
        </ul>
        <div style={{ fontSize: 10, color: "#22D1C3", fontStyle: "italic" }}>
          Kosten pro Stufe: 5 → 10 → 20 → 40 → 80 Siegel (Expertise ×2)
        </div>
      </Card>

      <Card title="Rage-System" color="#FF6B4A">
        <div style={{ fontSize: 12, lineHeight: 1.6 }}>
          Im Kampf baut sich eine <b>Rage-Leiste</b> auf (0–1000). Jeder Angriff: +100 Rage · jeder erlittene Treffer: +50 Rage. Bei <b>voll</b> feuert deine Aktiv-Fähigkeit automatisch mit <b>massivem Schaden</b> und setzt Rage auf 0 zurück.
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
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <Hero>
        <b>Arena-Shops</b> (⚔️-Symbol auf der Karte) sind Shops die regelmäßig Runner-Duelle hosten. Dein Wächter kämpft gegen den Wächter eines anderen Runners/einer anderen Crew.
      </Hero>

      <Card title="Regeln" color="#FFD700">
        <ul style={{ margin: 0, paddingLeft: 18, lineHeight: 1.7 }}>
          <li><b>GPS-Nähe</b>: Du musst ≤ <b>2 km</b> vom Shop sein um zu kämpfen</li>
          <li><b>Eligibility</b>: Du oder ein Crew-Mitglied muss in den letzten 3 Tagen dort eingelöst haben</li>
          <li><b>1 Kampf pro Arena pro Tag</b></li>
          <li><b>Stats + Ausrüstung</b> deines Wächters fließen ein, plus aktive Power-Zone-Buffs</li>
        </ul>
      </Card>

      <Card title="Belohnungen" color="#4ade80">
        <ul style={{ margin: 0, paddingLeft: 18, lineHeight: 1.7 }}>
          <li><b>Sieg</b>: +500 Wächter-XP</li>
          <li><b>Niederlage</b>: +125 XP (Trostpreis)</li>
          <li><b>3-Sieg-Streak</b>: Trophäe oder Fusion (wenn gleicher Archetyp)</li>
          <li><b>Verwundung</b>: Verlierer-Wächter ist bis zu 24 h pausiert</li>
        </ul>
      </Card>

      <Card title="Spezialkräfte" color="#a855f7">
        Jeder Archetyp hat eine einzigartige Spezialkraft die im Kampf automatisch zündet — z.B. <b>Paladin: +30% DEF in eigener Stadt</b>, <b>Berserker: +5% ATK pro erlittenem Treffer</b>, <b>Erzmagier: Gegner verliert 10% HP/Runde</b>.
      </Card>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════
   TAB: AREA-BOSS
   ═══════════════════════════════════════════════════════ */
function BossTab() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <Hero>
        <b>Area-Bosses</b> sind riesige Gegner an Landmarks (z.B. Fernsehturm). <b>Winner-takes-all:</b> Nur die Crew mit dem meisten Gesamt-Schaden gewinnt den Loot.
      </Hero>

      <Card title="🏆 Gewinner-Crew" color="#FFD700">
        <div style={{ fontSize: 12, lineHeight: 1.6 }}>
          Am Ende zählt nur der <b>gesamte Schaden</b> pro Crew. Die Crew mit dem höchsten Wert räumt alles ab — die anderen gehen leer aus.
        </div>
        <ul style={{ margin: "6px 0 0 0", paddingLeft: 18, lineHeight: 1.7 }}>
          <li>Wächter-<b>Level</b> und <b>Ausrüstung</b> entscheiden über Damage pro Schlag</li>
          <li>Höhere Level + bessere Gear = mehr Damage</li>
          <li>Strategie: Stark aufgestellte Crew mit vielen aktiven Mitgliedern dominiert</li>
        </ul>
      </Card>

      <Card title="👥 Maximal 10 Teilnehmer pro Crew" color="#a855f7">
        <div style={{ fontSize: 12, lineHeight: 1.6 }}>
          Pro Area-Boss können sich höchstens 10 Mitglieder einer Crew anschließen. Wer zuerst kommt, bekommt einen Platz. Voraussetzung: GPS <b>≤ 500 m</b> vom Boss.
        </div>
      </Card>

      <Card title="🎁 Loot-Staffelung (nur Gewinner-Crew)" color="#FF2D78">
        <div style={{ display: "flex", flexDirection: "column", gap: 5, fontSize: 12 }}>
          <LootRow participants="7–10 Teilnehmer" badges={[
            { label: "Legend", color: "#FFD700" },
            { label: "Epic",   color: "#a855f7" },
            { label: "Rare",   color: "#22D1C3" },
          ]} />
          <LootRow participants="4–6 Teilnehmer" badges={[
            { label: "Legend", color: "#FFD700" },
            { label: "Epic",   color: "#a855f7" },
          ]} />
          <LootRow participants="1–3 Teilnehmer" badges={[
            { label: "Legend", color: "#FFD700" },
          ]} />
        </div>
        <div style={{ fontSize: 10, color: "#8B8FA3", marginTop: 8, fontStyle: "italic" }}>
          Mehr Mitglieder → mehr Loot-Items mit gemischten Rarities. Der Kampfleader / Crew-Leader verteilt dann die Items innerhalb der Crew.
        </div>
      </Card>

      <Card title="Rollen in der Crew" color="#5ddaf0">
        <ul style={{ margin: 0, paddingLeft: 18, lineHeight: 1.7 }}>
          <li><b>Leader</b> — gründet die Crew, darf Kampfleader ernennen, verteilt Loot</li>
          <li><b>Co-Leader</b> — darf Loot verteilen</li>
          <li><b>Kampfleader</b> — spezialisierte Rolle nur für Raid-Loot-Verteilung</li>
          <li><b>Member</b> — kämpft mit, wartet auf Zuteilung</li>
        </ul>
      </Card>

      <Card title="Wichtig" color="#FF6B4A">
        Bosse haben oft <b>250k+ HP</b> und eine <b>48-h-Timer</b>. Koordiniert euch im Crew-Chat um früh vor Ort zu sein — wer zuletzt kommt, findet evtl. schon volle Slots. Einmal besiegt = ein Loot-Pool, nur für die Top-Damage-Crew.
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
function FairTab() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <Hero>
        MyArea365 ist <b>keine Pay-to-Win-App</b>. Fortschritt kommt durch <b>echtes Laufen</b>. Hier unsere Versprechen.
      </Hero>

      <Card title="✓ Kein Pay-to-Win" color="#4ade80">
        <ul style={{ margin: 0, paddingLeft: 18, lineHeight: 1.7 }}>
          <li>Alle kaufbaren Items sind als <b>cosmetic_only</b> markiert — keine Kampf-Stats</li>
          <li>Mystery-Box & Skins geben Style, <b>keine Vorteile</b> im Kampf</li>
          <li>XP + Ausrüstung mit Kampf-Stats kommen ausschließlich aus <b>Laufen / Einlösen / Kämpfen</b></li>
        </ul>
      </Card>

      <Card title="📊 Transparente Drop-Raten" color="#FFD700">
        <div style={{ fontSize: 12, lineHeight: 1.6, marginBottom: 8 }}>
          Alle Zufalls-Drops sind öffentlich dokumentiert (EU Digital Fairness Act). Freiwillige Offenlegung auch für Gratis-Loot.
        </div>
        <Link href="/loot-drops" style={{
          display: "inline-block", padding: "8px 12px", borderRadius: 8,
          background: "rgba(255,215,0,0.15)", border: "1px solid #FFD700",
          color: "#FFD700", fontSize: 11, fontWeight: 900, textDecoration: "none",
        }}>🎲 /loot-drops ansehen →</Link>
      </Card>

      <Card title="🛡️ GPS-Pflicht für alles Kompetitive" color="#a855f7">
        Damit Boni & Belohnungen echte Bewegung spiegeln, prüfen wir Position bei:
        <ul style={{ margin: "4px 0 0 0", paddingLeft: 18, lineHeight: 1.7 }}>
          <li><b>Arena-Challenge</b> ≤ 2 km vom Shop</li>
          <li><b>Area-Boss-Damage</b> ≤ 500 m vom Boss</li>
          <li><b>Sanctuary-Training</b> ≤ 50 m</li>
          <li><b>Loot-Kisten</b> ≤ 20 m (Auto-Pickup)</li>
        </ul>
      </Card>

      <Card title="💰 Monetarisierung" color="#5ddaf0">
        Wir finanzieren uns über <b>Premium-Abos</b> (Skins/Boosts/Sichtbarkeit), <b>Shop-Pakete</b> (Arena-Hosting) und <b>Werbung</b> (Flash-Deals). Nie durch Kampf-Vorteile.
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
