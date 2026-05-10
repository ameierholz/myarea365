"use client";

import { useState } from "react";
import { useTranslations, useLocale } from "next-intl";
import { getNumberLocale } from "@/i18n/config";
import { createClient } from "@/lib/supabase/client";
import { BOOST_PACKS, GAMEPLAY_ITEMS, formatPrice, stackBoostUntil } from "@/lib/monetization";
import { GEM_BUNDLES, totalGemsOfBundle } from "@/lib/gem-bundles";
import { CREW_GEM_PACKS, CREW_SLOT_PACKS } from "@/lib/monetization";
import { ALL_PLAYSTYLES, normalizePlaystyle, type PlaystyleId } from "@/lib/playstyles";
import { appAlert } from "@/components/app-dialog";
import { StripeCheckoutModal } from "@/components/stripe-embedded-checkout";
import { IapNotAvailableNotice } from "@/components/iap-not-available-notice";
import { Modal, ModalHeader, ModalBody, Z } from "@/components/ui";

type ShopTab = "gems" | "wahlbox" | "crew" | "items";

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
  const [tab, setTab] = useState<ShopTab>("gems");
  const [loading, setLoading] = useState<string | null>(null);
  const [checkoutSecret, setCheckoutSecret] = useState<string | null>(null);

  // Wahl-Box (ehemals Mystery-Box) — User wählt VORHER, kein Zufall.
  // Verhindert dass die Box als „Loot-Box" unter EU-Regulierung fällt
  // (Belgien/Niederlande/Spanien). Kann auch BE/NL/ES sicher angezeigt werden.
  // Diese 11 Belohnungen MÜSSEN 1:1 mit WAHL_BOX_OPTIONS in
  // apps/web/src/lib/loot-drops-public.ts übereinstimmen — die Drop-Raten-
  // Seite ist die öffentliche Compliance-Quelle.
  type WahlBoxKind =
    | "gems_500" | "gems_200" | "gems_50"
    | "tech_10k" | "components_10k" | "crypto_5k" | "bandwidth_5k"
    | "speed_48h"
    | "guardian_xp"
    | "pin_theme_token" | "map_icon_token";
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
      // Diamanten-Pakete (Premium-Currency)
      if (sku.startsWith("gems_")) {
        const bundle = GEM_BUNDLES.find((b) => b.sku === sku);
        if (bundle) {
          const total = totalGemsOfBundle(bundle);
          const { data: g } = await sb.from("user_gems").select("gems").eq("user_id", userId).maybeSingle();
          if (g) {
            await sb.from("user_gems").update({ gems: (g.gems ?? 0) + total }).eq("user_id", userId);
          } else {
            await sb.from("user_gems").insert({ user_id: userId, gems: total });
          }
          appAlert(`+${total.toLocaleString(numLocale)} 💎 auf dein Konto.`);
        }
      }
      // Crew-Diamanten (in Crew-Pool)
      else if (sku.startsWith("crew_gems_")) {
        const pack = (CREW_GEM_PACKS as Record<string, { gems: number; bonus: number }>)[sku];
        const { data: u } = await sb.from("users").select("current_crew_id").eq("id", userId).single();
        if (pack && u?.current_crew_id) {
          const total = pack.gems + pack.bonus;
          const { data: c } = await sb.from("crews").select("gem_pool").eq("id", u.current_crew_id).maybeSingle();
          await sb.from("crews").update({
            gem_pool: ((c?.gem_pool as number | undefined) ?? 0) + total,
          }).eq("id", u.current_crew_id);
          appAlert(`+${total.toLocaleString(numLocale)} 💎 in den Crew-Pool.`);
        }
      }
      // Crew-Mitglieder-Slots
      else if (sku.startsWith("crew_slots_")) {
        const pack = (CREW_SLOT_PACKS as Record<string, { slots: number }>)[sku];
        const { data: u } = await sb.from("users").select("current_crew_id").eq("id", userId).single();
        if (pack && u?.current_crew_id) {
          const { data: c } = await sb.from("crews").select("max_members").eq("id", u.current_crew_id).maybeSingle();
          await sb.from("crews").update({
            max_members: ((c?.max_members as number | undefined) ?? 50) + pack.slots,
          }).eq("id", u.current_crew_id);
          appAlert(`+${pack.slots} Mitglieder-Slots für deine Crew.`);
        }
      }
      // Spielstil-Wechsel (ehemals faction_switch — jetzt auf Playstyles
      // architect/warlord/strategist/diplomat). Cooldown 30 Tage.
      else if (sku === "faction_switch") {
        const { data: u } = await sb.from("users").select("faction, faction_switch_at").eq("id", userId).single();
        const lastSwitch = u?.faction_switch_at ? new Date(u.faction_switch_at).getTime() : 0;
        if (Date.now() - lastSwitch < 30 * 86400000) {
          throw new Error(tBS("factionSwitchTooSoon"));
        }
        const current: PlaystyleId | null = normalizePlaystyle(u?.faction);
        // Cycle through the 4 playstyles in fixed order; falls aktueller
        // Style unbekannt ist, lande auf "architect".
        const order: PlaystyleId[] = ["architect", "warlord", "strategist", "diplomat"];
        const idx = current ? order.indexOf(current) : -1;
        const next = order[(idx + 1) % order.length];
        await sb.from("users").update({
          faction: next,
          faction_switch_at: new Date().toISOString(),
        }).eq("id", userId);
        appAlert(`Spielstil gewechselt: ${ALL_PLAYSTYLES.find((p) => p.id === next)?.label ?? next}`);
      }
      else if (sku === "mystery_box") {
        // Wahl-Box: User-Wahl wurde im Choice-Modal getroffen.
        // Belohnungen MÜSSEN 1:1 mit /loot-drops (WAHL_BOX_OPTIONS) übereinstimmen.
        if (!wahlBoxChoice) {
          await appAlert("Bitte wähle vorher eine Belohnung in der Wahl-Box.");
          return;
        }
        const choice = wahlBoxChoice;
        setWahlBoxChoice(null);

        // Diamanten — user_gems.gems
        if (choice === "gems_500" || choice === "gems_200" || choice === "gems_50") {
          const amount = choice === "gems_500" ? 500 : choice === "gems_200" ? 200 : 50;
          const { data: g } = await sb.from("user_gems").select("gems").eq("user_id", userId).maybeSingle();
          if (g) {
            await sb.from("user_gems").update({ gems: (g.gems ?? 0) + amount }).eq("user_id", userId);
          } else {
            await sb.from("user_gems").insert({ user_id: userId, gems: amount });
          }
          appAlert(`+${amount.toLocaleString(numLocale)} 💎 auf dein Konto.`);
        }
        // Crew-Resourcen — user_resources (DB-Spalten wood/stone/gold/mana = UI Tech-Schrott/Komponenten/Krypto/Bandbreite)
        else if (
          choice === "tech_10k" || choice === "components_10k" ||
          choice === "crypto_5k" || choice === "bandwidth_5k" || choice === "speed_48h"
        ) {
          const colMap = {
            tech_10k:       { col: "wood",         delta: 10000, label: "10.000 Tech-Schrott" },
            components_10k: { col: "stone",        delta: 10000, label: "10.000 Komponenten" },
            crypto_5k:      { col: "gold",         delta: 5000,  label: "5.000 Krypto" },
            bandwidth_5k:   { col: "mana",         delta: 5000,  label: "5.000 Bandbreite" },
            speed_48h:      { col: "speed_tokens", delta: 48 * 60, label: "48 h Bauzeit-Verkürzer (2.880 Tokens)" },
          } as const;
          const { col, delta, label } = colMap[choice];
          const { data: r } = await sb.from("user_resources").select(col).eq("user_id", userId).maybeSingle();
          const current = ((r as Record<string, number> | null)?.[col] as number | undefined) ?? 0;
          if (r) {
            await sb.from("user_resources").update({ [col]: current + delta }).eq("user_id", userId);
          } else {
            await sb.from("user_resources").insert({ user_id: userId, [col]: delta });
          }
          appAlert(`+${label}`);
        }
        // Wächter-XP — Item ins Inventar (User wendet auf Wunsch-Wächter an)
        else if (choice === "guardian_xp") {
          const itemId = "medium_xp_potion";
          const { data: inv } = await sb
            .from("user_guardian_xp_items")
            .select("count")
            .eq("user_id", userId)
            .eq("item_id", itemId)
            .maybeSingle();
          if (inv) {
            await sb.from("user_guardian_xp_items")
              .update({ count: (inv.count ?? 0) + 1 })
              .eq("user_id", userId).eq("item_id", itemId);
          } else {
            await sb.from("user_guardian_xp_items")
              .insert({ user_id: userId, item_id: itemId, count: 1 });
          }
          appAlert("+1 Wächter-XP-Boost im Inventar — anwendbar im Wächter-Modal.");
        }
        // Cosmetic-Token — User wählt Theme/Icon im Cosmetic-Hub aus
        else if (choice === "pin_theme_token" || choice === "map_icon_token") {
          const tokenSku = choice === "pin_theme_token" ? "token_pin_theme" : "token_map_icon";
          await sb.from("user_shop_purchases").insert({
            user_id: userId, shop_item_id: tokenSku,
          });
          appAlert(
            choice === "pin_theme_token"
              ? "+1 Pin-Theme-Token — wähle dein Theme im Cosmetic-Hub."
              : "+1 Map-Icon-Token — wähle dein Icon im Cosmetic-Hub."
          );
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
          <TabBtn active={tab === "gems"}    onClick={() => setTab("gems")}>💎 Diamanten</TabBtn>
          <TabBtn active={tab === "wahlbox"} onClick={() => setTab("wahlbox")}>🎁 Wahl-Box</TabBtn>
          <TabBtn active={tab === "crew"}    onClick={() => setTab("crew")}>👥 Crew</TabBtn>
          <TabBtn active={tab === "items"}   onClick={() => setTab("items")}>🎮 Items</TabBtn>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {(
            tab === "gems"    ? GEM_BUNDLES.map((b) => ({
                                  sku: b.sku,
                                  name: `${totalGemsOfBundle(b).toLocaleString("de-DE")} 💎`,
                                  price: b.price_cents,
                                  icon: "💎",
                                  desc: b.bonus > 0 ? `+${b.bonus.toLocaleString("de-DE")} Bonus-Diamanten` : undefined,
                                })) :
            tab === "wahlbox" ? Object.values(GAMEPLAY_ITEMS).filter((it) => it.sku === "mystery_box") :
            tab === "crew"    ? [
                                  ...Object.values(BOOST_PACKS),
                                  ...Object.values(CREW_GEM_PACKS).map((p) => ({
                                    sku: p.sku, name: p.name, price: p.price, icon: p.icon,
                                    desc: `${(p.gems + p.bonus).toLocaleString("de-DE")} 💎 in den Crew-Pool` + (p.bonus > 0 ? ` (inkl. ${p.bonus.toLocaleString("de-DE")} Bonus)` : ""),
                                  })),
                                  ...Object.values(CREW_SLOT_PACKS).map((p) => ({
                                    sku: p.sku, name: p.name, price: p.price, icon: p.icon,
                                    desc: `+${p.slots} Slots für Crew-Mitglieder`,
                                  })),
                                ] :
                                  Object.values(GAMEPLAY_ITEMS).filter((it) => it.sku !== "mystery_box")
          ).map((p) => {
            const pp = p as { desc?: string };
            const desc = typeof pp.desc === "string" ? pp.desc : "";
            const isBadge = false;
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
    <Modal open={true} onClose={onClose} size="md" variant="drawer" zIndex={Z.modal}>
      <ModalHeader
        kicker="⚡ BOOSTER"
        title={tBS("title")}
        subtitle={tBS("subtitle")}
        onClose={onClose}
        accent="gold"
      />
      <ModalBody padding="padded">{content}</ModalBody>
    </Modal>
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
  | "gems_500" | "gems_200" | "gems_50"
  | "tech_10k" | "components_10k" | "crypto_5k" | "bandwidth_5k"
  | "speed_48h"
  | "guardian_xp"
  | "pin_theme_token" | "map_icon_token";

const WAHL_BOX_OPTIONS_UI: Array<{ kind: WahlBoxKindUI; icon: string; title: string; desc: string }> = [
  { kind: "gems_500",        icon: "💎", title: "500 Diamanten",          desc: "Direkt aufs Konto" },
  { kind: "gems_200",        icon: "💎", title: "200 Diamanten",          desc: "Direkt aufs Konto" },
  { kind: "gems_50",         icon: "💎", title: "50 Diamanten",           desc: "Direkt aufs Konto" },
  { kind: "tech_10k",        icon: "🔧", title: "10 000 Tech-Schrott",    desc: "Resource für Bauen" },
  { kind: "components_10k",  icon: "⚙️", title: "10 000 Komponenten",     desc: "Resource für Bauen" },
  { kind: "crypto_5k",       icon: "₿",  title: "5 000 Krypto",           desc: "Resource für Bauen" },
  { kind: "bandwidth_5k",    icon: "📡", title: "5 000 Bandbreite",       desc: "Resource für Forschen" },
  { kind: "speed_48h",       icon: "⚡", title: "48 h Bauzeit-Verkürzer", desc: "Beschleunigt Bauen für 48 h" },
  { kind: "guardian_xp",     icon: "🔮", title: "Wächter-XP-Boost",       desc: "+2.500 XP für deinen Wächter" },
  { kind: "pin_theme_token", icon: "✨", title: "Pin-Theme freischalten", desc: "Eines aus 18 Auras (Cosmetic)" },
  { kind: "map_icon_token",  icon: "🎨", title: "Map-Icon freischalten",  desc: "Strategie-Marker (Cosmetic)" },
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
