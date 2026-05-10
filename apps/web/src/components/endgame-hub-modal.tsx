"use client";

import { useCallback, useEffect, useState } from "react";

const MODAL_BG = "linear-gradient(180deg, #1a0e1a 0%, #0F1115 100%)";
const TEAL = "#22D1C3";
const GOLD = "#FFD700";
const ACCENT = "#FF2D78";
const PURPLE = "#a855f7";

type Tab = "expedition" | "raid" | "pets" | "frames" | "titles";

const TABS: Array<{ id: Tab; label: string; icon: string; color: string }> = [
  { id: "expedition", label: "Expedition", icon: "🗺", color: TEAL },
  { id: "raid",       label: "Boss-Raid",  icon: "👹", color: ACCENT },
  { id: "pets",       label: "Begleiter",  icon: "🐾", color: PURPLE },
  { id: "frames",     label: "Rahmen",     icon: "🖼", color: GOLD },
  { id: "titles",     label: "Titel",      icon: "🏷",  color: "#FF6B4A" },
];

export function EndgameHubModal({ initialTab = "expedition", onClose }: {
  initialTab?: Tab; onClose: () => void;
}) {
  const [tab, setTab] = useState<Tab>(initialTab);
  return (
    <div onClick={onClose} className="fixed inset-0 z-[9400] bg-black/85 backdrop-blur-md flex items-end sm:items-center justify-center p-2 sm:p-4">
      <div onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-3xl rounded-t-3xl sm:rounded-3xl overflow-hidden shadow-2xl flex flex-col max-h-[96vh]"
        style={{ background: MODAL_BG }}>
        <button onClick={onClose} aria-label="Schließen"
          className="absolute top-3 right-3 z-20 w-9 h-9 rounded-full bg-black/50 text-white text-lg font-black backdrop-blur">×</button>

        <div className="px-4 py-3 border-b border-white/10">
          <h2 className="text-lg font-black text-white tracking-wide">⚡ ENDGAME</h2>
          <div className="text-[10px] text-white/60">Solo-Expedition · Boss-Raids · Begleiter · Cosmetics</div>
        </div>

        {/* Tab-Bar */}
        <div className="flex overflow-x-auto border-b border-white/10 bg-black/30">
          {TABS.map((t) => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={`flex-shrink-0 px-3 py-2.5 text-[11px] font-black tracking-wide whitespace-nowrap transition ${tab === t.id ? "text-white" : "text-white/50 hover:text-white"}`}
              style={tab === t.id ? { borderBottom: `2px solid ${t.color}`, marginBottom: "-1px", background: `${t.color}11` } : undefined}>
              {t.icon} {t.label}
            </button>
          ))}
        </div>

        <div className="overflow-y-auto flex-1 p-4 ma365-no-scrollbar" style={{ scrollbarWidth: "none" }}>
          <style>{`.ma365-no-scrollbar::-webkit-scrollbar{display:none}`}</style>
          {tab === "expedition" && <ExpeditionPanel />}
          {tab === "raid"       && <RaidPanel />}
          {tab === "pets"       && <PetsPanel />}
          {tab === "frames"     && <FramesPanel />}
          {tab === "titles"     && <TitlesPanel />}
        </div>
      </div>
    </div>
  );
}

// ───────────────────────── EXPEDITION ─────────────────────────────
function ExpeditionPanel() {
  type Stage = { stage_idx: number; name: string; difficulty: number; required_power: number; star_thresholds: number[]; rewards_1s: Record<string, number>; rewards_2s: Record<string, number>; rewards_3s: Record<string, number> };
  type Progress = { stage_idx: number; best_stars: number; completed_at: string };
  const [data, setData] = useState<{ stages: Stage[]; progress: Progress[] } | null>(null);
  const [busy, setBusy] = useState<number | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const load = useCallback(async () => {
    const r = await fetch("/api/expedition", { cache: "no-store" });
    const j = await r.json() as { ok: boolean; stages: Stage[]; progress: Progress[] };
    if (j.ok) setData({ stages: j.stages, progress: j.progress });
  }, []);
  useEffect(() => { void load(); }, [load]);

  async function run(idx: number) {
    setBusy(idx); setMsg(null);
    try {
      const r = await fetch("/api/expedition", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ stage_idx: idx }),
      });
      const j = await r.json() as { ok?: boolean; error?: string; stars?: number; rewards?: Record<string, number> };
      if (j.ok) {
        const txt = j.rewards ? Object.entries(j.rewards).map(([k, v]) => `${k} +${v}`).join(", ") : "";
        setMsg(`✓ ${j.stars}★ — ${txt}`);
        await load();
      } else if (j.error === "stage_locked") setMsg("🔒 Schließe vorherige Stufe ab.");
      else if (j.error === "power_too_low") setMsg("⚠ Power zu niedrig.");
      else setMsg(`⚠ ${j.error ?? "Fehler"}`);
    } finally { setBusy(null); }
  }

  if (!data) return <div className="text-[11px] text-white/60 text-center py-8">Lade…</div>;
  const progressMap = new Map(data.progress.map((p) => [p.stage_idx, p]));

  return (
    <div className="space-y-2">
      <div className="rounded-lg p-2 text-[10px] text-white/70 leading-snug" style={{ background: `${TEAL}11`, border: `1px solid ${TEAL}55` }}>
        🗺 <b style={{ color: TEAL }}>30 Stages PvE-Solo</b> · 3-Sterne-System (mehr Power = mehr Sterne) · Belohnung: Sculpts, Speedups, Resourcen
      </div>
      {data.stages.map((s) => {
        const prog = progressMap.get(s.stage_idx);
        const stars = prog?.best_stars ?? 0;
        const locked = s.stage_idx > 1 && !progressMap.has(s.stage_idx - 1);
        return (
          <div key={s.stage_idx} className="rounded-lg p-3 flex items-center gap-3"
            style={{ background: locked ? "rgba(255,255,255,0.02)" : "rgba(255,255,255,0.05)", border: `1px solid ${locked ? "rgba(255,255,255,0.05)" : "rgba(34,209,195,0.25)"}` }}>
            <div className="text-[11px] font-black text-white w-8 text-center">#{s.stage_idx}</div>
            <div className="flex-1 min-w-0">
              <div className="text-[12px] font-black text-white truncate">{s.name}</div>
              <div className="text-[9px] text-white/60">Power-Anf. {s.required_power.toLocaleString("de-DE")} · D{s.difficulty}</div>
              <div className="flex gap-0.5 mt-1">
                {[1, 2, 3].map((i) => <span key={i} style={{ fontSize: 11, color: i <= stars ? GOLD : "rgba(255,255,255,0.18)" }}>★</span>)}
              </div>
            </div>
            <button onClick={() => void run(s.stage_idx)} disabled={busy === s.stage_idx || locked}
              className="px-3 py-1.5 rounded font-black text-[10px] disabled:opacity-40"
              style={{ background: locked ? "rgba(255,255,255,0.05)" : TEAL, color: locked ? "#666" : "#0F1115" }}>
              {busy === s.stage_idx ? "…" : locked ? "🔒" : "STARTEN"}
            </button>
          </div>
        );
      })}
      {msg && <div className="text-[11px] font-black text-center mt-2" style={{ color: msg.startsWith("✓") ? "#4ade80" : ACCENT }}>{msg}</div>}
    </div>
  );
}

// ───────────────────────── RAID ─────────────────────────────
function RaidPanel() {
  type Boss = { id: string; name: string; max_hp: number; current_hp: number; ends_at: string; my_damage: number; my_rank: number | null; total_damage: number; participants: number };
  const [list, setList] = useState<Boss[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const load = useCallback(async () => {
    const r = await fetch("/api/raid", { cache: "no-store" });
    const j = await r.json() as { ok?: boolean; bosses?: Boss[] };
    setList(j.bosses ?? []);
  }, []);
  useEffect(() => { void load(); const id = setInterval(load, 30_000); return () => clearInterval(id); }, [load]);

  async function attack(raidId: string) {
    setBusy(raidId); setMsg(null);
    try {
      const r = await fetch("/api/raid", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ raid_id: raidId }),
      });
      const j = await r.json() as { ok?: boolean; error?: string; damage?: number; killed?: boolean };
      if (j.ok) {
        setMsg(j.killed ? `💥 BOSS ZERSTÖRT! ${j.damage} Schaden` : `⚔ ${j.damage} Schaden`);
        await load();
      } else if (j.error === "rate_limited") setMsg("⏳ Cooldown.");
      else if (j.error === "raid_ended") setMsg("⏰ Raid vorbei.");
      else setMsg(`⚠ ${j.error ?? "Fehler"}`);
    } finally { setBusy(null); }
  }

  if (!list) return <div className="text-[11px] text-white/60 text-center py-8">Lade…</div>;

  return (
    <div className="space-y-3">
      <div className="rounded-lg p-2 text-[10px] text-white/70 leading-snug" style={{ background: `${ACCENT}11`, border: `1px solid ${ACCENT}55` }}>
        👹 <b style={{ color: ACCENT }}>Crew-Boss-Raids</b> · gemeinsam mit deiner Crew einen Boss zerlegen · Damage-Ranking entscheidet die Belohnung
      </div>
      {list.length === 0 ? (
        <div className="text-[11px] text-white/60 text-center py-8 rounded-lg bg-black/30 border border-white/5">
          Keine aktiven Raids — der nächste Boss spawnt am Wochenende 🐉
        </div>
      ) : list.map((b) => {
        const hpPct = (b.current_hp / Math.max(1, b.max_hp)) * 100;
        const remain = Math.max(0, Math.ceil((new Date(b.ends_at).getTime() - Date.now()) / 60000));
        return (
          <div key={b.id} className="rounded-xl overflow-hidden border" style={{ borderColor: `${ACCENT}55`, background: `linear-gradient(135deg, ${ACCENT}11, transparent)` }}>
            <div className="px-3 pt-3 pb-2">
              <div className="flex justify-between items-center mb-1">
                <span className="text-[14px] font-black text-white">{b.name}</span>
                <span className="text-[10px] text-white/60">⏰ {Math.floor(remain / 60)}h {remain % 60}m</span>
              </div>
              <div className="h-3 rounded-full bg-black/50 overflow-hidden mb-1">
                <div className="h-full transition-all" style={{ width: `${hpPct}%`, background: hpPct > 60 ? "#4ade80" : hpPct > 30 ? GOLD : ACCENT }} />
              </div>
              <div className="text-[9px] text-white/60 text-center">{b.current_hp.toLocaleString("de-DE")} / {b.max_hp.toLocaleString("de-DE")} HP · {b.participants} Mitglieder</div>
            </div>
            <div className="px-3 py-2 border-t border-white/5 bg-black/30 flex items-center gap-2">
              <div className="flex-1 text-[10px]">
                <div className="text-white/60">Dein Schaden: <b className="text-white">{b.my_damage.toLocaleString("de-DE")}</b></div>
                <div className="text-white/60">Rang: <b style={{ color: b.my_rank === 1 ? GOLD : "#FFF" }}>{b.my_rank ? `#${b.my_rank}` : "—"}</b> / {b.participants}</div>
              </div>
              <button onClick={() => void attack(b.id)} disabled={busy === b.id || hpPct <= 0}
                className="px-4 py-2 rounded font-black text-[11px] disabled:opacity-40"
                style={{ background: ACCENT, color: "#FFF" }}>
                {busy === b.id ? "…" : hpPct <= 0 ? "TOT" : "ANGREIFEN"}
              </button>
            </div>
          </div>
        );
      })}
      {msg && <div className="text-[11px] font-black text-center" style={{ color: msg.includes("💥") || msg.includes("✓") ? "#4ade80" : msg.startsWith("⚔") ? GOLD : ACCENT }}>{msg}</div>}
    </div>
  );
}

// ───────────────────────── PETS ─────────────────────────────
function PetsPanel() {
  type Pet = { id: string; archetype_id: string; archetype_name: string; archetype_emoji: string; level: number; xp: number; xp_to_next: number; bonus: Record<string, number>; active: boolean };
  type Archetype = { id: string; name: string; emoji: string; description: string; bonus_per_level: Record<string, number> };
  const [data, setData] = useState<{ pets: Pet[]; archetypes: Archetype[] } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const load = useCallback(async () => {
    const r = await fetch("/api/pets", { cache: "no-store" });
    const j = await r.json() as { ok: boolean; pets: Pet[]; archetypes: Archetype[] };
    if (j.ok) setData({ pets: j.pets, archetypes: j.archetypes });
  }, []);
  useEffect(() => { void load(); }, [load]);

  async function action(petId: string, what: "feed" | "activate") {
    setBusy(petId + what); setMsg(null);
    try {
      const r = await fetch("/api/pets", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: what, pet_id: petId, food: what === "feed" ? 1 : undefined }),
      });
      const j = await r.json() as { ok?: boolean; error?: string };
      if (j.ok) { setMsg(what === "feed" ? "✓ Gefüttert (+XP)" : "✓ Aktiv gesetzt"); await load(); }
      else if (j.error === "not_enough_food") setMsg("⚠ Kein Futter — kaufe im Shop.");
      else setMsg(`⚠ ${j.error ?? "Fehler"}`);
    } finally { setBusy(null); }
  }

  if (!data) return <div className="text-[11px] text-white/60 text-center py-8">Lade…</div>;

  return (
    <div className="space-y-3">
      <div className="rounded-lg p-2 text-[10px] text-white/70 leading-snug" style={{ background: `${PURPLE}11`, border: `1px solid ${PURPLE}55` }}>
        🐾 <b style={{ color: PURPLE }}>Begleiter</b> · 4 Archetypen (Drohne/Mech/Falke/Titan) · jeder Level gibt passive Boni · genau einer kann aktiv sein
      </div>
      {data.pets.length === 0 ? (
        <div className="text-[11px] text-white/60 text-center py-6 rounded-lg bg-black/30 border border-white/5">
          Noch keine Begleiter — finde sie über Truhen oder Events.
        </div>
      ) : data.pets.map((p) => {
        const xpPct = Math.min(100, (p.xp / Math.max(1, p.xp_to_next)) * 100);
        return (
          <div key={p.id} className="rounded-lg p-3 flex items-center gap-3"
            style={{ background: p.active ? `${PURPLE}18` : "rgba(255,255,255,0.04)", border: `1px solid ${p.active ? PURPLE : "rgba(255,255,255,0.08)"}` }}>
            <div className="text-3xl">{p.archetype_emoji}</div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-[12px] font-black text-white truncate">{p.archetype_name}</span>
                {p.active && <span className="text-[9px] font-black px-1.5 py-0.5 rounded" style={{ background: PURPLE, color: "#FFF" }}>AKTIV</span>}
              </div>
              <div className="text-[9px] text-white/60">Lv {p.level} · {Object.entries(p.bonus).map(([k, v]) => `${k} +${v}%`).join(" · ")}</div>
              <div className="mt-1 h-1.5 rounded-full bg-black/40 overflow-hidden">
                <div className="h-full" style={{ width: `${xpPct}%`, background: PURPLE }} />
              </div>
              <div className="text-[8px] text-white/50 mt-0.5">{p.xp}/{p.xp_to_next} XP</div>
            </div>
            <div className="flex flex-col gap-1">
              <button onClick={() => void action(p.id, "feed")} disabled={busy === p.id + "feed"}
                className="px-2 py-1 rounded font-black text-[9px] disabled:opacity-40"
                style={{ background: TEAL, color: "#0F1115" }}>FÜTTERN</button>
              {!p.active && (
                <button onClick={() => void action(p.id, "activate")} disabled={busy === p.id + "activate"}
                  className="px-2 py-1 rounded font-black text-[9px] disabled:opacity-40"
                  style={{ background: PURPLE, color: "#FFF" }}>AKTIV</button>
              )}
            </div>
          </div>
        );
      })}
      <div>
        <div className="text-[10px] font-black tracking-widest text-white/60 mt-3 mb-2">VERFÜGBARE ARCHETYPEN</div>
        <div className="grid grid-cols-2 gap-2">
          {data.archetypes.map((a) => (
            <div key={a.id} className="rounded-lg p-2 bg-black/30 border border-white/10 text-[10px]">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-lg">{a.emoji}</span>
                <span className="font-black text-white">{a.name}</span>
              </div>
              <div className="text-white/60 leading-snug">{a.description}</div>
            </div>
          ))}
        </div>
      </div>
      {msg && <div className="text-[11px] font-black text-center" style={{ color: msg.startsWith("✓") ? "#4ade80" : ACCENT }}>{msg}</div>}
    </div>
  );
}

// ───────────────────────── FRAMES ─────────────────────────────
function FramesPanel() {
  type Frame = { id: string; name: string; image_url: string | null; rarity: string; price_gems: number; description: string | null };
  type Owned = { frame_id: string; equipped: boolean };
  const [data, setData] = useState<{ frames: Frame[]; owned: Owned[] } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const load = useCallback(async () => {
    const r = await fetch("/api/cosmetics/frames", { cache: "no-store" });
    const j = await r.json() as { ok?: boolean; frames: Frame[]; owned: Owned[] };
    if (j.ok) setData({ frames: j.frames, owned: j.owned });
  }, []);
  useEffect(() => { void load(); }, [load]);

  async function act(frameId: string, what: "buy" | "equip") {
    setBusy(frameId); setMsg(null);
    try {
      const r = await fetch("/api/cosmetics/frames", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: what, frame_id: frameId }),
      });
      const j = await r.json() as { ok?: boolean; error?: string };
      if (j.ok) { setMsg(what === "buy" ? "✓ Gekauft" : "✓ Ausgerüstet"); await load(); }
      else if (j.error === "not_enough_gems") setMsg("💎 Nicht genug Diamanten.");
      else if (j.error === "already_owned") setMsg("ℹ Schon im Besitz.");
      else setMsg(`⚠ ${j.error ?? "Fehler"}`);
    } finally { setBusy(null); }
  }

  if (!data) return <div className="text-[11px] text-white/60 text-center py-8">Lade…</div>;
  const ownedMap = new Map(data.owned.map((o) => [o.frame_id, o.equipped]));

  return (
    <div className="space-y-2">
      <div className="rounded-lg p-2 text-[10px] text-white/70 leading-snug" style={{ background: `${GOLD}11`, border: `1px solid ${GOLD}55` }}>
        🖼 <b style={{ color: GOLD }}>Avatar-Rahmen</b> · zeigen deinen Status & Stil — rein kosmetisch, niemals Pay-to-Win
      </div>
      <div className="grid grid-cols-2 gap-2">
        {data.frames.map((f) => {
          const owned = ownedMap.has(f.id);
          const equipped = ownedMap.get(f.id) === true;
          return (
            <div key={f.id} className="rounded-lg p-2 flex flex-col items-center gap-1"
              style={{ background: equipped ? `${GOLD}18` : "rgba(255,255,255,0.04)", border: `1px solid ${equipped ? GOLD : "rgba(255,255,255,0.08)"}` }}>
              <div className="w-16 h-16 rounded bg-black/40 flex items-center justify-center text-2xl">
                {f.image_url ? <img src={f.image_url} alt={f.name} className="w-full h-full object-contain" /> : "🖼"}
              </div>
              <div className="text-[10px] font-black text-white text-center truncate w-full">{f.name}</div>
              <div className="text-[9px] text-white/50">{f.rarity}</div>
              {!owned ? (
                <button onClick={() => void act(f.id, "buy")} disabled={busy === f.id}
                  className="mt-1 w-full px-2 py-1 rounded font-black text-[9px] disabled:opacity-40"
                  style={{ background: GOLD, color: "#1a0e00" }}>
                  💎 {f.price_gems}
                </button>
              ) : equipped ? (
                <span className="mt-1 text-[9px] font-black" style={{ color: GOLD }}>✓ AKTIV</span>
              ) : (
                <button onClick={() => void act(f.id, "equip")} disabled={busy === f.id}
                  className="mt-1 w-full px-2 py-1 rounded font-black text-[9px] disabled:opacity-40"
                  style={{ background: TEAL, color: "#0F1115" }}>ANLEGEN</button>
              )}
            </div>
          );
        })}
      </div>
      {msg && <div className="text-[11px] font-black text-center" style={{ color: msg.startsWith("✓") ? "#4ade80" : ACCENT }}>{msg}</div>}
    </div>
  );
}

// ───────────────────────── TITLES ─────────────────────────────
function TitlesPanel() {
  type Title = { id: string; name: string; rarity: string; price_gems: number; color: string | null; description: string | null };
  type Owned = { title_id: string; equipped: boolean };
  const [data, setData] = useState<{ titles: Title[]; owned: Owned[] } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const load = useCallback(async () => {
    const r = await fetch("/api/cosmetics/titles", { cache: "no-store" });
    const j = await r.json() as { ok?: boolean; titles: Title[]; owned: Owned[] };
    if (j.ok) setData({ titles: j.titles, owned: j.owned });
  }, []);
  useEffect(() => { void load(); }, [load]);

  async function act(titleId: string, what: "buy" | "equip") {
    setBusy(titleId); setMsg(null);
    try {
      const r = await fetch("/api/cosmetics/titles", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: what, title_id: titleId }),
      });
      const j = await r.json() as { ok?: boolean; error?: string };
      if (j.ok) { setMsg(what === "buy" ? "✓ Gekauft" : "✓ Ausgerüstet"); await load(); }
      else if (j.error === "not_enough_gems") setMsg("💎 Nicht genug Diamanten.");
      else setMsg(`⚠ ${j.error ?? "Fehler"}`);
    } finally { setBusy(null); }
  }

  if (!data) return <div className="text-[11px] text-white/60 text-center py-8">Lade…</div>;
  const ownedMap = new Map(data.owned.map((o) => [o.title_id, o.equipped]));

  return (
    <div className="space-y-2">
      <div className="rounded-lg p-2 text-[10px] text-white/70 leading-snug" style={{ background: `#FF6B4A11`, border: `1px solid #FF6B4A55` }}>
        🏷 <b style={{ color: "#FF6B4A" }}>Titel</b> · erscheinen unter deinem Namen — verleih dir einen besonderen Rang
      </div>
      {data.titles.map((tt) => {
        const owned = ownedMap.has(tt.id);
        const equipped = ownedMap.get(tt.id) === true;
        const color = tt.color || "#FFF";
        return (
          <div key={tt.id} className="rounded-lg p-2 flex items-center gap-3"
            style={{ background: equipped ? `${color}18` : "rgba(255,255,255,0.04)", border: `1px solid ${equipped ? color : "rgba(255,255,255,0.08)"}` }}>
            <div className="flex-1 min-w-0">
              <div className="text-[12px] font-black truncate" style={{ color }}>« {tt.name} »</div>
              <div className="text-[9px] text-white/60 truncate">{tt.description ?? tt.rarity}</div>
            </div>
            {!owned ? (
              <button onClick={() => void act(tt.id, "buy")} disabled={busy === tt.id}
                className="px-3 py-1.5 rounded font-black text-[10px] disabled:opacity-40"
                style={{ background: GOLD, color: "#1a0e00" }}>
                💎 {tt.price_gems}
              </button>
            ) : equipped ? (
              <span className="text-[9px] font-black" style={{ color }}>✓ AKTIV</span>
            ) : (
              <button onClick={() => void act(tt.id, "equip")} disabled={busy === tt.id}
                className="px-3 py-1.5 rounded font-black text-[10px] disabled:opacity-40"
                style={{ background: TEAL, color: "#0F1115" }}>ANLEGEN</button>
            )}
          </div>
        );
      })}
      {msg && <div className="text-[11px] font-black text-center" style={{ color: msg.startsWith("✓") ? "#4ade80" : ACCENT }}>{msg}</div>}
    </div>
  );
}
