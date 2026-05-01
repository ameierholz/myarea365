"use client";

import { useEffect, useState } from "react";

const PRIMARY = "#22D1C3";
const ACCENT = "#FF2D78";
const GOLD = "#FFD700";
const ORANGE = "#FF8A3C";
const BG_DEEP = "#0F1115";
const CARD_BG = "#1A1D23";

type Reward = { kind: string; qty?: number; tier?: string; resource?: string; theme_id?: string; marker_id?: string; days?: number; buff?: string; label?: string };
type SeasonalPack = { id: string; title: string; subtitle?: string; description?: string; hero_image?: string; price_cents: number; bonus_gems: number; rewards: Reward[]; ends_at: string };
type Threshold = { id: string; threshold: number; reward_label: string; rewards: Reward[]; sort: number };
type ThemedPack = { id: string; theme: string; title: string; description?: string; price_cents: number; bonus_gems: number; daily_limit: number; rewards: Reward[] };
type GemTier = { id: string; price_cents: number; base_gems: number; bonus_gems: number; badge_label?: string; bonus_rewards: Reward[] };
type DailyDeal = { id: number; slot: number; title: string; description?: string; price_cents: number; rewards: Reward[] };
type BPSeason = { id: string; title: string; starts_at: string; ends_at: string; price_premium_cents: number; price_premium_plus_cents: number };
type Subscription = { id: string; title: string; description?: string; price_cents_monthly: number; daily_gems: number; perks: string[] };

type DealsResponse = {
  seasonal: SeasonalPack | null;
  thresholds: Threshold[];
  themed: ThemedPack[];
  tiers: GemTier[];
  daily: DailyDeal[];
  battle_pass_season: BPSeason | null;
  subscriptions: Subscription[];
  progress: {
    gem_threshold?: { gems_purchased: number; thresholds_claimed: number[] };
    themed_purchased_today?: string[];
    daily_purchased?: number[];
    battle_pass?: { xp: number; tier: string };
    subscription?: { subscription_id: string; expires_at: string };
  };
};

export type DealsTabId = "seasonal" | "thresholds" | "themed" | "gems" | "daily" | "battlepass" | "subs";
type TabId = DealsTabId;

const TABS: { id: TabId; icon: string; label: string }[] = [
  { id: "seasonal",   icon: "🥚", label: "Saison-Pack" },
  { id: "thresholds", icon: "🏆", label: "Schwellen" },
  { id: "themed",     icon: "📦", label: "Themen-Pakete" },
  { id: "gems",       icon: "💎", label: "Edelsteine" },
  { id: "daily",      icon: "🔥", label: "Tagesangebote" },
  { id: "battlepass", icon: "📜", label: "Battle Pass" },
  { id: "subs",       icon: "🎒", label: "Monats-Abos" },
];

const formatPrice = (cents: number) => `EUR ${(cents / 100).toFixed(2).replace(".", ",")}`;
const formatNum = (n: number) => n.toLocaleString("de-DE");

/**
 * Inline-Body — wird embeddable im UnifiedShopHub als Tab gerendert.
 * Die TABS werden hier intern gerendert (horizontal-scrollbar auf Mobile, Sidebar auf Desktop ≥640px via wrapper).
 */
export function DealsShopBody({ initialTab = "seasonal" }: { initialTab?: TabId }) {
  const [tab, setTab] = useState<TabId>(initialTab);
  const [data, setData] = useState<DealsResponse | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/monetization/deals", { cache: "no-store" })
      .then((r) => r.json())
      .then(setData)
      .catch(() => setData(null));
  }, []);

  async function checkout(skuKind: string, skuId: string) {
    setBusy(`${skuKind}:${skuId}`);
    try {
      const r = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ kind: skuKind, id: skuId }),
      });
      const j = await r.json();
      if (j.url) window.location.href = j.url;
      else if (j.error) alert(j.error);
    } finally { setBusy(null); }
  }

  return (
    <div>
      {/* Sub-Tabs — Mobile: horizontal scroll, Desktop ≥640px: 2 Reihen Pills */}
      <div style={{
        display: "flex", gap: 6, overflowX: "auto", flexWrap: "nowrap",
        marginBottom: 14, paddingBottom: 6,
        scrollbarWidth: "none",
      }}>
        {TABS.map((t) => {
          const active = tab === t.id;
          const dailyCount = t.id === "daily" ? (data?.daily.length ?? 0) - (data?.progress.daily_purchased?.length ?? 0) : 0;
          return (
            <button key={t.id} onClick={() => setTab(t.id)} style={{
              flexShrink: 0,
              display: "flex", alignItems: "center", gap: 4,
              padding: "8px 12px", borderRadius: 999,
              background: active ? `${PRIMARY}33` : "rgba(255,255,255,0.04)",
              border: active ? `1px solid ${PRIMARY}` : "1px solid rgba(255,255,255,0.08)",
              color: active ? "#fff" : "#a8b4cf",
              fontSize: 12, fontWeight: active ? 900 : 700,
              cursor: "pointer", whiteSpace: "nowrap",
            }}>
              <span style={{ fontSize: 14 }}>{t.icon}</span>
              <span>{t.label}</span>
              {dailyCount > 0 && (
                <span style={{
                  background: ACCENT, color: "#fff",
                  fontSize: 9, fontWeight: 900, padding: "1px 5px", borderRadius: 999,
                }}>{dailyCount}</span>
              )}
            </button>
          );
        })}
      </div>

      {/* Content */}
      {!data && <div style={{ color: "#a8b4cf", textAlign: "center", padding: 40 }}>Lade Deals…</div>}
      {data && tab === "seasonal" && <SeasonalView pack={data.seasonal} onCheckout={() => data.seasonal && checkout("seasonal", data.seasonal.id)} busy={busy} />}
      {data && tab === "thresholds" && <ThresholdsView thresholds={data.thresholds} progress={data.progress.gem_threshold} />}
      {data && tab === "themed" && <ThemedView packs={data.themed} purchasedToday={data.progress.themed_purchased_today ?? []} onCheckout={(id) => checkout("themed", id)} busy={busy} />}
      {data && tab === "gems" && <GemsView tiers={data.tiers} onCheckout={(id) => checkout("gem_tier", id)} busy={busy} />}
      {data && tab === "daily" && <DailyView />}
      {data && tab === "battlepass" && <BattlePassView season={data.battle_pass_season} progress={data.progress.battle_pass} onCheckout={(t) => data.battle_pass_season && checkout("battle_pass", `${data.battle_pass_season.id}:${t}`)} busy={busy} />}
      {data && tab === "subs" && <SubsView subs={data.subscriptions} active={data.progress.subscription} onCheckout={(id) => checkout("subscription", id)} busy={busy} />}
    </div>
  );
}

/** Standalone-Modal-Wrapper (Backwards-Compat) */
export function DealsShopModal({ initialTab = "seasonal", onClose }: { initialTab?: TabId; onClose: () => void }) {
  return (
    <div onClick={onClose} style={{
      position: "fixed", inset: 0, zIndex: 9500,
      background: "rgba(0,0,0,0.85)",
      display: "flex", alignItems: "center", justifyContent: "center", padding: 12,
    }}>
      <div onClick={(e) => e.stopPropagation()} style={{
        width: "100%", maxWidth: 1100, maxHeight: "92vh",
        display: "flex", flexDirection: "column",
        background: BG_DEEP, borderRadius: 16, overflow: "hidden",
        border: `2px solid ${PRIMARY}33`,
        boxShadow: "0 20px 60px rgba(0,0,0,0.7)",
      }}>
        <div style={{ display: "flex", alignItems: "center", padding: "12px 16px", borderBottom: `1px solid ${PRIMARY}22` }}>
          <div style={{ flex: 1, color: GOLD, fontWeight: 900, fontSize: 14, letterSpacing: 1, textTransform: "uppercase" }}>Deals</div>
          <button onClick={onClose} style={{ background: "none", border: "none", color: "#8B8FA3", fontSize: 22, cursor: "pointer", width: 32, height: 32 }}>×</button>
        </div>
        <div style={{ flex: 1, overflow: "auto", padding: 16 }}>
          <DealsShopBody initialTab={initialTab} />
        </div>
      </div>
    </div>
  );
}

/* ─── Tab-Views ──────────────────────────────────────────────────────── */

function SeasonalView({ pack, onCheckout, busy }: { pack: SeasonalPack | null; onCheckout: () => void; busy: string | null }) {
  if (!pack) return <Empty msg="Aktuell kein Saison-Pack aktiv." />;
  const isBusy = busy === `seasonal:${pack.id}`;
  return (
    <HeroCard
      hero={pack.hero_image}
      gradient="linear-gradient(135deg, rgba(34,209,195,0.4), rgba(168,85,247,0.4))"
      title={pack.title} subtitle={pack.subtitle} description={pack.description}
      price={pack.price_cents} ctaLabel={isBusy ? "…" : "Kaufen"} onCta={onCheckout} disabled={isBusy}
      bonusGems={pack.bonus_gems} rewards={pack.rewards}
      footerRight={`Endet am ${new Date(pack.ends_at).toLocaleDateString("de-DE")}`}
    />
  );
}

function ThresholdsView({ thresholds, progress }: { thresholds: Threshold[]; progress?: { gems_purchased: number; thresholds_claimed: number[] } }) {
  const purchased = progress?.gems_purchased ?? 0;
  const claimed = new Set(progress?.thresholds_claimed ?? []);
  return (
    <div>
      <div style={{ marginBottom: 16 }}>
        <div style={{ color: GOLD, fontWeight: 900, fontSize: 18, fontFamily: "var(--font-display-stack)", letterSpacing: 0.6 }}>
          KAUFE EDELSTEINE — SCHALTE BELOHNUNGEN FREI
        </div>
        <div style={{ color: "#a8b4cf", fontSize: 12, marginTop: 4 }}>
          Diese Woche bereits gekauft: <strong style={{ color: "#fff" }}>{formatNum(purchased)}</strong> Edelsteine
        </div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: 12 }}>
        {thresholds.map((t) => {
          const reached = purchased >= t.threshold;
          const wasClaimed = claimed.has(t.threshold);
          return (
            <div key={t.id} style={{
              background: reached ? `linear-gradient(135deg, ${GOLD}22, ${ORANGE}22)` : CARD_BG,
              border: reached ? `2px solid ${GOLD}` : "1px solid #ffffff15",
              borderRadius: 12, padding: 14, textAlign: "center",
              opacity: wasClaimed ? 0.5 : 1,
            }}>
              <div style={{ fontSize: 32 }}>🎁</div>
              <div style={{ color: GOLD, fontWeight: 900, fontSize: 16, marginTop: 6, fontFamily: "var(--font-display-stack)" }}>
                {formatNum(t.threshold)}
              </div>
              <div style={{ color: "#a8b4cf", fontSize: 11, marginTop: 4 }}>{t.reward_label}</div>
              {wasClaimed && <div style={{ color: "#4ade80", fontSize: 10, fontWeight: 900, marginTop: 6 }}>✓ EINGELÖST</div>}
              {reached && !wasClaimed && <div style={{ color: GOLD, fontSize: 10, fontWeight: 900, marginTop: 6 }}>BEREIT</div>}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ThemedView({ packs, purchasedToday, onCheckout, busy }: { packs: ThemedPack[]; purchasedToday: string[]; onCheckout: (id: string) => void; busy: string | null }) {
  const purchased = new Set(purchasedToday);
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 16 }}>
      {packs.map((p) => {
        const isOwned = purchased.has(p.id);
        const isBusy = busy === `themed:${p.id}`;
        return (
          <PackCard key={p.id}
            title={p.title} description={p.description}
            price={p.price_cents}
            disabled={isOwned || isBusy}
            ctaLabel={isOwned ? "✓ Heute gekauft" : isBusy ? "…" : `Kauf ${formatPrice(p.price_cents)}`}
            onCta={() => onCheckout(p.id)}
            bonusGems={p.bonus_gems} rewards={p.rewards}
            theme={p.theme}
          />
        );
      })}
    </div>
  );
}

function GemsView({ tiers, onCheckout, busy }: { tiers: GemTier[]; onCheckout: (id: string) => void; busy: string | null }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 12 }}>
      {tiers.map((t) => {
        const isBusy = busy === `gem_tier:${t.id}`;
        const totalGems = t.base_gems + t.bonus_gems;
        return (
          <div key={t.id} style={{
            background: CARD_BG, border: `1.5px solid ${GOLD}33`,
            borderRadius: 12, padding: 16, textAlign: "center", position: "relative",
          }}>
            {t.badge_label && (
              <div style={{
                position: "absolute", top: -10, right: 12,
                background: ACCENT, color: "#fff", fontSize: 9, fontWeight: 900,
                padding: "3px 8px", borderRadius: 999,
              }}>{t.badge_label}</div>
            )}
            <div style={{ fontSize: 36 }}>💎</div>
            <div style={{ color: GOLD, fontWeight: 900, fontSize: 22, marginTop: 4, fontFamily: "var(--font-display-stack)" }}>
              {formatNum(totalGems)}
            </div>
            {t.bonus_gems > 0 && <div style={{ color: "#4ade80", fontSize: 11, fontWeight: 700 }}>(+{formatNum(t.bonus_gems)} Bonus)</div>}
            {t.bonus_rewards.length > 0 && (
              <div style={{ marginTop: 8, fontSize: 10, color: "#a8b4cf", lineHeight: 1.4 }}>
                {t.bonus_rewards.map((r, i) => <div key={i}>+ {r.label || r.kind}</div>)}
              </div>
            )}
            <button disabled={isBusy} onClick={() => onCheckout(t.id)} style={{
              marginTop: 12, width: "100%", padding: "10px", borderRadius: 8,
              background: `linear-gradient(135deg, ${GOLD}, ${ORANGE})`,
              color: "#0F1115", fontSize: 14, fontWeight: 900, border: "none",
              cursor: isBusy ? "wait" : "pointer", letterSpacing: 0.4,
              fontFamily: "var(--font-display-stack)",
            }}>{isBusy ? "…" : formatPrice(t.price_cents)}</button>
          </div>
        );
      })}
    </div>
  );
}

// ── Tagesangebote-View — nutzt /api/shop/daily und rendert Bronze/Silber/Gold + SUPER ────
type ApiDailyContent = { type: string; label: string; kind?: string; rarity?: string };
type ApiDailyPack = {
  id: string; sort: number; tier: "bronze" | "silver" | "gold";
  name: string; subtitle: string; icon: string;
  price_gems: number; bonus_gem_badge: number;
  contents: ApiDailyContent[];
  price_cents?: number | null;
  is_bundle?: boolean;
};
type ApiDailyResponse = { packs: ApiDailyPack[]; purchased_today: string[]; reset_in_seconds: number };

const TIER_DEFS_INLINE: Record<"bronze" | "silver" | "gold", { color: string; glow: string; label: string }> = {
  bronze: { color: "#cd7f32", glow: "rgba(205,127,50,0.28)",  label: "BRONZE" },
  silver: { color: "#d8d8d8", glow: "rgba(216,216,216,0.28)", label: "SILBER" },
  gold:   { color: "#FFD700", glow: "rgba(255,215,0,0.38)",   label: "GOLD" },
};
const ICON_FOR: Record<string, string> = {
  gems: "💎", xp_boost_hours: "🚀", random_seals: "🏅", random_potion: "🧪",
  random_materials: "🧱", arena_pass_days: "⚔️", speed_token: "⚡", treasure_chest: "🗝️",
};
function dailyIconFor(type: string, c?: { kind?: string }): string {
  if (type === "treasure_chest") return c?.kind === "gold" ? "🥇" : c?.kind === "event" ? "🎉" : "🥈";
  return ICON_FOR[type] ?? "✨";
}

function DailyView() {
  const [data, setData] = useState<ApiDailyResponse | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [resetIn, setResetIn] = useState(0);

  const load = async () => {
    const r = await fetch("/api/shop/daily");
    if (!r.ok) return;
    const j = await r.json() as ApiDailyResponse;
    setData(j);
    setResetIn(j.reset_in_seconds ?? 0);
  };
  useEffect(() => { void load(); }, []);
  useEffect(() => {
    if (resetIn <= 0) return;
    const id = setInterval(() => setResetIn((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(id);
  }, [resetIn]);

  async function buy(packId: string) {
    setBusy(packId);
    try {
      const r = await fetch("/api/shop/daily", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ pack_id: packId }) });
      const j = await r.json() as { ok?: boolean; error?: string };
      if (j.ok) await load();
    } finally { setBusy(null); }
  }

  if (!data) return <Empty msg="Lade Tagesangebote…" />;
  const standardPacks = data.packs.filter((p) => !p.is_bundle).sort((a, b) => a.sort - b.sort);
  const bundlePack = data.packs.find((p) => p.is_bundle);
  const standardOpen = standardPacks.filter((p) => !data.purchased_today.includes(p.id));
  const sumCents = standardPacks.reduce((acc, p) => acc + (p.price_cents ?? 0), 0);
  const bundleVal = bundlePack?.price_cents ?? 0;
  const savePct = (sumCents > 0 && bundleVal > 0 && sumCents > bundleVal) ? Math.round((1 - bundleVal / sumCents) * 100) : 0;

  const h = Math.floor(resetIn / 3600);
  const m = Math.floor((resetIn % 3600) / 60);
  const s = resetIn % 60;
  const countdown = `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;

  function priceLabel(p: ApiDailyPack): string {
    if (p.price_cents != null) return `${(p.price_cents / 100).toFixed(2).replace(".", ",")} €`;
    return `💎 ${p.price_gems}`;
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{
        display: "flex", alignItems: "center", gap: 10,
        padding: "12px 14px",
        background: "linear-gradient(135deg, rgba(255,107,74,0.22), rgba(255,215,0,0.16))",
        borderRadius: 12,
        border: "1px solid rgba(255,215,0,0.3)",
      }}>
        <span style={{ fontSize: 22 }}>🔥</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 9, fontWeight: 900, letterSpacing: 1.2, color: GOLD }}>TAGES-DEALS</div>
          <div style={{ fontSize: 14, fontWeight: 900, color: "#FFF" }}>
            {standardOpen.length} Deals offen{bundlePack && !data.purchased_today.includes(bundlePack.id) ? <span style={{ color: GOLD }}> + 🎁 Bundle</span> : null}
          </div>
          <div style={{ fontSize: 10, color: "#a8b4cf", marginTop: 1 }}>⏱ Reset in {countdown}</div>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 8 }}>
        {standardPacks.map((p) => {
          const td = TIER_DEFS_INLINE[p.tier];
          const owned = data.purchased_today.includes(p.id);
          return (
            <div key={p.id} style={{
              padding: 10, borderRadius: 10,
              background: owned ? "rgba(74,222,128,0.08)" : `linear-gradient(180deg, ${td.glow}, rgba(15,17,21,0.7))`,
              border: `1px solid ${owned ? "rgba(74,222,128,0.4)" : td.color}`,
              position: "relative",
            }}>
              <div style={{ textAlign: "center" }}>
                <div style={{ fontSize: 22 }}>{p.icon}</div>
                <div style={{ color: td.color, fontSize: 9, fontWeight: 900, letterSpacing: 0.8, marginTop: 1 }}>{td.label}</div>
              </div>
              <ul style={{ margin: "8px 0", padding: 0, listStyle: "none", color: "#a8b4cf", fontSize: 10, lineHeight: 1.5 }}>
                {p.contents.map((c, i) => (
                  <li key={i} style={{ display: "flex", alignItems: "baseline", gap: 6, marginBottom: 2 }}>
                    <span style={{ fontSize: 12, lineHeight: 1, flexShrink: 0 }}>{dailyIconFor(c.type, c)}</span>
                    <span>{c.label}</span>
                  </li>
                ))}
              </ul>
              <button disabled={owned || busy === p.id} onClick={() => !owned && buy(p.id)} style={{
                width: "100%", padding: "8px 4px", borderRadius: 7,
                background: owned ? "rgba(74,222,128,0.15)" : `linear-gradient(135deg, ${td.color}, ${GOLD})`,
                color: owned ? "#4ade80" : "#0F1115",
                border: owned ? "1px solid rgba(74,222,128,0.4)" : "none",
                fontSize: 11, fontWeight: 900,
                cursor: owned ? "default" : busy === p.id ? "wait" : "pointer",
              }}>{owned ? "✓ Heute gekauft" : busy === p.id ? "…" : priceLabel(p)}</button>
            </div>
          );
        })}
      </div>

      {bundlePack && (() => {
        const owned = data.purchased_today.includes(bundlePack.id);
        return (
          <button disabled={owned || busy === bundlePack.id} onClick={() => !owned && buy(bundlePack.id)} style={{
            width: "100%", padding: "12px 14px", borderRadius: 14,
            background: owned ? "rgba(74,222,128,0.12)" : "linear-gradient(135deg, rgba(255,45,120,0.28), rgba(255,215,0,0.26), rgba(34,209,195,0.26))",
            border: owned ? "1px solid rgba(74,222,128,0.4)" : "1px solid rgba(255,215,0,0.7)",
            boxShadow: owned ? "none" : "0 0 18px rgba(255,215,0,0.45), inset 0 1px 0 rgba(255,255,255,0.1)",
            cursor: owned ? "default" : busy === bundlePack.id ? "wait" : "pointer",
            display: "flex", alignItems: "center", gap: 12,
            textAlign: "left", color: "#FFF",
          }}>
            <span style={{ fontSize: 28, flexShrink: 0 }}>{bundlePack.icon}</span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                <span style={{ fontSize: 8, fontWeight: 900, letterSpacing: 0.8, padding: "2px 6px", borderRadius: 4, background: `linear-gradient(135deg, ${GOLD}, #FF6B4A)`, color: "#0F1115" }}>BESTPREIS</span>
                <span style={{ fontSize: 8, fontWeight: 900, letterSpacing: 0.8, padding: "2px 6px", borderRadius: 4, background: "rgba(255,215,0,0.15)", border: "1px solid rgba(255,215,0,0.5)", color: GOLD }}>ALLE 3 PAKETE</span>
                {!owned && savePct > 0 && (
                  <span style={{ fontSize: 9, fontWeight: 900, letterSpacing: 0.6, padding: "2px 7px", borderRadius: 999, background: `linear-gradient(135deg, ${ACCENT}, #FF6B4A)`, color: "#FFF", boxShadow: "0 0 10px rgba(255,45,120,0.5)" }}>−{savePct}%</span>
                )}
              </div>
              <div style={{ fontSize: 14, fontWeight: 900, color: GOLD, letterSpacing: 0.4, marginTop: 3 }}>{bundlePack.name}</div>
              <div style={{ fontSize: 10, color: "#FFF", marginTop: 1, fontWeight: 700 }}>🥉 Bronze + 🥈 Silber + 🥇 Gold</div>
            </div>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4, flexShrink: 0 }}>
              {!owned && savePct > 0 && (
                <div style={{ fontSize: 14, fontWeight: 900, lineHeight: 1 }}>
                  <span style={{ color: "#a8b4cf", fontSize: 11 }}>statt </span>
                  <span style={{ textDecoration: "line-through", textDecorationColor: ACCENT, textDecorationThickness: 2.5, color: "#FFF" }}>{(sumCents / 100).toFixed(2).replace(".", ",")} €</span>
                </div>
              )}
              <div style={{
                padding: "10px 16px", borderRadius: 10,
                background: owned ? "rgba(74,222,128,0.2)" : `linear-gradient(135deg, ${GOLD}, #FF6B4A)`,
                color: owned ? "#4ade80" : "#0F1115",
                fontSize: 16, fontWeight: 900,
                boxShadow: owned ? "none" : "0 0 14px rgba(255,215,0,0.55)",
                textAlign: "center", lineHeight: 1.1,
              }}>{owned ? "✓" : busy === bundlePack.id ? "…" : priceLabel(bundlePack)}</div>
            </div>
          </button>
        );
      })()}
    </div>
  );
}

function BattlePassView({ season, progress, onCheckout, busy }: { season: BPSeason | null; progress?: { xp: number; tier: string }; onCheckout: (tier: "premium" | "premium_plus") => void; busy: string | null }) {
  if (!season) return <Empty msg="Aktuell kein Battle Pass aktiv." />;
  const tier = progress?.tier ?? "free";
  const xp = progress?.xp ?? 0;
  return (
    <div>
      <div style={{ color: PRIMARY, fontWeight: 900, fontSize: 22, fontFamily: "var(--font-display-stack)", letterSpacing: 0.6 }}>
        📜 {season.title.toUpperCase()}
      </div>
      <div style={{ color: "#a8b4cf", fontSize: 12, marginTop: 4, marginBottom: 16 }}>
        Endet am {new Date(season.ends_at).toLocaleDateString("de-DE")} · 50 Levels · Aktueller Tier: <strong style={{ color: tier === "free" ? "#fff" : tier === "premium" ? GOLD : ACCENT }}>{tier.toUpperCase()}</strong>
      </div>
      <div style={{ background: CARD_BG, padding: 12, borderRadius: 8, marginBottom: 16 }}>
        <div style={{ color: "#fff", fontSize: 13, marginBottom: 4 }}>Dein Fortschritt: <strong style={{ color: GOLD }}>{formatNum(xp)} XP</strong></div>
        <div style={{ height: 8, background: "#0F1115", borderRadius: 999, overflow: "hidden" }}>
          <div style={{ width: `${Math.min(100, (xp / 50000) * 100)}%`, height: "100%", background: `linear-gradient(90deg, ${PRIMARY}, ${ACCENT})` }} />
        </div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        {tier !== "premium" && tier !== "plus" && (
          <button disabled={busy === `battle_pass:${season.id}:premium`} onClick={() => onCheckout("premium")} style={{
            padding: "16px", borderRadius: 10,
            background: `linear-gradient(135deg, ${GOLD}, ${ORANGE})`,
            color: "#0F1115", fontSize: 15, fontWeight: 900, border: "none", cursor: "pointer",
            fontFamily: "var(--font-display-stack)", letterSpacing: 0.5,
          }}>
            <div>PREMIUM TRACK</div>
            <div style={{ fontSize: 12, marginTop: 4, opacity: 0.8 }}>{formatPrice(season.price_premium_cents)}</div>
          </button>
        )}
        {tier !== "plus" && (
          <button disabled={busy === `battle_pass:${season.id}:premium_plus`} onClick={() => onCheckout("premium_plus")} style={{
            padding: "16px", borderRadius: 10,
            background: `linear-gradient(135deg, ${ACCENT}, #a855f7)`,
            color: "#fff", fontSize: 15, fontWeight: 900, border: "none", cursor: "pointer",
            fontFamily: "var(--font-display-stack)", letterSpacing: 0.5,
          }}>
            <div>PREMIUM PLUS</div>
            <div style={{ fontSize: 12, marginTop: 4, opacity: 0.85 }}>{formatPrice(season.price_premium_plus_cents)}</div>
          </button>
        )}
      </div>
    </div>
  );
}

function SubsView({ subs, active, onCheckout, busy }: { subs: Subscription[]; active?: { subscription_id: string; expires_at: string }; onCheckout: (id: string) => void; busy: string | null }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 12 }}>
      {subs.map((s) => {
        const isActive = active?.subscription_id === s.id;
        const isBusy = busy === `subscription:${s.id}`;
        return (
          <div key={s.id} style={{
            background: isActive ? `linear-gradient(135deg, ${PRIMARY}22, ${GOLD}22)` : CARD_BG,
            border: isActive ? `2px solid ${PRIMARY}` : `1.5px solid ${GOLD}33`,
            borderRadius: 12, padding: 16,
          }}>
            <div style={{ color: GOLD, fontWeight: 900, fontSize: 18, fontFamily: "var(--font-display-stack)", letterSpacing: 0.5 }}>{s.title}</div>
            <div style={{ color: "#a8b4cf", fontSize: 12, marginTop: 6, lineHeight: 1.4 }}>{s.description}</div>
            <div style={{ marginTop: 10, fontSize: 11, color: "#a8b4cf" }}>
              <strong style={{ color: GOLD }}>{formatNum(s.daily_gems)}</strong> Edelsteine täglich
            </div>
            {isActive && active && (
              <div style={{ color: "#4ade80", fontSize: 11, fontWeight: 700, marginTop: 8 }}>
                ✓ Aktiv bis {new Date(active.expires_at).toLocaleDateString("de-DE")}
              </div>
            )}
            <button disabled={isActive || isBusy} onClick={() => onCheckout(s.id)} style={{
              marginTop: 12, width: "100%", padding: "10px", borderRadius: 8,
              background: isActive ? "#222" : `linear-gradient(135deg, ${GOLD}, ${ORANGE})`,
              color: isActive ? "#a8b4cf" : "#0F1115", fontSize: 14, fontWeight: 900, border: "none",
              cursor: isActive ? "default" : isBusy ? "wait" : "pointer",
              fontFamily: "var(--font-display-stack)",
            }}>{isActive ? "Bereits aktiv" : isBusy ? "…" : `${formatPrice(s.price_cents_monthly)}/Monat`}</button>
          </div>
        );
      })}
    </div>
  );
}

/* ─── Shared Components ─────────────────────────────────────────────── */

function HeroCard({ hero, gradient, title, subtitle, description, price, ctaLabel, onCta, disabled, bonusGems, rewards, footerRight, theme: _theme }:
  { hero?: string; gradient: string; title: string; subtitle?: string; description?: string; price: number; ctaLabel: string; onCta: () => void; disabled?: boolean; bonusGems?: number; rewards: Reward[]; footerRight?: string; theme?: string }) {
  return (
    <div style={{ borderRadius: 14, overflow: "hidden", border: `2px solid ${GOLD}55`, position: "relative" }}>
      <div style={{
        height: 220, background: gradient,
        backgroundImage: hero ? `url(${hero})` : undefined,
        backgroundSize: "cover", backgroundPosition: "center",
        display: "flex", alignItems: "flex-end", padding: 20, position: "relative",
      }}>
        <div style={{ position: "absolute", inset: 0, background: "linear-gradient(180deg, transparent 50%, rgba(15,17,21,0.95))" }} />
        <div style={{ position: "relative", zIndex: 1 }}>
          <div style={{ color: GOLD, fontWeight: 900, fontSize: 28, fontFamily: "var(--font-display-stack)", letterSpacing: 0.8, lineHeight: 1 }}>{title.toUpperCase()}</div>
          {subtitle && <div style={{ color: "#fff", fontWeight: 700, fontSize: 14, marginTop: 4, opacity: 0.9 }}>{subtitle}</div>}
        </div>
      </div>
      <div style={{ background: CARD_BG, padding: 16 }}>
        {description && <div style={{ color: "#a8b4cf", fontSize: 13, marginBottom: 12, lineHeight: 1.4 }}>{description}</div>}
        {bonusGems !== undefined && bonusGems > 0 && (
          <div style={{ color: GOLD, fontWeight: 900, fontSize: 14, marginBottom: 8 }}>
            💎 +{formatNum(bonusGems)} Edelsteine
          </div>
        )}
        <RewardList rewards={rewards} />
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 16, gap: 12 }}>
          <button disabled={disabled} onClick={onCta} style={{
            flex: 1, padding: "14px", borderRadius: 10,
            background: `linear-gradient(135deg, ${GOLD}, ${ORANGE})`,
            color: "#0F1115", fontSize: 16, fontWeight: 900, border: "none",
            cursor: disabled ? "wait" : "pointer", fontFamily: "var(--font-display-stack)",
          }}>{ctaLabel} {ctaLabel !== "…" && `· ${formatPrice(price)}`}</button>
          {footerRight && <div style={{ color: "#a8b4cf", fontSize: 11 }}>{footerRight}</div>}
        </div>
      </div>
    </div>
  );
}

function PackCard({ title, description, price, disabled, ctaLabel, onCta, bonusGems, rewards, theme }:
  { title: string; description?: string; price: number; disabled?: boolean; ctaLabel: string; onCta: () => void; bonusGems?: number; rewards: Reward[]; theme: string }) {
  const themeColor = theme === "explorer" ? PRIMARY : theme === "warrior" ? ACCENT : GOLD;
  return (
    <div style={{
      background: `linear-gradient(180deg, ${themeColor}22, ${CARD_BG})`,
      border: `1.5px solid ${themeColor}66`, borderRadius: 12, padding: 16,
    }}>
      <div style={{ color: themeColor, fontWeight: 900, fontSize: 18, fontFamily: "var(--font-display-stack)", letterSpacing: 0.6 }}>{title}</div>
      {description && <div style={{ color: "#a8b4cf", fontSize: 11, marginTop: 4, lineHeight: 1.3 }}>{description}</div>}
      {bonusGems !== undefined && bonusGems > 0 && (
        <div style={{ color: GOLD, fontWeight: 900, fontSize: 13, marginTop: 8 }}>💎 +{formatNum(bonusGems)} Edelsteine</div>
      )}
      <RewardList rewards={rewards} compact />
      <button disabled={disabled} onClick={onCta} style={{
        marginTop: 12, width: "100%", padding: "10px", borderRadius: 8,
        background: disabled ? "#222" : `linear-gradient(135deg, ${GOLD}, ${ORANGE})`,
        color: disabled ? "#a8b4cf" : "#0F1115", fontSize: 13, fontWeight: 900, border: "none",
        cursor: disabled ? "default" : "pointer", letterSpacing: 0.3,
      }}>{ctaLabel}</button>
    </div>
  );
}

function RewardList({ rewards, compact }: { rewards: Reward[]; compact?: boolean }) {
  if (!rewards || rewards.length === 0) return null;
  return (
    <ul style={{ listStyle: "none", padding: 0, margin: 0, fontSize: compact ? 10 : 11, color: "#cdd6e3" }}>
      {rewards.slice(0, compact ? 4 : 8).map((r, i) => (
        <li key={i} style={{ display: "flex", justifyContent: "space-between", padding: "2px 0", borderBottom: "1px solid #ffffff10" }}>
          <span>{r.label || r.kind}</span>
          {r.qty && <strong style={{ color: GOLD }}>{formatNum(r.qty)}</strong>}
        </li>
      ))}
      {rewards.length > (compact ? 4 : 8) && (
        <li style={{ padding: "4px 0", color: "#a8b4cf", fontSize: 10 }}>+ {rewards.length - (compact ? 4 : 8)} weitere Belohnungen</li>
      )}
    </ul>
  );
}

function Empty({ msg }: { msg: string }) {
  return <div style={{ textAlign: "center", padding: 60, color: "#a8b4cf" }}>{msg}</div>;
}
