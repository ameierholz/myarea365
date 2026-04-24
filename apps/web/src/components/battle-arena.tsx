"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { RoundEvent, SideStatus } from "@/lib/battle-engine";
import type { GuardianArchetype } from "@/lib/guardian";
import { GuardianAvatar, type AvatarAnimation } from "@/components/guardian-avatar";

export type SidePayload = {
  name: string;
  archetype: {
    id: GuardianArchetype["id"];
    emoji: GuardianArchetype["emoji"];
    rarity: GuardianArchetype["rarity"];
    image_url?: string | null;
    video_url?: string | null;
  };
  level: number;
  maxHp: number;
};

type FloatNum = { id: number; x: number; y: number; text: string; color: string; crit: boolean };
type Spark  = { id: number; angle: number; distance: number; color: string };
type Commentary = { id: number; text: string; tone: "normal" | "crit" | "heal" | "miss" | "ko" };

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
  const [shake, setShake] = useState<"none" | "soft" | "hard">("none");
  const [flashColor, setFlashColor] = useState<string | null>(null);
  const [floats, setFloats] = useState<FloatNum[]>([]);
  const [bannerText, setBannerText] = useState<string | null>(null);
  const [slashKey, setSlashKey] = useState(0);
  const [slashDirection, setSlashDirection] = useState<"A" | "B">("A");
  const [critBurstKey, setCritBurstKey] = useState(0);
  const [lunge, setLunge] = useState<"none" | "A" | "B">("none");
  const [shockwave, setShockwave] = useState<{ id: number; side: "A" | "B"; power: number } | null>(null);
  const [sparks, setSparks] = useState<Spark[]>([]);
  const [commentary, setCommentary] = useState<Commentary | null>(null);
  const [zoom, setZoom] = useState(false);
  const [chroma, setChroma] = useState(false);
  const [koFade, setKoFade] = useState(false);
  const [speedLinesKey, setSpeedLinesKey] = useState<{ id: number; side: "A" | "B" } | null>(null);
  const floatId = useRef(0);
  const sparkId = useRef(0);
  const commentId = useRef(0);
  const [hpA, setHpA] = useState(sideA.maxHp);
  const [hpB, setHpB] = useState(sideB.maxHp);

  const event: RoundEvent | null = useMemo(() => rounds[idx] ?? null, [rounds, idx]);

  useEffect(() => {
    if (!event) return;
    const actor = event.actor;
    const victim: "A" | "B" = actor === "A" ? "B" : "A";
    const setActorAnim = actor === "A" ? setAnimA : setAnimB;
    const setVictimAnim = victim === "A" ? setAnimA : setAnimB;

    // Actor-Animation bestimmen
    if (event.action === "attack") {
      setActorAnim("attack");
      setSlashDirection(actor); setSlashKey((k) => k + 1);
      setLunge(actor);
      setSpeedLinesKey({ id: Date.now(), side: actor });
    } else if (event.action === "crit" || event.action === "ult") {
      setActorAnim("crit");
      setShake("hard"); setFlashColor("#FFD700");
      setSlashDirection(actor); setSlashKey((k) => k + 1);
      setCritBurstKey((k) => k + 1);
      setLunge(actor);
      setZoom(true);
      setChroma(true);
      setSpeedLinesKey({ id: Date.now(), side: actor });
    } else if (event.action === "miss") {
      setVictimAnim("evade");
      setFlashColor("#22D1C3");
    } else if (event.action === "flame" || event.action === "poison") {
      setActorAnim("special");
    } else if (event.action === "revive") {
      setVictimAnim("revive");
    } else if (event.action === "stunned") {
      setActorAnim("hit");
    }

    // Victim-Reaktion + Shockwave + Sparks
    if (event.damage > 0 && event.action !== "flame" && event.action !== "poison" && event.action !== "heal") {
      setTimeout(() => {
        setVictimAnim("hit");
        setShockwave({ id: Date.now(), side: victim, power: event.action === "crit" || event.action === "ult" ? 1.6 : 1 });
        // Hit-Sparks (mehr bei Crits)
        const count = event.action === "crit" || event.action === "ult" ? 18 : 10;
        const newSparks: Spark[] = Array.from({ length: count }).map(() => ({
          id: ++sparkId.current,
          angle: Math.random() * 360,
          distance: 40 + Math.random() * 60,
          color: event.action === "crit" || event.action === "ult" ? "#FFD700" : "#FF6B4A",
        }));
        setSparks((s) => [...s, ...newSparks]);
        setTimeout(() => setSparks((s) => s.filter((x) => !newSparks.includes(x))), 900);
      }, 260);
      if (shake === "none") setShake("soft");
    }

    // Commentary — dramatic
    const comment = buildCommentary(event, actor === "A" ? sideA.name : sideB.name, victim === "A" ? sideA.name : sideB.name);
    if (comment) {
      const c: Commentary = { id: ++commentId.current, text: comment.text, tone: comment.tone };
      setCommentary(c);
      setTimeout(() => setCommentary((cur) => cur?.id === c.id ? null : cur), 1800);
    }

    // Banner für Specials
    if (event.note && (event.action === "crit" || event.action === "flame" || event.action === "poison" || event.action === "revive" || event.action === "stunned" || event.action === "special")) {
      setBannerText(event.note);
      setTimeout(() => setBannerText(null), 1300);
    }

    // Damage-Number (oder Heal)
    if (event.damage > 0) {
      const isHeal = event.action === "heal";
      const floatSide = isHeal
        ? (actor === "A" ? "left" : "right")
        : (victim === "A" ? "left" : "right");
      const newFloat: FloatNum = {
        id: ++floatId.current,
        x: floatSide === "left" ? 22 : 78,
        y: 28,
        text: isHeal ? `+${event.damage}` : `-${event.damage}`,
        color: isHeal ? "#4ade80"
          : event.action === "crit" || event.action === "ult" ? "#FFD700"
          : event.action === "flame" ? "#FF6B4A"
          : event.action === "poison" ? "#a855f7"
          : "#FF2D78",
        crit: event.action === "crit" || event.action === "ult",
      };
      setFloats((f) => [...f, newFloat]);
      setTimeout(() => setFloats((f) => f.filter((x) => x.id !== newFloat.id)), 1600);
    }

    // HP aktualisieren synchron zur Animation
    setTimeout(() => {
      setHpA(event.hp_a_after);
      setHpB(event.hp_b_after);
    }, 280);

    // Clear transient effekte
    const t1 = setTimeout(() => {
      setAnimA("idle"); setAnimB("idle");
      setShake("none"); setFlashColor(null);
      setLunge("none"); setZoom(false); setChroma(false);
    }, 900);

    // Nächstes Event — deutlich länger für dramatischere Kämpfe
    const baseDelay = event.action === "crit" || event.action === "ult" ? 2400
                    : event.action === "revive" ? 2600
                    : event.action === "heal" ? 1500
                    : event.action === "miss" ? 1300
                    : 1700;
    const isFinalRound = idx + 1 >= rounds.length;
    // KO → Slow-Mo
    const delay = isFinalRound && (event.hp_a_after <= 0 || event.hp_b_after <= 0) ? baseDelay + 1500 : baseDelay;

    const t2 = setTimeout(() => {
      if (idx + 1 < rounds.length) setIdx(idx + 1);
      else {
        if (event.hp_a_after <= 0) setAnimA("ko");
        if (event.hp_b_after <= 0) setAnimB("ko");
        const koSide = event.hp_a_after <= 0 ? "A" : event.hp_b_after <= 0 ? "B" : null;
        if (koSide) {
          setKoFade(true);
          const koName = koSide === "A" ? sideA.name : sideB.name;
          const winName = koSide === "A" ? sideB.name : sideA.name;
          setCommentary({ id: ++commentId.current, text: `🏆 ${winName.toUpperCase()} BEENDET ${koName.toUpperCase()}`, tone: "ko" });
          setShake("hard");
          setTimeout(() => setShake("none"), 600);
        }
        setTimeout(() => onFinished?.(), 2000);
      }
    }, delay);

    return () => { clearTimeout(t1); clearTimeout(t2); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idx]);

  const pctA = Math.max(0, Math.min(100, (hpA / sideA.maxHp) * 100));
  const pctB = Math.max(0, Math.min(100, (hpB / sideB.maxHp) * 100));

  const shakeClass = shake === "hard" ? "arena-shake-hard" : shake === "soft" ? "arena-shake-soft" : "";

  return (
    <div
      className={shakeClass}
      style={{
        position: "relative",
        borderRadius: 16,
        overflow: "hidden",
        background: `radial-gradient(ellipse at 50% 100%, rgba(168,85,247,0.35), transparent 60%),
                     radial-gradient(ellipse at 50% 0%, rgba(255,45,120,0.18), transparent 55%),
                     linear-gradient(180deg, #0a0614 0%, #1a0e2e 40%, #0F1115 100%)`,
        border: "1px solid rgba(168,85,247,0.4)",
        padding: "12px 10px 8px",
        boxShadow: "inset 0 0 60px rgba(0,0,0,0.5)",
        transition: "filter 0.3s ease-out, opacity 0.3s ease-out",
        filter: chroma ? "saturate(1.3) contrast(1.08)" : undefined,
        opacity: koFade ? 0.88 : 1,
      }}
    >
      {/* ═══ PARALLAX BACKGROUND ═══ */}
      {/* Layer 1: entfernte Sterne */}
      <div aria-hidden style={{
        position: "absolute", inset: 0, pointerEvents: "none", opacity: 0.45,
        background: `radial-gradient(1px 1px at 12% 18%, #FFF, transparent),
                     radial-gradient(1px 1px at 23% 72%, #c084fc, transparent),
                     radial-gradient(1px 1px at 45% 30%, #FFF, transparent),
                     radial-gradient(2px 2px at 68% 55%, #FFD700, transparent),
                     radial-gradient(1px 1px at 85% 22%, #FFF, transparent),
                     radial-gradient(1px 1px at 92% 78%, #22D1C3, transparent)`,
        backgroundSize: "200px 200px",
        animation: "parallax-stars 120s linear infinite",
      }} />
      {/* Layer 2: Gitter-Boden */}
      <div aria-hidden style={{
        position: "absolute", inset: 0, pointerEvents: "none",
        background: `repeating-linear-gradient(90deg, transparent 0 39px, rgba(168,85,247,0.1) 39px 40px),
                     repeating-linear-gradient(0deg,  transparent 0 39px, rgba(168,85,247,0.1) 39px 40px)`,
        maskImage: "linear-gradient(180deg, transparent 0%, transparent 45%, rgba(0,0,0,0.8) 70%, transparent 100%)",
        transform: "perspective(400px) rotateX(55deg)",
        transformOrigin: "center bottom",
      }} />
      {/* Layer 3: Bodennebel */}
      <div aria-hidden style={{
        position: "absolute", bottom: 0, left: 0, right: 0, height: "40%",
        pointerEvents: "none",
        background: "linear-gradient(180deg, transparent 0%, rgba(168,85,247,0.2) 60%, rgba(255,45,120,0.15) 100%)",
        filter: "blur(8px)",
        animation: "fog-drift 20s ease-in-out infinite alternate",
      }} />
      {/* Layer 4: floating Partikel */}
      <div aria-hidden style={{ position: "absolute", inset: 0, pointerEvents: "none", zIndex: 1 }}>
        {Array.from({ length: 14 }).map((_, i) => (
          <div key={i} style={{
            position: "absolute",
            left: `${(i * 7.3) % 100}%`,
            bottom: `-${10 + (i * 3) % 20}%`,
            width: 2 + (i % 3), height: 2 + (i % 3),
            borderRadius: 999,
            background: i % 3 === 0 ? "#FFD70088" : i % 3 === 1 ? "#22D1C388" : "#a855f788",
            boxShadow: "0 0 6px currentColor",
            animation: `particle-rise ${8 + (i % 5) * 1.2}s linear ${i * 0.4}s infinite`,
          }} />
        ))}
      </div>
      {/* Spotlight (unter den Kämpfern) */}
      <div aria-hidden style={{
        position: "absolute", bottom: 10, left: "50%", transform: "translateX(-50%)",
        width: 320, height: 40, borderRadius: "50%",
        background: "radial-gradient(ellipse, rgba(255,255,255,0.22), transparent 70%)",
        pointerEvents: "none", zIndex: 1,
      }} />

      {/* HP-Balken oben */}
      <div style={{ display: "flex", justifyContent: "space-between", gap: 8, position: "relative", zIndex: 3, marginBottom: 6 }}>
        <HpBar side="left"  name={sideA.name} hp={hpA} max={sideA.maxHp} pct={pctA} level={sideA.level} status={event?.status_a} />
        <HpBar side="right" name={sideB.name} hp={hpB} max={sideB.maxHp} pct={pctB} level={sideB.level} status={event?.status_b} />
      </div>

      {/* Arena-Stage mit Avataren */}
      <div style={{
        position: "relative", height: 300,
        display: "flex", justifyContent: "space-between", alignItems: "flex-end",
        padding: "0 8px", zIndex: 2,
        transition: "transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
        transform: zoom ? "scale(1.06)" : "scale(1)",
      }}>
        {/* Avatar A */}
        <div style={{
          flex: "0 0 40%", display: "flex", justifyContent: "center",
          transition: "transform 0.28s cubic-bezier(0.65, 0, 0.35, 1)",
          transform: lunge === "A" ? "translateX(36px) scale(1.05)" : "translateX(0) scale(1)",
          filter: koFade && hpA <= 0 ? "grayscale(1) brightness(0.5)" : undefined,
        }}>
          <div style={{ position: "relative" }}>
            {/* Ground-Shadow */}
            <div style={{
              position: "absolute", bottom: -6, left: "50%", transform: "translateX(-50%)",
              width: 80, height: 10, borderRadius: "50%",
              background: "radial-gradient(ellipse, rgba(0,0,0,0.6), transparent 70%)",
              filter: "blur(3px)",
            }} />
            <GuardianAvatar
              archetype={sideA.archetype}
              size={200}
              animation={animA}
              facing="right"
              fillMode="cover"
            />
            {/* Chromatic Aberration Overlay bei Crit */}
            {chroma && animA !== "idle" && (
              <div aria-hidden style={{
                position: "absolute", inset: 0, mixBlendMode: "screen",
                pointerEvents: "none", opacity: 0.4,
                background: "radial-gradient(ellipse, rgba(255,45,120,0.4), transparent 60%)",
                transform: "translateX(-3px)",
              }} />
            )}
          </div>
        </div>

        {/* Avatar B */}
        <div style={{
          flex: "0 0 40%", display: "flex", justifyContent: "center",
          transition: "transform 0.28s cubic-bezier(0.65, 0, 0.35, 1)",
          transform: lunge === "B" ? "translateX(-36px) scale(1.05)" : "translateX(0) scale(1)",
          filter: koFade && hpB <= 0 ? "grayscale(1) brightness(0.5)" : undefined,
        }}>
          <div style={{ position: "relative" }}>
            <div style={{
              position: "absolute", bottom: -6, left: "50%", transform: "translateX(-50%)",
              width: 80, height: 10, borderRadius: "50%",
              background: "radial-gradient(ellipse, rgba(0,0,0,0.6), transparent 70%)",
              filter: "blur(3px)",
            }} />
            <GuardianAvatar
              archetype={sideB.archetype}
              size={200}
              animation={animB}
              facing="left"
              fillMode="cover"
            />
            {chroma && animB !== "idle" && (
              <div aria-hidden style={{
                position: "absolute", inset: 0, mixBlendMode: "screen",
                pointerEvents: "none", opacity: 0.4,
                background: "radial-gradient(ellipse, rgba(34,209,195,0.4), transparent 60%)",
                transform: "translateX(3px)",
              }} />
            )}
          </div>
        </div>

        {/* Shockwave-Ring beim Treffer */}
        {shockwave && (
          <div key={`sw-${shockwave.id}`} aria-hidden style={{
            position: "absolute", top: "55%", left: shockwave.side === "A" ? "22%" : "78%",
            transform: "translate(-50%, -50%)",
            width: 20, height: 20, borderRadius: "50%",
            border: `2px solid ${shockwave.power > 1 ? "#FFD700" : "#FF6B4A"}`,
            pointerEvents: "none", zIndex: 7,
            animation: `shockwave ${shockwave.power > 1 ? 0.9 : 0.7}s cubic-bezier(0.2, 0.6, 0.3, 1) forwards`,
            ["--sw-scale" as string]: String(shockwave.power * 8),
          }} />
        )}

        {/* Hit-Sparks */}
        {sparks.map((s, i) => {
          // Sparks sitzen beim Opfer-Avatar (grob)
          return (
            <div key={s.id} aria-hidden style={{
              position: "absolute", top: "50%", left: `${22 + (i % 3) * 2}%`,
              pointerEvents: "none", zIndex: 8,
            }}>
              <div style={{
                width: 3, height: 3, borderRadius: 999,
                background: s.color,
                boxShadow: `0 0 6px ${s.color}, 0 0 12px ${s.color}`,
                animation: `spark-fly 0.8s cubic-bezier(0.2, 0.8, 0.3, 1) forwards`,
                ["--spark-dist" as string]: `${s.distance}px`,
                ["--spark-rot" as string]: `${s.angle}deg`,
              }} />
            </div>
          );
        })}

        {/* Damage-Numbers */}
        {floats.map((f) => (
          <div key={f.id}
            style={{
              position: "absolute", left: `${f.x}%`, top: `${f.y}%`,
              color: f.color, fontSize: f.crit ? 44 : 26, fontWeight: 900,
              textShadow: `0 2px 8px ${f.color}aa, 0 0 24px ${f.color}88`,
              pointerEvents: "none", zIndex: 10,
              animation: f.crit
                ? "damage-float-crit 1.6s cubic-bezier(0.2, 0.8, 0.3, 1) forwards"
                : "damage-float 1.4s cubic-bezier(0.2, 0.8, 0.3, 1) forwards",
              letterSpacing: f.crit ? 1 : 0,
              fontFamily: "ui-monospace, 'SF Mono', monospace",
            }}>
            {f.text}{f.crit && "!"}
          </div>
        ))}

        {/* Banner */}
        {bannerText && (
          <div style={{
            position: "absolute", top: "50%", left: "50%", transform: "translate(-50%, -50%)",
            padding: "8px 20px", borderRadius: 14,
            background: "linear-gradient(135deg, rgba(168,85,247,0.95), rgba(255,45,120,0.92))",
            color: "#FFF", fontSize: 15, fontWeight: 900, letterSpacing: 1.5,
            textShadow: "0 2px 8px rgba(0,0,0,0.8)",
            boxShadow: "0 0 40px rgba(168,85,247,0.9), inset 0 1px 0 rgba(255,255,255,0.2)",
            animation: "banner-pop 1.3s cubic-bezier(0.34, 1.56, 0.64, 1) forwards",
            pointerEvents: "none", zIndex: 20,
            border: "1px solid rgba(255,255,255,0.3)",
          }}>
            {bannerText}
          </div>
        )}

        {/* Flash-Overlay */}
        {flashColor && (
          <div aria-hidden style={{
            position: "absolute", inset: 0,
            background: `radial-gradient(ellipse at center, ${flashColor}55, transparent 70%)`,
            pointerEvents: "none", zIndex: 5,
            animation: "flash-fade 0.6s ease-out forwards",
          }} />
        )}

        {/* Slash-Effect */}
        {slashKey > 0 && (
          <div
            key={`slash-${slashKey}`}
            aria-hidden
            style={{
              position: "absolute", inset: 0,
              pointerEvents: "none", zIndex: 8,
              background: `linear-gradient(${slashDirection === "A" ? "115deg" : "65deg"},
                transparent 30%,
                rgba(255,255,255,0.9) 47%,
                rgba(255,215,0,1) 50%,
                rgba(255,255,255,0.9) 53%,
                transparent 70%)`,
              transform: slashDirection === "A" ? "translateX(-100%)" : "translateX(100%)",
              animation: `${slashDirection === "A" ? "slashA" : "slashB"} 0.5s cubic-bezier(0.65, 0, 0.35, 1) forwards`,
              mixBlendMode: "screen",
              filter: "blur(0.5px)",
            }}
          />
        )}

        {/* Speed-Lines */}
        {speedLinesKey && (
          <div
            key={`sl-${speedLinesKey.id}`}
            aria-hidden
            style={{
              position: "absolute", inset: 0, pointerEvents: "none", zIndex: 6,
              background: `repeating-linear-gradient(${speedLinesKey.side === "A" ? "90deg" : "270deg"},
                transparent 0 8px, rgba(255,255,255,0.12) 8px 10px, transparent 10px 40px)`,
              opacity: 0,
              animation: "speedlines 0.45s ease-out forwards",
              maskImage: "radial-gradient(ellipse at center, transparent 30%, black 70%)",
            }}
          />
        )}

        {/* Crit-Burst */}
        {critBurstKey > 0 && (
          <div
            key={`crit-${critBurstKey}`}
            aria-hidden
            style={{
              position: "absolute", inset: 0,
              pointerEvents: "none", zIndex: 9,
            }}
          >
            {Array.from({ length: 16 }).map((_, i) => {
              const angle = (i / 16) * 360;
              return (
                <div key={i} style={{
                  position: "absolute", top: "50%", left: "50%",
                  width: 5, height: 5, borderRadius: 999,
                  background: "#FFD700",
                  boxShadow: "0 0 10px #FFD700, 0 0 20px #FF6B4A",
                  animation: `critBurst 0.9s cubic-bezier(0.2, 0.8, 0.3, 1) forwards`,
                  animationDelay: `${i * 8}ms`,
                  ["--angle" as string]: `${angle}deg`,
                }} />
              );
            })}
          </div>
        )}
      </div>

      {/* Commentary statt trockener Rundentext */}
      <div style={{ position: "relative", zIndex: 3, marginTop: 10, textAlign: "center", minHeight: 40 }}>
        {commentary ? (
          <div
            key={commentary.id}
            style={{
              display: "inline-flex", alignItems: "center", gap: 10,
              padding: "8px 18px", borderRadius: 999,
              background: commentary.tone === "ko" ? "linear-gradient(135deg, #FFD700, #FF6B4A)"
                : commentary.tone === "crit" ? "linear-gradient(135deg, rgba(255,215,0,0.35), rgba(255,107,74,0.3))"
                : commentary.tone === "heal" ? "rgba(74,222,128,0.18)"
                : commentary.tone === "miss" ? "rgba(34,209,195,0.14)"
                : "rgba(15,17,21,0.8)",
              border: commentary.tone === "ko" ? "1px solid #FFD700"
                : commentary.tone === "crit" ? "1px solid rgba(255,215,0,0.7)"
                : commentary.tone === "heal" ? "1px solid rgba(74,222,128,0.6)"
                : commentary.tone === "miss" ? "1px solid rgba(34,209,195,0.5)"
                : "1px solid rgba(168,85,247,0.4)",
              color: commentary.tone === "ko" ? "#0F1115" : "#FFF",
              fontSize: commentary.tone === "ko" ? 14 : 12,
              fontWeight: 900, letterSpacing: commentary.tone === "ko" ? 2 : 0.8,
              textShadow: commentary.tone === "ko" ? "none" : "0 1px 3px rgba(0,0,0,0.7)",
              boxShadow: commentary.tone === "crit" || commentary.tone === "ko" ? "0 0 24px rgba(255,215,0,0.5)" : undefined,
              animation: "commentary-in 0.35s cubic-bezier(0.34, 1.56, 0.64, 1)",
              maxWidth: "96%",
            }}
          >
            {event && <span style={{ opacity: 0.6, fontSize: 9, letterSpacing: 1.5, flexShrink: 0 }}>R{event.round}</span>}
            <span style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{commentary.text}</span>
          </div>
        ) : (
          <span style={{ color: "#a8b4cf", fontSize: 11, letterSpacing: 1 }}>· · ·</span>
        )}
      </div>

      <style jsx>{`
        .arena-shake-soft { animation: arena-shake-soft 0.3s; }
        .arena-shake-hard { animation: arena-shake-hard 0.55s; }
        @keyframes arena-shake-soft {
          0%, 100% { transform: translate(0); }
          33% { transform: translate(-2px, 1px); }
          66% { transform: translate(2px, -1px); }
        }
        @keyframes arena-shake-hard {
          0%, 100% { transform: translate(0); }
          12% { transform: translate(-6px, 3px); }
          24% { transform: translate(7px, -3px); }
          36% { transform: translate(-5px, 2px); }
          48% { transform: translate(5px, -2px); }
          60% { transform: translate(-3px, 1px); }
          80% { transform: translate(3px, -1px); }
        }
        @keyframes damage-float {
          0%   { transform: translate(0, 0)    scale(0.6); opacity: 0; }
          15%  { transform: translate(0, -8px) scale(1.2); opacity: 1; }
          60%  { transform: translate(0, -40px) scale(1);  opacity: 1; }
          100% { transform: translate(0, -80px) scale(0.8); opacity: 0; }
        }
        @keyframes damage-float-crit {
          0%   { transform: translate(0, 0) scale(0.3) rotate(-8deg); opacity: 0; }
          20%  { transform: translate(0, -4px) scale(1.5) rotate(4deg); opacity: 1; }
          40%  { transform: translate(0, -12px) scale(1.2) rotate(-2deg); opacity: 1; }
          75%  { transform: translate(0, -40px) scale(1.1); opacity: 1; }
          100% { transform: translate(0, -90px) scale(0.9); opacity: 0; }
        }
        @keyframes banner-pop {
          0%   { transform: translate(-50%, -50%) scale(0.2) rotate(-8deg); opacity: 0; }
          25%  { transform: translate(-50%, -50%) scale(1.2) rotate(3deg); opacity: 1; }
          55%  { transform: translate(-50%, -50%) scale(1) rotate(0deg);    opacity: 1; }
          85%  { transform: translate(-50%, -50%) scale(1) rotate(0);       opacity: 1; }
          100% { transform: translate(-50%, -50%) scale(0.95) rotate(0);    opacity: 0; }
        }
        @keyframes slashA {
          0%   { transform: translateX(-100%); opacity: 0; }
          30%  { opacity: 1; }
          100% { transform: translateX(100%);  opacity: 0; }
        }
        @keyframes slashB {
          0%   { transform: translateX(100%);  opacity: 0; }
          30%  { opacity: 1; }
          100% { transform: translateX(-100%); opacity: 0; }
        }
        @keyframes critBurst {
          0%   { transform: rotate(var(--angle, 0deg)) translateY(-8px)  scale(1);   opacity: 1; }
          100% { transform: rotate(var(--angle, 0deg)) translateY(-120px) scale(0.2); opacity: 0; }
        }
        @keyframes flash-fade {
          0% { opacity: 1; }
          100% { opacity: 0; }
        }
        @keyframes shockwave {
          0%   { transform: translate(-50%, -50%) scale(1);  opacity: 1; border-width: 3px; }
          100% { transform: translate(-50%, -50%) scale(var(--sw-scale, 8)); opacity: 0; border-width: 1px; }
        }
        @keyframes spark-fly {
          0%   { transform: rotate(var(--spark-rot)) translateX(0) scale(1); opacity: 1; }
          100% { transform: rotate(var(--spark-rot)) translateX(var(--spark-dist, 50px)) scale(0.2); opacity: 0; }
        }
        @keyframes speedlines {
          0%   { opacity: 0; transform: scaleX(0.5); }
          40%  { opacity: 0.9; transform: scaleX(1.1); }
          100% { opacity: 0; transform: scaleX(1.4); }
        }
        @keyframes parallax-stars {
          0%   { background-position: 0 0; }
          100% { background-position: 200px 80px; }
        }
        @keyframes fog-drift {
          0%   { transform: translateX(-4%); opacity: 0.8; }
          100% { transform: translateX(4%);  opacity: 1; }
        }
        @keyframes particle-rise {
          0%   { transform: translateY(0) translateX(0) scale(0.4); opacity: 0; }
          20%  { opacity: 1; }
          80%  { opacity: 0.7; }
          100% { transform: translateY(-260px) translateX(20px) scale(0.2); opacity: 0; }
        }
        @keyframes commentary-in {
          0%   { transform: translateY(8px) scale(0.92); opacity: 0; }
          100% { transform: translateY(0)   scale(1);     opacity: 1; }
        }
      `}</style>
    </div>
  );
}

/** Dramatische Commentary-Zeile erzeugen — statt "Runde 2 · Angriff (-1)". */
function buildCommentary(event: RoundEvent, actorName: string, victimName: string): { text: string; tone: Commentary["tone"] } | null {
  const dmg = event.damage;
  const an = actorName.toUpperCase();
  const vn = victimName.toUpperCase();
  switch (event.action) {
    case "crit":
    case "ult":
      return { tone: "crit", text: `💥 KRITISCH! ${an} zerreißt ${vn} für ${dmg}!` };
    case "attack":
      if (dmg >= 50) return { tone: "normal", text: `⚔️ ${an} trifft hart — ${dmg} Schaden` };
      return { tone: "normal", text: `${an} greift an · ${dmg}` };
    case "miss":
      return { tone: "miss", text: `💨 ${vn} weicht aus!` };
    case "flame":
      return { tone: "crit", text: `🔥 Flamme verzehrt ${vn} · ${dmg}` };
    case "poison":
      return { tone: "crit", text: `☠️ Gift frisst sich in ${vn} · ${dmg}` };
    case "heal":
      return { tone: "heal", text: `💚 ${an} heilt sich · +${dmg}` };
    case "revive":
      return { tone: "heal", text: `🪽 ${vn} erhebt sich erneut!` };
    case "stunned":
      return { tone: "miss", text: `😵 ${an} ist betäubt — kein Zug` };
    case "special":
      return { tone: "crit", text: event.note ? `✨ ${event.note}` : `✨ ${an} entfesselt Spezialangriff` };
    default:
      return null;
  }
}

function HpBar({ side, name, hp, max, pct, level, status }: {
  side: "left" | "right"; name: string; hp: number; max: number; pct: number; level: number; status?: SideStatus;
}) {
  const align = side === "left" ? "flex-start" : "flex-end";
  const barColor = pct > 50 ? "linear-gradient(90deg, #4ade80, #22D1C3)" : pct > 25 ? "linear-gradient(90deg, #FFD700, #FF6B4A)" : "linear-gradient(90deg, #FF2D78, #FF6B4A)";
  const low = pct < 25;
  const critical = pct < 12;

  const buffs: Array<{ icon: string; label: string; color: string; kind: "buff" | "debuff" }> = [];
  if (status) {
    if (status.stunned) buffs.push({ icon: "😵", label: "Betäubt", color: "#FFD700", kind: "debuff" });
    if (status.poisonStacks > 0) buffs.push({ icon: "☠️", label: `Gift ×${status.poisonStacks}`, color: "#a855f7", kind: "debuff" });
    if (status.inBerserker) buffs.push({ icon: "🔥", label: "Berserker", color: "#FF2D78", kind: "buff" });
    if (status.inSymbiose) buffs.push({ icon: "☯️", label: "Symbiose", color: "#4ade80", kind: "buff" });
    if (status.bollwerkReady) buffs.push({ icon: "🛡️", label: "Bollwerk bereit", color: "#60a5fa", kind: "buff" });
    if (status.awakenReady) buffs.push({ icon: "✨", label: "Erwachen bereit", color: "#a855f7", kind: "buff" });
    if (status.phoenixReady) buffs.push({ icon: "🪽", label: "Wiedergeburt", color: "#FF6B4A", kind: "buff" });
    if (status.nineLivesReady) buffs.push({ icon: "🐈", label: "Neun Leben", color: "#FFD700", kind: "buff" });
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: align, flex: 1, maxWidth: 230 }}>
      <div style={{
        fontSize: 11, fontWeight: 900, color: "#FFF",
        textAlign: side, textShadow: "0 1px 3px rgba(0,0,0,0.9)",
        letterSpacing: 0.5,
      }}>
        {name} <span style={{ color: "#a8b4cf", fontWeight: 700 }}>· Lv {level}</span>
      </div>
      <div className={critical ? "hp-bar-crit" : ""} style={{
        width: "100%", height: 12, borderRadius: 6,
        background: "rgba(0,0,0,0.6)",
        border: `1px solid ${low ? "rgba(255,45,120,0.5)" : "rgba(255,255,255,0.15)"}`,
        overflow: "hidden", marginTop: 4,
        boxShadow: `inset 0 1px 4px rgba(0,0,0,0.7)${low ? ", 0 0 12px rgba(255,45,120,0.5)" : ""}`,
        position: "relative",
      }}>
        <div style={{
          height: "100%", width: `${pct}%`,
          background: barColor,
          transition: "width 0.35s cubic-bezier(0.3, 0.8, 0.3, 1)",
          boxShadow: "0 0 14px currentColor",
          direction: side === "right" ? "rtl" : "ltr",
          marginLeft: side === "right" ? "auto" : 0,
        }} />
        {/* Shine */}
        <div aria-hidden style={{
          position: "absolute", top: 0, left: 0, right: 0, height: "40%",
          background: "linear-gradient(180deg, rgba(255,255,255,0.3), transparent)",
          pointerEvents: "none",
        }} />
      </div>
      <div style={{ color: low ? "#FF2D78" : "#a8b4cf", fontSize: 10, marginTop: 2, fontVariantNumeric: "tabular-nums", fontWeight: low ? 900 : 700 }}>
        {hp} / {max}{critical && " ⚠️"}
      </div>
      {buffs.length > 0 && (
        <div style={{
          display: "flex", gap: 3, marginTop: 3, flexWrap: "wrap",
          justifyContent: side === "right" ? "flex-end" : "flex-start",
        }}>
          {buffs.map((b, i) => (
            <div key={i} title={b.label} style={{
              width: 20, height: 20, borderRadius: 5,
              background: `${b.color}28`, border: `1px solid ${b.color}`,
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 12, lineHeight: 1,
              animation: b.kind === "buff" && (b.label === "Berserker" || b.label === "Symbiose") ? "status-pulse 1.2s ease-in-out infinite" : undefined,
            }}>
              {b.icon}
            </div>
          ))}
        </div>
      )}
      <style jsx>{`
        @keyframes status-pulse {
          0%, 100% { filter: brightness(1); transform: scale(1); }
          50% { filter: brightness(1.6); transform: scale(1.12); }
        }
        .hp-bar-crit { animation: hp-crit 0.9s ease-in-out infinite; }
        @keyframes hp-crit {
          0%, 100% { box-shadow: inset 0 1px 4px rgba(0,0,0,0.7), 0 0 12px rgba(255,45,120,0.4); }
          50%      { box-shadow: inset 0 1px 4px rgba(0,0,0,0.7), 0 0 24px rgba(255,45,120,0.9); }
        }
      `}</style>
    </div>
  );
}
