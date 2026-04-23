"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type MyShop = {
  id: string;
  name: string;
  status: string | null;
  plan: string | null;
  rejection_reason: string | null;
  approved_at: string | null;
  total_checkins: number | null;
};

/**
 * Banner, der im Shop-Dashboard oben eingeblendet wird:
 * - keine Shops → lockt zur Anmeldung
 * - pending → wartet auf Review
 * - rejected → zeigt Grund
 * - approved & jung (< 7 Tage) → Onboarding-Checkliste
 */
export function ShopOnboardingBanner() {
  const [shops, setShops] = useState<MyShop[] | null>(null);

  useEffect(() => {
    fetch("/api/shop/my").then((r) => r.json()).then((d) => setShops(d.shops ?? []));
  }, []);

  if (!shops) return null;

  if (shops.length === 0) {
    return (
      <Banner tone="primary" icon="🏪"
        title="Noch kein Shop angemeldet?"
        body="Trag dein Geschäft kostenlos ein — Runner bekommen Bewegungs-Boni, du bekommst Laufkundschaft."
        cta={{ label: "Shop anmelden", href: "/shop/anmelden" }}
      />
    );
  }

  // Zeige den ersten relevanten Hinweis
  const pending = shops.find((s) => s.status === "pending");
  if (pending) {
    return (
      <Banner tone="warning" icon="⏳"
        title={`„${pending.name}" wartet auf Freigabe`}
        body="Wir prüfen deine Einreichung innerhalb von 48 Stunden. Du erhältst eine E-Mail, sobald dein Shop live ist."
      />
    );
  }

  const rejected = shops.find((s) => s.status === "rejected");
  if (rejected) {
    return (
      <Banner tone="danger" icon="✗"
        title={`„${rejected.name}" abgelehnt`}
        body={rejected.rejection_reason ?? "Bitte prüfe deine Angaben und reiche den Shop erneut ein."}
        cta={{ label: "Neu einreichen", href: "/shop/anmelden" }}
      />
    );
  }

  // Approved aber jung → Checkliste
  const approved = shops.find((s) => s.status === "approved");
  if (approved) {
    const daysSince = approved.approved_at
      ? Math.floor((Date.now() - new Date(approved.approved_at).getTime()) / 86400000)
      : 99;
    if (daysSince < 7 && (approved.total_checkins ?? 0) < 10) {
      return (
        <Banner tone="success" icon="✓"
          title={`„${approved.name}" ist live! Nächste Schritte:`}
          body=""
          checklist={[
            { done: true,  text: "Shop freigegeben" },
            { done: false, text: "QR-Code drucken oder Acryl-Aufsteller bestellen", href: `/shop/${approved.id}/qr` },
            { done: false, text: "Ersten Deal anlegen (bringt Runner zu dir)" },
            { done: false, text: "Flash-Push testen (einmalig gratis, 1 km Radius)" },
            { done: false, text: "Paket wählen — Basis 29 €/Mo reicht meist für den Anfang", href: "/shop/billing" },
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
