"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { RoundEvent } from "@/lib/battle-engine";
import type { GuardianWithArchetype, GuardianArchetype } from "@/lib/guardian";
import { GuardianCard } from "@/components/guardian-card";
import { RARITY_META, statsAtLevel } from "@/lib/guardian";

type EligibleCrew = { id: string; name: string; guardian: GuardianWithArchetype | null };

type BattleResponse = {
  battle_id: string;
  winner: "A" | "B" | "draw";
  winner_crew_id: string | null;
  rounds: RoundEvent[];
  xp_awarded: number;
  final_hp_a: number;
  final_hp_b: number;
};

export function ArenaChallengeModal({ businessId, businessName, onClose }: {
  businessId: string;
  businessName: string;
  onClose: () => void;
}) {
  const sb = createClient();
  const [phase, setPhase] = useState<"pick" | "fighting" | "result">("pick");
  const [eligible, setEligible] = useState<EligibleCrew[]>([]);
  const [myGuardian, setMyGuardian] = useState<GuardianWithArchetype | null>(null);
  const [picked, setPicked] = useState<EligibleCrew | null>(null);
  const [battle, setBattle] = useState<BattleResponse | null>(null);
  const [replayIdx, setReplayIdx] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await sb.auth.getUser();
      if (!user) { setError("Nicht eingeloggt"); setLoading(false); return; }
      const { data: prof } = await sb.from("users").select("current_crew_id").eq("id", user.id).maybeSingle<{ current_crew_id: string | null }>();
      const myCrewId = prof?.current_crew_id;
      if (!myCrewId) { setError("Du bist in keiner Crew"); setLoading(false); return; }

      // Mein Waechter
      const { data: g } = await sb.from("crew_guardians")
        .select("id, crew_id, archetype_id, custom_name, level, xp, wins, losses, current_hp_pct, wounded_until, is_active, acquired_at, source")
        .eq("crew_id", myCrewId).eq("is_active", true).maybeSingle();
      if (g) {
        const { data: arch } = await sb.from("guardian_archetypes").select("*").eq("id", g.archetype_id).single();
        setMyGuardian({ ...(g as Omit<GuardianWithArchetype, "archetype">), archetype: arch });
      }

      // Eligible Crews (die in den letzten 7d einen Deal bei diesem Shop hatten, außer meine)
      const since = new Date(Date.now() - 7 * 86400000).toISOString();
      const { data: reds } = await sb.from("deal_redemptions")
        .select("user_id")
        .eq("business_id", businessId)
        .eq("status", "verified")
        .gte("verified_at", since);
      if (reds && reds.length > 0) {
        const uids = Array.from(new Set(reds.map((r: { user_id: string }) => r.user_id)));
        const { data: users } = await sb.from("users").select("current_crew_id").in("id", uids);
        const crewIds = Array.from(new Set((users ?? []).map((u: { current_crew_id: string | null }) => u.current_crew_id).filter((c): c is string => !!c && c !== myCrewId)));
        if (crewIds.length > 0) {
          const { data: crews } = await sb.from("crews").select("id, name").in("id", crewIds);
          const { data: gs } = await sb.from("crew_guardians")
            .select("id, crew_id, archetype_id, custom_name, level, xp, wins, losses, current_hp_pct, wounded_until, is_active, acquired_at, source")
            .in("crew_id", crewIds).eq("is_active", true);
          const archIds = Array.from(new Set((gs ?? []).map((x: { archetype_id: string }) => x.archetype_id)));
          const { data: archs } = await sb.from("guardian_archetypes").select("*").in("id", archIds).returns<GuardianArchetype[]>();
          const archMap = new Map((archs ?? []).map((a) => [a.id, a]));
          setEligible((crews ?? []).map((c: { id: string; name: string }) => {
            const guard = (gs ?? []).find((x: { crew_id: string }) => x.crew_id === c.id);
            const arch = guard ? archMap.get(guard.archetype_id) : undefined;
            return {
              id: c.id, name: c.name,
              guardian: guard && arch ? { ...(guard as Omit<GuardianWithArchetype, "archetype">), archetype: arch } : null,
            };
          }));
        }
      }
      setLoading(false);
    })();
  }, [sb, businessId]);

  async function launchBattle(target: EligibleCrew) {
    if (!myGuardian) return;
    setPicked(target);
    setPhase("fighting");
    setReplayIdx(0);
    try {
      const res = await fetch("/api/arena/challenge", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ business_id: businessId, defender_crew_id: target.id }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({ error: res.status }));
        setError(j.error ?? "Kampf fehlgeschlagen");
        setPhase("pick");
        return;
      }
      const data = await res.json() as BattleResponse;
      setBattle(data);
      // Replay-Animation
      let i = 0;
      const interval = setInterval(() => {
        i++;
        setReplayIdx(i);
        if (i >= data.rounds.length) {
          clearInterval(interval);
          setTimeout(() => setPhase("result"), 1200);
        }
      }, 600);
    } catch (e) {
      setError(String(e)); setPhase("pick");
    }
  }

  const aMaxHp = myGuardian ? statsAtLevel(myGuardian.archetype, myGuardian.level).hp : 100;
  const bMaxHp = picked?.guardian ? statsAtLevel(picked.guardian.archetype, picked.guardian.level).hp : 100;
  const currentRound = battle?.rounds[Math.min(replayIdx, battle.rounds.length - 1)];
  const hpA = currentRound?.hp_a_after ?? (battle?.final_hp_a ?? aMaxHp);
  const hpB = currentRound?.hp_b_after ?? (battle?.final_hp_b ?? bMaxHp);

  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 3500, background: "rgba(15,17,21,0.92)", backdropFilter: "blur(12px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: "100%", maxWidth: 520, maxHeight: "90vh", overflowY: "auto", background: "#1A1D23", borderRadius: 20, padding: 20, border: "1px solid rgba(168,85,247,0.5)", boxShadow: "0 0 40px rgba(168,85,247,0.3)", color: "#F0F0F0" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
          <span style={{ fontSize: 26 }}>⚔️</span>
          <div style={{ flex: 1 }}>
            <div style={{ color: "#FFF", fontSize: 18, fontWeight: 900 }}>Arena · {businessName}</div>
            <div style={{ color: "#a855f7", fontSize: 11, fontWeight: 800, letterSpacing: 1 }}>CREW VS CREW</div>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", color: "#8B8FA3", fontSize: 22, cursor: "pointer" }}>×</button>
        </div>

        {error && (
          <div style={{ padding: 10, borderRadius: 10, background: "rgba(255,45,120,0.15)", border: "1px solid #FF2D78", color: "#FF2D78", fontSize: 12, marginBottom: 12 }}>
            {error}
          </div>
        )}

        {loading ? (
          <div style={{ padding: 40, textAlign: "center", color: "#8B8FA3" }}>Lade Gegner…</div>
        ) : phase === "pick" ? (
          <>
            {!myGuardian ? (
              <div style={{ color: "#a8b4cf", padding: 20, textAlign: "center" }}>Deine Crew hat keinen aktiven Wächter.</div>
            ) : (
              <>
                <div style={{ marginBottom: 14 }}>
                  <div style={{ color: "#a8b4cf", fontSize: 10, fontWeight: 900, letterSpacing: 1, marginBottom: 6 }}>DEIN WÄCHTER</div>
                  <GuardianCard guardian={myGuardian} compact />
                </div>
                <div style={{ color: "#a8b4cf", fontSize: 10, fontWeight: 900, letterSpacing: 1, marginBottom: 6 }}>
                  GEGNER ({eligible.length})
                </div>
                {eligible.length === 0 ? (
                  <div style={{ padding: 16, borderRadius: 10, background: "rgba(70,82,122,0.3)", color: "#a8b4cf", fontSize: 12, textAlign: "center" }}>
                    Keine Crew hat in den letzten 7 Tagen bei diesem Shop eingelöst. Lade Freunde ein!
                  </div>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    {eligible.map((c) => (
                      <div key={c.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: 10, borderRadius: 10, background: "rgba(70,82,122,0.35)" }}>
                        <span style={{ fontSize: 24 }}>{c.guardian?.archetype.emoji ?? "❓"}</span>
                        <div style={{ flex: 1 }}>
                          <div style={{ color: "#FFF", fontSize: 13, fontWeight: 900 }}>{c.name}</div>
                          <div style={{ color: RARITY_META[c.guardian?.archetype.rarity ?? "common"].color, fontSize: 10, fontWeight: 700 }}>
                            {c.guardian ? `${c.guardian.archetype.name} · Lv ${c.guardian.level}` : "Kein Wächter"}
                          </div>
                        </div>
                        <button
                          onClick={() => launchBattle(c)}
                          disabled={!c.guardian}
                          style={{
                            padding: "8px 14px", borderRadius: 8,
                            background: c.guardian ? "linear-gradient(135deg, #a855f7, #FF2D78)" : "rgba(139,143,163,0.2)",
                            border: "none", color: c.guardian ? "#FFF" : "#8B8FA3",
                            fontSize: 11, fontWeight: 900, cursor: c.guardian ? "pointer" : "not-allowed",
                          }}
                        >
                          ANGRIFF
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </>
        ) : phase === "fighting" ? (
          <div>
            <BattleArena
              nameA={myGuardian?.archetype.name ?? "?"} emojiA={myGuardian?.archetype.emoji ?? "❓"} hpA={hpA} maxHpA={aMaxHp}
              nameB={picked?.guardian?.archetype.name ?? "?"} emojiB={picked?.guardian?.archetype.emoji ?? "❓"} hpB={hpB} maxHpB={bMaxHp}
              currentEvent={currentRound}
            />
          </div>
        ) : battle ? (
          <div>
            <div style={{
              padding: 16, borderRadius: 14, textAlign: "center", marginBottom: 14,
              background: battle.winner === "A" ? "linear-gradient(135deg, rgba(74,222,128,0.3), rgba(34,209,195,0.15))" : battle.winner === "B" ? "linear-gradient(135deg, rgba(255,45,120,0.25), rgba(168,85,247,0.15))" : "rgba(139,143,163,0.2)",
              border: `2px solid ${battle.winner === "A" ? "#4ade80" : battle.winner === "B" ? "#FF2D78" : "#8B8FA3"}`,
            }}>
              <div style={{ fontSize: 36, marginBottom: 4 }}>
                {battle.winner === "A" ? "🏆" : battle.winner === "B" ? "💀" : "🤝"}
              </div>
              <div style={{ color: "#FFF", fontSize: 20, fontWeight: 900 }}>
                {battle.winner === "A" ? "SIEG!" : battle.winner === "B" ? "Niederlage" : "Unentschieden"}
              </div>
              <div style={{ color: "#FFD700", fontSize: 14, fontWeight: 800, marginTop: 4 }}>
                +{battle.xp_awarded} Wächter-XP
              </div>
            </div>
            <button onClick={onClose} style={{ width: "100%", padding: 14, borderRadius: 12, background: "#22D1C3", color: "#0F1115", border: "none", fontSize: 14, fontWeight: 900, cursor: "pointer" }}>
              Weiter
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function BattleArena({ nameA, emojiA, hpA, maxHpA, nameB, emojiB, hpB, maxHpB, currentEvent }: {
  nameA: string; emojiA: string; hpA: number; maxHpA: number;
  nameB: string; emojiB: string; hpB: number; maxHpB: number;
  currentEvent?: RoundEvent;
}) {
  const pctA = Math.max(0, Math.min(100, (hpA / maxHpA) * 100));
  const pctB = Math.max(0, Math.min(100, (hpB / maxHpB) * 100));
  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
        <span style={{ fontSize: 40 }}>{emojiA}</span>
        <div style={{ flex: 1 }}>
          <div style={{ color: "#FFF", fontSize: 13, fontWeight: 900 }}>{nameA}</div>
          <div style={{ height: 10, borderRadius: 5, background: "rgba(255,255,255,0.1)", overflow: "hidden", marginTop: 3 }}>
            <div style={{ width: `${pctA}%`, height: "100%", background: "linear-gradient(90deg, #4ade80, #22D1C3)", transition: "width 0.3s" }} />
          </div>
          <div style={{ color: "#a8b4cf", fontSize: 10, marginTop: 2 }}>{hpA} / {maxHpA} HP</div>
        </div>
      </div>

      <div style={{ textAlign: "center", color: "#a855f7", fontSize: 14, fontWeight: 900, margin: "14px 0", minHeight: 40, padding: 10, borderRadius: 10, background: "rgba(168,85,247,0.1)", border: "1px dashed rgba(168,85,247,0.4)" }}>
        {currentEvent ? (
          <>
            Runde {currentEvent.round} · {currentEvent.actor === "A" ? nameA : nameB}
            <div style={{ color: currentEvent.action === "crit" ? "#FFD700" : currentEvent.action === "miss" ? "#8B8FA3" : "#FFF", fontSize: 12, fontWeight: 700, marginTop: 2 }}>
              {currentEvent.action === "miss" ? "verfehlt" : currentEvent.action === "crit" ? `${currentEvent.damage} KRIT!` : currentEvent.action === "revive" ? currentEvent.note : `${currentEvent.damage} Schaden`}
              {currentEvent.note && currentEvent.action !== "revive" && ` · ${currentEvent.note}`}
            </div>
          </>
        ) : "Gleich geht's los…"}
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <span style={{ fontSize: 40 }}>{emojiB}</span>
        <div style={{ flex: 1 }}>
          <div style={{ color: "#FFF", fontSize: 13, fontWeight: 900 }}>{nameB}</div>
          <div style={{ height: 10, borderRadius: 5, background: "rgba(255,255,255,0.1)", overflow: "hidden", marginTop: 3 }}>
            <div style={{ width: `${pctB}%`, height: "100%", background: "linear-gradient(90deg, #FF2D78, #a855f7)", transition: "width 0.3s" }} />
          </div>
          <div style={{ color: "#a8b4cf", fontSize: 10, marginTop: 2 }}>{hpB} / {maxHpB} HP</div>
        </div>
      </div>
    </div>
  );
}
