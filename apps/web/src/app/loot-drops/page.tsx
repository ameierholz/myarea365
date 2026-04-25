import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { useTranslations } from "next-intl";
import {
  RARITY_LABEL, RARITY_COLOR,
  REDEMPTION_LOOT_TABLE, EQUIPMENT_DROP_NOTE,
  MAP_LOOT_CRATE_TABLE, MYSTERY_BOX_TABLE,
  ARENA_WIN_REWARDS, LOOT_DISCLOSURE_META,
  type LootRarity,
} from "@/lib/loot-drops-public";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("LootDrops");
  return {
    title: t("metaTitle"),
    description: t("metaDescription"),
  };
}

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
  const t = useTranslations("LootDrops");
  return (
    <div style={{ overflowX: "auto" }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
        <thead>
          <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.1)" }}>
            <th style={{ textAlign: "left", padding: "8px 10px", color: "#8B8FA3", fontSize: 11, fontWeight: 800, letterSpacing: 0.5 }}>{t("thRarity")}</th>
            <th style={{ textAlign: "right", padding: "8px 10px", color: "#8B8FA3", fontSize: 11, fontWeight: 800, letterSpacing: 0.5 }}>{t("thChance")}</th>
            <th style={{ textAlign: "left", padding: "8px 10px", color: "#8B8FA3", fontSize: 11, fontWeight: 800, letterSpacing: 0.5 }}>{t("thReward")}</th>
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
                  ? `+${(r as Record<string, unknown>).xp_reward} 🪙`
                  : (typeof (r as Record<string, unknown>).reward === "string" ? String((r as Record<string, unknown>).reward) : "—")}
                {typeof (r as Record<string, unknown>).note === "string" && (
                  <div style={{ color: "#8B8FA3", fontSize: 11, marginTop: 2 }}>{String((r as Record<string, unknown>).note)}</div>
                )}
                {Array.isArray((r as Record<string, unknown>).kinds) && (
                  <div style={{ color: "#8B8FA3", fontSize: 11, marginTop: 2 }}>
                    {t("rowKindsPrefix")} {((r as Record<string, unknown>).kinds as string[]).join(" · ")}
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

export default async function LootDropsPage() {
  const t = await getTranslations("LootDrops");
  return (
    <div style={{
      minHeight: "100vh",
      background: "linear-gradient(180deg, #0F1115 0%, #151823 100%)",
      color: "#F0F0F0",
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Inter, Roboto, sans-serif',
    }}>
      <div style={{ maxWidth: 760, margin: "0 auto", padding: "40px 20px 80px" }}>
        <Link href="/dashboard" style={{ color: "#22D1C3", fontSize: 13, fontWeight: 700, textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 6, marginBottom: 24 }}>
          {t("back")}
        </Link>

        <h1 style={{ margin: 0, marginBottom: 10, fontSize: 30, fontWeight: 900, letterSpacing: -0.5 }}>
          {t("title")}
        </h1>
        <p style={{ color: "#a8b4cf", fontSize: 14, lineHeight: 1.6, marginBottom: 30 }}>
          {t("intro")}
        </p>

        <div style={{
          background: "linear-gradient(135deg, rgba(34,209,195,0.08), rgba(168,85,247,0.08))",
          border: "1px solid rgba(34,209,195,0.3)",
          borderRadius: 12, padding: 16, marginBottom: 28,
          fontSize: 12, color: "#DDD", lineHeight: 1.55,
        }}>
          <strong style={{ color: "#22D1C3" }}>{t("legalLead")}</strong>{" "}
          {LOOT_DISCLOSURE_META.legal_note}
        </div>

        <Section num="1" title={t("section1Title")}>
          <p style={{ color: "#a8b4cf", fontSize: 12, marginBottom: 12, lineHeight: 1.5 }}
             dangerouslySetInnerHTML={{ __html: t("section1Body") }} />
          <LootTable rows={REDEMPTION_LOOT_TABLE} />
        </Section>

        <Section num="2" title={t("section2Title")}>
          <p style={{ color: "#DDD", fontSize: 13, lineHeight: 1.5 }}>{EQUIPMENT_DROP_NOTE}</p>
          <p style={{ color: "#8B8FA3", fontSize: 11, marginTop: 10 }}
             dangerouslySetInnerHTML={{ __html: t("section2Foot") }} />
        </Section>

        <Section num="3" title={t("section3Title")}>
          <p style={{ color: "#a8b4cf", fontSize: 12, marginBottom: 12, lineHeight: 1.5 }}>
            {t("section3Body")}
          </p>
          <LootTable rows={MAP_LOOT_CRATE_TABLE} />
        </Section>

        <Section num="4" title={t("section4Title")}>
          <p style={{ color: "#a8b4cf", fontSize: 12, marginBottom: 12, lineHeight: 1.5 }}>
            <strong style={{ color: "#FFD700" }}>{t("section4Hint")}</strong>
            <span dangerouslySetInnerHTML={{ __html: t("section4Body") }} />
          </p>
          <LootTable rows={MYSTERY_BOX_TABLE} />
        </Section>

        <Section num="5" title={t("section5Title")}>
          <p style={{ color: "#a8b4cf", fontSize: 12, marginBottom: 12, lineHeight: 1.5 }}>
            {t("section5Body")}
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
          {t("footStatus", { date: LOOT_DISCLOSURE_META.last_updated })}{" "}
          <a href={`mailto:${LOOT_DISCLOSURE_META.contact}`} style={{ color: "#22D1C3" }}>
            {LOOT_DISCLOSURE_META.contact}
          </a>
        </div>
      </div>
    </div>
  );
}
