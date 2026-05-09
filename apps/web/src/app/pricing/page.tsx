import Link from "next/link";
import Image from "next/image";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { GEM_BUNDLES, totalGemsOfBundle } from "@/lib/gem-bundles";
import { LandingBack } from "@/components/landing-back";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("PricingPage");
  return {
    title: t("metaTitle"),
    description: t("metaDescription"),
  };
}

const BADGE_STYLE: Record<string, { label: string; bg: string; color: string; border: string }> = {
  starter:      { label: "STARTER",   bg: "rgba(74,222,128,0.15)",  color: "#4ade80", border: "rgba(74,222,128,0.5)" },
  most_popular: { label: "BELIEBT",   bg: "rgba(34,209,195,0.18)",  color: "#22D1C3", border: "rgba(34,209,195,0.6)" },
  best_value:   { label: "BESTER WERT", bg: "rgba(255,215,0,0.18)", color: "#FFD700", border: "rgba(255,215,0,0.6)" },
  supporter:    { label: "SUPPORTER", bg: "rgba(168,85,247,0.18)",  color: "#a855f7", border: "rgba(168,85,247,0.6)" },
};

function formatEur(cents: number): string {
  return `€ ${(cents / 100).toFixed(2).replace(".", ",")}`;
}

export default async function PricingPage() {
  const t = await getTranslations("PricingPage");
  return (
    <main className="min-h-screen px-4 py-10">
      <div className="max-w-5xl mx-auto">

        {/* Back-Button + Logo */}
        <div className="mb-8">
          <div className="mb-6">
            <LandingBack label={t("backToHome")} />
          </div>
          <div className="text-center">
            <Image src="/logo.png" alt="MyArea365" width={56} height={56} className="mx-auto mb-3 rounded-full" />
            <h1 className="text-3xl sm:text-4xl font-black text-white">{t("heading")}</h1>
            <p className="text-text-muted mt-3 max-w-2xl mx-auto leading-relaxed">
              {t("intro")}
            </p>
          </div>
        </div>

        {/* Diamanten-Bundles — Hauptprodukt */}
        <section className="mb-14">
          <div className="text-center mb-6">
            <div className="text-xs font-black tracking-widest text-primary mb-2">{t("gemsKicker")}</div>
            <h2 className="text-2xl sm:text-3xl font-black text-white mb-2">{t("gemsHeading")}</h2>
            <p className="text-sm text-text-muted max-w-xl mx-auto">{t("gemsIntro")}</p>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 gap-3 sm:gap-4">
            {GEM_BUNDLES.map((b) => {
              const total = totalGemsOfBundle(b);
              const badge = b.badge ? BADGE_STYLE[b.badge] : null;
              const featured = b.badge === "most_popular" || b.badge === "best_value";
              return (
                <div
                  key={b.sku}
                  className="relative rounded-2xl p-5 flex flex-col text-center"
                  style={{
                    background: featured
                      ? "linear-gradient(160deg, rgba(34,209,195,0.10), rgba(255,215,0,0.10))"
                      : "rgba(26,29,35,0.85)",
                    border: featured
                      ? `1.5px solid ${badge?.color ?? "#22D1C3"}`
                      : "1px solid rgba(255,255,255,0.08)",
                    boxShadow: featured ? `0 0 24px ${badge?.color ?? "#22D1C3"}33` : "none",
                  }}
                >
                  {badge && (
                    <div
                      className="absolute -top-2.5 left-1/2 -translate-x-1/2 px-2.5 py-0.5 rounded-full text-[9px] font-black tracking-wider whitespace-nowrap"
                      style={{ background: badge.bg, color: badge.color, border: `1px solid ${badge.border}` }}
                    >
                      {badge.label}
                    </div>
                  )}
                  <div className="text-3xl mb-1" aria-hidden="true">💎</div>
                  <div className="text-xl sm:text-2xl font-black text-white">
                    {total.toLocaleString("de-DE")}
                  </div>
                  {b.bonus > 0 && (
                    <div className="text-[10px] text-success font-bold mt-0.5">
                      +{b.bonus.toLocaleString("de-DE")} {t("gemsBonus")}
                    </div>
                  )}
                  <div className="text-2xl font-black mt-3 mb-1" style={{ color: badge?.color ?? "#22D1C3" }}>
                    {formatEur(b.price_cents)}
                  </div>
                  <Link
                    href={`/karte/?buy_gems=${b.sku}`}
                    className="mt-3 block py-2 rounded-lg text-xs font-bold transition-colors"
                    style={{
                      background: featured ? (badge?.color ?? "#22D1C3") : "rgba(255,255,255,0.06)",
                      color: featured ? "#0F1115" : "#FFF",
                    }}
                  >
                    {t("buy")}
                  </Link>
                </div>
              );
            })}
          </div>
        </section>

        {/* Monthly Pass + Saison-Pakete */}
        <section className="mb-14">
          <div className="text-center mb-6">
            <div className="text-xs font-black tracking-widest text-xp mb-2">{t("passKicker")}</div>
            <h2 className="text-2xl sm:text-3xl font-black text-white mb-2">{t("passHeading")}</h2>
            <p className="text-sm text-text-muted max-w-xl mx-auto">{t("passIntro")}</p>
          </div>
          <div className="grid sm:grid-cols-2 gap-4">
            <FeatureCard
              icon="🎫"
              title={t("passDailyTitle")}
              desc={t("passDailyDesc")}
              cta={t("openInGame")}
              href="/karte/?modal=monthly_pack"
              accent="#FFD700"
            />
            <FeatureCard
              icon="🔥"
              title={t("passSeasonalTitle")}
              desc={t("passSeasonalDesc")}
              cta={t("openInGame")}
              href="/karte/?modal=deals"
              accent="#FF6B4A"
            />
          </div>
        </section>

        {/* Cosmetics */}
        <section className="mb-14">
          <div className="text-center mb-6">
            <div className="text-xs font-black tracking-widest text-accent mb-2">{t("cosmeticsKicker")}</div>
            <h2 className="text-2xl sm:text-3xl font-black text-white mb-2">{t("cosmeticsHeading")}</h2>
            <p className="text-sm text-text-muted max-w-xl mx-auto">{t("cosmeticsIntro")}</p>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { icon: "📍", title: t("cosmPin"),   desc: t("cosmPinDesc"),   accent: "#22D1C3" },
              { icon: "🧭", title: t("cosmMarker"),desc: t("cosmMarkerDesc"),accent: "#FFD700" },
              { icon: "✨", title: t("cosmLight"), desc: t("cosmLightDesc"), accent: "#a855f7" },
              { icon: "🏰", title: t("cosmBase"),  desc: t("cosmBaseDesc"),  accent: "#FF2D78" },
            ].map((c) => (
              <div
                key={c.title}
                className="rounded-xl p-4 text-center"
                style={{
                  background: `${c.accent}10`,
                  border: `1px solid ${c.accent}44`,
                }}
              >
                <div className="text-2xl mb-1" aria-hidden="true">{c.icon}</div>
                <div className="font-bold text-sm" style={{ color: c.accent }}>{c.title}</div>
                <div className="text-[10px] text-text-muted mt-1 leading-tight">{c.desc}</div>
              </div>
            ))}
          </div>
          <div className="text-center mt-6">
            <Link
              href="/karte/?modal=cosmetics"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-accent/15 border border-accent/40 text-accent text-sm font-bold hover:bg-accent/25 transition-colors"
            >
              🎨 {t("cosmeticsCta")}
            </Link>
          </div>
        </section>

        {/* Fair-Play-Disclaimer — was es NICHT für Geld gibt */}
        <section className="mb-14">
          <div
            className="rounded-2xl p-6 sm:p-8"
            style={{
              background: "linear-gradient(160deg, rgba(74,222,128,0.10), rgba(34,209,195,0.05))",
              border: "1px solid rgba(74,222,128,0.35)",
            }}
          >
            <div className="flex items-start gap-3 mb-4">
              <span className="text-3xl shrink-0" aria-hidden="true">⚖️</span>
              <div>
                <h2 className="text-xl sm:text-2xl font-black text-white">{t("fairplayHeading")}</h2>
                <p className="text-sm text-text-muted mt-1">{t("fairplaySub")}</p>
              </div>
            </div>
            <ul className="space-y-2 text-sm text-text">
              <FairplayRow icon="🛡️">{t("fairplay1")}</FairplayRow>
              <FairplayRow icon="🪖">{t("fairplay2")}</FairplayRow>
              <FairplayRow icon="🧪">{t("fairplay3")}</FairplayRow>
              <FairplayRow icon="🏆">{t("fairplay4")}</FairplayRow>
              <FairplayRow icon="👑">{t("fairplay5")}</FairplayRow>
            </ul>
            <p className="text-xs text-text-muted mt-5 leading-relaxed">
              {t.rich("fairplayLootRich", {
                a: (chunks) => <Link href="/loot-drops" className="text-primary hover:underline">{chunks}</Link>,
              })}
            </p>
          </div>
        </section>

        {/* Footer */}
        <div className="text-center text-xs text-text-muted">
          {t("footer")}{" "}
          <a href="mailto:support@myarea365.de" className="text-primary hover:underline">
            {t("questions")}
          </a>
        </div>
      </div>
    </main>
  );
}

function FeatureCard({
  icon, title, desc, cta, href, accent,
}: {
  icon: string;
  title: string;
  desc: string;
  cta: string;
  href: string;
  accent: string;
}) {
  return (
    <div
      className="rounded-2xl p-5 flex flex-col"
      style={{
        background: `${accent}10`,
        border: `1px solid ${accent}44`,
      }}
    >
      <div className="flex items-start gap-3 mb-3">
        <span className="text-3xl shrink-0" aria-hidden="true">{icon}</span>
        <div>
          <div className="font-bold text-base text-white">{title}</div>
          <div className="text-xs text-text-muted mt-1 leading-relaxed">{desc}</div>
        </div>
      </div>
      <Link
        href={href}
        className="mt-auto py-2 px-4 rounded-lg text-center text-xs font-bold transition-colors"
        style={{ background: `${accent}25`, color: accent, border: `1px solid ${accent}66` }}
      >
        {cta}
      </Link>
    </div>
  );
}

function FairplayRow({ icon, children }: { icon: string; children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-2.5">
      <span className="text-success font-bold shrink-0" aria-hidden="true">✓</span>
      <span className="shrink-0" aria-hidden="true">{icon}</span>
      <span className="text-text">{children}</span>
    </li>
  );
}
