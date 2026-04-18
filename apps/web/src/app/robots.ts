import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      { userAgent: "*", allow: "/", disallow: ["/admin", "/dashboard", "/shop-dashboard", "/api/", "/onboarding", "/auth/"] },
    ],
    sitemap: "https://myarea365.de/sitemap.xml",
    host: "https://myarea365.de",
  };
}
