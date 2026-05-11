import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { LandingBack } from "@/components/landing-back";
import { AdSenseSlot } from "@/components/adsense-slot";
import { ARTICLES, getArticleBySlug } from "../_articles";
import { RenderBlock } from "../_renderer";

type Params = { slug: string };

export function generateStaticParams(): Params[] {
  return ARTICLES.map((a) => ({ slug: a.slug }));
}

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { slug } = await params;
  const a = getArticleBySlug(slug);
  if (!a) return { title: "Artikel nicht gefunden" };
  return {
    title: `${a.title} · MyArea365 Blog`,
    description: a.description,
    alternates: { canonical: `https://myarea365.de/blog/${a.slug}` },
    openGraph: {
      title: a.title,
      description: a.description,
      type: "article",
      url: `https://myarea365.de/blog/${a.slug}`,
      publishedTime: a.publishedAt,
      modifiedTime: a.updatedAt,
    },
    twitter: {
      card: "summary_large_image",
      title: a.title,
      description: a.description,
    },
  };
}

export default async function BlogArticlePage({ params }: { params: Promise<Params> }) {
  const { slug } = await params;
  const article = getArticleBySlug(slug);
  if (!article) notFound();

  const otherArticles = ARTICLES.filter((a) => a.slug !== article.slug).slice(0, 3);

  // Schema.org BlogPosting für Rich-Result-Eligibility
  const schema = {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    "@id": `https://myarea365.de/blog/${article.slug}`,
    headline: article.title,
    description: article.description,
    datePublished: article.publishedAt,
    dateModified: article.updatedAt,
    url: `https://myarea365.de/blog/${article.slug}`,
    inLanguage: "de-DE",
    author: { "@type": "Organization", name: "MyArea365", url: "https://myarea365.de" },
    publisher: { "@id": "https://myarea365.de/#organization" },
    mainEntityOfPage: { "@type": "WebPage", "@id": `https://myarea365.de/blog/${article.slug}` },
    articleSection: article.category,
    wordCount: estimateWordCount(article.blocks),
  };

  return (
    <main className="min-h-screen px-4 py-10">
      <div className="max-w-2xl mx-auto">
        <div className="mb-6">
          <LandingBack />
        </div>

        <article>
          <header className="mb-8">
            <div className="flex items-center gap-2 mb-3 flex-wrap">
              <span className="text-[10px] font-black tracking-wider uppercase px-2 py-0.5 rounded bg-primary/15 text-primary">
                {article.category}
              </span>
              <span className="text-[11px] text-text-muted">
                {article.readingMinutes} Min Lesezeit
              </span>
              <span className="text-[11px] text-text-muted">·</span>
              <time className="text-[11px] text-text-muted" dateTime={article.publishedAt}>
                {new Date(article.publishedAt).toLocaleDateString("de-DE", { day: "numeric", month: "long", year: "numeric" })}
              </time>
            </div>
            <h1 className="text-3xl sm:text-4xl font-black text-white leading-tight mb-3">
              <span className="text-4xl sm:text-5xl mr-2" aria-hidden="true">{article.heroEmoji}</span>
              {article.title}
            </h1>
            <p className="text-text-muted text-lg leading-relaxed">
              {article.description}
            </p>
          </header>

          <div className="prose-content">
            {article.blocks.map((block, i) => (
              <RenderBlock key={i} block={block} />
            ))}
          </div>
        </article>

        <AdSenseSlot placement="ranking_list" format="in-article" />

        {otherArticles.length > 0 && (
          <section className="mt-12 pt-8 border-t border-border">
            <h2 className="text-xl font-bold text-white mb-4">Weitere Guides</h2>
            <div className="space-y-3">
              {otherArticles.map((a) => (
                <Link
                  key={a.slug}
                  href={`/blog/${a.slug}`}
                  className="block bg-bg-card border border-border rounded-xl p-4 hover:border-primary/40 transition-colors"
                >
                  <div className="flex items-start gap-3">
                    <span className="text-2xl shrink-0" aria-hidden="true">{a.heroEmoji}</span>
                    <div className="flex-1">
                      <div className="text-[10px] font-black tracking-wider uppercase text-text-muted mb-1">
                        {a.category}
                      </div>
                      <div className="font-bold text-white text-sm mb-1">{a.title}</div>
                      <div className="text-xs text-text-muted line-clamp-2">{a.description}</div>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </section>
        )}

        <div className="mt-10 text-center">
          <Link href="/blog" className="text-primary hover:underline text-sm">
            ← Alle Artikel
          </Link>
        </div>
      </div>

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
      />
    </main>
  );
}

function estimateWordCount(blocks: typeof ARTICLES[number]["blocks"]): number {
  let words = 0;
  for (const b of blocks) {
    if (b.kind === "p" || b.kind === "h2" || b.kind === "h3" || b.kind === "callout") {
      words += b.text.split(/\s+/).length;
    } else if (b.kind === "ul" || b.kind === "ol") {
      for (const item of b.items) words += item.split(/\s+/).length;
    } else if (b.kind === "table") {
      for (const r of b.rows) for (const c of r) words += c.split(/\s+/).length;
    }
  }
  return words;
}
