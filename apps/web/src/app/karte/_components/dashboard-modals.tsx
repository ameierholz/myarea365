"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";

function fmtRemaining(target: string | null | undefined): string | null {
  if (!target) return null;
  const ms = new Date(target).getTime() - Date.now();
  if (ms <= 0) return null;
  const totalH = Math.floor(ms / 3_600_000);
  const d = Math.floor(totalH / 24);
  const h = totalH % 24;
  const m = Math.floor((ms % 3_600_000) / 60_000);
  if (d > 0) return h > 0 ? `${d}d ${h}h` : `${d}d`;
  if (totalH > 0) return `${totalH}h ${m}m`;
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
export function BossRaidModal({ boss, myCrewId, onClose, onAttack }: {
  boss: {
    id: string; name: string; emoji: string; max_hp: number; current_hp: number;
    image_url?: string | null; video_url?: string | null;
    claimed_by_crew_id?: string | null;
    claim_expires_at?: string | null;
  };
  myCrewId: string | null;
  onClose: () => void;
  onAttack: () => void | Promise<void>;
}) {
  const tMD = useTranslations("MapDashboard");
  const pct = Math.round((boss.current_hp / boss.max_hp) * 100);
  const [attacking, setAttacking] = useState(false);
  const [claimRemaining, setClaimRemaining] = useState<string | null>(fmtRemaining(boss.claim_expires_at));
  useEffect(() => {
    if (!boss.claim_expires_at) { setClaimRemaining(null); return; }
    const tick = () => setClaimRemaining(fmtRemaining(boss.claim_expires_at));
    tick();
    const id = setInterval(tick, 30_000);
    return () => clearInterval(id);
  }, [boss.claim_expires_at]);
  const claimActive = !!boss.claim_expires_at && new Date(boss.claim_expires_at).getTime() > Date.now() && !!boss.claimed_by_crew_id;
  const claimedByOther = claimActive && boss.claimed_by_crew_id !== myCrewId;
  const claimedByMe = claimActive && boss.claimed_by_crew_id === myCrewId;
  const blocked = claimedByOther;
  const artStyle: React.CSSProperties = {
    width: 96, height: 96, objectFit: "contain", display: "block",
    clipPath: "inset(5.5%)",
    filter: "url(#ma365-chromakey)",
  };
  return (
    <div onClick={onClose} style={{
      position: "fixed", inset: 0, zIndex: 9100, background: "transparent",
      pointerEvents: "auto",
    }}>
      <div onClick={(e) => e.stopPropagation()} style={{
        position: "absolute",
        right: 12, top: "50%", transform: "translateY(-50%)",
        width: "min(340px, calc(100vw - 24px))",
        maxHeight: "calc(100dvh - 24px)", overflowY: "auto",
        background: "linear-gradient(160deg, #2a0618 0%, #0F1115 90%)",
        borderRadius: 14, padding: 12,
        border: "2px solid rgba(255,45,120,0.7)",
        color: "#FFF",
        boxShadow: "0 0 40px rgba(255,45,120,0.5), 0 4px 24px rgba(0,0,0,0.6)",
      }}>
        <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 10 }}>
          {boss.video_url ? (
            <video src={boss.video_url} autoPlay loop muted playsInline style={artStyle} />
          ) : boss.image_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={boss.image_url} alt={boss.name} style={artStyle} />
          ) : (
            <div style={{ fontSize: 56, lineHeight: 1 }}>{boss.emoji}</div>
          )}
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ fontSize: 10, color: "#FF6BA1", fontWeight: 800, letterSpacing: 0.6, marginBottom: 2 }}>AREA-BOSS · LEGENDÄRER RAID</div>
            <div style={{ fontSize: 16, fontWeight: 900, lineHeight: 1.15, marginBottom: 6 }}>{boss.name}</div>
            <div style={{ height: 8, background: "rgba(0,0,0,0.6)", borderRadius: 4, overflow: "hidden", border: "1px solid rgba(255,255,255,0.2)" }}>
              <div style={{ height: "100%", width: `${pct}%`, background: "linear-gradient(90deg, #FF2D78, #FFD700)", transition: "width 0.4s" }} />
            </div>
            <div style={{ fontSize: 10, color: "#a8b4cf", marginTop: 3 }}>
              {boss.current_hp.toLocaleString()} / {boss.max_hp.toLocaleString()} ({pct}%)
            </div>
          </div>
        </div>

        {claimedByMe && (
          <div style={{ fontSize: 11, color: "#4ade80", fontWeight: 800, marginBottom: 8, padding: "6px 10px", borderRadius: 10, background: "rgba(74,222,128,0.12)", border: "1px solid rgba(74,222,128,0.4)" }}>
            🔒 Eure Crew belagert — frei in {claimRemaining ?? "30m"}
          </div>
        )}
        {claimedByOther && (
          <div style={{ fontSize: 11, color: "#FF6BA1", fontWeight: 800, marginBottom: 8, padding: "6px 10px", borderRadius: 10, background: "rgba(255,45,120,0.12)", border: "1px solid rgba(255,45,120,0.4)" }}>
            ⛔ Andere Crew belagert — frei in {claimRemaining ?? "30m"}
          </div>
        )}

        <div style={{
          fontSize: 10, color: "#a8b4cf", lineHeight: 1.45, marginBottom: 8,
          padding: "8px 10px", borderRadius: 10,
          background: "rgba(168,85,247,0.08)", border: "1px solid rgba(168,85,247,0.25)",
        }}>
          Der erste Angriff sperrt den Boss <b style={{ color: "#FFF" }}>30 Min für deine Crew</b>. Andere Crews können erst danach angreifen. Schafft ihr ihn rechtzeitig, gehört der Loot euch.
        </div>

        <div style={{
          display: "flex", justifyContent: "space-around", gap: 6,
          marginBottom: 10,
          padding: "8px 10px", borderRadius: 10,
          background: "rgba(255,215,0,0.06)",
          border: "1px solid rgba(255,215,0,0.2)",
        }}>
          <div style={{ textAlign: "center" }}>
            <div style={{ color: "#FFD700", fontSize: 10, fontWeight: 900 }}>🏆</div>
            <div style={{ color: "#FFD700", fontSize: 9, fontWeight: 800 }}>Legend</div>
          </div>
          <div style={{ textAlign: "center" }}>
            <div style={{ color: "#a855f7", fontSize: 10, fontWeight: 900 }}>💎</div>
            <div style={{ color: "#a855f7", fontSize: 9, fontWeight: 800 }}>Epic</div>
          </div>
          <div style={{ textAlign: "center" }}>
            <div style={{ color: "#22D1C3", fontSize: 10, fontWeight: 900 }}>💠</div>
            <div style={{ color: "#22D1C3", fontSize: 9, fontWeight: 800 }}>Rare</div>
          </div>
        </div>

        <button
          onClick={async () => { setAttacking(true); await onAttack(); setAttacking(false); }}
          disabled={attacking || blocked}
          style={{
            width: "100%", padding: "12px 18px", borderRadius: 12,
            background: blocked ? "rgba(255,45,120,0.15)" : "linear-gradient(135deg, #FF2D78, #a855f7)",
            border: blocked ? "1px solid rgba(255,45,120,0.4)" : "none",
            color: blocked ? "#FF6BA1" : "#FFF",
            fontSize: 14, fontWeight: 900,
            cursor: (attacking || blocked) ? "not-allowed" : "pointer",
            marginBottom: 6, letterSpacing: 0.5,
            boxShadow: blocked ? "none" : "0 4px 14px rgba(255,45,120,0.5)",
          }}
        >{blocked ? "⛔ Belagert" : attacking ? tMD("labelAttacking") : tMD("labelAttack")}</button>
        <button onClick={onClose} style={{ width: "100%", padding: "6px 12px", borderRadius: 10, background: "transparent", border: "1px solid rgba(255,255,255,0.2)", color: "#a8b4cf", fontSize: 10, fontWeight: 700, cursor: "pointer" }}>{tMD("labelBack")}</button>
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

// Zeit bis Mitternacht in Europe/Berlin (Ortszeit). Sanktums wechseln Standort
// täglich um 00:00 — Anzeige zeigt wie lang das aktuelle Sanktum noch da ist.
function fmtUntilMidnightBerlin(): string {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: "Europe/Berlin",
    hour12: false,
    hour: "2-digit",
    minute: "2-digit",
  });
  const parts = fmt.formatToParts(new Date());
  const hh = parseInt(parts.find((p) => p.type === "hour")?.value ?? "0", 10);
  const mm = parseInt(parts.find((p) => p.type === "minute")?.value ?? "0", 10);
  const minutesUntilMidnight = (24 * 60) - (hh * 60 + mm);
  const h = Math.floor(minutesUntilMidnight / 60);
  const m = minutesUntilMidnight % 60;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

/* ═══ Sanctuary Modal — kompaktes Side-Panel, GPS-Pflicht (vor Ort sein) ═══ */
export function SanctuaryModal({ sanctuary, distM, inRange, onClose, onTrain }: {
  sanctuary: { id: string; name: string; emoji: string; xp_reward: number; trained_today?: boolean; valid_until?: string | null; cooldown_until?: string | null; image_url?: string | null; video_url?: string | null };
  distM: number | null;
  inRange: boolean;
  onClose: () => void;
  onTrain: () => void | Promise<void>;
}) {
  const tMD = useTranslations("MapDashboard");
  const [training, setTraining] = useState(false);
  const [switchIn, setSwitchIn] = useState<string>(fmtUntilMidnightBerlin());
  const [cooldownRemaining, setCooldownRemaining] = useState<string | null>(fmtCooldownLong(sanctuary.cooldown_until));
  useEffect(() => {
    const tick = () => setSwitchIn(fmtUntilMidnightBerlin());
    tick();
    const id = setInterval(tick, 60_000);
    return () => clearInterval(id);
  }, []);
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
  const artStyle: React.CSSProperties = {
    width: 84, height: 84, objectFit: "contain", display: "block",
    clipPath: "inset(5.5%)",
    filter: "url(#ma365-chromakey)",
    background: "transparent",
  };
  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 9100, background: "transparent" }}>
      <div onClick={(e) => e.stopPropagation()} style={{
        position: "absolute",
        right: 12, top: "50%", transform: "translateY(-50%)",
        width: "min(320px, calc(100vw - 24px))",
        maxHeight: "calc(100dvh - 24px)", overflowY: "auto",
        background: "linear-gradient(160deg, #002b30 0%, #0F1115 90%)",
        borderRadius: 14, padding: 12,
        border: "2px solid rgba(34,209,195,0.6)",
        color: "#FFF",
        boxShadow: "0 0 30px rgba(34,209,195,0.4), 0 4px 24px rgba(0,0,0,0.6)",
      }}>
        <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 10 }}>
          {sanctuary.video_url ? (
            <video src={sanctuary.video_url} autoPlay loop muted playsInline style={artStyle} />
          ) : sanctuary.image_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={sanctuary.image_url} alt={sanctuary.name} style={artStyle} />
          ) : (
            <div style={{ fontSize: 48, lineHeight: 1, width: 84, textAlign: "center" }}>{sanctuary.emoji}</div>
          )}
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ fontSize: 10, color: "#5ddaf0", fontWeight: 800, letterSpacing: 0.6, marginBottom: 2 }}>WÄCHTER-SANKTUM</div>
            <div style={{ fontSize: 16, fontWeight: 900, lineHeight: 1.15, marginBottom: 4 }}>{sanctuary.name}</div>
            <div style={{ fontSize: 10, color: "#22D1C3", fontWeight: 800 }}>+{sanctuary.xp_reward} Wächter-Erfahrung</div>
          </div>
        </div>

        {onCooldown ? (
          <div style={{ fontSize: 11, color: "#FF6BA1", fontWeight: 800, marginBottom: 8, padding: "6px 10px", borderRadius: 10, background: "rgba(255,45,120,0.12)", border: "1px solid rgba(255,45,120,0.4)" }}>
            🔒 Bezirk-Cooldown — frei in {cooldownRemaining}
          </div>
        ) : (
          <div style={{ fontSize: 10, color: "#FFD700", fontWeight: 800, marginBottom: 8, padding: "5px 10px", borderRadius: 999, background: "rgba(255,215,0,0.1)", border: "1px solid rgba(255,215,0,0.3)", display: "inline-block" }}>
            ⏳ Standortwechsel in: {switchIn}
          </div>
        )}

        <div style={{ fontSize: 10, color: "#a8b4cf", lineHeight: 1.45, marginBottom: 8, padding: "8px 10px", borderRadius: 10, background: "rgba(34,209,195,0.06)", border: "1px solid rgba(34,209,195,0.2)" }}>
          Belohnung: <b style={{ color: "#22D1C3" }}>+{sanctuary.xp_reward} Erfahrung</b> — damit kannst du einen deiner aktivierten Wächter trainieren.
        </div>

        {distM !== null && Number.isFinite(distM) && !onCooldown && (
          <div style={{
            fontSize: 11, marginBottom: 8, padding: "6px 10px", borderRadius: 10,
            background: inRange ? "rgba(74,222,128,0.12)" : "rgba(255,45,120,0.12)",
            border: inRange ? "1px solid #4ade80" : "1px solid rgba(255,45,120,0.5)",
            color: inRange ? "#4ade80" : "#FF6BA1",
            fontWeight: 800,
          }}>
            {inRange ? `✓ In Reichweite (${fmtDist(distM)})` : `📍 ${fmtDist(distM)} entfernt — geh näher ran (max 50 m)`}
          </div>
        )}
        {(distM === null || !Number.isFinite(distM ?? NaN)) && !onCooldown && (
          <div style={{ fontSize: 10, marginBottom: 8, color: "#FF6BA1", fontWeight: 700 }}>
            📍 GPS-Position nicht verfügbar
          </div>
        )}

        <button
          onClick={async () => { setTraining(true); await onTrain(); setTraining(false); }}
          disabled={disabled}
          style={{
            width: "100%", padding: "12px 18px", borderRadius: 12,
            background: done || onCooldown ? "rgba(74,222,128,0.18)" : !inRange ? "rgba(120,120,120,0.2)" : "linear-gradient(135deg, #22D1C3, #5ddaf0)",
            border: done ? "1px solid #4ade80" : onCooldown ? "1px solid #FF6BA1" : !inRange ? "1px solid rgba(255,255,255,0.1)" : "none",
            color: done ? "#4ade80" : onCooldown ? "#FF6BA1" : !inRange ? "#8B8FA3" : "#0F1115",
            fontSize: 14, fontWeight: 900, cursor: disabled ? "not-allowed" : "pointer", marginBottom: 6,
          }}
        >{done ? tMD("labelAlreadyTrainedToday") : onCooldown ? `🔒 Cooldown ${cooldownRemaining}` : training ? tMD("labelTraining") : !inRange ? tMD("labelTooFar") : tMD("labelTrainAction", { XP: sanctuary.xp_reward })}</button>
        <button onClick={onClose} style={{ width: "100%", padding: "6px 12px", borderRadius: 10, background: "transparent", border: "1px solid rgba(255,255,255,0.2)", color: "#a8b4cf", fontSize: 10, fontWeight: 700, cursor: "pointer" }}>{tMD("labelBack")}</button>
      </div>
    </div>
  );
}
