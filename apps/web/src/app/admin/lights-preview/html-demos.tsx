"use client";

// HTML/CSS/SVG Light-Demos — was 2026-Web wirklich kann.
// Zeigt 20 Lights als FULL-FIDELITY-Vorschauen mit:
//  - SVG <filter> Stacks: feGaussianBlur, feTurbulence + feDisplacementMap
//    (für Hitze-Verzerrung), feMerge, feColorMatrix
//  - CSS @keyframes für organische Animationen
//  - mix-blend-mode: screen / overlay / lighten für additives Glow
//  - <canvas> Particle-Engines für Sparkles, Embers, Stars
//
// Diese Komponenten sind die "Reference-Implementation" — wie es im idealen
// Fall aussehen soll. Die Mapbox-Variante (siehe runner-light-render.ts)
// ist eine notwendige Annäherung weil dort WebGL-Canvas die Linie zeichnet.

import { useEffect, useRef } from "react";
import { RUNNER_LIGHTS, LIGHT_VISUAL_SPECS } from "@/lib/game-config";

const W = 360, H = 80;

// ── Shared Trail-Path (curve through preview area) ──────────────────
const TRAIL_PATH = `M 10 50 Q 90 30 180 45 T 350 40`;

// ── Particle-Engine via Canvas (Embers, Sparkles, Stars) ────────────
function ParticleCanvas({ kind, color, count, size, lifeSec, w = W, h = H }: {
  kind: "embers" | "sparkles" | "stars";
  color: string; count: number; size: [number, number]; lifeSec?: number;
  w?: number; h?: number;
}) {
  const ref = useRef<HTMLCanvasElement | null>(null);
  useEffect(() => {
    const c = ref.current; if (!c) return;
    c.width = w * 2; c.height = h * 2; // retina
    const ctx = c.getContext("2d"); if (!ctx) return;
    ctx.scale(2, 2);

    type P = { x: number; y0: number; y: number; vx: number; vy: number; r: number; born: number; phase: number; life: number };
    const particles: P[] = [];
    for (let i = 0; i < count; i++) {
      const x = 10 + Math.random() * (w - 20);
      const y0 = 35 + Math.random() * 20;
      particles.push({
        x, y0, y: y0,
        vx: (Math.random() - 0.5) * 0.3,
        vy: kind === "embers" ? -(8 + Math.random() * 12) / 60 : 0,
        r: size[0] + Math.random() * (size[1] - size[0]),
        born: performance.now() - Math.random() * 2000,
        phase: Math.random() * Math.PI * 2,
        life: lifeSec ?? 2,
      });
    }
    let raf = 0;
    const tick = (now: number) => {
      ctx.clearRect(0, 0, w, h);
      for (const p of particles) {
        const ageS = (now - p.born) / 1000;
        let opacity = 0;
        if (kind === "embers") {
          if (ageS >= p.life) {
            p.x = 10 + Math.random() * (w - 20);
            p.y0 = 35 + Math.random() * 20;
            p.y = p.y0; p.born = now; p.vy = -(8 + Math.random() * 12) / 60;
            continue;
          }
          const t = ageS / p.life;
          opacity = (1 - t);
          p.y = p.y0 + p.vy * (now - p.born) * 0.06;
          p.x += p.vx * 0.5;
        } else {
          // twinkle
          const tw = 0.5 + 0.5 * Math.sin(ageS * 4 + p.phase);
          opacity = Math.pow(tw, 2.5);
        }
        if (opacity < 0.05) continue;
        ctx.save();
        ctx.globalCompositeOperation = "lighter";
        const grad = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r * 3);
        grad.addColorStop(0, color);
        grad.addColorStop(0.4, color);
        grad.addColorStop(1, "transparent");
        ctx.globalAlpha = opacity;
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r * 3, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = opacity * 0.9;
        ctx.fillStyle = "#FFFFFF";
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r * 0.6, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [kind, color, count, size, lifeSec, w, h]);
  return <canvas ref={ref} style={{ position: "absolute", inset: 0, width: w, height: h, pointerEvents: "none" }} />;
}

// ── Trail-Renderer mit SVG-Filter und animiertem Stroke ─────────────
function SvgTrail({ id, colors, glowSize = 12, animation }: {
  id: string;
  colors: readonly string[];
  glowSize?: number;
  animation?: "flow" | "metal_sheen" | "molten" | "flame" | "electric" | null;
}) {
  const grad = colors.length > 1 ? `url(#${id}-grad)` : colors[0];
  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{ position: "absolute", inset: 0 }}>
      <defs>
        {/* Bloom-Filter — multi-stack Gaussian Blur */}
        <filter id={`${id}-bloom`} x="-20%" y="-50%" width="140%" height="200%">
          <feGaussianBlur stdDeviation={glowSize} result="b1" />
          <feGaussianBlur stdDeviation={glowSize * 0.6} result="b2" />
          <feGaussianBlur stdDeviation={glowSize * 0.3} result="b3" />
          <feMerge>
            <feMergeNode in="b1" />
            <feMergeNode in="b2" />
            <feMergeNode in="b3" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>

        {/* Heat-Distortion-Filter für Fire/Lava — feTurbulence + feDisplacementMap */}
        <filter id={`${id}-heat`} x="-20%" y="-50%" width="140%" height="200%">
          <feTurbulence type="fractalNoise" baseFrequency="0.02 0.05" numOctaves="2" seed="3">
            <animate attributeName="baseFrequency" dur="4s" values="0.02 0.05;0.04 0.08;0.02 0.05" repeatCount="indefinite" />
          </feTurbulence>
          <feDisplacementMap in="SourceGraphic" scale="6" />
          <feGaussianBlur stdDeviation={glowSize * 0.7} result="b" />
          <feMerge>
            <feMergeNode in="b" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>

        {/* Multi-Color-Gradient mit optional animierter Position */}
        {colors.length > 1 && (
          <linearGradient id={`${id}-grad`} x1="0%" x2="100%">
            {colors.map((c, i) => (
              <stop key={i} offset={`${(i / (colors.length - 1)) * 100}%`} stopColor={c}>
                {animation === "flow" && (
                  <animate attributeName="offset" dur="3s"
                    values={`${(i / (colors.length - 1)) * 100}%;${((i / (colors.length - 1)) * 100 - 100)}%`}
                    repeatCount="indefinite" />
                )}
              </stop>
            ))}
          </linearGradient>
        )}

        {/* Flow-Gradient mit Bewegung via animierte stops (für sunset etc.) */}
        {animation === "metal_sheen" && (
          <linearGradient id={`${id}-sheen`} x1="0%" x2="100%">
            <stop offset="0%" stopColor={colors[0]} />
            <stop offset="50%" stopColor="#FFFFFF" stopOpacity="0.9">
              <animate attributeName="offset" dur="4s" values="-20%;120%" repeatCount="indefinite" />
            </stop>
            <stop offset="100%" stopColor={colors[0]} />
          </linearGradient>
        )}
      </defs>

      {/* Outer bloom layer */}
      <path d={TRAIL_PATH} stroke={colors[0]} strokeWidth={glowSize * 1.6} strokeLinecap="round"
        fill="none" opacity={0.35} filter={`url(#${id}-bloom)`} />

      {/* Core — multi-color or solid */}
      {animation === "flame" ? (
        <path d={TRAIL_PATH} stroke={grad} strokeWidth={6} strokeLinecap="round"
          fill="none" filter={`url(#${id}-heat)`}>
          <animate attributeName="opacity" dur="0.4s"
            values="1;0.7;0.95;0.8;1" repeatCount="indefinite" />
        </path>
      ) : animation === "molten" ? (
        <path d={TRAIL_PATH} stroke={grad} strokeWidth={6} strokeLinecap="round"
          fill="none" filter={`url(#${id}-heat)`} />
      ) : animation === "metal_sheen" ? (
        <>
          <path d={TRAIL_PATH} stroke={colors[0]} strokeWidth={6} strokeLinecap="round" fill="none" />
          <path d={TRAIL_PATH} stroke={`url(#${id}-sheen)`} strokeWidth={6} strokeLinecap="round" fill="none" style={{ mixBlendMode: "screen" }} />
        </>
      ) : animation === "electric" ? (
        <path d={TRAIL_PATH} stroke={grad} strokeWidth={5} strokeLinecap="round" fill="none">
          <animate attributeName="opacity" dur="0.3s" values="1;0.6;1;0.4;1;0.8;1" repeatCount="indefinite" />
          <animate attributeName="stroke-width" dur="0.3s" values="5;7;4;6;5" repeatCount="indefinite" />
        </path>
      ) : (
        <path d={TRAIL_PATH} stroke={grad} strokeWidth={6} strokeLinecap="round" fill="none" />
      )}

      {/* Inner white hot-core */}
      <path d={TRAIL_PATH} stroke="#FFFFFF" strokeWidth={2} strokeLinecap="round" fill="none" opacity={0.7} />
    </svg>
  );
}

// ── Card-Renderer pro Light ─────────────────────────────────────────
export function HtmlLightDemo({ lightId }: { lightId: string }) {
  const light = RUNNER_LIGHTS.find((l) => l.id === lightId);
  if (!light) return null;
  const spec = LIGHT_VISUAL_SPECS[light.id];
  const id = `lp-${light.id}`;

  // Mapping spec → SVG-Animation-Modus
  const svgAnim: "flow" | "metal_sheen" | "molten" | "flame" | "electric" | null =
    spec.animation === "flow" ? "flow"
    : spec.animation === "molten_flow" ? "molten"
    : spec.animation === "metal_sheen" ? "metal_sheen"
    : spec.animation === "flame_glow" ? "flame"
    : spec.animation === "electric_arcs" ? "electric"
    : null;

  return (
    <div style={{ position: "relative", width: W, height: H, overflow: "hidden", borderRadius: 12, background: "radial-gradient(ellipse at center, #1a1d23 0%, #0F1115 100%)" }}>
      <SvgTrail id={id} colors={light.gradient} glowSize={Math.max(8, (spec.bloom[0]?.widthAdd ?? 18) * 0.5)} animation={svgAnim} />
      {spec.particles && (
        <ParticleCanvas
          kind={spec.particles.kind === "embers" ? "embers" : spec.particles.kind === "stars" ? "stars" : "sparkles"}
          color={spec.particles.color}
          count={spec.particles.count}
          size={[spec.particles.sizeMin, spec.particles.sizeMax]}
          lifeSec={spec.particles.lifeSec ?? 2}
        />
      )}
    </div>
  );
}

export function HtmlLightGrid() {
  return (
    <div style={{ display: "grid", gridTemplateColumns: `repeat(auto-fill, minmax(${W + 20}px, 1fr))`, gap: 12 }}>
      {RUNNER_LIGHTS.map((l) => (
        <div key={l.id} style={{ background: "#151922", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 16, padding: 12 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
            <div style={{ fontWeight: 800, fontSize: 14 }}>{l.name}</div>
            <div style={{ fontSize: 10, color: "#8b8fa3" }}>{l.cost >= 1000 ? `${l.cost / 1000}k` : l.cost} XP</div>
          </div>
          <HtmlLightDemo lightId={l.id} />
          <div style={{ fontSize: 10, color: "#8b8fa3", marginTop: 6 }}>
            {LIGHT_VISUAL_SPECS[l.id]?.animation}
            {LIGHT_VISUAL_SPECS[l.id]?.particles && ` + ${LIGHT_VISUAL_SPECS[l.id]!.particles!.count}× ${LIGHT_VISUAL_SPECS[l.id]!.particles!.kind}`}
          </div>
        </div>
      ))}
    </div>
  );
}
