"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { BOOST_PACKS, EXTRAS, XP_PACKS, GAMEPLAY_ITEMS, COSMETICS, formatPrice, stackBoostUntil } from "@/lib/monetization";
import { appAlert } from "@/components/app-dialog";
import { StripeCheckoutModal } from "@/components/stripe-embedded-checkout";

type ShopTab = "boosts" | "xp" | "gameplay" | "cosmetics" | "extras";

export function BoostShopBody({ userId, onDone }: { userId: string; onDone?: () => void }) {
  return <BoostShopInner userId={userId} onClose={() => onDone?.()} embedded />;
}

export function BoostShopModal({ userId, onClose }: { userId: string; onClose: () => void }) {
  return <BoostShopInner userId={userId} onClose={onClose} embedded={false} />;
}

function BoostShopInner({ userId, onClose, embedded }: { userId: string; onClose: () => void; embedded: boolean }) {
  const sb = createClient();
  const [tab, setTab] = useState<ShopTab>("boosts");
  const [loading, setLoading] = useState<string | null>(null);
  const [checkoutSecret, setCheckoutSecret] = useState<string | null>(null);

  async function buy(sku: string, name: string, price: number) {
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
        throw new Error(json.error ?? "Checkout fehlgeschlagen");
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
            appAlert("Boost-Zeit auf 14 Tage gecappt — der Rest wäre verloren gegangen.");
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
          throw new Error("Fraktions-Wechsel nur alle 30 Tage möglich!");
        }
        const newFaction = u?.faction === "syndicate" ? "vanguard" : "syndicate";
        await sb.from("users").update({
          faction: newFaction,
          faction_switch_at: new Date().toISOString(),
        }).eq("id", userId);
      } else if (sku === "mystery_box") {
        type Roll =
          | { kind: "xp"; xp: number }
          | { kind: "boost"; boost_hours: number; mult: number }
          | { kind: "streak"; streak: number }
          | { kind: "shouts"; shouts: number }
          | { kind: "trail"; trail: string }
          | { kind: "aura"; aura_days: number }
          | { kind: "rainbow"; rainbow_days: number };
        const rolls: Roll[] = [
          { kind: "xp", xp: 500 }, { kind: "xp", xp: 2000 }, { kind: "xp", xp: 10000 },
          { kind: "boost", boost_hours: 24, mult: 2 }, { kind: "boost", boost_hours: 48, mult: 2 },
          { kind: "streak", streak: 5 }, { kind: "shouts", shouts: 10 },
          { kind: "trail", trail: "golden_trail" }, { kind: "trail", trail: "neon_trail" },
          { kind: "aura", aura_days: 30 }, { kind: "rainbow", rainbow_days: 30 },
        ];
        const r = rolls[Math.floor(Math.random() * rolls.length)];
        if (r.kind === "xp") {
          const { data: u } = await sb.from("users").select("wegemuenzen").eq("id", userId).single();
          await sb.from("users").update({ wegemuenzen: (u?.wegemuenzen ?? 0) + r.xp }).eq("id", userId);
          appAlert(`🎁 Mystery Box: +${r.xp.toLocaleString("de-DE")} 🪙 Wegemünzen!`);
        } else if (r.kind === "boost") {
          const { data: u } = await sb.from("users").select("xp_boost_until, xp_boost_multiplier").eq("id", userId).single();
          const stacked = stackBoostUntil(u?.xp_boost_until, u?.xp_boost_multiplier, r.boost_hours, r.mult);
          await sb.from("users").update({
            xp_boost_until: stacked.until,
            xp_boost_multiplier: stacked.mult,
          }).eq("id", userId);
          appAlert(`🎁 Mystery Box: ${r.mult}× 🪙 für ${r.boost_hours}h!${stacked.capped ? " (auf 14d gecappt)" : ""}`);
        } else if (r.kind === "streak") {
          const { data: u } = await sb.from("users").select("streak_freezes_remaining").eq("id", userId).single();
          await sb.from("users").update({
            streak_freezes_remaining: (u?.streak_freezes_remaining ?? 0) + r.streak,
          }).eq("id", userId);
          appAlert(`🎁 Mystery Box: ${r.streak}× Streak-Freeze!`);
        } else if (r.kind === "shouts") {
          const { data: u } = await sb.from("users").select("shouts_remaining").eq("id", userId).single();
          await sb.from("users").update({
            shouts_remaining: (u?.shouts_remaining ?? 0) + r.shouts,
          }).eq("id", userId);
          appAlert(`🎁 Mystery Box: ${r.shouts}× Kiez-Shout!`);
        } else if (r.kind === "trail") {
          await sb.from("users").update({ equipped_trail: r.trail }).eq("id", userId);
          appAlert(`🎁 Mystery Box: ${r.trail === "golden_trail" ? "Golden" : "Neon"} Trail aktiviert!`);
        } else if (r.kind === "aura") {
          await sb.from("users").update({
            aura_until: new Date(Date.now() + r.aura_days * 86400000).toISOString(),
          }).eq("id", userId);
          appAlert(`🎁 Mystery Box: Aura-Effekt für ${r.aura_days} Tage!`);
        } else if (r.kind === "rainbow") {
          await sb.from("users").update({
            rainbow_name_until: new Date(Date.now() + r.rainbow_days * 86400000).toISOString(),
          }).eq("id", userId);
          appAlert(`🎁 Mystery Box: Rainbow-Name für ${r.rainbow_days} Tage!`);
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
            appAlert("Crew-Boost auf 14 Tage gecappt — der Rest wäre verloren gegangen.");
          }
        }
      }

      appAlert("Gekauft + aktiviert! (Stripe-Integration folgt)");
      onClose();
      location.reload();
    } catch (e) {
      appAlert("Fehler: " + (e instanceof Error ? e.message : String(e)));
    } finally {
      setLoading(null);
    }
  }

  const content = (
    <>
        <div style={{
          padding: "10px 12px", borderRadius: 10, marginBottom: 12,
          background: "rgba(255,215,0,0.07)", border: "1px dashed rgba(255,215,0,0.35)",
          fontSize: 11, lineHeight: 1.5, color: "#a8b4cf",
        }}>
          <div style={{ color: "#FFD700", fontWeight: 900, marginBottom: 4, letterSpacing: 0.5 }}>⚡ SO FUNKTIONIEREN BOOSTS</div>
          <div>• Zeit wird <b style={{ color: "#FFF" }}>aufaddiert</b> (gleicher Multiplikator) — max. <b style={{ color: "#FFF" }}>14 Tage</b> Restzeit.</div>
          <div>• Personal- &amp; Crew-Boost <b style={{ color: "#FFF" }}>kombinieren sich nicht</b> — es gilt der höhere Wert (2× + 2× = 2×, nicht 4×).</div>
          <div>• Boost zählt für <b style={{ color: "#FFF" }}>Level, Achievements, Deals &amp; Leaderboards</b>. Kein versteckter Haken.</div>
        </div>
        <div style={{ display: "flex", gap: 4, padding: 4, background: "rgba(255,255,255,0.05)", borderRadius: 10, marginBottom: 14, overflowX: "auto" }}>
          <TabBtn active={tab === "boosts"} onClick={() => setTab("boosts")}>⚡ Boosts</TabBtn>
          <TabBtn active={tab === "xp"} onClick={() => setTab("xp")}>🪙 Wegemünzen</TabBtn>
          <TabBtn active={tab === "gameplay"} onClick={() => setTab("gameplay")}>🎮 Gameplay</TabBtn>
          <TabBtn active={tab === "cosmetics"} onClick={() => setTab("cosmetics")}>🎨 Skins</TabBtn>
          <TabBtn active={tab === "extras"} onClick={() => setTab("extras")}>🎁 Extras</TabBtn>
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
                      }}>ABO</span>
                    )}
                  </div>
                  {desc && <div style={{ color: "#a8b4cf", fontSize: 10 }}>{desc}</div>}
                  {isBadge && <div style={{ color: "#a8b4cf", fontSize: 10 }}>monatlich · jederzeit kündbar</div>}
                  {p.sku === "crew_boost_24h" && (
                    <div style={{ color: "#FFD700", fontSize: 9, marginTop: 2 }}>
                      ℹ️ Stapelt nicht mit Personal-Boost — es gilt der höhere Wert
                    </div>
                  )}
                </div>
                <button
                  onClick={() => buy(p.sku, p.name, p.price)}
                  disabled={loading === p.sku}
                  style={{
                    background: "#FFD700", color: "#0F1115",
                    padding: "6px 14px", borderRadius: 8, border: "none", cursor: "pointer",
                    fontSize: 12, fontWeight: 900,
                    opacity: loading === p.sku ? 0.6 : 1,
                  }}
                >
                  {loading === p.sku ? "…" : formatPrice(p.price)}
                </button>
              </div>
            );
          })}
        </div>

        <div style={{ textAlign: "center", fontSize: 10, color: "#a8b4cf", marginTop: 12 }}>
          Stripe-Integration folgt · aktuell Demo-Aktivierung
        </div>
      {checkoutSecret && (
        <StripeCheckoutModal clientSecret={checkoutSecret} onClose={() => setCheckoutSecret(null)} />
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
              <div style={{ fontSize: 18, fontWeight: 900 }}>Power-Shop</div>
              <div style={{ fontSize: 11, color: "#a8b4cf" }}>Wegemünzen-Boosts & Extras</div>
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
