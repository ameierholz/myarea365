"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { GEM_BUNDLES, totalGemsOfBundle, type GemBundle } from "@/lib/gem-bundles";
import { PIN_THEME_META, ALL_PIN_THEMES, type PinTheme } from "@/lib/pin-themes";

type ShopItem = {
  id: string;
  category: "cosmetic" | "booster" | "convenience" | "arena_pass" | "crew_emblem" | "monthly_pass";
  name: string; description: string; icon: string; price_gems: number;
  duration_hours: number | null; payload: Record<string, unknown>; sort: number;
};
type MonthlyActivePass = {
  purchase_id: string; shop_item_id: string; name: string; icon: string;
  payload: { daily_gems?: number; xp_multiplier?: number; features?: string[] };
  expires_at: string | null; claimed_today: boolean;
};
type Gems = { user_id: string; gems: number; arena_pass_expires_at: string | null; total_purchased: number; total_spent: number };
type Purchase = { id: string; shop_item_id: string; price_paid_gems: number; expires_at: string | null; created_at: string };
type CategoryKey = "monthly_pass" | "booster" | "cosmetic" | "convenience" | "crew_emblem";

type DailyContent = { type: string; amount: number; label: string };
type DailyPack = {
  id: string; sort: number; tier: "bronze" | "silver" | "gold";
  name: string; subtitle: string; icon: string;
  price_gems: number; bonus_gem_badge: number;
  contents: DailyContent[];
  price_cents?: number | null;
  is_bundle?: boolean;
};
type DailyResponse = {
  packs: DailyPack[];
  purchased_today: string[];
  gems: number;
  reset_in_seconds: number;
};

const TIER_META: Record<DailyPack["tier"], { color: string; glow: string; label: string }> = {
  bronze: { color: "#cd7f32", glow: "rgba(205,127,50,0.28)",   label: "BRONZE" },
  silver: { color: "#d8d8d8", glow: "rgba(216,216,216,0.28)",  label: "SILBER" },
  gold:   { color: "#FFD700", glow: "rgba(255,215,0,0.38)",    label: "GOLD"   },
};

const CATEGORY_META: Record<CategoryKey, { label: string; icon: string; accent: string }> = {
  monthly_pass:{ label: "Monatspacks",      icon: "🎫", accent: "#FFD700" },
  booster:     { label: "XP-Booster",       icon: "⚡", accent: "#22D1C3" },
  cosmetic:    { label: "Skins & Designs",  icon: "✨", accent: "#a855f7" },
  convenience: { label: "Komfort",          icon: "🎯", accent: "#5ddaf0" },
  crew_emblem: { label: "Crew-Anpassung",   icon: "🏳️", accent: "#FF6B4A" },
};

export function GemShopBody() {
  return <GemShopInner onClose={() => {}} embedded />;
}

export function GemShopModal({ onClose }: { onClose: () => void }) {
  return <GemShopInner onClose={onClose} embedded={false} />;
}

type GemTab = "home" | "passes" | "boosters" | "skins" | "crew";

const GEM_TABS: { id: GemTab; label: string; icon: string; color: string }[] = [
  { id: "home",     label: "Start",      icon: "🏠", color: "#FFD700" },
  { id: "passes",   label: "Packs",      icon: "🎫", color: "#FFD700" },
  { id: "boosters", label: "Booster",    icon: "⚡", color: "#22D1C3" },
  { id: "skins",    label: "Skins",      icon: "✨", color: "#a855f7" },
  { id: "crew",     label: "Crew",       icon: "🏳️", color: "#FF6B4A" },
];

function GemShopInner({ onClose, embedded }: { onClose: () => void; embedded: boolean }) {
  const [gemTab, setGemTab] = useState<GemTab>("home");
  const [items, setItems] = useState<ShopItem[]>([]);
  const [gems, setGems] = useState<Gems | null>(null);
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [daily, setDaily] = useState<DailyResponse | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [resetIn, setResetIn] = useState<number>(0);

  const [monthlyActive, setMonthlyActive] = useState<MonthlyActivePass[]>([]);
  const [pinThemeActive, setPinThemeActive] = useState<PinTheme>("default");
  const [pinThemesUnlocked, setPinThemesUnlocked] = useState<Set<string>>(new Set(["default"]));

  const load = useCallback(async () => {
    const [s, d, m, p] = await Promise.all([
      fetch("/api/shop/gems").then((r) => r.ok ? r.json() : null),
      fetch("/api/shop/daily").then((r) => r.ok ? r.json() : null),
      fetch("/api/shop/monthly").then((r) => r.ok ? r.json() : null),
      fetch("/api/shop/pin-theme").then((r) => r.ok ? r.json() : null),
    ]);
    if (s) { setItems(s.items ?? []); setGems(s.gems ?? null); setPurchases(s.purchases ?? []); }
    if (d) { setDaily(d as DailyResponse); setResetIn(d.reset_in_seconds ?? 0); }
    if (m) { setMonthlyActive((m.active_passes ?? []) as MonthlyActivePass[]); }
    if (p) {
      setPinThemeActive((p.active ?? "default") as PinTheme);
      setPinThemesUnlocked(new Set((p.unlocked ?? ["default"]) as string[]));
    }
  }, []);
  useEffect(() => { void load(); }, [load]);

  // Countdown zum Reset
  useEffect(() => {
    if (resetIn <= 0) return;
    const id = setInterval(() => setResetIn((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(id);
  }, [resetIn]);

  const grouped = useMemo(() => {
    const map: Record<CategoryKey, ShopItem[]> = { monthly_pass: [], booster: [], cosmetic: [], convenience: [], crew_emblem: [] };
    for (const i of items) {
      // Legacy 'arena_pass' category wird als monthly_pass angezeigt
      const cat = (i.category === "arena_pass" ? "monthly_pass" : i.category) as CategoryKey;
      if (map[cat]) map[cat].push(i);
    }
    return map;
  }, [items]);

  const activePurchaseIds = useMemo(
    () => new Set(purchases.filter((p) => !p.expires_at || new Date(p.expires_at) > new Date()).map((p) => p.shop_item_id)),
    [purchases],
  );

  async function purchase(itemId: string) {
    setBusy(itemId);
    try {
      const res = await fetch("/api/shop/gems", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "purchase", item_id: itemId }),
      });
      const json = await res.json() as { ok?: boolean; error?: string; have?: number; need?: number };
      if (json.ok) { setToast("Kauf erfolgreich!"); await load(); }
      else setToast(json.error === "not_enough_gems" ? `Nicht genug Edelsteine (${json.have}/${json.need})` : (json.error ?? "Kauf fehlgeschlagen"));
    } finally {
      setBusy(null);
      setTimeout(() => setToast(null), 3000);
    }
  }

  async function buyBundle(b: GemBundle) {
    setBusy(b.sku);
    try {
      const res = await fetch("/api/stripe/checkout", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({
          sku: b.sku,
          name: `${totalGemsOfBundle(b)} Edelsteine`,
          amount_cents: b.price_cents,
        }),
      });
      const json = await res.json() as { url?: string; error?: string };
      if (json.url) {
        window.location.href = json.url;
      } else {
        setToast(json.error ?? "Checkout fehlgeschlagen");
        setTimeout(() => setToast(null), 3000);
      }
    } finally { setBusy(null); }
  }

  async function purchaseDaily(packId: string) {
    setBusy(packId);
    try {
      const res = await fetch("/api/shop/daily", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ pack_id: packId }),
      });
      const json = await res.json() as { ok?: boolean; error?: string; have?: number; need?: number };
      if (json.ok) { setToast("🎁 Tages-Pack eingelöst!"); await load(); }
      else setToast(
        json.error === "already_purchased_today" ? "Heute schon gekauft — Reset um 00:00 UTC"
        : json.error === "not_enough_gems" ? `Nicht genug Edelsteine (${json.have}/${json.need})`
        : (json.error ?? "Kauf fehlgeschlagen")
      );
    } finally {
      setBusy(null);
      setTimeout(() => setToast(null), 3000);
    }
  }

  async function claimMonthly(purchaseId: string) {
    setBusy(purchaseId);
    try {
      const res = await fetch("/api/shop/monthly", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ purchase_id: purchaseId }),
      });
      const json = await res.json() as { ok?: boolean; claimed_gems?: number; error?: string };
      if (json.ok) { setToast(`🎁 +${json.claimed_gems} Edelsteine erhalten!`); await load(); }
      else setToast(json.error === "already_claimed_today" ? "Heute schon abgeholt" : (json.error ?? "Fehler"));
    } finally {
      setBusy(null);
      setTimeout(() => setToast(null), 3000);
    }
  }

  async function switchPinTheme(theme: PinTheme) {
    setBusy(`theme_${theme}`);
    try {
      const res = await fetch("/api/shop/pin-theme", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ theme }),
      });
      const json = await res.json() as { ok?: boolean; error?: string };
      if (json.ok) {
        setPinThemeActive(theme);
        setToast(`🎨 Theme „${PIN_THEME_META[theme].name}" aktiv`);
        // Map neu laden damit data-pin-theme gesetzt wird — hartes Reload
        if (typeof window !== "undefined") setTimeout(() => window.location.reload(), 600);
      } else setToast(json.error ?? "Theme-Wechsel fehlgeschlagen");
    } finally {
      setBusy(null);
      setTimeout(() => setToast(null), 3000);
    }
  }

  const resetHours = Math.floor(resetIn / 3600);
  const resetMins = Math.floor((resetIn % 3600) / 60);

  const body = (
    <>
        {/* Sub-Tab-Bar */}
        <div style={{ display: "flex", gap: 2, padding: "8px 12px 0", borderBottom: "1px solid rgba(255,255,255,0.06)", overflowX: "auto" }}>
          {GEM_TABS.map((t) => {
            const active = gemTab === t.id;
            return (
              <button key={t.id} onClick={() => setGemTab(t.id)} style={{
                flexShrink: 0, background: "transparent", border: "none", cursor: "pointer",
                padding: "8px 10px", color: active ? t.color : "#8B8FA3",
                fontSize: 11, fontWeight: 800,
                borderBottom: active ? `2px solid ${t.color}` : "2px solid transparent",
                display: "flex", alignItems: "center", gap: 5,
              }}>
                <span style={{ fontSize: 14 }}>{t.icon}</span>
                {t.label}
              </button>
            );
          })}
          <div style={{ flex: 1 }} />
          <div style={{
            alignSelf: "center", padding: "4px 10px", borderRadius: 999,
            background: "rgba(255,215,0,0.12)", border: "1px solid rgba(255,215,0,0.35)",
            color: "#FFD700", fontSize: 11, fontWeight: 900, display: "flex", alignItems: "center", gap: 4,
          }}>💎 Guthaben: {gems?.gems ?? 0}</div>
        </div>


        {/* Kategorien */}
        <div style={{ flex: 1, overflowY: "auto", padding: "14px 14px 14px" }}>

          {/* 💎 EDELSTEINE KAUFEN */}
          {gemTab === "home" && (
          <section style={{ marginBottom: 16 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
              <span style={{ fontSize: 18 }}>💎</span>
              <div style={{ color: "#FFD700", fontSize: 10, fontWeight: 900, letterSpacing: 1.5 }}>
                EDELSTEINE KAUFEN
              </div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
              {GEM_BUNDLES.map((b) => {
                const total = totalGemsOfBundle(b);
                const badge = b.badge === "best_value" ? { text: "BESTER WERT", color: "#FFD700" }
                  : b.badge === "most_popular" ? { text: "BELIEBT", color: "#FF2D78" }
                  : b.badge === "starter" ? { text: "EINSTEIGER", color: "#22D1C3" }
                  : b.badge === "supporter" ? { text: "💛 GÖNNER", color: "#ff6b9d" } : null;
                return (
                  <button key={b.sku}
                    onClick={() => buyBundle(b)}
                    disabled={busy === b.sku}
                    style={{
                      position: "relative", textAlign: "left", cursor: busy ? "wait" : "pointer",
                      padding: "12px 12px", borderRadius: 12,
                      background: "linear-gradient(135deg, rgba(255,215,0,0.18), rgba(168,85,247,0.1))",
                      border: "1px solid rgba(255,215,0,0.45)",
                      color: "#FFF",
                    }}>
                    {badge && (
                      <div style={{
                        position: "absolute", top: -8, right: -4,
                        padding: "2px 7px", borderRadius: 999,
                        background: badge.color, color: "#0F1115",
                        fontSize: 8, fontWeight: 900, letterSpacing: 1,
                        boxShadow: "0 2px 6px rgba(0,0,0,0.4)",
                      }}>{badge.text}</div>
                    )}
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <div style={{ fontSize: 22 }}>💎</div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 15, fontWeight: 900 }}>
                          {b.gems.toLocaleString("de-DE")}
                          {b.bonus > 0 && (
                            <span style={{ color: "#4ade80", fontSize: 11, marginLeft: 4 }}>
                              +{b.bonus}
                            </span>
                          )}
                        </div>
                        <div style={{ color: "#a8b4cf", fontSize: 9 }}>
                          = {total.toLocaleString("de-DE")} Edelsteine
                        </div>
                      </div>
                      <div style={{ color: "#FFD700", fontSize: 13, fontWeight: 900 }}>
                        {(b.price_cents / 100).toFixed(2)}€
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
            <div style={{ color: "#8B8FA3", fontSize: 9, marginTop: 6, textAlign: "center" }}>
              Sichere Zahlung via Stripe · Edelsteine werden sofort gutgeschrieben
            </div>
          </section>
          )}


          {/* 🎫 AKTIVE MONATSPACKS (Daily Claim) */}
          {gemTab === "passes" && monthlyActive.length > 0 && (
            <section style={{ marginBottom: 16 }}>
              <div style={{ color: "#FFD700", fontSize: 10, fontWeight: 900, letterSpacing: 1.5, marginBottom: 6 }}>
                🎫 AKTIVE MONATSPACKS
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {monthlyActive.map((p) => {
                  const canClaim = !p.claimed_today;
                  const daily = p.payload.daily_gems ?? 0;
                  const xpMult = p.payload.xp_multiplier;
                  const expiresDate = p.expires_at ? new Date(p.expires_at).toLocaleDateString("de-DE") : null;
                  return (
                    <div key={p.purchase_id} style={{
                      padding: 10, borderRadius: 12,
                      background: "linear-gradient(135deg, rgba(255,215,0,0.18), rgba(168,85,247,0.08))",
                      border: "1px solid rgba(255,215,0,0.4)",
                      display: "flex", alignItems: "center", gap: 10,
                    }}>
                      <div style={{ fontSize: 28 }}>{p.icon}</div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ color: "#FFF", fontSize: 12, fontWeight: 900 }}>{p.name}</div>
                        <div style={{ color: "#a8b4cf", fontSize: 10, marginTop: 1 }}>
                          {daily > 0 && `💎 ${daily}/Tag`}
                          {xpMult && ` · ⚡ ${xpMult}× XP`}
                          {expiresDate && ` · bis ${expiresDate}`}
                        </div>
                      </div>
                      <button
                        onClick={() => canClaim && claimMonthly(p.purchase_id)}
                        disabled={!canClaim || busy === p.purchase_id}
                        style={{
                          padding: "7px 11px", borderRadius: 10,
                          background: canClaim ? "linear-gradient(135deg, #FFD700, #FF6B4A)" : "rgba(74,222,128,0.15)",
                          color: canClaim ? "#0F1115" : "#4ade80",
                          border: canClaim ? "none" : "1px solid rgba(74,222,128,0.4)",
                          fontSize: 10, fontWeight: 900,
                          cursor: canClaim ? "pointer" : "not-allowed", whiteSpace: "nowrap",
                        }}>
                        {canClaim ? `🎁 +${daily} abholen` : "✓ heute geholt"}
                      </button>
                    </div>
                  );
                })}
              </div>
            </section>
          )}

          {/* 🎨 RUNNER-PIN-THEME PICKER */}
          {gemTab === "skins" && (
          <section style={{ marginBottom: 16 }}>
            <div style={{ color: "#a855f7", fontSize: 10, fontWeight: 900, letterSpacing: 1.5, marginBottom: 6 }}>
              🎨 RUNNER-PIN
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 6 }}>
              {ALL_PIN_THEMES.map((tid) => {
                const t = PIN_THEME_META[tid];
                const unlocked = pinThemesUnlocked.has(tid);
                const active = pinThemeActive === tid;
                return (
                  <button key={tid}
                    onClick={() => unlocked && !active && switchPinTheme(tid)}
                    disabled={!unlocked || active || busy === `theme_${tid}`}
                    style={{
                      padding: 8, borderRadius: 10, cursor: unlocked && !active ? "pointer" : "default",
                      background: `linear-gradient(135deg, ${t.preview.bg}, rgba(15,17,21,0.9))`,
                      border: `2px solid ${active ? t.preview.accent : unlocked ? `${t.preview.accent}44` : "rgba(255,255,255,0.08)"}`,
                      boxShadow: active ? `0 0 14px ${t.preview.glow}` : "none",
                      color: "#FFF", textAlign: "center", opacity: unlocked ? 1 : 0.55,
                      position: "relative",
                    }}>
                    {active && (
                      <div style={{
                        position: "absolute", top: -6, right: -4,
                        padding: "2px 6px", borderRadius: 999,
                        background: "#4ade80", color: "#0F1115",
                        fontSize: 7, fontWeight: 900, letterSpacing: 0.5,
                      }}>AKTIV</div>
                    )}
                    <div style={{ fontSize: 22 }}>{t.icon}</div>
                    <div style={{ color: t.preview.accent, fontSize: 10, fontWeight: 900, marginTop: 2 }}>
                      {t.name.toUpperCase()}
                    </div>
                    {!unlocked && (
                      <div style={{ fontSize: 8, color: "#8B8FA3", marginTop: 1 }}>🔒 kaufen</div>
                    )}
                  </button>
                );
              })}
            </div>
            <div style={{ color: "#8B8FA3", fontSize: 9, marginTop: 6, textAlign: "center" }}>
              Verziert deinen eigenen Runner-Pin auf der Karte · Shop- und Boss-Pins bleiben neutral
            </div>
          </section>
          )}

          {/* 🔥 TÄGLICHE ANGEBOTE */}
          {gemTab === "home" && daily && daily.packs.length > 0 && (
            <section style={{ marginBottom: 16 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontSize: 18 }}>🔥</span>
                  <div style={{ color: "#FFD700", fontSize: 10, fontWeight: 900, letterSpacing: 1.5 }}>
                    TÄGLICHE ANGEBOTE
                  </div>
                </div>
                <div style={{ color: "#a8b4cf", fontSize: 9, fontWeight: 800 }}>
                  🔄 Reset in {String(resetHours).padStart(2,"0")}:{String(resetMins).padStart(2,"0")}
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 6 }}>
                {daily.packs.filter((p) => !p.is_bundle).map((p) => {
                  const tm = TIER_META[p.tier];
                  const owned = daily.purchased_today.includes(p.id);
                  const priceLabel = p.price_cents != null
                    ? `€ ${(p.price_cents / 100).toFixed(2).replace(".", ",")}`
                    : `💎 ${p.price_gems}`;
                  return (
                    <div key={p.id} style={{
                      padding: 8, borderRadius: 12,
                      background: owned
                        ? "rgba(74,222,128,0.08)"
                        : `linear-gradient(180deg, ${tm.glow}, rgba(15,17,21,0.7))`,
                      border: `1px solid ${owned ? "rgba(74,222,128,0.4)" : tm.color}`,
                      boxShadow: owned ? "none" : `0 0 10px ${tm.glow}`,
                      position: "relative",
                    }}>
                      {p.bonus_gem_badge > 0 && !owned && (
                        <div style={{
                          position: "absolute", top: -8, right: -4,
                          padding: "2px 7px", borderRadius: 999,
                          background: "linear-gradient(135deg, #4ade80, #22D1C3)",
                          color: "#0F1115", fontSize: 9, fontWeight: 900,
                          boxShadow: "0 2px 6px rgba(0,0,0,0.4)",
                        }}>+{p.bonus_gem_badge}💎</div>
                      )}
                      <div style={{ textAlign: "center" }}>
                        <div style={{ fontSize: 26 }}>{p.icon}</div>
                        <div style={{ color: tm.color, fontSize: 9, fontWeight: 900, letterSpacing: 1, marginTop: 2 }}>
                          {tm.label}
                        </div>
                        <div style={{ color: "#FFF", fontSize: 11, fontWeight: 900, marginTop: 2 }}>{p.name}</div>
                      </div>
                      <ul style={{ margin: "8px 0 8px 14px", padding: 0, listStyle: "disc", color: "#a8b4cf", fontSize: 9, lineHeight: 1.4 }}>
                        {p.contents.map((c, i) => (
                          <li key={i}>{c.label}</li>
                        ))}
                      </ul>
                      <button
                        onClick={() => !owned && purchaseDaily(p.id)}
                        disabled={owned || busy === p.id}
                        style={{
                          width: "100%", padding: "6px 4px", borderRadius: 8,
                          background: owned ? "rgba(74,222,128,0.15)" : `linear-gradient(135deg, ${tm.color}, #FFD700)`,
                          color: owned ? "#4ade80" : "#0F1115",
                          border: owned ? "1px solid rgba(74,222,128,0.4)" : "none",
                          fontSize: 10, fontWeight: 900,
                          cursor: owned ? "not-allowed" : "pointer",
                        }}>
                        {owned ? "✓ Heute eingelöst" : priceLabel}
                      </button>
                    </div>
                  );
                })}
              </div>

              {/* SUPER-Bundle-Banner */}
              {daily.packs.filter((p) => p.is_bundle).map((p) => {
                const owned = daily.purchased_today.includes(p.id);
                const priceLabel = p.price_cents != null
                  ? `€ ${(p.price_cents / 100).toFixed(2).replace(".", ",")}`
                  : `💎 ${p.price_gems}`;
                return (
                  <button key={p.id}
                    onClick={() => !owned && purchaseDaily(p.id)}
                    disabled={owned || busy === p.id}
                    style={{
                      width: "100%", marginTop: 10,
                      padding: "12px 14px", borderRadius: 14,
                      background: owned
                        ? "rgba(74,222,128,0.12)"
                        : "linear-gradient(135deg, rgba(255,45,120,0.22), rgba(255,215,0,0.22), rgba(34,209,195,0.22))",
                      border: owned ? "1px solid rgba(74,222,128,0.4)" : "1px solid rgba(255,215,0,0.55)",
                      boxShadow: owned ? "none" : "0 0 18px rgba(255,215,0,0.35)",
                      cursor: owned ? "not-allowed" : "pointer",
                      display: "flex", alignItems: "center", gap: 12,
                      textAlign: "left", color: "#FFF",
                    }}>
                    <span style={{ fontSize: 28 }}>{p.icon}</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 900, color: "#FFD700", letterSpacing: 0.5 }}>{p.name}</div>
                      <div style={{ fontSize: 11, color: "#FFF", fontWeight: 700, marginTop: 2 }}>
                        Bronze + Silber + Gold zusammen
                      </div>
                      <div style={{ fontSize: 10, color: "#a8b4cf", marginTop: 2 }}>
                        Spare ggü. Einzelkauf · 1× pro Tag
                      </div>
                    </div>
                    <div style={{
                      padding: "8px 14px", borderRadius: 10,
                      background: owned ? "rgba(74,222,128,0.2)" : "linear-gradient(135deg, #FFD700, #FF6B4A)",
                      color: owned ? "#4ade80" : "#0F1115",
                      fontSize: 13, fontWeight: 900, flexShrink: 0,
                    }}>
                      {owned ? "✓ GEHOLT" : priceLabel}
                    </div>
                  </button>
                );
              })}

              <div style={{ color: "#8B8FA3", fontSize: 9, marginTop: 6, textAlign: "center" }}>
                Jeder Pack 1× pro Tag · Reset um 00:00 UTC · Inhalte bleiben permanent
              </div>
            </section>
          )}
          {(Object.keys(CATEGORY_META) as CategoryKey[]).filter((cat) => {
            if (gemTab === "passes")   return cat === "monthly_pass";
            if (gemTab === "boosters") return cat === "booster" || cat === "convenience";
            if (gemTab === "skins")    return cat === "cosmetic";
            if (gemTab === "crew")     return cat === "crew_emblem";
            return false;
          }).map((cat) => {
            const meta = CATEGORY_META[cat];
            const list = grouped[cat];
            if (list.length === 0) return null;
            return (
              <section key={cat} style={{ marginBottom: 14 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                  <span style={{ fontSize: 16 }}>{meta.icon}</span>
                  <div style={{ color: meta.accent, fontSize: 10, fontWeight: 900, letterSpacing: 1.5 }}>{meta.label.toUpperCase()}</div>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {list.map((i) => {
                    const owned = activePurchaseIds.has(i.id);
                    const cantAfford = (gems?.gems ?? 0) < i.price_gems;
                    return (
                      <div key={i.id} style={{
                        display: "flex", alignItems: "center", gap: 8, padding: 10, borderRadius: 10,
                        background: "rgba(26,29,35,0.9)",
                        border: `1px solid ${owned ? meta.accent : "rgba(255,255,255,0.08)"}`,
                      }}>
                        <div style={{ width: 38, height: 38, borderRadius: 10, background: `${meta.accent}22`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22 }}>{i.icon}</div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ color: "#FFF", fontSize: 12, fontWeight: 900 }}>{i.name}</div>
                          <div style={{ color: "#a8b4cf", fontSize: 10, marginTop: 1, lineHeight: 1.3 }}>{i.description}</div>
                        </div>
                        <button
                          onClick={() => !owned && !cantAfford && purchase(i.id)}
                          disabled={owned || cantAfford || busy === i.id}
                          style={{
                            padding: "7px 10px", borderRadius: 10,
                            background: owned ? "rgba(74,222,128,0.15)" : cantAfford ? "rgba(255,255,255,0.06)" : `linear-gradient(135deg, ${meta.accent}, #FFD700)`,
                            color: owned ? "#4ade80" : cantAfford ? "#6c7590" : "#0F1115",
                            border: owned ? "1px solid rgba(74,222,128,0.4)" : "none",
                            fontSize: 10, fontWeight: 900,
                            cursor: owned || cantAfford ? "not-allowed" : "pointer",
                            whiteSpace: "nowrap",
                          }}>
                          {owned ? "✓ Aktiv" : `💎 ${i.price_gems}`}
                        </button>
                      </div>
                    );
                  })}
                </div>
              </section>
            );
          })}
        </div>

        {toast && (
          <div style={{
            position: "absolute", bottom: 20, left: "50%", transform: "translateX(-50%)",
            padding: "8px 12px", borderRadius: 10,
            background: "rgba(15,17,21,0.95)", border: "1px solid rgba(255,215,0,0.4)",
            color: "#FFF", fontSize: 11, fontWeight: 800, zIndex: 100,
          }}>{toast}</div>
        )}
    </>
  );

  if (embedded) {
    return <div style={{ display: "flex", flexDirection: "column", color: "#F0F0F0" }}>{body}</div>;
  }

  return (
    <div onClick={onClose} style={{
      position: "fixed", inset: 0, zIndex: 3700,
      background: "rgba(15,17,21,0.92)", backdropFilter: "blur(14px)",
      display: "flex", alignItems: "center", justifyContent: "center", padding: 16,
    }}>
      <div onClick={(e) => e.stopPropagation()} style={{
        width: "100%", maxWidth: 640, maxHeight: "92vh", display: "flex", flexDirection: "column",
        background: "#1A1D23", borderRadius: 20, border: "1px solid rgba(255,215,0,0.5)",
        boxShadow: "0 0 40px rgba(255,215,0,0.25)", color: "#F0F0F0", overflow: "hidden",
      }}>
        <div style={{
          padding: "12px 16px", display: "flex", alignItems: "center", gap: 10,
          background: "linear-gradient(180deg, rgba(255,215,0,0.15), transparent)",
          borderBottom: "1px solid rgba(255,215,0,0.25)",
        }}>
          <div style={{ flex: 1 }}>
            <div style={{ color: "#FFD700", fontSize: 9, fontWeight: 900, letterSpacing: 2 }}>EDELSTEIN-SHOP</div>
            <div style={{ color: "#FFF", fontSize: 15, fontWeight: 900 }}>Fair-Play · kein Pay-to-Win</div>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", color: "#8B8FA3", fontSize: 22, cursor: "pointer", width: 32, height: 32 }}>×</button>
        </div>
        {body}
      </div>
    </div>
  );
}
