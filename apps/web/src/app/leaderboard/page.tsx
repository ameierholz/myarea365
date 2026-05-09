import Link from "next/link";
import Image from "next/image";
import { LeaderboardTabs } from "./leaderboard-tabs";

export const revalidate = 60;

export const metadata = {
  title: "Rankings · MyArea365",
  description: "Die aktivsten Runner, stärksten Wächter, mächtigsten Crews und Fraktionen Deutschlands.",
  alternates: { canonical: "https://myarea365.de/leaderboard" },
};

export default function LeaderboardPage() {
  return (
    <main className="min-h-screen px-4 py-10">
      <div className="max-w-5xl mx-auto">
        <div className="text-center mb-6">
          <Image src="/logo.png" alt="MyArea365" width={44} height={44} className="mx-auto mb-2 rounded-full" />
          <Link href="/" className="text-xs text-text-muted hover:text-white">← MyArea365.de</Link>
          <h1 className="text-3xl sm:text-4xl font-black text-white mt-2">🏆 Rankings</h1>
          <p className="text-text-muted mt-1 text-sm">Wer läuft am meisten, kämpft am härtesten, dominiert die Karte?</p>
        </div>

        <LeaderboardTabs />

        <div className="mt-10 text-center">
          <Link href="/#start" className="inline-block px-6 py-3 rounded-lg bg-primary text-bg-deep font-bold hover:bg-primary-dim">
            Kostenlos mitmachen →
          </Link>
        </div>
      </div>
    </main>
  );
}
