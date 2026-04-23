import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const nextConfig: NextConfig = {
  trailingSlash: true,
  transpilePackages: ["@myarea365/shared"],

  allowedDevOrigins: ["127.0.0.1", "localhost"],

  images: {
    unoptimized: false,
    remotePatterns: [
      { protocol: "https", hostname: "**.supabase.co" },
    ],
    formats: ["image/avif", "image/webp"],
  },

  async headers() {
    // Content-Security-Policy — whitelistet nur, was die App tatsächlich braucht.
    // 'unsafe-inline' für Scripts ist aktuell nötig für next/script-Patches und
    // JSON-LD; mittelfristig sollte auf Nonces umgestellt werden.
    //
    // Dev-Mode: Turbopack braucht WebSockets zu localhost und `upgrade-insecure-
    // requests` würde HMR + API-Fetches brechen. Daher zwei Profile.
    const isDev = process.env.NODE_ENV === "development";
    const devConnect = isDev ? " ws: wss: http://localhost:* http://127.0.0.1:*" : "";
    const csp = [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://js.stripe.com https://*.stripe.com https://pagead2.googlesyndication.com https://*.googleadservices.com",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "font-src 'self' data: https://fonts.gstatic.com",
      "img-src 'self' data: blob: https:",
      "media-src 'self' blob: data:",
      `connect-src 'self' https://*.supabase.co wss://*.supabase.co https://api.stripe.com https://*.stripe.com https://api.anthropic.com https://api.mapbox.com https://*.tiles.mapbox.com https://*.basemaps.cartocdn.com https://*.googleadservices.com https://overpass-api.de https://*.openstreetmap.org${devConnect}`,
      "worker-src 'self' blob:",
      "frame-src https://js.stripe.com https://*.stripe.com https://www.googletagmanager.com",
      "frame-ancestors 'none'",
      "form-action 'self' https://checkout.stripe.com",
      "base-uri 'self'",
      "object-src 'none'",
      ...(isDev ? [] : ["upgrade-insecure-requests"]),
    ].join("; ");

    const baseHeaders = [
      { key: "X-Content-Type-Options", value: "nosniff" },
      { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
      { key: "X-Frame-Options", value: "DENY" },
      {
        key: "Permissions-Policy",
        value: "geolocation=(self), camera=(), microphone=(), payment=(self \"https://js.stripe.com\")",
      },
      // Im Dev CSP-Report-Only, damit Verstöße sichtbar sind, aber nichts bricht.
      {
        key: isDev ? "Content-Security-Policy-Report-Only" : "Content-Security-Policy",
        value: csp,
      },
      {
        key: "Strict-Transport-Security",
        value: "max-age=31536000; includeSubDomains; preload",
      },
    ];

    return [
      { source: "/(.*)", headers: baseHeaders },
      {
        source: "/_next/static/(.*)",
        headers: [
          { key: "Cache-Control", value: "public, max-age=31536000, immutable" },
        ],
      },
    ];
  },
};

export default withNextIntl(nextConfig);
