"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useStrongholdArt, pickStrongholdArt } from "@/components/resource-icon";

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

export function StrongholdModal({ stronghold, onClose, activeRally, refreshRally }: {
  stronghold: Stronghold;
  onClose: () => void;
  activeRally: RallyState["rally"];
  refreshRally: () => Promise<void>;
}) {
  const [setup, setSetup] = useState<"setup" | "join" | null>(null);
  const sameTarget = activeRally && activeRally.stronghold_id === stronghold.id;
  const canStart = !activeRally;
  const strongholdArt = useStrongholdArt();
  const art = pickStrongholdArt(strongholdArt, stronghold.level);

  return (
    <div onClick={onClose} className="fixed inset-0 z-[1100] bg-black/75 backdrop-blur-md flex items-center justify-center p-4">
      <div onClick={(e) => e.stopPropagation()} className="w-full max-w-md rounded-2xl bg-[#1A1D23] border border-[#FF2D78]/40 shadow-2xl overflow-hidden">
        <div className="relative p-4 bg-gradient-to-br from-[#FF2D78]/20 to-[#FF6B4A]/10 flex items-center gap-3">
          <button onClick={onClose} className="absolute top-3 right-3 w-8 h-8 rounded-full bg-black/40 text-white text-lg z-10" aria-label="Schließen">×</button>
          <div className="shrink-0 w-20 h-20 flex items-center justify-center">
            {art?.video_url ? (
              <video src={art.video_url} autoPlay loop muted playsInline className="w-20 h-20 object-contain" />
            ) : art?.image_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={art.image_url} alt={`Wegelager Lv ${stronghold.level}`} className="w-20 h-20 object-contain" />
            ) : (
              <span className="text-5xl">🏰</span>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-[10px] font-black tracking-widest text-[#FF2D78]">WEGELAGER</div>
            <div className="text-2xl font-black text-white mt-1">Stufe {stronghold.level}</div>
            <div className="text-[11px] text-[#a8b4cf] mt-1">Crew-Streifzug erforderlich</div>
          </div>
        </div>

        <div className="p-4 space-y-4">
          <div className="rounded-xl bg-black/40 border border-white/10 p-3">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[10px] font-black tracking-widest text-[#a8b4cf]">FESTUNGS-HP</span>
              <span className="text-[12px] font-black text-white">{stronghold.current_hp.toLocaleString("de-DE")} / {stronghold.total_hp.toLocaleString("de-DE")}</span>
            </div>
            <div className="h-3 rounded-full bg-white/10 overflow-hidden">
              <div className="h-full bg-gradient-to-r from-[#4ade80] via-[#FFD700] to-[#FF6B4A]" style={{ width: `${stronghold.hp_pct}%` }} />
            </div>
            <div className="text-[10px] text-[#a8b4cf] mt-2">
              Empfohlen: <b className="text-white">{(stronghold.total_hp).toLocaleString("de-DE")} ATK</b> aus deiner Crew. Truppen-Tier {Math.max(1, Math.min(5, Math.ceil(stronghold.level / 2)))}+ empfohlen.
            </div>
          </div>

          <div className="rounded-xl bg-black/30 border border-white/5 p-3 text-[11px] text-[#a8b4cf] leading-relaxed">
            <b className="text-white">Belohnung bei Sieg</b><br/>
            • <b className="text-[#FFD700]">{stronghold.level * 500}</b> Holz + Stein + Gold (anteilig nach Beitrag)<br/>
            • <b className="text-[#FFD700]">{stronghold.level * 250}</b> Mana<br/>
            • Wächter-XP × {stronghold.level * 10}<br/>
            {stronghold.level >= 5 && <>• 🥈 Silber-Truhe (60% bei Lv 5–7)<br/></>}
            {stronghold.level >= 8 && <>• 🥇 Gold-Truhe (50% bei Lv 8+)<br/></>}
          </div>

          {sameTarget && activeRally && (
            <div className="rounded-xl bg-[#FFD700]/10 border border-[#FFD700]/40 p-3">
              <div className="text-[11px] font-black text-[#FFD700] mb-1">⚡ AKTIVER CREW-ANGRIFF</div>
              <div className="text-[12px] text-white">Status: <b>{activeRally.status}</b> · Gesamt-Angriff: <b>{activeRally.total_atk.toLocaleString("de-DE")}</b></div>
              <button onClick={() => setSetup("join")} className="mt-3 w-full py-2.5 rounded-lg bg-gradient-to-r from-[#FFD700] to-[#FF6B4A] text-[#0F1115] font-black text-sm">
                Crew-Angriff beitreten
              </button>
            </div>
          )}

          {!sameTarget && activeRally && (
            <div className="rounded-xl bg-white/5 border border-white/10 p-3 text-[11px] text-[#a8b4cf]">
              ⚠️ Deine Crew hat bereits einen aktiven Crew-Angriff an einem anderen Wegelager. Erst das abschließen.
            </div>
          )}

          {canStart && (
            <button onClick={() => setSetup("setup")} className="w-full py-3 rounded-xl bg-gradient-to-r from-[#FF2D78] to-[#FF6B4A] text-white font-black text-sm shadow-lg">
              ⚔️ Crew-Angriff starten
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
    <div onClick={onClose} className="fixed inset-0 z-[1200] bg-black/85 backdrop-blur-lg flex items-center justify-center p-3">
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
                    <video src={g.video_url} autoPlay loop muted playsInline className="w-14 h-14 object-cover rounded" style={{ filter: "url(#ma365-chroma-green)" }} />
                  ) : g.image_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={g.image_url} alt={g.name} className="w-14 h-14 object-cover rounded" style={{ filter: "url(#ma365-chroma-green)" }} />
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
                      <div className="text-[12px] font-black text-white">{t.name} <span className="text-[9px] text-[#a8b4cf]">T{t.tier} · {t.base_atk} ATK</span></div>
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
            <div className="text-lg font-black text-[#FFD700]">{totalAtk.toLocaleString("de-DE")} ATK</div>
          </div>

          {err && <div className="text-[11px] text-center font-black text-[#FF2D78]">{err}</div>}
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

export function ActiveRallyBanner({ rally, onOpen }: {
  rally: RallyState["rally"];
  onOpen: () => void;
}) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => { const id = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(id); }, []);
  if (!rally) return null;

  const target = rally.status === "preparing" ? new Date(rally.prep_ends_at).getTime() : rally.march_ends_at ? new Date(rally.march_ends_at).getTime() : 0;
  const remain = Math.max(0, target - now);
  const hh = Math.floor(remain / 3600000);
  const mm = Math.floor((remain % 3600000) / 60000);
  const ss = Math.floor((remain % 60000) / 1000);
  const countdown = hh > 0 ? `${hh}h ${String(mm).padStart(2,"0")}m` : `${mm}:${String(ss).padStart(2,"0")}`;

  const statusColor = rally.status === "preparing" ? "#FFD700" : rally.status === "marching" ? "#FF6B4A" : "#FF2D78";
  const statusText  = rally.status === "preparing" ? "⏳ Vorbereitung" : rally.status === "marching" ? "🏃 Streifzug" : "⚔️ Kampf";

  return (
    <RallyBannerInner rally={rally} statusColor={statusColor} statusText={statusText} countdown={countdown} onOpen={onOpen} />
  );
}

function RallyBannerInner({ rally, statusColor, statusText, countdown, onOpen }: {
  rally: NonNullable<RallyState["rally"]>;
  statusColor: string;
  statusText: string;
  countdown: string;
  onOpen: () => void;
}) {
  const strongholdArt = useStrongholdArt();
  // Wir haben hier nur stronghold_id, nicht das Level — nimm "default" Slot.
  const art = strongholdArt.default;
  return (
    <button onClick={onOpen} className="w-full px-3 py-2 rounded-xl flex items-center gap-2 backdrop-blur" style={{
      background: `linear-gradient(135deg, ${statusColor}33, rgba(15,17,21,0.85))`,
      border: `1px solid ${statusColor}77`,
    }}>
      {art?.video_url ? (
        <video src={art.video_url} autoPlay loop muted playsInline style={{ width: 28, height: 28, objectFit: "contain" }} />
      ) : art?.image_url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={art.image_url} alt="stronghold" style={{ width: 28, height: 28, objectFit: "contain" }} />
      ) : (
        <span style={{ fontSize: 22 }}>🏰</span>
      )}
      <div className="flex-1 text-left">
        <div className="text-[10px] font-black tracking-widest" style={{ color: statusColor }}>AUFGEBOT · {statusText}</div>
        <div className="text-[12px] font-black text-white">{countdown} · {rally.total_atk.toLocaleString("de-DE")} ATK</div>
      </div>
      <span className="text-white text-lg">›</span>
    </button>
  );
}
