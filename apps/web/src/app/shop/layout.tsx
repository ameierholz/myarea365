import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Shop – Boosts, Skins & Edelsteine",
  description:
    "Fair-Play-Shop: Edelsteine-Pakete, Wegemünzen-Booster, Skins und Komfort-Items. Keine Pay-to-Win-Vorteile — Siegel, Wächter und alle Währungen bleiben dem Laufen und Kämpfen vorbehalten.",
  alternates: { canonical: "/shop" },
  openGraph: {
    title: "MyArea365 Shop – Boosts, Skins & Edelsteine",
    description: "Fair-Play-Shop: Boosts, Skins, Edelsteine. Keine Kampf-Stats erkaufbar.",
    images: ["/og-default.png"],
  },
};

export default function ShopLayout({ children }: { children: React.ReactNode }) {
  return children;
}
