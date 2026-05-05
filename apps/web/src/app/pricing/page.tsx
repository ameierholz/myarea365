import Link from "next/link";
import Image from "next/image";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { PLANS, PLUS_FEATURES, CREW_PRO_FEATURES, BOOST_PACKS, EXTRAS, formatPrice } from "@/lib/monetization";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("PricingPage");
  return {
    title: t("metaTitle"),
    description: t("metaDescription"),
  };
}

export default async function PricingPage() {
  const t = await getTranslations("PricingPage");
  return (
    <main className="min-h-screen px-4 py-12">
      <div className="max-w-5xl mx-auto">
        <div className="text-center mb-10">
          <Image src="/logo.png" alt="MyArea365" width={48} height={48} className="mx-auto mb-3 rounded-full" />
          <Link href="/" className="text-xs text-text-muted hover:text-white">{t("homeLink")}</Link>
          <h1 className="text-3xl sm:text-4xl font-black text-white mt-3">{t("heading")}</h1>
          <p className="text-text-muted mt-2 max-w-xl mx-auto">
            {t("intro")}
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-5 mb-12">
          <div className="bg-bg-card border border-border rounded-2xl p-6 flex flex-col">
            <div className="text-xs font-bold tracking-widest text-text-muted mb-2">{t("tierFreeKicker")}</div>
            <div className="text-3xl font-black mb-1">{t("tierFreePrice")}</div>
            <div className="text-xs text-text-muted mb-5">{t("tierFreeSub")}</div>
            <ul className="space-y-2 text-sm flex-1">
              <Feat>{t("freeFeat1")}</Feat>
              <Feat>{t("freeFeat2")}</Feat>
              <Feat>{t("freeFeat3")}</Feat>
              <Feat>{t("freeFeat4")}</Feat>
              <Feat>{t("freeFeat5")}</Feat>
            </ul>
            <Link href="/#start" className="mt-6 text-center py-2.5 rounded-lg bg-white/10 text-white hover:bg-white/15 text-sm font-bold">
              {t("freeCta")}
            </Link>
          </div>

          <div className="rounded-2xl p-6 flex flex-col relative" style={{
            background: "linear-gradient(135deg, rgba(34,209,195,0.15), rgba(255,45,120,0.15))",
            border: "2px solid #22D1C3",
            boxShadow: "0 0 30px rgba(34,209,195,0.25)",
          }}>
            <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full text-[10px] font-black" style={{ background: "#22D1C3", color: "#0F1115" }}>
              {t("popularBadge")}
            </div>
            <div className="text-xs font-bold tracking-widest text-primary mb-2">{t("tierPlusKicker")}</div>
            <div className="text-3xl font-black mb-1">{formatPrice(PLANS.plus_monthly.price)}<span className="text-sm text-text-muted font-normal">{t("perMonth")}</span></div>
            <div className="text-xs text-text-muted mb-5">{t("tierPlusYearly", { price: formatPrice(PLANS.plus_yearly.price) })}</div>
            <ul className="space-y-2 text-sm flex-1">
              {PLUS_FEATURES.slice(0, 7).map((f) => (
                <Feat key={f.title}><b>{f.title}</b> — <span className="text-text-muted">{f.desc}</span></Feat>
              ))}
              <li className="text-xs text-text-muted pl-6">{t("moreFeats", { n: PLUS_FEATURES.length - 7 })}</li>
            </ul>
            <Link href="/karte/?upgrade=plus" className="mt-6 text-center py-2.5 rounded-lg bg-primary text-bg-deep hover:bg-primary-dim text-sm font-bold">
              {t("tierPlusCta")}
            </Link>
          </div>

          <div className="bg-bg-card border border-border rounded-2xl p-6 flex flex-col">
            <div className="text-xs font-bold tracking-widest text-text-muted mb-2">{t("tierCrewKicker")}</div>
            <div className="text-3xl font-black mb-1">{formatPrice(PLANS.crew_pro_monthly.price)}<span className="text-sm text-text-muted font-normal">{t("perMonth")}</span></div>
            <div className="text-xs text-text-muted mb-5">{t("tierCrewYearly", { price: formatPrice(PLANS.crew_pro_yearly.price) })}</div>
            <ul className="space-y-2 text-sm flex-1">
              {CREW_PRO_FEATURES.map((f) => (
                <Feat key={f.title}><b>{f.title}</b> — <span className="text-text-muted">{f.desc}</span></Feat>
              ))}
            </ul>
            <Link href="/karte/?upgrade=crew" className="mt-6 text-center py-2.5 rounded-lg bg-accent text-white hover:bg-accent-dim text-sm font-bold">
              {t("tierCrewCta")}
            </Link>
          </div>
        </div>

        <h2 className="text-2xl font-black text-white mb-3">{t("boostsHeading")}</h2>
        <p className="text-text-muted text-sm mb-5">{t("boostsIntro")}</p>
        <div className="grid sm:grid-cols-2 md:grid-cols-4 gap-3 mb-12">
          {Object.values(BOOST_PACKS).map((p) => (
            <div key={p.sku} className="bg-bg-card border border-border rounded-xl p-4 text-center">
              <div className="text-3xl mb-2">⚡</div>
              <div className="text-xs text-text-muted mb-1">{t("boostMeta", { mult: p.multiplier, h: p.hours })}</div>
              <div className="text-base font-bold text-white mb-2">{p.name}</div>
              <div className="text-2xl font-black text-xp mb-3">{formatPrice(p.price)}</div>
              <Link href={`/karte/?buy=${p.sku}`} className="block py-2 rounded-lg bg-xp/20 text-xp hover:bg-xp/30 text-xs font-bold">
                {t("buy")}
              </Link>
            </div>
          ))}
        </div>

        <h2 className="text-2xl font-black text-white mb-3">{t("extrasHeading")}</h2>
        <div className="grid sm:grid-cols-2 md:grid-cols-5 gap-3 mb-12">
          {Object.values(EXTRAS).map((e) => (
            <div key={e.sku} className="bg-bg-card border border-border rounded-xl p-4 text-center">
              <div className="text-base font-bold text-white mb-2">{e.name}</div>
              <div className="text-lg font-black text-primary mb-3">{formatPrice(e.price)}</div>
              <Link href={`/karte/?buy=${e.sku}`} className="block py-1.5 rounded-lg bg-white/5 text-white hover:bg-white/10 text-xs font-bold">
                {t("buy")}
              </Link>
            </div>
          ))}
        </div>

        <div className="text-center text-xs text-text-muted">
          {t("footer")} <a href="mailto:support@myarea365.de" className="text-primary hover:underline">{t("questions")}</a>
        </div>
      </div>
    </main>
  );
}

function Feat({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex gap-2 text-text">
      <span className="text-primary font-bold shrink-0">✓</span>
      <span>{children}</span>
    </li>
  );
}
