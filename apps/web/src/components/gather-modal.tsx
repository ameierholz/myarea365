"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type ResourceNode = {
  id: number;
  kind: "scrapyard" | "factory" | "atm" | "datacenter";
  resource_type: "wood" | "stone" | "gold" | "mana";
  name: string | null;
  lat: number;
  lng: number;
  level: number;
  total_yield: number;
  current_yield: number;
  gather_active?: boolean;
  gather_someone_gathering?: boolean;
  gather_finish_at?: string | null;
  gather_mine?: boolean;
  gather_username?: string | null;
  gather_crew_tag?: string | null;
};

type Guardian = {
  id: string;
  level: number;
  name: string;
  image_url: string | null;
  video_url: string | null;
};

const KIND_META: Record<ResourceNode["kind"], { label: string; emoji: string; resourceLabel: string; resourceEmoji: string }> = {
  scrapyard:  { label: "Schrottplatz", emoji: "⚙️", resourceLabel: "Tech-Schrott", resourceEmoji: "⚙️" },
  factory:    { label: "Fabrik",       emoji: "🔩", resourceLabel: "Komponenten",  resourceEmoji: "🔩" },
  atm:        { label: "ATM/Bank",     emoji: "💸", resourceLabel: "Krypto",       resourceEmoji: "💸" },
  datacenter: { label: "Datacenter",   emoji: "📡", resourceLabel: "Bandbreite",   resourceEmoji: "📡" },
};

function fmtDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  if (m === 0) return `${s}s`;
  if (m < 60) return s === 0 ? `${m}m` : `${m}m ${s}s`;
  const h = Math.floor(m / 60);
  const mm = m % 60;
  return `${h}h ${mm}m`;
}

function haversineMeters(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const R = 6371000;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const la1 = (a.lat * Math.PI) / 180;
  const la2 = (b.lat * Math.PI) / 180;
  const x = Math.sin(dLat / 2) ** 2 + Math.cos(la1) * Math.cos(la2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(x));
}

export function GatherModal({
  node,
  userCenter,
  basePos,
  onClose,
  onSuccess,
  anchorX,
  anchorY,
}: {
  node: ResourceNode;
  userCenter: { lat: number; lng: number } | null;
  basePos?: { lat: number; lng: number } | null;
  onClose: () => void;
  onSuccess: () => void;
  /** Screen-Position des angeklickten Pins (clientX/Y). Optional — fallback auf Viewport-Mitte. */
  anchorX?: number;
  anchorY?: number;
}) {
  const sb = createClient();
  const [guardians, setGuardians] = useState<Guardian[]>([]);
  const [selectedGuardian, setSelectedGuardian] = useState<string | null>(null);
  const [troopCount, setTroopCount] = useState<number>(500);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const meta = KIND_META[node.kind];

  // ESC schließt das Popup
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const load = useCallback(async () => {
    const { data } = await sb
      .from("user_guardians")
      .select("id, level, archetype:guardian_archetypes(id,name,image_url,video_url)")
      .eq("is_active", true)
      .limit(20);
    type Row = { id: string; level: number; archetype: { id: string; name: string; image_url: string | null; video_url: string | null } | null };
    const list = ((data ?? []) as unknown as Row[]).map((r) => ({
      id: r.id,
      level: r.level,
      name: r.archetype?.name ?? "Wächter",
      image_url: r.archetype?.image_url ?? null,
      video_url: r.archetype?.video_url ?? null,
    }));
    setGuardians(list);
    if (list.length > 0 && !selectedGuardian) setSelectedGuardian(list[0].id);
  }, [sb, selectedGuardian]);

  useEffect(() => { void load(); }, [load]);

  // Origin = Base (falls platziert), sonst aktuelle GPS-Position als Fallback
  const origin = basePos ?? userCenter;
  const distM = origin ? haversineMeters(origin, { lat: node.lat, lng: node.lng }) : 0;
  const walkS = Math.max(60, Math.round(distM / 1.39));
  const gatherS = Math.max(60, Math.round((node.current_yield / 1000) * 300 / Math.max(1, troopCount / 100)));
  const returnS = walkS;
  const totalS = walkS + gatherS + returnS;

  async function start() {
    if (!selectedGuardian) { setErr("Wähle einen Wächter"); return; }
    if (!origin) { setErr("Setze zuerst deine Base"); return; }
    setBusy(true); setErr(null);
    try {
      const r = await fetch("/api/gather/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          node_id: node.id,
          guardian_id: selectedGuardian,
          troop_count: troopCount,
          user_lat: origin.lat,
          user_lng: origin.lng,
        }),
      });
      const j = await r.json() as { ok?: boolean; error?: string; message?: string };
      if (!j.ok) {
        const msg = j.error === "node_busy" ? (j.message ?? "Plünderziel belegt") :
                    j.error === "node_depleted" ? "Plünderziel erschöpft" :
                    (j.message ?? j.error ?? "Fehler beim Starten");
        setErr(msg);
        return;
      }
      onSuccess();
      onClose();
    } catch {
      setErr("Netzwerkfehler");
    } finally {
      setBusy(false);
    }
  }

  // Popup-Position: rechts vom Pin, mit Viewport-Clamping
  const POPUP_W = 360;
  const POPUP_H_EST = 520;
  const PAD = 12;
  const vw = typeof window !== "undefined" ? window.innerWidth : 1024;
  const vh = typeof window !== "undefined" ? window.innerHeight : 768;
  const ax = anchorX ?? vw / 2;
  const ay = anchorY ?? vh / 2;
  let left = ax + 24;
  if (left + POPUP_W + PAD > vw) left = ax - POPUP_W - 24;
  if (left < PAD) left = PAD;
  let top = ay - POPUP_H_EST / 2;
  if (top + POPUP_H_EST + PAD > vh) top = vh - POPUP_H_EST - PAD;
  if (top < PAD) top = PAD;
  const maxH = vh - top - PAD;

  return (
    <div onClick={onClose} className="fixed inset-0 z-[9100]" style={{ background: "transparent" }}>
      <div
        onClick={(e) => e.stopPropagation()}
        className="absolute rounded-2xl bg-[#1A1D23] border border-[#FFD700]/50 shadow-2xl flex flex-col overflow-hidden"
        style={{ left, top, width: POPUP_W, maxHeight: maxH, boxShadow: "0 12px 40px rgba(0,0,0,0.55)" }}
      >
        {/* Header */}
        <div className="p-4 border-b border-white/10 flex items-center gap-3">
          <span className="text-3xl">{meta.emoji}</span>
          <div className="flex-1 min-w-0">
            <div className="text-[10px] font-black tracking-widest text-[#FFD700]">PLÜNDERZUG</div>
            <div className="text-base font-black text-white truncate">{node.name ?? meta.label} — Lv {node.level}</div>
            <div className="text-[11px] text-[#a8b4cf]">
              {meta.resourceEmoji} {node.current_yield.toLocaleString("de-DE")} {meta.resourceLabel} verfügbar
            </div>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-full bg-black/40 text-white text-lg shrink-0">×</button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* Distanz / Walk-Zeit */}
          <div className="rounded-xl bg-white/5 border border-white/10 p-3 grid grid-cols-3 gap-2 text-center">
            <div>
              <div className="text-[9px] font-black tracking-widest text-[#a8b4cf]">DISTANZ</div>
              <div className="text-sm font-black text-white mt-1">{distM > 1000 ? `${(distM/1000).toFixed(1)} km` : `${Math.round(distM)} m`}</div>
            </div>
            <div>
              <div className="text-[9px] font-black tracking-widest text-[#a8b4cf]">HINWEG</div>
              <div className="text-sm font-black text-[#22D1C3] mt-1">{fmtDuration(walkS)}</div>
            </div>
            <div>
              <div className="text-[9px] font-black tracking-widest text-[#a8b4cf]">GESAMT</div>
              <div className="text-sm font-black text-[#FFD700] mt-1">{fmtDuration(totalS)}</div>
            </div>
          </div>

          {/* Wächter */}
          <div>
            <div className="text-[10px] font-black tracking-widest text-[#a8b4cf] mb-2">PLÜNDER-WÄCHTER</div>
            {guardians.length === 0 ? (
              <div className="text-[11px] text-[#a8b4cf] py-3 text-center bg-white/5 rounded-lg border border-white/10">
                Kein aktiver Wächter — aktiviere zuerst einen Wächter.
              </div>
            ) : (
              <div className="flex gap-2 overflow-x-auto pb-1">
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
              </div>
            )}
          </div>

          {/* Truppen-Slider */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <div className="text-[10px] font-black tracking-widest text-[#a8b4cf]">TRUPPEN</div>
              <div className="text-sm font-black text-white">{troopCount.toLocaleString("de-DE")}</div>
            </div>
            <input
              type="range" min={100} max={2000} step={100} value={troopCount}
              onChange={(e) => setTroopCount(parseInt(e.target.value, 10))}
              className="w-full accent-[#FFD700]"
            />
            <div className="flex justify-between text-[9px] text-[#6c7590] mt-1">
              <span>100</span><span>1000</span><span>2000</span>
            </div>
            <div className="text-[10px] text-[#a8b4cf] mt-2">
              Plünderzeit: <span className="text-[#22D1C3] font-black">{fmtDuration(gatherS)}</span> · Mehr Banditen = schneller.
            </div>
          </div>

          {node.gather_active && (
            <div className={`text-[12px] rounded p-2 border ${node.gather_mine ? "text-[#4ade80] bg-[#4ade80]/10 border-[#4ade80]/40" : "text-[#FF6B8D] bg-[#FF2D78]/10 border-[#FF2D78]/40"}`}>
              <div className="font-black">
                {node.gather_mine ? "🟢 Dein Trupp ist aktiv" : "🔴 Belegt von fremder Crew"}
              </div>
              <div className="mt-0.5 text-[11px] opacity-90">
                Plünderer:{" "}
                {node.gather_crew_tag && <span className="font-bold">[{node.gather_crew_tag}]</span>}{" "}
                <span className="font-bold">{node.gather_username ?? "Unbekannt"}</span>
                {node.gather_someone_gathering && node.gather_finish_at && (
                  <> · fertig in <CountdownText finishAt={node.gather_finish_at} /></>
                )}
              </div>
              <div className="mt-0.5 text-[10px] opacity-75">
                Pro Plünderziel ist nur ein Trupp gleichzeitig erlaubt — warte bis er fertig ist.
              </div>
            </div>
          )}
          {err && <div className="text-[12px] text-[#FF6B4A] bg-[#FF6B4A]/10 border border-[#FF6B4A]/30 rounded p-2">{err}</div>}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-white/10">
          <button
            disabled={busy || guardians.length === 0 || !selectedGuardian || !origin || !!node.gather_active}
            onClick={start}
            className="w-full py-3 rounded-xl bg-gradient-to-r from-[#FFD700] to-[#FF8C00] text-[#0F1115] font-black text-sm shadow-lg disabled:opacity-50"
          >
            {node.gather_active ? "🔒 Belegt" : busy ? "Marsch startet…" : `🚶 Marsch starten (${fmtDuration(totalS)})`}
          </button>
        </div>
      </div>
    </div>
  );
}

function CountdownText({ finishAt }: { finishAt: string }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  const remaining = Math.max(0, new Date(finishAt).getTime() - now);
  const s = Math.floor(remaining / 1000);
  const m = Math.floor(s / 60);
  const sec = s % 60;
  const txt = m > 0 ? `${m}m ${String(sec).padStart(2, "0")}s` : `${sec}s`;
  return <span className="font-black tabular-nums">{txt}</span>;
}

