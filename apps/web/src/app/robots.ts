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
          "/karte",
          "/inbox",
          "/einstellungen",
          "/runner-fights",
          "/base",
          "/crew/base",
          "/onboarding",
          "/registrierung-bestaetigen",
          "/unsubscribe",
        ],
      },
    ],
    sitemap: "https://myarea365.de/sitemap.xml",
  };
}
