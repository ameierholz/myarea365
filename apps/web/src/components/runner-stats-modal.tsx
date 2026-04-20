"use client";

import { useEffect, useState } from "react";
import { GuardianAvatar } from "@/components/guardian-avatar";
import {
  rarityMeta, TYPE_META, statsAtLevel,
  type GuardianArchetype,
} from "@/lib/guardian";

const PRIMARY = "#22D1C3";
const GOLD = "#FFD700";
const PINK = "#FF2D78";

type RunnerProfileData = {
  username: string | null;
  display_name: string | null;
  faction: string | null;
  team_color: string | null;
  supporter_tier: "bronze" | "silver" | "gold" | null;
  xp: number;
  level: number | null;
  total_distance_m: number;
  total_walks: number;
  total_calories: number;
  longest_run_m: number;
  territory_count: number;
  crew?: { name: string; color: string | null; role: string | null } | null;
  active_guardian?: {
    id: string; custom_name: string | null; level: number;
    xp: number; wins: number; losses: number;
    talent_points_available: number;
    archetype: GuardianArchetype;
  } | null;
  collection_size: number;
  collection_total: number;
};

export function RunnerStatsModal({ userId, onClose }: { userId: string; onClose: () => void }) {
  const [data, setData] = useState<RunnerProfileData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const res = await fetch(`/api/runner/profile/${userId}`);
      if (!res.ok) { setError("Profil konnte nicht geladen werden"); return; }
      setData(await res.json() as RunnerProfileData);
    })();
  }, [userId]);

  const rangeColor = data?.team_color ?? PRIMARY;
  const kmTotal = data ? (data.total_distance_m / 1000).toFixed(1) : "–";
  const longestKm = data ? (data.longest_run_m / 1000).toFixed(2) : "–";
  const wins = data?.active_guardian?.wins ?? 0;
  const losses = data?.active_guardian?.losses ?? 0;
  const winRate = wins + losses > 0 ? Math.round((wins / (wins + losses)) * 100) : 0;

  return (
    <div onClick={onClose} style={{
      position: "fixed", inset: 0, zIndex: 3800,
      background: "rgba(15,17,21,0.92)", backdropFilter: "blur(14px)",
      display: "flex", alignItems: "center", justifyContent: "center", padding: 12,
    }}>
      <div onClick={(e) => e.stopPropagation()} style={{
        width: "100%", maxWidth: 560, maxHeight: "92vh",
        display: "flex", flexDirection: "column",
        background: "linear-gradient(180deg, #1A1D23, #0F1115)",
        borderRadius: 20,
        border: `1px solid ${rangeColor}66`,
        boxShadow: `0 0 40px ${rangeColor}33`,
        color: "#F0F0F0", overflow: "hidden",
      }}>
        {error ? (
          <div style={{ padding: 30, textAlign: "center", color: "#FF2D78" }}>{error}</div>
        ) : !data ? (
          <div style={{ padding: 40, textAlign: "center", color: "#a8b4cf" }}>Lade Runner-Profil …</div>
        ) : (
          <>
            {/* Header-Band */}
            <div style={{
              padding: "18px 20px 14px", position: "relative",
              background: `linear-gradient(135deg, ${rangeColor}30, ${rangeColor}10, transparent)`,
              borderBottom: "1px solid rgba(255,255,255,0.08)",
            }}>
              <button onClick={onClose} style={{
                position: "absolute", top: 10, right: 10,
                background: "rgba(255,255,255,0.08)", border: "none",
                color: "#FFF", width: 30, height: 30, borderRadius: 999, cursor: "pointer", fontSize: 16,
              }}>×</button>
              <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                <div style={{
                  width: 64, height: 64, borderRadius: "50%",
                  background: `radial-gradient(circle at 30% 30%, ${rangeColor}cc, ${rangeColor}55)`,
                  border: `2px solid ${rangeColor}`,
                  boxShadow: `0 0 18px ${rangeColor}88, inset 0 0 10px rgba(0,0,0,0.25)`,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 30,
                }}>👣</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ color: rangeColor, fontSize: 9, fontWeight: 900, letterSpacing: 2 }}>
                    RUNNER
                    {data.supporter_tier && <span style={{ marginLeft: 6, color: "#FFD700" }}>★ {data.supporter_tier.toUpperCase()}</span>}
                  </div>
                  <div style={{ color: "#FFF", fontSize: 20, fontWeight: 900, lineHeight: 1.1 }}>
                    {data.display_name ?? data.username ?? "Runner"}
                  </div>
                  <div style={{ color: "#a8b4cf", fontSize: 11, marginTop: 2 }}>
                    @{data.username ?? "unknown"}
                    {data.level && <> · Lvl {data.level}</>}
                    {data.xp > 0 && <> · {data.xp.toLocaleString("de-DE")} XP</>}
                  </div>
                </div>
              </div>
            </div>

            <div style={{ flex: 1, overflowY: "auto", padding: 14, display: "flex", flexDirection: "column", gap: 12 }}>
              {/* Crew */}
              {data.crew && (
                <Card title="CREW" color={data.crew.color ?? PRIMARY}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <div style={{
                      width: 36, height: 36, borderRadius: 10,
                      background: data.crew.color ?? PRIMARY,
                      boxShadow: `0 0 10px ${data.crew.color ?? PRIMARY}99`,
                      display: "flex", alignItems: "center", justifyContent: "center",
                      fontSize: 18,
                    }}>🏴</div>
                    <div style={{ flex: 1 }}>
                      <div style={{ color: "#FFF", fontSize: 14, fontWeight: 900 }}>{data.crew.name}</div>
                      {data.crew.role && <div style={{ color: "#a8b4cf", fontSize: 10 }}>Rolle: {data.crew.role}</div>}
                    </div>
                  </div>
                </Card>
              )}

              {/* Aktiver Wächter */}
              {data.active_guardian && (
                <Card title="AKTIVER WÄCHTER" color={rarityMeta(data.active_guardian.archetype.rarity).color}>
                  {(() => {
                    const g = data.active_guardian!;
                    const r = rarityMeta(g.archetype.rarity);
                    const typ = g.archetype.guardian_type ? TYPE_META[g.archetype.guardian_type] : null;
                    const s = statsAtLevel(g.archetype, g.level);
                    return (
                      <>
                        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                          <div style={{ width: 72, height: 90, flexShrink: 0 }}>
                            <GuardianAvatar archetype={g.archetype} size={72} animation="idle" />
                          </div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ color: r.color, fontSize: 9, fontWeight: 900, letterSpacing: 1.5 }}>
                              {r.label.toUpperCase()}{typ ? ` · ${typ.icon} ${typ.label.toUpperCase()}` : ""}
                            </div>
                            <div style={{ color: "#FFF", fontSize: 14, fontWeight: 900 }}>
                              {g.custom_name ?? g.archetype.name}
                            </div>
                            <div style={{ color: "#a8b4cf", fontSize: 10 }}>
                              Lvl {g.level} · {wins}W / {losses}L
                              {g.talent_points_available > 0 && <span style={{ color: GOLD, marginLeft: 6, fontWeight: 900 }}>+{g.talent_points_available} Talent</span>}
                            </div>
                          </div>
                        </div>
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 4, marginTop: 10 }}>
                          <Stat label="HP"  value={s.hp}  color="#4ade80" />
                          <Stat label="ATK" value={s.atk} color="#FF6B4A" />
                          <Stat label="DEF" value={s.def} color="#5ddaf0" />
                          <Stat label="SPD" value={s.spd} color={GOLD} />
                        </div>
                      </>
                    );
                  })()}
                </Card>
              )}

              {/* Kampf-Statistik */}
              <Card title="KAMPF-STATISTIK" color={PINK}>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 6 }}>
                  <Stat label="SIEGE"       value={wins}      color="#4ade80" />
                  <Stat label="NIEDERLAGEN" value={losses}    color={PINK} />
                  <Stat label="WIN-RATE"    value={`${winRate}%`} color={GOLD} />
                </div>
              </Card>

              {/* Walking-Statistik */}
              <Card title="WALKING-STATISTIK" color={PRIMARY}>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
                  <Stat label="GELAUFEN"       value={`${kmTotal} km`}           color={PRIMARY} />
                  <Stat label="LÄUFE"          value={data.total_walks}           color="#a855f7" />
                  <Stat label="KALORIEN"       value={`${data.total_calories.toLocaleString("de-DE")} kcal`} color="#FF6B4A" />
                  <Stat label="LÄNGSTER LAUF"  value={`${longestKm} km`}          color={GOLD} />
                </div>
              </Card>

              {/* Sammlung + Territorien */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                <MiniStat label="GEBIETE"   value={data.territory_count} icon="🗺️" color={PRIMARY} />
                <MiniStat label="WÄCHTER"   value={`${data.collection_size}/${data.collection_total}`} icon="🛡️" color="#a855f7" />
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function Card({ title, color, children }: { title: string; color: string; children: React.ReactNode }) {
  return (
    <div style={{
      padding: 12, borderRadius: 14,
      background: "rgba(15,17,21,0.55)",
      border: `1px solid ${color}44`,
    }}>
      <div style={{ color, fontSize: 9, fontWeight: 900, letterSpacing: 2, marginBottom: 8 }}>{title}</div>
      {children}
    </div>
  );
}

function Stat({ label, value, color }: { label: string; value: number | string; color: string }) {
  return (
    <div style={{ padding: "6px 4px", borderRadius: 8, background: "rgba(15,17,21,0.6)", textAlign: "center" }}>
      <div style={{ color: "#8B8FA3", fontSize: 8, fontWeight: 800, letterSpacing: 1 }}>{label}</div>
      <div style={{ color, fontSize: 13, fontWeight: 900, marginTop: 2 }}>{value}</div>
    </div>
  );
}

function MiniStat({ label, value, icon, color }: { label: string; value: number | string; icon: string; color: string }) {
  return (
    <div style={{
      padding: 10, borderRadius: 12,
      background: "rgba(15,17,21,0.55)",
      border: `1px solid ${color}33`,
      display: "flex", alignItems: "center", gap: 10,
    }}>
      <div style={{ fontSize: 22 }}>{icon}</div>
      <div>
        <div style={{ color: "#8B8FA3", fontSize: 8, fontWeight: 800, letterSpacing: 1 }}>{label}</div>
        <div style={{ color, fontSize: 15, fontWeight: 900 }}>{value}</div>
      </div>
    </div>
  );
}
