"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useStrongholdArt, pickStrongholdArt } from "@/components/resource-icon";
import { WeatherActionHint } from "@/components/weather-action-hint";

type Stronghold = {
  id: string; lat: number; lng: number; level: number;
  total_hp: number; current_hp: number; hp_pct: number;
};

type Guardian = { id: string; level: number; name: string; image_url: string | null; video_url: string | null };
type Troop = { id: string; name: string; emoji: string; tier: number; troop_class: string; base_atk: number };

type RallyState = {
  ok: boolean;
  rally: null | {
    id: string; leader_user_id: string; crew_id: string; stronghold_id: string;
    prep_ends_at: string; march_ends_at: string | null;
    status: "preparing" | "marching" | "fighting" | "done" | "aborted";
    total_atk: number;
  };
  i_joined?: boolean;
  participants?: Array<{ user_id: string; guardian_id: string | null; troops: Record<string, number>; atk_contribution: number }>;
  stronghold?: Stronghold;
};

const PREP_OPTIONS: Array<{ s: number; label: string }> = [
  { s: 180,    label: "3 Min" },
  { s: 480,    label: "8 Min" },
  { s: 1680,   label: "28 Min" },
  { s: 28680,  label: "7h 58m" },
];

export function StrongholdModal({ stronghold, onClose, activeRally, refreshRally, anchorX, anchorY }: {
  stronghold: Stronghold;
  onClose: () => void;
  activeRally: RallyState["rally"];
  refreshRally: () => Promise<void>;
  /** Screen-Position des angeklickten Pins (clientX/Y). Optional — fallback auf Viewport-Mitte. */
  anchorX?: number;
  anchorY?: number;
}) {
  const [setup, setSetup] = useState<"setup" | "join" | null>(null);
  const sameTarget = activeRally && activeRally.stronghold_id === stronghold.id;
  const canStart = !activeRally;
  const strongholdArt = useStrongholdArt();
  const art = pickStrongholdArt(strongholdArt, stronghold.level);

  // NPC-Lore für dieses Wegelager laden
  const [npc, setNpc] = useState<{
    name: string; archetype: string; emoji: string;
    intro_line: string; lore: string;
  } | null>(null);
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const r = await fetch(`/api/stronghold/npc/${stronghold.id}`, { cache: "no-store" });
        if (!r.ok) return;
        const j = await r.json() as { ok?: boolean; name?: string; archetype?: string; emoji?: string; intro_line?: string; lore?: string };
        if (!cancelled && j.ok && j.name) setNpc({ name: j.name, archetype: j.archetype!, emoji: j.emoji!, intro_line: j.intro_line!, lore: j.lore! });
      } catch { /* ignore */ }
    })();
    return () => { cancelled = true; };
  }, [stronghold.id]);

  // ESC schließt
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  // Popup-Position: rechts vom Pin, mit Viewport-Clamping
  const POPUP_W = 340;
  const POPUP_H_EST = 380;
  const PAD = 12;
  const vw = typeof window !== "undefined" ? window.innerWidth : 1024;
  const vh = typeof window !== "undefined" ? window.innerHeight : 768;
  const ax = anchorX ?? vw / 2;
  const ay = anchorY ?? vh / 2;
  // Bevorzugt rechts vom Pin, sonst links
  let left = ax + 24;
  if (left + POPUP_W + PAD > vw) left = ax - POPUP_W - 24;
  if (left < PAD) left = PAD;
  // Vertikal um Pin herum zentriert, geclamped
  let top = ay - POPUP_H_EST / 2;
  if (top + POPUP_H_EST + PAD > vh) top = vh - POPUP_H_EST - PAD;
  if (top < PAD) top = PAD;

  return (
    <div onClick={onClose} className="fixed inset-0 z-[9100]" style={{ background: "transparent", pointerEvents: "auto" }}>
      <div
        onClick={(e) => e.stopPropagation()}
        className="absolute rounded-2xl bg-[#1A1D23] border border-[#FF2D78]/50 shadow-2xl overflow-hidden"
        style={{ left, top, width: POPUP_W, boxShadow: "0 12px 40px rgba(0,0,0,0.55)" }}
      >
        <div className="relative p-3 bg-gradient-to-br from-[#FF2D78]/20 to-[#FF6B4A]/10 flex items-center gap-2.5">
          <button onClick={onClose} className="absolute top-2 right-2 w-7 h-7 rounded-full bg-black/40 text-white text-sm z-10" aria-label="Schließen">×</button>
          <div className="shrink-0 w-14 h-14 flex items-center justify-center">
            {art?.video_url ? (
              <video src={art.video_url} autoPlay loop muted playsInline className="w-14 h-14 object-contain" style={{ filter: "url(#ma365-chroma-black)" }} />
            ) : art?.image_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={art.image_url} alt={`Wegelager Lv ${stronghold.level}`} className="w-14 h-14 object-contain" style={{ filter: "url(#ma365-chroma-black)" }} />
            ) : (
              <span className="text-4xl">🏰</span>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-[9px] font-black tracking-widest text-[#FF2D78]">WEGELAGER</div>
            <div className="text-lg font-black text-white leading-tight">Stufe {stronghold.level}</div>
            <div className="text-[10px] text-[#a8b4cf]">Crew-Angriff erforderlich</div>
          </div>
        </div>

        <div className="p-3 space-y-2.5">
          {/* NPC-Banner — kompakt */}
          {npc && (
            <div className="rounded-lg bg-gradient-to-br from-[#FFD700]/15 to-transparent border border-[#FFD700]/35 p-2">
              <div className="flex items-start gap-2">
                <div className="text-xl shrink-0" aria-hidden>{npc.emoji}</div>
                <div className="flex-1 min-w-0">
                  <div className="text-[8px] font-black tracking-widest text-[#FFD700]">{npc.archetype.toUpperCase()}</div>
                  <div className="text-[12px] font-black text-white">{npc.name}</div>
                  <div className="text-[10px] italic text-[#FFEEAA] mt-0.5 leading-snug">"{npc.intro_line}"</div>
                </div>
              </div>
            </div>
          )}

          <div className="rounded-lg bg-black/40 border border-white/10 p-2.5">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[9px] font-black tracking-widest text-[#a8b4cf]">WEGELAGER-ABWEHR</span>
              <span className="text-[11px] font-black text-white">{stronghold.current_hp.toLocaleString("de-DE")} / {stronghold.total_hp.toLocaleString("de-DE")}</span>
            </div>
            <div className="h-2 rounded-full bg-white/10 overflow-hidden">
              <div className="h-full bg-gradient-to-r from-[#4ade80] via-[#FFD700] to-[#FF6B4A]" style={{ width: `${stronghold.hp_pct}%` }} />
            </div>
            <div className="text-[9px] text-[#a8b4cf] mt-1.5">
              Empfohlen: <b className="text-white">{(stronghold.total_hp).toLocaleString("de-DE")} Angriff</b> · Banditen-Tier {Math.max(1, Math.min(5, Math.ceil(stronghold.level / 2)))}+
            </div>
          </div>

          <div className="rounded-lg bg-black/30 border border-white/5 p-2 text-[10px] text-[#a8b4cf] leading-snug">
            <b className="text-white">Belohnung:</b> <b className="text-[#FFD700]">{stronghold.level * 500}</b> RSS · <b className="text-[#FFD700]">{stronghold.level * 250}</b> Bandbreite · Wächter-EP ×{stronghold.level * 10}
            {stronghold.level >= 5 && <> · 🥈</>}
            {stronghold.level >= 8 && <> · 🥇</>}
          </div>

          {sameTarget && activeRally && (
            <div className="rounded-lg bg-[#FFD700]/10 border border-[#FFD700]/40 p-2">
              <div className="text-[10px] font-black text-[#FFD700]">⚡ AKTIVER CREW-ANGRIFF</div>
              <div className="text-[11px] text-white mt-0.5">Status: <b>{activeRally.status}</b> · Angriff: <b>{activeRally.total_atk.toLocaleString("de-DE")}</b></div>
              <button onClick={() => setSetup("join")} className="mt-2 w-full py-2 rounded-lg bg-gradient-to-r from-[#FFD700] to-[#FF6B4A] text-[#0F1115] font-black text-[12px]">
                Crew-Angriff beitreten
              </button>
            </div>
          )}

          {!sameTarget && activeRally && (
            <div className="rounded-lg bg-white/5 border border-white/10 p-2 text-[10px] text-[#a8b4cf]">
              ⚠️ Crew hat bereits aktiven Angriff. Erst abschließen.
            </div>
          )}

          {canStart && (
            <button onClick={() => setSetup("setup")} className="w-full py-2.5 rounded-lg bg-gradient-to-r from-[#FF2D78] to-[#FF6B4A] text-white font-black text-[13px] shadow-lg">
              ⚔️ Crew zusammen rufen
            </button>
          )}
        </div>
      </div>

      {setup && (
        <RallySetupModal
          mode={setup}
          stronghold={stronghold}
          rallyId={setup === "join" && activeRally ? activeRally.id : null}
          onClose={() => setSetup(null)}
          onSuccess={async () => { setSetup(null); await refreshRally(); onClose(); }}
        />
      )}
    </div>
  );
}

function RallySetupModal({ mode, stronghold, rallyId, onClose, onSuccess }: {
  mode: "setup" | "join";
  stronghold: Stronghold;
  rallyId: string | null;
  onClose: () => void;
  onSuccess: () => Promise<void>;
}) {
  const sb = createClient();
  const [guardians, setGuardians] = useState<Guardian[]>([]);
  const [troopsCatalog, setTroopsCatalog] = useState<Troop[]>([]);
  const [troopHaveMap, setTroopHaveMap] = useState<Record<string, number>>({});
  const [selectedGuardian, setSelectedGuardian] = useState<string | null>(null);
  const [troopCounts, setTroopCounts] = useState<Record<string, number>>({});
  const [prepSeconds, setPrepSeconds] = useState<number>(180);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    const [g, troopsApi] = await Promise.all([
      sb.from("user_guardians").select("id, level, archetype:guardian_archetypes(id,name,image_url,video_url)").eq("is_active", true).limit(20),
      fetch("/api/base/troops", { cache: "no-store" }).then((r) => r.ok ? r.json() : { catalog: [], owned: [] }),
    ]);
    type GRow = { id: string; level: number; archetype: { id: string; name: string; image_url: string | null; video_url: string | null } | null };
    setGuardians(((g.data ?? []) as unknown as GRow[]).map((r) => ({
      id: r.id, level: r.level,
      name: r.archetype?.name ?? "Wächter",
      image_url: r.archetype?.image_url ?? null,
      video_url: r.archetype?.video_url ?? null,
    })));
    setTroopsCatalog((troopsApi.catalog ?? []) as Troop[]);
    const have: Record<string, number> = {};
    for (const t of (troopsApi.owned ?? []) as Array<{ troop_id: string; count: number }>) have[t.troop_id] = t.count;
    setTroopHaveMap(have);
  }, [sb]);
  useEffect(() => { void load(); }, [load]);

  const totalAtk = troopsCatalog.reduce((sum, t) => sum + (troopCounts[t.id] ?? 0) * t.base_atk, 0);
  const totalCount = Object.values(troopCounts).reduce((s, n) => s + (n || 0), 0);

  async function submit() {
    setBusy(true); setErr(null);
    try {
      const filtered: Record<string, number> = {};
      for (const [k, v] of Object.entries(troopCounts)) if ((v || 0) > 0) filtered[k] = v;
      if (Object.keys(filtered).length === 0) { setErr("Wähle Truppen"); return; }
      const body = mode === "setup"
        ? { action: "start", stronghold_id: stronghold.id, prep_seconds: prepSeconds, guardian_id: selectedGuardian, troops: filtered }
        : { action: "join", rally_id: rallyId, guardian_id: selectedGuardian, troops: filtered };
      const r = await fetch("/api/rally", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const j = await r.json() as { ok?: boolean; error?: string };
      if (!j.ok) { setErr(j.error ?? "Fehler"); return; }
      await onSuccess();
    } finally { setBusy(false); }
  }

  return (
    <div onClick={onClose} className="fixed inset-0 z-[9200] bg-black/85 backdrop-blur-lg flex items-center justify-center p-3">
      <div onClick={(e) => e.stopPropagation()} className="w-full max-w-lg max-h-[92vh] rounded-2xl bg-[#1A1D23] border border-[#FFD700]/40 shadow-2xl flex flex-col">
        <div className="p-4 border-b border-white/10">
          <button onClick={onClose} className="float-right w-8 h-8 rounded-full bg-black/40 text-white text-lg">×</button>
          <div className="text-[10px] font-black tracking-widest text-[#FFD700]">{mode === "setup" ? "AUFGEBOT STARTEN" : "AUFGEBOT BEITRETEN"}</div>
          <div className="text-lg font-black text-white mt-1 flex items-center gap-2">
            <StrongholdIcon level={stronghold.level} size={28} />
            Wegelager Lv {stronghold.level}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* Prep-Zeit (nur beim Start) */}
          {mode === "setup" && (
            <div>
              <div className="text-[10px] font-black tracking-widest text-[#a8b4cf] mb-2">VORBEREITUNGSZEIT</div>
              <div className="grid grid-cols-2 gap-2">
                {PREP_OPTIONS.map((o) => (
                  <button key={o.s} onClick={() => setPrepSeconds(o.s)}
                    className={`py-2 rounded-lg text-sm font-black ${prepSeconds === o.s ? "bg-[#FFD700] text-[#0F1115]" : "bg-white/5 text-white border border-white/10"}`}>
                    {o.label}
                  </button>
                ))}
              </div>
              <div className="text-[10px] text-[#6c7590] mt-1">Längere Vorbereitung = mehr Crew kann beitreten.</div>
            </div>
          )}

          {/* Wächter-Auswahl */}
          <div>
            <div className="text-[10px] font-black tracking-widest text-[#a8b4cf] mb-2">WÄCHTER (KOMMANDANT)</div>
            <div className="flex gap-2 overflow-x-auto pb-1">
              <button onClick={() => setSelectedGuardian(null)}
                className={`shrink-0 w-20 h-24 rounded-lg flex flex-col items-center justify-center text-xs font-black ${selectedGuardian === null ? "bg-[#FFD700]/20 border-2 border-[#FFD700] text-[#FFD700]" : "bg-white/5 border border-white/10 text-[#a8b4cf]"}`}>
                <span className="text-2xl">—</span><span className="text-[10px] mt-1">Kein Wächter</span>
              </button>
              {guardians.map((g) => (
                <button key={g.id} onClick={() => setSelectedGuardian(g.id)}
                  className={`shrink-0 w-20 h-24 rounded-lg flex flex-col items-center justify-center text-xs font-black overflow-hidden ${selectedGuardian === g.id ? "bg-[#FFD700]/20 border-2 border-[#FFD700]" : "bg-white/5 border border-white/10"}`}>
                  {g.video_url ? (
                    <video src={g.video_url} autoPlay loop muted playsInline className="w-14 h-14 object-cover rounded" style={{ filter: "url(#ma365-chroma-black)" }} />
                  ) : g.image_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={g.image_url} alt={g.name} className="w-14 h-14 object-cover rounded" style={{ filter: "url(#ma365-chroma-black)" }} />
                  ) : (
                    <span className="text-2xl">🛡</span>
                  )}
                  <span className="text-[9px] text-white truncate w-full px-1 mt-1">{g.name}</span>
                  <span className="text-[9px] text-[#FFD700]">Lv {g.level}</span>
                </button>
              ))}
              {guardians.length === 0 && <div className="text-[11px] text-[#a8b4cf] py-4">Kein aktiver Wächter</div>}
            </div>
          </div>

          {/* Truppen-Auswahl */}
          <div>
            <div className="text-[10px] font-black tracking-widest text-[#a8b4cf] mb-2">TRUPPEN ({totalCount.toLocaleString("de-DE")} ausgewählt)</div>
            <div className="space-y-1.5">
              {troopsCatalog.filter((t) => (troopHaveMap[t.id] ?? 0) > 0).map((t) => {
                const have = troopHaveMap[t.id] ?? 0;
                const v = troopCounts[t.id] ?? 0;
                return (
                  <div key={t.id} className="flex items-center gap-2 p-2 rounded bg-black/30 border border-white/5">
                    <span className="text-2xl">{t.emoji}</span>
                    <div className="flex-1 min-w-0">
                      <div className="text-[12px] font-black text-white">{t.name} <span className="text-[9px] text-[#a8b4cf]">Stufe {t.tier} · {t.base_atk} Angriff</span></div>
                      <div className="text-[9px] text-[#a8b4cf]">Vorrat: {have.toLocaleString("de-DE")}</div>
                    </div>
                    <input
                      type="number" min={0} max={have} value={v}
                      onChange={(e) => setTroopCounts({ ...troopCounts, [t.id]: Math.max(0, Math.min(have, parseInt(e.target.value || "0", 10))) })}
                      className="w-24 text-right px-2 py-1 rounded bg-white/5 border border-white/10 text-white text-[12px]"
                    />
                    <button onClick={() => setTroopCounts({ ...troopCounts, [t.id]: have })}
                      className="text-[9px] font-black px-2 py-1 rounded bg-white/5 text-[#a8b4cf]">MAX</button>
                  </div>
                );
              })}
              {troopsCatalog.filter((t) => (troopHaveMap[t.id] ?? 0) > 0).length === 0 && (
                <div className="text-[11px] text-[#a8b4cf] py-4 text-center">Du hast noch keine Truppen — trainiere im Truppen-Tab.</div>
              )}
            </div>
          </div>

          <div className="rounded-lg bg-[#FFD700]/10 border border-[#FFD700]/40 p-3 flex items-center justify-between">
            <div className="text-[11px] text-[#a8b4cf]">Dein Beitrag</div>
            <div className="text-lg font-black text-[#FFD700]">{totalAtk.toLocaleString("de-DE")} Angriff</div>
          </div>

          {err && <div className="text-[11px] text-center font-black text-[#FF2D78]">{err}</div>}

          {/* Wetter+Tageszeit auf den Anmarsch */}
          <WeatherActionHint lever="movement" />
        </div>

        <div className="p-4 border-t border-white/10">
          <button onClick={submit} disabled={busy || totalCount === 0}
            className="w-full py-3 rounded-xl bg-gradient-to-r from-[#FFD700] to-[#FF6B4A] text-[#0F1115] font-black text-sm disabled:opacity-40">
            {busy ? "…" : (mode === "setup" ? "⚔️ Crew-Angriff starten" : "⚔️ Beitreten")}
          </button>
        </div>
      </div>
    </div>
  );
}

function StrongholdIcon({ level, size = 28 }: { level: number; size?: number }) {
  const art = useStrongholdArt();
  const a = pickStrongholdArt(art, level);
  if (a?.video_url) return <video src={a.video_url} autoPlay loop muted playsInline style={{ width: size, height: size, objectFit: "contain" }} />;
  // eslint-disable-next-line @next/next/no-img-element
  if (a?.image_url) return <img src={a.image_url} alt={`stronghold lv ${level}`} style={{ width: size, height: size, objectFit: "contain" }} />;
  return <span style={{ fontSize: size }}>🏰</span>;
}

// ActiveRallyBanner wurde nach components/rally-banner.tsx ausgelagert
// (genutzt fuer Wegelager + Mutant-Rallies). Re-Export hier fuer
// Backward-Compatibility, falls Code noch ueber den alten Pfad importiert.
export { ActiveRallyBanner } from "@/components/rally-banner";
