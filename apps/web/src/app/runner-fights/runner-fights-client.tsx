"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { CinematicBattleArena } from "@/components/battle-arena";
import type { RoundEvent } from "@/lib/battle-engine";
import { TYPE_META, typeCounter, type GuardianType } from "@/lib/guardian";

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

type StatBlock = { hp: number; atk: number; def: number; spd: number };
type EquippedItem = {
  user_item_id: string;
  slot: string; name: string; emoji: string; rarity: string; upgrade_tier: number;
  bonus_hp: number; bonus_atk: number; bonus_def: number; bonus_spd: number;
  image_url: string | null;
};
type MyGuardian = {
  guardian_id: string;
  archetype_id: string;
  level: number;
  xp: number;
  wins: number;
  losses: number;
  current_hp_pct: number;
  archetype_name: string;
  archetype_emoji: string;
  rarity: string;
  guardian_type: string | null;
  role: string | null;
  base_stats: StatBlock;
  bonus_stats: StatBlock;
  effective_stats: StatBlock;
  equipped: EquippedItem[];
  inventory_by_slot: Record<string, EquippedItem[]>;
};

type OpponentsResponse = {
  ok: boolean;
  opponents: Opponent[];
  my_guardian?: MyGuardian | null;
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

type SeasonInfo = {
  ok: boolean;
  season: { id: string; number: number; name: string; starts_at: string; ends_at: string; status: string } | null;
  seasonal_guardian: { id: string } | null;
  eternal_guardian: { id: string; guardian_archetypes: { name: string; emoji: string } } | null;
  needs_pick: boolean;
};

const DEMO_SEASON: SeasonInfo = {
  ok: true,
  season: {
    id: "demo-season",
    number: 1,
    name: "Saison der Klingen (DEMO)",
    starts_at: new Date(Date.now() - 12 * 86400_000).toISOString(),
    ends_at:   new Date(Date.now() + 78 * 86400_000).toISOString(),
    status: "active",
  },
  seasonal_guardian: null,
  eternal_guardian: {
    id: "demo-eternal",
    guardian_archetypes: { name: "Aegon der Standhafte", emoji: "🛡️" },
  },
  needs_pick: true,
};

export function RunnerFightsClient({ inModal = false, onClose }: { inModal?: boolean; onClose?: () => void } = {}) {
  const [data, setData] = useState<OpponentsResponse | null>(null);
  const [season, setSeason] = useState<SeasonInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [fighting, setFighting] = useState<Opponent | null>(null);
  const [result, setResult] = useState<AttackResult | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [demoSeason, setDemoSeason] = useState(false);

  async function reload(refresh = false) {
    setLoading(true);
    const [oppRes, seasonRes] = await Promise.all([
      fetch(`/api/runner-fights/opponents${refresh ? "?refresh=1" : ""}`, { cache: "no-store" }),
      fetch("/api/arena/season", { cache: "no-store" }),
    ]);
    if (oppRes.ok)    setData(await oppRes.json());
    if (seasonRes.ok) setSeason(await seasonRes.json());
    setLoading(false);
  }
  useEffect(() => { void reload(); /* eslint-disable-line react-hooks/exhaustive-deps */ }, []);

  async function attack(op: Opponent) {
    const nextCost = data?.next_gem_cost ?? 0;
    if (nextCost === -1) {
      alert("Tageslimit (15) erreicht.");
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

  if (demoSeason) {
    return (
      <W>
        <SeasonPicker
          season={DEMO_SEASON.season!}
          eternal={DEMO_SEASON.eternal_guardian}
          demoMode
          onPicked={() => { setDemoSeason(false); void reload(); }}
          onClose={() => setDemoSeason(false)}
        />
      </W>
    );
  }

  if (season?.season && season.needs_pick) {
    return (
      <W>
        <SeasonPicker
          season={season.season}
          eternal={season.eternal_guardian}
          onPicked={() => reload()}
          onClose={inModal ? onClose : undefined}
        />
      </W>
    );
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
  const freeLeft = Math.max(0, 5 - used);
  const nextCost = data.next_gem_cost ?? 0;
  const totalLimit = 15;

  return (
    <W>
      <ArenaHeader
        onClose={inModal ? onClose : undefined}
        myGuardian={data.my_guardian ?? null}
        freeLeft={freeLeft}
        used={used}
        totalLimit={totalLimit}
        gemsAvailable={data.gems_available}
        nextCost={nextCost}
        onChanged={() => reload()}
      />

      {/* Demo + Info-Zeile */}
      <div style={{ padding: "0 18px 10px", display: "flex", gap: 8, justifyContent: "center" }}>
        <button onClick={() => setDemoSeason(true)} style={{
          padding: "6px 12px", borderRadius: 999, fontSize: 11, fontWeight: 800, cursor: "pointer",
          background: "rgba(168,85,247,0.1)", border: "1px solid rgba(168,85,247,0.4)", color: "#c084fc",
        }}>🎬 Demo: 2-Wächter-Flow</button>
        <GuardianExplainerButton />
      </div>

      {nextCost === -1 && (
        <div className="mb-3 p-3 rounded-xl bg-[#FF2D78]/10 border border-[#FF2D78]/30 text-sm text-[#FF2D78] font-bold">
          🚫 Tageslimit (15) erreicht — morgen wieder frische Fights!
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
              <OpponentCard
                key={op.guardian_id}
                op={op}
                myType={(data.my_guardian?.guardian_type ?? null) as GuardianType | null}
                onAttack={() => attack(op)}
                busy={busyId === op.guardian_id}
                disabled={!!busyId}
              />
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

function ArenaHeader({ onClose, myGuardian, freeLeft, used, totalLimit, gemsAvailable, nextCost, onChanged }: {
  onClose?: () => void;
  myGuardian: MyGuardian | null;
  freeLeft: number;
  used: number;
  totalLimit: number;
  gemsAvailable: number;
  nextCost: number | null;
  onChanged: () => void | Promise<void>;
}) {
  const myType = myGuardian?.guardian_type && (myGuardian.guardian_type in TYPE_META)
    ? TYPE_META[myGuardian.guardian_type as GuardianType] : null;
  const rarityMeta = myGuardian?.rarity === "legendary"
    ? { color: "#FFD700", label: "LEGENDÄR", glow: "rgba(255,215,0,0.4)" }
    : myGuardian?.rarity === "epic"
    ? { color: "#a855f7", label: "EPISCH",   glow: "rgba(168,85,247,0.4)" }
    : { color: "#22D1C3", label: "ELITE",    glow: "rgba(34,209,195,0.3)" };

  return (
    <div style={{
      position: "relative",
      marginBottom: 20,
      borderRadius: 18,
      overflow: "hidden",
      background: `
        radial-gradient(ellipse at 50% 120%, rgba(255,107,74,0.25) 0%, transparent 55%),
        radial-gradient(ellipse at 0% 0%, rgba(168,85,247,0.15) 0%, transparent 40%),
        radial-gradient(ellipse at 100% 0%, rgba(34,209,195,0.12) 0%, transparent 40%),
        linear-gradient(180deg, #1a0e14 0%, #0a0a0f 100%)
      `,
      border: "1px solid rgba(255,107,74,0.35)",
      boxShadow: "inset 0 1px 0 rgba(255,255,255,0.05), 0 10px 40px rgba(0,0,0,0.5)",
    }}>
      {/* Dekorative Kolosseum-Bögen (CSS Pseudo-Arches) */}
      <div style={{
        position: "absolute", top: -30, left: 0, right: 0, height: 60,
        pointerEvents: "none", opacity: 0.25,
        background: "repeating-linear-gradient(90deg, transparent 0 40px, rgba(255,107,74,0.3) 40px 42px)",
        maskImage: "radial-gradient(ellipse at center bottom, black 0%, transparent 70%)",
      }} />

      {/* Crossed Swords Watermark */}
      <div style={{
        position: "absolute", right: -20, top: -10,
        fontSize: 140, opacity: 0.05,
        pointerEvents: "none",
        transform: "rotate(-12deg)",
      }}>⚔️</div>

      {/* Header-Leiste */}
      <div style={{
        position: "relative", padding: "14px 18px 10px",
        display: "flex", alignItems: "center", justifyContent: "space-between",
        borderBottom: "1px solid rgba(255,255,255,0.04)",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ fontSize: 22 }}>⚔️</div>
          <div>
            <div style={{ color: "#FFD700", fontSize: 10, fontWeight: 900, letterSpacing: 3 }}>DER RUF DER ARENA</div>
            <div style={{ color: "#FFF", fontSize: 18, fontWeight: 900, lineHeight: 1 }}>Arena</div>
          </div>
        </div>
        {onClose && (
          <button onClick={onClose} style={{
            background: "rgba(255,255,255,0.05)", border: "none", color: "#a8b4cf",
            width: 34, height: 34, borderRadius: 999, cursor: "pointer", fontSize: 18,
          }}>✕</button>
        )}
      </div>

      {/* Body: Hero-Panel mit Portrait + Stats + Gear */}
      {myGuardian && (
        <HeroPanel myGuardian={myGuardian} myType={myType} rarityMeta={rarityMeta} onChanged={onChanged} />
      )}

      {/* Arena-Stat-Kacheln */}
      <div style={{
        position: "relative", padding: "0 18px 14px",
        display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8,
      }}>
          <ArenaStatTile
            label="GRATIS-FIGHTS"
            value={`${freeLeft}/5`}
            sub={freeLeft > 0 ? "noch frei" : "aufgebraucht"}
            icon="⚡"
            color={freeLeft > 0 ? "#4ade80" : "#8B8FA3"}
          />
          <ArenaStatTile
            label="FIGHTS HEUTE"
            value={`${used}/${totalLimit}`}
            sub="Tages-Counter"
            icon="🗡️"
            color="#22D1C3"
          />
          <ArenaStatTile
            label="DIAMANTEN"
            value={gemsAvailable.toLocaleString("de-DE")}
            sub={nextCost && nextCost > 0 ? `nächster: ${nextCost} 💎` : "balance"}
            icon="💎"
            color="#FFD700"
          />
      </div>

      {nextCost === -1 && (
        <div style={{ padding: "10px 18px", background: "rgba(255,45,120,0.14)", borderTop: "1px solid rgba(255,45,120,0.3)", color: "#FF2D78", fontSize: 12, fontWeight: 800, textAlign: "center" }}>
          🚫 Tageslimit (15) erreicht — morgen wieder frische Fights!
        </div>
      )}

      <style>{`
        @keyframes heroFloat {
          0%, 100% { transform: translateY(0) scale(1); }
          50%      { transform: translateY(-4px) scale(1.02); }
        }
      `}</style>
    </div>
  );
}

const SLOT_ORDER: Array<{ key: string; icon: string; label: string }> = [
  { key: "helm",      icon: "⛑️", label: "Helm" },
  { key: "shoulders", icon: "🦾", label: "Schultern" },
  { key: "chest",     icon: "🛡️", label: "Brust" },
  { key: "hands",     icon: "🧤", label: "Hände" },
  { key: "wrist",     icon: "🔗", label: "Armschienen" },
  { key: "boots",     icon: "🥾", label: "Stiefel" },
  { key: "neck",      icon: "📿", label: "Halskette" },
  { key: "ring",      icon: "💍", label: "Ring" },
  { key: "weapon",    icon: "⚔️", label: "Waffe" },
];

const TIER_COLORS = ["#8B8FA3", "#4ade80", "#a855f7", "#FFD700"];

function HeroPanel({ myGuardian, myType, rarityMeta, onChanged }: {
  myGuardian: MyGuardian;
  myType: { label: string; icon: string; color: string } | null;
  rarityMeta: { color: string; label: string; glow: string };
  onChanged: () => void | Promise<void>;
}) {
  const eff = myGuardian.effective_stats;
  const bon = myGuardian.bonus_stats;
  const equippedMap = new Map(myGuardian.equipped.map((e) => [e.slot, e]));
  const equippedCount = myGuardian.equipped.length;
  const [openSlot, setOpenSlot] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function equip(userItemId: string) {
    setBusy(true);
    try {
      await fetch("/api/guardian/inventory", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "equip", user_item_id: userItemId }),
      });
      setOpenSlot(null);
      await onChanged();
    } finally { setBusy(false); }
  }
  async function unequip(slot: string) {
    setBusy(true);
    try {
      await fetch("/api/guardian/inventory", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "unequip", slot }),
      });
      setOpenSlot(null);
      await onChanged();
    } finally { setBusy(false); }
  }

  return (
    <div style={{
      position: "relative", margin: "0 18px 12px", padding: 14,
      borderRadius: 14,
      background: `radial-gradient(circle at 15% 20%, ${rarityMeta.glow} 0%, transparent 55%), linear-gradient(180deg, rgba(15,17,21,0.75) 0%, rgba(15,17,21,0.95) 100%)`,
      border: `1px solid ${rarityMeta.color}55`,
      boxShadow: `0 4px 28px ${rarityMeta.glow}, inset 0 1px 0 rgba(255,255,255,0.05)`,
      display: "grid", gridTemplateColumns: "auto 1fr", gap: 14, alignItems: "center",
    }}>
      {/* Portrait */}
      <div style={{
        position: "relative",
        width: 120, height: 130,
        borderRadius: 12,
        background: `radial-gradient(circle at 50% 40%, ${rarityMeta.color}35 0%, transparent 65%), linear-gradient(180deg, rgba(0,0,0,0.4) 0%, rgba(0,0,0,0.7) 100%)`,
        border: `1px solid ${rarityMeta.color}66`,
        display: "flex", alignItems: "center", justifyContent: "center",
        flexShrink: 0,
      }}>
        <div style={{
          position: "absolute", top: 6, left: 6,
          padding: "2px 6px", borderRadius: 999,
          background: `${rarityMeta.color}dd`, color: "#0F1115",
          fontSize: 8, fontWeight: 900, letterSpacing: 1.2,
        }}>{rarityMeta.label}</div>
        <div style={{
          fontSize: 70,
          filter: `drop-shadow(0 6px 12px ${rarityMeta.glow})`,
          animation: "heroFloat 3s ease-in-out infinite",
        }}>{myGuardian.archetype_emoji}</div>
        <div style={{
          position: "absolute", bottom: 6, left: "50%", transform: "translateX(-50%)",
          width: 80, height: 5, borderRadius: "50%",
          background: `radial-gradient(ellipse, ${rarityMeta.color}aa, transparent 70%)`,
        }} />
      </div>

      {/* Mitte: Name + Stats + Gear-Strip */}
      <div style={{ minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <div style={{ color: "#FFF", fontSize: 16, fontWeight: 900, lineHeight: 1 }}>
            {myGuardian.archetype_name}
          </div>
          <div style={{
            padding: "2px 8px", borderRadius: 999,
            background: `${rarityMeta.color}22`, border: `1px solid ${rarityMeta.color}66`,
            color: rarityMeta.color, fontSize: 10, fontWeight: 900, letterSpacing: 1,
          }}>Stufe {myGuardian.level}</div>
          {myType && (
            <div style={{
              display: "inline-flex", alignItems: "center", gap: 4,
              padding: "2px 8px", borderRadius: 999,
              background: `${myType.color}22`, border: `1px solid ${myType.color}77`,
              color: myType.color, fontSize: 10, fontWeight: 900, letterSpacing: 1,
            }}>
              <span>{myType.icon}</span>
              {myType.label.toUpperCase()}
            </div>
          )}
          <div style={{ fontSize: 10, color: "#a8b4cf" }}>
            🏆 <b style={{ color: "#4ade80" }}>{myGuardian.wins}</b> · 💀 <b style={{ color: "#FF2D78" }}>{myGuardian.losses}</b>
          </div>
        </div>

        {/* Stat-Grid 4x */}
        <div style={{
          marginTop: 10, display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 6,
        }}>
          <GearStat label="HP"  value={eff.hp}  bonus={bon.hp}  icon="❤️" color="#4ade80" />
          <GearStat label="ATK" value={eff.atk} bonus={bon.atk} icon="⚔️" color="#FF6B4A" />
          <GearStat label="DEF" value={eff.def} bonus={bon.def} icon="🛡️" color="#60a5fa" />
          <GearStat label="SPD" value={eff.spd} bonus={bon.spd} icon="💨" color="#FFD700" />
        </div>

        {/* Equipment-Strip (klickbar → Inline-Picker) */}
        <div style={{ marginTop: 12 }}>
          <div style={{ color: "#8B8FA3", fontSize: 11, fontWeight: 900, letterSpacing: 1.5, marginBottom: 6 }}>
            ⚒️ AUSRÜSTUNG · {equippedCount}/{SLOT_ORDER.length} SLOTS
            <span style={{ color: "#6c7590", fontSize: 10, fontWeight: 700, marginLeft: 8, letterSpacing: 0 }}>
              (Slot klicken zum Wechseln)
            </span>
          </div>
          <div style={{
            display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(100px, 1fr))", gap: 6,
          }}>
            {SLOT_ORDER.map((s) => {
              const eq = equippedMap.get(s.key);
              const tier = eq?.upgrade_tier ?? 0;
              const tierColor = TIER_COLORS[Math.max(0, Math.min(3, tier))];
              const empty = !eq;
              const bonusSummary = eq ? summarizeBonus(eq, tier) : null;
              const isOpen = openSlot === s.key;
              const available = myGuardian.inventory_by_slot[s.key] ?? [];

              return (
                <div key={s.key} style={{ position: "relative" }}>
                  <button
                    onClick={() => setOpenSlot(isOpen ? null : s.key)}
                    disabled={busy}
                    style={{
                      width: "100%",
                      padding: "6px 8px 7px",
                      borderRadius: 10,
                      background: empty ? "rgba(255,255,255,0.03)" : `linear-gradient(180deg, ${tierColor}22 0%, rgba(0,0,0,0.4) 100%)`,
                      border: `1.5px solid ${empty ? "rgba(255,255,255,0.1)" : tierColor}`,
                      boxShadow: empty ? "none" : `0 0 10px ${tierColor}33`,
                      cursor: busy ? "wait" : "pointer",
                      textAlign: "left",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <div style={{
                        width: 30, height: 30, borderRadius: 6, flexShrink: 0,
                        background: empty ? "rgba(0,0,0,0.3)" : `${tierColor}33`,
                        display: "flex", alignItems: "center", justifyContent: "center",
                        fontSize: 18, opacity: empty ? 0.5 : 1,
                      }}>{eq ? eq.emoji : s.icon}</div>
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <div style={{ fontSize: 8, fontWeight: 900, letterSpacing: 1, color: "#8B8FA3" }}>
                          {s.label.toUpperCase()}
                        </div>
                        <div style={{
                          fontSize: 10, fontWeight: 900, color: empty ? "#6c7590" : tierColor,
                          whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
                        }}>
                          {eq ? eq.name : "— leer —"}
                        </div>
                      </div>
                    </div>
                    {bonusSummary && (
                      <div style={{
                        marginTop: 3, fontSize: 9, color: "#4ade80", fontWeight: 900,
                        letterSpacing: 0.3, lineHeight: 1.2,
                      }}>
                        {bonusSummary}
                      </div>
                    )}
                  </button>

                  {isOpen && (
                    <SlotPicker
                      slotLabel={s.label}
                      available={available}
                      equippedId={eq?.user_item_id ?? null}
                      onPick={equip}
                      onUnequip={eq ? () => unequip(s.key) : null}
                      onClose={() => setOpenSlot(null)}
                    />
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

    </div>
  );
}

const TIER_MULT = [1.0, 1.5, 2.25, 3.5];

function summarizeBonus(it: EquippedItem, tier: number): string | null {
  const m = TIER_MULT[Math.max(0, Math.min(3, tier))];
  const parts: string[] = [];
  if (it.bonus_hp)  parts.push(`+${Math.round(it.bonus_hp  * m)} HP`);
  if (it.bonus_atk) parts.push(`+${Math.round(it.bonus_atk * m)} ATK`);
  if (it.bonus_def) parts.push(`+${Math.round(it.bonus_def * m)} DEF`);
  if (it.bonus_spd) parts.push(`+${Math.round(it.bonus_spd * m)} SPD`);
  return parts.length ? parts.join(" · ") : null;
}

function SlotPicker({ slotLabel, available, equippedId, onPick, onUnequip, onClose }: {
  slotLabel: string;
  available: EquippedItem[];
  equippedId: string | null;
  onPick: (id: string) => void;
  onUnequip: (() => void) | null;
  onClose: () => void;
}) {
  return (
    <>
      <div onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 50 }} />
      <div style={{
        position: "absolute", zIndex: 51, top: "100%", left: 0, right: 0, marginTop: 4,
        minWidth: 220,
        background: "linear-gradient(180deg, #1a1d23 0%, #0f1115 100%)",
        border: "1px solid rgba(255,215,0,0.4)",
        borderRadius: 10,
        boxShadow: "0 10px 40px rgba(0,0,0,0.7), 0 0 20px rgba(255,215,0,0.15)",
        padding: 6, maxHeight: 280, overflowY: "auto",
      }}>
        <div style={{ padding: "4px 6px 6px", color: "#FFD700", fontSize: 9, fontWeight: 900, letterSpacing: 1.5 }}>
          {slotLabel.toUpperCase()} WÄHLEN
        </div>
        {available.length === 0 ? (
          <div style={{ padding: "10px 8px", fontSize: 10, color: "#6c7590", textAlign: "center" }}>
            Keine Items für diesen Slot.
          </div>
        ) : (
          available.map((it) => {
            const tier = it.upgrade_tier;
            const tierColor = TIER_COLORS[Math.max(0, Math.min(3, tier))];
            const isEquipped = it.user_item_id === equippedId;
            const bonus = summarizeBonus(it, tier);
            return (
              <button
                key={it.user_item_id}
                onClick={() => isEquipped ? onClose() : onPick(it.user_item_id)}
                style={{
                  display: "block", width: "100%", padding: "6px 8px",
                  marginTop: 2,
                  background: isEquipped ? `${tierColor}22` : "rgba(255,255,255,0.02)",
                  border: `1px solid ${isEquipped ? tierColor : "transparent"}`,
                  borderRadius: 8, cursor: "pointer", textAlign: "left",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <span style={{ fontSize: 18 }}>{it.emoji}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ color: tierColor, fontSize: 11, fontWeight: 900 }}>
                      {it.name}{tier > 0 ? ` T${tier}` : ""}
                    </div>
                    {bonus && (
                      <div style={{ color: "#4ade80", fontSize: 9, fontWeight: 700 }}>
                        {bonus}
                      </div>
                    )}
                  </div>
                  {isEquipped && <span style={{ fontSize: 9, color: tierColor, fontWeight: 900 }}>✓</span>}
                </div>
              </button>
            );
          })
        )}
        {onUnequip && (
          <button
            onClick={onUnequip}
            style={{
              display: "block", width: "100%", marginTop: 6, padding: "6px 8px",
              background: "rgba(255,45,120,0.1)", border: "1px solid rgba(255,45,120,0.3)",
              borderRadius: 8, color: "#FF2D78", fontSize: 10, fontWeight: 900,
              cursor: "pointer",
            }}
          >
            ✕ AUSZIEHEN
          </button>
        )}
      </div>
    </>
  );
}

function GearStat({ label, value, bonus, icon, color }: { label: string; value: number; bonus: number; icon: string; color: string }) {
  return (
    <div style={{
      position: "relative", padding: "6px 8px", borderRadius: 8,
      background: `linear-gradient(135deg, ${color}12 0%, rgba(0,0,0,0.35) 90%)`,
      border: `1px solid ${color}33`,
    }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: 9, color: "#8B8FA3", fontWeight: 900, letterSpacing: 1 }}>
        <span>{icon} {label}</span>
        {bonus > 0 && <span style={{ color: "#4ade80", fontSize: 9, fontWeight: 900 }}>+{bonus.toLocaleString("de-DE")}</span>}
      </div>
      <div style={{ color, fontSize: 15, fontWeight: 900, lineHeight: 1.1, marginTop: 2 }}>
        {value.toLocaleString("de-DE")}
      </div>
    </div>
  );
}

function ArenaStatTile({ label, value, sub, icon, color }: { label: string; value: string; sub: string; icon: string; color: string }) {
  return (
    <div style={{
      position: "relative",
      padding: "10px 12px",
      borderRadius: 12,
      background: `linear-gradient(135deg, ${color}18 0%, rgba(15,17,21,0.6) 70%)`,
      border: `1px solid ${color}44`,
      boxShadow: `inset 0 1px 0 rgba(255,255,255,0.06), 0 2px 8px ${color}15`,
    }}>
      <div style={{
        position: "absolute", top: 6, right: 8,
        fontSize: 18, opacity: 0.5,
      }}>{icon}</div>
      <div style={{ color: "#8B8FA3", fontSize: 9, fontWeight: 900, letterSpacing: 1.5 }}>{label}</div>
      <div style={{ color, fontSize: 20, fontWeight: 900, lineHeight: 1.1, marginTop: 2 }}>{value}</div>
      <div style={{ color: "#a8b4cf", fontSize: 9, marginTop: 2 }}>{sub}</div>
    </div>
  );
}

function OpponentCard({ op, myType, onAttack, busy, disabled }: { op: Opponent; myType: GuardianType | null; onAttack: () => void; busy: boolean; disabled: boolean }) {
  const factionColor = op.faction === "syndicate" ? "#22D1C3" : op.faction === "vanguard" ? "#FF6B4A" : "#8B8FA3";
  const rarityMeta = op.rarity === "legendary"
    ? { color: "#FFD700", label: "LEGENDÄR", glow: "rgba(255,215,0,0.4)" }
    : op.rarity === "epic"
    ? { color: "#a855f7", label: "EPISCH",   glow: "rgba(168,85,247,0.4)" }
    : { color: "#22D1C3", label: "ELITE",    glow: "rgba(34,209,195,0.3)" };

  const opType = op.guardian_type && (op.guardian_type in TYPE_META) ? TYPE_META[op.guardian_type as GuardianType] : null;
  const mult = myType && op.guardian_type && (op.guardian_type in TYPE_META)
    ? typeCounter(myType, op.guardian_type as GuardianType) : 1;
  const matchup = mult > 1
    ? { label: "VORTEIL", color: "#4ade80", icon: "✅" }
    : mult < 1
    ? { label: "NACHTEIL", color: "#FF2D78", icon: "⚠️" }
    : null;

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

      {matchup && (
        <div style={{
          position: "absolute", top: 36, left: 8, zIndex: 2,
          padding: "3px 8px", borderRadius: 999,
          background: `${matchup.color}dd`, color: "#0F1115",
          fontSize: 9, fontWeight: 900, letterSpacing: 1.2,
          boxShadow: `0 2px 8px ${matchup.color}66`,
        }}>{matchup.icon} {matchup.label}</div>
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
        {opType && (
          <div style={{
            display: "inline-flex", alignItems: "center", gap: 4,
            marginTop: 6, padding: "3px 10px", borderRadius: 999,
            background: `${opType.color}22`, border: `1px solid ${opType.color}77`,
            color: opType.color, fontSize: 9, fontWeight: 900, letterSpacing: 1.2,
          }}>
            <span style={{ fontSize: 11 }}>{opType.icon}</span>
            {opType.label.toUpperCase()}
          </div>
        )}
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
    <div style={{
      position: "fixed", inset: 0, zIndex: 2500,
      background: "rgba(0,0,0,0.92)", backdropFilter: "blur(14px)",
      display: "flex", alignItems: "center", justifyContent: "center", padding: 16,
      overflow: "auto",
    }}>
      <div style={{
        width: "100%", maxWidth: 700,
        background: "#0F1115", borderRadius: 20,
        border: "1px solid rgba(255, 45, 120, 0.4)",
        boxShadow: "0 20px 60px rgba(0,0,0,0.8), 0 0 60px rgba(255,45,120,0.2)",
        overflow: "hidden",
      }}>
        {phase === "fight" ? (
          <div style={{ padding: 16 }}>
            <CinematicBattleArena
              sideA={{ name: "Du", archetype: { id: "-", emoji: "🛡️", rarity: "elite" }, level: 1, maxHp: 100 }}
              sideB={{ name: opponent.display_name ?? opponent.username ?? "Gegner", archetype: { id: opponent.archetype_id, emoji: opponent.archetype_emoji, rarity: opponent.rarity as "elite"|"epic"|"legendary" }, level: opponent.level, maxHp: 100 }}
              rounds={rounds}
              onFinished={() => setPhase("result")}
            />
            <button onClick={() => setPhase("result")} style={{
              marginTop: 12, width: "100%", padding: "8px 16px",
              borderRadius: 10, background: "rgba(255,255,255,0.05)",
              color: "#a8b4cf", fontSize: 12, fontWeight: 700,
              border: "none", cursor: "pointer",
            }}>
              Überspringen →
            </button>
          </div>
        ) : (
          <ResultView onClose={onClose} opponent={opponent} rounds={rounds} settle={settle} winner={winner} />
        )}
      </div>
    </div>
  );
}

function ResultView({ onClose, opponent, rounds, settle, winner }: {
  onClose: () => void;
  opponent: Opponent;
  rounds: RoundEvent[];
  settle?: { won: boolean; xp: number; rarity: string; siegel_type: string; item_id: string | null };
  winner: "A" | "B" | null;
}) {
  const won = settle?.won ?? winner === "A";
  const rarityMeta = settle?.rarity === "epic" ? { label: "EPISCH", color: "#a855f7" }
                    : settle?.rarity === "rare" ? { label: "SELTEN", color: "#22D1C3" }
                    : { label: "GEWÖHNLICH", color: "#8B8FA3" };

  // Damage-Stats aus den Rounds berechnen
  let dmgA = 0, dmgB = 0, critsA = 0, critsB = 0;
  for (const r of rounds) {
    const dmg = r.damage ?? 0;
    const isCrit = r.action === "crit" || r.action === "ult";
    if (r.actor === "A") { dmgA += dmg; if (isCrit) critsA++; }
    if (r.actor === "B") { dmgB += dmg; if (isCrit) critsB++; }
  }
  const lastRound = rounds[rounds.length - 1];
  const finalHpA = lastRound?.hp_a_after ?? 100;
  const finalHpB = lastRound?.hp_b_after ?? 100;

  const bannerColor = won ? "#4ade80" : "#FF2D78";
  const bannerLabel = won ? "SIEG" : "NIEDERLAGE";
  const bannerIcon = won ? "🏆" : "💀";
  const flavorText = won
    ? "Dieser Gegner war bestimmt nicht ganz ohne. Jetzt ist er es aber."
    : "Heute ging's nicht auf. Morgen ist ein neuer Kampftag.";

  return (
    <div style={{ position: "relative", overflow: "hidden" }}>
      {/* Hintergrund: Schiffsplanken-Feeling */}
      <div style={{
        position: "absolute", inset: 0, opacity: 0.4,
        background: "linear-gradient(180deg, rgba(139,69,19,0.15) 0%, rgba(15,17,21,0.8) 100%)",
        pointerEvents: "none",
      }} />

      {/* Top-Banner */}
      <div style={{
        position: "relative",
        padding: "20px 16px 14px",
        textAlign: "center",
        background: `linear-gradient(180deg, ${bannerColor}22 0%, transparent 100%)`,
        borderBottom: `2px solid ${bannerColor}`,
      }}>
        <div style={{ fontSize: 48, marginBottom: 4, animation: "victoryPop 0.6s cubic-bezier(0.34, 1.56, 0.64, 1)" }}>{bannerIcon}</div>
        <div style={{
          display: "inline-block",
          padding: "6px 28px",
          background: `linear-gradient(180deg, ${bannerColor} 0%, ${bannerColor}88 100%)`,
          color: won ? "#0F1115" : "#FFF",
          fontSize: 20, fontWeight: 900, letterSpacing: 4,
          borderRadius: 4,
          boxShadow: `0 4px 12px ${bannerColor}55, inset 0 -2px 4px rgba(0,0,0,0.3)`,
          textShadow: won ? "none" : "0 1px 2px rgba(0,0,0,0.5)",
        }}>{bannerLabel}</div>
        <div style={{ color: "#a8b4cf", fontSize: 12, marginTop: 10, maxWidth: 480, margin: "10px auto 0" }}>
          {flavorText}
        </div>
      </div>

      {/* Split-Screen: Beide Kämpfer */}
      <div style={{ position: "relative", display: "grid", gridTemplateColumns: "1fr auto 1fr", gap: 0, padding: "20px 12px" }}>
        {/* Du */}
        <FighterPanel
          side="left"
          name="Du"
          emoji="🛡️"
          level={1}
          hpPct={finalHpA}
          dmgDealt={dmgA}
          crits={critsA}
          winner={won}
        />

        {/* Schwert-Trenner */}
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "center",
          color: "#8B8FA3", fontSize: 32, padding: "0 8px",
          transform: "rotate(-15deg)",
        }}>⚔️</div>

        {/* Gegner */}
        <FighterPanel
          side="right"
          name={opponent.display_name ?? opponent.username ?? "Gegner"}
          emoji={opponent.archetype_emoji}
          level={opponent.level}
          hpPct={finalHpB}
          dmgDealt={dmgB}
          crits={critsB}
          winner={!won}
        />
      </div>

      {/* Beute-Box (nur bei Sieg) */}
      {settle && (
        <div style={{
          position: "relative", margin: "0 20px 16px",
          padding: 14, borderRadius: 12,
          background: `linear-gradient(135deg, ${rarityMeta.color}22 0%, transparent 70%)`,
          border: `1px solid ${rarityMeta.color}55`,
        }}>
          <div style={{ color: rarityMeta.color, fontSize: 10, fontWeight: 900, letterSpacing: 2, marginBottom: 8 }}>
            💰 ENTWICKLUNG
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <RewardTile icon="⚡" label="XP" value={`+${settle.xp.toLocaleString("de-DE")}`} color="#FFD700" />
            <RewardTile icon="🔖" label={`${settle.siegel_type}-Siegel`} value="+1" color={rarityMeta.color} />
            {settle.item_id && (
              <div style={{ gridColumn: "1 / -1" }}>
                <RewardTile icon="🎁" label="Ausrüstung erbeutet!" value="RARE+" color="#FFD700" />
              </div>
            )}
          </div>
        </div>
      )}

      <div style={{ position: "relative", padding: "0 20px 20px" }}>
        <button onClick={onClose} style={{
          display: "block", width: "100%", padding: "14px 16px",
          borderRadius: 10,
          background: "linear-gradient(180deg, #22D1C3 0%, #0f8178 100%)",
          color: "#0F1115", fontSize: 14, fontWeight: 900, letterSpacing: 1.5,
          border: "none", cursor: "pointer",
          boxShadow: "inset 0 1px 0 rgba(255,255,255,0.3), inset 0 -2px 4px rgba(0,0,0,0.2)",
        }}>
          WEITER KÄMPFEN →
        </button>
      </div>

      <style>{`
        @keyframes victoryPop {
          0%   { transform: scale(0.3) rotate(-8deg); opacity: 0; }
          60%  { transform: scale(1.2) rotate(4deg); }
          100% { transform: scale(1)   rotate(0);    opacity: 1; }
        }
      `}</style>
    </div>
  );
}

function FighterPanel({ side, name, emoji, level, hpPct, dmgDealt, crits, winner }: {
  side: "left" | "right";
  name: string;
  emoji: string;
  level: number;
  hpPct: number;
  dmgDealt: number;
  crits: number;
  winner: boolean;
}) {
  const color = winner ? "#4ade80" : "#FF2D78";
  return (
    <div style={{
      position: "relative", padding: 10,
      borderRadius: 12,
      background: winner ? `${color}08` : "rgba(255,45,120,0.04)",
      border: `1px solid ${color}44`,
      textAlign: side === "left" ? "left" : "right",
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, flexDirection: side === "right" ? "row-reverse" : "row" }}>
        <div style={{
          width: 56, height: 56, borderRadius: 10,
          background: `radial-gradient(circle, ${color}22 0%, #0F1115 80%)`,
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 36, flexShrink: 0,
          border: `1px solid ${color}66`,
        }}>{emoji}</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ color: "#FFF", fontSize: 13, fontWeight: 900, lineHeight: 1.1 }}>{name}</div>
          <div style={{ color: "#a8b4cf", fontSize: 10 }}>Stufe {level}</div>
        </div>
      </div>

      {/* HP-Bar */}
      <div style={{ marginTop: 8 }}>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 9, color: "#a8b4cf", marginBottom: 2 }}>
          <span>HP</span>
          <span style={{ color: hpPct > 50 ? "#4ade80" : hpPct > 20 ? "#FFD700" : "#FF2D78", fontWeight: 900 }}>
            {Math.round(hpPct)}%
          </span>
        </div>
        <div style={{ height: 8, borderRadius: 4, background: "rgba(0,0,0,0.5)", overflow: "hidden", border: "1px solid rgba(255,255,255,0.1)" }}>
          <div style={{
            height: "100%",
            width: `${Math.max(0, Math.min(100, hpPct))}%`,
            background: hpPct > 50 ? "linear-gradient(90deg, #4ade80, #22c55e)" : hpPct > 20 ? "linear-gradient(90deg, #FFD700, #f59e0b)" : "linear-gradient(90deg, #FF2D78, #dc2626)",
            transition: "width 0.8s ease",
          }} />
        </div>
      </div>

      {/* Damage-Stats */}
      <div style={{ marginTop: 8, fontSize: 10, color: "#a8b4cf" }}>
        <div style={{ display: "flex", justifyContent: "space-between" }}>
          <span>Schaden</span>
          <span style={{ color: "#FF6B4A", fontWeight: 900 }}>{dmgDealt.toLocaleString("de-DE")}</span>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", marginTop: 2 }}>
          <span>Krit-Treffer</span>
          <span style={{ color: "#FFD700", fontWeight: 900 }}>{crits}</span>
        </div>
      </div>
    </div>
  );
}


function RewardTile({ icon, label, value, color }: { icon: string; label: string; value: string; color: string }) {
  return (
    <div style={{
      padding: "8px 10px", borderRadius: 8,
      background: "rgba(0,0,0,0.3)", border: `1px solid ${color}33`,
      display: "flex", alignItems: "center", gap: 8,
    }}>
      <span style={{ fontSize: 22 }}>{icon}</span>
      <div style={{ flex: 1 }}>
        <div style={{ color: "#a8b4cf", fontSize: 9, letterSpacing: 0.5 }}>{label}</div>
        <div style={{ color, fontSize: 15, fontWeight: 900 }}>{value}</div>
      </div>
    </div>
  );
}

/* ═══ Season Picker (Saison-Wächter wählen) ═══ */
type Archetype = { id: string; name: string; emoji: string; rarity: string; guardian_type: string | null; role: string | null; ability_name: string; ability_desc: string };

const DEMO_ARCHETYPES: Archetype[] = [
  { id: "d1", name: "Nyx die Schattenklinge", emoji: "🗡️", rarity: "legendary", guardian_type: "cavalry",  role: "Assassin",  ability_name: "Schattenstoß",  ability_desc: "Erster Angriff trifft doppelt." },
  { id: "d2", name: "Titan der Unbezwingbare", emoji: "🛡️", rarity: "epic",      guardian_type: "infantry", role: "Tank",      ability_name: "Mauer",          ability_desc: "Halbiert erlittenen Schaden in Runde 1." },
  { id: "d3", name: "Zephyr der Schütze",     emoji: "🏹", rarity: "epic",      guardian_type: "marksman", role: "Sniper",    ability_name: "Durchschuss",    ability_desc: "Ignoriert 30% der gegnerischen Verteidigung." },
  { id: "d4", name: "Ember die Flamme",       emoji: "🔥", rarity: "legendary", guardian_type: "mage",     role: "Burst",     ability_name: "Feuersbrunst",   ability_desc: "Brennt den Gegner über 3 Runden." },
  { id: "d5", name: "Kael der Wachhund",      emoji: "🐺", rarity: "elite",     guardian_type: "infantry", role: "Bruiser",   ability_name: "Bissfest",       ability_desc: "Heilt pro Treffer 8% HP." },
  { id: "d6", name: "Shade die Listige",      emoji: "🌙", rarity: "elite",     guardian_type: "cavalry",  role: "Duelist",   ability_name: "Ausweichen",     ability_desc: "25% Chance Angriff zu kontern." },
];

function SeasonPicker({ season, eternal, onPicked, onClose, demoMode }: {
  season: { id: string; number: number; name: string; ends_at: string };
  eternal: { id: string; guardian_archetypes: { name: string; emoji: string } } | null;
  onPicked: () => void;
  onClose?: () => void;
  demoMode?: boolean;
}) {
  const [archetypes, setArchetypes] = useState<Archetype[] | null>(null);
  const [pickingId, setPickingId] = useState<string | null>(null);
  const [showExplainer, setShowExplainer] = useState(false);

  useEffect(() => {
    if (demoMode) { setArchetypes(DEMO_ARCHETYPES); return; }
    void fetch("/api/arena/season/pick", { cache: "no-store" })
      .then((r) => r.json())
      .then((j) => setArchetypes(j.archetypes ?? []));
  }, [demoMode]);

  async function pick(archetypeId: string) {
    if (demoMode) {
      const a = DEMO_ARCHETYPES.find((x) => x.id === archetypeId);
      alert(`🎬 Demo: „${a?.name}" wäre jetzt dein Saison-Wächter (Level 1).\nDein Ewiger Wächter bleibt unberührt, erbt aber alle Items die du diese Saison looten würdest.`);
      onPicked();
      return;
    }
    if (!confirm("Diesen Wächter für die gesamte Saison einsetzen? Er startet bei Level 1.")) return;
    setPickingId(archetypeId);
    const res = await fetch("/api/arena/season/pick", {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ archetype_id: archetypeId }),
    });
    const j = await res.json() as { ok: boolean; error?: string };
    if (!j.ok) { alert(j.error ?? "Fehler"); setPickingId(null); return; }
    onPicked();
  }

  const daysLeft = Math.max(0, Math.ceil((new Date(season.ends_at).getTime() - Date.now()) / 86_400_000));

  return (
    <div style={{
      padding: 20, borderRadius: 16,
      background: "radial-gradient(ellipse at top, rgba(255,215,0,0.14) 0%, transparent 60%), linear-gradient(180deg, #1a0e14 0%, #0a0a0f 100%)",
      border: "1px solid rgba(255,215,0,0.4)",
      boxShadow: "0 10px 40px rgba(0,0,0,0.5), 0 0 40px rgba(255,215,0,0.15)",
    }}>
      {onClose && (
        <button onClick={onClose} style={{
          position: "absolute", top: 20, right: 20,
          background: "rgba(255,255,255,0.05)", border: "none", color: "#a8b4cf",
          width: 34, height: 34, borderRadius: 999, cursor: "pointer", fontSize: 18,
        }}>✕</button>
      )}

      <div style={{ textAlign: "center", marginBottom: 20 }}>
        {demoMode && (
          <div style={{
            display: "inline-block", padding: "3px 10px", borderRadius: 999,
            background: "rgba(168,85,247,0.2)", border: "1px solid rgba(168,85,247,0.5)",
            color: "#c084fc", fontSize: 10, fontWeight: 900, letterSpacing: 2, marginBottom: 8,
          }}>🎬 DEMO-MODUS</div>
        )}
        <div style={{ color: "#FFD700", fontSize: 11, fontWeight: 900, letterSpacing: 3 }}>
          SAISON {season.number} · {season.name.toUpperCase()}
        </div>
        <div style={{ color: "#FFF", fontSize: 22, fontWeight: 900, marginTop: 4 }}>
          ⚔️ Wähle deinen Saison-Wächter
        </div>
        <div style={{ color: "#a8b4cf", fontSize: 12, marginTop: 6, maxWidth: 540, margin: "6px auto 0" }}>
          Dein <b style={{ color: "#22D1C3" }}>Saison-Wächter</b> kämpft in dieser Saison und startet bei Level 1.
          Dein <b style={{ color: "#FFD700" }}>Ewiger Wächter</b> bleibt unberührt und erbt die Items.
          Noch <b>{daysLeft} Tage</b>.
        </div>
        <button
          onClick={() => setShowExplainer((v) => !v)}
          style={{
            marginTop: 10, padding: "5px 12px", borderRadius: 999,
            background: "rgba(34,209,195,0.08)", border: "1px solid rgba(34,209,195,0.35)",
            color: "#22D1C3", fontSize: 11, fontWeight: 800, cursor: "pointer",
          }}
        >{showExplainer ? "Weniger anzeigen" : "❓ Wie funktioniert das genau?"}</button>
      </div>

      {showExplainer && <GuardianExplainer />}

      {eternal && (
        <div style={{
          margin: "0 auto 16px", maxWidth: 420, padding: "10px 14px", borderRadius: 10,
          background: "rgba(255,215,0,0.08)", border: "1px solid rgba(255,215,0,0.3)",
          display: "flex", alignItems: "center", gap: 10,
        }}>
          <div style={{ fontSize: 26 }}>{eternal.guardian_archetypes.emoji}</div>
          <div style={{ flex: 1 }}>
            <div style={{ color: "#FFD700", fontSize: 9, fontWeight: 900, letterSpacing: 1.5 }}>EWIGER WÄCHTER</div>
            <div style={{ color: "#FFF", fontSize: 13, fontWeight: 700 }}>{eternal.guardian_archetypes.name}</div>
          </div>
          <span style={{ color: "#a8b4cf", fontSize: 10 }}>erbt die Beute</span>
        </div>
      )}

      {!archetypes ? (
        <div className="p-10 text-center text-[#8B8FA3]">Lade Wächter …</div>
      ) : archetypes.length === 0 ? (
        <div className="p-8 text-center text-[#8B8FA3] text-sm">
          Keine Wächter verfügbar. Sammle zuerst Wächter über die Map.
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: 10 }}>
          {archetypes.map((a) => {
            const rarityColor = a.rarity === "legendary" ? "#FFD700" : a.rarity === "epic" ? "#a855f7" : "#22D1C3";
            const busy = pickingId === a.id;
            return (
              <button key={a.id} onClick={() => pick(a.id)} disabled={!!pickingId}
                style={{
                  padding: 12, borderRadius: 12, textAlign: "left", cursor: pickingId ? "wait" : "pointer",
                  background: `radial-gradient(circle at 50% 0%, ${rarityColor}22 0%, transparent 70%), rgba(15,17,21,0.8)`,
                  border: `1.5px solid ${rarityColor}66`,
                  opacity: pickingId && !busy ? 0.4 : 1,
                }}>
                <div style={{ textAlign: "center", fontSize: 48, filter: `drop-shadow(0 4px 8px ${rarityColor}66)` }}>
                  {a.emoji}
                </div>
                <div style={{ color: rarityColor, fontSize: 9, fontWeight: 900, letterSpacing: 1.5, marginTop: 4, textAlign: "center" }}>
                  {a.rarity === "legendary" ? "LEGENDÄR" : a.rarity === "epic" ? "EPISCH" : "ELITE"}
                </div>
                <div style={{ color: "#FFF", fontSize: 13, fontWeight: 900, marginTop: 2, textAlign: "center" }}>
                  {a.name}
                </div>
                <div style={{ color: "#a8b4cf", fontSize: 10, marginTop: 6, textAlign: "center", fontStyle: "italic", lineHeight: 1.3 }}>
                  „{a.ability_name}"
                </div>
                <div style={{
                  marginTop: 8, padding: "6px 8px", borderRadius: 6, textAlign: "center",
                  background: busy ? "#8B8FA3" : `linear-gradient(180deg, ${rarityColor} 0%, ${rarityColor}aa 100%)`,
                  color: "#0F1115", fontSize: 10, fontWeight: 900, letterSpacing: 1.2,
                }}>
                  {busy ? "WIRD GEWÄHLT…" : "⚔️ WÄHLEN"}
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ═══ Erklär-Komponenten: „Warum 2 Wächter?" ═══ */

function GuardianExplainerButton() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        onClick={() => setOpen(true)}
        style={{
          padding: "6px 12px", borderRadius: 999, fontSize: 11, fontWeight: 800, cursor: "pointer",
          background: "rgba(34,209,195,0.08)", border: "1px solid rgba(34,209,195,0.35)", color: "#22D1C3",
        }}
      >❓ Warum 2 Wächter?</button>
      {open && (
        <div
          onClick={() => setOpen(false)}
          style={{
            position: "fixed", inset: 0, zIndex: 9999,
            background: "rgba(0,0,0,0.75)", backdropFilter: "blur(6px)",
            display: "flex", alignItems: "center", justifyContent: "center", padding: 16,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              maxWidth: 560, width: "100%", maxHeight: "90vh", overflowY: "auto",
              background: "linear-gradient(180deg, #1a0e14 0%, #0a0a0f 100%)",
              border: "1px solid rgba(255,215,0,0.4)", borderRadius: 16, padding: 20,
              boxShadow: "0 20px 60px rgba(0,0,0,0.7)",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
              <div style={{ color: "#FFF", fontSize: 18, fontWeight: 900 }}>🛡️⚔️ Die zwei Wächter</div>
              <button onClick={() => setOpen(false)} style={{
                background: "rgba(255,255,255,0.05)", border: "none", color: "#a8b4cf",
                width: 30, height: 30, borderRadius: 999, cursor: "pointer", fontSize: 16,
              }}>✕</button>
            </div>
            <GuardianExplainer />
          </div>
        </div>
      )}
    </>
  );
}

function GuardianExplainer() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14, margin: "0 auto 18px", maxWidth: 540 }}>
      <div style={{
        padding: 14, borderRadius: 12,
        background: "rgba(34,209,195,0.06)", border: "1px solid rgba(34,209,195,0.25)",
      }}>
        <div style={{ fontSize: 11, fontWeight: 900, letterSpacing: 2, color: "#22D1C3", marginBottom: 6 }}>WARUM ÜBERHAUPT ZWEI?</div>
        <div style={{ fontSize: 13, color: "#dde3f5", lineHeight: 1.55 }}>
          In jeder <b>Arena-Saison</b> (ca. 90 Tage) starten alle Runner mit einem frischen
          Saison-Wächter auf Level 1. Das sorgt für faire Kämpfe — niemand wird von Level-200-Veteranen
          überrannt. Gleichzeitig <b>bleibt deine Sammlung erhalten</b>: dein Ewiger Wächter und alle
          deine Items gehen nie verloren.
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        <div style={{
          padding: 12, borderRadius: 12,
          background: "rgba(255,215,0,0.06)", border: "1px solid rgba(255,215,0,0.3)",
        }}>
          <div style={{ fontSize: 22, marginBottom: 4 }}>🛡️</div>
          <div style={{ fontSize: 10, fontWeight: 900, letterSpacing: 1.5, color: "#FFD700" }}>EWIGER WÄCHTER</div>
          <div style={{ fontSize: 12, color: "#dde3f5", marginTop: 4, lineHeight: 1.5 }}>
            Dein <b>Haupt-Wächter</b>. Bleibt saisonübergreifend. Sammelt automatisch
            <b style={{ color: "#FFD700" }}> alle Items</b>, die du während der Saison loots.
            Wird <b>stärker</b> mit jeder Saison.
          </div>
        </div>

        <div style={{
          padding: 12, borderRadius: 12,
          background: "rgba(34,209,195,0.06)", border: "1px solid rgba(34,209,195,0.3)",
        }}>
          <div style={{ fontSize: 22, marginBottom: 4 }}>⚔️</div>
          <div style={{ fontSize: 10, fontWeight: 900, letterSpacing: 1.5, color: "#22D1C3" }}>SAISON-WÄCHTER</div>
          <div style={{ fontSize: 12, color: "#dde3f5", marginTop: 4, lineHeight: 1.5 }}>
            Dein <b>Kampf-Wächter</b> für diese Saison. Startet bei <b>Level 1</b>.
            Alle seine Siege bringen dir <b>Saison-Prestige</b>. Wird am Saisonende
            <b> archiviert</b> — nicht gelöscht.
          </div>
        </div>
      </div>

      <div style={{
        padding: 14, borderRadius: 12,
        background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)",
      }}>
        <div style={{ fontSize: 11, fontWeight: 900, letterSpacing: 2, color: "#FFD700", marginBottom: 8 }}>SO FUNKTIONIERT&apos;S</div>
        <Step num="1" title="Saison startet">
          Du wählst aus deiner Wächter-Sammlung einen für diese Saison. Er startet bei Level 1.
        </Step>
        <Step num="2" title="Du kämpfst & lootest">
          Jeder Sieg gibt deinem Saison-Wächter XP. Alle Items, Siegel und Drops wandern
          automatisch in das Inventar deines <b style={{ color: "#FFD700" }}>Ewigen Wächters</b>.
        </Step>
        <Step num="3" title="Saison endet">
          Dein Saison-Wächter wird ins Archiv gelegt (du kannst ihn später ansehen).
          Dein Ewiger Wächter bekommt Prestige-Punkte — dauerhafte Bonus-Stats.
        </Step>
        <Step num="4" title="Neue Saison, gleiches Ritual" last>
          Du wählst erneut. Aus deiner Sammlung — vielleicht diesmal ein anderer Typ,
          um das Meta zu kontern.
        </Step>
      </div>

      <div style={{
        padding: 10, borderRadius: 10,
        background: "rgba(168,85,247,0.06)", border: "1px solid rgba(168,85,247,0.25)",
        color: "#c084fc", fontSize: 11, lineHeight: 1.5,
      }}>
        💡 <b>Wichtig:</b> Items bleiben IMMER bei dir. Der Saison-Reset betrifft nur Level, Talente
        und Ausrüstungs-Slots deines Saison-Wächters — nie dein Inventar.
      </div>
    </div>
  );
}

function Step({ num, title, children, last }: { num: string; title: string; children: React.ReactNode; last?: boolean }) {
  return (
    <div style={{
      display: "flex", gap: 10, paddingBottom: last ? 0 : 10,
      borderBottom: last ? "none" : "1px solid rgba(255,255,255,0.05)",
      marginBottom: last ? 0 : 10,
    }}>
      <div style={{
        flexShrink: 0, width: 24, height: 24, borderRadius: 999,
        background: "linear-gradient(135deg, #22D1C3, #FFD700)",
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: 12, fontWeight: 900, color: "#0F1115",
      }}>{num}</div>
      <div style={{ flex: 1 }}>
        <div style={{ color: "#FFF", fontSize: 13, fontWeight: 800, marginBottom: 2 }}>{title}</div>
        <div style={{ color: "#a8b4cf", fontSize: 12, lineHeight: 1.5 }}>{children}</div>
      </div>
    </div>
  );
}
