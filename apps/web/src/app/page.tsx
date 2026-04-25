import Link from "next/link";
import Image from "next/image";
import { getTranslations } from "next-intl/server";
import {
  MapPin, Trophy, Users, Store, Shield, Footprints, Zap,
  Heart, Flame, Brain, Moon, Map, Sparkles, Target, Award,
} from "lucide-react";
import { InlineAuth } from "@/components/inline-auth";
import { HeroMap } from "@/components/hero-map-client";

export default async function LandingPage() {
  const t = await getTranslations("Landing");
  void Users; void Store;
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
            <a href="#runner" className="hover:text-text transition-colors">{t("navRunner")}</a>
            <a href="#crews" className="hover:text-text transition-colors">{t("navCrews")}</a>
            <a href="#shops" className="hover:text-text transition-colors">{t("navShops")}</a>
            <a href="#gesundheit" className="hover:text-text transition-colors">{t("navHealth")}</a>
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
              <Footprints className="w-4 h-4" />
              {t("heroBadge")}
            </div>
          </div>

          <h1 className="text-4xl sm:text-5xl font-bold tracking-tight leading-[1.1]">
            {t("heroTitle1")}
            <br />
            <span className="text-primary">{t("heroTitle2")}</span>
          </h1>
        </div>

        <div className="flex-1" />

        <div id="start" className="relative z-10 text-center px-4 max-w-xl mx-auto pb-4">
          <p className="text-sm sm:text-base text-text-muted mb-5">
            {t("heroSubtitle")}
          </p>

          <InlineAuth />
        </div>

        <div className="relative z-10 mt-auto pb-10">
          <div className="flex justify-center gap-8">
            {[
              { value: "100%", label: t("statFree") },
              { value: "∞",    label: t("statStreets") },
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
              { icon: "💪", label: t("pillarHealth"), desc: t("pillarHealthDesc"), color: "#4ade80" },
              { icon: "🎉", label: t("pillarFun"),    desc: t("pillarFunDesc"),    color: "#FF2D78" },
              { icon: "💸", label: t("pillarSave"),   desc: t("pillarSaveDesc"),   color: "#FFD700" },
              { icon: "🏘️", label: t("pillarLocal"),  desc: t("pillarLocalDesc"),  color: "#22D1C3" },
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

      {/* ── Runner-Section ────────────────────────────────── */}
      <section id="runner" className="relative py-24 px-4 border-t border-border/50 bg-[radial-gradient(ellipse_at_left,rgba(34,209,195,0.14),transparent_55%),radial-gradient(ellipse_at_right,rgba(255,215,0,0.12),transparent_55%)]">
        <div className="mx-auto max-w-6xl">
          <div className="grid md:grid-cols-2 gap-12 items-center mb-16">
            <div>
              <div className="text-xs font-bold tracking-widest text-primary mb-3">{t("runnerKicker")}</div>
              <h2 className="text-3xl sm:text-4xl font-bold mb-4 leading-tight">
                {t("runnerTitle1")} <span className="text-primary">{t("runnerTitle2")}</span>{t("runnerTitleDot")}
              </h2>
              <p className="text-text-muted leading-relaxed mb-6">
                {t("runnerDesc")}
              </p>
              <div className="grid grid-cols-3 gap-3">
                <FeatureMini icon={<MapPin className="w-5 h-5" />} label={t("miniTerritory")} desc={t("miniTerritoryDesc")} />
                <FeatureMini icon={<Trophy className="w-5 h-5" />} label={t("miniLevel")} desc={t("miniLevelDesc")} />
                <FeatureMini icon={<Zap className="w-5 h-5" />} label={t("miniStreaks")} desc={t("miniStreaksDesc")} />
              </div>
            </div>
            <div className="p-6 rounded-3xl bg-linear-to-br from-primary/10 via-bg-card to-accent/10 border border-primary/20">
              <div className="text-xs font-bold text-primary tracking-widest mb-4">{t("earnHeader")}</div>
              <div className="space-y-3">
                {[
                  { icon: "📏", label: t("earnPerKm"),     xp: "+50 🪙" },
                  { icon: "🏃", label: t("earnPerRun"),    xp: "+100 🪙" },
                  { icon: "🗺️", label: t("earnNewArea"),   xp: "+500 🪙" },
                  { icon: "🔥", label: t("earnStreakDay"), xp: t("earnStreakDayValue") },
                ].map((x) => (
                  <div key={x.label} className="flex items-center gap-3 p-2.5 rounded-lg bg-black/20">
                    <div className="text-xl">{x.icon}</div>
                    <div className="flex-1 text-sm text-text">{x.label}</div>
                    <div className="text-sm font-bold text-xp">{x.xp}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Gesundheit ───────────────────────────────────── */}
      <section id="gesundheit" className="relative py-24 px-4 border-t border-border/50 bg-bg-card/70 bg-[radial-gradient(ellipse_at_center,rgba(74,222,128,0.20),transparent_60%)]">
        <div className="mx-auto max-w-6xl">
          <div className="text-center mb-14">
            <div className="text-xs font-bold tracking-widest text-primary mb-3">{t("healthKicker")}</div>
            <h2 className="text-3xl sm:text-4xl font-bold mb-4">{t("healthTitle")}</h2>
            <p className="text-text-muted max-w-xl mx-auto">
              {t("healthSubtitle")}
            </p>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { icon: <Heart className="w-6 h-6" />, stat: "+42%", title: t("healthHeart"),  desc: t("healthHeartDesc"),  color: "#FF2D78" },
              { icon: <Brain className="w-6 h-6" />, stat: "+23%", title: t("healthMental"), desc: t("healthMentalDesc"), color: "#22D1C3" },
              { icon: <Flame className="w-6 h-6" />, stat: "350",  title: t("healthCal"),    desc: t("healthCalDesc"),    color: "#FF6B4A" },
              { icon: <Moon  className="w-6 h-6" />, stat: "+18%", title: t("healthSleep"),  desc: t("healthSleepDesc"),  color: "#a855f7" },
            ].map((h) => (
              <div key={h.title} className="p-5 rounded-2xl bg-bg-card border" style={{ borderColor: `${h.color}44` }}>
                <div className="mb-3" style={{ color: h.color }}>{h.icon}</div>
                <div className="text-2xl font-black mb-1" style={{ color: h.color }}>{h.stat}</div>
                <div className="font-semibold text-sm mb-1">{h.title}</div>
                <div className="text-xs text-text-muted">{h.desc}</div>
              </div>
            ))}
          </div>
          <div className="mt-6 text-center text-xs text-text-muted italic">
            {t("healthSource")}
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
              { icon: "🗺️", title: t("crewTerritory"),   desc: t("crewTerritoryDesc"),   accent: "#22D1C3" },
              { icon: "🏆", title: t("crewLeague"),      desc: t("crewLeagueDesc"),      accent: "#FFD700" },
              { icon: "⚔️", title: t("crewRivals"),      desc: t("crewRivalsDesc"),      accent: "#FF2D78" },
              { icon: "🔥", title: t("crewChallenges"),  desc: t("crewChallengesDesc"),  accent: "#FF6B4A" },
              { icon: "📅", title: t("crewEvents"),      desc: t("crewEventsDesc"),      accent: "#a855f7" },
              { icon: "💬", title: t("crewChat"),        desc: t("crewChatDesc"),        accent: "#4ade80" },
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
              <span>{t("crewChip6")}</span>
              <span>{t("crewChip7")}</span>
            </div>
          </div>
        </div>
      </section>

      {/* ── Shops ─────────────────────────────────────────── */}
      <section id="shops" className="relative py-24 px-4 border-t border-border/50 bg-bg-card/70 bg-[radial-gradient(ellipse_at_center,rgba(255,215,0,0.18),transparent_60%)]">
        <div className="mx-auto max-w-6xl">
          <div className="text-center mb-14">
            <div className="text-xs font-bold tracking-widest text-xp mb-3">{t("shopsKicker")}</div>
            <h2 className="text-3xl sm:text-4xl font-bold mb-4 leading-tight">
              {t("shopsTitle1")} <span className="text-xp">{t("shopsTitleAccent")}</span>{t("shopsTitle2")}
            </h2>
            <p className="text-text-muted max-w-xl mx-auto">
              {t("shopsSubtitle")}
            </p>
          </div>
          <div className="grid md:grid-cols-2 gap-8 items-center">
            <div className="space-y-3">
              {[
                { icon: "☕", shop: t("shopExample1"), deal: t("shopExample1Deal"), xp: "300 🪙" },
                { icon: "🛍️", shop: t("shopExample2"), deal: t("shopExample2Deal"), xp: "800 🪙" },
                { icon: "🥗", shop: t("shopExample3"), deal: t("shopExample3Deal"), xp: "400 🪙" },
                { icon: "🏋️", shop: t("shopExample4"), deal: t("shopExample4Deal"), xp: "1.500 🪙" },
              ].map((d) => (
                <div key={d.shop} className="flex items-center gap-3 p-3 rounded-xl bg-bg-card border border-border">
                  <div className="w-10 h-10 rounded-lg bg-primary/20 border border-primary/40 flex items-center justify-center text-xl">{d.icon}</div>
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-sm">{d.shop}</div>
                    <div className="text-xs text-text-muted">{d.deal}</div>
                  </div>
                  <div className="text-xs font-bold px-2 py-1 rounded-md text-xp bg-xp/10 border border-xp/40">{d.xp}</div>
                </div>
              ))}
              <div className="text-xs text-text-muted text-center italic mt-3">
                {t("shopExamplesNote")}
              </div>
            </div>
            <div className="space-y-4">
              {[
                { icon: <Target className="w-5 h-5 text-primary" />, title: t("shopFeatureLocalTitle"),    desc: t("shopFeatureLocalDesc") },
                { icon: <Sparkles className="w-5 h-5 text-xp" />,    title: t("shopFeatureFairTitle"),     desc: t("shopFeatureFairDesc") },
                { icon: <Shield className="w-5 h-5 text-energy" />,  title: t("shopFeatureDataTitle"),     desc: t("shopFeatureDataDesc") },
                { icon: <Award className="w-5 h-5 text-accent" />,   title: t("shopFeatureNoCurrencyTitle"), desc: t("shopFeatureNoCurrencyDesc") },
              ].map((f) => (
                <div key={f.title} className="flex gap-3 p-4 rounded-xl bg-bg-card border border-border">
                  <div>{f.icon}</div>
                  <div>
                    <div className="font-semibold text-sm mb-0.5">{f.title}</div>
                    <div className="text-xs text-text-muted leading-relaxed">{f.desc}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── 3 Schritte ──────────────────────────────────── */}
      <section className="relative py-24 px-4 border-t border-border/50 bg-[radial-gradient(ellipse_at_top,rgba(34,209,195,0.14),transparent_55%)]">
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

      {/* ── Fraktionen ────────────────────────────────────── */}
      <section className="relative py-24 px-4 border-t border-border/50 bg-bg-card/70 bg-[radial-gradient(ellipse_at_left,rgba(34,209,195,0.20),transparent_50%),radial-gradient(ellipse_at_right,rgba(255,107,74,0.20),transparent_50%)]">
        <div className="mx-auto max-w-4xl text-center">
          <div className="text-xs font-bold tracking-widest text-primary mb-3">{t("factionsKicker")}</div>
          <h2 className="text-3xl sm:text-4xl font-bold mb-3">{t("factionsTitle")}</h2>
          <p className="text-text-muted mb-10 max-w-lg mx-auto">
            {t("factionsSubtitle")}
          </p>
          <div className="grid sm:grid-cols-2 gap-4">
            {[
              { id: "kronenwacht", icon: "👑", color: "#FFD700", name: t("factionKronenwacht"), motto: t("factionKronenwachtMotto") },
              { id: "gossenbund",  icon: "🗝️", color: "#22D1C3", name: t("factionGossenbund"),  motto: t("factionGossenbundMotto") },
            ].map((f) => (
              <div key={f.id} className="p-6 rounded-2xl border-2"
                style={{ background: `${f.color}14`, borderColor: f.color }}>
                <div className="text-4xl mb-3">{f.icon}</div>
                <div className="text-2xl font-black mb-1" style={{ color: f.color }}>{f.name}</div>
                <div className="text-sm text-text-muted">{f.motto}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Final-CTA ───────────────────────────────────── */}
      <section className="relative py-24 px-4 border-t border-border/50 bg-[radial-gradient(ellipse_at_center,rgba(34,209,195,0.20),transparent_60%)]">
        <div className="mx-auto max-w-3xl text-center">
          <div className="p-10 sm:p-14 rounded-3xl bg-linear-to-br from-primary/10 via-bg-card to-accent/10 border border-primary/20">
            <Map className="w-12 h-12 text-primary mx-auto mb-6" />
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
                <li><a href="#runner" className="text-text-muted hover:text-text">{t("footerLinkRunner")}</a></li>
                <li><a href="#crews" className="text-text-muted hover:text-text">{t("navCrews")}</a></li>
                <li><a href="#shops" className="text-text-muted hover:text-text">{t("navShops")}</a></li>
                <li><a href="#gesundheit" className="text-text-muted hover:text-text">{t("navHealth")}</a></li>
                <li><Link href="/leaderboard" className="text-text-muted hover:text-text">{t("footerLinkLeaderboard")}</Link></li>
              </ul>
            </div>
            <div>
              <div className="text-xs font-bold tracking-widest text-text-muted mb-3">{t("footerBusiness")}</div>
              <ul className="space-y-2 text-sm">
                <li><Link href="/shop-dashboard/" className="text-text-muted hover:text-text">{t("footerLinkDemo")}</Link></li>
                <li><a href="mailto:partner@myarea365.de" className="text-text-muted hover:text-text">{t("footerLinkSignup")}</a></li>
                <li><a href="mailto:partner@myarea365.de" className="text-text-muted hover:text-text">{t("footerLinkBookDemo")}</a></li>
              </ul>
            </div>
            <div>
              <div className="text-xs font-bold tracking-widest text-text-muted mb-3">{t("footerLegal")}</div>
              <ul className="space-y-2 text-sm">
                <li><Link href="/agb" className="text-text-muted hover:text-text">{t("footerLinkAgb")}</Link></li>
                <li><Link href="/datenschutz" className="text-text-muted hover:text-text">{t("footerLinkPrivacy")}</Link></li>
                <li><Link href="/impressum" className="text-text-muted hover:text-text">{t("footerLinkImprint")}</Link></li>
                <li><Link href="/loot-drops" className="text-text-muted hover:text-text">{t("footerLinkDropRates")}</Link></li>
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
