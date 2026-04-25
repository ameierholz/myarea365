"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { createClient } from "@/lib/supabase/client";

type ShopRow = {
  territory_bonus_until: string | null;
  territory_bonus_radius_m: number | null;
  territory_bonus_min_claims: number | null;
};

type PkgKey = "week" | "month" | "quarter";
const PACKAGES: Array<{ key: PkgKey; days: number; price: number; popular: boolean; labelKey: "terrPkgWeek" | "terrPkgMonth" | "terrPkgQuarter" }> = [
  { key: "week",    days:  7, price:  19, popular: false, labelKey: "terrPkgWeek" },
  { key: "month",   days: 30, price:  59, popular: true,  labelKey: "terrPkgMonth" },
  { key: "quarter", days: 90, price: 149, popular: false, labelKey: "terrPkgQuarter" },
];

export function ShopTerritoryBonusPanel({ businessId }: { businessId: string }) {
  const t = useTranslations("ShopPanels");
  const sb = createClient();
  const [shop, setShop] = useState<ShopRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(30);
  const [busy, setBusy] = useState(false);

  async function reload() {
    setLoading(true);
    const { data } = await sb.from("local_businesses")
      .select("territory_bonus_until, territory_bonus_radius_m, territory_bonus_min_claims")
      .eq("id", businessId).maybeSingle<ShopRow>();
    setShop(data ?? null);
    setLoading(false);
  }
  useEffect(() => { void reload(); /* eslint-disable-line react-hooks/exhaustive-deps */ }, []);

  async function activate() {
    const pkg = PACKAGES.find((p) => p.days === selected);
    if (!pkg) return;
    if (!confirm(t("terrConfirm", { days: pkg.days, price: pkg.price }))) return;
    setBusy(true);
    const { data, error } = await sb.rpc("activate_territory_bonus", {
      p_business_id: businessId,
      p_days: pkg.days,
      p_radius_m: shop?.territory_bonus_radius_m ?? 500,
      p_min_claims: shop?.territory_bonus_min_claims ?? 10,
    });
    setBusy(false);
    if (error || (data as { ok?: boolean })?.ok === false) {
      alert(error?.message ?? (data as { error?: string })?.error ?? t("errorGeneric"));
      return;
    }
    await reload();
    alert(t("terrActivated"));
  }

  const until = shop?.territory_bonus_until ? new Date(shop.territory_bonus_until) : null;
  const active = !!(until && until > new Date());
  const daysLeft = active && until ? Math.ceil((until.getTime() - Date.now()) / 86400000) : 0;

  if (loading) return <div className="p-8 text-center text-[#8B8FA3] text-sm">{t("terrLoading")}</div>;

  return (
    <div className="p-5 rounded-2xl" style={{
      background: "radial-gradient(ellipse at top, rgba(255,215,0,0.08), transparent 60%), #1A1D23",
      border: "1px solid rgba(255,215,0,0.25)",
    }}>
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="min-w-0">
          <h3 className="text-lg font-black text-white flex items-center gap-2">
            {t("terrTitle")}
          </h3>
          <p className="text-xs text-[#a8b4cf] mt-1">
            {t("terrBody")}
          </p>
        </div>
        {active && (
          <div className="px-3 py-1 rounded-full bg-[#4ade80]/15 text-[#4ade80] text-xs font-bold whitespace-nowrap flex-shrink-0">
            {daysLeft === 1 ? t("terrActiveOne") : t("terrActiveMany", { n: daysLeft })}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mb-4">
        <Benefit icon="📍" title={t("terrBenefit1Title")} text={t("terrBenefit1Text")} />
        <Benefit icon="🔁" title={t("terrBenefit2Title")} text={t("terrBenefit2Text")} />
        <Benefit icon="⭐" title={t("terrBenefit3Title")} text={t("terrBenefit3Text")} />
      </div>

      <div className="text-[10px] font-black tracking-widest text-[#8B8FA3] mb-2">{t("terrDuration")}</div>
      <div style={{
        display: "flex", gap: 4, padding: 4, borderRadius: 10,
        background: "rgba(0,0,0,0.3)", border: "1px solid rgba(255,255,255,0.08)",
        marginBottom: 14,
      }}>
        {PACKAGES.map((p) => {
          const isSel = selected === p.days;
          return (
            <button key={p.days} onClick={() => setSelected(p.days)}
              style={{
                position: "relative", flex: 1,
                padding: "8px 6px", borderRadius: 7,
                cursor: "pointer", border: "none",
                background: isSel
                  ? "linear-gradient(135deg, #FFD700 0%, #FF6B4A 100%)"
                  : "transparent",
                color: isSel ? "#0F1115" : "#a8b4cf",
                fontSize: 12, fontWeight: 900,
                textAlign: "center",
                transition: "all 0.15s ease",
              }}>
              {p.popular && !isSel && (
                <span style={{
                  position: "absolute", top: -6, right: 6,
                  padding: "1px 5px", borderRadius: 999,
                  background: "#FFD700", color: "#0F1115",
                  fontSize: 7, fontWeight: 900, letterSpacing: 0.5,
                }}>{t("terrPkgPopular")}</span>
              )}
              <div>{t("terrDays", { n: p.days })}</div>
              <div style={{
                fontSize: 10, fontWeight: 700, opacity: isSel ? 0.85 : 0.6, marginTop: 1,
              }}>{t("terrPrice", { price: p.price })}</div>
            </button>
          );
        })}
      </div>

      <button onClick={activate} disabled={busy}
        style={{
          width: "100%", padding: "14px 16px", borderRadius: 12,
          border: "none", cursor: busy ? "wait" : "pointer",
          background: "linear-gradient(135deg, #FFD700 0%, #FF6B4A 100%)",
          color: "#0F1115", fontSize: 14, fontWeight: 900, letterSpacing: 1,
          boxShadow: "0 6px 20px rgba(255, 215, 0, 0.35), inset 0 1px 0 rgba(255, 255, 255, 0.3)",
          opacity: busy ? 0.6 : 1,
        }}>
        {busy ? "…" : active
          ? t("terrExtendBtn", { n: selected })
          : t("terrActivateBtn", { n: selected, price: PACKAGES.find((p) => p.days === selected)?.price ?? 0 })}
      </button>

      <p className="text-[10px] text-[#6c7590] text-center mt-2">
        {t("terrFooter")}
      </p>
    </div>
  );
}

function Benefit({ icon, title, text }: { icon: string; title: string; text: string }) {
  return (
    <div className="p-3 rounded-lg bg-white/[0.03] border border-white/5">
      <div className="flex items-center gap-2 mb-1">
        <span className="text-base">{icon}</span>
        <span className="text-xs font-black text-white">{title}</span>
      </div>
      <p className="text-[10px] text-[#a8b4cf] leading-relaxed">{text}</p>
    </div>
  );
}
