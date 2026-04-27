"use client";

import { useCallback, useEffect, useState } from "react";
import { useBaseThemeArt } from "@/components/resource-icon";

type Theme = {
  id: string;
  name: string;
  description: string;
  pin_emoji: string;
  pin_color: string;
  accent_color: string;
  rarity: "advanced" | "epic" | "legendary";
  unlock_kind: "free" | "vip" | "coins" | "event" | "crew_level";
  unlock_value: number;
  buff_atk_pct: number;
  buff_def_pct: number;
  buff_hp_pct: number;
  buff_march_pct: number;
  buff_train_speed_pct: number;
  buff_train_cost_pct: number;
  buff_gather_pct: number;
};

const RARITY_META: Record<Theme["rarity"], { label: string; color: string; gradient: string; glow: string }> = {
  advanced:  { label: "FORTGESCHRITTEN", color: "#5ddaf0", gradient: "linear-gradient(135deg, #1e3a5f 0%, #0f1f33 100%)", glow: "rgba(93,218,240,0.35)" },
  epic:      { label: "EPISCH",          color: "#a855f7", gradient: "linear-gradient(135deg, #3a1e5f 0%, #1f0e33 100%)", glow: "rgba(168,85,247,0.45)" },
  legendary: { label: "LEGENDÄR",        color: "#FFD700", gradient: "linear-gradient(135deg, #5b4a1f 0%, #2a1f0e 100%)", glow: "rgba(255,215,0,0.55)" },
};

export function BaseThemeShopModal({ onClose, onChanged }: {
  onClose: () => void;
  onChanged: () => void | Promise<void>;
}) {
  const [data, setData] = useState<{ themes: Theme[]; active_theme_id: string; vip_level: number } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const art = useBaseThemeArt();

  const load = useCallback(async () => {
    const r = await fetch("/api/base/theme");
    setData(await r.json());
  }, []);
  useEffect(() => { void load(); }, [load]);

  async function activate(id: string) {
    setBusy(id); setMsg(null);
    try {
      const r = await fetch("/api/base/theme", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ theme_id: id }),
      });
      const j = await r.json() as { ok?: boolean; error?: string };
      if (j.ok) { setMsg(`✓ Theme aktiviert!`); await Promise.all([load(), onChanged()]); }
      else if (j.error === "vip_too_low") setMsg("Dein VIP-Level reicht noch nicht.");
      else if (j.error === "not_unlocked") setMsg("Dieses Theme musst du erst freischalten.");
      else setMsg(j.error ?? "Fehler");
    } finally { setBusy(null); }
  }

  if (!data) return null;

  return (
    <div onClick={onClose} className="fixed inset-0 z-[1300] bg-black/85 backdrop-blur-md flex items-end sm:items-center justify-center p-2 sm:p-4">
      <div onClick={(e) => e.stopPropagation()}
        className="w-full max-w-3xl rounded-t-3xl sm:rounded-3xl overflow-hidden shadow-2xl flex flex-col max-h-[96vh]"
        style={{ background: "linear-gradient(180deg, #1A1D23 0%, #0F1115 100%)" }}>

        <div className="relative p-4 sm:p-6 border-b border-white/10 flex items-center gap-3"
          style={{ background: "linear-gradient(135deg, rgba(255,215,0,0.12) 0%, rgba(168,85,247,0.12) 60%, rgba(34,209,195,0.10) 100%)" }}>
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#FFD700] via-[#a855f7] to-[#22D1C3] flex items-center justify-center text-2xl shadow-lg">🏰</div>
          <div className="flex-1">
            <div className="text-[9px] font-black tracking-[3px] text-[#FFD700]/80">SAAL DER ORDNUNG</div>
            <div className="text-lg sm:text-xl font-black text-white">Base-Themes</div>
            <div className="text-[10px] text-white/60 mt-0.5">Wähle dein Aussehen — jedes Theme bringt eigene Buffs.</div>
          </div>
          <button onClick={onClose} className="w-9 h-9 rounded-full bg-black/40 text-white text-lg font-black">×</button>
        </div>

        <div className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-3">
          {(["legendary","epic","advanced"] as const).map((rar) => {
            const themes = data.themes.filter((t) => t.rarity === rar);
            if (themes.length === 0) return null;
            const meta = RARITY_META[rar];
            return (
              <div key={rar}>
                <div className="text-[10px] font-black tracking-[2px] mb-2 px-1" style={{ color: meta.color }}>★ {meta.label}</div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {themes.map((t) => <ThemeCard key={t.id} theme={t} active={data.active_theme_id === t.id}
                    busy={busy === t.id} unlocked={isUnlocked(t, data.vip_level)}
                    art={art} onActivate={() => void activate(t.id)} />)}
                </div>
              </div>
            );
          })}
          {msg && <div className="text-[11px] text-center font-black mt-2" style={{ color: msg.startsWith("✓") ? "#4ade80" : "#FF6B9A" }}>{msg}</div>}
        </div>
      </div>
    </div>
  );
}

function isUnlocked(t: Theme, vipLevel: number): boolean {
  if (t.unlock_kind === "free") return true;
  if (t.unlock_kind === "vip") return vipLevel >= t.unlock_value;
  return false; // event/coins/crew_level → erfordern explizites Freischalten
}

function ThemeCard({ theme, active, busy, unlocked, art, onActivate }: {
  theme: Theme; active: boolean; busy: boolean; unlocked: boolean;
  art: ReturnType<typeof useBaseThemeArt>;
  onActivate: () => void;
}) {
  const meta = RARITY_META[theme.rarity];
  const buffs: Array<{ label: string; value: number }> = [
    { label: "ATK", value: theme.buff_atk_pct },
    { label: "DEF", value: theme.buff_def_pct },
    { label: "HP",  value: theme.buff_hp_pct },
    { label: "Marsch", value: theme.buff_march_pct },
    { label: "Training", value: theme.buff_train_speed_pct },
    { label: "Trainingskosten −", value: theme.buff_train_cost_pct },
    { label: "Sammeln", value: theme.buff_gather_pct },
  ].filter((b) => b.value > 0);
  const pinArt = art[`${theme.id}_runner_pin`] ?? art[`${theme.id}_runner_banner`] ?? null;

  return (
    <div className="rounded-2xl overflow-hidden flex flex-col"
      style={{ background: meta.gradient, border: `1px solid ${meta.color}55`, boxShadow: active ? `0 0 18px ${meta.glow}` : "0 2px 8px rgba(0,0,0,0.4)" }}>
      <div className="relative h-32 flex items-center justify-center"
        style={{ background: `radial-gradient(circle at 50% 60%, ${meta.glow} 0%, transparent 70%)` }}>
        {/* Schimmer-Aura hinter dem Theme-Preview */}
        <div className="absolute inset-0 pointer-events-none" style={{ background: `radial-gradient(circle, ${meta.glow} 0%, transparent 60%)`, animation: "themeShimmer 3s ease-in-out infinite" }} />
        {pinArt?.video_url ? (
          <video src={pinArt.video_url} autoPlay loop muted playsInline
            style={{ width: 96, height: 96, objectFit: "contain", filter: "url(#ma365-chroma-black) drop-shadow(0 4px 12px rgba(0,0,0,0.6))" }} />
        ) : pinArt?.image_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={pinArt.image_url} alt={theme.name}
            style={{ width: 96, height: 96, objectFit: "contain", filter: "url(#ma365-chroma-black) drop-shadow(0 4px 12px rgba(0,0,0,0.6))" }} />
        ) : (
          <span style={{ fontSize: 80, filter: "drop-shadow(0 4px 12px rgba(0,0,0,0.6))" }}>{theme.pin_emoji}</span>
        )}
        <span className="absolute top-1.5 left-1.5 text-[8px] font-black px-1.5 py-0.5 rounded" style={{ background: meta.color, color: "#0F1115" }}>{meta.label}</span>
      </div>
      <div className="p-3 flex-1 flex flex-col">
        <div className="text-[14px] font-black text-white">{theme.name}</div>
        <div className="text-[10px] text-white/65 mt-0.5 line-clamp-2">{theme.description}</div>
        {buffs.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1">
            {buffs.map((b) => (
              <span key={b.label} className="text-[9px] font-black px-1.5 py-0.5 rounded" style={{ background: `${meta.color}22`, color: meta.color }}>
                +{b.value}% {b.label}
              </span>
            ))}
          </div>
        )}
        <div className="mt-3">
          {active ? (
            <span className="block text-center text-[11px] font-black px-3 py-2 rounded-lg" style={{ background: "#22D1C322", color: "#22D1C3" }}>✓ AKTIV</span>
          ) : unlocked ? (
            <button onClick={onActivate} disabled={busy}
              className="w-full text-[12px] font-black px-3 py-2 rounded-lg disabled:opacity-50"
              style={{ background: meta.color, color: "#0F1115", boxShadow: `0 2px 10px ${meta.glow}` }}>
              {busy ? "…" : "Anlegen"}
            </button>
          ) : (
            <div className="text-center text-[10px] font-black px-3 py-2 rounded-lg bg-white/5 text-white/60 border border-white/10">
              {theme.unlock_kind === "vip" ? `🔒 VIP ${theme.unlock_value}` :
               theme.unlock_kind === "event" ? "🎁 Event-Belohnung" :
               theme.unlock_kind === "crew_level" ? `🔒 Crew Lv ${theme.unlock_value}` :
               theme.unlock_kind === "coins" ? `🪙 ${theme.unlock_value}` : "🔒"}
            </div>
          )}
        </div>
      </div>
      <style jsx>{`
        @keyframes themeShimmer {
          0%, 100% { opacity: 0.55; transform: scale(1); }
          50%      { opacity: 1;    transform: scale(1.08); }
        }
      `}</style>
    </div>
  );
}
