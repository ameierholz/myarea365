"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { RARITY_META, type GuardianArchetype } from "@/lib/guardian";
import { createClient } from "@/lib/supabase/client";

type Tab = "overview" | "guardians" | "equipment" | "arena" | "boss" | "zones" | "fair";

const TABS: Array<{ id: Tab; icon: string; label: string }> = [
  { id: "overview",  icon: "🧭", label: "Übersicht" },
  { id: "guardians", icon: "🛡️", label: "Wächter" },
  { id: "equipment", icon: "⚔️", label: "Ausrüstung" },
  { id: "arena",     icon: "🏟️", label: "Arena" },
  { id: "boss",      icon: "👹", label: "Area-Boss" },
  { id: "zones",     icon: "🗺️", label: "Zonen & Tempel" },
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
    { icon: "🎭", label: "20 Wächter-Rassen",     tab: "guardians" },
    { icon: "🛡️", label: "9 Ausrüstungs-Slots",   tab: "equipment" },
    { icon: "🏟️", label: "Arena-Kämpfe",          tab: "arena" },
    { icon: "👹", label: "Crew-Boss-Raids",       tab: "boss" },
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
          {tab === "equipment" && <EquipmentTab />}
          {tab === "arena"     && <ArenaTab />}
          {tab === "boss"      && <BossTab />}
          {tab === "zones"     && <ZonesTab />}
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
        { icon: "🏃", title: "1. Laufen",        text: "Erobere Straßen → XP für dich + Ranking-Punkte" },
        { icon: "🏪", title: "2. Deals einlösen", text: "Scan QR bei Shops → Wächter-XP + Chance auf Loot" },
        { icon: "⚔️", title: "3. Kämpfen",       text: "Arena-Shops (vor Ort) oder Boss-Raids mit der Crew" },
        { icon: "📈", title: "4. Level-Up",      text: "Jedes Level: +8% HP, +6% ATK/DEF, +3% SPD (max Lvl 30)" },
      ]} />

      <Card title="Was macht den Wächter besonders?" color="#a855f7">
        <ul style={{ margin: 0, paddingLeft: 18, lineHeight: 1.7 }}>
          <li><b>20 Rassen</b> in 4 Rollen (Tank / Heiler / Nahkampf-DPS / Fernkampf-DPS)</li>
          <li><b>6 Seltenheitsstufen</b> für Loot — von Ungewöhnlich bis Transzendent</li>
          <li><b>9 Ausrüstungs-Slots</b> — massiv mehr Kombinationsmöglichkeiten</li>
          <li><b>Zwingend GPS</b>: Arena nur ≤2&nbsp;km, Boss-Raid ≤500&nbsp;m, Sanctuary ≤50&nbsp;m</li>
          <li><b>Kein Pay-to-Win</b> — kaufbare Items sind rein kosmetisch</li>
        </ul>
      </Card>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════
   TAB: WÄCHTER — Rassen-Übersicht
   ═══════════════════════════════════════════════════════ */
function GuardiansTab() {
  const [archetypes, setArchetypes] = useState<GuardianArchetype[]>([]);
  const [races, setRaces] = useState<Array<{ id: string; name: string; role: string; lore: string | null; material_desc: string | null }>>([]);
  useEffect(() => {
    const sb = createClient();
    sb.from("guardian_archetypes").select("*").order("rarity").order("name")
      .then(({ data }) => { if (data) setArchetypes(data as GuardianArchetype[]); });
    sb.from("races_catalog").select("id, name, role, lore, material_desc").order("role").order("name")
      .then(({ data }) => { if (data) setRaces(data); });
  }, []);

  const byRole = useMemo(() => {
    const map = new Map<string, typeof races>();
    for (const r of races) {
      const list = map.get(r.role) ?? [];
      list.push(r);
      map.set(r.role, list);
    }
    return map;
  }, [races]);

  const roleMeta: Record<string, { label: string; color: string; emoji: string; desc: string }> = {
    tank:       { label: "Tank",             color: "#6991d8", emoji: "🛡️", desc: "Hält viel aus — Konstitution + Widerstand" },
    healer:     { label: "Heiler",           color: "#1db682", emoji: "💚", desc: "Heilt und unterstützt — Fokus + Heilkraft" },
    melee_dps:  { label: "Nahkampf-DPS",     color: "#ef7169", emoji: "⚔️", desc: "Schnell und präzise — Beweglichkeit + Stärke" },
    ranged_dps: { label: "Fernkampf-DPS",    color: "#a855f7", emoji: "🏹", desc: "Distanz-Schaden — Präzision + Reichweite" },
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <Hero>
        Bei oder nach der Registrierung kannst du dir deinen <b>Wächter selbst aussuchen</b> — eine aus 20 Rassen in 4 Rollen. Jede Rasse hat eine eigene Rolle und einzigartige Material-Thematik für ihre Items.
      </Hero>

      <Card title="💎 Sammeln + Wechseln" color="#a855f7">
        <div style={{ marginBottom: 6 }}>
          Du kannst <b>mehrere Wächter sammeln</b> und zwischen ihnen wechseln. Pro Wechsel gilt ein <b>24-Stunden-Cooldown</b> (Fairness in der Arena).
        </div>
        <div style={{ fontWeight: 800, color: "#FFD700", marginBottom: 2 }}>💎 Beschwörungssteine bekommst du durch:</div>
        <ul style={{ margin: "2px 0 6px 0", paddingLeft: 18, lineHeight: 1.6, fontSize: 11 }}>
          <li><b>Km-Meilensteine</b>: 10 / 50 / 100 km gesamt → je 1 Stein</li>
          <li><b>Boss-Raid-Sieg</b>: 5% Chance pro Mitglied der Gewinner-Crew</li>
          <li><b>Seltene Drop-Items</b> (Legendary Redemption-Loot)</li>
        </ul>
        <div style={{ fontSize: 11, lineHeight: 1.5 }}>
          Mit 1 Stein kannst du eine noch nicht besessene Rasse beschwören. Sammle alle 20 für den Kiez-Master-Titel!
        </div>
      </Card>

      {Array.from(byRole.entries()).map(([role, list]) => {
        const meta = roleMeta[role] ?? { label: role, color: "#8B8FA3", emoji: "•", desc: "" };
        return (
          <Card key={role} title={`${meta.emoji} ${meta.label}`} color={meta.color}>
            <div style={{ fontSize: 11, color: "#a8b4cf", marginBottom: 8, fontStyle: "italic" }}>{meta.desc}</div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(130px, 1fr))", gap: 6 }}>
              {list.map((r) => (
                <div key={r.id} title={r.lore ?? ""} style={{
                  padding: 7, borderRadius: 8,
                  background: "rgba(15,17,21,0.6)",
                  border: `1px solid ${meta.color}33`,
                }}>
                  <div style={{ color: meta.color, fontSize: 11, fontWeight: 900, marginBottom: 2 }}>{r.name}</div>
                  {r.material_desc && (
                    <div style={{ color: "#8B8FA3", fontSize: 9, lineHeight: 1.3 }}>{r.material_desc}</div>
                  )}
                </div>
              ))}
            </div>
          </Card>
        );
      })}

      {archetypes.length > 0 && (
        <Card title="Archetypen-Kompendium" color="#FFD700">
          <div style={{ fontSize: 11, color: "#a8b4cf", marginBottom: 8 }}>Klassen-Varianten der Wächter (sortiert nach Seltenheit).</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(120px, 1fr))", gap: 6 }}>
            {archetypes.map((a) => {
              const r = RARITY_META[a.rarity];
              return (
                <div key={a.id} style={{
                  padding: 7, borderRadius: 8,
                  background: `linear-gradient(135deg, ${r.glow}, rgba(15,17,21,0.7))`,
                  border: `1px solid ${r.color}55`,
                  textAlign: "center",
                }}>
                  <div style={{ fontSize: 22 }}>{a.emoji}</div>
                  <div style={{ color: r.color, fontSize: 8, fontWeight: 900, letterSpacing: 0.8 }}>{r.label.toUpperCase()}</div>
                  <div style={{ color: "#FFF", fontSize: 10, fontWeight: 800, marginTop: 1 }}>{a.name}</div>
                </div>
              );
            })}
          </div>
        </Card>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════
   TAB: AUSRÜSTUNG — 9 Slots + 6 Rarities
   ═══════════════════════════════════════════════════════ */
function EquipmentTab() {
  const slots: Array<[string, string, string]> = [
    ["⛑️", "Kopf",      "DEF / HP"],
    ["🎽", "Schulter",   "DEF / HP"],
    ["🛡️", "Brust",      "HP / DEF"],
    ["🧤", "Hände",      "ATK / SPD"],
    ["⌚", "Handgelenk", "SPD / ATK"],
    ["📿", "Kette",      "Balanced"],
    ["💍", "Ring",       "Single-Stat"],
    ["👟", "Schuhe",     "SPD / HP"],
    ["⚔️", "Waffe",      "ATK / SPD"],
  ];
  const rarities: Array<[string, string, string, string]> = [
    ["Ungewöhnlich",   "#9ba8c7", "×1.2", "grau"],
    ["Selten",         "#1db682", "×1.5", "grün"],
    ["Episch",         "#a855f7", "×2.0", "lila"],
    ["Legendär",       "#FFD700", "×3.0", "gold"],
    ["Artefakt",       "#e6cc80", "×5.0", "orange"],
    ["Transzendent",   "#1db682", "×8.0", "mythic"],
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <Hero>
        Jeder Wächter kann <b>9 Slots</b> ausrüsten. Jedes Item hat einen <b>Stat-Fokus</b> passend zum Slot und zur Rasse. Insgesamt gibt es über 800 verschiedene Items im Spiel.
      </Hero>

      <Card title="9 Ausrüstungs-Slots" color="#22D1C3">
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 6 }}>
          {slots.map(([icon, label, focus]) => (
            <div key={label} style={{
              padding: "8px 6px", borderRadius: 8, textAlign: "center",
              background: "rgba(15,17,21,0.6)",
              border: "1px solid rgba(34,209,195,0.25)",
            }}>
              <div style={{ fontSize: 20 }}>{icon}</div>
              <div style={{ color: "#FFF", fontSize: 11, fontWeight: 900, marginTop: 2 }}>{label}</div>
              <div style={{ color: "#8B8FA3", fontSize: 9, marginTop: 1 }}>{focus}</div>
            </div>
          ))}
        </div>
      </Card>

      <Card title="6 Seltenheitsstufen" color="#FFD700">
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          {rarities.map(([name, color, mult, desc]) => (
            <div key={name} style={{
              display: "flex", alignItems: "center", gap: 10,
              padding: "6px 10px", borderRadius: 8,
              background: "rgba(15,17,21,0.6)",
              border: `1px solid ${color}33`,
            }}>
              <div style={{ width: 10, height: 10, borderRadius: 5, background: color, flexShrink: 0, boxShadow: `0 0 8px ${color}99` }} />
              <div style={{ color, fontWeight: 900, fontSize: 12, flex: 1 }}>{name}</div>
              <div style={{ color: "#8B8FA3", fontSize: 10 }}>{desc}</div>
              <div style={{ color, fontSize: 11, fontWeight: 900, fontVariantNumeric: "tabular-nums" }}>{mult}</div>
            </div>
          ))}
        </div>
        <div style={{ fontSize: 10, color: "#8B8FA3", marginTop: 8, fontStyle: "italic" }}>
          Multiplikator bezieht sich auf die Basis-Statpunkte eines Common-Items.
        </div>
      </Card>

      <Card title="Wie bekomme ich Ausrüstung?" color="#5ddaf0">
        <ul style={{ margin: 0, paddingLeft: 18, lineHeight: 1.7 }}>
          <li><b>Loot-Kisten</b> auf der Karte (Auto-Pickup bei ≤20&nbsp;m Entfernung)</li>
          <li><b>QR-Einlösung bei Shops</b> (Chancen siehe „Fair-Play"-Tab)</li>
          <li><b>Boss-Raid-Sieg</b> — Loot-Pool wird von der Crew verteilt</li>
          <li><b>Arena-Trophäen</b> nach 3× Sieg gegen dieselbe Crew</li>
        </ul>
      </Card>
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
   TAB: ZONES & TEMPEL
   ═══════════════════════════════════════════════════════ */
function ZonesTab() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <Card title="🗿 Power-Zones" color="#22D1C3">
        <div style={{ fontSize: 12, marginBottom: 8, lineHeight: 1.55 }}>
          Farbige Kreise auf der Karte. Wenn du <b>innerhalb</b> einer Zone läufst, bekommt dein Wächter passive Buffs:
        </div>
        <ul style={{ margin: 0, paddingLeft: 18, lineHeight: 1.7, fontSize: 12 }}>
          <li><b style={{ color: "#4ade80" }}>🌳 Park-Zone</b> → +HP / +DEF</li>
          <li><b style={{ color: "#FF6B4A" }}>🏙️ Stadt-Zone</b> → +ATK / +SPD</li>
          <li><b style={{ color: "#5ddaf0" }}>💧 Wasser-Zone</b> → +HP / +DEF</li>
          <li><b style={{ color: "#FFD700" }}>🗿 Wahrzeichen</b> → +alles (ausgeglichen)</li>
        </ul>
        <div style={{ fontSize: 10, color: "#8B8FA3", marginTop: 6, fontStyle: "italic" }}>
          Klick auf eine Zone zeigt die exakten Buff-Werte.
        </div>
      </Card>

      <Card title="⛩️ Wächter-Sanctuaries" color="#5ddaf0">
        <div style={{ fontSize: 12, marginBottom: 8, lineHeight: 1.55 }}>
          Spezielle POIs wo du deinen Wächter täglich trainieren kannst (<b>+50 Wächter-XP</b>). Aktuell:
        </div>
        <ul style={{ margin: 0, paddingLeft: 18, lineHeight: 1.7, fontSize: 12 }}>
          <li><b>Tempel am Senftenberger Ring</b> (Marzahn)</li>
          <li><b>Ostsee-Altar</b> (Rummelsburger See)</li>
        </ul>
        <div style={{ fontSize: 11, color: "#FF6BA1", marginTop: 8, fontWeight: 700 }}>
          📍 Training nur bei ≤ 50 m Entfernung möglich — du musst tatsächlich vor Ort sein.
        </div>
        <div style={{ fontSize: 11, color: "#8B8FA3", marginTop: 4 }}>
          1× pro Tag und Sanctuary. Motiviert dazu, auch neue Stadtteile zu erkunden.
        </div>
      </Card>
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
