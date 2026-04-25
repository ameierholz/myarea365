"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { createClient } from "@/lib/supabase/client";

type ArenaStatus = {
  id: string;
  status: string;
  plan: "daily" | "monthly";
  activated_at: string;
  expires_at: string;
  total_battles: number;
};

export function ShopArenaPanel({ businessId, onBuyArena }: {
  businessId: string;
  onBuyArena: (sku: "arena_daily" | "arena_monthly") => void;
}) {
  const t = useTranslations("ShopPanels");
  const sb = createClient();
  const [arena, setArena] = useState<ArenaStatus | null>(null);
  const [eligibleCount, setEligibleCount] = useState(0);
  const [battles, setBattles] = useState<Array<{ id: string; winner_crew_id: string | null; created_at: string; challenger_name: string | null; defender_name: string | null }>>([]);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const { data: a } = await sb.from("shop_arenas")
        .select("id, status, plan, activated_at, expires_at, total_battles")
        .eq("business_id", businessId)
        .maybeSingle<ArenaStatus>();
      if (cancelled) return;
      setArena(a && a.status === "active" && new Date(a.expires_at).getTime() > Date.now() ? a : null);

      const since = new Date(Date.now() - 7 * 86400000).toISOString();
      const { data: reds } = await sb.from("deal_redemptions")
        .select("user_id")
        .eq("business_id", businessId)
        .eq("status", "verified")
        .gte("verified_at", since);
      if (reds && reds.length > 0) {
        const userIds = Array.from(new Set(reds.map((r: { user_id: string }) => r.user_id)));
        const { data: users } = await sb.from("users")
          .select("current_crew_id")
          .in("id", userIds);
        const crews = new Set((users ?? []).map((u: { current_crew_id: string | null }) => u.current_crew_id).filter(Boolean));
        if (!cancelled) setEligibleCount(crews.size);
      } else {
        if (!cancelled) setEligibleCount(0);
      }

      if (a) {
        const { data: bs } = await sb.from("arena_battles")
          .select("id, challenger_crew_id, defender_crew_id, winner_crew_id, created_at")
          .eq("arena_id", a.id)
          .order("created_at", { ascending: false })
          .limit(5);
        if (bs && bs.length > 0) {
          const ids = Array.from(new Set(bs.flatMap((b) => [b.challenger_crew_id, b.defender_crew_id])));
          const { data: cs } = await sb.from("crews").select("id, name").in("id", ids);
          const cm = new Map((cs ?? []).map((c: { id: string; name: string }) => [c.id, c.name]));
          if (!cancelled) {
            setBattles(bs.map((b) => ({
              id: b.id, winner_crew_id: b.winner_crew_id, created_at: b.created_at,
              challenger_name: cm.get(b.challenger_crew_id) ?? null,
              defender_name: cm.get(b.defender_crew_id) ?? null,
            })));
          }
        }
      }
    }
    load();
    const tt = setInterval(load, 15000);
    return () => { cancelled = true; clearInterval(tt); };
  }, [sb, businessId]);

  const expiresInDays = arena ? Math.max(0, Math.floor((new Date(arena.expires_at).getTime() - Date.now()) / 86400000)) : 0;

  return (
    <div style={{
      padding: 16, borderRadius: 14,
      background: "linear-gradient(135deg, rgba(168,85,247,0.15), rgba(255,45,120,0.08))",
      border: "1px solid rgba(168,85,247,0.35)",
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
        <span style={{ fontSize: 22 }}>⚔️</span>
        <div style={{ color: "#FFF", fontSize: 15, fontWeight: 900 }}>{t("arenaTitle")}</div>
        {arena && (
          <span style={{ marginLeft: "auto", padding: "2px 8px", borderRadius: 999, background: "rgba(74,222,128,0.25)", color: "#4ade80", fontSize: 10, fontWeight: 900, letterSpacing: 1 }}>
            {t("arenaLiveBadge", { days: expiresInDays })}
          </span>
        )}
      </div>

      {!arena ? (
        <>
          <div style={{ color: "#a8b4cf", fontSize: 12, lineHeight: 1.5, marginBottom: 12 }}>
            {t("arenaTeaser1")} <b style={{ color: "#FFF" }}>{t("arenaTeaserBold")}</b>{t("arenaTeaser2")} <b style={{ color: "#FFD700" }}>{t("arenaTeaserGold")}</b>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            <button
              onClick={() => onBuyArena("arena_daily")}
              style={{ padding: 12, borderRadius: 10, background: "rgba(168,85,247,0.3)", border: "1px solid #a855f7", color: "#FFF", cursor: "pointer", textAlign: "left" }}
            >
              <div style={{ fontSize: 11, fontWeight: 900, color: "#a855f7" }}>{t("arenaDayTest")}</div>
              <div style={{ fontSize: 18, fontWeight: 900, marginTop: 2 }}>{t("arenaDayPrice")}</div>
              <div style={{ fontSize: 10, color: "#a8b4cf" }}>{t("arenaDaySub")}</div>
            </button>
            <button
              onClick={() => onBuyArena("arena_monthly")}
              style={{ padding: 12, borderRadius: 10, background: "linear-gradient(135deg, #a855f7, #FF2D78)", border: "none", color: "#FFF", cursor: "pointer", textAlign: "left", position: "relative" }}
            >
              <div style={{ position: "absolute", top: -8, right: 8, padding: "2px 6px", borderRadius: 6, background: "#FFD700", color: "#0F1115", fontSize: 8, fontWeight: 900 }}>{t("arenaPopular")}</div>
              <div style={{ fontSize: 11, fontWeight: 900 }}>{t("arenaSubKicker")}</div>
              <div style={{ fontSize: 18, fontWeight: 900, marginTop: 2 }}>{t("arenaSubPrice")}</div>
              <div style={{ fontSize: 10, opacity: 0.85 }}>{t("arenaSubSub")}</div>
            </button>
          </div>
        </>
      ) : (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 10 }}>
            <Stat label={t("arenaStatBattles")} value={`${arena.total_battles}`} color="#FFD700" />
            <Stat label={t("arenaStatEligible")} value={`${eligibleCount}`} color="#22D1C3" />
            <Stat label={t("arenaStatExpires")} value={t("arenaDaysShort", { n: expiresInDays })} color="#FF6B4A" />
          </div>
          {battles.length > 0 ? (
            <div style={{ marginTop: 10 }}>
              <div style={{ color: "#a8b4cf", fontSize: 10, fontWeight: 900, letterSpacing: 1, marginBottom: 6 }}>{t("arenaRecentHeading")}</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                {battles.map((b) => (
                  <div key={b.id} style={{ padding: "6px 10px", borderRadius: 8, background: "rgba(70,82,122,0.35)", fontSize: 11, color: "#FFF", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <span>{b.challenger_name ?? "?"} vs {b.defender_name ?? "?"}</span>
                    <span style={{ color: "#FFD700", fontWeight: 800 }}>
                      {b.winner_crew_id ? "🏆" : "—"}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div style={{ padding: 10, borderRadius: 8, background: "rgba(15,17,21,0.5)", color: "#a8b4cf", fontSize: 11, textAlign: "center" }}>
              {t("arenaEmpty")}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function Stat({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div style={{ padding: 8, borderRadius: 8, background: "rgba(15,17,21,0.5)", textAlign: "center" }}>
      <div style={{ color: "#8B8FA3", fontSize: 9, fontWeight: 800, letterSpacing: 1 }}>{label.toUpperCase()}</div>
      <div style={{ color, fontSize: 16, fontWeight: 900, marginTop: 2 }}>{value}</div>
    </div>
  );
}
