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
  is_bot?: boolean;
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
  detail?: string;
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

export function RunnerFightsClient({ inModal = false, onClose }: { inModal?: boolean; onClose?: () => void } = {}) {
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

  const W = inModal
    ? ({ children }: { children: React.ReactNode }) => <div>{children}</div>
    : Wrapper;

  if (loading || !data) {
    return <W><div className="p-10 text-center text-[#8B8FA3]">Lade Gegner …</div></W>;
  }

  if (!data.ok) {
    if (data.error === "no_active_guardian") {
      return (
        <W>
          <div className="p-6 rounded-xl bg-[#1A1D23] border border-white/10 text-center">
            <div className="text-4xl mb-3">🛡️</div>
            <div className="text-white font-black">Kein aktiver Wächter</div>
            <div className="text-sm text-[#a8b4cf] mt-2">Wähle in deiner Crew einen aktiven Wächter aus, um zu kämpfen.</div>
          </div>
        </W>
      );
    }
    return (
      <W>
        <div className="p-6 rounded-xl bg-[#1A1D23] border border-[#FF2D78]/40 text-center">
          <div className="text-3xl mb-2">⚠️</div>
          <div className="text-[#FF2D78] font-black text-lg">{data.error ?? "Unbekannter Fehler"}</div>
          {data.detail && <div className="text-[#a8b4cf] text-sm mt-2">{data.detail}</div>}
        </div>
      </W>
    );
  }

  const used = data.fights_used_today;
  const freeLeft = Math.max(0, 10 - used);
  const nextCost = data.next_gem_cost ?? 0;
  const totalLimit = 30;

  return (
    <W>
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-black text-white mb-1">⚔️ Arena</h1>
          <p className="text-sm text-[#a8b4cf]">
            Fordere andere Runner heraus. Level ±3, Loot bei Sieg & Niederlage.
          </p>
        </div>
        {inModal && onClose && (
          <button onClick={onClose} className="px-3 py-1.5 rounded-full bg-white/5 text-[#a8b4cf] text-lg hover:bg-white/10">✕</button>
        )}
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
        <>
          <div className="text-center text-xs font-black tracking-widest text-[#FFD700] mb-3">
            ⚔️ WÄHLE EINEN GEGNER ⚔️
          </div>
          <div className="grid gap-4" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))" }}>
            {data.opponents.map((op) => (
              <OpponentCard key={op.guardian_id} op={op} onAttack={() => attack(op)} busy={busyId === op.guardian_id} disabled={!!busyId} />
            ))}
          </div>
        </>
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
    </W>
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
  const rarityMeta = op.rarity === "legendary"
    ? { color: "#FFD700", label: "LEGENDÄR", glow: "rgba(255,215,0,0.4)" }
    : op.rarity === "epic"
    ? { color: "#a855f7", label: "EPISCH",   glow: "rgba(168,85,247,0.4)" }
    : { color: "#22D1C3", label: "ELITE",    glow: "rgba(34,209,195,0.3)" };

  // S&F-Style Base-Stats (gleiche Formel wie Engine nutzt)
  const base = estimateStats(op.archetype_emoji, op.level, op.rarity);

  return (
    <div style={{
      position: "relative",
      borderRadius: 14,
      background: `linear-gradient(180deg, ${rarityMeta.glow} 0%, #0F1115 60%)`,
      border: `2px solid ${rarityMeta.color}`,
      boxShadow: `0 4px 24px ${rarityMeta.glow}, inset 0 1px 0 rgba(255,255,255,0.08)`,
      overflow: "hidden",
      opacity: disabled && !busy ? 0.5 : 1,
      transition: "transform 0.15s ease",
    }}
    onMouseOver={(e) => { if (!disabled) e.currentTarget.style.transform = "translateY(-3px)"; }}
    onMouseOut={(e) => { e.currentTarget.style.transform = "translateY(0)"; }}
    >
      {/* Rarity-Badge oben rechts */}
      <div style={{
        position: "absolute", top: 8, right: 8, zIndex: 2,
        padding: "3px 8px", borderRadius: 999,
        background: `${rarityMeta.color}dd`, color: "#0F1115",
        fontSize: 9, fontWeight: 900, letterSpacing: 1.5,
      }}>{rarityMeta.label}</div>

      {op.is_bot && (
        <div style={{
          position: "absolute", top: 8, left: 8, zIndex: 2,
          padding: "3px 8px", borderRadius: 999,
          background: "rgba(0,0,0,0.6)", color: "#a8b4cf",
          fontSize: 9, fontWeight: 900, letterSpacing: 1.5,
        }}>🤖 BOT</div>
      )}

      {/* Portrait-Bereich: großer Emoji-Avatar auf Farbverlauf */}
      <div style={{
        height: 140, display: "flex", alignItems: "center", justifyContent: "center",
        background: `radial-gradient(circle at 50% 40%, ${rarityMeta.color}33 0%, transparent 70%)`,
        borderBottom: `1px solid ${rarityMeta.color}33`,
      }}>
        <div style={{
          fontSize: 80,
          filter: `drop-shadow(0 4px 8px ${rarityMeta.glow})`,
        }}>{op.archetype_emoji}</div>
      </div>

      {/* Name-Block */}
      <div style={{ padding: "10px 12px 6px", textAlign: "center" }}>
        <div style={{ color: "#FFF", fontSize: 15, fontWeight: 900, lineHeight: 1.1 }}>
          {op.display_name ?? op.username}
        </div>
        <div style={{ color: factionColor, fontSize: 11, fontWeight: 700, marginTop: 2 }}>
          [{op.archetype_name}]
        </div>
      </div>

      {/* Level-Bar (wie S&F) */}
      <div style={{ padding: "0 12px 6px" }}>
        <div style={{
          height: 28, borderRadius: 6,
          background: "linear-gradient(180deg, #2b1010, #0f0505)",
          border: "1px solid #FF2D7855",
          display: "flex", alignItems: "center", justifyContent: "center",
          color: "#FFF", fontSize: 13, fontWeight: 900, letterSpacing: 1,
          textShadow: "0 1px 2px #000",
          boxShadow: "inset 0 2px 4px rgba(0,0,0,0.5)",
        }}>
          Stufe {op.level}
        </div>
      </div>

      {/* Stat-Grid (S&F-Style Zeilen) */}
      <div style={{ padding: "4px 12px 8px" }}>
        <StatRow label="Stärke"      value={base.atk} icon="⚔️" color="#FF6B4A" />
        <StatRow label="Verteidigung" value={base.def} icon="🛡️" color="#60a5fa" />
        <StatRow label="Lebensenergie" value={base.hp}  icon="❤️" color="#4ade80" />
        <StatRow label="Geschwindigkeit" value={base.spd} icon="💨" color="#FFD700" />
      </div>

      {/* Record */}
      <div style={{
        padding: "6px 12px",
        borderTop: "1px solid rgba(255,255,255,0.06)",
        display: "flex", justifyContent: "space-between", fontSize: 10,
      }}>
        <span style={{ color: "#4ade80", fontWeight: 700 }}>🏆 {op.wins} Siege</span>
        <span style={{ color: "#FF2D78", fontWeight: 700 }}>💀 {op.losses} Niederlagen</span>
      </div>

      {/* Angreifen-Button (groß, rot, wie S&F) */}
      <button
        onClick={onAttack}
        disabled={disabled}
        style={{
          display: "block", width: "100%", padding: "12px 16px",
          border: "none",
          background: busy
            ? "#8B8FA3"
            : "linear-gradient(180deg, #FF2D78 0%, #a80d3c 100%)",
          color: "#FFF",
          fontSize: 14, fontWeight: 900, letterSpacing: 2,
          cursor: disabled ? "not-allowed" : "pointer",
          boxShadow: "inset 0 1px 0 rgba(255,255,255,0.3), inset 0 -2px 4px rgba(0,0,0,0.4)",
          textShadow: "0 1px 2px rgba(0,0,0,0.5)",
        }}
      >
        {busy ? "⚔️ KÄMPFE…" : "⚔️ ANGREIFEN"}
      </button>
    </div>
  );
}

function StatRow({ label, value, icon, color }: { label: string; value: number; icon: string; color: string }) {
  return (
    <div style={{
      display: "flex", alignItems: "center", justifyContent: "space-between",
      padding: "3px 0", borderBottom: "1px solid rgba(255,255,255,0.04)",
      fontSize: 11,
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6, color: "#a8b4cf" }}>
        <span>{icon}</span>
        <span>{label}</span>
      </div>
      <div style={{ color, fontWeight: 900 }}>{value.toLocaleString("de-DE")}</div>
    </div>
  );
}

/** Groben Stat-Wert aus Level + Rarity schätzen (für Anzeige; echter Kampf nutzt DB-Werte). */
function estimateStats(_emoji: string, level: number, rarity: string) {
  const rarityMult = rarity === "legendary" ? 2.0 : rarity === "epic" ? 1.5 : 1.0;
  const lvlMult = 1 + level * 0.15;
  return {
    hp:  Math.round(120 * rarityMult * lvlMult * 10),
    atk: Math.round( 22 * rarityMult * lvlMult),
    def: Math.round( 18 * rarityMult * lvlMult),
    spd: Math.round( 22 * rarityMult * lvlMult * 0.3),
  };
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
