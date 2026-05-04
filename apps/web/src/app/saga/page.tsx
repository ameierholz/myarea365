import Link from "next/link";
import Image from "next/image";
import { SagaClient } from "./saga-client";

export const revalidate = 30;

export const metadata = {
  title: "Metropol-Saga · MyArea365",
  description: "Stadt-vs-Stadt Saison: Wähle deine Stadt, laufe für sie und kämpft um den Saga-Sieg. 23 Tage. Bewegung als Beitrag. Sieger-Stadt erhält 30 Tage Stadt-Bonus.",
  alternates: { canonical: "https://myarea365.de/saga" },
};

export default function SagaPage() {
  return (
    <main className="min-h-screen px-4 py-10">
      <div className="max-w-5xl mx-auto">
        <div className="text-center mb-8">
          <Image src="/logo.png" alt="MyArea365" width={44} height={44} className="mx-auto mb-2 rounded-full" />
          <Link href="/" className="text-xs text-text-muted hover:text-white">← MyArea365.de</Link>
          <h1 className="text-3xl sm:text-4xl font-black text-white mt-2">🏙️ Metropol-Saga</h1>
          <p className="text-text-muted mt-1 text-sm max-w-xl mx-auto">
            Stadt gegen Stadt. 23 Tage. Jeder Schritt zählt für deine Heimat — die Sieger-Stadt holt Diamanten,
            Universal-Siegel und einen 30-Tage Stadt-Bonus.
          </p>
        </div>

        <SagaClient />

        <div className="mt-10 grid sm:grid-cols-3 gap-3 text-xs text-text-muted">
          <InfoCard icon="🎽" title="Auftakt (7 Tage)" body="Erkundung · Versorgung · Konditions-Drill. Sieger-Stadt startet mit Heimvorteil (+15%) in die Hauptphase." />
          <InfoCard icon="🏃" title="Etappen-Wochen (14 Tage)" body="Kollektive Distanz erreicht 4 Etappen Richtung Wahrzeichen. Erste Stadt am Ziel gewinnt die Saga." />
          <InfoCard icon="🏆" title="Belohnungen" body="Sieger-Stadt: Diamanten + Siegel + 30 Tage Stadt-Bonus. Top-Beitragende: Saga-Plakette für ihr Profil." />
        </div>

        <div className="mt-10 text-center">
          <Link href="/leaderboard" className="inline-block px-6 py-3 rounded-lg bg-primary text-bg-deep font-bold hover:bg-primary-dim">
            🏆 Alle Rankings ansehen →
          </Link>
        </div>
      </div>
    </main>
  );
}

function InfoCard({ icon, title, body }: { icon: string; title: string; body: string }) {
  return (
    <div className="bg-white/[0.03] border border-white/10 rounded-xl p-4">
      <div className="text-2xl mb-1">{icon}</div>
      <div className="text-white font-bold text-sm mb-1">{title}</div>
      <div>{body}</div>
    </div>
  );
}
