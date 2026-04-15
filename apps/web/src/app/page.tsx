import Link from "next/link";
import Image from "next/image";
import {
  MapPin,
  Trophy,
  Users,
  Store,
  TrendingUp,
  Shield,
  Footprints,
  Zap,
} from "lucide-react";
import { HeroMap } from "@/components/hero-map";
import { InlineAuth } from "@/components/inline-auth";

const FEATURES = [
  {
    icon: MapPin,
    title: "Gebiete erobern",
    desc: "Geh Straßenzüge ab und markiere sie auf deiner Karte. Jeder Schritt zählt.",
    color: "text-primary",
    bg: "bg-primary/10",
  },
  {
    icon: Trophy,
    title: "XP & Level",
    desc: "Sammle Erfahrungspunkte, steige im Level auf und schalte Achievements frei.",
    color: "text-xp",
    bg: "bg-xp/10",
  },
  {
    icon: Users,
    title: "Teams & Gruppen",
    desc: "Gründe ein Team, erobert gemeinsam Gebiete und dominiert das Leaderboard.",
    color: "text-energy",
    bg: "bg-energy/10",
  },
  {
    icon: Store,
    title: "Lokale Geschäfte",
    desc: "Entdecke Geschäfte in deiner Nähe und erhalte Rabatte durch QR-Code Scans.",
    color: "text-accent",
    bg: "bg-accent/10",
  },
  {
    icon: Zap,
    title: "Streaks & Boni",
    desc: "Halte deine tägliche Serie aufrecht und kassiere Streak-Boni auf deine XP.",
    color: "text-pin",
    bg: "bg-pin/10",
  },
  {
    icon: TrendingUp,
    title: "Leaderboards",
    desc: "Miss dich mit anderen – in deiner Stadt, deiner Gruppe oder weltweit.",
    color: "text-primary",
    bg: "bg-primary/10",
  },
];

const STATS = [
  { value: "100%", label: "Kostenlos" },
  { value: "∞", label: "Straßen zu erobern" },
  { value: "365", label: "Tage im Jahr" },
];

export default function LandingPage() {
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
          <div className="flex items-center gap-3">
            <a
              href="#start"
              className="text-sm text-text-muted hover:text-text transition-colors"
            >
              Anmelden
            </a>
            <a
              href="#start"
              className="text-sm px-4 py-2 rounded-lg bg-primary text-bg font-semibold hover:bg-primary-dim transition-colors"
            >
              Loslegen
            </a>
          </div>
        </div>
      </nav>

      {/* ── Hero ────────────────────────────────────────── */}
      <section className="relative min-h-screen flex flex-col pt-16 overflow-hidden">
        {/* Live Map Background */}
        <HeroMap />

        {/* Top: Headline only */}
        <div className="relative z-10 text-center px-4 max-w-3xl mx-auto pt-4 sm:pt-6">
          <div className="flex items-center justify-center gap-4 mb-4">
            <Image
              src="/logo.png"
              alt="MyArea365 Logo"
              width={72}
              height={72}
              className="drop-shadow-[0_0_20px_rgba(34,209,195,0.3)]"
            />
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-primary/20 bg-primary/5 text-primary text-sm font-semibold">
              <Footprints className="w-4 h-4" />
              Mit Bewegung und Spaß zu Rabatten in deiner Umgebung
            </div>
          </div>

          <h1 className="text-4xl sm:text-5xl font-bold tracking-tight leading-[1.1]">
            Erobere deine Stadt.
            <br />
            <span className="text-primary">Schritt für Schritt.</span>
          </h1>
        </div>

        {/* Middle: space for map + marker */}
        <div className="flex-1" />

        {/* Bottom: description + inline auth */}
        <div id="start" className="relative z-10 text-center px-4 max-w-xl mx-auto pb-4">
          <p className="text-sm sm:text-base text-text-muted mb-5">
            Geh Straßen ab, jogge durch dein Viertel und erschließe ganze
            Straßenzüge. Je mehr du erkundest, desto mehr XP sammelst du –
            löse sie bei lokalen Geschäften gegen echte Rabatte ein.
          </p>

          <InlineAuth />
        </div>

        {/* Stats bar at bottom */}
        <div className="relative z-10 mt-auto pb-10">
          <div className="flex justify-center gap-8">
            {STATS.map((s) => (
              <div key={s.label} className="text-center">
                <div className="text-2xl font-bold text-primary">{s.value}</div>
                <div className="text-xs text-text-muted mt-1">{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Features ────────────────────────────────────── */}
      <section id="features" className="py-24 px-4">
        <div className="mx-auto max-w-6xl">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold mb-4">
              So funktioniert&apos;s
            </h2>
            <p className="text-text-muted max-w-lg mx-auto">
              MyArea365 macht Bewegung zum Spiel. Jeder Spaziergang, jeder Lauf
              bringt dich weiter.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {FEATURES.map((f) => (
              <div
                key={f.title}
                className="group p-6 rounded-2xl bg-bg-card border border-border hover:border-primary/30 transition-all duration-300"
              >
                <div className={`w-12 h-12 rounded-xl ${f.bg} flex items-center justify-center mb-4 transition-colors`}>
                  <f.icon className={`w-6 h-6 ${f.color}`} />
                </div>
                <h3 className="text-lg font-semibold mb-2">{f.title}</h3>
                <p className="text-sm text-text-muted leading-relaxed">
                  {f.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── How it works ────────────────────────────────── */}
      <section className="py-24 px-4 border-t border-border/50">
        <div className="mx-auto max-w-4xl">
          <h2 className="text-3xl sm:text-4xl font-bold text-center mb-16">
            In 3 Schritten dabei
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              {
                step: "01",
                title: "Account erstellen",
                desc: "Registriere dich kostenlos und wähle deinen Runner-Namen.",
              },
              {
                step: "02",
                title: "Rausgehen & laufen",
                desc: "Öffne die Karte und lauf los. Jede Straße die du gehst wird erobert.",
              },
              {
                step: "03",
                title: "XP kassieren",
                desc: "Sammle Punkte, steige auf, schalte Belohnungen frei und entdecke deine Stadt.",
              },
            ].map((item) => (
              <div key={item.step} className="text-center">
                <div className="text-5xl font-black text-primary/20 mb-4">
                  {item.step}
                </div>
                <h3 className="text-lg font-semibold mb-2">{item.title}</h3>
                <p className="text-sm text-text-muted">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA ─────────────────────────────────────────── */}
      <section className="py-24 px-4">
        <div className="mx-auto max-w-3xl text-center">
          <div className="p-12 rounded-3xl bg-gradient-to-br from-primary/10 via-bg-card to-accent/10 border border-primary/20">
            <Shield className="w-12 h-12 text-primary mx-auto mb-6" />
            <h2 className="text-3xl font-bold mb-4">
              Bereit, deine Stadt zu erobern?
            </h2>
            <p className="text-text-muted mb-8 max-w-md mx-auto">
              Kostenlos starten. Keine Kreditkarte nötig. Einfach loslaufen.
            </p>
            <InlineAuth />
          </div>
        </div>
      </section>

      {/* ── Footer ──────────────────────────────────────── */}
      <footer className="border-t border-border/50 py-12 px-4">
        <div className="mx-auto max-w-6xl flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="text-sm text-text-muted">
            &copy; {new Date().getFullYear()} MyArea365. Alle Rechte vorbehalten.
          </div>
          <div className="flex gap-6 text-sm text-text-muted">
            <Link href="/datenschutz" className="hover:text-text transition-colors">
              Datenschutz
            </Link>
            <Link href="/impressum" className="hover:text-text transition-colors">
              Impressum
            </Link>
          </div>
        </div>
      </footer>
    </>
  );
}
