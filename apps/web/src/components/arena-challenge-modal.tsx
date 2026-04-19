"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { RoundEvent } from "@/lib/battle-engine";
import type { GuardianWithArchetype, GuardianArchetype } from "@/lib/guardian";
import { GuardianCard } from "@/components/guardian-card";
import { CinematicBattleArena } from "@/components/battle-arena";
import { RARITY_META, statsAtLevel } from "@/lib/guardian";

type EligibleRunner = {
  user_id: string;
  display_name: string;
  username: string | null;
  crew_name: string | null;
  guardian: GuardianWithArchetype | null;
};

type BattleResponse = {
  battle_id: string;
  winner: "A" | "B" | "draw";
  winner_user_id: string | null;
  rounds: RoundEvent[];
  xp_awarded: number;
  final_hp_a: number;
  final_hp_b: number;
  fusion: { kind: "fusion" | "trophy"; description: string } | null;
};

export function ArenaChallengeModal({ businessId, businessName, onClose }: {
  businessId: string;
  businessName: string;
  onClose: () => void;
}) {
  const sb = createClient();
  const [phase, setPhase] = useState<"pick" | "fighting" | "result">("pick");
  const [eligible, setEligible] = useState<EligibleRunner[]>([]);
  const [myGuardian, setMyGuardian] = useState<GuardianWithArchetype | null>(null);
  const [myUserId, setMyUserId] = useState<string | null>(null);
  const [picked, setPicked] = useState<EligibleRunner | null>(null);
  const [battle, setBattle] = useState<BattleResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await sb.auth.getUser();
      if (!user) { setError("Nicht eingeloggt"); setLoading(false); return; }
      setMyUserId(user.id);

      // Mein Waechter
      const { data: g } = await sb.from("user_guardians")
        .select("id, user_id, crew_id, archetype_id, custom_name, level, xp, wins, losses, current_hp_pct, wounded_until, is_active, acquired_at, source")
        .eq("user_id", user.id).eq("is_active", true).maybeSingle();
      if (g) {
        const { data: arch } = await sb.from("guardian_archetypes").select("*").eq("id", g.archetype_id).single<GuardianArchetype>();
        if (arch) setMyGuardian({ ...(g as Omit<GuardianWithArchetype, "archetype">), archetype: arch });
      }

      // Eligible Runner: alle User deren Crew in 7T einen Deal eingelöst hat
      const since = new Date(Date.now() - 3 * 86400000).toISOString();
      const { data: reds } = await sb.from("deal_redemptions")
        .select("user_id")
        .eq("business_id", businessId)
        .eq("status", "verified")
        .gte("verified_at", since);
      if (!reds || reds.length === 0) { setLoading(false); return; }

      // Alle User deren current_crew_id einer eligible-Crew entspricht
      const userIds = Array.from(new Set(reds.map((r: { user_id: string }) => r.user_id)));
      const { data: redeemingUsers } = await sb.from("users").select("current_crew_id").in("id", userIds);
      const eligibleCrews = new Set((redeemingUsers ?? []).map((u: { current_crew_id: string | null }) => u.current_crew_id).filter((c): c is string => !!c));
      if (eligibleCrews.size === 0) { setLoading(false); return; }

      const { data: runners } = await sb.from("users")
        .select("id, display_name, username, current_crew_id")
        .in("current_crew_id", Array.from(eligibleCrews))
        .neq("id", user.id);
      if (!runners || runners.length === 0) { setLoading(false); return; }

      const runnerIds = runners.map((r: { id: string }) => r.id);
      const crewIds = Array.from(new Set(runners.map((r: { current_crew_id: string | null }) => r.current_crew_id).filter((c): c is string => !!c)));

      const [guardsRes, crewsRes] = await Promise.all([
        sb.from("user_guardians")
          .select("id, user_id, crew_id, archetype_id, custom_name, level, xp, wins, losses, current_hp_pct, wounded_until, is_active, acquired_at, source")
          .in("user_id", runnerIds).eq("is_active", true),
        crewIds.length > 0 ? sb.from("crews").select("id, name").in("id", crewIds) : Promise.resolve({ data: [] }),
      ]);
      const archIds = Array.from(new Set((guardsRes.data ?? []).map((x: { archetype_id: string }) => x.archetype_id)));
      const { data: archs } = archIds.length > 0 ? await sb.from("guardian_archetypes").select("*").in("id", archIds).returns<GuardianArchetype[]>() : { data: [] };
      const archMap = new Map((archs ?? []).map((a) => [a.id, a]));
      const crewMap = new Map((crewsRes.data ?? []).map((c: { id: string; name: string }) => [c.id, c.name]));
      const guardByUser = new Map((guardsRes.data ?? []).map((gr) => [(gr as { user_id: string }).user_id, gr]));

      const runnersWithGuards: EligibleRunner[] = runners.map((r: { id: string; display_name: string | null; username: string | null; current_crew_id: string | null }) => {
        const gr = guardByUser.get(r.id);
        const arch = gr ? archMap.get((gr as { archetype_id: string }).archetype_id) : undefined;
        return {
          user_id: r.id,
          display_name: r.display_name ?? r.username ?? "Runner",
          username: r.username,
          crew_name: r.current_crew_id ? (crewMap.get(r.current_crew_id) ?? null) : null,
          guardian: gr && arch ? { ...(gr as Omit<GuardianWithArchetype, "archetype">), archetype: arch } : null,
        };
      });
      setEligible(runnersWithGuards);
      setLoading(false);
    })();
  }, [sb, businessId]);

  async function launchBattle(target: EligibleRunner) {
    if (!myGuardian) return;
    setPicked(target);
    setPhase("fighting");
    setError(null);
    try {
      // Current position for arena proximity check
      const pos = await new Promise<GeolocationPosition | null>((resolve) => {
        if (!navigator.geolocation) return resolve(null);
        navigator.geolocation.getCurrentPosition(
          (p) => resolve(p),
          () => resolve(null),
          { enableHighAccuracy: true, timeout: 6000, maximumAge: 30000 },
        );
      });
      if (!pos) {
        setError("GPS-Position wird benötigt für die Arena. Bitte Standort erlauben.");
        setPhase("pick");
        return;
      }
      const res = await fetch("/api/arena/challenge", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          business_id: businessId,
          defender_user_id: target.user_id,
          attacker_lat: pos.coords.latitude,
          attacker_lng: pos.coords.longitude,
        }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({ error: res.status }));
        setError(`${j.error ?? "Kampf fehlgeschlagen"}${j.detail ? ` — ${j.detail}` : ""}`);
        setPhase("pick");
        return;
      }
      setBattle(await res.json() as BattleResponse);
    } catch (e) {
      setError(String(e)); setPhase("pick");
    }
  }

  const aMaxHp = myGuardian ? statsAtLevel(myGuardian.archetype, myGuardian.level).hp : 100;
  const bMaxHp = picked?.guardian ? statsAtLevel(picked.guardian.archetype, picked.guardian.level).hp : 100;

  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 3500, background: "rgba(15,17,21,0.92)", backdropFilter: "blur(12px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: "100%", maxWidth: 520, maxHeight: "90vh", overflowY: "auto", background: "#1A1D23", borderRadius: 20, padding: 20, border: "1px solid rgba(168,85,247,0.5)", boxShadow: "0 0 40px rgba(168,85,247,0.3)", color: "#F0F0F0" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
          <span style={{ fontSize: 26 }}>⚔️</span>
          <div style={{ flex: 1 }}>
            <div style={{ color: "#FFF", fontSize: 18, fontWeight: 900 }}>Arena · {businessName}</div>
            <div style={{ color: "#a855f7", fontSize: 11, fontWeight: 800, letterSpacing: 1 }}>RUNNER VS RUNNER</div>
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
              <div style={{ color: "#a8b4cf", padding: 20, textAlign: "center" }}>Du hast keinen aktiven Wächter.</div>
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
                    Keine Runner aus eligible Crews. Warte bis mehr Mitglieder hier einlösen!
                  </div>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    {eligible.map((r) => (
                      <div key={r.user_id} style={{ display: "flex", alignItems: "center", gap: 10, padding: 10, borderRadius: 10, background: "rgba(70,82,122,0.35)" }}>
                        <span style={{ fontSize: 28 }}>{r.guardian?.archetype.emoji ?? "❓"}</span>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ color: "#FFF", fontSize: 13, fontWeight: 900, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{r.display_name}</div>
                          <div style={{ color: RARITY_META[r.guardian?.archetype.rarity ?? "common"].color, fontSize: 10, fontWeight: 700 }}>
                            {r.guardian ? `${r.guardian.archetype.name} · Lv ${r.guardian.level}` : "Kein Wächter"}
                            {r.crew_name && <span style={{ color: "#8B8FA3", marginLeft: 6 }}>· {r.crew_name}</span>}
                          </div>
                        </div>
                        <button
                          onClick={() => launchBattle(r)}
                          disabled={!r.guardian || r.user_id === myUserId}
                          style={{
                            padding: "8px 14px", borderRadius: 8,
                            background: r.guardian ? "linear-gradient(135deg, #a855f7, #FF2D78)" : "rgba(139,143,163,0.2)",
                            border: "none", color: r.guardian ? "#FFF" : "#8B8FA3",
                            fontSize: 11, fontWeight: 900, cursor: r.guardian ? "pointer" : "not-allowed",
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
        ) : phase === "fighting" && battle && myGuardian && picked?.guardian ? (
          <CinematicBattleArena
            sideA={{ name: myGuardian.archetype.name, archetype: myGuardian.archetype, level: myGuardian.level, maxHp: aMaxHp }}
            sideB={{ name: picked.guardian.archetype.name, archetype: picked.guardian.archetype, level: picked.guardian.level, maxHp: bMaxHp }}
            rounds={battle.rounds}
            onFinished={() => setPhase("result")}
          />
        ) : phase === "fighting" ? (
          <div style={{ padding: 40, textAlign: "center", color: "#a8b4cf" }}>Kampf wird vorbereitet…</div>
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
              {battle.fusion && (
                <div style={{ marginTop: 10, padding: 10, borderRadius: 10, background: "rgba(255,215,0,0.15)", border: "1px solid rgba(255,215,0,0.5)", color: "#FFD700", fontSize: 12, fontWeight: 800 }}>
                  {battle.fusion.kind === "fusion" ? "⚡ " : "🏆 "}{battle.fusion.description}
                </div>
              )}
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
