"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { RoundEvent } from "@/lib/battle-engine";
import type { GuardianArchetype } from "@/lib/guardian";
import { GuardianAvatar, type AvatarAnimation } from "@/components/guardian-avatar";

export type SidePayload = {
  name: string;
  archetype: Pick<GuardianArchetype, "id" | "emoji" | "rarity">;
  level: number;
  maxHp: number;
};

type FloatNum = { id: number; x: number; y: number; text: string; color: string; crit: boolean };

export function CinematicBattleArena({
  sideA, sideB, rounds, onFinished,
}: {
  sideA: SidePayload;
  sideB: SidePayload;
  rounds: RoundEvent[];
  onFinished?: () => void;
}) {
  const [idx, setIdx] = useState(0);
  const [animA, setAnimA] = useState<AvatarAnimation>("idle");
  const [animB, setAnimB] = useState<AvatarAnimation>("idle");
  const [shake, setShake] = useState(false);
  const [flashColor, setFlashColor] = useState<string | null>(null);
  const [floats, setFloats] = useState<FloatNum[]>([]);
  const [bannerText, setBannerText] = useState<string | null>(null);
  const floatId = useRef(0);
  const [hpA, setHpA] = useState(sideA.maxHp);
  const [hpB, setHpB] = useState(sideB.maxHp);

  const event: RoundEvent | null = useMemo(() => rounds[idx] ?? null, [rounds, idx]);

  useEffect(() => {
    if (!event) return;
    const actor = event.actor;
    const victim = actor === "A" ? "B" : "A";
    const setActorAnim = actor === "A" ? setAnimA : setAnimB;
    const setVictimAnim = victim === "A" ? setAnimA : setAnimB;

    // Actor-Animation bestimmen
    if (event.action === "attack") setActorAnim("attack");
    else if (event.action === "crit") { setActorAnim("crit"); setShake(true); setFlashColor("#FFD700"); }
    else if (event.action === "miss") setVictimAnim("evade");
    else if (event.action === "flame" || event.action === "poison") setActorAnim("special");
    else if (event.action === "revive") setVictimAnim("revive");
    else if (event.action === "stunned") setActorAnim("hit");

    // Victim-Reaktion
    if (event.damage > 0 && event.action !== "flame" && event.action !== "poison") {
      setTimeout(() => setVictimAnim("hit"), 180);
    }

    // Flash
    if (event.action === "miss") setFlashColor("#22D1C3");

    // Banner fuer Specials
    if (event.note && (event.action === "crit" || event.action === "flame" || event.action === "poison" || event.action === "revive" || event.action === "stunned" || event.action === "special")) {
      setBannerText(event.note);
      setTimeout(() => setBannerText(null), 1100);
    }

    // Damage-Number
    if (event.damage > 0) {
      const side = victim === "A" ? "left" : "right";
      const newFloat: FloatNum = {
        id: ++floatId.current,
        x: side === "left" ? 18 : 72,
        y: 32,
        text: `-${event.damage}`,
        color: event.action === "crit" ? "#FFD700" : event.action === "flame" ? "#FF6B4A" : event.action === "poison" ? "#4ade80" : "#FF2D78",
        crit: event.action === "crit",
      };
      setFloats((f) => [...f, newFloat]);
      setTimeout(() => setFloats((f) => f.filter((x) => x.id !== newFloat.id)), 1400);
    }

    // HP aktualisieren (sofort synchron zur Animation)
    setTimeout(() => {
      setHpA(event.hp_a_after);
      setHpB(event.hp_b_after);
    }, 200);

    // Idle zurueck + shake/flash clear
    const t1 = setTimeout(() => { setAnimA("idle"); setAnimB("idle"); setShake(false); setFlashColor(null); }, 520);

    // Naechstes Event
    const delay = event.action === "crit" ? 900 : event.action === "revive" ? 1100 : 650;
    const t2 = setTimeout(() => {
      if (idx + 1 < rounds.length) setIdx(idx + 1);
      else {
        // KO-Animation
        if (event.hp_a_after <= 0) setAnimA("ko");
        if (event.hp_b_after <= 0) setAnimB("ko");
        setTimeout(() => onFinished?.(), 1200);
      }
    }, delay);

    return () => { clearTimeout(t1); clearTimeout(t2); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idx]);

  const pctA = Math.max(0, Math.min(100, (hpA / sideA.maxHp) * 100));
  const pctB = Math.max(0, Math.min(100, (hpB / sideB.maxHp) * 100));

  return (
    <div className={shake ? "arena-shake" : ""}
      style={{
        position: "relative",
        borderRadius: 16,
        overflow: "hidden",
        background: `radial-gradient(ellipse at center, rgba(168,85,247,0.25), rgba(15,17,21,0.95) 70%),
                     linear-gradient(180deg, #1a1d2b 0%, #0F1115 100%)`,
        border: "1px solid rgba(168,85,247,0.35)",
        padding: "12px 10px 8px",
      }}
    >
      {/* Background Grid / floor */}
      <div style={{
        position: "absolute", inset: 0, pointerEvents: "none",
        background: `repeating-linear-gradient(90deg, transparent 0 19px, rgba(168,85,247,0.06) 19px 20px),
                     repeating-linear-gradient(0deg,  transparent 0 19px, rgba(168,85,247,0.06) 19px 20px)`,
        maskImage: "radial-gradient(ellipse at 50% 80%, black, transparent 70%)",
      }} />
      {/* Spotlight */}
      <div style={{
        position: "absolute", bottom: 10, left: "50%", transform: "translateX(-50%)",
        width: 260, height: 30, borderRadius: "50%",
        background: "radial-gradient(ellipse, rgba(255,255,255,0.2), transparent 70%)",
        pointerEvents: "none",
      }} />

      {/* HP-Balken oben */}
      <div style={{ display: "flex", justifyContent: "space-between", gap: 8, position: "relative", zIndex: 2, marginBottom: 6 }}>
        <HpBar side="left" name={sideA.name} hp={hpA} max={sideA.maxHp} pct={pctA} level={sideA.level} />
        <HpBar side="right" name={sideB.name} hp={hpB} max={sideB.maxHp} pct={pctB} level={sideB.level} />
      </div>

      {/* Arena-Stage mit Avataren */}
      <div style={{ position: "relative", height: 200, display: "flex", justifyContent: "space-between", alignItems: "flex-end", padding: "0 8px", zIndex: 2 }}>
        <div style={{ flex: "0 0 40%", display: "flex", justifyContent: "center" }}>
          <GuardianAvatar archetype={sideA.archetype} size={130} animation={animA} facing="right" />
        </div>
        <div style={{ flex: "0 0 40%", display: "flex", justifyContent: "center" }}>
          <GuardianAvatar archetype={sideB.archetype} size={130} animation={animB} facing="left" />
        </div>

        {/* Damage-Numbers */}
        {floats.map((f) => (
          <div key={f.id}
            style={{
              position: "absolute", left: `${f.x}%`, top: `${f.y}%`,
              color: f.color, fontSize: f.crit ? 30 : 22, fontWeight: 900,
              textShadow: `0 2px 8px ${f.color}88, 0 0 20px ${f.color}66`,
              pointerEvents: "none", zIndex: 10,
              animation: "damage-float 1.4s cubic-bezier(0.2, 0.8, 0.3, 1) forwards",
            }}>
            {f.text}{f.crit && " !"}
          </div>
        ))}

        {/* Banner */}
        {bannerText && (
          <div style={{
            position: "absolute", top: "50%", left: "50%", transform: "translate(-50%, -50%)",
            padding: "6px 16px", borderRadius: 12,
            background: "linear-gradient(135deg, rgba(168,85,247,0.92), rgba(255,45,120,0.88))",
            color: "#FFF", fontSize: 14, fontWeight: 900, letterSpacing: 1,
            textShadow: "0 2px 6px rgba(0,0,0,0.7)",
            boxShadow: "0 0 30px rgba(168,85,247,0.8)",
            animation: "banner-pop 1.1s cubic-bezier(0.34, 1.56, 0.64, 1) forwards",
            pointerEvents: "none", zIndex: 20,
          }}>
            {bannerText}
          </div>
        )}

        {/* Flash-Overlay */}
        {flashColor && (
          <div style={{
            position: "absolute", inset: 0,
            background: `radial-gradient(ellipse at center, ${flashColor}44, transparent 70%)`,
            pointerEvents: "none", zIndex: 5,
            animation: "flash-fade 0.5s ease-out forwards",
          }} />
        )}
      </div>

      {/* Rundentext unten */}
      <div style={{ position: "relative", zIndex: 2, marginTop: 8, textAlign: "center", minHeight: 32 }}>
        {event ? (
          <div style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "4px 12px", borderRadius: 999, background: "rgba(15,17,21,0.7)", border: "1px solid rgba(168,85,247,0.3)" }}>
            <span style={{ color: "#a855f7", fontSize: 10, fontWeight: 900, letterSpacing: 1 }}>RUNDE {event.round}</span>
            <span style={{ color: "#a8b4cf", fontSize: 11 }}>
              {event.actor === "A" ? sideA.name : sideB.name}
              {event.action === "attack" && " greift an"}
              {event.action === "crit" && " · Kritischer Treffer!"}
              {event.action === "miss" && " · Fehlschlag"}
              {event.action === "flame" && " · Flammenangriff"}
              {event.action === "poison" && " · Gift"}
              {event.action === "revive" && " · Auferstanden!"}
              {event.action === "stunned" && " · Betäubt"}
            </span>
          </div>
        ) : (
          <span style={{ color: "#a8b4cf", fontSize: 11 }}>Bereit…</span>
        )}
      </div>

      <style jsx>{`
        .arena-shake { animation: arena-shake 0.4s; }
        @keyframes arena-shake {
          0%, 100% { transform: translate(0); }
          20% { transform: translate(-4px, 2px); }
          40% { transform: translate(4px, -2px); }
          60% { transform: translate(-3px, 1px); }
          80% { transform: translate(3px, -1px); }
        }
        @keyframes damage-float {
          0%   { transform: translate(0, 0)    scale(0.7); opacity: 0; }
          15%  { transform: translate(0, -6px) scale(1.15); opacity: 1; }
          60%  { transform: translate(0, -30px) scale(1);  opacity: 1; }
          100% { transform: translate(0, -60px) scale(0.8); opacity: 0; }
        }
        @keyframes banner-pop {
          0%   { transform: translate(-50%, -50%) scale(0.3) rotate(-6deg); opacity: 0; }
          35%  { transform: translate(-50%, -50%) scale(1.15) rotate(2deg); opacity: 1; }
          70%  { transform: translate(-50%, -50%) scale(1) rotate(0deg);    opacity: 1; }
          100% { transform: translate(-50%, -50%) scale(0.95) rotate(0);     opacity: 0; }
        }
        @keyframes flash-fade {
          0% { opacity: 1; }
          100% { opacity: 0; }
        }
      `}</style>
    </div>
  );
}

function HpBar({ side, name, hp, max, pct, level }: { side: "left" | "right"; name: string; hp: number; max: number; pct: number; level: number }) {
  const align = side === "left" ? "flex-start" : "flex-end";
  const barColor = pct > 50 ? "linear-gradient(90deg, #4ade80, #22D1C3)" : pct > 25 ? "linear-gradient(90deg, #FFD700, #FF6B4A)" : "linear-gradient(90deg, #FF2D78, #FF6B4A)";
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: align, flex: 1, maxWidth: 220 }}>
      <div style={{ fontSize: 11, fontWeight: 900, color: "#FFF", textAlign: side, textShadow: "0 1px 3px rgba(0,0,0,0.8)" }}>
        {name} <span style={{ color: "#a8b4cf", fontWeight: 700 }}>· Lv {level}</span>
      </div>
      <div style={{
        width: "100%", height: 10, borderRadius: 5,
        background: "rgba(0,0,0,0.55)",
        border: "1px solid rgba(255,255,255,0.15)",
        overflow: "hidden", marginTop: 3,
        boxShadow: "inset 0 1px 3px rgba(0,0,0,0.5)",
      }}>
        <div style={{
          height: "100%", width: `${pct}%`,
          background: barColor,
          transition: "width 0.35s cubic-bezier(0.3, 0.8, 0.3, 1)",
          boxShadow: "0 0 12px currentColor",
          direction: side === "right" ? "rtl" : "ltr",
          marginLeft: side === "right" ? "auto" : 0,
        }} />
      </div>
      <div style={{ color: "#a8b4cf", fontSize: 9, marginTop: 2, fontVariantNumeric: "tabular-nums" }}>
        {hp} / {max}
      </div>
    </div>
  );
}
