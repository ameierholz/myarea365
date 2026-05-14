import Link from "next/link";
import Image from "next/image";
import { getTranslations } from "next-intl/server";
import { MapPin, Crown, Swords, Shield, Building2, Trophy, Target } from "lucide-react";
import { InlineAuth } from "@/components/inline-auth";
import { HeroMap } from "@/components/hero-map-client";
import { CookieSettingsButton } from "@/components/cookie-settings-button";
import { ALL_PLAYSTYLES } from "@/lib/playstyles";

export default async function LandingPage() {
  const t = await getTranslations("Landing");

  // Spielstile mit i18n-Übersetzung
  const PLAYSTYLE_CARDS = ALL_PLAYSTYLES.map((p) => ({
    id: p.id,
    name: t(`playstyle.${p.id}.name`),
    icon: p.icon,
    color: p.color,
    motto: t(`playstyle.${p.id}.motto`),
    desc: t(`playstyle.${p.id}.desc`),
  }));

  return (
    <>
      {/* ── Nav ─────────────────────────────────────────── */}
      <nav className="fixed top-0 w-full z-50 border-b border-border/50 bg-bg/80 backdrop-blur-xl">
        <div className="mx-auto max-w-6xl flex items-center justify-between px-4 h-16">
          <Link href="/" className="flex items-center gap-2.5">
            <Image src="/logo.png" alt="MyArea365" width={36} height={36} className="rounded-full" />
            <span className="text-xl font-bold tracking-tight">
              My<span className="text-primary">Area</span>365
            </span>
          </Link>
          <div className="hidden sm:flex items-center gap-6 text-sm text-text-muted">
            <a href="#stadt" className="hover:text-text transition-colors">{t("navCity")}</a>
            <a href="#crews" className="hover:text-text transition-colors">{t("navCrews")}</a>
            <a href="#cvc" className="hover:text-text transition-colors">{t("navCvc")}</a>
            <a href="#styles" className="hover:text-text transition-colors">{t("navStyles")}</a>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/login" className="text-sm text-text-muted hover:text-text transition-colors">{t("navSignIn")}</Link>
            <a href="#start" className="text-sm px-4 py-2 rounded-lg bg-primary text-bg-deep font-semibold hover:bg-primary-dim transition-colors">{t("navStart")}</a>
          </div>
        </div>
      </nav>

      {/* ── Hero ────────────────────────────────────────── */}
      <section className="relative min-h-screen flex flex-col pt-16 overflow-hidden">
        <HeroMap />

        <div className="relative z-10 text-center px-4 max-w-3xl mx-auto pt-4 sm:pt-6">
          <div className="flex items-center justify-center gap-4 mb-4">
            <Image src="/logo.png" alt="MyArea365 Logo" width={72} height={72} priority className="drop-shadow-[0_0_20px_rgba(34,209,195,0.3)]" />
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-primary/20 bg-primary/5 text-primary text-sm font-semibold">
              <Crown className="w-4 h-4" />
              {t("heroBadge")}
            </div>
          </div>

          <h1 className="text-4xl sm:text-5xl font-bold tracking-tight leading-[1.1]">
            {t("heroTitle1")}
            <br />
            <span className="text-primary">{t("heroTitle2")}</span>
          </h1>
          <p className="text-base sm:text-lg text-text-muted mt-4 max-w-xl mx-auto">
            {t("heroTagline")}
          </p>
        </div>

        <div className="flex-1" />

        <div id="start" className="relative z-10 text-center px-4 max-w-xl mx-auto pb-4">
          <p className="text-sm sm:text-base text-text-muted mb-5">
            {t("heroSubtitle")}
          </p>

          <InlineAuth />

          <div className="flex flex-col sm:flex-row gap-2 sm:gap-4 justify-center mt-4">
            <Link
              href="/leaderboard"
              className="inline-flex items-center justify-center gap-2 text-sm text-text-muted hover:text-primary transition"
            >
              🏆 <span>{t("heroLeaderboardCta")}</span>
            </Link>
            <Link
              href="/saga"
              className="inline-flex items-center justify-center gap-2 text-sm text-text-muted hover:text-primary transition"
            >
              🏙️ <span>{t("heroSagaCta")}</span>
            </Link>
          </div>
        </div>

        <div className="relative z-10 mt-auto pb-10">
          <div className="flex justify-center gap-8">
            {[
              { value: "100%", label: t("statFree") },
              { value: t("statServersValue"),    label: t("statServers") },
              { value: "365",  label: t("statDays") },
            ].map((s) => (
              <div key={s.label} className="text-center">
                <div className="text-2xl font-bold text-primary">{s.value}</div>
                <div className="text-xs text-text-muted mt-1">{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── 4 Säulen ────────────────────────────────────── */}
      <section className="relative py-20 px-4 border-t border-border/50 bg-[radial-gradient(ellipse_at_top,rgba(34,209,195,0.18),transparent_60%)]">
        <div className="mx-auto max-w-6xl text-center">
          <h2 className="text-3xl sm:text-4xl font-bold mb-3">{t("pillarsTitle")}</h2>
          <p className="text-text-muted mb-12 max-w-lg mx-auto">{t("pillarsSub")}</p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { icon: "🏙️", label: t("pillarCity"),   desc: t("pillarCityDesc"),   color: "#22D1C3" },
              { icon: "🤝", label: t("pillarCrews"),  desc: t("pillarCrewsDesc"),  color: "#a855f7" },
              { icon: "⚔️", label: t("pillarCvc"),    desc: t("pillarCvcDesc"),    color: "#FF6B4A" },
              { icon: "👑", label: t("pillarDon"),    desc: t("pillarDonDesc"),    color: "#FFD700" },
            ].map((p) => (
              <div key={p.label} className="p-5 rounded-2xl border"
                style={{ background: `${p.color}14`, borderColor: `${p.color}55` }}>
                <div className="text-3xl mb-2">{p.icon}</div>
                <div className="font-bold text-sm mb-1" style={{ color: p.color }}>{p.label}</div>
                <div className="text-xs text-text-muted leading-tight">{p.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Stadt-Server (Heimat-Karte) ──────────────────────── */}
      <section id="stadt" className="relative py-24 px-4 border-t border-border/50 bg-[radial-gradient(ellipse_at_left,rgba(34,209,195,0.14),transparent_55%),radial-gradient(ellipse_at_right,rgba(255,215,0,0.12),transparent_55%)]">
        <div className="mx-auto max-w-6xl">
          <div className="grid md:grid-cols-2 gap-12 items-center mb-16">
            <div>
              <div className="text-xs font-bold tracking-widest text-primary mb-3">{t("cityKicker")}</div>
              <h2 className="text-3xl sm:text-4xl font-bold mb-4 leading-tight">
                {t("cityTitle1")} <span className="text-primary">{t("cityTitle2")}</span>{t("cityTitleDot")}
              </h2>
              <p className="text-text-muted leading-relaxed mb-6">
                {t("cityDesc")}
              </p>
              <div className="grid grid-cols-3 gap-3">
                <FeatureMini icon={<MapPin className="w-5 h-5" />} label={t("miniHomeMap")} desc={t("miniHomeMapDesc")} />
                <FeatureMini icon={<Building2 className="w-5 h-5" />} label={t("miniBuild")} desc={t("miniBuildDesc")} />
                <FeatureMini icon={<Shield className="w-5 h-5" />} label={t("miniGuardians")} desc={t("miniGuardiansDesc")} />
              </div>
            </div>
            <div className="p-6 rounded-3xl bg-linear-to-br from-primary/10 via-bg-card to-accent/10 border border-primary/20">
              <div className="text-xs font-bold text-primary tracking-widest mb-4">{t("cityHowHeader")}</div>
              <div className="space-y-3">
                {[
                  { icon: "📮", label: t("cityHow1"),   sub: t("cityHow1Sub") },
                  { icon: "🏗️", label: t("cityHow2"),  sub: t("cityHow2Sub") },
                  { icon: "🤝", label: t("cityHow3"),  sub: t("cityHow3Sub") },
                  { icon: "👑", label: t("cityHow4"),  sub: t("cityHow4Sub") },
                ].map((x) => (
                  <div key={x.label} className="flex items-center gap-3 p-2.5 rounded-lg bg-black/20">
                    <div className="text-xl">{x.icon}</div>
                    <div className="flex-1 text-sm">
                      <div className="text-text font-semibold">{x.label}</div>
                      <div className="text-xs text-text-muted">{x.sub}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Crews ─────────────────────────────────────────── */}
      <section id="crews" className="relative py-24 px-4 border-t border-border/50 bg-[radial-gradient(ellipse_at_top_right,rgba(168,85,247,0.18),transparent_55%),radial-gradient(ellipse_at_bottom_left,rgba(34,209,195,0.14),transparent_55%)]">
        <div className="mx-auto max-w-6xl">
          <div className="text-center mb-14">
            <div className="text-xs font-bold tracking-widest text-primary mb-3">{t("crewsKicker")}</div>
            <h2 className="text-3xl sm:text-4xl font-bold mb-4 leading-tight">
              {t("crewsTitle1")}<br />
              <span className="bg-linear-to-r from-primary to-accent bg-clip-text text-transparent">{t("crewsTitleAccent")}</span> {t("crewsTitle2")}
            </h2>
            <p className="text-text-muted max-w-xl mx-auto">
              {t("crewsSubtitle")}
            </p>
          </div>
          <div className="grid md:grid-cols-3 gap-5">
            {[
              { icon: "🏛️", title: t("crewHall"),       desc: t("crewHallDesc"),       accent: "#22D1C3" },
              { icon: "🪖", title: t("crewArmy"),       desc: t("crewArmyDesc"),       accent: "#FF6B4A" },
              { icon: "🧪", title: t("crewResearch"),   desc: t("crewResearchDesc"),   accent: "#a855f7" },
              { icon: "🏚️", title: t("crewBandits"),    desc: t("crewBanditsDesc"),    accent: "#FFD700" },
              { icon: "💬", title: t("crewChat"),       desc: t("crewChatDesc"),       accent: "#4ade80" },
              { icon: "🏆", title: t("crewLeague"),     desc: t("crewLeagueDesc"),     accent: "#FF2D78" },
            ].map((f) => (
              <div key={f.title} className="p-5 rounded-2xl bg-bg-card border border-border" style={{ borderTop: `3px solid ${f.accent}` }}>
                <div className="text-2xl mb-2">{f.icon}</div>
                <div className="font-bold mb-1">{f.title}</div>
                <div className="text-sm text-text-muted leading-relaxed">{f.desc}</div>
              </div>
            ))}
          </div>
          <div className="mt-10 text-center">
            <div className="inline-flex items-center gap-6 flex-wrap justify-center text-sm text-text-muted">
              <span>{t("crewChip1")}</span>
              <span>{t("crewChip2")}</span>
              <span>{t("crewChip3")}</span>
              <span>{t("crewChip4")}</span>
              <span>{t("crewChip5")}</span>
            </div>
          </div>
        </div>
      </section>

      {/* ── CvC: Crew vs Crew ─────────────────────────────────────────── */}
      <section id="cvc" className="relative py-24 px-4 border-t border-border/50 bg-bg-card/70 bg-[radial-gradient(ellipse_at_center,rgba(255,107,74,0.18),transparent_60%)]">
        <div className="mx-auto max-w-6xl">
          <div className="text-center mb-14">
            <div className="text-xs font-bold tracking-widest text-accent mb-3">{t("cvcKicker")}</div>
            <h2 className="text-3xl sm:text-4xl font-bold mb-4 leading-tight">
              {t("cvcTitle1")} <span className="text-accent">{t("cvcTitleAccent")}</span>{t("cvcTitle2")}
            </h2>
            <p className="text-text-muted max-w-xl mx-auto">
              {t("cvcSubtitle")}
            </p>
          </div>
          <div className="grid md:grid-cols-3 gap-5 mb-10">
            {[
              { icon: <Target className="w-6 h-6" />,  title: t("cvcStep1Title"), desc: t("cvcStep1Desc"), accent: "#22D1C3" },
              { icon: <Swords className="w-6 h-6" />,  title: t("cvcStep2Title"), desc: t("cvcStep2Desc"), accent: "#FF6B4A" },
              { icon: <Trophy className="w-6 h-6" />,  title: t("cvcStep3Title"), desc: t("cvcStep3Desc"), accent: "#FFD700" },
            ].map((s) => (
              <div key={s.title} className="p-5 rounded-2xl bg-bg-card border" style={{ borderColor: `${s.accent}55` }}>
                <div className="mb-3" style={{ color: s.accent }}>{s.icon}</div>
                <div className="text-lg font-bold mb-1" style={{ color: s.accent }}>{s.title}</div>
                <div className="text-sm text-text-muted leading-relaxed">{s.desc}</div>
              </div>
            ))}
          </div>
          <div className="p-5 rounded-2xl bg-linear-to-br from-accent/10 via-bg-card to-primary/10 border border-accent/30 max-w-2xl mx-auto">
            <div className="flex items-start gap-3">
              <Crown className="w-6 h-6 text-xp shrink-0 mt-0.5" />
              <div>
                <div className="font-bold mb-1 text-xp">{t("cvcDonTitle")}</div>
                <div className="text-sm text-text-muted leading-relaxed">{t("cvcDonDesc")}</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Wetter & Tageszeit ─────────────────────────────── */}
      <section id="weather" className="relative py-24 px-4 border-t border-border/50 bg-[radial-gradient(ellipse_at_top_left,rgba(34,209,195,0.18),transparent_55%),radial-gradient(ellipse_at_bottom_right,rgba(168,85,247,0.16),transparent_55%)]">
        <div className="mx-auto max-w-5xl">
          <div className="text-center mb-12">
            <div className="text-xs font-bold tracking-widest text-primary mb-3">{t("weatherKicker")}</div>
            <h2 className="text-3xl sm:text-4xl font-bold mb-3">
              {t("weatherTitle1")} <span className="text-primary">{t("weatherTitleAccent")}</span>{t("weatherTitle2")}
            </h2>
            <p className="text-text-muted max-w-2xl mx-auto leading-relaxed">{t("weatherSubtitle")}</p>
          </div>

          {/* Beispiel-Streifen: aktuelles Wetter als Live-Demo (statische Mock-Werte für die Landing) */}
          <div className="mb-10 flex flex-wrap justify-center gap-2.5 text-[12px] font-bold">
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-[#22D1C3]/40 bg-[#22D1C3]/10 text-[#22D1C3]">
              <span className="text-base">☀️</span> Klar — Schützen +5 %
            </span>
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-[#a8b4cf]/40 bg-[#a8b4cf]/10 text-[#a8b4cf]">
              <span className="text-base">🌧️</span> Regen — Schützen −20 %, Türsteher +10 % Def
            </span>
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-[#a855f7]/40 bg-[#a855f7]/10 text-[#a855f7]">
              <span className="text-base">⛈️</span> Sturm — Brecher +15 %, Marsch −30 %
            </span>
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-[#FF6B4A]/40 bg-[#FF6B4A]/10 text-[#FF6B4A]">
              <span className="text-base">🔥</span> Hitze — Sammeln +10 %, Rüstung −10 %
            </span>
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-[#818cf8]/40 bg-[#818cf8]/10 text-[#818cf8]">
              <span className="text-base">🌙</span> Nacht — Kurier +15 %, Schütze −15 %
            </span>
          </div>

          {/* 4 Benefit-Cards */}
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="p-5 rounded-2xl border-2 border-[#22D1C3]/30 bg-[#22D1C3]/5">
              <div className="text-3xl mb-2">🛰️</div>
              <div className="text-base font-black text-[#22D1C3] mb-1">{t("weatherBenefit1Title")}</div>
              <div className="text-xs text-text-muted leading-relaxed">{t("weatherBenefit1Desc")}</div>
            </div>
            <div className="p-5 rounded-2xl border-2 border-[#FFD700]/30 bg-[#FFD700]/5">
              <div className="text-3xl mb-2">🌦️</div>
              <div className="text-base font-black text-[#FFD700] mb-1">{t("weatherBenefit2Title")}</div>
              <div className="text-xs text-text-muted leading-relaxed">{t("weatherBenefit2Desc")}</div>
            </div>
            <div className="p-5 rounded-2xl border-2 border-[#FF6B4A]/30 bg-[#FF6B4A]/5">
              <div className="text-3xl mb-2">⚔️</div>
              <div className="text-base font-black text-[#FF6B4A] mb-1">{t("weatherBenefit3Title")}</div>
              <div className="text-xs text-text-muted leading-relaxed">{t("weatherBenefit3Desc")}</div>
            </div>
            <div className="p-5 rounded-2xl border-2 border-[#a855f7]/30 bg-[#a855f7]/5">
              <div className="text-3xl mb-2">🧥</div>
              <div className="text-base font-black text-[#a855f7] mb-1">{t("weatherBenefit4Title")}</div>
              <div className="text-xs text-text-muted leading-relaxed">{t("weatherBenefit4Desc")}</div>
            </div>
          </div>

          <p className="text-center text-xs text-text-muted mt-8 italic max-w-2xl mx-auto">
            {t("weatherSpecialty")}
          </p>
        </div>
      </section>

      {/* ── Spielstile ─────────────────────────────────────── */}
      <section id="styles" className="relative py-24 px-4 border-t border-border/50 bg-[radial-gradient(ellipse_at_top,rgba(34,209,195,0.14),transparent_55%)]">
        <div className="mx-auto max-w-5xl">
          <div className="text-center mb-12">
            <div className="text-xs font-bold tracking-widest text-primary mb-3">{t("stylesKicker")}</div>
            <h2 className="text-3xl sm:text-4xl font-bold mb-3">{t("stylesTitle")}</h2>
            <p className="text-text-muted max-w-lg mx-auto">{t("stylesSubtitle")}</p>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {PLAYSTYLE_CARDS.map((s) => (
              <div key={s.id} className="p-5 rounded-2xl border-2"
                style={{ background: `${s.color}14`, borderColor: `${s.color}66` }}>
                <div className="text-3xl mb-2">{s.icon}</div>
                <div className="text-lg font-black mb-0.5" style={{ color: s.color }}>{s.name}</div>
                <div className="text-[10px] uppercase tracking-widest text-text-muted mb-2">{s.motto}</div>
                <div className="text-xs text-text-muted leading-relaxed">{s.desc}</div>
              </div>
            ))}
          </div>
          <p className="text-center text-xs text-text-muted mt-8 italic">
            {t("stylesNote")}
          </p>
        </div>
      </section>

      {/* ── 3 Schritte ──────────────────────────────────── */}
      <section className="relative py-24 px-4 border-t border-border/50 bg-bg-card/40">
        <div className="mx-auto max-w-4xl">
          <h2 className="text-3xl sm:text-4xl font-bold text-center mb-14">{t("stepsTitle")}</h2>
          <div className="grid md:grid-cols-3 gap-8">
            {[
              { step: "01", title: t("step1Title"), desc: t("step1Desc") },
              { step: "02", title: t("step2Title"), desc: t("step2Desc") },
              { step: "03", title: t("step3Title"), desc: t("step3Desc") },
            ].map((item) => (
              <div key={item.step} className="text-center">
                <div className="text-5xl font-black text-primary/20 mb-4">{item.step}</div>
                <h3 className="text-lg font-semibold mb-2">{item.title}</h3>
                <p className="text-sm text-text-muted leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Final-CTA ───────────────────────────────────── */}
      <section className="relative py-24 px-4 border-t border-border/50 bg-[radial-gradient(ellipse_at_center,rgba(34,209,195,0.20),transparent_60%)]">
        <div className="mx-auto max-w-3xl text-center">
          <div className="p-10 sm:p-14 rounded-3xl bg-linear-to-br from-primary/10 via-bg-card to-accent/10 border border-primary/20">
            <Crown className="w-12 h-12 text-xp mx-auto mb-6" />
            <h2 className="text-3xl font-bold mb-4">{t("ctaTitle")}</h2>
            <p className="text-text-muted mb-8 max-w-md mx-auto">
              {t("ctaSubtitle")}
            </p>
            <InlineAuth />
          </div>
        </div>
      </section>

      {/* ── Footer ──────────────────────────────────────── */}
      <footer className="border-t border-border/50 py-12 px-4">
        <div className="mx-auto max-w-6xl">
          <div className="grid md:grid-cols-4 gap-8 mb-10">
            <div>
              <div className="flex items-center gap-2 mb-3">
                <Image src="/logo.png" alt="MyArea365" width={28} height={28} className="rounded-full" />
                <span className="font-bold">MyArea365</span>
              </div>
              <p className="text-xs text-text-muted leading-relaxed">
                {t("footerTagline")}
              </p>
            </div>
            <div>
              <div className="text-xs font-bold tracking-widest text-text-muted mb-3">{t("footerApp")}</div>
              <ul className="space-y-2 text-sm">
                <li><a href="#stadt" className="text-text-muted hover:text-text">{t("navCity")}</a></li>
                <li><a href="#crews" className="text-text-muted hover:text-text">{t("navCrews")}</a></li>
                <li><a href="#cvc" className="text-text-muted hover:text-text">{t("navCvc")}</a></li>
                <li><a href="#styles" className="text-text-muted hover:text-text">{t("navStyles")}</a></li>
                <li><Link href="/leaderboard" className="text-text-muted hover:text-text">{t("footerLinkLeaderboard")}</Link></li>
                <li><Link href="/blog" className="text-text-muted hover:text-text">Strategie-Blog</Link></li>
              </ul>
            </div>
            <div>
              <div className="text-xs font-bold tracking-widest text-text-muted mb-3">{t("footerLegal")}</div>
              <ul className="space-y-2 text-sm">
                <li><Link href="/agb" className="text-text-muted hover:text-text">{t("footerLinkAgb")}</Link></li>
                <li><Link href="/datenschutz" className="text-text-muted hover:text-text">{t("footerLinkPrivacy")}</Link></li>
                <li><Link href="/impressum" className="text-text-muted hover:text-text">{t("footerLinkImprint")}</Link></li>
                <li><Link href="/loot-drops" className="text-text-muted hover:text-text">{t("footerLinkDropRates")}</Link></li>
                <li><Link href="/pricing" className="text-text-muted hover:text-text">{t("footerLinkPricing")}</Link></li>
                <li>
                  <CookieSettingsButton
                    label={t("footerLinkCookieSettings")}
                    className="text-text-muted hover:text-text text-left"
                  />
                </li>
                <li>
                  <a href="https://ec.europa.eu/consumers/odr" target="_blank" rel="noopener noreferrer" className="text-text-muted hover:text-text">
                    {t("footerLinkOdr")}
                  </a>
                </li>
                <li><a href="mailto:support@myarea365.de" className="text-text-muted hover:text-text">{t("footerLinkSupport")}</a></li>
              </ul>
            </div>
          </div>
          <div className="border-t border-border/50 pt-6 text-center text-xs text-text-muted">
            {t("footerCopyright", { year: new Date().getFullYear() })}
          </div>
        </div>
      </footer>
    </>
  );
}

function FeatureMini({ icon, label, desc }: { icon: React.ReactNode; label: string; desc: string }) {
  return (
    <div className="p-3 rounded-xl bg-bg-card/60 border border-border text-center">
      <div className="text-primary mx-auto w-fit mb-1">{icon}</div>
      <div className="text-xs font-bold mb-0.5">{label}</div>
      <div className="text-[10px] text-text-muted leading-tight">{desc}</div>
    </div>
  );
}
