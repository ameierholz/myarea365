import type { MetadataRoute } from "next";
import { createClient } from "@/lib/supabase/server";
import { ARTICLES } from "./blog/_articles";

// Sitemap höchstens stündlich neu bauen — frische Public-Profiles
// erscheinen verzögert in Google's Index, mehr Frequenz lohnt nicht.
export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = "https://myarea365.de";
  const now = new Date();

  const statics: MetadataRoute.Sitemap = [
    { url: `${base}/`, lastModified: now, priority: 1 },
    { url: `${base}/leaderboard`, lastModified: now, priority: 0.9 },
    { url: `${base}/saga`, lastModified: now, priority: 0.9 },
    { url: `${base}/blog`, lastModified: now, priority: 0.9 },
    { url: `${base}/pricing`, lastModified: now, priority: 0.85 },
    { url: `${base}/registrieren`, lastModified: now, priority: 0.8 },
    { url: `${base}/login`, lastModified: now, priority: 0.5 },
    { url: `${base}/support`, lastModified: now, priority: 0.5 },
    { url: `${base}/agb`, lastModified: now, priority: 0.3 },
    { url: `${base}/datenschutz`, lastModified: now, priority: 0.3 },
    { url: `${base}/impressum`, lastModified: now, priority: 0.3 },
    { url: `${base}/loot-drops`, lastModified: now, priority: 0.3 },
  ];

  const blogPosts: MetadataRoute.Sitemap = ARTICLES.map((a) => ({
    url: `${base}/blog/${a.slug}`,
    lastModified: new Date(a.updatedAt),
    priority: 0.7,
  }));

  try {
    const sb = await createClient();
    const { data: users } = await sb.from("v_public_profiles").select("username").limit(10000);
    const userUrls: MetadataRoute.Sitemap = (users ?? []).map((u) => ({
      url: `${base}/u/${u.username}`,
      lastModified: now,
      priority: 0.6,
    }));
    return [...statics, ...blogPosts, ...userUrls];
  } catch {
    return [...statics, ...blogPosts];
  }
}
