"use client";

import { useEffect, useState } from "react";

const PRIMARY = "#22D1C3";
const GOLD = "#FFD700";
const PINK = "#FF2D78";

type Subscription = { id: string; title: string; description?: string; price_cents_monthly: number; daily_gems: number; perks: string[] };
type BPSeason = { id: string; title: string; starts_at: string; ends_at: string; price_premium_cents: number; price_premium_plus_cents: number };
type MonthlyPack = { sku: string; name: string; price_eur: number; duration_days: number; daily_gems: number; instant_gems: number };

type Data = {
  subscriptions: Subscription[];
  battle_pass: BPSeason | null;
  monthly_packs: MonthlyPack[];
  active: { subscription_id?: string; bp_tier?: string; monthly_owned?: string[] };
};

const fmtPrice = (cents: number) => `EUR ${(cents / 100).toFixed(2).replace(".", ",")}`;
const fmtPriceEur = (eur: number) => `EUR ${eur.toFixed(2).replace(".", ",")}`;

export function PremiumShopBody() {
  const [data, setData] = useState<Data | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [section, setSection] = useState<"subs" | "battlepass" | "monthly" | "growth">("subs");

  useEffect(() => {
    void (async () => {
      try {
        const [dr, mr] = await Promise.all([
          fetch("/api/monetization/deals", { cache: "no-store" }).then((r) => r.json()),
          fetch("/api/runner/monthly-packs", { cache: "no-store" }).then((r) => r.json()).catch(() => ({ skus: [], owned: [] })),
        ]);
        setData({
          subscriptions: dr.subscriptions ?? [],
          battle_pass: dr.battle_pass_season ?? null,
          monthly_packs: mr.skus ?? [],
          active: {
            subscription_id: dr.progress?.subscription?.subscription_id,
            bp_tier: dr.progress?.battle_pass?.tier,
            monthly_owned: (mr.owned ?? []).map((o: { sku: string }) => o.sku),
          },
        });
      } catch { /* ignore */ }
    })();
  }, []);

  async function checkout(sku: string) {
    setBusy(sku);
    try {
      const r = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ sku }),
      });
      const j = await r.json() as { url?: string; error?: string };
      if (j.url) window.location.href = j.url;
      else if (j.error) alert(j.error);
    } finally { setBusy(null); }
  }

  if (!data) return <div style={{ color: "#a8b4cf", fontSize: 12, textAlign: "center", padding: 24 }}>Lade Premium-Angebote…</div>;

  const SECTIONS: Array<{ id: typeof section; label: string; icon: string; color: string }> = [
    { id: "subs",       label: "Abos",         icon: "👑", color: GOLD },
    { id: "battlepass", label: "Battle Pass",  icon: "📜", color: PINK },
    { id: "monthly",    label: "Monats-Pack",  icon: "🎁", color: PRIMARY },
    { id: "growth",     label: "Growth Fund",  icon: "📈", color: "#a855f7" },
  ];

  return (
    <div>
      {/* Section-Pills */}
      <div style={{ display: "flex", gap: 6, overflowX: "auto", marginBottom: 14, paddingBottom: 4, scrollbarWidth: "none" }}>
        {SECTIONS.map((s) => {
          const active = section === s.id;
          return (
            <button key={s.id} onClick={() => setSection(s.id)} style={{
              flexShrink: 0, padding: "8px 12px", borderRadius: 999,
              background: active ? `${s.color}33` : "rgba(255,255,255,0.04)",
              border: active ? `1px solid ${s.color}` : "1px solid rgba(255,255,255,0.08)",
              color: active ? "#FFF" : "#a8b4cf",
              fontSize: 12, fontWeight: active ? 900 : 700, cursor: "pointer",
              display: "inline-flex", alignItems: "center", gap: 6, whiteSpace: "nowrap",
            }}>
              <span style={{ fontSize: 14 }}>{s.icon}</span>{s.label}
            </button>
          );
        })}
      </div>

      {/* SUBS */}
      {section === "subs" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {data.subscriptions.length === 0 && (
            <div style={{ color: "#8B8FA3", fontSize: 12, textAlign: "center", padding: 24 }}>Keine Abos verfügbar.</div>
          )}
          {data.subscriptions.map((s) => {
            const isActive = data.active.subscription_id === s.id;
            const isBusy = busy === `subscription:${s.id}`;
            return (
              <div key={s.id} style={{
                padding: 14, borderRadius: 14,
                background: isActive ? `linear-gradient(135deg, ${GOLD}22, rgba(255,215,0,0.04))` : "rgba(255,255,255,0.04)",
                border: `1px solid ${isActive ? GOLD : "rgba(255,255,255,0.1)"}`,
              }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 2 }}>
                      <span style={{ color: "#FFF", fontSize: 15, fontWeight: 900 }}>{s.title}</span>
                      {isActive && <span style={{ fontSize: 9, fontWeight: 900, padding: "2px 6px", borderRadius: 4, background: `${GOLD}33`, color: GOLD }}>AKTIV</span>}
                    </div>
                    {s.description && <div style={{ color: "#a8b4cf", fontSize: 11, marginBottom: 6 }}>{s.description}</div>}
                    <div style={{ color: "#FFD700", fontSize: 11, fontWeight: 800 }}>+{s.daily_gems.toLocaleString("de-DE")} 💎/Tag</div>
                    {Array.isArray(s.perks) && s.perks.length > 0 && (
                      <ul style={{ margin: "6px 0 0 0", padding: "0 0 0 18px", color: "#a8b4cf", fontSize: 11, lineHeight: 1.5 }}>
                        {s.perks.slice(0, 4).map((p, i) => <li key={i}>{p}</li>)}
                      </ul>
                    )}
                  </div>
                  <button onClick={() => void checkout(`subscription:${s.id}`)} disabled={isBusy || isActive}
                    style={{
                      flexShrink: 0, padding: "10px 14px", borderRadius: 10,
                      background: isActive ? "rgba(255,255,255,0.05)" : `linear-gradient(180deg, ${GOLD}, #FF8A00)`,
                      color: isActive ? "#8B8FA3" : "#1a0e00",
                      border: "none", fontSize: 11, fontWeight: 900, cursor: isActive ? "default" : "pointer",
                    }}>
                    {isBusy ? "…" : isActive ? "AKTIV" : `${fmtPrice(s.price_cents_monthly)}/Mo`}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* BATTLE PASS */}
      {section === "battlepass" && (
        <div>
          {!data.battle_pass ? (
            <div style={{ color: "#8B8FA3", fontSize: 12, textAlign: "center", padding: 24 }}>Aktuell keine Battle-Pass-Saison.</div>
          ) : (
            <div style={{
              padding: 16, borderRadius: 14,
              background: `linear-gradient(135deg, ${PINK}22, rgba(255,45,120,0.04))`,
              border: `1px solid ${PINK}55`,
            }}>
              <div style={{ color: PINK, fontSize: 10, fontWeight: 900, letterSpacing: 1.5, marginBottom: 4 }}>BATTLE PASS · LAUFENDE SAISON</div>
              <div style={{ color: "#FFF", fontSize: 18, fontWeight: 900, marginBottom: 4 }}>{data.battle_pass.title}</div>
              <div style={{ color: "#a8b4cf", fontSize: 11, marginBottom: 12 }}>
                Endet am {new Date(data.battle_pass.ends_at).toLocaleDateString("de-DE")} · 50 Stufen mit täglichen XP-Aufgaben
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                <button onClick={() => data.battle_pass && void checkout(`battle_pass:${data.battle_pass.id}:premium`)}
                  disabled={busy === `battle_pass:${data.battle_pass.id}:premium`}
                  style={{
                    padding: "12px 8px", borderRadius: 10,
                    background: `linear-gradient(180deg, ${PRIMARY}, #1aa89c)`,
                    color: "#0F1115", border: "none",
                    fontSize: 12, fontWeight: 900, cursor: "pointer",
                  }}>
                  <div>PREMIUM</div>
                  <div style={{ fontSize: 11, fontWeight: 800, marginTop: 2 }}>{fmtPrice(data.battle_pass.price_premium_cents)}</div>
                </button>
                <button onClick={() => data.battle_pass && void checkout(`battle_pass:${data.battle_pass.id}:premium_plus`)}
                  disabled={busy === `battle_pass:${data.battle_pass.id}:premium_plus`}
                  style={{
                    padding: "12px 8px", borderRadius: 10,
                    background: `linear-gradient(180deg, ${GOLD}, #FF8A00)`,
                    color: "#1a0e00", border: "none",
                    fontSize: 12, fontWeight: 900, cursor: "pointer",
                  }}>
                  <div>PREMIUM+</div>
                  <div style={{ fontSize: 11, fontWeight: 800, marginTop: 2 }}>{fmtPrice(data.battle_pass.price_premium_plus_cents)}</div>
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* MONTHLY PACKS */}
      {section === "monthly" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {data.monthly_packs.length === 0 && (
            <div style={{ color: "#8B8FA3", fontSize: 12, textAlign: "center", padding: 24 }}>Keine Monats-Packs verfügbar.</div>
          )}
          {data.monthly_packs.map((m) => {
            const isOwned = data.active.monthly_owned?.includes(m.sku);
            const isBusy = busy === `monthly_pack:${m.sku}`;
            return (
              <div key={m.sku} style={{
                padding: 14, borderRadius: 14,
                background: isOwned ? `linear-gradient(135deg, ${PRIMARY}18, rgba(34,209,195,0.04))` : "rgba(255,255,255,0.04)",
                border: `1px solid ${isOwned ? PRIMARY : "rgba(255,255,255,0.1)"}`,
              }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ color: "#FFF", fontSize: 14, fontWeight: 900 }}>{m.name}</div>
                    <div style={{ color: GOLD, fontSize: 11, fontWeight: 800, marginTop: 4 }}>
                      🎁 Sofort: {m.instant_gems.toLocaleString("de-DE")} 💎
                    </div>
                    <div style={{ color: PRIMARY, fontSize: 11, fontWeight: 800 }}>
                      📅 Täglich: {m.daily_gems.toLocaleString("de-DE")} 💎 für {m.duration_days} Tage
                    </div>
                  </div>
                  <button onClick={() => void checkout(`monthly_pack:${m.sku}`)} disabled={isBusy || isOwned}
                    style={{
                      flexShrink: 0, padding: "10px 14px", borderRadius: 10,
                      background: isOwned ? "rgba(255,255,255,0.05)" : `linear-gradient(180deg, ${PRIMARY}, #1aa89c)`,
                      color: isOwned ? "#8B8FA3" : "#0F1115",
                      border: "none", fontSize: 12, fontWeight: 900, cursor: isOwned ? "default" : "pointer",
                    }}>
                    {isBusy ? "…" : isOwned ? "AKTIV" : fmtPriceEur(m.price_eur)}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* GROWTH FUND */}
      {section === "growth" && (
        <div style={{
          padding: 16, borderRadius: 14,
          background: "linear-gradient(135deg, rgba(168,85,247,0.18), rgba(168,85,247,0.04))",
          border: "1px solid rgba(168,85,247,0.5)",
        }}>
          <div style={{ color: "#a855f7", fontSize: 10, fontWeight: 900, letterSpacing: 1.5, marginBottom: 4 }}>GROWTH FUND · LANGZEIT-INVESTMENT</div>
          <div style={{ color: "#FFF", fontSize: 18, fontWeight: 900, marginBottom: 6 }}>Wachstums-Fonds</div>
          <div style={{ color: "#a8b4cf", fontSize: 12, lineHeight: 1.5, marginBottom: 14 }}>
            Einmaliger Kauf für <b style={{ color: "#FFD700" }}>EUR 9,99</b> — du bekommst <b>20 % zurück bei jedem Diamant-Kauf</b> für die nächsten 30 Tage als Bonus-Gems.
          </div>
          <button onClick={() => void checkout("growth_fund")} disabled={busy === "growth_fund"}
            style={{
              width: "100%", padding: "12px", borderRadius: 12,
              background: "linear-gradient(180deg, #a855f7, #7c3aed)",
              color: "#FFF", border: "none",
              fontSize: 13, fontWeight: 900, cursor: "pointer",
            }}>
            {busy === "growth_fund" ? "…" : "EUR 9,99 — Growth Fund aktivieren"}
          </button>
          <div style={{ color: "#6c7590", fontSize: 10, textAlign: "center", marginTop: 8, fontStyle: "italic" }}>
            Einmaliger Kauf, keine Verlängerung
          </div>
        </div>
      )}
    </div>
  );
}
