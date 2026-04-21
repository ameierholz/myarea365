"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type ShopRow = {
  territory_bonus_until: string | null;
  territory_bonus_radius_m: number | null;
  territory_bonus_min_claims: number | null;
};

export function ShopTerritoryBonusPanel({ businessId }: { businessId: string }) {
  const sb = createClient();
  const [shop, setShop] = useState<ShopRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [days, setDays] = useState("30");
  const [radius, setRadius] = useState("500");
  const [minClaims, setMinClaims] = useState("10");
  const [busy, setBusy] = useState(false);

  async function reload() {
    setLoading(true);
    const { data } = await sb.from("local_businesses")
      .select("territory_bonus_until, territory_bonus_radius_m, territory_bonus_min_claims")
      .eq("id", businessId).maybeSingle<ShopRow>();
    setShop(data ?? null);
    if (data?.territory_bonus_radius_m) setRadius(String(data.territory_bonus_radius_m));
    if (data?.territory_bonus_min_claims) setMinClaims(String(data.territory_bonus_min_claims));
    setLoading(false);
  }
  useEffect(() => { void reload(); /* eslint-disable-line react-hooks/exhaustive-deps */ }, []);

  async function activate() {
    setBusy(true);
    const { data, error } = await sb.rpc("activate_territory_bonus", {
      p_business_id: businessId,
      p_days: parseInt(days) || 30,
      p_radius_m: parseInt(radius) || 500,
      p_min_claims: parseInt(minClaims) || 10,
    });
    setBusy(false);
    if (error || (data as { ok?: boolean })?.ok === false) {
      alert(error?.message ?? (data as { error?: string })?.error ?? "Fehler");
      return;
    }
    await reload();
    alert("Territory-Bonus aktiviert!");
  }

  const until = shop?.territory_bonus_until ? new Date(shop.territory_bonus_until) : null;
  const active = until && until > new Date();
  const daysLeft = active && until ? Math.ceil((until.getTime() - Date.now()) / 86400000) : 0;

  if (loading) return <div className="p-8 text-center text-[#8B8FA3] text-sm">Lade…</div>;

  return (
    <div className="p-5 rounded-2xl bg-[#1A1D23] border border-white/10">
      <div className="flex items-start justify-between mb-3 gap-3">
        <div>
          <h3 className="text-lg font-black text-white">👑 Territory-Bonus</h3>
          <p className="text-xs text-[#a8b4cf]">
            Runner, die Gebiete rings um deinen Shop erobert haben, bekommen Extra-XP & Siegel bei jeder Einlösung.
            Das wirbt dich aktiv in deinem Viertel.
          </p>
        </div>
        {active && (
          <div className="px-3 py-1 rounded-full bg-[#4ade80]/15 text-[#4ade80] text-xs font-bold whitespace-nowrap">
            AKTIV · noch {daysLeft}d
          </div>
        )}
      </div>

      <div className="grid grid-cols-3 gap-2 mb-3">
        <div>
          <div className="text-[10px] font-bold tracking-wider text-[#8B8FA3] mb-1">Laufzeit (Tage)</div>
          <input type="number" min={1} max={365} value={days} onChange={(e) => setDays(e.target.value)}
            className="w-full px-3 py-2 rounded-lg bg-[#0F1115] border border-white/10 text-sm text-white" />
        </div>
        <div>
          <div className="text-[10px] font-bold tracking-wider text-[#8B8FA3] mb-1">Radius (200–1000m)</div>
          <input type="number" min={200} max={1000} step={100} value={radius} onChange={(e) => setRadius(e.target.value)}
            className="w-full px-3 py-2 rounded-lg bg-[#0F1115] border border-white/10 text-sm text-white" />
        </div>
        <div>
          <div className="text-[10px] font-bold tracking-wider text-[#8B8FA3] mb-1">Min. Gebiete</div>
          <input type="number" min={1} max={50} value={minClaims} onChange={(e) => setMinClaims(e.target.value)}
            className="w-full px-3 py-2 rounded-lg bg-[#0F1115] border border-white/10 text-sm text-white" />
        </div>
      </div>

      <div className="text-[11px] text-[#a8b4cf] mb-3 p-2 rounded-lg bg-white/5">
        <b className="text-white">Regel:</b> Runner erobert ≥{minClaims} Gebiete im {radius}m-Radius in den letzten 30 Tagen → bekommt bei Einlösung
        <span className="text-[#FFD700] font-bold"> +{Math.max(50, 10 * 15)} XP</span> (skaliert mit Wächter-Level) und
        <span className="text-[#22D1C3] font-bold"> +1 Universal-Siegel</span> extra.
      </div>

      <button onClick={activate} disabled={busy}
        className="w-full py-2.5 rounded-lg bg-gradient-to-r from-[#FFD700] to-[#FF2D78] text-[#0F1115] font-black text-sm disabled:opacity-50">
        {busy ? "…" : active ? `+${days} Tage verlängern` : `Für ${days} Tage aktivieren`}
      </button>
    </div>
  );
}
