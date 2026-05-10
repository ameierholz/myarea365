"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { createClient } from "@/lib/supabase/client";
import { useResourceArt, ResourceIcon, useChestArt, ChestIcon, type ResourceArtMap } from "@/components/resource-icon";

export function VipTierProgression({ thresholds, currentLevel, chestArt, resourceArt }: {
  thresholds: Array<{ vip_level: number; required_points: number; daily_chest_silver: number; daily_chest_gold: number; resource_bonus_pct: number; buildtime_bonus_pct: number; extra_build_slots?: number; extra_research_slots?: number; training_speed_pct?: number; research_speed_pct?: number; march_speed_pct?: number; gather_speed_pct?: number; troop_atk_pct?: number; troop_def_pct?: number; troop_hp_pct?: number; daily_speed_tokens?: number; daily_vip_tickets?: number }>;
  currentLevel: number;
  chestArt: ResourceArtMap;
  resourceArt: ResourceArtMap;
}) {
  const tt = useTranslations("BaseModal");
  const [expanded, setExpanded] = useState<number | null>(currentLevel + 1);
  const tiers = thresholds.filter((t) => t.vip_level > 0);

  return (
    <div className="space-y-1.5">
      <div className="text-[10px] font-black text-[#a8b4cf] tracking-widest mb-2">{tt("vipTiersHeader")}</div>
      {tiers.map((t) => {
        const reached = t.vip_level <= currentLevel;
        const isNext = t.vip_level === currentLevel + 1;
        const open = expanded === t.vip_level;

        const highlights: React.ReactNode[] = [];
        if (t.daily_chest_gold > 0) highlights.push(<span key="g" className="inline-flex items-center gap-0.5"><ChestIcon kind="gold" size={20} fallback="🥇" art={chestArt} />×{t.daily_chest_gold}</span>);
        else if (t.daily_chest_silver > 0) highlights.push(<span key="s" className="inline-flex items-center gap-0.5"><ChestIcon kind="silver" size={20} fallback="🥈" art={chestArt} />×{t.daily_chest_silver}</span>);
        if ((t.daily_speed_tokens ?? 0) > 0) highlights.push(<span key="sp" className="inline-flex items-center gap-0.5"><ResourceIcon kind="speed_token" size={20} fallback="⚡" art={resourceArt} />×{t.daily_speed_tokens}</span>);
        if (t.resource_bonus_pct > 0) highlights.push(<span key="r" className="text-[#FFD700] font-black">+{Math.round(t.resource_bonus_pct*100)}% Res</span>);
        if (highlights.length < 3 && t.buildtime_bonus_pct > 0) highlights.push(<span key="b" className="text-[#22D1C3] font-black">−{Math.round(t.buildtime_bonus_pct*100)}% Zeit</span>);

        return (
          <div key={t.vip_level} className={`rounded-lg overflow-hidden ${reached ? "bg-[#FFD700]/10 border border-[#FFD700]/30" : isNext ? "bg-white/5 border border-[#FFD700]/40" : "bg-white/5 border border-white/5"}`}>
            <button
              onClick={() => setExpanded(open ? null : t.vip_level)}
              className="w-full flex items-center gap-2 px-3 py-2 text-left"
            >
              <span className={`text-sm font-black w-16 shrink-0 ${reached ? "text-[#FFD700]" : isNext ? "text-[#FFD700]" : "text-[#6c7590]"}`}>
                {reached ? "✓ " : ""}{tt("vipTierLabel", { level: t.vip_level })}
              </span>
              <div className="flex-1 min-w-0 flex items-center gap-2 text-[12px] text-white">
                {highlights.slice(0, 3)}
              </div>
              <span className="text-[10px] font-black text-[#a8b4cf] shrink-0">{t.required_points.toLocaleString("de-DE")}</span>
              <span className="text-[#6c7590] text-[10px] shrink-0 w-3 text-right">{open ? "▾" : "▸"}</span>
            </button>
            {open && (
              <div className="px-3 pb-3 pt-1 border-t border-white/10 flex flex-wrap items-center gap-x-3 gap-y-2 text-[12px] text-white">
                {t.daily_chest_silver > 0 && <span className="inline-flex items-center gap-1"><ChestIcon kind="silver" size={28} fallback="🥈" art={chestArt} /><span className="font-black">×{t.daily_chest_silver}/d</span></span>}
                {t.daily_chest_gold > 0 && <span className="inline-flex items-center gap-1"><ChestIcon kind="gold" size={28} fallback="🥇" art={chestArt} /><span className="font-black">×{t.daily_chest_gold}/d</span></span>}
                {(t.daily_speed_tokens ?? 0) > 0 && <span className="inline-flex items-center gap-1"><ResourceIcon kind="speed_token" size={28} fallback="⚡" art={resourceArt} /><span className="font-black">×{t.daily_speed_tokens}/d</span></span>}
                {(t.daily_vip_tickets ?? 0) > 0 && <span className="inline-flex items-center gap-1"><span className="text-[24px]">🎟</span><span className="font-black">×{t.daily_vip_tickets}/d</span></span>}
                {t.resource_bonus_pct > 0 && <span className="inline-flex items-center gap-1"><span className="text-[18px]">📦</span><span className="font-black text-[#FFD700]">+{Math.round(t.resource_bonus_pct*100)}%</span></span>}
                {t.buildtime_bonus_pct > 0 && <span className="inline-flex items-center gap-1"><span className="text-[18px]">🏗</span><span className="font-black text-[#22D1C3]">−{Math.round(t.buildtime_bonus_pct*100)}%</span></span>}
                {(t.gather_speed_pct ?? 0) > 0 && <span className="inline-flex items-center gap-1"><span className="text-[18px]">🌾</span><span className="font-black">+{Math.round((t.gather_speed_pct ?? 0)*100)}%</span></span>}
                {(t.training_speed_pct ?? 0) > 0 && <span className="inline-flex items-center gap-1"><span className="text-[18px]">⚔️</span><span className="font-black">+{Math.round((t.training_speed_pct ?? 0)*100)}%</span></span>}
                {(t.research_speed_pct ?? 0) > 0 && <span className="inline-flex items-center gap-1"><span className="text-[18px]">🔬</span><span className="font-black">+{Math.round((t.research_speed_pct ?? 0)*100)}%</span></span>}
                {(t.march_speed_pct ?? 0) > 0 && <span className="inline-flex items-center gap-1"><span className="text-[18px]">🐎</span><span className="font-black">+{Math.round((t.march_speed_pct ?? 0)*100)}%</span></span>}
                {(t.troop_atk_pct ?? 0) > 0 && <span className="inline-flex items-center gap-1"><span className="text-[18px]">⚔</span><span className="font-black text-[#FF6B4A]">+{Math.round((t.troop_atk_pct ?? 0)*100)}%</span></span>}
                {(t.troop_def_pct ?? 0) > 0 && <span className="inline-flex items-center gap-1"><span className="text-[18px]">🛡</span><span className="font-black text-[#22D1C3]">+{Math.round((t.troop_def_pct ?? 0)*100)}%</span></span>}
                {(t.troop_hp_pct ?? 0) > 0 && <span className="inline-flex items-center gap-1"><span className="text-[18px]">❤</span><span className="font-black text-[#FF2D78]">+{Math.round((t.troop_hp_pct ?? 0)*100)}%</span></span>}
                {(t.extra_build_slots ?? 0) > 0 && <span className="inline-flex items-center gap-1"><span className="text-[18px]">🔨</span><span className="font-black">+{t.extra_build_slots} Slot</span></span>}
                {(t.extra_research_slots ?? 0) > 0 && <span className="inline-flex items-center gap-1"><span className="text-[18px]">🔬</span><span className="font-black">+{t.extra_research_slots} Slot</span></span>}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

export function VipShopSection({ vipLevel, reload, defaultOpen = false }: { vipLevel: number; reload: () => Promise<void>; defaultOpen?: boolean }) {
  const t = useTranslations("BaseModal");
  type Offer = { id: string; name: string; description: string; emoji: string; required_vip: number; reward_kind: string; reward_amount: number; price_gems: number; original_gems: number | null; daily_limit: number; sort: number };
  type Data = { ok: boolean; offers: Offer[]; purchased_today: Record<string, number> };
  const [data, setData] = useState<Data | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [open, setOpen] = useState(defaultOpen);
  const sb = createClient();
  const chestArt = useChestArt();
  const resourceArt = useResourceArt();

  const load = useCallback(async () => {
    const { data: d } = await sb.rpc("get_vip_shop_state");
    setData(d as Data);
  }, [sb]);
  useEffect(() => { if (open && !data) void load(); }, [open, data, load]);

  async function buy(offerId: string) {
    setBusy(offerId); setMsg(null);
    const { data: res, error } = await sb.rpc("purchase_vip_shop_offer", { p_offer_id: offerId });
    setBusy(null);
    type Res = { ok?: boolean; error?: string; reward_kind?: string; reward_amount?: number };
    const r = (res ?? null) as Res | null;
    if (error || !r?.ok) {
      const errMap: Record<string, string> = {
        vip_level_too_low: t("vipShopErrLevel"),
        daily_limit_reached: t("vipShopErrLimit"),
        not_enough_gems: t("vipShopErrGems"),
      };
      setMsg(t("vipShopErrPrefix", { msg: errMap[r?.error ?? ""] ?? r?.error ?? error?.message ?? t("errGeneric") }));
    } else {
      setMsg(t("vipShopOk", { amount: r.reward_amount ?? 0, kind: r.reward_kind ?? "" }));
      await Promise.all([load(), reload()]);
    }
    setTimeout(() => setMsg(null), 2800);
  }

  return (
    <div className="rounded-xl bg-[#1A1D23] border border-[#FFD700]/30 overflow-hidden">
      {!defaultOpen && (
        <button onClick={() => setOpen(!open)} className="w-full flex items-center justify-between px-3 py-3 text-[13px] font-black text-[#FFD700]">
          <span>{t("vipShopHeader")} <span className="text-[10px] text-[#a8b4cf] font-normal ml-1">{t("vipShopHint")}</span></span>
          <span>{open ? "▾" : "▸"}</span>
        </button>
      )}
      {open && (
        <div className="p-2 space-y-2">
          {!data && <div className="text-[11px] text-[#a8b4cf] text-center py-3">{t("vipShopLoading")}</div>}
          {data && data.offers.filter((o) => o.required_vip <= 15).sort((a, b) => a.sort - b.sort).map((o) => {
            const purchasedToday = data.purchased_today[o.id] ?? 0;
            const remaining = Math.max(0, o.daily_limit - purchasedToday);
            const locked = vipLevel < o.required_vip;
            const soldOut = remaining === 0;
            const disabled = locked || soldOut || busy === o.id;
            const discount = o.original_gems && o.original_gems > o.price_gems
              ? Math.round((1 - o.price_gems / o.original_gems) * 100) : 0;

            const icon = o.reward_kind === "silver_chest"
              ? <ChestIcon kind="silver" size={36} fallback="🥈" art={chestArt} />
              : o.reward_kind === "gold_chest"
              ? <ChestIcon kind="gold" size={36} fallback="🥇" art={chestArt} />
              : ["wood","stone","gold","mana","speed_token"].includes(o.reward_kind)
              ? <ResourceIcon kind={o.reward_kind as "wood"|"stone"|"gold"|"mana"|"speed_token"} size={36} fallback={o.emoji} art={resourceArt} />
              : <span className="text-[28px]">{o.emoji}</span>;

            return (
              <div key={o.id} className={`flex items-center gap-3 p-2 rounded-lg ${locked ? "bg-white/[0.02] opacity-50" : "bg-black/30 border border-white/5"}`}>
                <div className="relative shrink-0">
                  {icon}
                  {discount > 0 && !locked && (
                    <span className="absolute -top-1 -right-2 px-1 rounded text-[8px] font-black bg-[#FF2D78] text-white">−{discount}%</span>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-[12px] font-black text-white">{o.name}</div>
                  <div className="text-[10px] text-[#a8b4cf]">{o.description}</div>
                  <div className="text-[9px] text-[#6c7590] mt-0.5">
                    {locked ? t("vipShopLockedAt", { level: o.required_vip }) : t("vipShopRemaining", { remain: remaining, limit: o.daily_limit })}
                  </div>
                </div>
                <button onClick={() => buy(o.id)} disabled={disabled}
                  className="text-[11px] font-black px-3 py-2 rounded-lg disabled:opacity-40 shrink-0"
                  style={{ background: disabled ? "rgba(255,255,255,0.05)" : "linear-gradient(135deg, #FFD700, #FF6B4A)", color: disabled ? "#6c7590" : "#0F1115" }}>
                  {busy === o.id ? "…" : soldOut ? t("vipShopSoldOut") : (
                    <span className="flex flex-col items-center leading-tight">
                      {discount > 0 && <span className="text-[8px] line-through opacity-60">💎{o.original_gems}</span>}
                      <span>💎{o.price_gems}</span>
                    </span>
                  )}
                </button>
              </div>
            );
          })}
          {msg && <div className="text-[11px] text-center font-black text-white">{msg}</div>}
        </div>
      )}
    </div>
  );
}

export function VipDailyClaim({ tier, alreadyClaimed, reload }: {
  tier: { vip_level: number; daily_chest_silver: number; daily_chest_gold: number; daily_speed_tokens?: number; daily_vip_tickets?: number };
  alreadyClaimed: boolean;
  reload: () => Promise<void>;
}) {
  const t = useTranslations("BaseModal");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const sb = createClient();
  const chestArt = useChestArt();
  const resourceArt = useResourceArt();

  type GiftItem = { node: React.ReactNode; label: string; n: number };
  const items: GiftItem[] = [
    { node: <ChestIcon kind="silver" size={20} fallback="🥈" art={chestArt} />, label: t("vipDailySilver"), n: tier.daily_chest_silver },
    { node: <ChestIcon kind="gold"   size={20} fallback="🥇" art={chestArt} />, label: t("vipDailyGold"),   n: tier.daily_chest_gold },
    { node: <ResourceIcon kind="speed_token" size={20} fallback="⚡" art={resourceArt} />, label: t("vipDailySpeedToken"), n: tier.daily_speed_tokens ?? 0 },
    { node: <span className="text-[16px]">🎟</span>, label: t("vipDailyTicket"), n: tier.daily_vip_tickets ?? 0 },
  ].filter((i) => i.n > 0);

  if (items.length === 0) return null;

  async function claim() {
    if (busy || alreadyClaimed) return;
    setBusy(true); setMsg(null);
    const { data, error } = await sb.rpc("claim_vip_daily_rewards");
    setBusy(false);
    type Res = { ok?: boolean; error?: string; silver_chests?: number; gold_chests?: number; speed_tokens?: number; vip_tickets?: number };
    const res = (data ?? null) as Res | null;
    if (error || !res?.ok) {
      setMsg(t("vipShopErrPrefix", { msg: res?.error ?? error?.message ?? t("errGeneric") }));
    } else {
      const parts: string[] = [];
      if ((res.silver_chests ?? 0) > 0) parts.push(`🥈×${res.silver_chests}`);
      if ((res.gold_chests ?? 0) > 0)   parts.push(`🥇×${res.gold_chests}`);
      if ((res.speed_tokens ?? 0) > 0)  parts.push(`⚡×${res.speed_tokens}`);
      if ((res.vip_tickets ?? 0) > 0)   parts.push(`🎟×${res.vip_tickets}`);
      setMsg(`✅ ${parts.join(" · ")}`);
      await reload();
    }
    setTimeout(() => setMsg(null), 3000);
  }

  return (
    <div className="rounded-xl bg-gradient-to-br from-[#FFD700]/15 to-[#FF6B4A]/10 border border-[#FFD700]/40 p-3">
      <div className="flex items-center justify-between mb-2">
        <div>
          <div className="text-[10px] font-black tracking-widest text-[#FFD700]">{t("vipDailyHeader")}</div>
          <div className="text-[10px] text-[#a8b4cf] mt-0.5">
            {alreadyClaimed ? t("vipDailyClaimed") : t("vipDailyOncePerDay", { level: tier.vip_level })}
          </div>
        </div>
      </div>
      <div className="flex items-center gap-2 flex-wrap">
        {items.map((i, idx) => (
          <div key={idx} className="flex items-center gap-1 px-2 py-1 rounded-lg bg-black/40 border border-white/10 text-[11px] font-black text-white">
            {i.node}<span>×{i.n}</span><span className="text-[#a8b4cf] font-normal">{i.label}</span>
          </div>
        ))}
        <button onClick={claim} disabled={busy || alreadyClaimed}
          className="ml-auto px-3 h-9 rounded-lg bg-gradient-to-r from-[#FFD700] to-[#FF6B4A] text-[#0F1115] font-black text-xs disabled:opacity-40">
          {busy ? "…" : alreadyClaimed ? t("vipDailyClaimedBtn") : t("vipDailyClaimBtn")}
        </button>
      </div>
      {msg && <div className="mt-2 text-[10px] text-center text-white">{msg}</div>}
    </div>
  );
}

export function VipTicketRedeem({ available, reload }: { available: number; reload: () => Promise<void> }) {
  const t = useTranslations("BaseModal");
  const [count, setCount] = useState(1);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const sb = createClient();

  async function redeem() {
    if (busy || count < 1 || count > available) return;
    setBusy(true); setMsg(null);
    const { data, error } = await sb.rpc("redeem_vip_ticket", { p_count: count });
    setBusy(false);
    type RedeemResult = { ok?: boolean; error?: string; points_added?: number };
    const res = (data ?? null) as RedeemResult | null;
    if (error || !res?.ok) {
      setMsg(t("vipShopErrPrefix", { msg: res?.error ?? error?.message ?? t("errGeneric") }));
    } else {
      setMsg(t("vipTicketsResultOk", { points: res.points_added ?? 0 }));
      await reload();
    }
    setTimeout(() => setMsg(null), 2600);
  }

  return (
    <div className="rounded-xl bg-gradient-to-br from-[#FFD700]/15 to-transparent border border-[#FFD700]/40 p-3">
      <div className="flex items-center justify-between mb-2">
        <div>
          <div className="text-[10px] font-black tracking-widest text-[#FFD700]">{t("vipTicketsHeader")}</div>
          <div className="text-[10px] text-[#a8b4cf] mt-0.5">{t("vipTicketsSub", { n: available })}</div>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <button onClick={() => setCount((c) => Math.max(1, c - 1))} disabled={count <= 1}
          className="w-8 h-8 rounded-lg bg-white/5 text-white font-black disabled:opacity-30">−</button>
        <input type="number" min={1} max={available} value={count}
          onChange={(e) => setCount(Math.max(1, Math.min(available, parseInt(e.target.value || "1", 10))))}
          className="w-16 text-center bg-black/40 border border-white/10 rounded-lg py-1.5 text-white font-black text-sm" />
        <button onClick={() => setCount((c) => Math.min(available, c + 1))} disabled={count >= available}
          className="w-8 h-8 rounded-lg bg-white/5 text-white font-black disabled:opacity-30">+</button>
        <button onClick={() => setCount(available)} disabled={count === available}
          className="px-2 h-8 rounded-lg bg-white/5 text-[#a8b4cf] text-[10px] font-black disabled:opacity-30">{t("vipTicketsMax")}</button>
        <button onClick={redeem} disabled={busy || count < 1 || count > available}
          className="ml-auto px-3 h-8 rounded-lg bg-gradient-to-r from-[#FFD700] to-[#FF6B4A] text-[#0F1115] font-black text-xs disabled:opacity-40">
          {busy ? "…" : t("vipTicketsRedeemBtn", { points: count * 50 })}
        </button>
      </div>
      {msg && <div className="mt-2 text-[10px] text-center text-white">{msg}</div>}
    </div>
  );
}
