import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { LandingBack } from "@/components/landing-back";
import {
  PAID_DETERMINISTIC_ITEMS,
  WAHL_BOX_OPTIONS,
  ARENA_WIN_REWARDS, SEASON_REWARDS_TABLE, LOOT_DISCLOSURE_META,
} from "@/lib/loot-drops-public";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("LootDrops");
  return {
    title: t("metaTitle"),
    description: t("metaDescription"),
  };
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
        <div style={{ marginBottom: 24 }}>
          <LandingBack />
        </div>

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
          <p style={{ color: "#a8b4cf", fontSize: 12, marginBottom: 12, lineHeight: 1.55 }}>
            <strong style={{ color: "#FFD700" }}>{t("section1Lead")}</strong> {t("section1Body")}
          </p>
          <div style={{ display: "grid", gap: 6 }}>
            {PAID_DETERMINISTIC_ITEMS.map((it, i) => (
              <div key={i} style={{
                padding: "10px 12px", borderRadius: 10,
                background: "rgba(74,222,128,0.05)", border: "1px solid rgba(74,222,128,0.25)",
                display: "flex", alignItems: "flex-start", gap: 10, fontSize: 13,
              }}>
                <span style={{ fontSize: 18, lineHeight: 1.2 }}>{it.icon}</span>
                <div style={{ flex: 1 }}>
                  <div style={{ color: "#FFF", fontWeight: 800 }}>{it.title}</div>
                  <div style={{ color: "#a8b4cf", fontSize: 11, marginTop: 2 }}>{it.mechanic}</div>
                </div>
              </div>
            ))}
          </div>
        </Section>

        <Section num="2" title={t("section2Title")}>
          <p style={{ color: "#a8b4cf", fontSize: 12, marginBottom: 12, lineHeight: 1.55 }}>
            <strong style={{ color: "#FFD700" }}>{t("section2Lead")}</strong> {t("section2Body")}
          </p>
          <div style={{ display: "grid", gap: 6 }}>
            {WAHL_BOX_OPTIONS.map((o, i) => (
              <div key={i} style={{
                padding: "10px 12px", borderRadius: 10,
                background: "rgba(255,215,0,0.05)", border: "1px solid rgba(255,215,0,0.2)",
                display: "flex", alignItems: "center", gap: 10, fontSize: 13,
              }}>
                <span style={{ fontSize: 18 }}>{o.icon}</span>
                <div style={{ flex: 1 }}>
                  <div style={{ color: "#FFF", fontWeight: 800 }}>{o.title}</div>
                  <div style={{ color: "#8B8FA3", fontSize: 11 }}>{o.value}</div>
                </div>
              </div>
            ))}
          </div>
        </Section>

        <Section num="3" title={t("section3Title")}>
          <p style={{ color: "#a8b4cf", fontSize: 12, marginBottom: 12, lineHeight: 1.5 }}>
            {t("section3Body")}
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

        <Section num="4" title={t("section4Title")}>
          <p style={{ color: "#a8b4cf", fontSize: 12, marginBottom: 12, lineHeight: 1.55 }}>
            {t.rich("section4Body", {
              b: (chunks) => <b style={{ color: "#FFF" }}>{chunks}</b>,
              code: (chunks) => (
                <code style={{ background: "rgba(255,255,255,0.06)", padding: "1px 6px", borderRadius: 4 }}>{chunks}</code>
              ),
            })}
          </p>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
              <thead>
                <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.1)" }}>
                  <th style={{ textAlign: "left", padding: "8px 10px", color: "#8B8FA3", fontSize: 11, fontWeight: 800 }}>{t("thSystem")}</th>
                  <th style={{ textAlign: "left", padding: "8px 10px", color: "#8B8FA3", fontSize: 11, fontWeight: 800 }}>{t("thCadence")}</th>
                  <th style={{ textAlign: "left", padding: "8px 10px", color: "#8B8FA3", fontSize: 11, fontWeight: 800 }}>{t("thTier")}</th>
                  <th style={{ textAlign: "left", padding: "8px 10px", color: "#8B8FA3", fontSize: 11, fontWeight: 800 }}>{t("thReward")}</th>
                </tr>
              </thead>
              <tbody>
                {SEASON_REWARDS_TABLE.map((r, i) => (
                  <tr key={i} style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
                    <td style={{ padding: "8px 10px", color: "#FFF", fontWeight: 700, whiteSpace: "nowrap" }}>{r.system}</td>
                    <td style={{ padding: "8px 10px", color: "#8B8FA3", fontSize: 11 }}>{r.cadence}</td>
                    <td style={{ padding: "8px 10px", color: "#a8b4cf" }}>{r.tier}</td>
                    <td style={{ padding: "8px 10px", color: "#FFD700", fontWeight: 700 }}>{r.reward}</td>
                  </tr>
                ))}
              </tbody>
            </table>
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
