import Link from "next/link";
import Image from "next/image";
import { PLANS, PLUS_FEATURES, CREW_PRO_FEATURES, BOOST_PACKS, EXTRAS, formatPrice } from "@/lib/monetization";

export const metadata = {
  title: "Preise · MyArea365",
  description: "MyArea+ und Crew-Pro Abos, Wegemünzen-Boost-Packs und einmalige Extras.",
};

export default function PricingPage() {
  return (
    <main className="min-h-screen px-4 py-12">
      <div className="max-w-5xl mx-auto">
        <div className="text-center mb-10">
          <Image src="/logo.png" alt="MyArea365" width={48} height={48} className="mx-auto mb-3 rounded-full" />
          <Link href="/" className="text-xs text-text-muted hover:text-white">← Startseite</Link>
          <h1 className="text-3xl sm:text-4xl font-black text-white mt-3">Preise & Pakete</h1>
          <p className="text-text-muted mt-2 max-w-xl mx-auto">
            Kostenlos starten — später upgraden für mehr Features, Werbefreiheit und coole Extras.
          </p>
        </div>

        {/* Haupt-Tiers */}
        <div className="grid md:grid-cols-3 gap-5 mb-12">
          {/* Free */}
          <div className="bg-bg-card border border-border rounded-2xl p-6 flex flex-col">
            <div className="text-xs font-bold tracking-widest text-text-muted mb-2">KOSTENLOS</div>
            <div className="text-3xl font-black mb-1">€ 0</div>
            <div className="text-xs text-text-muted mb-5">für immer</div>
            <ul className="space-y-2 text-sm flex-1">
              <Feat>Alle Grundfunktionen</Feat>
              <Feat>Bis 50 Crew-Mitglieder</Feat>
              <Feat>Leaderboards & Achievements</Feat>
              <Feat>Banner-Werbung</Feat>
              <Feat>Rewarded Ads für Bonus-XP</Feat>
            </ul>
            <Link href="/#start" className="mt-6 text-center py-2.5 rounded-lg bg-white/10 text-white hover:bg-white/15 text-sm font-bold">
              Kostenlos starten
            </Link>
          </div>

          {/* MyArea+ */}
          <div className="rounded-2xl p-6 flex flex-col relative" style={{
            background: "linear-gradient(135deg, rgba(34,209,195,0.15), rgba(255,45,120,0.15))",
            border: "2px solid #22D1C3",
            boxShadow: "0 0 30px rgba(34,209,195,0.25)",
          }}>
            <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full text-[10px] font-black" style={{ background: "#22D1C3", color: "#0F1115" }}>
              BELIEBT
            </div>
            <div className="text-xs font-bold tracking-widest text-primary mb-2">MYAREA+</div>
            <div className="text-3xl font-black mb-1">{formatPrice(PLANS.plus_monthly.price)}<span className="text-sm text-text-muted font-normal"> / Monat</span></div>
            <div className="text-xs text-text-muted mb-5">oder {formatPrice(PLANS.plus_yearly.price)} / Jahr (40% sparen)</div>
            <ul className="space-y-2 text-sm flex-1">
              {PLUS_FEATURES.slice(0, 7).map((f) => (
                <Feat key={f.title}><b>{f.title}</b> — <span className="text-text-muted">{f.desc}</span></Feat>
              ))}
              <li className="text-xs text-text-muted pl-6">+ {PLUS_FEATURES.length - 7} weitere Features</li>
            </ul>
            <Link href="/dashboard/?upgrade=plus" className="mt-6 text-center py-2.5 rounded-lg bg-primary text-bg-deep hover:bg-primary-dim text-sm font-bold">
              MyArea+ testen
            </Link>
          </div>

          {/* Crew-Pro */}
          <div className="bg-bg-card border border-border rounded-2xl p-6 flex flex-col">
            <div className="text-xs font-bold tracking-widest text-text-muted mb-2">CREW-PRO</div>
            <div className="text-3xl font-black mb-1">{formatPrice(PLANS.crew_pro_monthly.price)}<span className="text-sm text-text-muted font-normal"> / Monat</span></div>
            <div className="text-xs text-text-muted mb-5">oder {formatPrice(PLANS.crew_pro_yearly.price)} / Jahr · pro Crew</div>
            <ul className="space-y-2 text-sm flex-1">
              {CREW_PRO_FEATURES.map((f) => (
                <Feat key={f.title}><b>{f.title}</b> — <span className="text-text-muted">{f.desc}</span></Feat>
              ))}
            </ul>
            <Link href="/dashboard/?upgrade=crew" className="mt-6 text-center py-2.5 rounded-lg bg-accent text-white hover:bg-accent-dim text-sm font-bold">
              Crew-Pro buchen
            </Link>
          </div>
        </div>

        {/* Wegemünzen-Boost-Packs */}
        <h2 className="text-2xl font-black text-white mb-3">⚡ Wegemünzen-Boost-Packs</h2>
        <p className="text-text-muted text-sm mb-5">Einmalige Käufe ohne Abo. Ideal für Events oder intensive Trainings-Wochen.</p>
        <div className="grid sm:grid-cols-2 md:grid-cols-4 gap-3 mb-12">
          {Object.values(BOOST_PACKS).map((p) => (
            <div key={p.sku} className="bg-bg-card border border-border rounded-xl p-4 text-center">
              <div className="text-3xl mb-2">⚡</div>
              <div className="text-xs text-text-muted mb-1">{p.multiplier}× 🪙 · {p.hours} h</div>
              <div className="text-base font-bold text-white mb-2">{p.name}</div>
              <div className="text-2xl font-black text-xp mb-3">{formatPrice(p.price)}</div>
              <Link href={`/dashboard/?buy=${p.sku}`} className="block py-2 rounded-lg bg-xp/20 text-xp hover:bg-xp/30 text-xs font-bold">
                Kaufen
              </Link>
            </div>
          ))}
        </div>

        {/* Extras */}
        <h2 className="text-2xl font-black text-white mb-3">🎁 Einmalige Extras</h2>
        <div className="grid sm:grid-cols-2 md:grid-cols-5 gap-3 mb-12">
          {Object.values(EXTRAS).map((e) => (
            <div key={e.sku} className="bg-bg-card border border-border rounded-xl p-4 text-center">
              <div className="text-base font-bold text-white mb-2">{e.name}</div>
              <div className="text-lg font-black text-primary mb-3">{formatPrice(e.price)}</div>
              <Link href={`/dashboard/?buy=${e.sku}`} className="block py-1.5 rounded-lg bg-white/5 text-white hover:bg-white/10 text-xs font-bold">
                Kaufen
              </Link>
            </div>
          ))}
        </div>

        <div className="text-center text-xs text-text-muted">
          Alle Preise inkl. MwSt. · Abos jederzeit kündbar · <a href="mailto:support@myarea365.de" className="text-primary hover:underline">Fragen?</a>
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
