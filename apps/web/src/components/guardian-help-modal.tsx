"use client";

import { useEffect, useState } from "react";
import { RARITY_META, type GuardianArchetype } from "@/lib/guardian";
import { createClient } from "@/lib/supabase/client";

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

/**
 * Prominenter Banner mit 5 Kern-Fragen fuer neue Runner.
 * Klick auf eine Frage → Guide-Modal oeffnet gescrollt auf den passenden Abschnitt.
 */
export function GuardianGuideBanner() {
  const [open, setOpen] = useState(false);
  const [section, setSection] = useState<string | null>(null);
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
          <div style={{ color: "#FFF", fontSize: 14, fontWeight: 900 }}>Neu hier? Kompletter Wächter-Guide</div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 8 }}>
          {[
            { icon: "⚔️", label: "Wie bekomme ich einen?", section: "what" },
            { icon: "🎭", label: "Welche gibt es?", section: "compendium" },
            { icon: "📈", label: "Wie levelt er?", section: "level" },
            { icon: "🛡️", label: "Wo gibt's Ausrüstung?", section: "equipment" },
            { icon: "🏟️", label: "Wo wird gekämpft?", section: "arena" },
          ].map((chip) => (
            <button
              key={chip.section}
              onClick={() => { setSection(chip.section); setOpen(true); }}
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
      {open && <GuardianHelpModal onClose={() => { setOpen(false); setSection(null); }} initialSection={section} />}
    </>
  );
}

function GuardianHelpModal({ onClose, initialSection }: { onClose: () => void; initialSection?: string | null }) {
  const [archetypes, setArchetypes] = useState<GuardianArchetype[]>([]);
  useEffect(() => {
    const sb = createClient();
    sb.from("guardian_archetypes").select("*").order("rarity").order("name")
      .then(({ data }) => { if (data) setArchetypes(data as GuardianArchetype[]); });
  }, []);

  useEffect(() => {
    if (!initialSection) return;
    const el = document.getElementById(`guide-${initialSection}`);
    if (el) setTimeout(() => el.scrollIntoView({ behavior: "smooth", block: "start" }), 100);
  }, [initialSection]);

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed", inset: 0, zIndex: 3600,
        background: "rgba(15,17,21,0.9)", backdropFilter: "blur(12px)",
        display: "flex", alignItems: "center", justifyContent: "center", padding: 16,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "100%", maxWidth: 560, maxHeight: "88vh", overflowY: "auto",
          background: "#1A1D23", borderRadius: 20, padding: 24,
          border: "1px solid rgba(168,85,247,0.5)",
          boxShadow: "0 0 40px rgba(168,85,247,0.3)",
          color: "#F0F0F0",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
          <span style={{ fontSize: 28 }}>🛡️</span>
          <div style={{ flex: 1 }}>
            <div style={{ color: "#FFF", fontSize: 18, fontWeight: 900 }}>So funktioniert dein Wächter</div>
            <div style={{ color: "#a855f7", fontSize: 10, fontWeight: 800, letterSpacing: 1 }}>KOMPLETT-GUIDE</div>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", color: "#8B8FA3", fontSize: 22, cursor: "pointer" }}>×</button>
        </div>

        <Section id="guide-compendium" title="🎭 Alle 20 Wächter" accent="#22D1C3">
          Hier alle Archetypen sortiert nach Seltenheit. Welchen du bekommst ist Zufall bei deiner Registrierung.
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))", gap: 8, marginTop: 10 }}>
            {archetypes.map((a) => {
              const r = RARITY_META[a.rarity];
              return (
                <div key={a.id} style={{
                  padding: 8, borderRadius: 10,
                  background: `linear-gradient(135deg, ${r.glow}, rgba(15,17,21,0.7))`,
                  border: `1px solid ${r.color}55`,
                }}>
                  <div style={{ fontSize: 24, textAlign: "center" }}>{a.emoji}</div>
                  <div style={{ color: r.color, fontSize: 8, fontWeight: 900, letterSpacing: 1, textAlign: "center", marginTop: 2 }}>{r.label.toUpperCase()}</div>
                  <div style={{ color: "#FFF", fontSize: 11, fontWeight: 900, textAlign: "center", marginTop: 2 }}>{a.name}</div>
                  <div style={{ color: "#a8b4cf", fontSize: 9, textAlign: "center", marginTop: 2, lineHeight: 1.3 }}>{a.ability_name}</div>
                </div>
              );
            })}
            {archetypes.length === 0 && (
              <div style={{ color: "#8B8FA3", fontSize: 11, textAlign: "center", padding: 10, gridColumn: "1 / -1" }}>
                Lade Archetypen…
              </div>
            )}
          </div>
        </Section>

        <Section id="guide-what" title="⚔️ Was ist ein Wächter & wie bekomme ich einen?" accent="#a855f7">
          Jeder Runner hat einen persönlichen <b>Wächter</b> — deinen Kampf-Champion in der Arena.
          Wenn du eine Crew gründest oder ihr beitrittst, bekommt <b>jedes Mitglied</b> seinen eigenen zufälligen Wächter:
          <ul style={{ margin: "6px 0 0 0", paddingLeft: 18 }}>
            <li><b style={{ color: "#8B8FA3" }}>Gewöhnlich</b> (70%) — Stadtkrieger, Schildwache, Tänzer…</li>
            <li><b style={{ color: "#22D1C3" }}>Selten</b> (22%) — Straßenmagier, Parkour-Mönch, Dieb…</li>
            <li><b style={{ color: "#a855f7" }}>Episch</b> (7%) — Paladin, Berserker, Assassine…</li>
            <li><b style={{ color: "#FFD700" }}>Legendär</b> (1%) — Erzmagier, Hohepriester, Sturmritter…</li>
          </ul>
        </Section>

        <Section id="guide-arena" title="🏟️ Wo wird gekämpft?" accent="#FFD700">
          In der <b>Arena</b> bestimmter Shops (das ⚔️-Symbol auf der Karte). Du darfst kämpfen wenn:
          <ul style={{ margin: "6px 0 0 0", paddingLeft: 18 }}>
            <li>Du <b>selbst</b> in den letzten 3 Tagen dort einen Deal eingelöst hast, ODER</li>
            <li>Ein <b>Crew-Mitglied</b> in den letzten 3 Tagen dort eingelöst hat</li>
          </ul>
          Im Shop-Detail auf der Karte findest du den <b>🏟️ Arena betreten</b>-Button. Ein Kampf pro Arena pro Tag.
        </Section>

        <Section id="guide-equipment" title="🛡️ Wo gibt es Ausrüstung?" accent="#5ddaf0">
          Jeder Wächter hat <b>3 Slots</b>: Helm, Rüstung, Amulett.
          Ausrüstung bekommst du über:
          <ul style={{ margin: "6px 0 0 0", paddingLeft: 18 }}>
            <li><b>Rare+ Loot-Drops</b> bei Einlösungen (40% Chance auf Item statt XP)</li>
            <li><b>Trophäen</b> nach 3× Sieg gegen dieselbe Crew</li>
            <li>Später: Wächter-Shop mit kaufbaren Sets</li>
          </ul>
          Items haben <b>Stat-Bonuses</b> — ein Epic-Helm gibt z.B. +18 DEF, ein Legend-Amulett +20 ATK. Ausrüstung fließt direkt in den Kampf ein.
          Verwalten kannst du sie im Profil unter <b>„AUSRÜSTUNG"</b> — Slot anklicken → Item aus Inventar wählen.
        </Section>

        <Section id="guide-level" title="📈 Wie levelt er?" accent="#4ade80">
          Dein Wächter sammelt <b>XP</b> auf 4 Wegen:
          <ul style={{ margin: "6px 0 0 0", paddingLeft: 18 }}>
            <li><b>Sieg im Kampf</b>: +500 XP</li>
            <li><b>Niederlage</b>: +125 XP (Trostpreis)</li>
            <li><b>Loot-Drop</b> nach Einlösung: +100 bis +2.500 XP je Rarität</li>
            <li><b>Kauf</b> „Wächter-XP-Boost" im Shop: +2.500 XP</li>
          </ul>
          Mit jedem Level steigen seine Stats: <b>+8% HP</b>, <b>+6% ATK/DEF</b>, <b>+3% SPD</b> pro Level.
          Maximal Level 30.
        </Section>

        <Section title="🎲 Loot-Drops beim Einlösen" accent="#FF6B4A">
          Jede <b>verifizierte Einlösung</b> rollt automatisch einen Drop:
          <ul style={{ margin: "6px 0 0 0", paddingLeft: 18 }}>
            <li>60% Chance: nichts</li>
            <li>25% Chance: <b>Common</b> (+100 XP)</li>
            <li>10% Chance: <b>Rare</b> (+300 XP oder Ausrüstung)</li>
            <li>4% Chance: <b>Epic</b> (+800 XP oder Ausrüstung)</li>
            <li>1% Chance: <b>Legendär</b> (+2.500 XP oder Ausrüstung)</li>
          </ul>
          Bei Rare+ Drops gibt's 40% Chance auf <b>Ausrüstung</b> (Helm/Rüstung/Amulett) statt XP.
        </Section>

        <Section title="🏆 Trophäen & Fusion" accent="#FFD700">
          Besiegst du denselben Gegner <b>3× in Folge</b>, kapst du seinen Wächter:
          <ul style={{ margin: "6px 0 0 0", paddingLeft: 18 }}>
            <li><b>Gleicher Archetyp</b> (z.B. beide Paladin) → <b>Fusion</b>: dein Wächter steigt ein Level</li>
            <li><b>Anderer Archetyp</b> → <b>Trophäe</b>: Siegesabzeichen im Schrein, der Verlierer ist 7 Tage verwundet</li>
          </ul>
        </Section>

        <Section title="💔 Wunden & Heilung" accent="#FF2D78">
          Verliert dein Wächter einen Kampf mit 0 HP, ist er <b>24 Stunden verwundet</b> und kann nicht kämpfen.
          HP regeneriert automatisch mit der Zeit. Für Eilige: <b>💊 Revival-Token</b> (1,99€) heilt sofort.
        </Section>

        <Section title="⚡ Spezialkräfte" accent="#22D1C3">
          Jeder Archetyp hat eine <b>einzigartige Spezialkraft</b>, die im Kampf automatisch zündet:
          <ul style={{ margin: "6px 0 0 0", paddingLeft: 18 }}>
            <li><b>Paladin — Festung</b>: +30% DEF in eigener Stadt</li>
            <li><b>Berserker — Wut-Aufbau</b>: +5% ATK pro erlittenem Treffer</li>
            <li><b>Erzmagier — Flamme</b>: Gegner verliert 10% HP/Runde</li>
            <li>… und 17 weitere</li>
          </ul>
          Die Spezialkraft deines Wächters siehst du in seiner Karte.
        </Section>

        <div style={{
          marginTop: 14, padding: 12, borderRadius: 10,
          background: "rgba(34,209,195,0.08)", border: "1px solid rgba(34,209,195,0.3)",
          fontSize: 11, color: "#a8b4cf", lineHeight: 1.6,
        }}>
          💡 <b>Tipp:</b> Der Loop ist: <b>Lauf → XP → Einlösen im Arena-Shop → Wächter-XP + Loot → Gegner besiegen → Mehr XP → Level-Up</b>.
          Jeder Deal bringt dir garantiert etwas, jede Einlösung füttert deinen Wächter.
        </div>

        <button
          onClick={onClose}
          style={{
            marginTop: 16, width: "100%", padding: 14, borderRadius: 12,
            background: "#22D1C3", color: "#0F1115",
            border: "none", fontSize: 14, fontWeight: 900, cursor: "pointer",
          }}
        >
          Verstanden
        </button>
      </div>
    </div>
  );
}

function Section({ id, title, accent, children }: { id?: string; title: string; accent: string; children: React.ReactNode }) {
  return (
    <div id={id} style={{
      padding: "12px 14px", borderRadius: 12,
      background: "rgba(70, 82, 122, 0.3)",
      border: `1px solid ${accent}33`,
      marginBottom: 10,
      scrollMarginTop: 20,
    }}>
      <div style={{ color: accent, fontSize: 12, fontWeight: 900, marginBottom: 6 }}>{title}</div>
      <div style={{ color: "#D4D8E0", fontSize: 12, lineHeight: 1.55 }}>{children}</div>
    </div>
  );
}
