import Link from "next/link";
import Image from "next/image";
import {
  MapPin, Trophy, Users, Store, Shield, Footprints, Zap,
  Heart, Flame, Brain, Moon, Map, Sparkles, Target, Award,
} from "lucide-react";
import { InlineAuth } from "@/components/inline-auth";
import { HeroMap } from "@/components/hero-map-client";

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
          <div className="hidden sm:flex items-center gap-6 text-sm text-text-muted">
            <a href="#runner" className="hover:text-text transition-colors">Runner</a>
            <a href="#crews" className="hover:text-text transition-colors">Crews</a>
            <a href="#shops" className="hover:text-text transition-colors">Shops</a>
            <a href="#gesundheit" className="hover:text-text transition-colors">Gesundheit</a>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/login" className="text-sm text-text-muted hover:text-text transition-colors">Anmelden</Link>
            <a href="#start" className="text-sm px-4 py-2 rounded-lg bg-primary text-bg-deep font-semibold hover:bg-primary-dim transition-colors">Loslegen</a>
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
              Bewegung · Spaß · Echte Rabatte
            </div>
          </div>

          <h1 className="text-4xl sm:text-5xl font-bold tracking-tight leading-[1.1]">
            Erobere deine Stadt.
            <br />
            <span className="text-primary">Schritt für Schritt.</span>
          </h1>
        </div>

        <div className="flex-1" />

        <div id="start" className="relative z-10 text-center px-4 max-w-xl mx-auto pb-4">
          <p className="text-sm sm:text-base text-text-muted mb-5">
            Geh Straßen ab, jogge durch dein Viertel, erschließe ganze Straßenzüge.
            Sammle 🪙 Wegemünzen — löse sie bei lokalen Shops gegen echte Rabatte ein.
            Allein oder mit deiner Crew.
          </p>

          <InlineAuth />
        </div>

        <div className="relative z-10 mt-auto pb-10">
          <div className="flex justify-center gap-8">
            {[
              { value: "100%", label: "Kostenlos" },
              { value: "∞", label: "Straßen" },
              { value: "365", label: "Tage im Jahr" },
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
          <h2 className="text-3xl sm:text-4xl font-bold mb-3">Warum MyArea365?</h2>
          <p className="text-text-muted mb-12 max-w-lg mx-auto">Vier Dinge auf einmal. Nicht schlecht für einen Spaziergang.</p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { icon: "💪", label: "Gesundheit",   desc: "Messbar mehr Bewegung", color: "#4ade80" },
              { icon: "🎉", label: "Spaß",          desc: "Gamification statt Tracker-Stress", color: "#FF2D78" },
              { icon: "💸", label: "Spare Geld",    desc: "Echte Rabatte statt Punkte-Zirkus", color: "#FFD700" },
              { icon: "🏘️", label: "Lokal stärken", desc: "Dein Kiez bleibt lebendig", color: "#22D1C3" },
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
              <div className="text-xs font-bold tracking-widest text-primary mb-3">RUNNER</div>
              <h2 className="text-3xl sm:text-4xl font-bold mb-4 leading-tight">
                Deine Schritte sind <span className="text-primary">echte Währung</span>.
              </h2>
              <p className="text-text-muted leading-relaxed mb-6">
                Jede Straße die du abgehst wird auf der Karte in deiner Farbe eingefärbt.
                Sammle 🪙 Wegemünzen für jeden Kilometer, jede Straße, jeden Kiez-Check-in. Level up,
                Rangliste, Streaks — spielerisch in Bewegung bleiben.
              </p>
              <div className="grid grid-cols-3 gap-3">
                <FeatureMini icon={<MapPin className="w-5 h-5" />} label="Revier" desc="Straßen einnehmen" />
                <FeatureMini icon={<Trophy className="w-5 h-5" />} label="Level" desc="10 Ränge" />
                <FeatureMini icon={<Zap className="w-5 h-5" />} label="Streaks" desc="Tägl. Boni" />
              </div>
            </div>
            <div className="p-6 rounded-3xl bg-linear-to-br from-primary/10 via-bg-card to-accent/10 border border-primary/20">
              <div className="text-xs font-bold text-primary tracking-widest mb-4">🪙 WEGEMÜNZEN VERDIENEN</div>
              <div className="space-y-3">
                {[
                  { icon: "📏", label: "Pro km", xp: "+50 🪙" },
                  { icon: "🏃", label: "Pro Lauf", xp: "+100 🪙" },
                  { icon: "🗺️", label: "Neues Gebiet", xp: "+500 🪙" },
                  { icon: "🔥", label: "Streak-Tag", xp: "bis +1.000 🪙" },
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
            <div className="text-xs font-bold tracking-widest text-primary mb-3">GESUNDHEIT</div>
            <h2 className="text-3xl sm:text-4xl font-bold mb-4">Nicht nur Spaß — messbarer Effekt.</h2>
            <p className="text-text-muted max-w-xl mx-auto">
              Studien der WHO, Cochrane und des RKI belegen: regelmäßige Bewegung hat massive Wirkung.
            </p>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { icon: <Heart className="w-6 h-6" />, stat: "+42%", title: "Herz-Kreislauf",   desc: "Weniger Infarktrisiko", color: "#FF2D78" },
              { icon: <Brain className="w-6 h-6" />, stat: "+23%", title: "Mentale Stärke",   desc: "Gegen Stress + Angst",  color: "#22D1C3" },
              { icon: <Flame className="w-6 h-6" />, stat: "350",  title: "kcal / Stunde",    desc: "Entspannt nebenbei",    color: "#FF6B4A" },
              { icon: <Moon  className="w-6 h-6" />, stat: "+18%", title: "Schlafqualität",   desc: "Besserer Tiefschlaf",   color: "#a855f7" },
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
            Werte: Durchschnitte aus WHO/Cochrane/RKI-Studien
          </div>
        </div>
      </section>

      {/* ── Crews ─────────────────────────────────────────── */}
      <section id="crews" className="relative py-24 px-4 border-t border-border/50 bg-[radial-gradient(ellipse_at_top_right,rgba(168,85,247,0.18),transparent_55%),radial-gradient(ellipse_at_bottom_left,rgba(34,209,195,0.14),transparent_55%)]">
        <div className="mx-auto max-w-6xl">
          <div className="text-center mb-14">
            <div className="text-xs font-bold tracking-widest text-primary mb-3">CREWS</div>
            <h2 className="text-3xl sm:text-4xl font-bold mb-4 leading-tight">
              Allein läufst du schneller.<br />
              <span className="bg-linear-to-r from-primary to-accent bg-clip-text text-transparent">Zusammen</span> erobert ihr die Stadt.
            </h2>
            <p className="text-text-muted max-w-xl mx-auto">
              Gründe deine Crew mit Freunden, Familie, Klasse, Arbeitskollegen oder der
              Nachbarschaft. Gemeinsam Kilometer sammeln, Revier sichern, in Ligen aufsteigen.
            </p>
          </div>
          <div className="grid md:grid-cols-3 gap-5">
            {[
              { icon: "🗺️", title: "Revier dominieren",  desc: "Straßenzüge eurer Crew gehören — eure Farbe färbt den Kiez.", accent: "#22D1C3" },
              { icon: "🏆", title: "Liga aufsteigen",    desc: "Bronze → Silber → Gold → Diamant → Legende. Monatlich neu.", accent: "#FFD700" },
              { icon: "⚔️", title: "Rivalen schlagen",    desc: "1:1 Wochen-Duelle gegen Nachbar-Crews. Sieger kriegt 🏴 Gebietsruf-Boost.", accent: "#FF2D78" },
              { icon: "🔥", title: "Challenges",           desc: "Wöchentliche Team-Ziele: 150 km, 20 Gebiete, Früh-Vögel.", accent: "#FF6B4A" },
              { icon: "📅", title: "Events planen",        desc: "Treffpunkte, Gruppenläufe, gemeinsame Runden.", accent: "#a855f7" },
              { icon: "💬", title: "Chat & Feed",          desc: "Reaktionen, Voice-Notes, Meilensteine feiern.", accent: "#4ade80" },
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
              <span>🎉 Freundeskreis</span>
              <span>👨‍👩‍👧 Familie</span>
              <span>🎓 Schule/Uni</span>
              <span>💼 Arbeitskollegen</span>
              <span>🏃 Sportverein</span>
              <span>🏘️ Nachbarschaft</span>
              <span>🌐 Offene Community</span>
            </div>
          </div>
        </div>
      </section>

      {/* ── Shops ─────────────────────────────────────────── */}
      <section id="shops" className="relative py-24 px-4 border-t border-border/50 bg-bg-card/70 bg-[radial-gradient(ellipse_at_center,rgba(255,215,0,0.18),transparent_60%)]">
        <div className="mx-auto max-w-6xl">
          <div className="text-center mb-14">
            <div className="text-xs font-bold tracking-widest text-xp mb-3">SHOPS</div>
            <h2 className="text-3xl sm:text-4xl font-bold mb-4 leading-tight">
              🪙 Wegemünzen gegen <span className="text-xp">echte Rabatte</span>.
            </h2>
            <p className="text-text-muted max-w-xl mx-auto">
              Nicht noch eine App-Währung. Deine Wegemünzen werden zu Geld — in Cafés, Bäckereien,
              Sportläden, Fitness-Studios, Apotheken, Gastro. Immer vor Ort, nie online.
            </p>
          </div>
          <div className="grid md:grid-cols-2 gap-8 items-center">
            <div className="space-y-3">
              {[
                { icon: "☕", shop: "Café Liebling",     deal: "Gratis Cappuccino ab 3 km",  xp: "300 🪙" },
                { icon: "🛍️", shop: "Runners Point",     deal: "15% auf den Einkauf",       xp: "800 🪙" },
                { icon: "🥗", shop: "Bio-Bowl",          deal: "Gratis Smoothie zur Bowl",  xp: "400 🪙" },
                { icon: "🏋️", shop: "MyCityFit",         deal: "Kostenlose Probewoche",     xp: "1.500 🪙" },
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
                Beispiel-Deals. Echte Shops folgen beim Launch in deiner Stadt.
              </div>
            </div>
            <div className="space-y-4">
              {[
                { icon: <Target className="w-5 h-5 text-primary" />, title: "Nur vor Ort einlösbar", desc: "GPS + rotierender QR. Kein Online-Missbrauch, nur im Laden — unterstützt wirklich lokale Shops." },
                { icon: <Sparkles className="w-5 h-5 text-xp" />, title: "Faire Regeln", desc: "Jeder Deal zeigt offen: 1× / Woche, Monat oder unbegrenzt. Keine versteckten Klauseln." },
                { icon: <Shield className="w-5 h-5 text-energy" />, title: "Deine Daten bleiben bei dir", desc: "Shops sehen nur anonymen Check-in + km. Kein Profil-Tracking, keine Werbe-IDs." },
                { icon: <Award className="w-5 h-5 text-accent" />, title: "Keine App-Währung", desc: "Deine Wegemünzen bleiben Wegemünzen. Kein Ablaufdatum. Einlösen wann du willst." },
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
          <h2 className="text-3xl sm:text-4xl font-bold text-center mb-14">In 3 Schritten dabei</h2>
          <div className="grid md:grid-cols-3 gap-8">
            {[
              { step: "01", title: "Account in 30 Sek", desc: "Runner-Name, Fraktion wählen, los. Keine Kreditkarte, keine Vertragsbindung." },
              { step: "02", title: "Rausgehen & laufen", desc: "Karte öffnen, \"Eroberung starten\". Screen bleibt automatisch an — Handy kann in die Tasche." },
              { step: "03", title: "Wegemünzen & Rabatte kassieren", desc: "Straßen einnehmen, im Shop QR scannen, Deal abholen." },
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
          <div className="text-xs font-bold tracking-widest text-primary mb-3">FRAKTIONEN</div>
          <h2 className="text-3xl sm:text-4xl font-bold mb-3">Zwei Teams. Ein Planet.</h2>
          <p className="text-text-muted mb-10 max-w-lg mx-auto">
            Bei Registrierung wählst du deine Fraktion — sie bleibt für immer. Eure km zählen gegen die andere Fraktion, weltweit, in jedem Land, jeder Stadt, jeder PLZ.
          </p>
          <div className="grid sm:grid-cols-2 gap-4">
            {[
              { id: "nachtpuls",   icon: "🌙", color: "#22D1C3", name: "Nachtpuls",   motto: "Strategie · Rhythmus · Stille Siege" },
              { id: "sonnenwacht", icon: "☀️", color: "#FF6B4A", name: "Sonnenwacht", motto: "Mut · Tempo · Offene Wege" },
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
            <h2 className="text-3xl font-bold mb-4">Bereit, deine Stadt zu erobern?</h2>
            <p className="text-text-muted mb-8 max-w-md mx-auto">
              Kostenlos. Keine Kreditkarte. Einfach loslaufen.
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
                Gamifizierte Lauf-Community. Bewegung, Spaß und lokale Rabatte.
              </p>
            </div>
            <div>
              <div className="text-xs font-bold tracking-widest text-text-muted mb-3">APP</div>
              <ul className="space-y-2 text-sm">
                <li><a href="#runner" className="text-text-muted hover:text-text">Für Runner</a></li>
                <li><a href="#crews" className="text-text-muted hover:text-text">Crews</a></li>
                <li><a href="#shops" className="text-text-muted hover:text-text">Shops</a></li>
                <li><a href="#gesundheit" className="text-text-muted hover:text-text">Gesundheit</a></li>
                <li><Link href="/leaderboard" className="text-text-muted hover:text-text">🏆 Leaderboard</Link></li>
              </ul>
            </div>
            <div>
              <div className="text-xs font-bold tracking-widest text-text-muted mb-3">FÜR GESCHÄFTE</div>
              <ul className="space-y-2 text-sm">
                <li><Link href="/shop-dashboard/" className="text-text-muted hover:text-text">Demo-Dashboard</Link></li>
                <li><a href="mailto:partner@myarea365.de" className="text-text-muted hover:text-text">Shop anmelden</a></li>
                <li><a href="mailto:partner@myarea365.de" className="text-text-muted hover:text-text">Demo buchen</a></li>
              </ul>
            </div>
            <div>
              <div className="text-xs font-bold tracking-widest text-text-muted mb-3">RECHTLICHES</div>
              <ul className="space-y-2 text-sm">
                <li><Link href="/agb" className="text-text-muted hover:text-text">AGB</Link></li>
                <li><Link href="/datenschutz" className="text-text-muted hover:text-text">Datenschutz</Link></li>
                <li><Link href="/impressum" className="text-text-muted hover:text-text">Impressum</Link></li>
                <li><Link href="/loot-drops" className="text-text-muted hover:text-text">Drop-Raten</Link></li>
                <li><a href="mailto:support@myarea365.de" className="text-text-muted hover:text-text">Support</a></li>
              </ul>
            </div>
          </div>
          <div className="border-t border-border/50 pt-6 text-center text-xs text-text-muted">
            © {new Date().getFullYear()} MyArea365 · Made with ❤️ in Berlin
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
