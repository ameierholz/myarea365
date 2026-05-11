import Link from "next/link";
import type { Metadata } from "next";
import { LandingBack } from "@/components/landing-back";
import { AdSenseSlot } from "@/components/adsense-slot";
import { ARTICLES } from "./_articles";

export const metadata: Metadata = {
  title: "Blog · MyArea365 — Strategie-Guides, CvC-Saga, Crew-Aufbau",
  description: "Long-Form-Guides zu MyArea365: Stadt-Server-Strategie, Crew-Aufbau, Don-Mechanik, Metropol-Saga, Wächter-Synergien und Diamanten-Effizienz für F2P- und Pay-to-Progress-Spieler.",
  alternates: { canonical: "https://myarea365.de/blog" },
  openGraph: {
    title: "MyArea365 Blog",
    description: "Strategie-Guides für die Heimat-Stadt, CvC-Saga und Wächter-Builds.",
    type: "website",
    url: "https://myarea365.de/blog",
  },
};

const CATEGORY_COLORS: Record<string, { bg: string; fg: string }> = {
  Strategie:  { bg: "rgba(34,209,195,0.15)",  fg: "#22D1C3" },
  Crew:       { bg: "rgba(168,85,247,0.15)",  fg: "#a855f7" },
  Saga:       { bg: "rgba(255,107,74,0.15)",  fg: "#FF6B4A" },
  Wächter:    { bg: "rgba(255,45,120,0.15)",  fg: "#FF2D78" },
  Wirtschaft: { bg: "rgba(255,215,0,0.15)",   fg: "#FFD700" },
  Onboarding: { bg: "rgba(74,222,128,0.15)",  fg: "#4ade80" },
};

export default function BlogIndexPage() {
  // Schema.org Blog mit hasPart-Listing für besseres SEO
  const schema = {
    "@context": "https://schema.org",
    "@type": "Blog",
    "@id": "https://myarea365.de/blog#blog",
    name: "MyArea365 Strategie-Blog",
    description: "Strategie-Guides für die Heimat-Stadt, CvC-Saga, Crews und Wächter in MyArea365.",
    url: "https://myarea365.de/blog",
    inLanguage: "de-DE",
    publisher: { "@id": "https://myarea365.de/#organization" },
    blogPost: ARTICLES.map((a) => ({
      "@type": "BlogPosting",
      "@id": `https://myarea365.de/blog/${a.slug}`,
      headline: a.title,
      description: a.description,
      datePublished: a.publishedAt,
      dateModified: a.updatedAt,
      url: `https://myarea365.de/blog/${a.slug}`,
    })),
  };

  return (
    <main className="min-h-screen px-4 py-10">
      <div className="max-w-4xl mx-auto">
        <div className="mb-6">
          <LandingBack />
        </div>

        <header className="text-center mb-10">
          <h1 className="text-4xl sm:text-5xl font-black text-white mb-3 leading-tight">
            MyArea365 Blog
          </h1>
          <p className="text-text-muted max-w-2xl mx-auto leading-relaxed">
            Strategie-Guides, Crew-Aufbau und Saga-Insights — direkt aus dem Spiel
            für Spieler die mehr wollen als die Tutorial-Hinweise.
          </p>
        </header>

        <div className="space-y-3">
          {ARTICLES.map((article) => {
            const cat = CATEGORY_COLORS[article.category];
            return (
              <Link
                key={article.slug}
                href={`/blog/${article.slug}`}
                className="block bg-bg-card border border-border rounded-2xl p-5 hover:border-primary/40 hover:bg-bg-card-hover transition-colors group"
              >
                <div className="flex items-start gap-4">
                  <span className="text-4xl shrink-0" aria-hidden="true">
                    {article.heroEmoji}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-2 flex-wrap">
                      <span
                        className="text-[10px] font-black tracking-wider uppercase px-2 py-0.5 rounded"
                        style={{ background: cat.bg, color: cat.fg }}
                      >
                        {article.category}
                      </span>
                      <span className="text-[11px] text-text-muted">
                        {article.readingMinutes} Min Lesezeit
                      </span>
                    </div>
                    <h2 className="text-lg font-bold text-white mb-2 leading-snug group-hover:text-primary transition-colors">
                      {article.title}
                    </h2>
                    <p className="text-sm text-text-muted leading-relaxed">
                      {article.description}
                    </p>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>

        <AdSenseSlot placement="ranking_list" format="in-feed" />

        <div className="mt-10 text-center text-xs text-text-muted">
          Du willst über neue Guides informiert werden? Folge uns im Spiel-Inbox-Channel
          oder abonniere{" "}
          <Link href="/registrieren" className="text-primary hover:underline">
            den kostenlosen Account
          </Link>
          .
        </div>
      </div>

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
      />
    </main>
  );
}
