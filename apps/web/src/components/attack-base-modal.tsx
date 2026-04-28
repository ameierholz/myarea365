"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { UiIcon, useUiIconArt, useBaseThemeArt, type ResourceArtMap } from "@/components/resource-icon";

type Troop = {
  id: string;
  name: string;
  emoji: string;
  troop_class: string;
  tier: number;
  base_atk: number;
  base_def: number;
  base_hp: number;
};

type DefenderInfo = {
  user_id: string;
  display_name: string;
  avatar_url: string | null;
  base_level: number;
  pin_label: string;
  current_hp: number;
  max_hp: number;
  shield_until: string | null;
  user_level: number;
  theme_id: string | null;
  theme_accent: string | null;
  crew_name: string | null;
};

type Intel = {
  cost: number;
  troops_total: number;
  atk_power: number;
  def_power: number;
  base_level: number;
  current_hp: number;
  max_hp: number;
  resources: { wood: number; stone: number; gold: number; mana: number };
  troop_breakdown: Record<string, number>;
  active_guardian: { archetype_id: string; name: string; emoji: string; rarity: string; level: number } | null;
};

const CLASS_LABEL: Record<string, string> = {
  infantry: "Türsteher",
  cavalry: "Kuriere",
  marksman: "Schleuderer",
  siege: "Brecher",
};

export function AttackBaseModal({
  defenderUserId,
  onClose,
}: {
  defenderUserId: string;
  onClose: () => void;
}) {
  const [troops, setTroops] = useState<Troop[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [selected, setSelected] = useState<Record<string, number>>({});
  const [defender, setDefender] = useState<DefenderInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [spying, setSpying] = useState(false);
  const [, setIntel] = useState<Intel | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [mode, setMode] = useState<"info" | "attack" | "rally">("info");
  const [prepSeconds, setPrepSeconds] = useState<number>(180);

  // Wächter (für Crew-Aufgebot)
  type RGuardian = { id: string; level: number; name: string; image_url: string | null; video_url: string | null };
  const [guardians, setGuardians] = useState<RGuardian[]>([]);
  const [selectedGuardianId, setSelectedGuardianId] = useState<string | null>(null);
  const baseThemeArt = useBaseThemeArt();

  const load = useCallback(async () => {
    setLoading(true);
    const sb = createClient();
    const { data: { user } } = await sb.auth.getUser();
    if (!user) return;

    const [troopsApi, defBase, defUser, gRows] = await Promise.all([
      fetch("/api/base/troops", { cache: "no-store" }).then((r) => r.ok ? r.json() : { catalog: [], owned: [] }),
      sb.from("bases").select("level, pin_label, current_hp, max_hp, shield_until, theme_id").eq("owner_user_id", defenderUserId).maybeSingle(),
      sb.from("users").select("display_name, level, avatar_url").eq("id", defenderUserId).maybeSingle(),
      sb.from("user_guardians").select("id, level, archetype:guardian_archetypes(id,name,image_url,video_url)").eq("user_id", user.id).eq("is_active", true).limit(20),
    ]);
    type GRow = { id: string; level: number; archetype: { id: string; name: string; image_url: string | null; video_url: string | null } | null };
    setGuardians(((gRows.data ?? []) as unknown as GRow[]).map((r) => ({
      id: r.id, level: r.level,
      name: r.archetype?.name ?? "Wächter",
      image_url: r.archetype?.image_url ?? null,
      video_url: r.archetype?.video_url ?? null,
    })));
    const catalog = { data: troopsApi.catalog as Troop[] };
    const mine = { data: troopsApi.owned as Array<{ troop_id: string; count: number }> };

    let themeAccent: string | null = null;
    const themeId = (defBase.data as { theme_id?: string | null } | null)?.theme_id ?? null;
    if (themeId) {
      const { data: th } = await sb.from("base_themes").select("accent_color").eq("id", themeId).maybeSingle();
      themeAccent = (th as { accent_color?: string } | null)?.accent_color ?? null;
    }

    let crewName: string | null = null;
    const { data: cm } = await sb
      .from("crew_members")
      .select("crews(name)")
      .eq("user_id", defenderUserId)
      .maybeSingle();
    if (cm) {
      const c = (cm as { crews?: { name?: string } | { name?: string }[] | null }).crews;
      crewName = (Array.isArray(c) ? c[0]?.name : c?.name) ?? null;
    }

    setTroops((catalog.data ?? []) as Troop[]);
    const cnt: Record<string, number> = {};
    (mine.data ?? []).forEach((row: { troop_id: string; count: number }) => { cnt[row.troop_id] = row.count; });
    setCounts(cnt);

    if (defBase.data) {
      setDefender({
        user_id: defenderUserId,
        display_name: (defUser.data as { display_name?: string } | null)?.display_name ?? "Gegner",
        avatar_url: (defUser.data as { avatar_url?: string | null } | null)?.avatar_url ?? null,
        user_level: ((defUser.data as { level?: number } | null)?.level) ?? 1,
        base_level: defBase.data.level as number,
        pin_label: defBase.data.pin_label as string,
        current_hp: defBase.data.current_hp as number,
        max_hp: defBase.data.max_hp as number,
        shield_until: defBase.data.shield_until as string | null,
        theme_id: themeId,
        theme_accent: themeAccent,
        crew_name: crewName,
      });
    }
    setLoading(false);
  }, [defenderUserId]);

  useEffect(() => { void load(); }, [load]);

  const totalAtk = useMemo(() => {
    let s = 0;
    for (const t of troops) s += (selected[t.id] ?? 0) * t.base_atk;
    return s;
  }, [selected, troops]);

  const totalCount = useMemo(() => Object.values(selected).reduce((a, b) => a + b, 0), [selected]);

  const grouped = useMemo(() => {
    const g: Record<string, Troop[]> = {};
    for (const t of troops) {
      if ((counts[t.id] ?? 0) <= 0) continue;
      (g[t.troop_class] ??= []).push(t);
    }
    return g;
  }, [troops, counts]);

  function setQty(id: string, n: number) {
    const max = counts[id] ?? 0;
    const v = Math.max(0, Math.min(max, Math.floor(n) || 0));
    setSelected((s) => ({ ...s, [id]: v }));
  }

  function fillMax() {
    const all: Record<string, number> = {};
    for (const t of troops) all[t.id] = counts[t.id] ?? 0;
    setSelected(all);
  }

  function clearAll() { setSelected({}); }

  async function spy() {
    setSpying(true); setMsg(null);
    try {
      const r = await fetch("/api/base/spy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ defender_user_id: defenderUserId }),
      });
      const j = await r.json() as Intel & { ok?: boolean; error?: string; need?: number };
      if (j.ok) {
        setIntel(j);
        setMsg("✓ Späher zurück — Bericht im Postfach.");
        setTimeout(onClose, 1500);
      } else if (j.error === "not_enough_gold") setMsg(`Nicht genug Gold (${j.need} 🪙 nötig).`);
      else setMsg(j.error ?? "Spionage fehlgeschlagen");
    } finally { setSpying(false); }
  }

  async function startRally() {
    if (totalCount < 10) { setMsg("Mindestens 10 Truppen nötig."); return; }
    setBusy(true); setMsg(null);
    try {
      const r = await fetch("/api/base/rally", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ defender_user_id: defenderUserId, troops: selected, prep_seconds: prepSeconds, guardian_id: selectedGuardianId }),
      });
      const j = await r.json() as { ok?: boolean; error?: string; rally_id?: string };
      if (j.ok) {
        setMsg("✓ Aufgebot gestartet — Crew kann beitreten.");
        setTimeout(onClose, 1500);
      } else if (j.error === "no_crew") setMsg("Du bist in keiner Crew.");
      else if (j.error === "crew_rally_already_active") setMsg("Deine Crew hat bereits ein laufendes Aufgebot.");
      else if (j.error === "defender_shielded") setMsg("🛡️ Gegner ist geschützt.");
      else setMsg(j.error ?? "Aufgebot fehlgeschlagen");
    } finally { setBusy(false); }
  }

  async function launch() {
    if (totalCount < 10) { setMsg("Mindestens 10 Truppen nötig."); return; }
    setBusy(true); setMsg(null);
    try {
      const r = await fetch("/api/base/attack", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ defender_user_id: defenderUserId, troops: selected }),
      });
      const j = await r.json() as { ok?: boolean; error?: string; march_seconds?: number; distance_m?: number };
      if (j.ok) {
        const min = Math.floor((j.march_seconds ?? 0) / 60);
        const sec = (j.march_seconds ?? 0) % 60;
        setMsg(`✓ Marsch gestartet — ETA ${min}:${String(sec).padStart(2, "0")} (${j.distance_m} m). Bericht erscheint danach in der Inbox.`);
        setTimeout(onClose, 1500);
      } else if (j.error === "defender_shielded") setMsg("🛡️ Gegner ist geschützt.");
      else if (j.error === "march_already_active") setMsg("Du hast bereits einen laufenden Angriff.");
      else if (j.error === "min_troops_10") setMsg("Mindestens 10 Truppen nötig.");
      else if (j.error === "no_base") setMsg("Du hast keine Base.");
      else setMsg(j.error ?? "Fehler");
    } finally { setBusy(false); }
  }

  if (loading) return null;

  return (
    <div onClick={onClose} className="fixed inset-0 z-[9000] bg-black/85 backdrop-blur-md flex items-center justify-center p-3">
      <div onClick={(e) => e.stopPropagation()}
        className="w-full max-w-sm rounded-2xl overflow-hidden shadow-2xl flex flex-col max-h-[80vh]"
        style={{ background: "linear-gradient(180deg, #1A1D23 0%, #0F1115 100%)" }}>

        {mode === "info" ? (
          <InfoCard
            defender={defender}
            spying={spying}
            msg={msg}
            onClose={onClose}
            onSpy={spy}
            onRally={() => { setMode("rally"); setMsg(null); }}
            onAttack={() => { setMode("attack"); setMsg(null); }}
          />
        ) : mode === "rally" ? (
          <RallyPicker
            defender={defender}
            counts={counts}
            selected={selected}
            grouped={grouped}
            totalAtk={totalAtk}
            totalCount={totalCount}
            busy={busy}
            msg={msg}
            prepSeconds={prepSeconds}
            setPrepSeconds={setPrepSeconds}
            onBack={() => { setMode("info"); setMsg(null); }}
            onClose={onClose}
            setQty={setQty}
            fillMax={fillMax}
            clearAll={clearAll}
            launch={startRally}
            guardians={guardians}
            selectedGuardianId={selectedGuardianId}
            setSelectedGuardianId={setSelectedGuardianId}
            baseThemeArt={baseThemeArt}
          />
        ) : (
          <AttackPicker
            defender={defender}
            counts={counts}
            selected={selected}
            grouped={grouped}
            totalAtk={totalAtk}
            totalCount={totalCount}
            busy={busy}
            msg={msg}
            onBack={() => { setMode("info"); setMsg(null); }}
            onClose={onClose}
            setQty={setQty}
            fillMax={fillMax}
            clearAll={clearAll}
            launch={launch}
          />
        )}

      </div>
    </div>
  );
}

// ─── Info-Card (CoD-Style) ──────────────────────────────────────────
function InfoCard({
  defender, spying, msg, onClose, onSpy, onRally, onAttack,
}: {
  defender: DefenderInfo | null;
  spying: boolean;
  msg: string | null;
  onClose: () => void;
  onSpy: () => void;
  onRally: () => void;
  onAttack: () => void;
}) {
  const uiIcon = useUiIconArt();
  if (!defender) return null;
  const accent = defender.theme_accent ?? "#FF2D78";
  const shielded = defender.shield_until && new Date(defender.shield_until) > new Date();

  return (
    <>
      <div className="relative shrink-0 overflow-hidden border-b border-white/5">
        <div className="absolute inset-0 pointer-events-none"
          style={{ background: `linear-gradient(135deg, ${accent}66 0%, ${accent}22 50%, #0F1115 100%)` }} />
        <div className="absolute inset-0 pointer-events-none opacity-40"
          style={{ background: "radial-gradient(circle at 50% 30%, rgba(255,255,255,0.18) 0%, transparent 55%)" }} />
        <button onClick={onClose}
          className="absolute top-2 right-2 w-8 h-8 rounded-full bg-black/55 text-white text-base font-black z-10 backdrop-blur">×</button>

        <div className="relative pt-6 pb-3 flex flex-col items-center gap-2">
          <div className="relative">
            <div className="w-24 h-24 rounded-2xl overflow-hidden flex items-center justify-center text-5xl shadow-2xl"
              style={{
                background: "linear-gradient(135deg, #2a2d35, #1A1D23)",
                border: `3px solid ${accent}`,
                boxShadow: `0 0 28px ${accent}88, inset 0 2px 0 rgba(255,255,255,0.1)`,
              }}>
              {defender.avatar_url
                // eslint-disable-next-line @next/next/no-img-element
                ? <img src={defender.avatar_url} alt="" className="w-full h-full object-cover" />
                : <span>👤</span>}
            </div>
            {shielded && (
              <div className="absolute -top-1 -right-1 w-7 h-7 rounded-full bg-[#5ddaf0] text-[#0F1115] text-sm font-black flex items-center justify-center shadow-lg">
                <UiIcon slot="action_shield" size={18} fallback="🛡️" art={uiIcon} />
              </div>
            )}
          </div>
          <div className="text-center px-3">
            <div className="text-[18px] font-black text-white leading-tight">
              {defender.crew_name && <span style={{ color: accent }}>[{defender.crew_name.slice(0, 4).toUpperCase()}]</span>}
              {defender.display_name}
            </div>
            <div className="text-[10px] text-white/55 mt-0.5">🏰 {defender.pin_label}</div>
          </div>
        </div>
      </div>

      <div className="px-4 py-3 shrink-0 space-y-2">
        {[
          { label: "Spieler-Stufe",  value: `Lv ${defender.user_level}` },
          { label: "Base-Stufe",     value: `Lv ${defender.base_level}` },
          { label: "Base-HP",        value: `${defender.current_hp.toLocaleString("de-DE")} / ${defender.max_hp.toLocaleString("de-DE")}` },
          { label: "Crew",           value: defender.crew_name ?? "—" },
          { label: "Stärke",         value: "???  (Späher senden)", muted: true },
        ].map((r) => (
          <div key={r.label} className="flex items-baseline justify-between text-[12px] border-b border-white/5 pb-1.5">
            <span className="text-white/55 font-black">{r.label}</span>
            <span className={`font-black tabular-nums ${r.muted ? "text-white/30" : "text-white"}`}>{r.value}</span>
          </div>
        ))}
      </div>

      <div className="border-t border-white/10 p-3 shrink-0 space-y-2"
        style={{ background: "linear-gradient(0deg, rgba(0,0,0,0.4), transparent)" }}>
        {msg && (
          <div className="text-[11px] text-center font-black py-1.5 px-2 rounded"
            style={{ color: msg.startsWith("✓") ? "#4ade80" : "#FF6B9A", background: msg.startsWith("✓") ? "rgba(74,222,128,0.1)" : "rgba(255,107,154,0.1)" }}>
            {msg}
          </div>
        )}
        <div className="flex gap-2">
          <ActionButton onClick={onSpy} disabled={spying} color="#5ddaf0" slot="action_spy"    fallback="🔍" art={uiIcon} label="SPÄHER"        sub="Spionage · 500 🪙" />
          <ActionButton onClick={onRally}                    color="#FF6B4A" slot="action_rally"  fallback="📣" art={uiIcon} label="CREW-ANGRIFF" sub="Aufgebot starten" />
          <ActionButton onClick={onAttack}                   color="#FF2D78" slot="action_attack" fallback="⚔️" art={uiIcon} label="ANGRIFF"       sub="Allein stürmen" />
        </div>
      </div>
    </>
  );
}

function ActionButton({ onClick, disabled, color, slot, fallback, art, label, sub }: {
  onClick?: () => void;
  disabled?: boolean;
  color: string;
  slot: string;
  fallback: string;
  art: ResourceArtMap;
  label: string;
  sub?: string;
}) {
  return (
    <button onClick={onClick} disabled={disabled}
      className="flex-1 rounded-xl py-2.5 px-2 text-white disabled:opacity-30 transition flex flex-col items-center gap-0.5"
      style={{
        background: `linear-gradient(135deg, ${color}, ${color}cc)`,
        boxShadow: `0 4px 14px ${color}55`,
      }}>
      <UiIcon slot={slot} size={28} fallback={fallback} art={art} />
      <span className="text-[10px] font-black tracking-[1px]">{label}</span>
      {sub && <span className="text-[8px] font-black text-white/70">{sub}</span>}
    </button>
  );
}

// ─── Rally-Picker (Schritt 2 alt: Crew-Angriff starten) ────────────
function RallyPicker({
  defender, counts, selected, grouped, totalAtk, totalCount, busy, msg,
  prepSeconds, setPrepSeconds,
  onBack, onClose, setQty, fillMax, clearAll, launch,
  guardians, selectedGuardianId, setSelectedGuardianId, baseThemeArt,
}: {
  defender: DefenderInfo | null;
  counts: Record<string, number>;
  selected: Record<string, number>;
  grouped: Record<string, Troop[]>;
  totalAtk: number;
  totalCount: number;
  busy: boolean;
  msg: string | null;
  prepSeconds: number;
  setPrepSeconds: (n: number) => void;
  onBack: () => void;
  onClose: () => void;
  setQty: (id: string, n: number) => void;
  fillMax: () => void;
  clearAll: () => void;
  launch: () => void;
  guardians: Array<{ id: string; level: number; name: string; image_url: string | null; video_url: string | null }>;
  selectedGuardianId: string | null;
  setSelectedGuardianId: (id: string | null) => void;
  baseThemeArt: ResourceArtMap;
}) {
  const prepOptions = [
    { value: 180,  label: "3 Min" },
    { value: 480,  label: "8 Min" },
    { value: 1680, label: "28 Min" },
  ];
  return (
    <>
      <div className="px-3 py-2 border-b border-white/10 flex items-center gap-2 shrink-0"
        style={{ background: "linear-gradient(135deg, rgba(255,107,74,0.18) 0%, rgba(255,215,0,0.10) 100%)" }}>
        <button onClick={onBack} className="w-8 h-8 rounded-full bg-black/40 text-white text-base font-black">‹</button>
        {/* Defender Base-Theme-Pin */}
        {(() => {
          const themeId = defender?.theme_id;
          if (!themeId) return null;
          const a = baseThemeArt[`${themeId}_runner_pin`] ?? baseThemeArt[`${themeId}_runner_banner`] ?? baseThemeArt[themeId];
          if (!a) return null;
          const f = "url(#ma365-chroma-black)";
          if (a.image_url) {
            // eslint-disable-next-line @next/next/no-img-element
            return <img src={a.image_url} alt="" className="w-9 h-9 object-contain shrink-0" style={{ filter: f }} />;
          }
          if (a.video_url) {
            return <video src={a.video_url} autoPlay loop muted playsInline className="w-9 h-9 object-contain shrink-0" style={{ filter: f }} />;
          }
          return null;
        })()}
        <div className="flex-1 min-w-0">
          <div className="text-[8px] font-black tracking-[2px] text-[#FF6B4A]/90">CREW-ANGRIFF</div>
          <div className="text-[13px] font-black text-white truncate">📣 Crew-Angriff gegen {defender?.display_name}</div>
        </div>
        <button onClick={onClose} className="w-8 h-8 rounded-full bg-black/40 text-white text-base font-black">×</button>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {/* Vorbereitungszeit */}
        <div>
          <div className="text-[10px] font-black tracking-[1.5px] text-white/50 mb-1.5 px-1">Vorbereitungszeit</div>
          <div className="flex gap-1.5">
            {prepOptions.map((o) => (
              <button key={o.value} onClick={() => setPrepSeconds(o.value)}
                className={`flex-1 py-2.5 rounded-lg text-[12px] font-black transition border-2 ${
                  prepSeconds === o.value
                    ? "bg-[#FFD700] border-[#FFD700] text-[#0F1115] shadow-[0_0_18px_rgba(255,215,0,0.5)]"
                    : "bg-black/40 border-white/15 text-white/80 hover:border-white/40"
                }`}>
                {o.label}
              </button>
            ))}
          </div>
          <div className="text-[9px] text-white/40 mt-1 px-1">Crew-Mitglieder können während dieser Zeit beitreten.</div>
        </div>

        {/* Wächter-Kommandant */}
        <div>
          <div className="text-[10px] font-black tracking-[1.5px] text-white/50 mb-1.5 px-1">
            Wächter-Kommandant
            {selectedGuardianId && (() => {
              const g = guardians.find((x) => x.id === selectedGuardianId);
              return g ? <span className="ml-2 text-[#FFD700]">+{Math.min(100, g.level * 5)}% ATK</span> : null;
            })()}
          </div>
          <div className="flex gap-1.5 overflow-x-auto pb-1">
            <button onClick={() => setSelectedGuardianId(null)}
              className={`shrink-0 w-16 h-20 rounded-lg flex flex-col items-center justify-center text-[10px] font-black transition border-2 ${
                selectedGuardianId === null ? "bg-white/10 border-white/40 text-white" : "bg-black/30 border-white/10 text-white/50"
              }`}>
              <span className="text-xl">—</span>
              <span className="text-[9px] mt-0.5">Kein Wächter</span>
            </button>
            {guardians.length === 0 && (
              <div className="text-[10px] text-white/40 self-center px-2">Keine aktiven Wächter — siehe Profil.</div>
            )}
            {guardians.map((g) => (
              <button key={g.id} onClick={() => setSelectedGuardianId(g.id)}
                className={`shrink-0 w-16 h-20 rounded-lg overflow-hidden flex flex-col items-center justify-end transition border-2 ${
                  selectedGuardianId === g.id ? "bg-[#FFD700]/15 border-[#FFD700]" : "bg-black/30 border-white/10"
                }`}>
                <div className="flex-1 w-full flex items-center justify-center">
                  {g.video_url ? (
                    <video src={g.video_url} autoPlay loop muted playsInline className="w-12 h-12 object-cover rounded" style={{ filter: "url(#ma365-chroma-green)" }} />
                  ) : g.image_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={g.image_url} alt={g.name} className="w-12 h-12 object-cover rounded" style={{ filter: "url(#ma365-chroma-green)" }} />
                  ) : (<span className="text-xl">🛡</span>)}
                </div>
                <span className="text-[9px] text-white truncate w-full px-1 text-center">{g.name}</span>
                <span className="text-[8px] text-[#FFD700] mb-0.5">Lv {g.level}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Truppen-Picker */}
        {Object.keys(grouped).length === 0 && (
          <div className="text-center text-[12px] text-white/60 py-12">Keine Truppen verfügbar — bilde welche aus.</div>
        )}
        {Object.entries(grouped).map(([cls, list]) => (
          <div key={cls}>
            <div className="text-[10px] font-black tracking-[2px] mb-1.5 px-1 text-[#22D1C3]">★ {CLASS_LABEL[cls] ?? cls}</div>
            <div className="space-y-1.5">
              {list.map((t) => {
                const have = counts[t.id] ?? 0;
                const v = selected[t.id] ?? 0;
                return (
                  <div key={t.id} className="flex items-center gap-2 px-2 py-1.5 rounded-lg bg-black/30 border border-white/5">
                    <span className="text-base shrink-0 w-6 text-center">{t.emoji}</span>
                    <div className="flex-1 min-w-0">
                      <div className="text-[11px] font-black text-white truncate">{t.name} <span className="text-white/40">T{t.tier}</span></div>
                      <div className="text-[9px] text-white/50">Angriff {t.base_atk} · da {have.toLocaleString("de-DE")}</div>
                    </div>
                    <input type="number" min={0} max={have} value={v}
                      onChange={(e) => setQty(t.id, Number(e.target.value))}
                      className="w-20 text-right text-[11px] font-black px-2 py-1 rounded bg-black/50 border border-white/10 text-white" />
                    <button onClick={() => setQty(t.id, have)} className="text-[9px] font-black text-[#22D1C3] px-2 py-1 rounded bg-[#22D1C3]/10 hover:bg-[#22D1C3]/20">MAX</button>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      <div className="border-t border-white/10 p-3 shrink-0 space-y-2"
        style={{ background: "linear-gradient(0deg, rgba(0,0,0,0.4), transparent)" }}>
        <div className="flex items-center justify-between text-[11px]">
          <div>
            <span className="text-white/60">Truppen: </span>
            <span className="text-white font-black">{totalCount.toLocaleString("de-DE")}</span>
            <span className="text-white/40 mx-2">·</span>
            <span className="text-white/60">Angriff: </span>
            <span className="text-[#FF6B4A] font-black">{totalAtk.toLocaleString("de-DE")}</span>
          </div>
          <div className="flex gap-1">
            <button onClick={clearAll} className="text-[10px] font-black text-white/60 px-2 py-1 rounded bg-white/5">Leer</button>
            <button onClick={fillMax} className="text-[10px] font-black text-[#FFD700] px-2 py-1 rounded bg-[#FFD700]/10">Alle</button>
          </div>
        </div>
        {msg && (
          <div className="text-[11px] text-center font-black py-1.5 px-2 rounded"
            style={{ color: msg.startsWith("✓") ? "#4ade80" : "#FF6B9A", background: msg.startsWith("✓") ? "rgba(74,222,128,0.1)" : "rgba(255,107,154,0.1)" }}>
            {msg}
          </div>
        )}
        <button onClick={launch} disabled={busy || totalCount < 10}
          className="w-full text-[13px] font-black px-4 py-3 rounded-xl text-white disabled:opacity-40 transition"
          style={{ background: "linear-gradient(135deg, #FF6B4A, #FFD700)", boxShadow: "0 4px 16px rgba(255,107,74,0.4)" }}>
          {busy ? "…" : `📣 CREW-ANGRIFF STARTEN${totalCount > 0 ? ` (${totalCount.toLocaleString("de-DE")})` : ""}`}
        </button>
      </div>
    </>
  );
}

// ─── Attack-Picker (Schritt 2) ──────────────────────────────────────
function AttackPicker({
  defender, counts, selected, grouped, totalAtk, totalCount, busy, msg,
  onBack, onClose, setQty, fillMax, clearAll, launch,
}: {
  defender: DefenderInfo | null;
  counts: Record<string, number>;
  selected: Record<string, number>;
  grouped: Record<string, Troop[]>;
  totalAtk: number;
  totalCount: number;
  busy: boolean;
  msg: string | null;
  onBack: () => void;
  onClose: () => void;
  setQty: (id: string, n: number) => void;
  fillMax: () => void;
  clearAll: () => void;
  launch: () => void;
}) {
  return (
    <>
      <div className="px-3 py-2 border-b border-white/10 flex items-center gap-2 shrink-0"
        style={{ background: "linear-gradient(135deg, rgba(255,45,120,0.18) 0%, rgba(255,107,74,0.12) 100%)" }}>
        <button onClick={onBack} className="w-8 h-8 rounded-full bg-black/40 text-white text-base font-black">‹</button>
        <div className="flex-1 min-w-0">
          <div className="text-[8px] font-black tracking-[2px] text-[#FF6B4A]/90">ANGRIFF</div>
          <div className="text-[13px] font-black text-white truncate">{defender?.display_name}</div>
        </div>
        <button onClick={onClose} className="w-8 h-8 rounded-full bg-black/40 text-white text-base font-black">×</button>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {Object.keys(grouped).length === 0 && (
          <div className="text-center text-[12px] text-white/60 py-12">Keine Truppen verfügbar — bilde welche aus.</div>
        )}
        {Object.entries(grouped).map(([cls, list]) => (
          <div key={cls}>
            <div className="text-[10px] font-black tracking-[2px] mb-1.5 px-1 text-[#22D1C3]">★ {CLASS_LABEL[cls] ?? cls}</div>
            <div className="space-y-1.5">
              {list.map((t) => {
                const have = counts[t.id] ?? 0;
                const v = selected[t.id] ?? 0;
                return (
                  <div key={t.id} className="flex items-center gap-2 px-2 py-1.5 rounded-lg bg-black/30 border border-white/5">
                    <span className="text-base shrink-0 w-6 text-center">{t.emoji}</span>
                    <div className="flex-1 min-w-0">
                      <div className="text-[11px] font-black text-white truncate">{t.name} <span className="text-white/40">T{t.tier}</span></div>
                      <div className="text-[9px] text-white/50">Angriff {t.base_atk} · Verteidigung {t.base_def} · HP {t.base_hp} · da {have.toLocaleString("de-DE")}</div>
                    </div>
                    <input type="number" min={0} max={have} value={v}
                      onChange={(e) => setQty(t.id, Number(e.target.value))}
                      className="w-20 text-right text-[11px] font-black px-2 py-1 rounded bg-black/50 border border-white/10 text-white" />
                    <button onClick={() => setQty(t.id, have)} className="text-[9px] font-black text-[#22D1C3] px-2 py-1 rounded bg-[#22D1C3]/10 hover:bg-[#22D1C3]/20">MAX</button>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      <div className="border-t border-white/10 p-3 shrink-0 space-y-2"
        style={{ background: "linear-gradient(0deg, rgba(0,0,0,0.4), transparent)" }}>
        <div className="flex items-center justify-between text-[11px]">
          <div>
            <span className="text-white/60">Truppen: </span>
            <span className="text-white font-black">{totalCount.toLocaleString("de-DE")}</span>
            <span className="text-white/40 mx-2">·</span>
            <span className="text-white/60">Angriff: </span>
            <span className="text-[#FF6B4A] font-black">{totalAtk.toLocaleString("de-DE")}</span>
          </div>
          <div className="flex gap-1">
            <button onClick={clearAll} className="text-[10px] font-black text-white/60 px-2 py-1 rounded bg-white/5">Leer</button>
            <button onClick={fillMax} className="text-[10px] font-black text-[#FFD700] px-2 py-1 rounded bg-[#FFD700]/10">Alle</button>
          </div>
        </div>
        {msg && (
          <div className="text-[11px] text-center font-black py-1.5 px-2 rounded"
            style={{ color: msg.startsWith("✓") ? "#4ade80" : "#FF6B9A", background: msg.startsWith("✓") ? "rgba(74,222,128,0.1)" : "rgba(255,107,154,0.1)" }}>
            {msg}
          </div>
        )}
        <button onClick={launch} disabled={busy || totalCount < 10}
          className="w-full text-[13px] font-black px-4 py-3 rounded-xl text-white disabled:opacity-40 transition"
          style={{ background: "linear-gradient(135deg, #FF2D78, #FF6B4A)", boxShadow: "0 4px 16px rgba(255,45,120,0.4)" }}>
          {busy ? "…" : `⚔️ ANGREIFEN${totalCount > 0 ? ` (${totalCount.toLocaleString("de-DE")})` : ""}`}
        </button>
      </div>
    </>
  );
}
