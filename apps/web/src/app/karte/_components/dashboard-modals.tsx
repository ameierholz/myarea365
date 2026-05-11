"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";

function fmtRemaining(target: string | null | undefined): string | null {
  if (!target) return null;
  const ms = new Date(target).getTime() - Date.now();
  if (ms <= 0) return null;
  const h = Math.floor(ms / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

/* ═══ Power-Zone Modal ═══ */
export function PowerZoneModal({ zone, onClose }: {
  zone: { id: string; name: string; kind: string; center_lat: number; center_lng: number; radius_m: number; color: string; buff_hp: number; buff_atk: number; buff_def: number; buff_spd: number };
  onClose: () => void;
}) {
  const kindLabel: Record<string, string> = {
    park: "🌳 Park-Zone", water: "💧 Wasser-Zone", city: "🏙️ Stadt-Zone", forest: "🌲 Wald-Zone", landmark: "🗿 Wahrzeichen",
  };
  const buffs: Array<[string, number, string]> = [
    ["Leben",        zone.buff_hp,  "#4ade80"],
    ["Angriff",      zone.buff_atk, "#FF6B4A"],
    ["Verteidigung", zone.buff_def, "#5ddaf0"],
    ["Tempo",        zone.buff_spd, "#FFD700"],
  ];
  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 9100, background: "rgba(15,17,21,0.9)", backdropFilter: "blur(14px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 6 }}>
      <div onClick={(e) => e.stopPropagation()} style={{ maxWidth: 400, width: "100%", maxHeight: "100dvh", overflowY: "auto", background: "linear-gradient(160deg, #0F1115 0%, #151823 100%)", borderRadius: 14, padding: 10, border: `2px solid ${zone.color}aa`, color: "#FFF", boxShadow: `0 0 30px ${zone.color}55` }}>
        <div style={{ fontSize: 11, color: zone.color, fontWeight: 900, letterSpacing: 0.8, marginBottom: 4 }}>
          {kindLabel[zone.kind] ?? "POWER-ZONE"}
        </div>
        <div style={{ fontSize: 18, fontWeight: 900, marginBottom: 14 }}>{zone.name}</div>
        <div style={{ fontSize: 12, color: "#a8b4cf", marginBottom: 14, lineHeight: 1.55 }}>
          Wenn du innerhalb dieser Zone (Radius <strong>{zone.radius_m} m</strong>) läufst, bekommt dein <strong style={{ color: "#22D1C3" }}>Wächter</strong> folgende passive Buffs:
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 6, marginBottom: 16 }}>
          {buffs.map(([label, val, color]) => (
            <div key={label} style={{
              padding: "10px 6px", borderRadius: 10, textAlign: "center",
              background: val > 0 ? `${color}15` : "rgba(255,255,255,0.04)",
              border: `1px solid ${val > 0 ? color : "rgba(255,255,255,0.1)"}55`,
            }}>
              <div style={{ color: val > 0 ? color : "#8B8FA3", fontSize: 15, fontWeight: 900 }}>
                {val > 0 ? `+${val}` : "—"}
              </div>
              <div style={{ color: "#8B8FA3", fontSize: 9, fontWeight: 700, marginTop: 2, letterSpacing: 0.5 }}>{label}</div>
            </div>
          ))}
        </div>
        <div style={{ fontSize: 10, color: "#8B8FA3", marginBottom: 14, lineHeight: 1.5, fontStyle: "italic" }}>
          Power-Zones sind strategische Orte. Nutze sie für Trainings-Runden, um deinen Wächter schneller zu leveln — vor allem vor großen Arena-Kämpfen oder Area-Boss-Raids.
        </div>
        <button onClick={onClose} style={{ width: "100%", padding: "10px 12px", borderRadius: 10, background: `${zone.color}22`, border: `1px solid ${zone.color}`, color: zone.color, fontSize: 12, fontWeight: 900, cursor: "pointer" }}>Verstanden</button>
      </div>
    </div>
  );
}

/* ═══ Area-Boss Modal (Crew-Raid) ═══ */
export function BossRaidModal({ boss, distM, inRange, onClose, onAttack }: {
  boss: { id: string; name: string; emoji: string; max_hp: number; current_hp: number };
  distM: number | null;
  inRange: boolean;
  onClose: () => void;
  onAttack: () => void | Promise<void>;
}) {
  const tMD = useTranslations("MapDashboard");
  const pct = Math.round((boss.current_hp / boss.max_hp) * 100);
  const [attacking, setAttacking] = useState(false);
  const fmtDist = (m: number) => m < 1000 ? `${m} m` : `${(m/1000).toFixed(1)} km`;
  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 9100, background: "rgba(15,17,21,0.92)", backdropFilter: "blur(14px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 6 }}>
      <div onClick={(e) => e.stopPropagation()} style={{ maxWidth: 460, width: "100%", maxHeight: "100dvh", overflowY: "auto", background: "linear-gradient(160deg, #2a0618 0%, #0F1115 90%)", borderRadius: 14, padding: 10, border: "2px solid rgba(255,45,120,0.7)", color: "#FFF", textAlign: "center", boxShadow: "0 0 40px rgba(255,45,120,0.5)" }}>
        <div style={{ fontSize: 64, lineHeight: 1, marginBottom: 8, filter: "drop-shadow(0 4px 10px rgba(0,0,0,0.6))" }}>{boss.emoji}</div>
        <div style={{ fontSize: 18, fontWeight: 900, marginBottom: 4, letterSpacing: 0.5 }}>{boss.name}</div>
        <div style={{ fontSize: 11, color: "#FF6BA1", fontWeight: 800, marginBottom: 14, letterSpacing: 0.6 }}>AREA-BOSS · LEGENDÄRER RAID</div>
        <div style={{ height: 12, background: "rgba(0,0,0,0.6)", borderRadius: 6, overflow: "hidden", border: "1px solid rgba(255,255,255,0.2)", marginBottom: 6 }}>
          <div style={{ height: "100%", width: `${pct}%`, background: "linear-gradient(90deg, #FF2D78, #FFD700)", transition: "width 0.4s" }} />
        </div>
        <div style={{ fontSize: 11, color: "#a8b4cf", marginBottom: 16 }}>
          {boss.current_hp.toLocaleString()} / {boss.max_hp.toLocaleString()} Leben ({pct}%)
        </div>

        <div style={{
          display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 6,
          marginBottom: 10, textAlign: "left",
        }}>
          <div style={{ padding: 8, borderRadius: 10, background: "rgba(0,0,0,0.3)", border: "1px solid rgba(255,215,0,0.3)" }}>
            <div style={{ fontSize: 18, marginBottom: 3 }}>🥇</div>
            <div style={{ color: "#FFD700", fontSize: 10, fontWeight: 900, marginBottom: 2 }}>NUR DIE STÄRKSTE CREW GEWINNT</div>
            <div style={{ color: "#a8b4cf", fontSize: 10, lineHeight: 1.4 }}>Crew mit dem meisten Gesamt-Damage holt den Loot. Wächter-Level + Ausrüstung entscheiden.</div>
          </div>
          <div style={{ padding: 8, borderRadius: 10, background: "rgba(0,0,0,0.3)", border: "1px solid rgba(168,85,247,0.3)" }}>
            <div style={{ fontSize: 18, marginBottom: 3 }}>👥</div>
            <div style={{ color: "#a855f7", fontSize: 10, fontWeight: 900, marginBottom: 2 }}>MAX 10 / CREW</div>
            <div style={{ color: "#a8b4cf", fontSize: 10, lineHeight: 1.4 }}>Maximal 10 Mitglieder pro Crew dürfen teilnehmen. GPS ≤ 500 m vom Boss.</div>
          </div>
          <div style={{ padding: 8, borderRadius: 10, background: "rgba(0,0,0,0.3)", border: "1px solid rgba(255,45,120,0.3)" }}>
            <div style={{ fontSize: 18, marginBottom: 3 }}>🎁</div>
            <div style={{ color: "#FF2D78", fontSize: 10, fontWeight: 900, marginBottom: 2 }}>LOOT SKALIERT</div>
            <div style={{ color: "#a8b4cf", fontSize: 10, lineHeight: 1.4 }}>1-3 Teilnehmer = 1 Loot · 4-6 = 2 · 7-10 = 3 — Kampfleader verteilt.</div>
          </div>
        </div>

        <div style={{
          display: "flex", flexDirection: "column", gap: 3,
          marginBottom: 12, textAlign: "left",
          padding: "8px 10px", borderRadius: 10,
          background: "rgba(255,215,0,0.06)",
          border: "1px solid rgba(255,215,0,0.2)",
        }}>
          <div style={{ color: "#FFD700", fontSize: 10, fontWeight: 900, letterSpacing: 0.5, marginBottom: 2 }}>LOOT-STAFFELUNG (GEWINNER-CREW)</div>
          <div style={{ fontSize: 11, color: "#DDD", display: "flex", justifyContent: "space-between" }}>
            <span>7-10 Teilnehmer</span>
            <span><b style={{ color: "#FFD700" }}>🏆 Legend</b> + <b style={{ color: "#a855f7" }}>💎 Epic</b> + <b style={{ color: "#22D1C3" }}>💠 Rare</b></span>
          </div>
          <div style={{ fontSize: 11, color: "#DDD", display: "flex", justifyContent: "space-between" }}>
            <span>4-6 Teilnehmer</span>
            <span><b style={{ color: "#FFD700" }}>🏆 Legend</b> + <b style={{ color: "#a855f7" }}>💎 Epic</b></span>
          </div>
          <div style={{ fontSize: 11, color: "#DDD", display: "flex", justifyContent: "space-between" }}>
            <span>1-3 Teilnehmer</span>
            <span><b style={{ color: "#FFD700" }}>🏆 Legend</b></span>
          </div>
        </div>
        {distM !== null && (
          <div style={{
            fontSize: 11, marginBottom: 12, padding: "8px 12px", borderRadius: 10,
            background: inRange ? "rgba(74,222,128,0.12)" : "rgba(255,45,120,0.12)",
            border: inRange ? "1px solid #4ade80" : "1px solid rgba(255,45,120,0.5)",
            color: inRange ? "#4ade80" : "#FF6BA1",
            fontWeight: 800,
          }}>
            {inRange
              ? `✓ In Reichweite (${fmtDist(distM)})`
              : `📍 Lauf hin! ${fmtDist(distM)} entfernt (max 500 m)`}
          </div>
        )}
        <button
          onClick={async () => { setAttacking(true); await onAttack(); setAttacking(false); }}
          disabled={attacking || !inRange}
          style={{
            width: "100%", padding: "14px 20px", borderRadius: 12,
            background: !inRange ? "rgba(120,120,120,0.2)" : "linear-gradient(135deg, #FF2D78, #a855f7)",
            border: !inRange ? "1px solid rgba(255,255,255,0.1)" : "none",
            color: !inRange ? "#8B8FA3" : "#FFF",
            fontSize: 15, fontWeight: 900,
            cursor: (attacking || !inRange) ? "not-allowed" : "pointer",
            marginBottom: 8, letterSpacing: 0.5,
            boxShadow: !inRange ? "none" : "0 4px 14px rgba(255,45,120,0.5)",
          }}
        >{attacking ? tMD("labelAttacking") : !inRange ? tMD("labelTooFar") : tMD("labelAttack")}</button>
        <button onClick={onClose} style={{ width: "100%", padding: "8px 12px", borderRadius: 10, background: "transparent", border: "1px solid rgba(255,255,255,0.2)", color: "#a8b4cf", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>{tMD("labelBack")}</button>
      </div>
    </div>
  );
}

function fmtCooldownLong(target: string | null | undefined): string | null {
  if (!target) return null;
  const ms = new Date(target).getTime() - Date.now();
  if (ms <= 0) return null;
  const totalH = Math.floor(ms / 3_600_000);
  const days = Math.floor(totalH / 24);
  const h = totalH % 24;
  if (days > 0) return h > 0 ? `${days}d ${h}h` : `${days}d`;
  const m = Math.floor((ms % 3_600_000) / 60_000);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

/* ═══ Sanctuary Modal ═══ */
export function SanctuaryModal({ sanctuary, distM, inRange, onClose, onTrain }: {
  sanctuary: { id: string; name: string; emoji: string; xp_reward: number; trained_today?: boolean; valid_until?: string | null; cooldown_until?: string | null };
  distM: number | null;
  inRange: boolean;
  onClose: () => void;
  onTrain: () => void | Promise<void>;
}) {
  const tMD = useTranslations("MapDashboard");
  const [training, setTraining] = useState(false);
  const [remaining, setRemaining] = useState<string | null>(fmtRemaining(sanctuary.valid_until));
  const [cooldownRemaining, setCooldownRemaining] = useState<string | null>(fmtCooldownLong(sanctuary.cooldown_until));
  useEffect(() => {
    if (!sanctuary.valid_until) return;
    const tick = () => setRemaining(fmtRemaining(sanctuary.valid_until));
    tick();
    const id = setInterval(tick, 60_000);
    return () => clearInterval(id);
  }, [sanctuary.valid_until]);
  useEffect(() => {
    if (!sanctuary.cooldown_until) return;
    const tick = () => setCooldownRemaining(fmtCooldownLong(sanctuary.cooldown_until));
    tick();
    const id = setInterval(tick, 60_000);
    return () => clearInterval(id);
  }, [sanctuary.cooldown_until]);
  const onCooldown = !!cooldownRemaining;
  const done = !!sanctuary.trained_today;
  const disabled = done || onCooldown || training || !inRange;
  const fmtDist = (m: number) => m < 1000 ? `${m} m` : `${(m/1000).toFixed(1)} km`;
  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 9100, background: "rgba(15,17,21,0.9)", backdropFilter: "blur(14px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 6 }}>
      <div onClick={(e) => e.stopPropagation()} style={{ maxWidth: 400, width: "100%", maxHeight: "100dvh", overflowY: "auto", background: "linear-gradient(160deg, #002b30 0%, #0F1115 90%)", borderRadius: 14, padding: 10, border: "2px solid rgba(34,209,195,0.6)", color: "#FFF", textAlign: "center", boxShadow: "0 0 30px rgba(34,209,195,0.4)" }}>
        <div style={{ fontSize: 56, lineHeight: 1, marginBottom: 8 }}>{sanctuary.emoji}</div>
        <div style={{ fontSize: 18, fontWeight: 900, marginBottom: 4 }}>{sanctuary.name}</div>
        <div style={{ fontSize: 11, color: "#5ddaf0", fontWeight: 800, marginBottom: 10, letterSpacing: 0.6 }}>Wächter-SANCTUARY</div>
        {remaining && !onCooldown && (
          <div style={{ fontSize: 11, color: "#FFD700", fontWeight: 800, marginBottom: 12, padding: "5px 10px", borderRadius: 999, background: "rgba(255,215,0,0.1)", border: "1px solid rgba(255,215,0,0.35)", display: "inline-block" }}>
            ⏳ Rotiert in {remaining}
          </div>
        )}
        {onCooldown && (
          <div style={{ fontSize: 11, color: "#FF6BA1", fontWeight: 800, marginBottom: 12, padding: "6px 12px", borderRadius: 10, background: "rgba(255,45,120,0.12)", border: "1px solid rgba(255,45,120,0.45)" }}>
            🔒 Bezirk-Cooldown — erneut trainierbar in {cooldownRemaining}
          </div>
        )}
        <div style={{ fontSize: 12, color: "#a8b4cf", marginBottom: 14, lineHeight: 1.5 }}>
          Pro Bezirk darfst du nur alle <strong style={{ color: "#FF6BA1" }}>7 Tage</strong> trainieren. Komm einmal pro Woche vorbei, um <strong style={{ color: "#22D1C3" }}>+{sanctuary.xp_reward} Wächter-Erfahrung</strong> zu holen. Sanctuaries rotieren jede Nacht innerhalb des Bezirks — die ganze Stadt durch belohnt Reisen.
        </div>
        {distM !== null && (
          <div style={{
            fontSize: 11, marginBottom: 12, padding: "8px 12px", borderRadius: 10,
            background: inRange ? "rgba(74,222,128,0.12)" : "rgba(255,45,120,0.12)",
            border: inRange ? "1px solid #4ade80" : "1px solid rgba(255,45,120,0.5)",
            color: inRange ? "#4ade80" : "#FF6BA1",
            fontWeight: 800,
          }}>
            {inRange
              ? `✓ In Reichweite (${fmtDist(distM)})`
              : `📍 Du musst vor Ort sein — ${fmtDist(distM)} entfernt (max 50 m)`}
          </div>
        )}
        {distM === null && (
          <div style={{ fontSize: 11, marginBottom: 12, color: "#FF6BA1" }}>
            📍 GPS-Position nicht verfügbar
          </div>
        )}
        <button
          onClick={async () => { setTraining(true); await onTrain(); setTraining(false); }}
          disabled={disabled}
          style={{
            width: "100%", padding: "14px 20px", borderRadius: 12,
            background: done || onCooldown ? "rgba(74,222,128,0.2)" : !inRange ? "rgba(120,120,120,0.2)" : "linear-gradient(135deg, #22D1C3, #5ddaf0)",
            border: done ? "1px solid #4ade80" : onCooldown ? "1px solid #FF6BA1" : !inRange ? "1px solid rgba(255,255,255,0.1)" : "none",
            color: done ? "#4ade80" : onCooldown ? "#FF6BA1" : !inRange ? "#8B8FA3" : "#0F1115",
            fontSize: 14, fontWeight: 900, cursor: disabled ? "not-allowed" : "pointer", marginBottom: 8,
          }}
        >{done ? tMD("labelAlreadyTrainedToday") : onCooldown ? `🔒 Cooldown ${cooldownRemaining}` : training ? tMD("labelTraining") : !inRange ? tMD("labelTooFar") : tMD("labelTrainAction", { xp: sanctuary.xp_reward })}</button>
        <button onClick={onClose} style={{ width: "100%", padding: "8px 12px", borderRadius: 10, background: "transparent", border: "1px solid rgba(255,255,255,0.2)", color: "#a8b4cf", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>{tMD("labelBack")}</button>
      </div>
    </div>
  );
}
