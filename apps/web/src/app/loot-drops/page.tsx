import type { Metadata } from "next";
import Link from "next/link";
import {
  RARITY_LABEL, RARITY_COLOR,
  REDEMPTION_LOOT_TABLE, EQUIPMENT_DROP_NOTE,
  MAP_LOOT_CRATE_TABLE, MYSTERY_BOX_TABLE,
  ARENA_WIN_REWARDS, LOOT_DISCLOSURE_META,
  type LootRarity,
} from "@/lib/loot-drops-public";

export const metadata: Metadata = {
  title: "Drop-Raten & Loot-Transparenz · MyArea365",
  description:
    "Vollständige Offenlegung aller Zufalls-Drops in MyArea365 — Wahrscheinlichkeiten, " +
    "Rewards und Mechaniken für jeden Loot-Typ. Freiwillige Transparenz im Einklang mit " +
    "EU Digital Fairness Act und nationalen Loot-Box-Regulierungen.",
};

function RarityPill({ rarity }: { rarity: LootRarity }) {
  return (
    <span style={{
      display: "inline-block",
      padding: "2px 10px",
      borderRadius: 999,
      background: `${RARITY_COLOR[rarity]}22`,
      border: `1px solid ${RARITY_COLOR[rarity]}`,
      color: RARITY_COLOR[rarity],
      fontSize: 11,
      fontWeight: 900,
      letterSpacing: 0.5,
      textTransform: "uppercase",
    }}>
      {RARITY_LABEL[rarity]}
    </span>
  );
}

function Section({ num, title, children }: { num: string; title: string; children: React.ReactNode }) {
  return (
    <section style={{
      background: "rgba(26, 29, 35, 0.7)",
      border: "1px solid rgba(255,255,255,0.08)",
      borderRadius: 16, padding: "20px 20px 16px",
      marginBottom: 20,
    }}>
      <h2 style={{ margin: 0, marginBottom: 12, fontSize: 18, fontWeight: 900, color: "#FFF", display: "flex", alignItems: "center", gap: 10 }}>
        <span style={{
          display: "inline-flex", alignItems: "center", justifyContent: "center",
          width: 28, height: 28, borderRadius: 8,
          background: "linear-gradient(135deg, #FF2D78, #a855f7)",
          color: "#FFF", fontSize: 13, fontWeight: 900,
        }}>{num}</span>
        {title}
      </h2>
      {children}
    </section>
  );
}

function LootTable({
  rows,
}: {
  rows: Array<{ rarity: LootRarity; chance_pct: number; [k: string]: unknown }>;
}) {
  return (
    <div style={{ overflowX: "auto" }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
        <thead>
          <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.1)" }}>
            <th style={{ textAlign: "left", padding: "8px 10px", color: "#8B8FA3", fontSize: 11, fontWeight: 800, letterSpacing: 0.5 }}>SELTENHEIT</th>
            <th style={{ textAlign: "right", padding: "8px 10px", color: "#8B8FA3", fontSize: 11, fontWeight: 800, letterSpacing: 0.5 }}>CHANCE</th>
            <th style={{ textAlign: "left", padding: "8px 10px", color: "#8B8FA3", fontSize: 11, fontWeight: 800, letterSpacing: 0.5 }}>REWARD</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
              <td style={{ padding: "10px" }}><RarityPill rarity={r.rarity} /></td>
              <td style={{ padding: "10px", textAlign: "right", color: RARITY_COLOR[r.rarity], fontWeight: 900, fontVariantNumeric: "tabular-nums" }}>
                {r.chance_pct.toFixed(1)} %
              </td>
              <td style={{ padding: "10px", color: "#DDD" }}>
                {typeof (r as Record<string, unknown>).xp_reward === "number"
                  ? `+${(r as Record<string, unknown>).xp_reward} XP`
                  : (typeof (r as Record<string, unknown>).reward === "string" ? String((r as Record<string, unknown>).reward) : "—")}
                {typeof (r as Record<string, unknown>).note === "string" && (
                  <div style={{ color: "#8B8FA3", fontSize: 11, marginTop: 2 }}>{String((r as Record<string, unknown>).note)}</div>
                )}
                {Array.isArray((r as Record<string, unknown>).kinds) && (
                  <div style={{ color: "#8B8FA3", fontSize: 11, marginTop: 2 }}>
                    Möglich: {((r as Record<string, unknown>).kinds as string[]).join(" · ")}
                  </div>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function LootDropsPage() {
  return (
    <div style={{
      minHeight: "100vh",
      background: "linear-gradient(180deg, #0F1115 0%, #151823 100%)",
      color: "#F0F0F0",
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Inter, Roboto, sans-serif',
    }}>
      <div style={{ maxWidth: 760, margin: "0 auto", padding: "40px 20px 80px" }}>
        <Link href="/dashboard" style={{ color: "#22D1C3", fontSize: 13, fontWeight: 700, textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 6, marginBottom: 24 }}>
          ← Zurück zur App
        </Link>

        <h1 style={{ margin: 0, marginBottom: 10, fontSize: 30, fontWeight: 900, letterSpacing: -0.5 }}>
          🎲 Drop-Raten & Loot-Transparenz
        </h1>
        <p style={{ color: "#a8b4cf", fontSize: 14, lineHeight: 1.6, marginBottom: 30 }}>
          Vollständige Offenlegung aller Zufalls-Drops in MyArea365. Kein Glücksspiel, kein
          Pay-to-Win – Bewegung ist die einzige „Währung". Trotzdem legen wir hier
          freiwillig offen, was in welcher Mechanik mit welcher Wahrscheinlichkeit droppt.
        </p>

        <div style={{
          background: "linear-gradient(135deg, rgba(34,209,195,0.08), rgba(168,85,247,0.08))",
          border: "1px solid rgba(34,209,195,0.3)",
          borderRadius: 12, padding: 16, marginBottom: 28,
          fontSize: 12, color: "#DDD", lineHeight: 1.55,
        }}>
          <strong style={{ color: "#22D1C3" }}>⚖️ Rechtlicher Kontext:</strong>{" "}
          {LOOT_DISCLOSURE_META.legal_note}
        </div>

        <Section num="1" title="QR-Einlösung bei Shops — Guardian-Loot">
          <p style={{ color: "#a8b4cf", fontSize: 12, marginBottom: 12, lineHeight: 1.5 }}>
            Nach jedem erfolgreich eingelösten Deal würfelt der Server <code>random()</code>{" "}
            und ermittelt genau einen Drop nach folgender Verteilung. Die Roll-Logik ist
            in Migration <code>00017_guardian_loot_drops.sql</code> dokumentiert.
          </p>
          <LootTable rows={REDEMPTION_LOOT_TABLE} />
        </Section>

        <Section num="2" title="Equipment-Drops (gekoppelt an Redemption-Loot)">
          <p style={{ color: "#DDD", fontSize: 13, lineHeight: 1.5 }}>{EQUIPMENT_DROP_NOTE}</p>
          <p style={{ color: "#8B8FA3", fontSize: 11, marginTop: 10 }}>
            Item-Katalog und Stats siehe Migration{" "}
            <code>00018_guardian_equipment.sql</code>.
          </p>
        </Section>

        <Section num="3" title="Loot-Kisten auf der Karte">
          <p style={{ color: "#a8b4cf", fontSize: 12, marginBottom: 12, lineHeight: 1.5 }}>
            Spawnen automatisch alle 90–120 Sekunden im Umkreis von ca. 450 m um den
            Runner. Ab 30 m Entfernung wird die Kiste automatisch aufgesammelt.
          </p>
          <LootTable rows={MAP_LOOT_CRATE_TABLE} />
        </Section>

        <Section num="4" title="Mystery-Box (kostenpflichtig, € 1,99)">
          <p style={{ color: "#a8b4cf", fontSize: 12, marginBottom: 12, lineHeight: 1.5 }}>
            <strong style={{ color: "#FFD700" }}>Hinweis:</strong>{" "}
            Einziger Paid-Loot-Artikel. Enthält immer genau 1 Equipment-Item; Rarity
            ist gewürfelt, aber Mindest-Rarity <em>Common</em> ist garantiert
            (keine „nichts"-Rolle). Shop-Ankündigung und Transaktionslog vollständig
            einsehbar im Profil unter <em>Meine Käufe</em>.
          </p>
          <LootTable rows={MYSTERY_BOX_TABLE} />
        </Section>

        <Section num="5" title="Arena & Boss-Raids — deterministische Belohnungen">
          <p style={{ color: "#a8b4cf", fontSize: 12, marginBottom: 12, lineHeight: 1.5 }}>
            Keine Zufalls-Rolls. Belohnungen sind rein an messbare Leistung gekoppelt.
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {ARENA_WIN_REWARDS.map((r, i) => (
              <div key={i} style={{
                padding: "10px 12px", borderRadius: 10,
                background: "rgba(255,255,255,0.04)",
                border: "1px solid rgba(255,255,255,0.08)",
                display: "flex", justifyContent: "space-between", gap: 12,
                fontSize: 13,
              }}>
                <span style={{ color: "#DDD" }}>{r.condition}</span>
                <span style={{ color: "#FFD700", fontWeight: 800, textAlign: "right", whiteSpace: "nowrap" }}>{r.reward}</span>
              </div>
            ))}
          </div>
        </Section>

        <div style={{ textAlign: "center", color: "#8B8FA3", fontSize: 11, marginTop: 30, lineHeight: 1.6 }}>
          Stand: {LOOT_DISCLOSURE_META.last_updated} ·{" "}
          Fragen oder Unstimmigkeiten?{" "}
          <a href={`mailto:${LOOT_DISCLOSURE_META.contact}`} style={{ color: "#22D1C3" }}>
            {LOOT_DISCLOSURE_META.contact}
          </a>
        </div>
      </div>
    </div>
  );
}
