"use client";

// HTML/Canvas-Demos pro Light — 20 Mini-Karten die zeigen wie der Particle-
// Trail am Runner aussieht. Identische Particle-Engine wie im
// RunnerParticleOverlay (Production), aber statt echter GPS-Position wandert
// hier ein interpolierter Punkt entlang einer fixen Spline-Route.
//
// Pattern direkt vom User-Demo (Eis-Frost):
//  - Trail-Linie als dünne dunkle Spur im Hintergrund
//  - Punkt entlang der Linie via Catmull-Rom-Spline
//  - Particle-Spawn am Punkt mit Core/Dust-System

import { useEffect, useRef } from "react";
import { RUNNER_LIGHTS } from "@/lib/game-config";
import { LIGHT_PARTICLE_SPECS, hexA, type ParticleSpec } from "@/lib/runner-light-particles";

const W = 360, H = 100;
// Catmull-Rom-Waypoints durch die Demo-Card (S-Kurve)
const WAYPOINTS: Array<{ x: number; y: number }> = [
  { x: 20, y: 60 }, { x: 90, y: 35 }, { x: 160, y: 65 },
  { x: 230, y: 40 }, { x: 300, y: 55 }, { x: 340, y: 45 },
];

function getSplinePoint(t: number, p0: { x: number; y: number }, p1: { x: number; y: number }, p2: { x: number; y: number }, p3: { x: number; y: number }) {
  const t2 = t * t, t3 = t2 * t;
  const x = 0.5 * ((2 * p1.x) + (-p0.x + p2.x) * t + (2 * p0.x - 5 * p1.x + 4 * p2.x - p3.x) * t2 + (-p0.x + 3 * p1.x - 3 * p2.x + p3.x) * t3);
  const y = 0.5 * ((2 * p1.y) + (-p0.y + p2.y) * t + (2 * p0.y - 5 * p1.y + 4 * p2.y - p3.y) * t2 + (-p0.y + 3 * p1.y - 3 * p2.y + p3.y) * t3);
  return { x, y };
}

type Particle = {
  x: number; y: number;
  vx: number; vy: number;
  age: number; maxAge: number; size: number; isDust: boolean;
};

function LightDemoCanvas({ lightId, lineColor }: { lightId: string; lineColor: string }) {
  const ref = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const c = ref.current; if (!c) return;
    const dpr = window.devicePixelRatio || 1;
    c.width = W * dpr; c.height = H * dpr;
    const ctx = c.getContext("2d"); if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const spec: ParticleSpec | null = LIGHT_PARTICLE_SPECS[lightId] ?? null;
    const particles: Particle[] = [];
    let segIdx = 0;
    let t = 0;
    const speed = 0.018; // wie schnell der Demo-Runner durch die Card läuft
    let raf = 0;

    const tick = () => {
      ctx.clearRect(0, 0, W, H);

      // 1) Demo-Linie als statische Spur (so wie die "echte" Lauflinie)
      ctx.beginPath();
      ctx.moveTo(WAYPOINTS[0].x, WAYPOINTS[0].y);
      for (let i = 1; i < WAYPOINTS.length; i++) ctx.lineTo(WAYPOINTS[i].x, WAYPOINTS[i].y);
      ctx.strokeStyle = lineColor;
      ctx.lineWidth = 2.5;
      ctx.lineCap = "round"; ctx.lineJoin = "round";
      ctx.shadowColor = lineColor;
      ctx.shadowBlur = 8;
      ctx.stroke();
      ctx.shadowBlur = 0;

      // 2) Runner-Head Position berechnen
      let headX = WAYPOINTS[WAYPOINTS.length - 1].x;
      let headY = WAYPOINTS[WAYPOINTS.length - 1].y;
      if (segIdx < WAYPOINTS.length - 1) {
        const p0 = WAYPOINTS[Math.max(0, segIdx - 1)];
        const p1 = WAYPOINTS[segIdx];
        const p2 = WAYPOINTS[Math.min(WAYPOINTS.length - 1, segIdx + 1)];
        const p3 = WAYPOINTS[Math.min(WAYPOINTS.length - 1, segIdx + 2)];
        const pos = getSplinePoint(t, p0, p1, p2, p3);
        headX = pos.x; headY = pos.y;
        t += speed;
        if (t >= 1) { t = 0; segIdx++; if (segIdx >= WAYPOINTS.length - 1) segIdx = 0; }
      }

      // 3) Spawn neue Partikel am Head
      if (spec) {
        for (let i = 0; i < spec.spawnPerFrame; i++) {
          const isDust = Math.random() < spec.dustRatio;
          const spread = isDust ? spec.dustSpread : spec.coreSpread;
          const sizeMin = isDust ? spec.dustSize[0] : spec.coreSize[0];
          const sizeMax = isDust ? spec.dustSize[1] : spec.coreSize[1];
          const ageMin = isDust ? spec.dustMaxAge[0] : spec.coreMaxAge[0];
          const ageMax = isDust ? spec.dustMaxAge[1] : spec.coreMaxAge[1];
          particles.push({
            x: headX + (Math.random() - 0.5) * spread,
            y: headY + (Math.random() - 0.5) * spread,
            vx: spec.driftVx + (Math.random() - 0.5) * spec.driftRandomX,
            vy: spec.driftVy + (Math.random() - 0.5) * spec.driftRandomY,
            age: 0,
            maxAge: ageMin + Math.random() * (ageMax - ageMin),
            size: sizeMin + Math.random() * (sizeMax - sizeMin),
            isDust,
          });
        }
      }

      // 4) Update + draw
      ctx.globalCompositeOperation = (spec?.blendMode ?? "lighter") as GlobalCompositeOperation;
      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.age++;
        if (p.age > p.maxAge) { particles.splice(i, 1); continue; }
        p.x += p.vx; p.y += p.vy;
        const lifeT = p.age / p.maxAge;
        const opacity = Math.max(0, 1 - Math.pow(lifeT, spec?.fadePower ?? 1.4));
        let size = p.size * (1 - lifeT * 0.6);
        if (spec?.pulse) size *= 0.7 + 0.3 * Math.abs(Math.sin(lifeT * Math.PI * 3));
        if (size <= 0.3 || opacity <= 0.02) continue;
        const grad = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, size);
        if (spec) {
          if (p.isDust) {
            grad.addColorStop(0, hexA(spec.dustColor, opacity));
            grad.addColorStop(1, hexA(spec.dustColor, 0));
          } else if (spec.coreColor2) {
            grad.addColorStop(0, hexA(spec.coreColor, opacity));
            grad.addColorStop(0.4, hexA(spec.coreColor2, opacity * 0.7));
            grad.addColorStop(1, hexA(spec.coreColor2, 0));
          } else {
            grad.addColorStop(0, hexA(spec.coreColor, opacity));
            grad.addColorStop(1, hexA(spec.coreColor, 0));
          }
        }
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(p.x, p.y, size, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalCompositeOperation = "source-over";

      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [lightId, lineColor]);

  return <canvas ref={ref} style={{ width: W, height: H, display: "block", borderRadius: 8 }} />;
}

export function HtmlLightGrid() {
  return (
    <div style={{ display: "grid", gridTemplateColumns: `repeat(auto-fill, minmax(${W + 24}px, 1fr))`, gap: 12 }}>
      {RUNNER_LIGHTS.map((l) => {
        const spec = LIGHT_PARTICLE_SPECS[l.id];
        return (
          <div key={l.id} style={{ background: "#0b0f19", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 16, padding: 12 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
              <div style={{ fontWeight: 800, fontSize: 14, color: "#fff" }}>{l.name}</div>
              <div style={{ fontSize: 10, color: "#8b8fa3" }}>{l.cost >= 1000 ? `${l.cost / 1000}k` : l.cost} XP</div>
            </div>
            <LightDemoCanvas lightId={l.id} lineColor={l.color} />
            <div style={{ fontSize: 10, color: "#8b8fa3", marginTop: 8, lineHeight: 1.4 }}>
              {spec
                ? <>Spawn {spec.spawnPerFrame}/frame · Core <span style={{ color: spec.coreColor }}>●</span> {spec.coreColor}{spec.coreColor2 && <> + <span style={{ color: spec.coreColor2 }}>●</span> {spec.coreColor2}</>} · Drift {spec.driftVy.toFixed(2)}px/f</>
                : <span style={{ color: "#4ade80" }}>Free-Tier — keine Partikel, nur saubere Linie</span>}
            </div>
          </div>
        );
      })}
    </div>
  );
}
