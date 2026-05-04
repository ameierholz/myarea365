"use client";

import { useState } from "react";
import { useTranslations, useLocale } from "next-intl";
import { getNumberLocale } from "@/i18n/config";
import { createClient } from "@/lib/supabase/client";
import { BOOST_PACKS, EXTRAS, XP_PACKS, GAMEPLAY_ITEMS, COSMETICS, formatPrice, stackBoostUntil } from "@/lib/monetization";
import { appAlert } from "@/components/app-dialog";
import { StripeCheckoutModal } from "@/components/stripe-embedded-checkout";
import { IapNotAvailableNotice } from "@/components/iap-not-available-notice";

type ShopTab = "boosts" | "xp" | "gameplay" | "cosmetics" | "extras";

export function BoostShopBody({ userId, onDone }: { userId: string; onDone?: () => void }) {
  return <BoostShopInner userId={userId} onClose={() => onDone?.()} embedded />;
}

export function BoostShopModal({ userId, onClose }: { userId: string; onClose: () => void }) {
  return <BoostShopInner userId={userId} onClose={onClose} embedded={false} />;
}

function BoostShopInner({ userId, onClose, embedded }: { userId: string; onClose: () => void; embedded: boolean }) {
  const tBS = useTranslations("BoostShop");
  const locale = useLocale();
  const numLocale = getNumberLocale(locale);
  const sb = createClient();
  const [tab, setTab] = useState<ShopTab>("boosts");
  const [loading, setLoading] = useState<string | null>(null);
  const [checkoutSecret, setCheckoutSecret] = useState<string | null>(null);

  // Wahl-Box (ehemals Mystery-Box) — User wählt VORHER, kein Zufall.
  // Verhindert dass die Box als „Loot-Box" unter EU-Regulierung fällt
  // (Belgien/Niederlande/Spanien). Kann auch BE/NL/ES sicher angezeigt werden.
  type WahlBoxKind =
    | "xp_500" | "xp_2000" | "xp_10000"
    | "boost_24" | "boost_48"
    | "streak_5" | "shouts_10"
    | "trail_golden" | "trail_neon"
    | "aura_30d" | "rainbow_30d";
  const [wahlBoxOpen, setWahlBoxOpen] = useState(false);
  const [wahlBoxChoice, setWahlBoxChoice] = useState<WahlBoxKind | null>(null);

  function clickItem(sku: string, name: string, price: number) {
    if (sku === "mystery_box") {
      // Choice-Modal öffnen statt direkt Stripe-Checkout starten.
      setWahlBoxOpen(true);
      return;
    }
    void buy(sku, name, price);
  }

  async function buy(sku: string, name: string, price: number) {
    // Hard-Block: Käufe in Capacitor-WebView (Play-Billing-Pflicht für digitale Goods).
    if (!(await import("@/lib/capacitor")).isInAppPurchaseAllowed()) {
      await appAlert("Käufe sind in der App nicht möglich. Bitte öffne myarea365.de im Browser, um den Kauf abzuschließen.");
      return;
    }
    setLoading(sku);
    try {
      // Stripe-Checkout wenn konfiguriert (NEXT_PUBLIC_STRIPE_ENABLED=1)
      if (process.env.NEXT_PUBLIC_STRIPE_ENABLED === "1") {
        const res = await fetch("/api/stripe/checkout", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ sku, name, amount_cents: price, ui_mode: "embedded" }),
        });
        const json = await res.json();
        if (json.client_secret) { setCheckoutSecret(json.client_secret); return; }
        if (json.url) { window.location.href = json.url; return; }
        throw new Error(json.error ?? tBS("checkoutFailed"));
      }
      // Demo-Fallback (wenn Stripe nicht aktiv):
      const { data, error } = await sb.from("purchases").insert({
        user_id: userId, product_sku: sku, product_name: name, amount_cents: price, status: "pending",
      }).select("id").single();
      if (error) throw error;
      await sb.from("purchases").update({ status: "completed", applied_at: new Date().toISOString() }).eq("id", data.id);

      // Effekt anwenden (Demo: direkt freischalten)
      if (sku.startsWith("boost_")) {
        const pack = (BOOST_PACKS as Record<string, { hours: number; multiplier: number }>)[sku];
        if (pack) {
          const { data: u } = await sb.from("users").select("xp_boost_until, xp_boost_multiplier").eq("id", userId).single();
          const stacked = stackBoostUntil(u?.xp_boost_until, u?.xp_boost_multiplier, pack.hours, pack.multiplier);
          await sb.from("users").update({
            xp_boost_until: stacked.until,
            xp_boost_multiplier: stacked.mult,
          }).eq("id", userId);
          if (stacked.capped) {
            appAlert(tBS("boostCappedAlert"));
          }
        }
      } else if (sku.startsWith("xp_")) {
        const pack = (XP_PACKS as Record<string, { xp: number }>)[sku];
        if (pack) {
          const { data: u } = await sb.from("users").select("xp").eq("id", userId).single();
          await sb.from("users").update({ xp: (u?.xp ?? 0) + pack.xp }).eq("id", userId);
        }
      } else if (sku.startsWith("badge_")) {
        const tier = sku === "badge_gold" ? "gold" : sku === "badge_silver" ? "silver" : "bronze";
        await sb.from("users").update({
          supporter_tier: tier,
          supporter_since: new Date().toISOString(),
        }).eq("id", userId);
      } else if (sku === "streak_pack_5" || sku === "streak_pack_15") {
        const add = sku === "streak_pack_15" ? 15 : 5;
        const { data: u } = await sb.from("users").select("streak_freezes_remaining").eq("id", userId).single();
        await sb.from("users").update({
          streak_freezes_remaining: (u?.streak_freezes_remaining ?? 0) + add,
        }).eq("id", userId);
      } else if (sku === "shout_pack_10") {
        const { data: u } = await sb.from("users").select("shouts_remaining").eq("id", userId).single();
        await sb.from("users").update({
          shouts_remaining: (u?.shouts_remaining ?? 0) + 10,
        }).eq("id", userId);
      } else if (sku === "golden_trail" || sku === "neon_trail") {
        await sb.from("users").update({ equipped_trail: sku }).eq("id", userId);
      } else if (sku === "aura_effect") {
        await sb.from("users").update({
          aura_until: new Date(Date.now() + 30 * 86400000).toISOString(),
        }).eq("id", userId);
      } else if (sku === "rainbow_name") {
        await sb.from("users").update({
          rainbow_name_until: new Date(Date.now() + 30 * 86400000).toISOString(),
        }).eq("id", userId);
      } else if (sku === "victory_dance") {
        await sb.from("users").update({ victory_dance_enabled: true }).eq("id", userId);
      } else if (sku === "map_cyberpunk" || sku === "map_retro") {
        await sb.from("users").update({ map_theme: sku }).eq("id", userId);
      } else if (sku === "ghost_mode") {
        const { data: u } = await sb.from("users").select("ghost_mode_charges").eq("id", userId).single();
        await sb.from("users").update({
          ghost_mode_charges: (u?.ghost_mode_charges ?? 0) + 1,
        }).eq("id", userId);
      } else if (sku === "double_claim") {
        const { data: u } = await sb.from("users").select("double_claim_charges").eq("id", userId).single();
        await sb.from("users").update({
          double_claim_charges: (u?.double_claim_charges ?? 0) + 1,
        }).eq("id", userId);
      } else if (sku === "reclaim_ticket") {
        const { data: u } = await sb.from("users").select("reclaim_tickets").eq("id", userId).single();
        await sb.from("users").update({
          reclaim_tickets: (u?.reclaim_tickets ?? 0) + 1,
        }).eq("id", userId);
      } else if (sku === "explorer_compass") {
        await sb.from("users").update({
          explorer_compass_until: new Date(Date.now() + 7 * 86400000).toISOString(),
        }).eq("id", userId);
      } else if (sku === "faction_switch") {
        const { data: u } = await sb.from("users").select("faction, faction_switch_at").eq("id", userId).single();
        const lastSwitch = u?.faction_switch_at ? new Date(u.faction_switch_at).getTime() : 0;
        if (Date.now() - lastSwitch < 30 * 86400000) {
          throw new Error(tBS("factionSwitchTooSoon"));
        }
        const newFaction = (u?.faction === "syndicate" || u?.faction === "gossenbund") ? "kronenwacht" : "gossenbund";
        await sb.from("users").update({
          faction: newFaction,
          faction_switch_at: new Date().toISOString(),
        }).eq("id", userId);
      } else if (sku === "mystery_box") {
        // Wahl-Box: User-Wahl wurde im Choice-Modal getroffen, ist in
        // wahlBoxChoice gespeichert. Kein Zufall mehr — DETERMINISTISCH.
        type Roll =
          | { kind: "xp"; xp: number }
          | { kind: "boost"; boost_hours: number; mult: number }
          | { kind: "streak"; streak: number }
          | { kind: "shouts"; shouts: number }
          | { kind: "trail"; trail: string }
          | { kind: "aura"; aura_days: number }
          | { kind: "rainbow"; rainbow_days: number };
        const choiceMap: Record<WahlBoxKind, Roll> = {
          xp_500:      { kind: "xp",      xp: 500 },
          xp_2000:     { kind: "xp",      xp: 2000 },
          xp_10000:    { kind: "xp",      xp: 10000 },
          boost_24:    { kind: "boost",   boost_hours: 24, mult: 2 },
          boost_48:    { kind: "boost",   boost_hours: 48, mult: 2 },
          streak_5:    { kind: "streak",  streak: 5 },
          shouts_10:   { kind: "shouts",  shouts: 10 },
          trail_golden:{ kind: "trail",   trail: "golden_trail" },
          trail_neon:  { kind: "trail",   trail: "neon_trail" },
          aura_30d:    { kind: "aura",    aura_days: 30 },
          rainbow_30d: { kind: "rainbow", rainbow_days: 30 },
        };
        if (!wahlBoxChoice) {
          await appAlert("Bitte wähle vorher eine Belohnung in der Wahl-Box.");
          return;
        }
        const r = choiceMap[wahlBoxChoice];
        // Choice nach Anwendung leeren, damit nächster Kauf wieder Modal öffnet.
        setWahlBoxChoice(null);
        if (r.kind === "xp") {
          const { data: u } = await sb.from("users").select("wegemuenzen").eq("id", userId).single();
          await sb.from("users").update({ wegemuenzen: (u?.wegemuenzen ?? 0) + r.xp }).eq("id", userId);
          appAlert(tBS("mysteryXp", { amount: r.xp.toLocaleString(numLocale) }));
        } else if (r.kind === "boost") {
          const { data: u } = await sb.from("users").select("xp_boost_until, xp_boost_multiplier").eq("id", userId).single();
          const stacked = stackBoostUntil(u?.xp_boost_until, u?.xp_boost_multiplier, r.boost_hours, r.mult);
          await sb.from("users").update({
            xp_boost_until: stacked.until,
            xp_boost_multiplier: stacked.mult,
          }).eq("id", userId);
          appAlert(tBS("mysteryBoost", { mult: r.mult, hours: r.boost_hours, capped: stacked.capped ? tBS("mysteryBoostCapped") : "" }));
        } else if (r.kind === "streak") {
          const { data: u } = await sb.from("users").select("streak_freezes_remaining").eq("id", userId).single();
          await sb.from("users").update({
            streak_freezes_remaining: (u?.streak_freezes_remaining ?? 0) + r.streak,
          }).eq("id", userId);
          appAlert(tBS("mysteryStreak", { count: r.streak }));
        } else if (r.kind === "shouts") {
          const { data: u } = await sb.from("users").select("shouts_remaining").eq("id", userId).single();
          await sb.from("users").update({
            shouts_remaining: (u?.shouts_remaining ?? 0) + r.shouts,
          }).eq("id", userId);
          appAlert(tBS("mysteryShout", { count: r.shouts }));
        } else if (r.kind === "trail") {
          await sb.from("users").update({ equipped_trail: r.trail }).eq("id", userId);
          appAlert(r.trail === "golden_trail" ? tBS("mysteryTrailGolden") : tBS("mysteryTrailNeon"));
        } else if (r.kind === "aura") {
          await sb.from("users").update({
            aura_until: new Date(Date.now() + r.aura_days * 86400000).toISOString(),
          }).eq("id", userId);
          appAlert(tBS("mysteryAura", { days: r.aura_days }));
        } else if (r.kind === "rainbow") {
          await sb.from("users").update({
            rainbow_name_until: new Date(Date.now() + r.rainbow_days * 86400000).toISOString(),
          }).eq("id", userId);
          appAlert(tBS("mysteryRainbow", { days: r.rainbow_days }));
        }
        onClose();
        location.reload();
        return;
      } else if (sku === "crew_boost_24h") {
        const { data: u } = await sb.from("users").select("current_crew_id").eq("id", userId).single();
        if (u?.current_crew_id) {
          const { data: c } = await sb.from("crews").select("xp_boost_until, xp_boost_multiplier").eq("id", u.current_crew_id).single();
          const stacked = stackBoostUntil(c?.xp_boost_until, c?.xp_boost_multiplier, 24, 2);
          await sb.from("crews").update({
            xp_boost_until: stacked.until,
            xp_boost_multiplier: stacked.mult,
          }).eq("id", u.current_crew_id);
          if (stacked.capped) {
            appAlert(tBS("crewBoostCapped"));
          }
        }
      }

      appAlert(tBS("purchasedActivated"));
      onClose();
      location.reload();
    } catch (e) {
      appAlert(tBS("errorPrefix", { message: e instanceof Error ? e.message : String(e) }));
    } finally {
      setLoading(null);
    }
  }

  const content = (
    <>
        <div style={{ marginBottom: 10 }}>
          <IapNotAvailableNotice />
        </div>
        <div style={{
          padding: "10px 12px", borderRadius: 10, marginBottom: 12,
          background: "rgba(255,215,0,0.07)", border: "1px dashed rgba(255,215,0,0.35)",
          fontSize: 11, lineHeight: 1.5, color: "#a8b4cf",
        }}>
          <div style={{ color: "#FFD700", fontWeight: 900, marginBottom: 4, letterSpacing: 0.5 }}>{tBS("howBoostsHeader")}</div>
          <div>{tBS.rich("howBoostsLine1", { b: (c) => <b style={{ color: "#FFF" }}>{c}</b> })}</div>
          <div>{tBS.rich("howBoostsLine2", { b: (c) => <b style={{ color: "#FFF" }}>{c}</b> })}</div>
          <div>{tBS.rich("howBoostsLine3", { b: (c) => <b style={{ color: "#FFF" }}>{c}</b> })}</div>
        </div>
        <style>{`.ma365-hide-scrollbar::-webkit-scrollbar { display: none; }`}</style>
        <div className="ma365-hide-scrollbar" style={{ display: "flex", gap: 4, padding: 4, background: "rgba(255,255,255,0.05)", borderRadius: 10, marginBottom: 14, overflowX: "auto", scrollbarWidth: "none", msOverflowStyle: "none" }}>
          <TabBtn active={tab === "boosts"} onClick={() => setTab("boosts")}>{tBS("tabBoosts")}</TabBtn>
          <TabBtn active={tab === "xp"} onClick={() => setTab("xp")}>{tBS("tabXp")}</TabBtn>
          <TabBtn active={tab === "gameplay"} onClick={() => setTab("gameplay")}>{tBS("tabGameplay")}</TabBtn>
          <TabBtn active={tab === "cosmetics"} onClick={() => setTab("cosmetics")}>{tBS("tabCosmetics")}</TabBtn>
          <TabBtn active={tab === "extras"} onClick={() => setTab("extras")}>{tBS("tabExtras")}</TabBtn>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {(
            tab === "boosts"    ? Object.values(BOOST_PACKS) :
            tab === "xp"        ? Object.values(XP_PACKS) :
            tab === "gameplay"  ? Object.values(GAMEPLAY_ITEMS) :
            tab === "cosmetics" ? Object.values(COSMETICS) :
                                  Object.values(EXTRAS)
          ).map((p) => {
            const pp = p as { hours?: number; multiplier?: number; desc?: string; xp?: number };
            const desc = pp.hours !== undefined && pp.multiplier !== undefined
              ? `${pp.multiplier}× 🪙 · ${pp.hours >= 168 ? `${pp.hours / 168} Woche` : `${pp.hours} h`}`
              : typeof pp.desc === "string" ? pp.desc
              : typeof pp.xp === "number" ? `+${pp.xp.toLocaleString("de-DE")} 🪙 direkt aufs Konto`
              : "";
            const isBadge = p.sku.startsWith("badge_");
            const icon = "icon" in p && typeof p.icon === "string" ? p.icon : "🎁";
            return (
              <div key={p.sku} style={{
                display: "flex", alignItems: "center", gap: 10,
                padding: 12, borderRadius: 12,
                background: "rgba(70, 82, 122, 0.45)",
                border: "1px solid rgba(255,255,255,0.1)",
              }}>
                <span style={{ fontSize: 22 }}>{icon}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ color: "#FFF", fontSize: 13, fontWeight: 800, display: "flex", alignItems: "center", gap: 6 }}>
                    {p.name}
                    {isBadge && (
                      <span style={{
                        fontSize: 9, fontWeight: 900, letterSpacing: 0.5,
                        padding: "2px 6px", borderRadius: 4,
                        background: "rgba(34,209,195,0.2)", color: "#22D1C3",
                        border: "1px solid rgba(34,209,195,0.4)",
                      }}>{tBS("subscriptionBadge")}</span>
                    )}
                  </div>
                  {desc && <div style={{ color: "#a8b4cf", fontSize: 10 }}>{desc}</div>}
                  {isBadge && <div style={{ color: "#a8b4cf", fontSize: 10 }}>{tBS("subscriptionMonthly")}</div>}
                  {p.sku === "crew_boost_24h" && (
                    <div style={{ color: "#FFD700", fontSize: 9, marginTop: 2 }}>
                      {tBS("crewStackHint")}
                    </div>
                  )}
                </div>
                <button
                  onClick={() => clickItem(p.sku, p.name, p.price)}
                  disabled={loading === p.sku}
                  style={{
                    background: "#FFD700", color: "#0F1115",
                    padding: "6px 14px", borderRadius: 8, border: "none", cursor: "pointer",
                    fontSize: 12, fontWeight: 900,
                    opacity: loading === p.sku ? 0.6 : 1,
                  }}
                >
                  {loading === p.sku ? "…" : (p.sku === "mystery_box" ? "Auswählen →" : formatPrice(p.price))}
                </button>
              </div>
            );
          })}
        </div>

        <div style={{ textAlign: "center", fontSize: 10, color: "#a8b4cf", marginTop: 12 }}>
          {tBS("stripeNote")}
        </div>
      {checkoutSecret && (
        <StripeCheckoutModal clientSecret={checkoutSecret} onClose={() => setCheckoutSecret(null)} />
      )}
      {wahlBoxOpen && (
        <WahlBoxChoiceModal
          onCancel={() => setWahlBoxOpen(false)}
          onPick={(kind) => {
            setWahlBoxChoice(kind);
            setWahlBoxOpen(false);
            void buy("mystery_box", "Wahl-Box", 299);
          }}
        />
      )}
    </>
  );

  if (embedded) return <div style={{ color: "#F0F0F0" }}>{content}</div>;

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 1000, display: "flex", alignItems: "flex-end", justifyContent: "center",
      background: "rgba(15,17,21,0.75)", backdropFilter: "blur(6px)",
    }} onClick={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "100%", maxWidth: 520, maxHeight: "85vh", overflowY: "auto",
          background: "#1A1D23", border: "1px solid rgba(255,215,0,0.4)", borderRadius: "20px 20px 0 0",
          padding: 24, color: "#F0F0F0",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ fontSize: 24 }}>⚡</span>
            <div>
              <div style={{ fontSize: 18, fontWeight: 900 }}>{tBS("title")}</div>
              <div style={{ fontSize: 11, color: "#a8b4cf" }}>{tBS("subtitle")}</div>
            </div>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", color: "#a8b4cf", fontSize: 22, cursor: "pointer" }}>✕</button>
        </div>
        {content}
      </div>
    </div>
  );
}

function TabBtn({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick} style={{
      flexShrink: 0, padding: "8px 12px", borderRadius: 8, border: "none", cursor: "pointer",
      background: active ? "#FFD700" : "transparent",
      color: active ? "#0F1115" : "#F0F0F0",
      fontSize: 11, fontWeight: 800, whiteSpace: "nowrap",
    }}>{children}</button>
  );
}

// ─── Wahl-Box-Choice-Modal ────────────────────────────────────────
// EU-konformer Ersatz für die alte Mystery-Box: User wählt eine
// Belohnung aus 11 fixen Optionen, kein Zufall — also kein Glücks-
// spiel-Mechanismus unter den BE/NL/ES-Loot-Box-Regulierungen.
type WahlBoxKindUI =
  | "xp_500" | "xp_2000" | "xp_10000"
  | "boost_24" | "boost_48"
  | "streak_5" | "shouts_10"
  | "trail_golden" | "trail_neon"
  | "aura_30d" | "rainbow_30d";

const WAHL_BOX_OPTIONS_UI: Array<{ kind: WahlBoxKindUI; icon: string; title: string; desc: string }> = [
  { kind: "xp_10000",    icon: "🪙", title: "10 000 Wegemünzen",    desc: "Direkt aufs Konto" },
  { kind: "xp_2000",     icon: "🪙", title: "2 000 Wegemünzen",     desc: "Mittlerer Boost" },
  { kind: "xp_500",      icon: "🪙", title: "500 Wegemünzen",       desc: "Snack-Pack" },
  { kind: "boost_48",    icon: "⚡", title: "48 h × 2 Boost",       desc: "Doppelte Wegemünzen, 2 Tage" },
  { kind: "boost_24",    icon: "⚡", title: "24 h × 2 Boost",       desc: "Doppelte Wegemünzen, 1 Tag" },
  { kind: "streak_5",    icon: "❄️", title: "5 Streak-Freezes",     desc: "Tages-Streak schützen" },
  { kind: "shouts_10",   icon: "📣", title: "10 Crew-Shouts",       desc: "Aufmerksamkeit ziehen" },
  { kind: "trail_golden",icon: "✨", title: "Goldener Trail",       desc: "Permanent — Cosmetic" },
  { kind: "trail_neon",  icon: "💚", title: "Neon Trail",           desc: "Permanent — Cosmetic" },
  { kind: "aura_30d",    icon: "💫", title: "30 Tage Aura",         desc: "Sichtbar auf der Karte" },
  { kind: "rainbow_30d", icon: "🌈", title: "30 Tage Rainbow-Name", desc: "Animierter Name" },
];

function WahlBoxChoiceModal({
  onCancel,
  onPick,
}: {
  onCancel: () => void;
  onPick: (kind: WahlBoxKindUI) => void;
}) {
  return (
    <div onClick={onCancel} style={{
      position: "fixed", inset: 0, zIndex: 9300,
      background: "rgba(0,0,0,0.78)", backdropFilter: "blur(6px)",
      display: "flex", alignItems: "center", justifyContent: "center", padding: 16,
    }}>
      <div onClick={(e) => e.stopPropagation()} style={{
        width: "100%", maxWidth: 540, maxHeight: "88vh",
        background: "linear-gradient(180deg, #14181f 0%, #0F1115 100%)",
        borderRadius: 18, border: "1px solid rgba(255,215,0,0.4)",
        boxShadow: "0 8px 30px rgba(0,0,0,0.6)",
        overflow: "hidden", display: "flex", flexDirection: "column",
      }}>
        <div style={{ padding: 18, borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
          <div style={{ color: "#FFD700", fontSize: 10, fontWeight: 900, letterSpacing: 2 }}>🎁 WAHL-BOX · € 2,99</div>
          <div style={{ color: "#FFF", fontSize: 18, fontWeight: 900, marginTop: 4 }}>Wähle deine Belohnung</div>
          <div style={{ color: "#a8b4cf", fontSize: 11, marginTop: 4, lineHeight: 1.4 }}>
            Du bestimmst, was du bekommst — kein Zufall. Erst auswählen, dann zahlen. EU-konform.
          </div>
        </div>
        <div style={{ overflowY: "auto", padding: 14, display: "grid", gap: 8 }}>
          {WAHL_BOX_OPTIONS_UI.map((o) => (
            <button key={o.kind} onClick={() => onPick(o.kind)} style={{
              display: "flex", alignItems: "center", gap: 12,
              padding: "12px 14px", borderRadius: 12,
              background: "rgba(255,215,0,0.05)", border: "1px solid rgba(255,215,0,0.25)",
              color: "#FFF", textAlign: "left", cursor: "pointer",
            }}>
              <span style={{ fontSize: 24 }}>{o.icon}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 800, fontSize: 13 }}>{o.title}</div>
                <div style={{ color: "#a8b4cf", fontSize: 11 }}>{o.desc}</div>
              </div>
              <span style={{ color: "#FFD700", fontSize: 14, fontWeight: 900 }}>›</span>
            </button>
          ))}
        </div>
        <div style={{ padding: 12, borderTop: "1px solid rgba(255,255,255,0.08)", textAlign: "center" }}>
          <button onClick={onCancel} style={{
            background: "transparent", color: "#a8b4cf", border: "none",
            fontSize: 12, fontWeight: 700, cursor: "pointer", padding: "8px 14px",
          }}>Abbrechen</button>
        </div>
      </div>
    </div>
  );
}
