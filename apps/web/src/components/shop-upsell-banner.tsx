"use client";

import Link from "next/link";

type Plan = "free" | "basis" | "pro" | "ultra" | null | undefined;

/**
 * Zeigt einen Upsell-Hinweis, abhängig von Plan und Aktivität.
 * - free    → „Upgrade auf Basis (29 €/Mo) für Pin-Priorität + Analytics"
 * - basis   → bei >= 3 Deals/Monat: „Pro für unbegrenzte Deals + Flash-Push"
 * - pro     → bei >= 5 Deals/Monat: „Ultra für Daueranzeige + Stadt-Feature"
 * - ultra   → kein Upsell
 */
export function ShopUpsellBanner({ plan, monthlyRedemptions, flashCredits }: {
  plan: Plan;
  monthlyRedemptions: number;
  flashCredits: number;
}) {
  const p = plan ?? "free";

  if (p === "ultra") return null;

  if (p === "free") {
    return (
      <Upsell color="#22D1C3"
        title="Dein Shop ist kostenlos gelistet — für mehr Reichweite gibt's Basis"
        items={[
          "📍 Pin-Priorität auf der Karte",
          "🪙 Wegemünzen-Belohnung für Scans (zieht Runner an)",
          "📊 Basis-Analytics: Scans, Besuche, Einlösungen",
          "🧪 1× Flash-Push gratis zum Testen",
        ]}
        priceLine="29 € / Monat · monatlich kündbar"
      />
    );
  }

  if (p === "basis" && monthlyRedemptions >= 3) {
    return (
      <Upsell color="#FFD700"
        title={`Du hast ${monthlyRedemptions} Einlösungen diesen Monat — mit Pro könntest du 3× mehr Runner erreichen`}
        items={[
          "🚀 Unbegrenzte Deal-Slots statt 1",
          "⚡ 3 Flash-Pushes/Monat inklusive (1 km Radius)",
          "📈 Erweiterte Analytics (Top-Zeiten, Kiez-Benchmark)",
          "🏆 Spotlight 3 Tage/Monat inkl.",
        ]}
        priceLine="Pro: 79 € / Monat — bei 3 zusätzlichen Einlösungen hast du's raus"
      />
    );
  }

  if (p === "pro" && monthlyRedemptions >= 5) {
    return (
      <Upsell color="#FF2D78"
        title="Ultra lohnt sich für dich — Daueranzeige + Stadt-Feature"
        items={[
          "💎 Dauer-Spotlight (permanent Gold-Pin)",
          "📣 Push-Broadcast an ganze Stadt",
          "🥇 Stadt-Feature (1× im Monat Shop-der-Woche-Platzierung)",
          "🎯 Demographic-Targeting für Deals",
        ]}
        priceLine="Ultra: 199 € / Monat · für aktive Shops mit viel Laufkundschaft"
      />
    );
  }

  if (p === "basis" && flashCredits === 0) {
    return (
      <Upsell color="#FF6B4A"
        title="Dein erster Flash-Push wartet auf dich"
        items={[
          "Einmalig 9 € (oder in Pro/Ultra inklusive)",
          "Benachrichtigung an Runner in 1 km Radius",
          "Typisch: 15–30 zusätzliche Besuche pro Push",
        ]}
        priceLine="Testen, ob es sich für deinen Shop lohnt"
      />
    );
  }

  return null;
}

function Upsell({ color, title, items, priceLine }: {
  color: string; title: string; items: string[]; priceLine: string;
}) {
  return (
    <div style={{
      margin: "0 20px 14px",
      maxWidth: 1200, marginLeft: "auto", marginRight: "auto",
      padding: 16, borderRadius: 14,
      background: `linear-gradient(135deg, ${color}18, rgba(15,17,21,0.5))`,
      border: `1px solid ${color}55`,
      display: "grid", gridTemplateColumns: "1fr auto", gap: 16,
      alignItems: "center",
    }}>
      <div>
        <div style={{ fontSize: 10, color, fontWeight: 900, letterSpacing: 2, marginBottom: 4 }}>💡 UPGRADE-VORSCHLAG</div>
        <div style={{ fontSize: 15, fontWeight: 900, color: "#FFF", marginBottom: 8 }}>{title}</div>
        <ul style={{ margin: "0 0 8px", paddingLeft: 18, color: "#a8b4cf", fontSize: 12, lineHeight: 1.7 }}>
          {items.map((it, i) => <li key={i}>{it}</li>)}
        </ul>
        <div style={{ fontSize: 11, color, fontWeight: 700 }}>{priceLine}</div>
      </div>
      <Link href="/shop/billing" style={{
        padding: "10px 18px", borderRadius: 10, border: "none",
        background: color, color: "#0F1115",
        fontSize: 12, fontWeight: 900, letterSpacing: 0.5,
        textDecoration: "none", whiteSpace: "nowrap",
      }}>Mehr erfahren →</Link>
    </div>
  );
}
