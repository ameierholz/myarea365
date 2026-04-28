"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { UiIcon, useUiIconArt } from "@/components/resource-icon";

type Troop = { id: string; name: string; emoji: string; troop_class: string; tier: number; base_atk: number; base_def: number; base_hp: number };
type RepeaterKind = "hq" | "repeater" | "mega";

const KIND_INFO: Record<RepeaterKind, { label: string; icon: string; slot: string; cost_gold: number; cost_wood: number; cost_stone: number; max_hp: number }> = {
  hq:       { label: "Zentral-Server (Hauptquartier)", icon: "🏛️", slot: "repeater_hq",     cost_gold: 5000, cost_wood: 2000, cost_stone: 2000, max_hp: 10000 },
  repeater: { label: "Signal-Repeater",     icon: "📶", slot: "repeater_normal", cost_gold:  500, cost_wood:  500, cost_stone:  500, max_hp:  3000 },
  mega:     { label: "Mega-Server",         icon: "📡", slot: "repeater_mega",   cost_gold: 2000, cost_wood: 1000, cost_stone: 1500, max_hp:  8000 },
};

type Repeater = {
  id: string;
  crew_id: string;
  crew_name: string | null;
  crew_tag: string | null;
  kind: RepeaterKind;
  label: string | null;
  lat: number;
  lng: number;
  hp: number;
  max_hp: number;
  is_own: boolean;
};

/* ─────────────────────────────────────────────────────────
   PLACE-REPEATER-MODAL
   ───────────────────────────────────────────────────────── */
export function PlaceRepeaterModal({
  lat, lng, onClose, onPlaced,
}: {
  lat: number;
  lng: number;
  onClose: () => void;
  onPlaced: () => void;
}) {
  const [kind, setKind] = useState<RepeaterKind>("repeater");
  const [label, setLabel] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [hasHQ, setHasHQ] = useState<boolean | null>(null);
  const [resources, setResources] = useState<{ gold: number; wood: number; stone: number } | null>(null);
  const uiArt = useUiIconArt();

  useEffect(() => {
    (async () => {
      const sb = createClient();
      const { data: { user } } = await sb.auth.getUser();
      if (!user) return;
      const { data: sum } = await sb.rpc("my_crew_repeater_summary");
      setHasHQ(!!(sum as { has_hq?: boolean } | null)?.has_hq);
      const { data: res } = await sb.from("user_resources").select("gold, wood, stone").eq("user_id", user.id).maybeSingle();
      setResources(res ?? { gold: 0, wood: 0, stone: 0 });
      // Default-Kind: wenn noch kein HQ → hq
      if ((sum as { has_hq?: boolean } | null)?.has_hq === false) setKind("hq");
    })();
  }, []);

  const stats = KIND_INFO[kind];
  const canAfford = resources
    ? resources.gold >= stats.cost_gold && resources.wood >= stats.cost_wood && resources.stone >= stats.cost_stone
    : false;
  const blockedByHQRule = hasHQ === false && kind !== "hq";

  async function place() {
    setBusy(true); setErr(null);
    const r = await fetch("/api/crews/turf", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ lat, lng, kind, label: label.trim() || null }),
    });
    const j = await r.json();
    if (!r.ok || j?.ok === false) {
      setErr(j?.error || "place_failed");
    } else {
      onPlaced();
      onClose();
    }
    setBusy(false);
  }

  return (
    <Backdrop onClose={onClose}>
      <Card>
        <Header
          title="Repeater setzen"
          subtitle={`${lat.toFixed(5)}, ${lng.toFixed(5)}`}
          onClose={onClose}
        />

        {hasHQ === false && (
          <div className="mx-4 mb-3 px-3 py-2 rounded-lg bg-[#FFD700]/10 border border-[#FFD700]/40 text-[11px] text-[#FFD700] font-bold">
            Erster Repeater MUSS ein Hauptquartier (Zentral-Server) sein.
          </div>
        )}

        <div className="px-4 pb-3 space-y-2">
          {(["hq", "repeater", "mega"] as RepeaterKind[]).map((k) => {
            const info = KIND_INFO[k];
            const sel = k === kind;
            const disabled = (k === "hq" && hasHQ === true) || (k !== "hq" && hasHQ === false);
            return (
              <button
                key={k}
                disabled={disabled}
                onClick={() => setKind(k)}
                className={`w-full flex items-center gap-3 p-3 rounded-lg border transition ${
                  sel
                    ? "bg-[#22D1C3]/15 border-[#22D1C3]"
                    : disabled
                      ? "opacity-40 border-white/10"
                      : "border-white/15 hover:border-white/30"
                }`}
              >
                <span style={{ width: 36, height: 36, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <UiIcon slot={info.slot} fallback={info.icon} art={uiArt} size={32} />
                </span>
                <span className="flex-1 text-left">
                  <div className="text-[13px] font-black text-white">{info.label}</div>
                  <div className="text-[10px] text-white/60">Leben {info.max_hp.toLocaleString()} · {info.cost_gold}🪙 {info.cost_wood}🪵 {info.cost_stone}🪨</div>
                </span>
                {disabled && k === "hq" && <span className="text-[9px] text-white/40">vorhanden</span>}
                {disabled && k !== "hq" && <span className="text-[9px] text-white/40">Hauptquartier fehlt</span>}
              </button>
            );
          })}

          <input
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="Spitzname (optional, z.B. 'Kreuzberg-Tor')"
            className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-[12px] text-white"
            maxLength={40}
          />

          {!canAfford && resources && (
            <div className="text-[10px] text-[#FF2D78] font-bold">
              Zu wenig Ressourcen — du hast {resources.gold}🪙 {resources.wood}🪵 {resources.stone}🪨
            </div>
          )}
          {err && <div className="text-[10px] text-[#FF2D78] font-bold">Fehler: {err}</div>}
        </div>

        <Footer
          onClose={onClose}
          onConfirm={place}
          confirmDisabled={busy || !canAfford || blockedByHQRule}
          confirmLabel={busy ? "..." : "Bauen"}
        />
      </Card>
    </Backdrop>
  );
}

/* ─────────────────────────────────────────────────────────
   ATTACK-REPEATER-MODAL (Solo + Rally)
   ───────────────────────────────────────────────────────── */
export function AttackRepeaterModal({
  repeater, onClose, onAttacked,
}: {
  repeater: Repeater;
  onClose: () => void;
  onAttacked: () => void;
}) {
  const [troops, setTroops] = useState<Troop[]>([]);
  const [available, setAvailable] = useState<Record<string, number>>({});
  const [picked, setPicked] = useState<Record<string, number>>({});
  const [mode, setMode] = useState<"attack" | "rally">("attack");
  const [prep, setPrep] = useState<number>(180);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [hasCrew, setHasCrew] = useState<boolean>(false);
  const [openClass, setOpenClass] = useState<string | null>(null);
  const [marchCaps, setMarchCaps] = useState<{ march_capacity: number; march_queue: number; burg_level: number; guardian_bonus_pct: number } | null>(null);
  const [activeMarches, setActiveMarches] = useState<number>(0);

  const load = useCallback(async () => {
    const sb = createClient();
    const { data: { user } } = await sb.auth.getUser();
    if (!user) return;
    const [troopsApi, cm, capsRpc, marchesRpc] = await Promise.all([
      fetch("/api/base/troops", { cache: "no-store" }).then((r) => r.ok ? r.json() : { catalog: [], owned: [] }),
      sb.from("crew_members").select("crew_id").eq("user_id", user.id).maybeSingle(),
      sb.rpc("get_march_caps"),
      sb.rpc("count_active_marches"),
    ]);
    setTroops((troopsApi.catalog ?? []) as Troop[]);
    const a: Record<string, number> = {};
    (troopsApi.owned ?? []).forEach((r: { troop_id: string; count: number }) => { a[r.troop_id] = r.count; });
    setAvailable(a);
    setHasCrew(!!cm.data);
    const capsRow = ((capsRpc.data as Array<{ march_capacity: number; march_queue: number; burg_level: number; guardian_bonus_pct: number }>)?.[0]) ?? null;
    if (capsRow) setMarchCaps(capsRow);
    if (typeof marchesRpc.data === "number") setActiveMarches(marchesRpc.data);
  }, []);

  useEffect(() => { void load(); }, [load]);

  const totalAtk = useMemo(() => {
    return troops.reduce((s, t) => s + (picked[t.id] ?? 0) * (t.base_atk || 10), 0);
  }, [troops, picked]);

  function bump(troopId: string, delta: number) {
    setPicked((p) => {
      const current = p[troopId] ?? 0;
      const max = available[troopId] ?? 0;
      const cap = marchCaps?.march_capacity ?? 999999;
      const otherSel = Object.entries(p).filter(([k]) => k !== troopId).reduce((s, [, v]) => s + v, 0);
      const remaining = Math.max(0, cap - otherSel);
      const next = Math.max(0, Math.min(max, remaining, current + delta));
      if (next === 0) { const { [troopId]: _, ...rest } = p; void _; return rest; }
      return { ...p, [troopId]: next };
    });
  }
  function setMax(troopId: string) {
    setPicked((p) => {
      const cap = marchCaps?.march_capacity ?? 999999;
      const otherSel = Object.entries(p).filter(([k]) => k !== troopId).reduce((s, [, v]) => s + v, 0);
      const remaining = Math.max(0, cap - otherSel);
      return { ...p, [troopId]: Math.min(available[troopId] ?? 0, remaining) };
    });
  }

  async function send() {
    setBusy(true); setErr(null);
    if (Object.keys(picked).length === 0) { setErr("Wähl mindestens 1 Truppe."); setBusy(false); return; }
    const url = mode === "rally" ? "/api/crews/turf/rally" : "/api/crews/turf/attack";
    const body = mode === "rally"
      ? { repeater_id: repeater.id, prep_seconds: prep, troops: picked }
      : { repeater_id: repeater.id, troops: picked };
    const r = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    const j = await r.json();
    if (!r.ok || j?.ok === false) {
      setErr(j?.error || "attack_failed");
    } else {
      onAttacked();
      onClose();
    }
    setBusy(false);
  }

  if (repeater.is_own) {
    return (
      <Backdrop onClose={onClose}>
        <Card>
          <Header title={repeater.label ?? KIND_INFO[repeater.kind].label} subtitle="Eigener Repeater" onClose={onClose} />
          <div className="px-4 py-4 text-[12px] text-white/80">
            <div className="mb-2">Crew: <b>{repeater.crew_name}</b></div>
            <div className="mb-2">Typ: <b>{KIND_INFO[repeater.kind].label}</b></div>
            <div>Leben: <b>{repeater.hp.toLocaleString()} / {repeater.max_hp.toLocaleString()}</b></div>
          </div>
        </Card>
      </Backdrop>
    );
  }

  return (
    <Backdrop onClose={onClose}>
      <Card wide>
        <Header
          title={`Angriff: ${repeater.label ?? KIND_INFO[repeater.kind].label}`}
          subtitle={`Crew: ${repeater.crew_name ?? "?"} · Leben ${repeater.hp.toLocaleString()}/${repeater.max_hp.toLocaleString()}`}
          onClose={onClose}
        />

        <div className="px-4 pb-2 flex gap-2">
          <ModeButton active={mode === "attack"} onClick={() => setMode("attack")} icon="⚔️" label="Solo-Angriff" />
          <ModeButton active={mode === "rally"} onClick={() => hasCrew && setMode("rally")} disabled={!hasCrew} icon="📣" label="Crew-Aufgebot" />
        </div>

        {mode === "rally" && (
          <div className="px-4 pb-2 flex gap-2">
            {[
              { s: 180, l: "3 min" },
              { s: 480, l: "8 min" },
              { s: 1680, l: "28 min" },
            ].map((p) => (
              <button
                key={p.s}
                onClick={() => setPrep(p.s)}
                className={`flex-1 px-2 py-1.5 rounded-md text-[11px] font-bold ${
                  prep === p.s ? "bg-[#FF2D78] text-white" : "bg-white/5 text-white/70 border border-white/10"
                }`}
              >Prep: {p.l}</button>
            ))}
          </div>
        )}

        {(() => {
          const cap = marchCaps?.march_capacity ?? null;
          const totalCount = Object.values(picked).reduce((s, n) => s + n, 0);
          const overCap = cap !== null && totalCount > cap;
          const queueFull = marchCaps !== null && activeMarches >= marchCaps.march_queue;
          const grouped: Record<string, Troop[]> = {};
          for (const t of troops) (grouped[t.troop_class] ??= []).push(t);

          return (
            <>
              {marchCaps && (
                <div className={`mx-4 mb-2 px-3 py-2 rounded-lg text-[11px] font-bold flex items-center justify-between ${
                  queueFull ? "bg-[#FF2D78]/15 border border-[#FF2D78]/40 text-[#FF2D78]"
                  : "bg-[#22D1C3]/10 border border-[#22D1C3]/30 text-white/80"
                }`}>
                  <span>📦 March-Cap: <b className="text-white">{totalCount}/{cap}</b>
                    <span className="text-white/50 ml-2">· Burg Lv {marchCaps.burg_level}</span>
                    {marchCaps.guardian_bonus_pct > 0 && <span className="text-[#FFD700] ml-2">+{marchCaps.guardian_bonus_pct}%</span>}
                  </span>
                  <span className={queueFull ? "text-[#FF2D78]" : "text-white/60"}>
                    {activeMarches}/{marchCaps.march_queue} Marches
                  </span>
                </div>
              )}

              <div className="px-4 pb-3 space-y-1.5 max-h-[40vh] overflow-y-auto">
                {Object.keys(grouped).length === 0 && (
                  <div className="text-center text-[12px] text-white/60 py-6">Keine Truppen verfügbar.</div>
                )}
                {Object.entries(grouped).map(([cls, list]) => {
                  const open = openClass === cls;
                  const classSel = list.reduce((s, t) => s + (picked[t.id] ?? 0), 0);
                  const classHave = list.reduce((s, t) => s + (available[t.id] ?? 0), 0);
                  const CLS_LABEL: Record<string, string> = {
                    infantry: "🛡️ Türsteher", cavalry: "🏍️ Kuriere",
                    marksman: "🎯 Schleuderer", siege: "🔨 Brecher",
                  };
                  return (
                    <div key={cls} className="rounded-lg bg-black/20 border border-white/5 overflow-hidden">
                      <button onClick={() => setOpenClass(open ? null : cls)}
                        className="w-full flex items-center justify-between px-3 py-2 text-[12px] font-black text-white hover:bg-white/5">
                        <span>{CLS_LABEL[cls] ?? cls}</span>
                        <span className="text-white/60 text-[10px] flex items-center gap-2">
                          {classSel > 0 && <span className="text-[#FFD700] font-black">{classSel}</span>}
                          <span className="text-white/40">verfügbar {classHave}</span>
                          <span>{open ? "▾" : "▸"}</span>
                        </span>
                      </button>
                      {open && (
                        <div className="p-2 space-y-1 border-t border-white/5">
                          {list.map((t) => {
                            const av = available[t.id] ?? 0;
                            const pk = picked[t.id] ?? 0;
                            return (
                              <div key={t.id} className="flex items-center gap-2 px-2 py-1.5 rounded bg-black/30 border border-white/5">
                                <span className="text-base shrink-0 w-6 text-center">{t.emoji}</span>
                                <div className="flex-1 min-w-0">
                                  <div className="text-[11px] font-black text-white truncate">{t.name} <span className="text-white/40">T{t.tier}</span></div>
                                  <div className="text-[9px] text-white/50">Angriff {t.base_atk} · Verteidigung {t.base_def} · Leben {t.base_hp} · da {av}</div>
                                </div>
                                <input type="number" min={0} max={av} value={pk}
                                  onChange={(e) => {
                                    const n = parseInt(e.target.value || "0", 10);
                                    setPicked((p) => ({ ...p, [t.id]: Math.max(0, Math.min(av, n)) }));
                                  }}
                                  className="w-16 text-right text-[11px] font-black px-2 py-1 rounded bg-black/50 border border-white/10 text-white" />
                                <button onClick={() => setMax(t.id)} className="px-1.5 h-7 text-[10px] font-bold rounded bg-[#22D1C3]/20 border border-[#22D1C3]/40 text-[#22D1C3]">MAX</button>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              <div className="px-4 pb-2 text-[11px] text-white/70 flex items-center justify-between">
                <span>Total: <b className="text-white">{totalCount}</b> Truppen · <b className="text-[#22D1C3]">{totalAtk.toLocaleString()}</b> Angriff</span>
                {mode === "rally" && hasCrew && <span className="text-white/40">+ Crew kann beitreten</span>}
              </div>

              {err && <div className="px-4 pb-2 text-[10px] text-[#FF2D78] font-bold">Fehler: {err}</div>}

              <Footer
                onClose={onClose}
                onConfirm={send}
                confirmDisabled={busy || totalAtk === 0 || overCap || queueFull}
                confirmLabel={busy ? "..."
                  : queueFull ? "⛔ Slots belegt"
                  : overCap ? `⚠ Cap (${totalCount}/${cap})`
                  : mode === "rally" ? "Aufgebot starten" : "Angreifen"}
                confirmColor={mode === "rally" ? "#FF2D78" : "#22D1C3"}
              />
            </>
          );
        })()}
      </Card>
    </Backdrop>
  );
}

/* ─────────────────────────────────────────────────────────
   Shared building blocks
   ───────────────────────────────────────────────────────── */
function Backdrop({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [onClose]);
  return (
    <div
      onClick={onClose}
      className="fixed inset-0 flex items-center justify-center p-4"
      style={{ zIndex: 9100, background: "rgba(8,12,24,0.85)", backdropFilter: "blur(12px)" }}
    >
      <div onClick={(e) => e.stopPropagation()} className="w-full max-w-[460px]">
        {children}
      </div>
    </div>
  );
}
function Card({ children, wide = false }: { children: React.ReactNode; wide?: boolean }) {
  return (
    <div className={`${wide ? "max-w-[560px]" : ""} bg-gradient-to-br from-[#1A1D23] to-[#0F1115] border border-white/15 rounded-2xl shadow-2xl overflow-hidden`}>
      {children}
    </div>
  );
}
function Header({ title, subtitle, onClose }: { title: string; subtitle?: string; onClose: () => void }) {
  return (
    <div className="px-4 pt-4 pb-3 flex items-start justify-between border-b border-white/10">
      <div className="min-w-0">
        <div className="text-[15px] font-black text-white truncate">{title}</div>
        {subtitle && <div className="text-[10px] text-white/55 mt-0.5 truncate">{subtitle}</div>}
      </div>
      <button onClick={onClose} className="w-7 h-7 rounded-full bg-white/5 hover:bg-white/10 text-white/70 text-base">×</button>
    </div>
  );
}
function Footer({ onClose, onConfirm, confirmDisabled, confirmLabel, confirmColor = "#22D1C3" }: {
  onClose: () => void;
  onConfirm: () => void;
  confirmDisabled?: boolean;
  confirmLabel: string;
  confirmColor?: string;
}) {
  return (
    <div className="px-4 py-3 border-t border-white/10 flex gap-2">
      <button onClick={onClose} className="flex-1 py-2 rounded-lg bg-white/5 text-white/70 text-[12px] font-bold">Abbrechen</button>
      <button
        onClick={onConfirm}
        disabled={confirmDisabled}
        className="flex-1 py-2 rounded-lg text-[12px] font-black text-[#0F1115] disabled:opacity-40"
        style={{ background: confirmColor }}
      >{confirmLabel}</button>
    </div>
  );
}
function ModeButton({ active, onClick, icon, label, disabled }: { active: boolean; onClick: () => void; icon: string; label: string; disabled?: boolean }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`flex-1 py-2 rounded-lg flex flex-col items-center gap-0.5 transition ${
        active ? "bg-[#22D1C3]/20 border border-[#22D1C3]" : "bg-white/5 border border-white/10"
      } disabled:opacity-40`}
    >
      <span className="text-base">{icon}</span>
      <span className="text-[10px] font-bold text-white">{label}</span>
    </button>
  );
}
