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
const BG_DEEP = "#0F1115";
const TEXT_SOFT = "#a8b4cf";
const MUTED = "#8B8FA3";
const BORDER = "rgba(255,255,255,0.08)";

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

  const color = data?.crew?.color ?? data?.team_color ?? PRIMARY;
  const kmTotal = data ? (data.total_distance_m / 1000).toFixed(1) : "–";
  const longestKm = data ? (data.longest_run_m / 1000).toFixed(2) : "–";
  const wins = data?.active_guardian?.wins ?? 0;
  const losses = data?.active_guardian?.losses ?? 0;
  const winRate = wins + losses > 0 ? Math.round((wins / (wins + losses)) * 100) : 0;

  const tierBadge = data?.supporter_tier
    ? data.supporter_tier === "gold"   ? { bg: "linear-gradient(135deg,#FFD700,#FF9E2C)", label: "GOLD",   text: BG_DEEP }
    : data.supporter_tier === "silver" ? { bg: "linear-gradient(135deg,#E0E0E0,#9A9A9A)", label: "SILBER", text: BG_DEEP }
    : { bg: "linear-gradient(135deg,#CD7F32,#A0522D)", label: "BRONZE", text: "#FFF" }
    : null;

  return (
    <div onClick={onClose} style={{
      position: "fixed", inset: 0, zIndex: 3800,
      background: "rgba(0,0,0,0.72)", backdropFilter: "blur(6px)",
      display: "flex", alignItems: "center", justifyContent: "center", padding: 16,
    }}>
      <div onClick={(e) => e.stopPropagation()} style={{
        width: "100%", maxWidth: 520, maxHeight: "88vh",
        display: "flex", flexDirection: "column",
        background: `linear-gradient(180deg, ${color}22 0%, #141a2d 100%)`,
        borderRadius: 22, border: `1px solid ${color}66`,
        boxShadow: `0 8px 32px rgba(0,0,0,0.6)`,
        color: "#F0F0F0", overflow: "hidden",
      }}>
        {error ? (
          <div style={{ padding: 30, textAlign: "center", color: PINK }}>{error}</div>
        ) : !data ? (
          <div style={{ padding: 40, textAlign: "center", color: TEXT_SOFT }}>Lade Runner-Profil …</div>
        ) : (
          <div style={{ overflowY: "auto" }}>
            {/* ═══ HERO BAND ═══ */}
            <div style={{
              height: 120, position: "relative",
              background: `linear-gradient(135deg, ${color} 0%, ${color}77 60%, ${color}33 100%)`,
            }}>
              <button onClick={onClose} style={{
                position: "absolute", top: 12, left: 12,
                width: 34, height: 34, borderRadius: 17,
                background: "rgba(0,0,0,0.55)", border: "none",
                color: "#FFF", fontSize: 18, cursor: "pointer",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontWeight: 900,
              }}>×</button>
              {tierBadge && (
                <div style={{
                  position: "absolute", top: 14, right: 14,
                  padding: "4px 10px", borderRadius: 999,
                  background: tierBadge.bg,
                  color: tierBadge.text, fontSize: 10, fontWeight: 900, letterSpacing: 1,
                  display: "flex", alignItems: "center", gap: 4,
                  boxShadow: "0 2px 8px rgba(0,0,0,0.4)",
                }}>
                  <span>★</span> {tierBadge.label}
                </div>
              )}
              {/* Avatar-Puck */}
              <div style={{
                position: "absolute", left: 20, bottom: -36,
                width: 78, height: 78, borderRadius: 20,
                background: `linear-gradient(135deg, ${color}, ${color}aa)`,
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 42,
                boxShadow: `0 0 0 4px #141a2d, 0 6px 22px ${color}99`,
              }}>👣</div>
            </div>

            <div style={{ padding: "46px 20px 20px" }}>
              {/* Name + Handle */}
              <div style={{ color: "#FFF", fontSize: 22, fontWeight: 900, lineHeight: 1.15 }}>
                {data.display_name ?? data.username ?? "Runner"}
              </div>
              <div style={{ color: TEXT_SOFT, fontSize: 12, marginTop: 4, display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                <span style={{ color }}>@{data.username ?? "unknown"}</span>
                {data.level != null && <Dot /> }
                {data.level != null && <span>Lvl {data.level}</span>}
                {data.xp > 0 && <Dot />}
                {data.xp > 0 && <span style={{ color: GOLD, fontWeight: 800 }}>{data.xp.toLocaleString("de-DE")} XP</span>}
              </div>

              {/* Crew-Pill */}
              {data.crew && (
                <div style={{
                  marginTop: 12, padding: "10px 12px", borderRadius: 12,
                  background: "rgba(0,0,0,0.3)", border: `1px solid ${data.crew.color ?? color}55`,
                  display: "flex", alignItems: "center", gap: 10,
                }}>
                  <div style={{
                    width: 30, height: 30, borderRadius: 8,
                    background: data.crew.color ?? color,
                    boxShadow: `0 0 10px ${data.crew.color ?? color}99`,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 15,
                  }}>🏴</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ color: MUTED, fontSize: 9, fontWeight: 900, letterSpacing: 1.5 }}>CREW</div>
                    <div style={{ color: "#FFF", fontSize: 13, fontWeight: 900 }}>{data.crew.name}</div>
                  </div>
                </div>
              )}

              {/* ══ AKTIVER WÄCHTER ══ */}
              {data.active_guardian && (() => {
                const g = data.active_guardian!;
                const r = rarityMeta(g.archetype.rarity);
                const typ = g.archetype.guardian_type ? TYPE_META[g.archetype.guardian_type] : null;
                const s = statsAtLevel(g.archetype, g.level);
                return (
                  <div style={{
                    marginTop: 14, padding: 14, borderRadius: 16,
                    background: `linear-gradient(135deg, ${r.glow}, rgba(15,17,21,0.7))`,
                    border: `1px solid ${r.color}77`,
                    boxShadow: `0 0 20px ${r.glow}`,
                  }}>
                    <div style={{ color: r.color, fontSize: 9, fontWeight: 900, letterSpacing: 2, marginBottom: 10 }}>
                      ⚡ AKTIVER WÄCHTER
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                      <div style={{ width: 92, height: 115, flexShrink: 0 }}>
                        <GuardianAvatar archetype={g.archetype} size={92} animation="idle" />
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ color: r.color, fontSize: 9, fontWeight: 900, letterSpacing: 1 }}>
                          {r.label.toUpperCase()}{typ ? ` · ${typ.icon} ${typ.label.toUpperCase()}` : ""}
                        </div>
                        <div style={{ color: "#FFF", fontSize: 16, fontWeight: 900, lineHeight: 1.15 }}>
                          {g.custom_name ?? g.archetype.name}
                        </div>
                        <div style={{ color: TEXT_SOFT, fontSize: 11, marginTop: 4 }}>
                          Lvl {g.level} · {wins}W / {losses}L
                          {g.talent_points_available > 0 && (
                            <span style={{ color: GOLD, marginLeft: 6, fontWeight: 900 }}>+{g.talent_points_available} Talent</span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 6, marginTop: 12 }}>
                      <Stat label="HP"  value={s.hp}  color="#4ade80" />
                      <Stat label="ATK" value={s.atk} color="#FF6B4A" />
                      <Stat label="DEF" value={s.def} color="#5ddaf0" />
                      <Stat label="SPD" value={s.spd} color={GOLD} />
                    </div>
                  </div>
                );
              })()}

              {/* ══ KAMPF ══ */}
              <SectionCard title="KAMPF-STATISTIK" color={PINK} icon="⚔️" style={{ marginTop: 14 }}>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 6 }}>
                  <Stat label="SIEGE"       value={wins}          color="#4ade80" />
                  <Stat label="NIEDERLAGEN" value={losses}        color={PINK} />
                  <Stat label="WIN-RATE"    value={`${winRate}%`} color={GOLD} />
                </div>
              </SectionCard>

              {/* ══ WALKING ══ */}
              <SectionCard title="WALKING-STATISTIK" color={PRIMARY} icon="🏃" style={{ marginTop: 10 }}>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
                  <Stat label="GELAUFEN"      value={`${kmTotal} km`}                                 color={PRIMARY} />
                  <Stat label="LÄUFE"         value={data.total_walks}                                color="#a855f7" />
                  <Stat label="KALORIEN"      value={`${data.total_calories.toLocaleString("de-DE")} kcal`} color="#FF6B4A" />
                  <Stat label="LÄNGSTER LAUF" value={`${longestKm} km`}                                color={GOLD} />
                </div>
              </SectionCard>

              {/* ══ FOOTER ══ */}
              <div style={{ marginTop: 10, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                <FooterStat icon="🗺️" label="GEBIETE" value={data.territory_count} color={PRIMARY} />
                <FooterStat icon="🛡️" label="WÄCHTER-SAMMLUNG" value={`${data.collection_size}/${data.collection_total}`} color="#a855f7" />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function Dot() {
  return <span style={{ width: 3, height: 3, borderRadius: "50%", background: MUTED, display: "inline-block" }} />;
}

function SectionCard({ title, color, icon, children, style }: { title: string; color: string; icon: string; children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{
      padding: 12, borderRadius: 14,
      background: "rgba(0,0,0,0.3)",
      border: `1px solid ${BORDER}`,
      ...style,
    }}>
      <div style={{ color, fontSize: 9, fontWeight: 900, letterSpacing: 2, marginBottom: 10, display: "flex", alignItems: "center", gap: 6 }}>
        <span style={{ fontSize: 12 }}>{icon}</span> {title}
      </div>
      {children}
    </div>
  );
}

function Stat({ label, value, color }: { label: string; value: number | string; color: string }) {
  return (
    <div style={{
      padding: "8px 4px", borderRadius: 10,
      background: "rgba(15,17,21,0.65)",
      border: "1px solid rgba(255,255,255,0.05)",
      textAlign: "center",
    }}>
      <div style={{ color: MUTED, fontSize: 8, fontWeight: 800, letterSpacing: 1 }}>{label}</div>
      <div style={{ color, fontSize: 14, fontWeight: 900, marginTop: 3 }}>{value}</div>
    </div>
  );
}

function FooterStat({ icon, label, value, color }: { icon: string; label: string; value: number | string; color: string }) {
  return (
    <div style={{
      padding: 12, borderRadius: 14,
      background: "rgba(0,0,0,0.3)",
      border: `1px solid ${color}33`,
      display: "flex", alignItems: "center", gap: 10,
    }}>
      <div style={{ fontSize: 22 }}>{icon}</div>
      <div style={{ minWidth: 0 }}>
        <div style={{ color: MUTED, fontSize: 8, fontWeight: 800, letterSpacing: 1 }}>{label}</div>
        <div style={{ color, fontSize: 14, fontWeight: 900 }}>{value}</div>
      </div>
    </div>
  );
}
