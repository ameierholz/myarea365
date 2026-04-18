"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { appAlert, appConfirm } from "@/components/app-dialog";

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
  address: "Senftenberger Ring 42, 13435 Berlin",
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

type SubTab = "overview" | "deals" | "flash" | "spotlight" | "customers" | "performance" | "settings";

export default function ShopDashboardPage() {
  const [tab, setTab] = useState<SubTab>("overview");

  return (
    <div style={{
      minHeight: "100vh", paddingBottom: 40,
      background: "radial-gradient(circle at 20% 10%, #1a2340 0%, #0F1115 60%)",
    }}>
      {/* Header */}
      <header style={{
        padding: "24px 20px 0", maxWidth: 1200, margin: "0 auto",
      }}>
        <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 12 }}>
          <Link href="/dashboard/" style={{
            color: PRIMARY, textDecoration: "none", fontSize: 13, fontWeight: 700,
          }}>← zurück zur Runner-App</Link>
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
        {tab === "deals"       && <DealsTab />}
        {tab === "flash"       && <FlashTab />}
        {tab === "spotlight"   && <SpotlightTab />}
        {tab === "customers"   && <CustomersTab />}
        {tab === "performance" && <PerformanceTab />}
        {tab === "settings"    && <SettingsTab />}
      </main>
    </div>
  );
}

/* ═══ Overview ═══ */
function OverviewTab() {
  const net = DEMO_STATS.revenueMonth - DEMO_STATS.costMonth;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
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
          <QuickAction icon="⚡" title="Flash-Deal starten"        desc="Jetzt 30-Min-Push an nahe Runner" accent={PRIMARY} onClick={() => appAlert("Flash-Deal-Wizard")} />
          <QuickAction icon="🎁" title="Neuen Deal anlegen"         desc="Rabatt, Gratis-Artikel, Upgrade" accent="#FFD700" onClick={() => appAlert("Neuer Deal")} />
          <QuickAction icon="🏆" title="Spotlight-Tag buchen"       desc="3 Tage/Monat hervorgehoben"      accent="#FF2D78" onClick={() => appAlert("Spotlight-Kalender")} />
          <QuickAction icon="📢" title="Social-Post erstellen"      desc="Fertige Grafik für Instagram"    accent="#a855f7" onClick={() => appAlert("Social-Kit")} />
        </div>
      </div>
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
function DealsTab() {
  const [deals, setDeals] = useState(DEMO_DEALS);
  const toggleActive = (id: string) => {
    setDeals((ds) => ds.map((d) => d.id === id ? { ...d, active: !d.active } : d));
  };
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <div>
          <div style={{ color: "#FFF", fontSize: 18, fontWeight: 900 }}>Deals verwalten</div>
          <div style={{ color: MUTED, fontSize: 12 }}>{deals.filter((d) => d.active).length} aktiv · {deals.length} insgesamt</div>
        </div>
        <button
          onClick={() => appAlert("Neuen Deal anlegen")}
          style={{
            padding: "10px 16px", borderRadius: 12,
            background: PRIMARY, color: BG_DEEP,
            border: "none", fontSize: 13, fontWeight: 900, cursor: "pointer",
          }}
        >
          ➕ Neuer Deal
        </button>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {deals.map((d) => (
          <div key={d.id} style={{
            background: CARD, borderRadius: 14, padding: 14,
            border: `1px solid ${d.active ? PRIMARY + "55" : BORDER}`,
            display: "flex", flexWrap: "wrap", gap: 12, alignItems: "center",
          }}>
            <div style={{ flex: 1, minWidth: 220 }}>
              <div style={{ color: "#FFF", fontSize: 14, fontWeight: 900 }}>{d.title}</div>
              <div style={{ color: MUTED, fontSize: 11, marginTop: 3, display: "flex", gap: 12, flexWrap: "wrap" }}>
                <span>💎 {d.xp} XP</span>
                <span>🔁 {FREQ_LABEL[d.freq]}</span>
                <span>📈 {d.redemptions_month} Einlösungen / Monat</span>
              </div>
            </div>
            <Toggle value={d.active} onChange={() => toggleActive(d.id)} />
            <button
              onClick={() => appAlert(`Deal "${d.title}" bearbeiten`)}
              style={{
                background: "transparent", border: `1px solid ${BORDER}`,
                padding: "6px 10px", borderRadius: 8, color: "#FFF",
                fontSize: 11, fontWeight: 700, cursor: "pointer",
              }}
            >✏️ Bearbeiten</button>
          </div>
        ))}
      </div>
    </div>
  );
}

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
function FlashTab() {
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
function SpotlightTab() {
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
function PerformanceTab() {
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
    </div>
  );
}

/* ═══ Settings ═══ */
function SettingsTab() {
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
