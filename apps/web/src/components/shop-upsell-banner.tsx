"use client";

import { useTranslations } from "next-intl";
import { useDailyDismiss } from "@/lib/use-daily-dismiss";

type Plan = "free" | "basis" | "pro" | "ultra" | null | undefined;

export function ShopUpsellBanner({ plan, monthlyRedemptions, flashCredits, onOpenProducts }: {
  plan: Plan;
  monthlyRedemptions: number;
  flashCredits: number;
  onOpenProducts: (tab: "plans" | "boosts" | "marketing" | "analytics") => void;
}) {
  const t = useTranslations("ShopPanels");
  const p = plan ?? "free";
  const free = useDailyDismiss("shop-upsell-free");
  const basisPro = useDailyDismiss("shop-upsell-basis-pro");
  const proUltra = useDailyDismiss("shop-upsell-pro-ultra");
  const flash = useDailyDismiss("shop-upsell-flash");
  const dismissLabel = t("dismissAria");

  if (p === "ultra") return null;

  if (p === "free") {
    if (free.dismissed) return null;
    return (
      <Upsell color="#22D1C3" onClick={() => onOpenProducts("plans")}
        title={t("upsellFreeTitle")}
        items={[t("upsellFreeI1"), t("upsellFreeI2"), t("upsellFreeI3"), t("upsellFreeI4")]}
        priceLine={t("upsellFreePrice")}
        ctaLabel={t("upsellCta")}
        kicker={t("upsellKicker")}
        onDismiss={free.dismiss} dismissLabel={dismissLabel}
      />
    );
  }

  if (p === "basis" && monthlyRedemptions >= 3) {
    if (basisPro.dismissed) return null;
    return (
      <Upsell color="#FFD700" onClick={() => onOpenProducts("plans")}
        title={t("upsellBasisProTitle", { n: monthlyRedemptions })}
        items={[t("upsellBasisProI1"), t("upsellBasisProI2"), t("upsellBasisProI3"), t("upsellBasisProI4")]}
        priceLine={t("upsellBasisProPrice")}
        ctaLabel={t("upsellCta")}
        kicker={t("upsellKicker")}
        onDismiss={basisPro.dismiss} dismissLabel={dismissLabel}
      />
    );
  }

  if (p === "pro" && monthlyRedemptions >= 5) {
    if (proUltra.dismissed) return null;
    return (
      <Upsell color="#FF2D78" onClick={() => onOpenProducts("plans")}
        title={t("upsellProUltraTitle")}
        items={[t("upsellProUltraI1"), t("upsellProUltraI2"), t("upsellProUltraI3"), t("upsellProUltraI4")]}
        priceLine={t("upsellProUltraPrice")}
        ctaLabel={t("upsellCta")}
        kicker={t("upsellKicker")}
        onDismiss={proUltra.dismiss} dismissLabel={dismissLabel}
      />
    );
  }

  if (p === "basis" && flashCredits === 0) {
    if (flash.dismissed) return null;
    return (
      <Upsell color="#FF6B4A" onClick={() => onOpenProducts("boosts")}
        title={t("upsellFlashTitle")}
        items={[t("upsellFlashI1"), t("upsellFlashI2"), t("upsellFlashI3")]}
        priceLine={t("upsellFlashPrice")}
        ctaLabel={t("upsellCta")}
        kicker={t("upsellKicker")}
        onDismiss={flash.dismiss} dismissLabel={dismissLabel}
      />
    );
  }

  return null;
}

function Upsell({ color, title, items, priceLine, onClick, ctaLabel, kicker, onDismiss, dismissLabel }: {
  color: string; title: string; items: string[]; priceLine: string;
  onClick: () => void; ctaLabel: string; kicker: string;
  onDismiss?: () => void; dismissLabel?: string;
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
      position: "relative",
    }}>
      {onDismiss && (
        <button
          onClick={onDismiss}
          aria-label={dismissLabel}
          title={dismissLabel}
          style={{
            position: "absolute", top: 6, right: 6,
            width: 22, height: 22, borderRadius: 999,
            background: "rgba(15,17,21,0.55)", border: "1px solid rgba(255,255,255,0.12)",
            color: "#a8b4cf", fontSize: 12, lineHeight: 1, cursor: "pointer",
            display: "inline-flex", alignItems: "center", justifyContent: "center",
            zIndex: 2,
          }}
        >×</button>
      )}
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
