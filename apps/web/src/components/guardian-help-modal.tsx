"use client";

import { useState } from "react";

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

function GuardianHelpModal({ onClose }: { onClose: () => void }) {
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

        <Section title="⚔️ Was ist ein Wächter?" accent="#a855f7">
          Jeder Runner hat einen persönlichen <b>Wächter</b> — deinen Kampf-Champion in der Arena.
          Wenn du eine Crew gründest oder ihr beitrittst, bekommt <b>jedes Mitglied</b> seinen eigenen zufälligen Wächter:
          <ul style={{ margin: "6px 0 0 0", paddingLeft: 18 }}>
            <li><b style={{ color: "#8B8FA3" }}>Gewöhnlich</b> (70%) — Stadtkrieger, Schildwache, Tänzer…</li>
            <li><b style={{ color: "#22D1C3" }}>Selten</b> (22%) — Straßenmagier, Parkour-Mönch, Dieb…</li>
            <li><b style={{ color: "#a855f7" }}>Episch</b> (7%) — Paladin, Berserker, Assassine…</li>
            <li><b style={{ color: "#FFD700" }}>Legendär</b> (1%) — Erzmagier, Hohepriester, Sturmritter…</li>
          </ul>
        </Section>

        <Section title="🏟️ Wo kämpft er?" accent="#FFD700">
          In der <b>Arena</b> bestimmter Shops (das ⚔️-Symbol auf der Karte). Du darfst kämpfen wenn:
          <ul style={{ margin: "6px 0 0 0", paddingLeft: 18 }}>
            <li>Du <b>selbst</b> in den letzten 3 Tagen dort einen Deal eingelöst hast, ODER</li>
            <li>Ein <b>Crew-Mitglied</b> in den letzten 3 Tagen dort eingelöst hat</li>
          </ul>
          Im Shop-Detail auf der Karte findest du den <b>🏟️ Arena betreten</b>-Button. Ein Kampf pro Arena pro Tag.
        </Section>

        <Section title="📈 Wie levelt er?" accent="#4ade80">
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

function Section({ title, accent, children }: { title: string; accent: string; children: React.ReactNode }) {
  return (
    <div style={{
      padding: "12px 14px", borderRadius: 12,
      background: "rgba(70, 82, 122, 0.3)",
      border: `1px solid ${accent}33`,
      marginBottom: 10,
    }}>
      <div style={{ color: accent, fontSize: 12, fontWeight: 900, marginBottom: 6 }}>{title}</div>
      <div style={{ color: "#D4D8E0", fontSize: 12, lineHeight: 1.55 }}>{children}</div>
    </div>
  );
}
