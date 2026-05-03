"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";

const GOLD = "#FFD700";
const PINK = "#FF2D78";
const PRIMARY = "#22D1C3";
const TEXT_SOFT = "#a8b4cf";
const MUTED = "#8B8FA3";

type Pack = {
  sku: string;
  price_eur: number;
  label: string;
  rewards: {
    gems?: number;
    coins?: number;
    items?: Array<{ catalog_id: string; count: number }>;
  };
};

type Offer = {
  id: string;
  template_id: string;
  trigger_event: string;
  packs_purchased: string[];
  expires_at: string;
  popup_offer_templates: {
    id: string; title: string; subtitle: string | null; emoji: string | null; packs: Pack[];
  };
};

type ApiData = { offers: (Omit<Offer, "popup_offer_templates"> & { popup_offer_templates: Offer["popup_offer_templates"] | Offer["popup_offer_templates"][] })[] };

/**
 * Renders the *first* open popup offer as a fullscreen modal.
 * Auto-fetches on mount; re-fetches after dismiss/purchase.
 */
export function PopupOfferGate() {
  const t = useTranslations("PopupOffer");
  const [offer, setOffer] = useState<Offer | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [now, setNow] = useState(Date.now());

  const load = useCallback(async () => {
    try {
      const r = await fetch("/api/runner/popups");
      if (!r.ok) return;
      const j = await r.json() as ApiData;
      const next = (j.offers ?? [])[0];
      if (!next) { setOffer(null); return; }
      const tpl = Array.isArray(next.popup_offer_templates) ? next.popup_offer_templates[0] : next.popup_offer_templates;
      setOffer({ ...next, popup_offer_templates: tpl } as Offer);
    } catch { /* stumm */ }
  }, []);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => { const i = setInterval(() => setNow(Date.now()), 30000); return () => clearInterval(i); }, []);

  if (!offer) return null;

  async function dismiss() {
    if (busy) return;
    setBusy("dismiss");
    try {
      await fetch("/api/runner/popups", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ offer_id: offer!.id, action: "dismiss" }),
      });
      await load();
    } finally { setBusy(null); }
  }

  async function purchase(sku: string) {
    if (busy) return;
    setBusy(sku);
    try {
      const r = await fetch("/api/runner/popups", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ offer_id: offer!.id, action: "purchase", sku }),
      });
      if (r.ok) { alert(t("purchased")); await load(); }
      else { const j = await r.json().catch(() => null) as { error?: string } | null; alert(j?.error ?? t("error")); }
    } finally { setBusy(null); }
  }

  const tpl = offer.popup_offer_templates;
  const purchased = new Set(offer.packs_purchased ?? []);
  const expiresMs = new Date(offer.expires_at).getTime() - now;
  const hoursLeft = Math.max(0, Math.floor(expiresMs / 3600000));
  const minutesLeft = Math.max(0, Math.floor((expiresMs % 3600000) / 60000));

  return (
    <div onClick={dismiss} style={{
      position: "fixed", inset: 0, zIndex: 9300,
      background: "rgba(0,0,0,0.85)", backdropFilter: "blur(8px)",
      display: "flex", alignItems: "center", justifyContent: "center", padding: 12,
    }}>
      <div onClick={(e) => e.stopPropagation()} style={{
        width: "100%", maxWidth: 480,
        background: `linear-gradient(180deg, ${GOLD}26 0%, #141a2d 60%)`,
        borderRadius: 18, border: `2px solid ${GOLD}`,
        boxShadow: `0 0 40px ${GOLD}66`,
        color: "#F0F0F0", overflow: "hidden",
      }}>
        {/* Hero */}
        <div style={{
          padding: "20px 16px 14px", textAlign: "center",
          background: `radial-gradient(ellipse at top, ${GOLD}33, transparent 70%)`,
        }}>
          <div style={{ fontSize: 56, lineHeight: 1 }}>{tpl.emoji ?? "🎁"}</div>
          <div style={{ marginTop: 8, color: GOLD, fontSize: 9, fontWeight: 900, letterSpacing: 2 }}>
            {t("limitedOffer")}
          </div>
          <div style={{ color: "#FFF", fontSize: 22, fontWeight: 900, marginTop: 4 }}>{tpl.title}</div>
          {tpl.subtitle && <div style={{ color: TEXT_SOFT, fontSize: 12, marginTop: 4 }}>{tpl.subtitle}</div>}
          <div style={{ color: PINK, fontSize: 11, fontWeight: 700, marginTop: 8 }}>
            ⏳ {t("expiresIn", { hours: hoursLeft, minutes: minutesLeft })}
          </div>
        </div>

        {/* Packs */}
        <div style={{ padding: "8px 14px 14px", display: "flex", flexDirection: "column", gap: 8 }}>
          {tpl.packs.map((p) => {
            const isPurchased = purchased.has(p.sku);
            return (
              <button
                key={p.sku}
                onClick={() => !isPurchased && purchase(p.sku)}
                disabled={isPurchased || busy !== null}
                style={{
                  padding: "12px 14px",
                  borderRadius: 12, border: `1px solid ${isPurchased ? "#444" : GOLD}66`,
                  background: isPurchased ? "rgba(0,0,0,0.4)" : `linear-gradient(135deg, ${GOLD}1a, rgba(0,0,0,0.5))`,
                  color: isPurchased ? MUTED : "#FFF",
                  cursor: isPurchased ? "default" : "pointer",
                  textAlign: "left",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 900 }}>{p.label}</div>
                    <div style={{ fontSize: 10, color: TEXT_SOFT, marginTop: 2 }}>
                      {[
                        p.rewards.gems ? `💎 ${p.rewards.gems.toLocaleString("de-DE")}` : null,
                        p.rewards.coins ? `🪙 ${p.rewards.coins.toLocaleString("de-DE")}` : null,
                        p.rewards.items?.length ? `📦 ${p.rewards.items.reduce((n, i) => n + i.count, 0)} Items` : null,
                      ].filter(Boolean).join(" · ")}
                    </div>
                  </div>
                  <div style={{
                    padding: "6px 12px", borderRadius: 8,
                    background: isPurchased ? "transparent" : GOLD,
                    color: isPurchased ? MUTED : "#0F1115",
                    fontSize: 13, fontWeight: 900,
                  }}>
                    {isPurchased ? "✓" : busy === p.sku ? "…" : `${p.price_eur.toFixed(2)} €`}
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        {/* Dismiss */}
        <button onClick={dismiss} disabled={busy !== null} style={{
          width: "100%", padding: "12px",
          background: "rgba(0,0,0,0.4)", border: "none", borderTop: "1px solid rgba(255,255,255,0.06)",
          color: TEXT_SOFT, fontSize: 12, fontWeight: 700, cursor: "pointer",
        }}>{t("notInterested")}</button>
      </div>
    </div>
  );
}
