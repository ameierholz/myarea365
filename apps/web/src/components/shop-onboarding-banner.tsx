"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";

type MyShop = {
  id: string;
  name: string;
  status: string | null;
  plan: string | null;
  rejection_reason: string | null;
  approved_at: string | null;
  total_checkins: number | null;
};

export function ShopOnboardingBanner() {
  const t = useTranslations("ShopPanels");
  const [shops, setShops] = useState<MyShop[] | null>(null);

  useEffect(() => {
    fetch("/api/shop/my").then((r) => r.json()).then((d) => setShops(d.shops ?? []));
  }, []);

  if (!shops) return null;

  if (shops.length === 0) {
    return (
      <Banner tone="primary" icon="🏪"
        title={t("onbNoShopTitle")}
        body={t("onbNoShopBody")}
        cta={{ label: t("onbNoShopCta"), href: "/shop/anmelden" }}
      />
    );
  }

  const pending = shops.find((s) => s.status === "pending");
  if (pending) {
    return (
      <Banner tone="warning" icon="⏳"
        title={t("onbPendingTitle", { name: pending.name })}
        body={t("onbPendingBody")}
      />
    );
  }

  const rejected = shops.find((s) => s.status === "rejected");
  if (rejected) {
    return (
      <Banner tone="danger" icon="✗"
        title={t("onbRejectedTitle", { name: rejected.name })}
        body={rejected.rejection_reason ?? t("onbRejectedFallback")}
        cta={{ label: t("onbRejectedCta"), href: "/shop/anmelden" }}
      />
    );
  }

  const approved = shops.find((s) => s.status === "approved");
  if (approved) {
    const daysSince = approved.approved_at
      ? Math.floor((Date.now() - new Date(approved.approved_at).getTime()) / 86400000)
      : 99;
    if (daysSince < 7 && (approved.total_checkins ?? 0) < 10) {
      return (
        <Banner tone="success" icon="✓"
          title={t("onbApprovedTitle", { name: approved.name })}
          body=""
          checklist={[
            { done: true,  text: t("onbCheck1") },
            { done: false, text: t("onbCheck2"), href: `/shop/${approved.id}/qr` },
            { done: false, text: t("onbCheck3") },
            { done: false, text: t("onbCheck4") },
            { done: false, text: t("onbCheck5"), href: "/shop/billing" },
          ]}
        />
      );
    }
  }

  return null;
}

function Banner({ tone, icon, title, body, cta, checklist }: {
  tone: "primary" | "warning" | "danger" | "success";
  icon: string;
  title: string;
  body: string;
  cta?: { label: string; href: string };
  checklist?: { done: boolean; text: string; href?: string }[];
}) {
  const colors = {
    primary: { bg: "rgba(34,209,195,0.1)",  border: "#22D1C3", text: "#22D1C3" },
    warning: { bg: "rgba(255,215,0,0.1)",   border: "#FFD700", text: "#FFD700" },
    danger:  { bg: "rgba(255,45,120,0.1)",  border: "#FF2D78", text: "#FF2D78" },
    success: { bg: "rgba(74,222,128,0.1)",  border: "#4ade80", text: "#4ade80" },
  }[tone];
  return (
    <div style={{
      margin: "0 20px 14px",
      maxWidth: 1200, marginLeft: "auto", marginRight: "auto",
      padding: 16, borderRadius: 14,
      background: colors.bg, border: `1px solid ${colors.border}55`,
      display: "flex", gap: 12, alignItems: "flex-start",
    }}>
      <div style={{ fontSize: 28 }}>{icon}</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 900, color: colors.text, marginBottom: 2 }}>{title}</div>
        {body && <div style={{ fontSize: 13, color: "#a8b4cf", lineHeight: 1.5 }}>{body}</div>}
        {checklist && (
          <ul style={{ margin: "10px 0 0", padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: 4 }}>
            {checklist.map((c, i) => (
              <li key={i} style={{ fontSize: 12, color: c.done ? "#8B8FA3" : "#FFF", textDecoration: c.done ? "line-through" : "none" }}>
                {c.done ? "✓" : "○"}{" "}
                {c.href ? <Link href={c.href} style={{ color: colors.text, textDecoration: "underline" }}>{c.text}</Link> : c.text}
              </li>
            ))}
          </ul>
        )}
        {cta && (
          <Link href={cta.href} style={{
            display: "inline-block", marginTop: 10,
            padding: "8px 14px", borderRadius: 8, border: "none",
            background: colors.border, color: "#0F1115",
            fontSize: 12, fontWeight: 900, textDecoration: "none",
          }}>{cta.label} →</Link>
        )}
      </div>
    </div>
  );
}
