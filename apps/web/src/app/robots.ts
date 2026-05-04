import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: [
          "/admin",
          "/api/",
          "/auth/",
          "/dashboard",
          "/inbox",
          "/einstellungen",
          "/runner-fights",
          "/base",
          "/crew/base",
          "/onboarding",
          "/registrierung-bestaetigen",
          "/shop-dashboard",
          "/unsubscribe",
        ],
      },
    ],
    sitemap: "https://myarea365.de/sitemap.xml",
  };
}
