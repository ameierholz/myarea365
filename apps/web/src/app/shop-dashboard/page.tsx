"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { appAlert, appConfirm } from "@/components/app-dialog";
import { ShopProductsModal } from "@/components/shop-products-modal";
import {
  FlashPushPanel, EventsPanel, ChallengesPanel, SocialPanel, EmailPanel,
  AnalyticsProPanel, CompetitorPanel, KiezReportPanel, CustomPinPanel, QrOrderPanel,
} from "@/components/shop-features";
import { ShopRedemptionsLive } from "@/components/shop-redemptions-live";
import { ShopArenaPanel } from "@/components/shop-arena-panel";
import { ShopQuestsManager } from "@/components/shop-quests-manager";
import { ShopTerritoryBonusPanel } from "@/components/shop-territory-bonus-panel";
import { ShopOnboardingBanner } from "@/components/shop-onboarding-banner";
import { ShopUpsellBanner } from "@/components/shop-upsell-banner";
import { createClient } from "@/lib/supabase/client";

/* Farb-Tokens (1:1 aus map-dashboard) */
const BG_DEEP = "#0F1115";
const CARD = "rgba(41, 51, 73, 0.55)";
const BORDER = "rgba(255, 255, 255, 0.14)";
const MUTED = "#a8b4cf";
const TEXT_SOFT = "#dde3f5";
const PRIMARY = "#22D1C3";
const ACCENT = "#FF2D78";

/* ═══ Demo-Shop-Daten ═══ */
const DEMO_SHOP = {
  id: "shop-demo-1",
  name: "Café Kaelthor",
  owner: "Kaelthor Malven",
  category: "Café & Bäcker",
  address: "Senftenberger Ring 91, 13435 Berlin",
  plan: "Pro",
  planColor: "#FFD700",
  created: "2026-01-12",
  rating: 4.7,
  verified: true,
};

const DEMO_STATS = {
  checkinsToday: 8,
  checkinsWeek: 52,
  checkinsMonth: 184,
  revenueMonth: 2280, // € geschätzt
  costMonth: 368, // 184 × 2 €
  newCustomersMonth: 71,
  repeatRate: 41, // %
  avgBasket: 12.4,
  rankInZip: 3,
  totalShopsInZip: 14,
};

type DealFreq = "once" | "weekly" | "monthly" | "quarterly" | "halfyearly" | "yearly" | "unlimited";

type Deal = {
  id: string;
  title: string;
  xp: number;
  freq: DealFreq;
  active: boolean;
  redemptions_month: number;
  created: string;
};

const FREQ_LABEL: Record<DealFreq, string> = {
  once: "1× einmalig",
  weekly: "1× / Woche",
  monthly: "1× / Monat",
  quarterly: "1× / Quartal",
  halfyearly: "1× / Halbjahr",
  yearly: "1× / Jahr",
  unlimited: "Unbegrenzt",
};

const DEMO_DEALS: Deal[] = [
  { id: "d1", title: "Gratis Cappuccino ab 3 km Lauf", xp: 300, freq: "weekly",    active: true,  redemptions_month: 82, created: "2026-02-01" },
  { id: "d2", title: "2. Croissant gratis",            xp: 150, freq: "monthly",   active: true,  redemptions_month: 54, created: "2026-02-15" },
  { id: "d3", title: "10 € Gutschein ab 500 XP",       xp: 500, freq: "quarterly", active: true,  redemptions_month: 18, created: "2026-03-01" },
  { id: "d4", title: "Geburtstags-Kuchen gratis",      xp: 200, freq: "yearly",    active: true,  redemptions_month: 4,  created: "2026-01-20" },
  { id: "d5", title: "Happy Hour Eistee 50%",          xp: 100, freq: "unlimited", active: false, redemptions_month: 0,  created: "2026-02-10" },
];

type FlashDeal = {
  id: string;
  title: string;
  pct: number;
  minutes: number;
  scheduledAt: string;
  status: "scheduled" | "active" | "done";
  pushedTo: number;
  converted: number;
};

const DEMO_FLASH_DEALS: FlashDeal[] = [
  { id: "f1", title: "Nächste 30 Min: −50% auf Apfelkuchen", pct: 50, minutes: 30, scheduledAt: new Date(Date.now() + 2 * 3600000).toISOString(), status: "scheduled", pushedTo: 0,  converted: 0 },
  { id: "f2", title: "Flash: Gratis Kombucha bei 7+ km",     pct: 100, minutes: 45, scheduledAt: new Date(Date.now() - 45 * 60000).toISOString(), status: "done",     pushedTo: 312, converted: 27 },
  { id: "f3", title: "Regen-Rabatt: −30% Heißgetränke",      pct: 30, minutes: 60, scheduledAt: new Date(Date.now() - 5 * 24 * 3600000).toISOString(), status: "done", pushedTo: 284, converted: 41 },
];

const DEMO_TOP_RUNNERS = [
  { name: "NeonFuchs",   emoji: "🦊", visits: 14, last: "vor 2 Std.",  spent: 168 },
  { name: "Pacer99",     emoji: "🚀", visits: 11, last: "gestern",      spent: 132 },
  { name: "StadtPuma",   emoji: "🐆", visits: 9,  last: "vor 3 Tagen", spent: 108 },
  { name: "WegFinder",   emoji: "🧭", visits: 7,  last: "vor 5 Tagen", spent: 84  },
  { name: "Schrittzahl", emoji: "👟", visits: 6,  last: "heute",        spent: 72  },
];

/* ═══════════════════════════════════════════════════════ */

type SubTab = "overview" | "deals" | "quests" | "flash" | "spotlight" | "customers" | "performance" | "settings";

type ShopRow = {
  id: string; name: string;
  plan?: string | null;
  status?: string | null;
  spotlight_until?: string | null;
  radius_boost_until?: string | null;
  top_listing_until?: string | null;
  social_pro_until?: string | null;
  analytics_pro_until?: string | null;
  competitor_analysis_until?: string | null;
  custom_pin_url?: string | null;
  flash_push_credits?: number;
  event_host_credits?: number;
  challenge_sponsor_credits?: number;
  email_campaign_credits?: number;
  qr_print_ordered_at?: string | null;
};

function useShop(fallbackId: string): [ShopRow, () => void] {
  const sb = createClient();
  const [reloadTick, setReloadTick] = useState(0);
  const fallback: ShopRow = {
    id: fallbackId, name: DEMO_SHOP.name,
    plan: "pro",
    flash_push_credits: 3, event_host_credits: 2, challenge_sponsor_credits: 2, email_campaign_credits: 1,
    social_pro_until: new Date(Date.now() + 25 * 86400000).toISOString(),
    analytics_pro_until: new Date(Date.now() + 25 * 86400000).toISOString(),
    competitor_analysis_until: new Date(Date.now() + 25 * 86400000).toISOString(),
    spotlight_until: new Date(Date.now() + 2 * 86400000).toISOString(),
  };
  const [shop, setShop] = useState<ShopRow>(fallback);
  useEffect(() => {
    // 1) Prüfe zuerst, ob der eingeloggte User einen eigenen approved Shop hat
    fetch("/api/shop/my").then((r) => r.json()).then((d: { shops?: ShopRow[] }) => {
      const owned = (d.shops ?? []).find((s) => s.status === "approved");
      if (owned) {
        setShop(owned);
        return;
      }
      // 2) Fallback: Demo-Shop aus der DB (für Preview-Zwecke)
      sb.from("local_businesses").select("*").eq("id", fallbackId).maybeSingle()
        .then(({ data }) => { if (data) setShop(data as ShopRow); });
    }).catch(() => { /* fallback bleibt */ });
  }, [fallbackId, reloadTick, sb]);
  return [shop, () => setReloadTick((t) => t + 1)];
}

export default function ShopDashboardPage() {
  const [tab, setTab] = useState<SubTab>("overview");
  const [shop, reloadShop] = useShop(DEMO_SHOP.id);

  const monthlyRedemptions = DEMO_STATS.checkinsMonth ?? 0;
  const flashCredits = shop.flash_push_credits ?? 0;

  return (
    <div style={{
      minHeight: "100vh", paddingBottom: 40,
      background: "radial-gradient(circle at 20% 10%, #1a2340 0%, #0F1115 60%)",
    }}>
      {/* Status-Banner (kein Shop / pending / rejected / Onboarding-Checkliste) */}
      <div style={{ paddingTop: 16 }}>
        <ShopOnboardingBanner />
        <ShopUpsellBanner
          plan={shop.plan as "free"|"basis"|"pro"|"ultra"|undefined}
          monthlyRedemptions={monthlyRedemptions}
          flashCredits={flashCredits}
        />
      </div>
      {/* Header */}
      <header style={{
        padding: "24px 20px 0", maxWidth: 1200, margin: "0 auto",
      }}>
        <div style={{ display: "flex", gap: 14, alignItems: "center", marginBottom: 12, flexWrap: "wrap" }}>
          <Link href="/dashboard/" style={{
            color: PRIMARY, textDecoration: "none", fontSize: 13, fontWeight: 700,
          }}>← zurück zur Runner-App</Link>
          <span style={{ color: BORDER, fontSize: 12 }}>·</span>
          <Link href={`/shop/${shop.id}/qr`} style={{ color: MUTED, textDecoration: "none", fontSize: 12, fontWeight: 700 }}>
            🔲 QR-Code drucken
          </Link>
          <span style={{ color: BORDER, fontSize: 12 }}>·</span>
          <Link href="/shop/billing" style={{ color: MUTED, textDecoration: "none", fontSize: 12, fontWeight: 700 }}>
            💳 Abrechnung & Paket
          </Link>
        </div>

        <div style={{
          background: `linear-gradient(135deg, ${DEMO_SHOP.planColor}22 0%, rgba(20, 26, 44, 0.85) 100%)`,
          borderRadius: 20, padding: 20,
          border: `1px solid ${DEMO_SHOP.planColor}55`,
          display: "flex", flexWrap: "wrap", gap: 16, alignItems: "center",
        }}>
          <div style={{
            width: 64, height: 64, borderRadius: 16,
            background: `linear-gradient(135deg, ${DEMO_SHOP.planColor}, ${DEMO_SHOP.planColor}aa)`,
            color: BG_DEEP, display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 30, fontWeight: 900,
            boxShadow: `0 4px 18px ${DEMO_SHOP.planColor}66`,
          }}>
            ☕
          </div>
          <div style={{ flex: 1, minWidth: 220 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              <div style={{ color: "#FFF", fontSize: 22, fontWeight: 900 }}>{DEMO_SHOP.name}</div>
              {DEMO_SHOP.verified && <span style={{
                background: "#4ade8022", border: "1px solid #4ade8066",
                color: "#4ade80", padding: "2px 7px", borderRadius: 8,
                fontSize: 10, fontWeight: 900,
              }}>✓ VERIFIZIERT</span>}
              <span style={{
                background: `${DEMO_SHOP.planColor}22`, border: `1px solid ${DEMO_SHOP.planColor}55`,
                color: DEMO_SHOP.planColor, padding: "2px 8px", borderRadius: 8,
                fontSize: 10, fontWeight: 900,
              }}>🏆 {DEMO_SHOP.plan.toUpperCase()}-PAKET</span>
            </div>
            <div style={{ color: MUTED, fontSize: 12, marginTop: 3 }}>
              👤 {DEMO_SHOP.owner} · 📍 {DEMO_SHOP.address} · ⭐ {DEMO_SHOP.rating}/5
            </div>
          </div>
          <div style={{ textAlign: "right" }}>
            <div style={{ color: "#FFF", fontSize: 26, fontWeight: 900 }}>
              {DEMO_STATS.checkinsToday}
            </div>
            <div style={{ color: MUTED, fontSize: 11, fontWeight: 700 }}>CHECK-INS HEUTE</div>
          </div>
        </div>
      </header>

      {/* Tabs */}
      <nav style={{
        maxWidth: 1200, margin: "14px auto 0", padding: "0 20px",
        borderBottom: `1px solid ${BORDER}`,
      }}>
        <div style={{ display: "flex", gap: 4, overflowX: "auto", scrollbarWidth: "none" }}>
          {([
            { id: "overview",    label: "Übersicht",    icon: "🏠" },
            { id: "deals",       label: "Deals",        icon: "🎁" },
            { id: "quests",      label: "Quests",       icon: "🎯" },
            { id: "flash",       label: "Flash-Deals",  icon: "⚡" },
            { id: "spotlight",   label: "Spotlight",    icon: "🏆" },
            { id: "customers",   label: "Stammkunden",  icon: "🧑‍🤝‍🧑" },
            { id: "performance", label: "Performance",  icon: "📊" },
            { id: "settings",    label: "Einstellungen", icon: "⚙️" },
          ] as { id: SubTab; label: string; icon: string }[]).map((t) => {
            const active = tab === t.id;
            return (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                style={{
                  padding: "10px 14px", borderRadius: "12px 12px 0 0",
                  background: active ? CARD : "transparent",
                  border: "none",
                  borderBottom: active ? `2px solid ${DEMO_SHOP.planColor}` : "2px solid transparent",
                  color: active ? "#FFF" : MUTED,
                  fontSize: 12, fontWeight: 800, cursor: "pointer",
                  display: "flex", alignItems: "center", gap: 5, whiteSpace: "nowrap",
                }}
              >
                <span>{t.icon}</span>
                <span>{t.label}</span>
              </button>
            );
          })}
        </div>
      </nav>

      <main style={{ maxWidth: 1200, margin: "0 auto", padding: "20px" }}>
        {tab === "overview"    && <OverviewTab />}
        {tab === "deals"       && <DealsTab shopId={shop.id} />}
        {tab === "quests"      && <ShopQuestsManager businessId={shop.id} />}
        {tab === "flash"       && <FlashTab shop={shop} reloadShop={reloadShop} />}
        {tab === "spotlight"   && <SpotlightTab shop={shop} reloadShop={reloadShop} />}
        {tab === "customers"   && <CustomersTab />}
        {tab === "performance" && <PerformanceTab shop={shop} />}
        {tab === "settings"    && <SettingsTab shop={shop} reloadShop={reloadShop} />}
      </main>
    </div>
  );
}

/* ═══ Overview ═══ */
function OverviewTab() {
  const net = DEMO_STATS.revenueMonth - DEMO_STATS.costMonth;
  const [showShop, setShowShop] = useState(false);
  const [shopPreselect, setShopPreselect] = useState<"plans" | "boosts" | "marketing" | "analytics">("boosts");
  const openShop = (tab: "plans" | "boosts" | "marketing" | "analytics") => {
    setShopPreselect(tab);
    setShowShop(true);
  };
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

      {/* ═══ SICHTBARKEIT-HERO — die 3 umsatzträchtigsten Aktionen ═══ */}
      <div style={{
        padding: 18, borderRadius: 18,
        background: "linear-gradient(135deg, rgba(255,215,0,0.12), rgba(168,85,247,0.1), rgba(255,45,120,0.1))",
        border: "1px solid rgba(255,215,0,0.3)",
        boxShadow: "0 6px 30px rgba(255,215,0,0.12)",
      }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 14, flexWrap: "wrap" }}>
          <div>
            <div style={{ color: "#FFD700", fontSize: 11, fontWeight: 900, letterSpacing: 1.5 }}>🚀 MEHR LAUFKUNDSCHAFT</div>
            <div style={{ color: "#FFF", fontSize: 18, fontWeight: 900, marginTop: 4 }}>Jetzt mehr Runner in deinen Laden bringen</div>
            <div style={{ color: MUTED, fontSize: 12, marginTop: 2 }}>Die 3 wirkungsvollsten Hebel für dein Café · direkt buchbar</div>
          </div>
          <button
            onClick={() => openShop("plans")}
            style={{
              padding: "10px 18px", borderRadius: 12,
              background: "#FFD700", color: "#0F1115", border: "none", cursor: "pointer",
              fontSize: 13, fontWeight: 900, whiteSpace: "nowrap",
            }}
          >
            Alle Pläne ansehen →
          </button>
        </div>

        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          gap: 12,
        }}>
          <HeroAction
            icon="⚡"
            title="Flash-Deal-Push"
            subtitle="30-Min Push an alle Runner im 1 km"
            price="9 €"
            color="#22D1C3"
            onClick={() => openShop("boosts")}
          />
          <HeroAction
            icon="⭐"
            title="Spotlight 3 Tage"
            subtitle="Gold-Pin + Pulse · platz #1 im Kiez"
            price="19 €"
            color="#FF2D78"
            featured
            onClick={() => openShop("boosts")}
          />
          <HeroAction
            icon="📡"
            title="Radius-Boost 7 Tage"
            subtitle="Sichtbar im 5 km statt 500 m Umkreis"
            price="49 €"
            color="#FFD700"
            onClick={() => openShop("boosts")}
          />
        </div>
      </div>

      {/* ═══ Live-Einlösungen (Kassa) ═══ */}
      <ShopRedemptionsLive businessId={DEMO_SHOP.id} />

      {/* ═══ Arena-Panel ═══ */}
      <ShopArenaPanel
        businessId={DEMO_SHOP.id}
        onBuyArena={(sku) => { setShowShop(true); void sku; }}
      />

      {/* ═══ Plan-Status-Card ═══ */}
      <div style={{
        padding: 14, borderRadius: 14,
        background: "rgba(34, 209, 195, 0.08)",
        border: "1px solid rgba(34, 209, 195, 0.35)",
        display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap",
      }}>
        <div style={{ fontSize: 28 }}>💎</div>
        <div style={{ flex: 1, minWidth: 180 }}>
          <div style={{ color: "#22D1C3", fontSize: 11, fontWeight: 900, letterSpacing: 1 }}>AKTUELLER PLAN · PRO</div>
          <div style={{ color: "#FFF", fontSize: 14, fontWeight: 800, marginTop: 2 }}>
            3 Deal-Slots · Flash-Deals · Analytics · Verifiziert-Badge
          </div>
          <div style={{ color: MUTED, fontSize: 11, marginTop: 2 }}>Verlängert am 18.05.2026 · 79 €/Monat</div>
        </div>
        <button
          onClick={() => openShop("plans")}
          style={{
            padding: "8px 14px", borderRadius: 10,
            background: "linear-gradient(135deg, #FFD700, #FF6B4A)", color: "#0F1115",
            border: "none", cursor: "pointer",
            fontSize: 12, fontWeight: 900,
          }}
        >
          🚀 Auf Ultra upgraden
        </button>
      </div>

      {/* KPIs */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
        gap: 10,
      }}>
        <KpiCard icon="📍" value={DEMO_STATS.checkinsToday.toString()} label="Check-ins heute" accent={PRIMARY} />
        <KpiCard icon="📅" value={DEMO_STATS.checkinsWeek.toString()} label="diese Woche" accent="#5ddaf0" />
        <KpiCard icon="📈" value={DEMO_STATS.checkinsMonth.toString()} label="diesen Monat" accent="#FFD700" />
        <KpiCard icon="🧑‍🤝‍🧑" value={DEMO_STATS.newCustomersMonth.toString()} label="Neu-Kund:innen (Monat)" accent="#a855f7" />
        <KpiCard icon="🔁" value={`${DEMO_STATS.repeatRate} %`} label="Wiederkehrer-Rate" accent="#4ade80" />
        <KpiCard icon="🛒" value={`${DEMO_STATS.avgBasket.toFixed(2)} €`} label="Ø Warenkorb" accent="#FF6B4A" />
      </div>

      {/* Revenue Block */}
      <div style={{
        display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 10,
      }}>
        <MoneyCard label="Geschätzter Umsatz (Monat)" value={DEMO_STATS.revenueMonth} color="#FFD700" icon="💰" />
        <MoneyCard label="MyArea-Kosten (Monat)"       value={DEMO_STATS.costMonth} color="#ef7169" icon="💳" negative />
        <MoneyCard label="Netto-Plus"                  value={net} color="#4ade80" icon="📈" highlight />
      </div>

      {/* Map-Rang */}
      <div style={{
        background: CARD, borderRadius: 14, padding: 14, border: `1px solid ${BORDER}`,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ fontSize: 28 }}>🏅</div>
          <div style={{ flex: 1 }}>
            <div style={{ color: "#FFF", fontSize: 15, fontWeight: 900 }}>
              Platz #{DEMO_STATS.rankInZip} unter {DEMO_STATS.totalShopsInZip} Shops in PLZ 13435
            </div>
            <div style={{ color: MUTED, fontSize: 12, marginTop: 2 }}>
              Du bist in den Top 25% — Spotlight-Termin setzen pusht dich weiter.
            </div>
          </div>
          <div style={{
            background: "#FFD70022", border: "1px solid #FFD70066",
            padding: "6px 12px", borderRadius: 10,
            color: "#FFD700", fontSize: 12, fontWeight: 900,
          }}>
            TOP 25%
          </div>
        </div>
      </div>

      {/* Quick-Actions */}
      <div>
        <div style={{ color: MUTED, fontSize: 11, fontWeight: 800, letterSpacing: 0.5, marginBottom: 10 }}>
          SCHNELL-AKTIONEN
        </div>
        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
          gap: 10,
        }}>
          <QuickAction icon="🎁" title="Neuen Deal anlegen"      desc="Rabatt, Gratis-Artikel, Upgrade"        accent="#FFD700" onClick={() => appAlert("Neuer Deal")} />
          <QuickAction icon="📢" title="Social-Post erstellen"   desc="Fertige IG/TikTok-Grafik · 9,90 €/Mo"   accent="#a855f7" onClick={() => openShop("marketing")} />
          <QuickAction icon="📊" title="Analytics-Pro"            desc="Heatmap · Demografie · 39 €/Mo"         accent="#5ddaf0" onClick={() => openShop("analytics")} />
          <QuickAction icon="🎪" title="Event veranstalten"       desc="Lauf-Event mit Teilnehmer-Liste · 59 €" accent="#4ade80" onClick={() => openShop("boosts")} />
        </div>
      </div>
      {showShop && (
        <ShopProductsModal businessId={DEMO_SHOP.id} initialTab={shopPreselect} onClose={() => setShowShop(false)} />
      )}
    </div>
  );
}

function KpiCard({ icon, value, label, accent }: { icon: string; value: string; label: string; accent: string }) {
  return (
    <div style={{
      background: CARD, borderRadius: 14, padding: "12px 14px",
      border: `1px solid ${BORDER}`,
      display: "flex", alignItems: "center", gap: 10,
    }}>
      <div style={{
        width: 40, height: 40, borderRadius: 10,
        background: `${accent}22`, border: `1px solid ${accent}55`,
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: 20,
      }}>{icon}</div>
      <div>
        <div style={{ color: "#FFF", fontSize: 20, fontWeight: 900, lineHeight: 1 }}>{value}</div>
        <div style={{ color: MUTED, fontSize: 11, fontWeight: 700, marginTop: 3 }}>{label}</div>
      </div>
    </div>
  );
}

function MoneyCard({ label, value, color, icon, negative, highlight }: {
  label: string; value: number; color: string; icon: string; negative?: boolean; highlight?: boolean;
}) {
  const sign = negative ? "−" : highlight ? "+" : "";
  return (
    <div style={{
      background: highlight ? `linear-gradient(135deg, ${color}22 0%, ${CARD} 100%)` : CARD,
      borderRadius: 14, padding: 14,
      border: `1px solid ${highlight ? color + "88" : BORDER}`,
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, color: MUTED, fontSize: 11, fontWeight: 700 }}>
        <span>{icon}</span>
        <span>{label}</span>
      </div>
      <div style={{
        color, fontSize: 26, fontWeight: 900, marginTop: 6,
        textShadow: highlight ? `0 0 10px ${color}55` : "none",
      }}>
        {sign}{value.toLocaleString("de-DE")} €
      </div>
    </div>
  );
}

function HeroAction({ icon, title, subtitle, price, color, featured, onClick }: {
  icon: string; title: string; subtitle: string; price: string; color: string; featured?: boolean; onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        position: "relative",
        padding: 16, borderRadius: 16,
        background: featured
          ? `linear-gradient(135deg, ${color}44, ${color}22)`
          : `linear-gradient(135deg, ${color}22, ${color}0a)`,
        border: `1px solid ${featured ? color : `${color}55`}`,
        boxShadow: featured ? `0 4px 20px ${color}44` : "none",
        cursor: "pointer", textAlign: "left", color: "#FFF",
        display: "flex", flexDirection: "column", gap: 8,
        transition: "transform 0.15s",
      }}
      onMouseEnter={(e) => (e.currentTarget.style.transform = "translateY(-2px)")}
      onMouseLeave={(e) => (e.currentTarget.style.transform = "none")}
    >
      {featured && (
        <div style={{
          position: "absolute", top: 10, right: 10,
          background: color, color: "#0F1115",
          fontSize: 9, fontWeight: 900, letterSpacing: 0.5,
          padding: "2px 7px", borderRadius: 999,
        }}>BESTSELLER</div>
      )}
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <div style={{ fontSize: 28 }}>{icon}</div>
        <div style={{ fontSize: 15, fontWeight: 900 }}>{title}</div>
      </div>
      <div style={{ color: "#d6ddeb", fontSize: 12, lineHeight: 1.4, flex: 1 }}>{subtitle}</div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 4 }}>
        <span style={{ color, fontSize: 20, fontWeight: 900 }}>{price}</span>
        <span style={{
          padding: "6px 12px", borderRadius: 8,
          background: color, color: "#0F1115",
          fontSize: 11, fontWeight: 900,
        }}>Jetzt buchen →</span>
      </div>
    </button>
  );
}

function QuickAction({ icon, title, desc, accent, onClick }: {
  icon: string; title: string; desc: string; accent: string; onClick: () => void;
}) {
  return (
    <button onClick={onClick} style={{
      background: CARD, borderRadius: 14, padding: 14,
      border: `1px solid ${BORDER}`, borderLeft: `3px solid ${accent}`,
      cursor: "pointer", textAlign: "left", color: "#FFF",
    }}>
      <div style={{ fontSize: 22, marginBottom: 4 }}>{icon}</div>
      <div style={{ fontSize: 13, fontWeight: 900 }}>{title}</div>
      <div style={{ color: MUTED, fontSize: 11, marginTop: 2 }}>{desc}</div>
    </button>
  );
}

/* ═══ Deals ═══ */
type LiveDeal = {
  id: string; shop_id: string; title: string; description: string | null;
  xp_cost: number; frequency: string; active: boolean;
  redemption_count: number | null; max_redemptions: number | null;
  active_until: string | null; created_at: string;
};

function DealsTab({ shopId }: { shopId: string }) {
  const [deals, setDeals] = useState<LiveDeal[] | null>(null);
  const [editing, setEditing] = useState<LiveDeal | null>(null);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    const res = await fetch(`/api/shop/deals?shop_id=${encodeURIComponent(shopId)}`, { cache: "no-store" });
    const j = await res.json();
    setDeals(j.deals ?? []);
  }
  useEffect(() => { void load(); }, [shopId]); // eslint-disable-line react-hooks/exhaustive-deps

  async function toggleActive(d: LiveDeal) {
    setError(null);
    const res = await fetch("/api/shop/deals", {
      method: "PATCH", headers: { "content-type": "application/json" },
      body: JSON.stringify({ id: d.id, active: !d.active }),
    });
    const j = await res.json();
    if (!j.ok) { setError(j.error ?? "Fehler"); return; }
    void load();
  }

  async function remove(d: LiveDeal) {
    const ok = await appConfirm(`Deal "${d.title}" wirklich löschen?`);
    if (!ok) return;
    const res = await fetch(`/api/shop/deals?id=${d.id}`, { method: "DELETE" });
    const j = await res.json();
    if (!j.ok) { setError(j.error ?? "Fehler"); return; }
    void load();
  }

  if (deals === null) {
    return <div style={{ color: MUTED, fontSize: 13, padding: 20 }}>Lade Deals…</div>;
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <div>
          <div style={{ color: "#FFF", fontSize: 18, fontWeight: 900 }}>Deals verwalten</div>
          <div style={{ color: MUTED, fontSize: 12 }}>{deals.filter((d) => d.active).length} aktiv · {deals.length} insgesamt</div>
        </div>
        <button
          onClick={() => setCreating(true)}
          style={{
            padding: "10px 16px", borderRadius: 12,
            background: PRIMARY, color: BG_DEEP,
            border: "none", fontSize: 13, fontWeight: 900, cursor: "pointer",
          }}
        >
          ➕ Neuer Deal
        </button>
      </div>

      {error && (
        <div style={{ padding: 10, borderRadius: 8, background: "rgba(255,45,120,0.12)", color: "#FF2D78", fontSize: 12 }}>
          ⚠️ {error}
        </div>
      )}

      {deals.length === 0 && !creating && (
        <div style={{ padding: 30, textAlign: "center", background: CARD, borderRadius: 14, border: `1px solid ${BORDER}` }}>
          <div style={{ fontSize: 36, marginBottom: 8 }}>🏷️</div>
          <div style={{ color: "#FFF", fontSize: 14, fontWeight: 900, marginBottom: 4 }}>Noch kein Deal angelegt</div>
          <div style={{ color: MUTED, fontSize: 12 }}>Leg deinen ersten Deal an — Runner bekommen ihn direkt im Shop-POI auf der Karte angezeigt.</div>
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {deals.map((d) => (
          <div key={d.id} style={{
            background: CARD, borderRadius: 14, padding: 14,
            border: `1px solid ${d.active ? PRIMARY + "55" : BORDER}`,
            display: "flex", flexWrap: "wrap", gap: 12, alignItems: "center",
          }}>
            <div style={{ flex: 1, minWidth: 220 }}>
              <div style={{ color: "#FFF", fontSize: 14, fontWeight: 900 }}>{d.title}</div>
              {d.description && <div style={{ color: MUTED, fontSize: 11, marginTop: 2 }}>{d.description}</div>}
              <div style={{ color: MUTED, fontSize: 11, marginTop: 3, display: "flex", gap: 12, flexWrap: "wrap" }}>
                <span>🪙 {d.xp_cost}</span>
                <span>🔁 {FREQ_LABEL_LIVE[d.frequency] ?? d.frequency}</span>
                <span>📈 {d.redemption_count ?? 0} eingelöst</span>
              </div>
            </div>
            <Toggle value={d.active} onChange={() => toggleActive(d)} />
            <button onClick={() => setEditing(d)} style={{
              background: "transparent", border: `1px solid ${BORDER}`,
              padding: "6px 10px", borderRadius: 8, color: "#FFF",
              fontSize: 11, fontWeight: 700, cursor: "pointer",
            }}>✏️ Bearbeiten</button>
            <button onClick={() => remove(d)} style={{
              background: "transparent", border: `1px solid ${ACCENT}44`,
              padding: "6px 10px", borderRadius: 8, color: ACCENT,
              fontSize: 11, fontWeight: 700, cursor: "pointer",
            }}>🗑️</button>
          </div>
        ))}
      </div>

      {(creating || editing) && (
        <DealEditor
          shopId={shopId}
          initial={editing}
          onCancel={() => { setCreating(false); setEditing(null); }}
          onSaved={() => { setCreating(false); setEditing(null); void load(); }}
        />
      )}
    </div>
  );
}

const FREQ_LABEL_LIVE: Record<string, string> = {
  daily:      "1× / Tag",
  weekly:     "1× / Woche",
  monthly:    "1× / Monat",
  quarterly:  "1× / Quartal",
  unlimited:  "Unbegrenzt",
};

function DealEditor({ shopId, initial, onCancel, onSaved }: {
  shopId: string;
  initial: LiveDeal | null;
  onCancel: () => void;
  onSaved: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true); setError(null);
    const fd = new FormData(e.currentTarget);
    const body = {
      title:       String(fd.get("title") ?? "").trim(),
      description: String(fd.get("description") ?? "").trim() || null,
      xp_cost:     Number(fd.get("xp_cost") ?? 0),
      frequency:   String(fd.get("frequency") ?? "weekly"),
    };

    const url = "/api/shop/deals";
    const method = initial ? "PATCH" : "POST";
    const payload = initial
      ? { id: initial.id, ...body }
      : { shop_id: shopId, ...body };

    const res = await fetch(url, {
      method, headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });
    setBusy(false);
    const j = await res.json();
    if (!j.ok) { setError(j.error ?? "Fehler"); return; }
    onSaved();
  }

  return (
    <form onSubmit={submit} style={{
      marginTop: 4, padding: 16, borderRadius: 14,
      background: "#1A1D23", border: `1px solid ${PRIMARY}55`,
    }}>
      <div style={{ color: PRIMARY, fontSize: 11, fontWeight: 900, letterSpacing: 2, marginBottom: 10 }}>
        {initial ? "DEAL BEARBEITEN" : "NEUER DEAL"}
      </div>
      <label style={LBL}>
        <span>Titel *</span>
        <input name="title" required defaultValue={initial?.title ?? ""} placeholder="Gratis Cappuccino ab 3 km Lauf"
          style={INP} />
      </label>
      <label style={LBL}>
        <span>Beschreibung (optional)</span>
        <textarea name="description" rows={2} defaultValue={initial?.description ?? ""}
          style={INP} />
      </label>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        <label style={LBL}>
          <span>Wegemünzen-Kosten 🪙</span>
          <input name="xp_cost" type="number" min={0} defaultValue={initial?.xp_cost ?? 300}
            style={INP} />
        </label>
        <label style={LBL}>
          <span>Häufigkeit</span>
          <select name="frequency" defaultValue={initial?.frequency ?? "weekly"} style={INP}>
            <option value="daily">Täglich</option>
            <option value="weekly">1× pro Woche</option>
            <option value="monthly">1× pro Monat</option>
            <option value="quarterly">1× pro Quartal</option>
            <option value="unlimited">Unbegrenzt</option>
          </select>
        </label>
      </div>

      {error && <div style={{ marginTop: 10, color: ACCENT, fontSize: 12 }}>⚠️ {error}</div>}

      <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
        <button type="button" onClick={onCancel} style={{
          flex: 1, padding: "10px", borderRadius: 10,
          background: "rgba(255,255,255,0.05)", border: `1px solid ${BORDER}`,
          color: "#FFF", fontSize: 12, fontWeight: 700, cursor: "pointer",
        }}>Abbrechen</button>
        <button type="submit" disabled={busy} style={{
          flex: 2, padding: "10px", borderRadius: 10, border: "none",
          background: PRIMARY, color: BG_DEEP,
          fontSize: 13, fontWeight: 900, cursor: "pointer", opacity: busy ? 0.6 : 1,
        }}>{busy ? "Speichert…" : (initial ? "Änderungen speichern" : "Deal anlegen")}</button>
      </div>
    </form>
  );
}

const LBL: React.CSSProperties = { display: "flex", flexDirection: "column", gap: 4, fontSize: 11, color: "#a8b4cf", fontWeight: 700, marginBottom: 10 };
const INP: React.CSSProperties = {
  padding: "9px 11px", borderRadius: 8,
  background: "#0F1115", border: "1px solid rgba(255,255,255,0.12)",
  color: "#F0F0F0", fontSize: 13, fontFamily: "inherit",
};

function Toggle({ value, onChange }: { value: boolean; onChange: () => void }) {
  return (
    <button
      onClick={onChange}
      style={{
        width: 46, height: 26, borderRadius: 13,
        background: value ? PRIMARY : "rgba(255,255,255,0.1)",
        border: `1px solid ${value ? PRIMARY : BORDER}`,
        cursor: "pointer", position: "relative", transition: "all 0.2s",
      }}
    >
      <span style={{
        position: "absolute", top: 2, left: value ? 22 : 2,
        width: 20, height: 20, borderRadius: 10, background: "#FFF",
        transition: "left 0.2s",
      }} />
    </button>
  );
}

/* ═══ Flash-Deals ═══ */
function FlashTab({ shop, reloadShop }: { shop: ShopRow; reloadShop: () => void }) {
  const [pct, setPct] = useState(30);
  const [mins, setMins] = useState(30);
  const [title, setTitle] = useState("Nächste 30 Min: −30% auf Heißgetränke");

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      <div style={{
        background: `linear-gradient(135deg, ${PRIMARY}22 0%, ${CARD} 100%)`,
        borderRadius: 18, padding: 20, border: `1px solid ${PRIMARY}55`,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
          <span style={{ fontSize: 28 }}>⚡</span>
          <div>
            <div style={{ color: "#FFF", fontSize: 18, fontWeight: 900 }}>Flash-Deal jetzt starten</div>
            <div style={{ color: MUTED, fontSize: 12 }}>Push an alle Runner im 1 km-Radius — sofort aktiv</div>
          </div>
        </div>
        <Label>Titel</Label>
        <input
          value={title} onChange={(e) => setTitle(e.target.value)}
          style={inputStyle}
        />
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 12 }}>
          <div>
            <Label>Rabatt</Label>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {[10, 20, 30, 50, 100].map((p) => (
                <button key={p} onClick={() => setPct(p)} style={{
                  padding: "6px 12px", borderRadius: 10,
                  background: pct === p ? PRIMARY : "rgba(0,0,0,0.25)",
                  color: pct === p ? BG_DEEP : "#FFF",
                  border: `1px solid ${pct === p ? PRIMARY : BORDER}`,
                  fontSize: 12, fontWeight: 800, cursor: "pointer",
                }}>{p === 100 ? "Gratis" : `−${p}%`}</button>
              ))}
            </div>
          </div>
          <div>
            <Label>Dauer</Label>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {[15, 30, 60, 120].map((m) => (
                <button key={m} onClick={() => setMins(m)} style={{
                  padding: "6px 12px", borderRadius: 10,
                  background: mins === m ? PRIMARY : "rgba(0,0,0,0.25)",
                  color: mins === m ? BG_DEEP : "#FFF",
                  border: `1px solid ${mins === m ? PRIMARY : BORDER}`,
                  fontSize: 12, fontWeight: 800, cursor: "pointer",
                }}>{m} Min</button>
              ))}
            </div>
          </div>
        </div>
        <button
          onClick={() => appAlert(`Flash-Deal "${title}" wird an ~${Math.floor(pct * 12)} Runner in der Nähe gepusht`)}
          style={{
            marginTop: 16, width: "100%",
            padding: "14px 20px", borderRadius: 12,
            background: PRIMARY, color: BG_DEEP,
            border: "none", fontSize: 14, fontWeight: 900, cursor: "pointer",
          }}
        >
          🚀 Jetzt pushen
        </button>
      </div>

      <div>
        <div style={{ color: MUTED, fontSize: 11, fontWeight: 800, letterSpacing: 0.5, marginBottom: 10 }}>
          LETZTE FLASH-DEALS
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {DEMO_FLASH_DEALS.map((f) => (
            <div key={f.id} style={{
              background: CARD, borderRadius: 12, padding: 12,
              border: `1px solid ${BORDER}`,
            }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
                <div style={{ flex: 1, minWidth: 200 }}>
                  <div style={{ color: "#FFF", fontSize: 13, fontWeight: 900 }}>{f.title}</div>
                  <div style={{ color: MUTED, fontSize: 11, marginTop: 3 }}>
                    {f.status === "scheduled" ? `⏰ Startet ${relTime(f.scheduledAt)}` : f.status === "active" ? "🔴 LIVE" : `✓ Beendet ${relTime(f.scheduledAt)}`}
                  </div>
                </div>
                {f.status === "done" && (
                  <div style={{ display: "flex", gap: 10, fontSize: 11 }}>
                    <Stat label="Pushes" value={f.pushedTo.toString()} />
                    <Stat label="Einlösungen" value={f.converted.toString()} color="#4ade80" />
                    <Stat label="CVR" value={`${Math.round((f.converted / f.pushedTo) * 100)}%`} color="#FFD700" />
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      <FlashPushPanel shop={shop} onUsed={reloadShop} />
    </div>
  );
}

function Stat({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div style={{ textAlign: "right" }}>
      <div style={{ color: color || "#FFF", fontSize: 13, fontWeight: 900 }}>{value}</div>
      <div style={{ color: MUTED, fontSize: 10 }}>{label}</div>
    </div>
  );
}

/* ═══ Spotlight ═══ */
function SpotlightTab({ shop, reloadShop }: { shop: ShopRow; reloadShop: () => void }) {
  const [selectedDays, setSelectedDays] = useState<Set<string>>(new Set(["2026-04-20", "2026-04-21", "2026-04-27"]));
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDayOfMonth = new Date(year, month, 1).getDay();
  const offset = (firstDayOfMonth + 6) % 7; // Mo=0

  function toggleDay(key: string) {
    setSelectedDays((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else if (next.size >= 3) {
        appAlert("Maximal 3 Tage pro Monat bei Pro. Upgrade auf Premium für mehr.");
        return prev;
      } else {
        next.add(key);
      }
      return next;
    });
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{
        background: `linear-gradient(135deg, #FFD70022 0%, ${CARD} 100%)`,
        borderRadius: 18, padding: 18, border: `1px solid #FFD70055`,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{ fontSize: 28 }}>🏆</span>
          <div style={{ flex: 1 }}>
            <div style={{ color: "#FFF", fontSize: 17, fontWeight: 900 }}>Spotlight-Tage wählen</div>
            <div style={{ color: MUTED, fontSize: 12, marginTop: 3, lineHeight: 1.5 }}>
              Dein Shop-Pin leuchtet und pulsiert für 24 Stunden auf der Karte. Ideal vor Events,
              am Wochenende oder Launches. <b style={{ color: "#FFD700" }}>3 Tage / Monat inkl. im Pro-Paket.</b>
            </div>
          </div>
        </div>
        <div style={{
          marginTop: 12, padding: "8px 12px", background: "rgba(0,0,0,0.25)", borderRadius: 10,
          display: "flex", justifyContent: "space-between", alignItems: "center",
          fontSize: 12, color: "#FFF",
        }}>
          <span>✨ Gewählt: <b>{selectedDays.size} / 3</b></span>
          <span style={{ color: MUTED }}>{new Date(year, month).toLocaleDateString("de-DE", { month: "long", year: "numeric" })}</span>
        </div>
      </div>

      {/* Kalender */}
      <div style={{
        background: CARD, borderRadius: 16, padding: 16, border: `1px solid ${BORDER}`,
      }}>
        <div style={{
          display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 4,
          fontSize: 10, color: MUTED, fontWeight: 800, letterSpacing: 1,
          textAlign: "center", marginBottom: 8,
        }}>
          {["MO", "DI", "MI", "DO", "FR", "SA", "SO"].map((d) => <div key={d}>{d}</div>)}
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 4 }}>
          {Array.from({ length: offset }).map((_, i) => <div key={`e${i}`} />)}
          {Array.from({ length: daysInMonth }).map((_, i) => {
            const day = i + 1;
            const key = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
            const active = selectedDays.has(key);
            const isToday = now.getFullYear() === year && now.getMonth() === month && now.getDate() === day;
            const isPast = new Date(year, month, day) < new Date(now.getFullYear(), now.getMonth(), now.getDate());
            return (
              <button
                key={key}
                disabled={isPast}
                onClick={() => toggleDay(key)}
                style={{
                  aspectRatio: "1",
                  background: active
                    ? "#FFD70033"
                    : isPast ? "rgba(0,0,0,0.2)" : "rgba(20, 26, 44, 0.6)",
                  border: active
                    ? `2px solid #FFD700`
                    : isToday ? `1px solid ${PRIMARY}` : `1px solid ${BORDER}`,
                  borderRadius: 8, cursor: isPast ? "not-allowed" : "pointer",
                  color: isPast ? MUTED : "#FFF",
                  fontSize: 13, fontWeight: active ? 900 : 600,
                  opacity: isPast ? 0.4 : 1,
                  position: "relative",
                }}
              >
                {day}
                {active && <span style={{
                  position: "absolute", top: 2, right: 2, fontSize: 9,
                }}>🏆</span>}
              </button>
            );
          })}
        </div>
      </div>

      <EventsPanel shop={shop} onUsed={reloadShop} />
      <ChallengesPanel shop={shop} onUsed={reloadShop} />
      <CustomPinPanel shop={shop} onUsed={reloadShop} />
      <QrOrderPanel shop={shop} />
      <ShopTerritoryBonusPanel businessId={shop.id} />
    </div>
  );
}

/* ═══ Stammkunden ═══ */
function CustomersTab() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div>
        <div style={{ color: "#FFF", fontSize: 18, fontWeight: 900 }}>Top-Kund:innen</div>
        <div style={{ color: MUTED, fontSize: 12 }}>Sortiert nach Besuchen diesen Monat · anonymisiert (nur Username)</div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {DEMO_TOP_RUNNERS.map((r, i) => (
          <div key={r.name} style={{
            background: CARD, borderRadius: 14, padding: "10px 14px",
            border: `1px solid ${BORDER}`,
            display: "flex", alignItems: "center", gap: 12,
          }}>
            <span style={{
              color: i === 0 ? "#FFD700" : MUTED,
              fontSize: 14, fontWeight: 900, width: 28, textAlign: "right",
            }}>#{i + 1}</span>
            <div style={{
              width: 36, height: 36, borderRadius: 18,
              background: `${PRIMARY}22`, border: `1px solid ${PRIMARY}55`,
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 18,
            }}>{r.emoji}</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ color: "#FFF", fontSize: 13, fontWeight: 900 }}>@{r.name}</div>
              <div style={{ color: MUTED, fontSize: 11, marginTop: 2 }}>
                {r.visits} Besuche · zuletzt {r.last}
              </div>
            </div>
            <div style={{ textAlign: "right" }}>
              <div style={{ color: "#FFD700", fontSize: 13, fontWeight: 900 }}>
                ~{r.spent} €
              </div>
              <div style={{ color: MUTED, fontSize: 10 }}>geschätzt</div>
            </div>
          </div>
        ))}
      </div>
      <div style={{
        background: `${PRIMARY}11`, border: `1px dashed ${PRIMARY}55`,
        borderRadius: 12, padding: 14, fontSize: 12, color: TEXT_SOFT, lineHeight: 1.5,
      }}>
        💡 <b style={{ color: "#FFF" }}>Stammkunden-Bonus aktiv:</b> Wer ≥ 3× in 30 Tagen kommt, bekommt automatisch ein besseres Angebot.
        Aktuell betrifft das <b style={{ color: PRIMARY }}>5 Kund:innen</b>. Feature deaktivierbar in Einstellungen.
      </div>
    </div>
  );
}

/* ═══ Performance ═══ */
function PerformanceTab({ shop }: { shop: ShopRow }) {
  const weeks = [
    { w: "KW 12", checkins: 38, revenue: 470 },
    { w: "KW 13", checkins: 44, revenue: 545 },
    { w: "KW 14", checkins: 49, revenue: 608 },
    { w: "KW 15", checkins: 52, revenue: 644 },
  ];
  const maxC = Math.max(...weeks.map(w => w.checkins));
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div style={{ color: "#FFF", fontSize: 18, fontWeight: 900 }}>Letzte 4 Wochen</div>
      <div style={{
        background: CARD, borderRadius: 16, padding: 16, border: `1px solid ${BORDER}`,
      }}>
        <div style={{ display: "flex", alignItems: "end", gap: 12, height: 160, paddingBottom: 20 }}>
          {weeks.map((w) => {
            const h = (w.checkins / maxC) * 100;
            return (
              <div key={w.w} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
                <div style={{
                  color: PRIMARY, fontSize: 11, fontWeight: 900,
                }}>{w.checkins}</div>
                <div style={{
                  width: "100%", height: `${h}%`,
                  background: `linear-gradient(180deg, ${PRIMARY}, ${PRIMARY}66)`,
                  borderRadius: "8px 8px 0 0",
                  boxShadow: `0 0 10px ${PRIMARY}55`,
                  minHeight: 10,
                }} />
                <div style={{ color: MUTED, fontSize: 10, fontWeight: 700 }}>{w.w}</div>
              </div>
            );
          })}
        </div>
      </div>
      <div style={{
        display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 10,
      }}>
        <KpiCard icon="📈" value="+37%" label="Check-ins vs. Vormonat" accent="#4ade80" />
        <KpiCard icon="💰" value="2.267 €" label="Umsatz (4 Wochen)" accent="#FFD700" />
        <KpiCard icon="⚡" value="3" label="Flash-Deals gestartet" accent={PRIMARY} />
        <KpiCard icon="🏆" value="2 / 3" label="Spotlight-Tage genutzt" accent="#FF2D78" />
      </div>
      <button
        onClick={() => appAlert("CSV-/DATEV-Export wird generiert …")}
        style={{
          padding: "12px 16px", borderRadius: 12,
          background: "transparent", border: `1px solid ${PRIMARY}`,
          color: PRIMARY, fontSize: 13, fontWeight: 800, cursor: "pointer",
        }}
      >
        📥 Vollständigen Report als CSV / DATEV exportieren
      </button>

      <AnalyticsProPanel shop={shop} />
      <CompetitorPanel shop={shop} />
      <KiezReportPanel shop={shop} />
    </div>
  );
}

/* ═══ Settings ═══ */
function SettingsTab({ shop, reloadShop }: { shop: ShopRow; reloadShop: () => void }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <SettingsBlock title="🏪 Shop-Profil">
        <AccountRow label="Name, Adresse, Kategorie bearbeiten" />
        <AccountRow label="Öffnungszeiten" />
        <AccountRow label="Cover-Bild & Logo hochladen" />
      </SettingsBlock>

      <SettingsBlock title="💳 Abrechnung">
        <AccountRow label="Aktuelles Paket: Pro (2 €/Check-in)" />
        <AccountRow label="Rechnungen / Monats-Abrechnungen" />
        <AccountRow label="Zahlungsmethode: SEPA-Lastschrift" />
        <AccountRow label="Paket wechseln" />
      </SettingsBlock>

      <SettingsBlock title="🤖 Automatisierung">
        <ToggleRow label="🔁 Stammkunden-Bonus ab 3. Besuch" defaultOn />
        <ToggleRow label="📩 Vorbei-Läufer Retargeting-Push" defaultOn />
        <ToggleRow label="🎂 Geburtstags-Special" defaultOn />
        <ToggleRow label="📰 Im monatlichen Kiez-Newsletter erscheinen" defaultOn />
      </SettingsBlock>

      <SettingsBlock title="🔔 Benachrichtigungen">
        <ToggleRow label="E-Mail bei neuem Check-in" />
        <ToggleRow label="Täglicher Performance-Report per Mail" defaultOn />
        <ToggleRow label="Wöchentliches Summary per Mail" defaultOn />
      </SettingsBlock>

      <SettingsBlock title="⚠️ Account">
        <AccountRow label="Passwort ändern" />
        <AccountRow label="Team-Zugang (Filial-Manager hinzufügen)" />
        <AccountRow label="Shop pausieren" />
        <AccountRow label="Shop löschen" danger />
      </SettingsBlock>

      <SocialPanel shop={shop} />
      <EmailPanel shop={shop} onUsed={reloadShop} />
    </div>
  );
}

function SettingsBlock({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <div style={{ color: MUTED, fontSize: 11, fontWeight: 800, letterSpacing: 0.5, marginBottom: 8 }}>
        {title.toUpperCase()}
      </div>
      <div style={{
        background: CARD, borderRadius: 14, overflow: "hidden",
        border: `1px solid ${BORDER}`,
      }}>
        {children}
      </div>
    </div>
  );
}

function AccountRow({ label, danger }: { label: string; danger?: boolean }) {
  return (
    <button
      onClick={() => appAlert(`${label} — Stub`)}
      style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        width: "100%", padding: "14px 16px",
        background: "transparent", border: "none",
        borderBottom: `1px solid ${BORDER}`,
        color: danger ? ACCENT : "#FFF",
        fontSize: 13, fontWeight: 600, cursor: "pointer", textAlign: "left",
      }}
    >
      <span>{label}</span>
      <span style={{ color: MUTED }}>›</span>
    </button>
  );
}

function ToggleRow({ label, defaultOn }: { label: string; defaultOn?: boolean }) {
  const [on, setOn] = useState(!!defaultOn);
  return (
    <div style={{
      display: "flex", alignItems: "center", justifyContent: "space-between",
      padding: "12px 16px", borderBottom: `1px solid ${BORDER}`,
    }}>
      <span style={{ color: "#FFF", fontSize: 13 }}>{label}</span>
      <Toggle value={on} onChange={() => setOn(!on)} />
    </div>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ color: PRIMARY, fontSize: 11, fontWeight: 800, marginBottom: 6, letterSpacing: 0.5 }}>
      {children}
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  background: "rgba(0,0,0,0.25)", color: "#FFF",
  padding: "10px 12px", borderRadius: 10,
  border: `1px solid ${BORDER}`, width: "100%",
  fontSize: 13,
};

function relTime(iso: string): string {
  const diff = new Date(iso).getTime() - Date.now();
  const abs = Math.abs(diff);
  const m = Math.floor(abs / 60000);
  if (m < 60) return diff > 0 ? `in ${m} Min` : `vor ${m} Min`;
  const h = Math.floor(m / 60);
  if (h < 24) return diff > 0 ? `in ${h} Std` : `vor ${h} Std`;
  const d = Math.floor(h / 24);
  return diff > 0 ? `in ${d} T` : `vor ${d} T`;
}
