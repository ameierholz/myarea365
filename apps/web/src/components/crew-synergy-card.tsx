"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";

const ACCENT = "#22D1C3";
const RED = "#FF6B4A";
const TEXT = "#F0F0F0";
const MUTED = "#8B8FA3";

type Member = {
  user_id: string;
  display_name: string | null;
  avatar_url: string | null;
  last_walk_at: string | null;
  is_active_24h: boolean;
  is_idle_7d: boolean;
  hours_since_walk: number | null;
};
type Synergy = {
  ok: boolean;
  total_members?: number;
  active_24h?: number;
  idle_7d?: number;
  buff_pct?: number;
  members?: Member[];
};

function useFmtSinceWalk() {
  const t = useTranslations("Motivation");
  return (h: number | null): string => {
    if (h == null) return t("synergyNeverWalked");
    if (h < 24) return t("synergyHoursAgo", { h: Math.round(h) });
    const d = Math.round(h / 24);
    return d === 1 ? t("synergyOneDay") : t("synergyDaysAgo", { d });
  };
}

/**
 * Crew-Synergie-Karte: zeigt aktive Mitglieder, XP-Buff für die Crew,
 * und namentlich wer 7+ Tage inaktiv ist (sanfter sozialer Druck).
 */
export function CrewSynergyCard() {
  const t = useTranslations("Motivation");
  const fmtSinceWalk = useFmtSinceWalk();
  const [s, setS] = useState<Synergy | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const r = await fetch("/api/crew/synergy", { cache: "no-store" });
        if (!r.ok) return;
        const j = await r.json() as Synergy;
        if (!cancelled) setS(j);
      } catch { /* ignore */ }
    })();
    return () => { cancelled = true; };
  }, []);

  if (!s?.ok || !s.total_members) return null;

  const buff = s.buff_pct ?? 0;

  return (
    <div style={{
      borderRadius: 14,
      background: `linear-gradient(135deg, ${ACCENT}1f, transparent 70%), rgba(15,17,21,0.85)`,
      border: `1px solid ${ACCENT}66`,
      padding: "14px 16px",
      boxShadow: `0 4px 14px rgba(0,0,0,0.35)`,
      display: "flex", flexDirection: "column", gap: 10,
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <div style={{
          width: 48, height: 48, borderRadius: 12,
          background: `linear-gradient(135deg, ${ACCENT}, #1FB8AC)`,
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 24, color: "#0F1115", fontWeight: 900,
          boxShadow: `0 4px 12px ${ACCENT}55, inset 0 1px 0 rgba(255,255,255,0.5)`,
        }}>+{buff}%</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ color: TEXT, fontSize: 14, fontWeight: 800 }}>{t("synergyTitle")}</div>
          <div style={{ color: MUTED, fontSize: 12, lineHeight: 1.4, marginTop: 2 }}>
            <span style={{ color: ACCENT, fontWeight: 700 }}>{t("synergyActive", { n: s.active_24h ?? 0 })}</span>
            {" · "}
            <span style={{ color: s.idle_7d ? RED : MUTED, fontWeight: 700 }}>{t("synergyIdle", { n: s.idle_7d ?? 0 })}</span>
            {" · "}
            <span>{t("synergyTotal", { n: s.total_members ?? 0 })}</span>
          </div>
          <div style={{ color: MUTED, fontSize: 11, marginTop: 3 }}>
            {t("synergyExplain")}
          </div>
        </div>
      </div>

      {(s.members?.length ?? 0) > 0 && (
        <div style={{
          maxHeight: 160, overflowY: "auto",
          padding: 8, borderRadius: 8,
          background: "rgba(0,0,0,0.25)",
          display: "flex", flexDirection: "column", gap: 4,
        }}>
          {s.members!.slice(0, 12).map((m) => (
            <div key={m.user_id} style={{
              display: "flex", alignItems: "center", gap: 8,
              fontSize: 12, padding: "3px 0",
            }}>
              <span style={{
                width: 8, height: 8, borderRadius: 4,
                background: m.is_active_24h ? "#22C55E" : m.is_idle_7d ? RED : "#FFD700",
                flexShrink: 0,
              }} />
              <span style={{ color: TEXT, fontWeight: 700, flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {m.display_name ?? "—"}
              </span>
              <span style={{ color: MUTED, fontVariantNumeric: "tabular-nums" }}>
                {fmtSinceWalk(m.hours_since_walk)}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
