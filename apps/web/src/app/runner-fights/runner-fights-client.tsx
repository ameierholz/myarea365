"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { CinematicBattleArena } from "@/components/battle-arena";
import type { RoundEvent } from "@/lib/battle-engine";

type Opponent = {
  guardian_id: string;
  user_id: string;
  archetype_id: string;
  level: number;
  wins: number;
  losses: number;
  current_hp_pct: number;
  username: string | null;
  display_name: string | null;
  faction: string | null;
  avatar_url: string | null;
  archetype_name: string;
  archetype_emoji: string;
  rarity: string;
  guardian_type: string;
  role: string;
};

type OpponentsResponse = {
  ok: boolean;
  opponents: Opponent[];
  fights_used_today: number;
  gems_spent_today: number;
  refresh_used_today: number;
  next_gem_cost: number | null;
  gems_available: number;
  refresh_cost: number;
  error?: string;
};

type AttackResult = {
  ok: boolean;
  rounds?: RoundEvent[];
  winner?: "A" | "B" | null;
  final_hp_a?: number;
  final_hp_b?: number;
  settle?: { won: boolean; xp: number; rarity: string; siegel_type: string; item_id: string | null };
  gems_paid?: number;
  error?: string;
  message?: string;
};

export function RunnerFightsClient() {
  const [data, setData] = useState<OpponentsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [fighting, setFighting] = useState<Opponent | null>(null);
  const [result, setResult] = useState<AttackResult | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  async function reload(refresh = false) {
    setLoading(true);
    const res = await fetch(`/api/runner-fights/opponents${refresh ? "?refresh=1" : ""}`, { cache: "no-store" });
    if (res.ok) setData(await res.json());
    setLoading(false);
  }
  useEffect(() => { void reload(); /* eslint-disable-line react-hooks/exhaustive-deps */ }, []);

  async function attack(op: Opponent) {
    const nextCost = data?.next_gem_cost ?? 0;
    if (nextCost === -1) {
      alert("Tageslimit (30) erreicht.");
      return;
    }
    if (nextCost > 0) {
      if (!confirm(`Dieser Fight kostet ${nextCost} 💎. Fortfahren?`)) return;
    }
    setBusyId(op.guardian_id);
    setResult(null);
    try {
      const res = await fetch("/api/runner-fights/attack", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ defender_guardian_id: op.guardian_id }),
      });
      const j = (await res.json()) as AttackResult;
      if (!j.ok) {
        alert(j.message ?? j.error ?? "Fight fehlgeschlagen");
        setBusyId(null);
        return;
      }
      setResult(j);
      setFighting(op);
    } finally {
      setBusyId(null);
    }
  }

  function closeFight() {
    setFighting(null);
    setResult(null);
    void reload();
  }

  if (loading || !data) {
    return <div className="min-h-screen flex items-center justify-center text-[#8B8FA3]">Lade Gegner …</div>;
  }

  if (!data.ok) {
    if (data.error === "no_active_guardian") {
      return (
        <Wrapper>
          <div className="p-6 rounded-xl bg-[#1A1D23] border border-white/10 text-center">
            <div className="text-4xl mb-3">🛡️</div>
            <div className="text-white font-black">Kein aktiver Wächter</div>
            <div className="text-sm text-[#a8b4cf] mt-2">Wähle in deiner Crew einen aktiven Wächter aus, um zu kämpfen.</div>
          </div>
        </Wrapper>
      );
    }
    return (
      <Wrapper>
        <div className="p-6 text-center text-[#FF2D78]">Fehler: {data.error}</div>
      </Wrapper>
    );
  }

  const used = data.fights_used_today;
  const freeLeft = Math.max(0, 10 - used);
  const nextCost = data.next_gem_cost ?? 0;
  const totalLimit = 30;

  return (
    <Wrapper>
      <div className="mb-4">
        <h1 className="text-2xl font-black text-white mb-1">⚔️ Kampfarena</h1>
        <p className="text-sm text-[#a8b4cf]">
          Fordere andere Runner heraus. Level ±3, Loot bei Sieg & Niederlage.
        </p>
      </div>

      {/* Status-Bar */}
      <div className="grid grid-cols-3 gap-2 mb-4">
        <Card label="Gratis-Fights" value={`${freeLeft}/10`} tone={freeLeft > 0 ? "#4ade80" : "#8B8FA3"} />
        <Card label="Fights heute" value={`${used}/${totalLimit}`} tone="#22D1C3" />
        <Card label="💎 Balance" value={data.gems_available.toLocaleString("de-DE")} tone="#FFD700" />
      </div>

      {used >= 10 && nextCost !== -1 && (
        <div className="mb-3 p-3 rounded-xl bg-[#FFD700]/10 border border-[#FFD700]/30 text-xs text-[#a8b4cf]">
          <span className="text-[#FFD700] font-bold">Nächster Fight:</span> <b>{nextCost} 💎</b>
          <span className="opacity-60"> · Preis steigt alle 5 weitere Fights</span>
        </div>
      )}

      {nextCost === -1 && (
        <div className="mb-3 p-3 rounded-xl bg-[#FF2D78]/10 border border-[#FF2D78]/30 text-sm text-[#FF2D78] font-bold">
          🚫 Tageslimit (30) erreicht — morgen wieder frische Fights!
        </div>
      )}

      <div className="flex items-center justify-between mb-3">
        <div className="text-[11px] text-[#8B8FA3]">
          {data.opponents.length} Gegner verfügbar
          {data.refresh_used_today > 0 && ` · ${data.refresh_used_today}× neu gemischt`}
        </div>
        <button
          onClick={() => reload(true)}
          className="text-xs px-3 py-1.5 rounded-lg bg-[#1A1D23] border border-white/10 hover:bg-white/5 text-[#a8b4cf] font-bold"
        >
          🔄 Neu mischen {data.refresh_cost === 0 ? "(gratis)" : `(${data.refresh_cost} 💎)`}
        </button>
      </div>

      {data.opponents.length === 0 ? (
        <div className="p-10 text-center text-[#8B8FA3] text-sm">Keine passenden Gegner gerade online. Versuche es später nochmal.</div>
      ) : (
        <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))" }}>
          {data.opponents.map((op) => (
            <OpponentCard key={op.guardian_id} op={op} onAttack={() => attack(op)} busy={busyId === op.guardian_id} disabled={!!busyId} />
          ))}
        </div>
      )}

      {fighting && result?.rounds && (
        <FightModal
          onClose={closeFight}
          opponent={fighting}
          rounds={result.rounds}
          settle={result.settle}
          winner={result.winner ?? null}
        />
      )}
    </Wrapper>
  );
}

function Wrapper({ children }: { children: React.ReactNode }) {
  return (
    <main className="min-h-screen px-4 py-8">
      <div className="max-w-5xl mx-auto">
        <Link href="/dashboard" className="text-xs text-[#8B8FA3] hover:text-white">← Dashboard</Link>
        <div className="mt-2">{children}</div>
      </div>
    </main>
  );
}

function Card({ label, value, tone }: { label: string; value: string; tone: string }) {
  return (
    <div className="p-3 rounded-xl bg-[#1A1D23] border border-white/10">
      <div className="text-[10px] font-bold tracking-wider text-[#8B8FA3]">{label}</div>
      <div className="text-lg font-black mt-0.5" style={{ color: tone }}>{value}</div>
    </div>
  );
}

function OpponentCard({ op, onAttack, busy, disabled }: { op: Opponent; onAttack: () => void; busy: boolean; disabled: boolean }) {
  const factionColor = op.faction === "syndicate" ? "#22D1C3" : op.faction === "vanguard" ? "#FF6B4A" : "#8B8FA3";
  const rarityColor = op.rarity === "legendary" ? "#FFD700" : op.rarity === "epic" ? "#a855f7" : "#22D1C3";
  return (
    <div className="p-3 rounded-xl bg-[#1A1D23] border border-white/10">
      <div className="flex items-center gap-3 mb-2">
        <div className="w-12 h-12 flex items-center justify-center rounded-lg bg-[#0F1115] text-3xl">{op.archetype_emoji}</div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-black text-white truncate">{op.display_name ?? op.username}</div>
          <div className="text-[10px] text-[#a8b4cf] truncate">@{op.username}</div>
          <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
            <span className="text-[9px] px-1 py-0.5 rounded font-bold" style={{ background: `${rarityColor}22`, color: rarityColor }}>{op.archetype_name}</span>
            <span className="text-[9px] px-1 py-0.5 rounded font-bold" style={{ background: `${factionColor}22`, color: factionColor }}>Lvl {op.level}</span>
          </div>
        </div>
      </div>
      <div className="flex items-center gap-2 text-[10px] text-[#8B8FA3] mb-2">
        <span>🏆 {op.wins}W / {op.losses}L</span>
        <span className="opacity-60">· HP {op.current_hp_pct}%</span>
      </div>
      <button
        onClick={onAttack}
        disabled={disabled}
        className="w-full py-2 rounded-lg bg-gradient-to-r from-[#FF2D78] to-[#a855f7] text-white font-bold text-sm disabled:opacity-40"
      >
        {busy ? "Kämpfe…" : "⚔️ Angreifen"}
      </button>
    </div>
  );
}

function FightModal({ onClose, opponent, rounds, settle, winner }: {
  onClose: () => void;
  opponent: Opponent;
  rounds: RoundEvent[];
  settle?: { won: boolean; xp: number; rarity: string; siegel_type: string; item_id: string | null };
  winner: "A" | "B" | null;
}) {
  const [phase, setPhase] = useState<"fight" | "result">("fight");

  return (
    <div className="fixed inset-0 z-[2500] bg-black/90 backdrop-blur-md flex items-center justify-center p-4">
      <div className="w-full max-w-2xl bg-[#0F1115] rounded-2xl border border-white/10 overflow-hidden">
        {phase === "fight" ? (
          <div className="p-4">
            <CinematicBattleArena
              sideA={{ name: "Du", archetype: { id: "-", emoji: "🛡️", rarity: "elite" }, level: 1, maxHp: 100 }}
              sideB={{ name: opponent.display_name ?? opponent.username ?? "Gegner", archetype: { id: opponent.archetype_id, emoji: opponent.archetype_emoji, rarity: opponent.rarity as "elite"|"epic"|"legendary" }, level: opponent.level, maxHp: 100 }}
              rounds={rounds}
              onFinished={() => setPhase("result")}
            />
            <button onClick={() => setPhase("result")} className="mt-3 w-full py-2 rounded-lg bg-white/5 text-[#a8b4cf] font-bold text-xs">
              Überspringen →
            </button>
          </div>
        ) : (
          <ResultView onClose={onClose} settle={settle} winner={winner} />
        )}
      </div>
    </div>
  );
}

function ResultView({ onClose, settle, winner }: {
  onClose: () => void;
  settle?: { won: boolean; xp: number; rarity: string; siegel_type: string; item_id: string | null };
  winner: "A" | "B" | null;
}) {
  const won = settle?.won ?? winner === "A";
  const rarityMeta = settle?.rarity === "epic" ? { label: "EPISCH", color: "#a855f7" }
                    : settle?.rarity === "rare" ? { label: "SELTEN", color: "#22D1C3" }
                    : { label: "GEWÖHNLICH", color: "#8B8FA3" };
  return (
    <div className="p-8 text-center">
      <div className="text-6xl mb-2">{won ? "🏆" : "💀"}</div>
      <div className="text-2xl font-black" style={{ color: won ? "#4ade80" : "#FF2D78" }}>
        {won ? "SIEG!" : "Niederlage"}
      </div>
      {settle && (
        <div className="mt-5 p-4 rounded-xl inline-block text-left" style={{ background: `${rarityMeta.color}15`, border: `1px solid ${rarityMeta.color}44`, minWidth: 220 }}>
          <div className="text-xs font-black tracking-widest mb-2" style={{ color: rarityMeta.color }}>{rarityMeta.label} BEUTE</div>
          <div className="text-sm text-white">⚡ +{settle.xp} XP</div>
          <div className="text-sm text-white mt-1">🔖 +1× {settle.siegel_type}-Siegel</div>
          {settle.item_id && <div className="text-sm text-[#FFD700] mt-1 font-bold">🎁 Ausrüstung erbeutet!</div>}
        </div>
      )}
      <button onClick={onClose} className="mt-6 px-6 py-3 rounded-lg bg-[#22D1C3] text-[#0F1115] font-black text-sm">
        Weiter kämpfen →
      </button>
    </div>
  );
}
