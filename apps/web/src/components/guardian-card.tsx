"use client";

import { rarityMeta, statsAtLevel, xpForLevel, GUARDIAN_LEVEL_CAP, TYPE_META, type GuardianWithArchetype } from "@/lib/guardian";
import { GuardianAvatar } from "@/components/guardian-avatar";

export function GuardianCard({ guardian, compact = false, onClick }: {
  guardian: GuardianWithArchetype;
  compact?: boolean;
  onClick?: () => void;
}) {
  const rarity = rarityMeta(guardian.archetype.rarity);
  const typeInfo = guardian.archetype.guardian_type ? TYPE_META[guardian.archetype.guardian_type] : null;
  const stats = statsAtLevel(guardian.archetype, guardian.level);
  const wounded = guardian.wounded_until && new Date(guardian.wounded_until).getTime() > Date.now();
  const xpNext = xpForLevel(guardian.level);
  const xpPct = Math.min(100, Math.round((guardian.xp / xpNext) * 100));

  if (compact) {
    return (
      <div
        onClick={onClick}
        style={{
          display: "flex", alignItems: "center", gap: 10,
          padding: 10, borderRadius: 12,
          background: `linear-gradient(135deg, ${rarity.glow}, rgba(26,29,35,0.85))`,
          border: `1px solid ${rarity.color}66`,
          cursor: onClick ? "pointer" : "default",
        }}
      >
        <div style={{ width: 52, height: 65, flexShrink: 0 }}>
          <GuardianAvatar archetype={guardian.archetype} size={52} animation="idle" />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ color: rarity.color, fontSize: 10, fontWeight: 900, letterSpacing: 1 }}>
            {rarity.label.toUpperCase()} · Lv {guardian.level}
          </div>
          <div style={{ color: "#FFF", fontSize: 13, fontWeight: 900, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
            {guardian.custom_name ?? guardian.archetype.name}
          </div>
        </div>
        <div style={{ color: "#FFD700", fontSize: 10, fontWeight: 800 }}>
          {guardian.wins}W / {guardian.losses}L
        </div>
      </div>
    );
  }

  return (
    <div
      onClick={onClick}
      style={{
        padding: 16, borderRadius: 16,
        background: `linear-gradient(180deg, ${rarity.glow}, rgba(26,29,35,0.95))`,
        border: `2px solid ${rarity.color}`,
        boxShadow: `0 0 30px ${rarity.glow}`,
        cursor: onClick ? "pointer" : "default",
        position: "relative", overflow: "hidden",
      }}
    >
      {wounded && (
        <div style={{
          position: "absolute", top: 8, right: 8,
          padding: "2px 8px", borderRadius: 10,
          background: "rgba(255,45,120,0.2)", border: "1px solid #FF2D78",
          color: "#FF2D78", fontSize: 9, fontWeight: 900, letterSpacing: 1,
        }}>
          VERWUNDET
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "minmax(160px, 240px) 1fr", gap: 20, alignItems: "stretch" }}>
        {/* Avatar-Spalte */}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10 }}>
          <div style={{ width: "100%", aspectRatio: "1 / 1.25", display: "flex", justifyContent: "center" }}>
            <GuardianAvatar archetype={guardian.archetype} size={220} animation="idle" />
          </div>
          {guardian.archetype.lore && (
            <div style={{ color: "#a8b4cf", fontSize: 10, fontStyle: "italic", textAlign: "center", maxWidth: "100%" }}>
              „{guardian.archetype.lore}"
            </div>
          )}
        </div>

        {/* Info-Spalte */}
        <div style={{ display: "flex", flexDirection: "column", gap: 10, minWidth: 0 }}>
          <div>
            <div style={{ color: rarity.color, fontSize: 10, fontWeight: 900, letterSpacing: 2 }}>
              {rarity.label.toUpperCase()}{typeInfo ? ` · ${typeInfo.icon} ${typeInfo.label}` : ""}
            </div>
            <div style={{ color: "#FFF", fontSize: 20, fontWeight: 900 }}>
              {guardian.custom_name ?? guardian.archetype.name}
            </div>
            <div style={{ color: "#a8b4cf", fontSize: 11 }}>
              Level {guardian.level} · {guardian.wins} Siege / {guardian.losses} Niederlagen
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 6 }}>
            <Stat label="HP"  value={stats.hp}  color="#4ade80" />
            <Stat label="ATK" value={stats.atk} color="#FF6B4A" />
            <Stat label="DEF" value={stats.def} color="#5ddaf0" />
            <Stat label="SPD" value={stats.spd} color="#FFD700" />
          </div>

          {guardian.level < GUARDIAN_LEVEL_CAP && (
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: "#a8b4cf", marginBottom: 3 }}>
                <span>XP</span>
                <span>{guardian.xp} / {xpNext}</span>
              </div>
              <div style={{ height: 6, background: "rgba(255,255,255,0.1)", borderRadius: 3, overflow: "hidden" }}>
                <div style={{ width: `${xpPct}%`, height: "100%", background: rarity.color, transition: "width 0.3s" }} />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div style={{ padding: "6px 4px", borderRadius: 8, background: "rgba(15,17,21,0.6)", textAlign: "center" }}>
      <div style={{ color: "#8B8FA3", fontSize: 9, fontWeight: 800, letterSpacing: 1 }}>{label}</div>
      <div style={{ color, fontSize: 15, fontWeight: 900, marginTop: 2 }}>{value}</div>
    </div>
  );
}
