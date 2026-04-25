"use client";

import { useTranslations } from "next-intl";

type Plan = "free" | "basis" | "pro" | "ultra" | null | undefined;

export function ShopUpsellBanner({ plan, monthlyRedemptions, flashCredits, onOpenProducts }: {
  plan: Plan;
  monthlyRedemptions: number;
  flashCredits: number;
  onOpenProducts: (tab: "plans" | "boosts" | "marketing" | "analytics") => void;
}) {
  const t = useTranslations("ShopPanels");
  const p = plan ?? "free";

  if (p === "ultra") return null;

  if (p === "free") {
    return (
      <Upsell color="#22D1C3" onClick={() => onOpenProducts("plans")}
        title={t("upsellFreeTitle")}
        items={[t("upsellFreeI1"), t("upsellFreeI2"), t("upsellFreeI3"), t("upsellFreeI4")]}
        priceLine={t("upsellFreePrice")}
        ctaLabel={t("upsellCta")}
        kicker={t("upsellKicker")}
      />
    );
  }

  if (p === "basis" && monthlyRedemptions >= 3) {
    return (
      <Upsell color="#FFD700" onClick={() => onOpenProducts("plans")}
        title={t("upsellBasisProTitle", { n: monthlyRedemptions })}
        items={[t("upsellBasisProI1"), t("upsellBasisProI2"), t("upsellBasisProI3"), t("upsellBasisProI4")]}
        priceLine={t("upsellBasisProPrice")}
        ctaLabel={t("upsellCta")}
        kicker={t("upsellKicker")}
      />
    );
  }

  if (p === "pro" && monthlyRedemptions >= 5) {
    return (
      <Upsell color="#FF2D78" onClick={() => onOpenProducts("plans")}
        title={t("upsellProUltraTitle")}
        items={[t("upsellProUltraI1"), t("upsellProUltraI2"), t("upsellProUltraI3"), t("upsellProUltraI4")]}
        priceLine={t("upsellProUltraPrice")}
        ctaLabel={t("upsellCta")}
        kicker={t("upsellKicker")}
      />
    );
  }

  if (p === "basis" && flashCredits === 0) {
    return (
      <Upsell color="#FF6B4A" onClick={() => onOpenProducts("boosts")}
        title={t("upsellFlashTitle")}
        items={[t("upsellFlashI1"), t("upsellFlashI2"), t("upsellFlashI3")]}
        priceLine={t("upsellFlashPrice")}
        ctaLabel={t("upsellCta")}
        kicker={t("upsellKicker")}
      />
    );
  }

  return null;
}

function Upsell({ color, title, items, priceLine, onClick, ctaLabel, kicker }: {
  color: string; title: string; items: string[]; priceLine: string;
  onClick: () => void; ctaLabel: string; kicker: string;
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
        <div style={{ fontSize: 10, color, fontWeight: 900, letterSpacing: 2, marginBottom: 4 }}>{kicker}</div>
        <div style={{ fontSize: 15, fontWeight: 900, color: "#FFF", marginBottom: 8 }}>{title}</div>
        <ul style={{ margin: "0 0 8px", paddingLeft: 18, color: "#a8b4cf", fontSize: 12, lineHeight: 1.7 }}>
          {items.map((it, i) => <li key={i}>{it}</li>)}
        </ul>
        <div style={{ fontSize: 11, color, fontWeight: 700 }}>{priceLine}</div>
      </div>
      <button onClick={onClick} style={{
        padding: "10px 18px", borderRadius: 10, border: "none",
        background: color, color: "#0F1115",
        fontSize: 12, fontWeight: 900, letterSpacing: 0.5,
        cursor: "pointer", whiteSpace: "nowrap",
      }}>{ctaLabel}</button>
    </div>
  );
}
