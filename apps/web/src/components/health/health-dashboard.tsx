"use client";

import React, { useState } from "react";

const PRIMARY = "#22D1C3";
const ACCENT = "#FF2D78";
const MUTED = "#a8b4cf";
const TEXT_SOFT = "#dde3f5";
const BG_DEEP = "#0F1115";

export interface HealthProfile {
  total_distance_m?: number;
  total_calories?: number;
}

export interface HealthRun {
  created_at: string;
  distance_m: number;
  duration_s: number;
  street_name?: string | null;
}

type HealthPeriod = "week" | "month" | "year" | "all";

export function HealthDashboard({ profile: p, runs, territoryCount, teamColor, achievements }: {
  profile: HealthProfile | null;
  runs: HealthRun[];
  territoryCount: number;
  teamColor: string;
  achievements: Array<{ id: string; name: string; icon: string; unlocked: boolean; pct: number; current: number; target: number; unit: string; xp: number; displayFmt: (v: number) => string }>;
}) {
  const [period, setPeriod] = useState<HealthPeriod>("month");
  const [weeklyGoalKm, setWeeklyGoalKm] = useState<number>(() => {
    if (typeof window === "undefined") return 10;
    return Number(localStorage.getItem("health_weekly_goal_km") || 10);
  });

  const now = new Date();
  const msPerDay = 24 * 60 * 60 * 1000;

  const periodDays = period === "week" ? 7 : period === "month" ? 30 : period === "year" ? 365 : 365 * 10;
  const periodStart = new Date(now.getTime() - periodDays * msPerDay);
  const prevPeriodStart = new Date(now.getTime() - 2 * periodDays * msPerDay);

  const inPeriod = runs.filter((r) => new Date(r.created_at) >= periodStart);
  const inPrevPeriod = runs.filter((r) => {
    const d = new Date(r.created_at);
    return d >= prevPeriodStart && d < periodStart;
  });

  const sumKm = (arr: HealthRun[]) => arr.reduce((s, r) => s + r.distance_m, 0) / 1000;
  const sumSec = (arr: HealthRun[]) => arr.reduce((s, r) => s + r.duration_s, 0);

  const kmNow = sumKm(inPeriod);
  const kmPrev = sumKm(inPrevPeriod);
  const walksNow = inPeriod.length;
  const walksPrev = inPrevPeriod.length;

  const kcalNow = kmNow * 70;
  const kcalPrev = kmPrev * 70;

  const secNow = sumSec(inPeriod);

  const uniqueDaysNow = new Set(inPeriod.map((r) => r.created_at.slice(0, 10))).size;

  const avgDistance = walksNow > 0 ? kmNow / walksNow : 0;
  const avgDurationMin = walksNow > 0 ? secNow / walksNow / 60 : 0;
  const avgPaceMinPerKm = kmNow > 0 ? (secNow / 60) / kmNow : 0;
  const longest = inPeriod.reduce((max, r) => r.distance_m > max ? r.distance_m : max, 0) / 1000;
  const shortest = inPeriod.length > 0 ? inPeriod.reduce((min, r) => r.distance_m < min ? r.distance_m : min, Infinity) / 1000 : 0;
  const fastestPace = inPeriod.reduce((best, r) => {
    if (r.distance_m < 500) return best;
    const pace = (r.duration_s / 60) / (r.distance_m / 1000);
    return pace < best ? pace : best;
  }, Infinity);

  const timeSlots = { morgens: 0, mittags: 0, abends: 0, nachts: 0 };
  inPeriod.forEach((r) => {
    const h = new Date(r.created_at).getHours();
    if (h >= 5 && h < 11) timeSlots.morgens++;
    else if (h >= 11 && h < 17) timeSlots.mittags++;
    else if (h >= 17 && h < 22) timeSlots.abends++;
    else timeSlots.nachts++;
  });

  const weekdayData = [0, 0, 0, 0, 0, 0, 0];
  inPeriod.forEach((r) => {
    const wd = (new Date(r.created_at).getDay() + 6) % 7;
    weekdayData[wd] += r.distance_m / 1000;
  });

  const chartBuckets = period === "week" ? 7 : period === "month" ? 30 : 12;
  const bucketKm: number[] = new Array(chartBuckets).fill(0);
  const bucketLabels: string[] = [];
  if (period === "year") {
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      bucketLabels.push(d.toLocaleDateString("de-DE", { month: "short" }));
    }
    inPeriod.forEach((r) => {
      const d = new Date(r.created_at);
      const mDiff = (now.getFullYear() - d.getFullYear()) * 12 + (now.getMonth() - d.getMonth());
      const idx = 11 - mDiff;
      if (idx >= 0 && idx < 12) bucketKm[idx] += r.distance_m / 1000;
    });
  } else {
    for (let i = chartBuckets - 1; i >= 0; i--) {
      const d = new Date(now.getTime() - i * msPerDay);
      bucketLabels.push(d.toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit" }));
    }
    inPeriod.forEach((r) => {
      const d = new Date(r.created_at);
      const daysAgo = Math.floor((now.getTime() - d.getTime()) / msPerDay);
      const idx = chartBuckets - 1 - daysAgo;
      if (idx >= 0 && idx < chartBuckets) bucketKm[idx] += r.distance_m / 1000;
    });
  }
  const maxBucket = Math.max(1, ...bucketKm);

  const last7Days = runs.filter((r) => new Date(r.created_at) >= new Date(now.getTime() - 7 * msPerDay));
  const weeklyKm = sumKm(last7Days);
  const weeklyPct = Math.min(100, (weeklyKm / weeklyGoalKm) * 100);

  const lifetimeKm = (p?.total_distance_m || 0) / 1000;
  const lifetimeKcal = p?.total_calories || Math.round(lifetimeKm * 70);
  const estimatedSteps = Math.round(lifetimeKm * 1300);
  const savedCo2Kg = (lifetimeKm * 120) / 1000;

  const nextMilestones = achievements
    .filter((a) => !a.unlocked)
    .sort((a, b) => b.pct - a.pct)
    .slice(0, 3);

  const deltaPct = (n: number, prev: number) => {
    if (prev === 0 && n === 0) return 0;
    if (prev === 0) return 100;
    return Math.round(((n - prev) / prev) * 100);
  };

  const periodLabel: Record<HealthPeriod, string> = {
    week: "7 Tage",
    month: "30 Tage",
    year: "12 Monate",
    all: "Gesamt",
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div style={{
        display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 6,
        background: "rgba(70, 82, 122, 0.45)", borderRadius: 14, padding: 4,
      }}>
        {(["week", "month", "year", "all"] as HealthPeriod[]).map((pp) => (
          <button
            key={pp}
            onClick={() => setPeriod(pp)}
            style={{
              padding: "8px 4px", borderRadius: 11, border: "none", cursor: "pointer",
              background: period === pp
                ? `linear-gradient(135deg, ${PRIMARY}, ${teamColor})`
                : "transparent",
              color: period === pp ? BG_DEEP : TEXT_SOFT,
              fontSize: 12, fontWeight: 800,
              boxShadow: period === pp ? `0 4px 14px ${PRIMARY}50` : "none",
              transition: "all 0.15s",
            }}
          >
            {periodLabel[pp]}
          </button>
        ))}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        <HealthHeroStat emoji="📏" value={kmNow.toFixed(1)} unit="km" label="Gelaufen" delta={deltaPct(kmNow, kmPrev)} color={PRIMARY} />
        <HealthHeroStat emoji="🏃" value={walksNow.toString()} unit="" label="Läufe" delta={deltaPct(walksNow, walksPrev)} color="#5ddaf0" />
        <HealthHeroStat emoji="🔥" value={Math.round(kcalNow).toLocaleString()} unit="kcal" label="Verbrannt" delta={deltaPct(kcalNow, kcalPrev)} color="#FF6B4A" />
        <HealthHeroStat emoji="📅" value={uniqueDaysNow.toString()} unit={`/ ${periodDays}`} label="Aktive Tage" delta={0} color="#FFD700" hideDelta />
      </div>

      <HealthSection title="KM-VERLAUF" emoji="📈">
        <div style={{
          display: "flex", alignItems: "flex-end", gap: 3,
          height: 150, padding: "20px 4px 0", position: "relative",
        }}>
          {bucketKm.map((km, i) => {
            const hPct = Math.max(2, (km / maxBucket) * 100);
            const showLabel = km > 0;
            return (
              <div
                key={i}
                title={`${bucketLabels[i]}: ${km.toFixed(2)} km`}
                style={{
                  flex: 1, position: "relative",
                  height: `${hPct}%`,
                  background: km > 0
                    ? `linear-gradient(180deg, ${teamColor}, ${teamColor}66)`
                    : "rgba(255,255,255,0.06)",
                  borderRadius: 3,
                  boxShadow: km > 0 ? `0 0 6px ${teamColor}aa` : "none",
                  minHeight: 2,
                  transition: "height 0.5s ease-out",
                }}
              >
                {showLabel && (
                  <span style={{
                    position: "absolute", top: -15, left: "50%", transform: "translateX(-50%)",
                    fontSize: 9, fontWeight: 900, color: teamColor,
                    whiteSpace: "nowrap", textShadow: "0 1px 2px rgba(0,0,0,0.6)",
                  }}>
                    {km.toFixed(km < 10 ? 1 : 0)}
                  </span>
                )}
              </div>
            );
          })}
        </div>
        <div style={{
          display: "flex", justifyContent: "space-between",
          marginTop: 6, fontSize: 9, color: MUTED,
        }}>
          <span>{bucketLabels[0]}</span>
          <span>Heute</span>
        </div>
      </HealthSection>

      <HealthSection title="WÖCHENTLICHES ZIEL" emoji="🎯" action={
        <div style={{ display: "flex", gap: 4 }}>
          {[5, 10, 20, 50].map((g) => (
            <button
              key={g}
              onClick={() => {
                setWeeklyGoalKm(g);
                if (typeof window !== "undefined") localStorage.setItem("health_weekly_goal_km", String(g));
              }}
              style={{
                padding: "3px 8px", borderRadius: 8,
                background: weeklyGoalKm === g ? `${PRIMARY}33` : "rgba(255,255,255,0.05)",
                border: weeklyGoalKm === g ? `1px solid ${PRIMARY}` : "1px solid rgba(255,255,255,0.1)",
                color: weeklyGoalKm === g ? PRIMARY : MUTED,
                fontSize: 10, fontWeight: 800, cursor: "pointer",
              }}
            >
              {g}km
            </button>
          ))}
        </div>
      }>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
          <span style={{ color: "#FFF", fontSize: 22, fontWeight: 900 }}>
            {weeklyKm.toFixed(1)} / {weeklyGoalKm} km
          </span>
          <span style={{ color: weeklyPct >= 100 ? "#4ade80" : PRIMARY, fontSize: 15, fontWeight: 800, alignSelf: "center" }}>
            {weeklyPct >= 100 ? "✓ Geschafft!" : `${Math.round(weeklyPct)}%`}
          </span>
        </div>
        <div style={{ height: 10, borderRadius: 5, background: "rgba(255,255,255,0.08)", overflow: "hidden" }}>
          <div style={{
            height: "100%", width: `${weeklyPct}%`,
            background: weeklyPct >= 100
              ? "linear-gradient(90deg, #4ade80, #22D1C3)"
              : `linear-gradient(90deg, ${PRIMARY}, ${ACCENT})`,
            borderRadius: 5,
            boxShadow: `0 0 10px ${PRIMARY}80`,
            transition: "width 0.8s ease-out",
          }} />
        </div>
      </HealthSection>

      <HealthSection title="LAUF-STATISTIKEN" emoji="🏃">
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
          <MiniStat label="Ø Distanz" value={avgDistance.toFixed(1)} unit="km" />
          <MiniStat label="Ø Dauer" value={avgDurationMin.toFixed(0)} unit="min" />
          <MiniStat label="Ø Pace" value={avgPaceMinPerKm > 0 ? avgPaceMinPerKm.toFixed(1) : "—"} unit="min/km" />
          <MiniStat label="Längster" value={longest.toFixed(1)} unit="km" />
          <MiniStat label="Kürzester" value={shortest > 0 ? shortest.toFixed(1) : "—"} unit="km" />
          <MiniStat label="Schnellste" value={isFinite(fastestPace) ? fastestPace.toFixed(1) : "—"} unit="min/km" />
        </div>
      </HealthSection>

      <HealthSection title="WANN LÄUFST DU?" emoji="📆">
        <div style={{ display: "flex", alignItems: "flex-end", gap: 6, height: 100, marginBottom: 6 }}>
          {weekdayData.map((km, i) => {
            const max = Math.max(0.1, ...weekdayData);
            return (
              <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
                <div style={{ fontSize: 9, color: MUTED, fontWeight: 700 }}>{km.toFixed(1)}</div>
                <div style={{
                  width: "100%", height: `${Math.max(4, (km / max) * 100)}%`, minHeight: 4,
                  background: km > 0
                    ? `linear-gradient(180deg, ${teamColor}, ${teamColor}55)`
                    : "rgba(255,255,255,0.05)",
                  borderRadius: 4,
                  boxShadow: km > 0 ? `0 0 6px ${teamColor}66` : "none",
                }} />
              </div>
            );
          })}
        </div>
        <div style={{ display: "flex", gap: 6 }}>
          {["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"].map((d, i) => (
            <div key={i} style={{ flex: 1, textAlign: "center", fontSize: 10, color: MUTED, fontWeight: 700 }}>{d}</div>
          ))}
        </div>
      </HealthSection>

      <HealthSection title="TAGESZEIT" emoji="🌅">
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 8 }}>
          <TimeSlot icon="🌅" label="Morgens" count={timeSlots.morgens} total={walksNow} color="#FFD700" />
          <TimeSlot icon="☀️" label="Mittags" count={timeSlots.mittags} total={walksNow} color="#FF6B4A" />
          <TimeSlot icon="🌆" label="Abends" count={timeSlots.abends} total={walksNow} color="#a855f7" />
          <TimeSlot icon="🌙" label="Nachts" count={timeSlots.nachts} total={walksNow} color="#5ddaf0" />
        </div>
      </HealthSection>

      <HealthSection title="KALORIEN-ÄQUIVALENTE" emoji="🍕" subtitle={`Lifetime: ${lifetimeKcal.toLocaleString()} kcal`}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
          <Equivalent icon="🍕" count={(lifetimeKcal / 285).toFixed(1)} label="Pizza-Stücke" />
          <Equivalent icon="🍌" count={Math.round(lifetimeKcal / 105).toString()} label="Bananen" />
          <Equivalent icon="🍫" count={Math.round(lifetimeKcal / 235).toString()} label="Schokoriegel" />
          <Equivalent icon="🥨" count={Math.round(lifetimeKcal / 340).toString()} label="Brezeln" />
        </div>
      </HealthSection>

      <HealthSection title="GEOGRAFIE & UMWELT" emoji="🌍">
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
          <MiniStat label="Gebiete" value={territoryCount.toString()} unit="" big />
          <MiniStat label="Einzigartige Straßen" value={new Set(runs.map((r) => r.street_name).filter(Boolean)).size.toString()} unit="" big />
          <MiniStat label="Geschätzte Schritte" value={estimatedSteps.toLocaleString()} unit="" big />
          <MiniStat label="CO₂-Ersparnis" value={savedCo2Kg.toFixed(1)} unit="kg" big />
        </div>
        <div style={{
          marginTop: 10, padding: "10px 12px", borderRadius: 12,
          background: "rgba(34, 209, 195, 0.08)",
          border: "1px solid rgba(34, 209, 195, 0.2)",
          fontSize: 11, color: TEXT_SOFT, lineHeight: 1.5,
        }}>
          💚 Du hast {savedCo2Kg.toFixed(1)} kg CO₂ eingespart, indem du nicht Auto gefahren bist. Das entspricht ca. {(savedCo2Kg / 0.12).toFixed(0)} km nicht-gefahrener Strecke im Schnitt-PKW.
        </div>
      </HealthSection>

      {nextMilestones.length > 0 && (
        <HealthSection title="NÄCHSTE MEILENSTEINE" emoji="🎖️">
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {nextMilestones.map((m) => (
              <div key={m.id} style={{
                display: "flex", alignItems: "center", gap: 10,
                padding: "10px 12px", borderRadius: 12,
                background: "rgba(70, 82, 122, 0.45)",
                border: "1px solid rgba(255,255,255,0.08)",
              }}>
                <span style={{ fontSize: 22 }}>{m.icon}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                    <span style={{ color: "#FFF", fontSize: 12, fontWeight: 700, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{m.name}</span>
                    <span style={{ color: PRIMARY, fontSize: 11, fontWeight: 800 }}>
                      {m.displayFmt(m.current)} / {m.displayFmt(m.target)}{m.unit ? ` ${m.unit}` : ""}
                    </span>
                  </div>
                  <div style={{ marginTop: 4, height: 5, borderRadius: 3, background: "rgba(255,255,255,0.08)", overflow: "hidden" }}>
                    <div style={{
                      height: "100%", width: `${m.pct}%`,
                      background: `linear-gradient(90deg, ${PRIMARY}, #FFD700)`,
                      borderRadius: 3, boxShadow: `0 0 6px ${PRIMARY}88`,
                    }} />
                  </div>
                </div>
                <span style={{ color: "#FFD700", fontSize: 11, fontWeight: 800, flexShrink: 0 }}>+{m.xp.toLocaleString()} 🪙</span>
              </div>
            ))}
          </div>
        </HealthSection>
      )}

      <div style={{
        padding: "10px 12px", borderRadius: 12,
        background: "rgba(255,255,255,0.04)",
        border: "1px solid rgba(255,255,255,0.06)",
        fontSize: 10.5, color: MUTED, lineHeight: 1.5, fontStyle: "italic",
      }}>
        ℹ️ Kalorien- und Schritt-Angaben sind Schätzwerte auf Basis deiner gelaufenen Distanz (~70 kcal/km, ~1.300 Schritte/km). Für medizinisch relevante Daten nutze zertifizierte Geräte.
      </div>
    </div>
  );
}

function HealthHeroStat({ emoji, value, unit, label, delta, color, hideDelta }: {
  emoji: string; value: string; unit: string; label: string; delta: number; color: string; hideDelta?: boolean;
}) {
  const deltaColor = delta > 0 ? "#4ade80" : delta < 0 ? "#FF6B4A" : MUTED;
  return (
    <div style={{
      background: `linear-gradient(135deg, ${color}15 0%, rgba(70, 82, 122, 0.5) 70%)`,
      padding: 14, borderRadius: 14,
      border: `1px solid ${color}44`,
      boxShadow: `0 0 14px ${color}22`,
    }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
        <span style={{ fontSize: 22 }}>{emoji}</span>
        {!hideDelta && delta !== 0 && (
          <span style={{
            fontSize: 10, fontWeight: 800, color: deltaColor,
            padding: "2px 6px", borderRadius: 8,
            background: `${deltaColor}18`, border: `1px solid ${deltaColor}55`,
          }}>
            {delta > 0 ? "↑" : "↓"} {Math.abs(delta)}%
          </span>
        )}
      </div>
      <div style={{ display: "baseline", gap: 4 }}>
        <span style={{ fontSize: 26, fontWeight: 900, color: "#FFF" }}>{value}</span>
        {unit && <span style={{ fontSize: 12, color: MUTED, fontWeight: 700, marginLeft: 4 }}>{unit}</span>}
      </div>
      <div style={{ fontSize: 11, color: MUTED, marginTop: 3, fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.5 }}>{label}</div>
    </div>
  );
}

function HealthSection({ title, emoji, subtitle, action, children }: {
  title: string; emoji?: string; subtitle?: string;
  action?: React.ReactNode; children: React.ReactNode;
}) {
  return (
    <div style={{
      background: "rgba(70, 82, 122, 0.38)",
      borderRadius: 14, padding: 14,
      border: "1px solid rgba(255,255,255,0.08)",
    }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
        <div>
          <div style={{ fontSize: 11, color: PRIMARY, fontWeight: 800, letterSpacing: 1 }}>
            {emoji && <span style={{ marginRight: 6 }}>{emoji}</span>}
            {title}
          </div>
          {subtitle && <div style={{ fontSize: 10, color: MUTED, marginTop: 2 }}>{subtitle}</div>}
        </div>
        {action}
      </div>
      {children}
    </div>
  );
}

function MiniStat({ label, value, unit, big }: { label: string; value: string; unit: string; big?: boolean }) {
  return (
    <div style={{
      background: "rgba(255,255,255,0.04)",
      padding: big ? "10px 12px" : "8px 10px",
      borderRadius: 10,
      border: "1px solid rgba(255,255,255,0.06)",
    }}>
      <div style={{ fontSize: 10, color: MUTED, fontWeight: 600, marginBottom: 3 }}>{label}</div>
      <div style={{ display: "flex", alignItems: "baseline", gap: 3 }}>
        <span style={{ fontSize: big ? 18 : 15, fontWeight: 900, color: "#FFF" }}>{value}</span>
        {unit && <span style={{ fontSize: 10, color: MUTED, fontWeight: 600 }}>{unit}</span>}
      </div>
    </div>
  );
}

function TimeSlot({ icon, label, count, total, color }: {
  icon: string; label: string; count: number; total: number; color: string;
}) {
  const pct = total > 0 ? (count / total) * 100 : 0;
  return (
    <div style={{
      padding: 10, borderRadius: 12,
      background: count > 0 ? `${color}15` : "rgba(255,255,255,0.04)",
      border: count > 0 ? `1px solid ${color}55` : "1px solid rgba(255,255,255,0.06)",
      textAlign: "center",
    }}>
      <div style={{ fontSize: 20, marginBottom: 3 }}>{icon}</div>
      <div style={{ fontSize: 16, fontWeight: 900, color: count > 0 ? color : MUTED }}>{count}</div>
      <div style={{ fontSize: 9, color: MUTED, marginTop: 2, fontWeight: 600 }}>{label}</div>
      <div style={{ fontSize: 9, color: count > 0 ? color : MUTED, fontWeight: 700, marginTop: 2 }}>{Math.round(pct)}%</div>
    </div>
  );
}

function Equivalent({ icon, count, label }: { icon: string; count: string; label: string }) {
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 10,
      padding: "10px 12px", borderRadius: 12,
      background: "rgba(255,255,255,0.04)",
      border: "1px solid rgba(255,255,255,0.06)",
    }}>
      <span style={{ fontSize: 24 }}>{icon}</span>
      <div>
        <div style={{ fontSize: 18, fontWeight: 900, color: "#FFD700" }}>{count}</div>
        <div style={{ fontSize: 10, color: MUTED, fontWeight: 600 }}>{label}</div>
      </div>
    </div>
  );
}
