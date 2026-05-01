"use client";

// Wiederverwendbare animierte Lauflinien-Vorschau.
// Zeigt eine Mini-Trail mit dem Particle-Effekt eines Lights — identisch zum
// On-Map-Render. Nutzt die gleiche drawParticle()-Engine wie das Production-
// Overlay damit das was Runner im Picker sehen 1:1 das ist was sie on-map
// kriegen.

import { useEffect, useRef } from "react";
import { LIGHT_PARTICLE_SPECS, type ParticleSpec, type ParticleShape } from "@/lib/runner-light-particles";
import { RUNNER_LIGHTS } from "@/lib/game-config";
import { drawParticle } from "@/components/runner-particle-overlay";

type Particle = {
  x: number; y: number;
  vx: number; vy: number;
  age: number; maxAge: number;
  size: number; isDust: boolean;
  shape: ParticleShape;
  rotation: number;
};

export function LightTrailPreview({
  lightId,
  width = 80,
  height = 40,
  /** Wenn true: Linie geht gerade horizontal (Picker-Box). false: leichte Welle (Demo). */
  straight = true,
  className,
}: {
  lightId: string;
  width?: number;
  height?: number;
  straight?: boolean;
  className?: string;
}) {
  const ref = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const c = ref.current; if (!c) return;
    const dpr = window.devicePixelRatio || 1;
    c.width = width * dpr;
    c.height = height * dpr;
    const ctx = c.getContext("2d"); if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const light = RUNNER_LIGHTS.find((l) => l.id === lightId);
    const spec: ParticleSpec | null = LIGHT_PARTICLE_SPECS[lightId] ?? null;
    if (!light) return;

    const lineColor = light.color;
    const cy = height / 2;
    // Waypoints: gerade ODER leichte S-Kurve
    const wps: Array<{ x: number; y: number }> = straight
      ? [{ x: 4, y: cy }, { x: width * 0.33, y: cy }, { x: width * 0.66, y: cy }, { x: width - 4, y: cy }]
      : [
          { x: 4, y: cy + 6 },
          { x: width * 0.3, y: cy - 6 },
          { x: width * 0.6, y: cy + 6 },
          { x: width - 4, y: cy - 4 },
        ];

    const getSpline = (t: number, p0: typeof wps[0], p1: typeof wps[0], p2: typeof wps[0], p3: typeof wps[0]) => {
      const t2 = t * t, t3 = t2 * t;
      return {
        x: 0.5 * ((2 * p1.x) + (-p0.x + p2.x) * t + (2 * p0.x - 5 * p1.x + 4 * p2.x - p3.x) * t2 + (-p0.x + 3 * p1.x - 3 * p2.x + p3.x) * t3),
        y: 0.5 * ((2 * p1.y) + (-p0.y + p2.y) * t + (2 * p0.y - 5 * p1.y + 4 * p2.y - p3.y) * t2 + (-p0.y + 3 * p1.y - 3 * p2.y + p3.y) * t3),
      };
    };

    const particles: Particle[] = [];
    let segIdx = 0;
    let t = 0;
    const speed = 0.012; // Bewusst langsam, damit der Particle-Effekt sichtbar ist
    let raf = 0;

    const tick = () => {
      ctx.clearRect(0, 0, width, height);

      // Lauflinie
      ctx.beginPath();
      ctx.moveTo(wps[0].x, wps[0].y);
      for (let i = 1; i < wps.length; i++) ctx.lineTo(wps[i].x, wps[i].y);
      ctx.strokeStyle = lineColor;
      ctx.lineWidth = Math.max(2, light.width * 0.5);
      ctx.lineCap = "round"; ctx.lineJoin = "round";
      ctx.shadowColor = lineColor;
      ctx.shadowBlur = 6;
      ctx.stroke();
      ctx.shadowBlur = 0;

      // Runner-Head Position
      let headX = wps[wps.length - 1].x;
      let headY = wps[wps.length - 1].y;
      if (segIdx < wps.length - 1) {
        const p0 = wps[Math.max(0, segIdx - 1)];
        const p1 = wps[segIdx];
        const p2 = wps[Math.min(wps.length - 1, segIdx + 1)];
        const p3 = wps[Math.min(wps.length - 1, segIdx + 2)];
        const pos = getSpline(t, p0, p1, p2, p3);
        headX = pos.x; headY = pos.y;
        t += speed;
        if (t >= 1) { t = 0; segIdx++; if (segIdx >= wps.length - 1) segIdx = 0; }
      }

      // Spawn am Head
      if (spec) {
        for (let i = 0; i < spec.spawnPerFrame; i++) {
          const isDust = Math.random() < spec.dustRatio;
          const useShape2 = !isDust && spec.shape2 && Math.random() < (spec.shape2Ratio ?? 0);
          const shape: ParticleShape = isDust ? "circle" : (useShape2 ? spec.shape2! : spec.shape);
          const spread = isDust ? spec.dustSpread : spec.coreSpread;
          const sizeMin = isDust ? spec.dustSize[0] : spec.coreSize[0];
          const sizeMax = isDust ? spec.dustSize[1] : spec.coreSize[1];
          const ageMin = isDust ? spec.dustMaxAge[0] : spec.coreMaxAge[0];
          const ageMax = isDust ? spec.dustMaxAge[1] : spec.coreMaxAge[1];
          // In Mini-Vorschau: Sizes etwas reduzieren
          const sizeScale = width < 100 ? 0.55 : 1;
          particles.push({
            x: headX + (Math.random() - 0.5) * spread * sizeScale,
            y: headY + (Math.random() - 0.5) * spread * sizeScale,
            vx: spec.driftVx + (Math.random() - 0.5) * spec.driftRandomX,
            vy: spec.driftVy + (Math.random() - 0.5) * spec.driftRandomY,
            age: 0,
            maxAge: (ageMin + Math.random() * (ageMax - ageMin)) * 0.6, // kürzere Lebensdauer für Mini
            size: (sizeMin + Math.random() * (sizeMax - sizeMin)) * sizeScale,
            isDust, shape,
            rotation: Math.random() * Math.PI * 2,
          });
        }
      }

      ctx.globalCompositeOperation = (spec?.blendMode ?? "lighter") as GlobalCompositeOperation;
      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.age++;
        if (p.age > p.maxAge) { particles.splice(i, 1); continue; }
        if (spec?.windCurl) p.vx += Math.sin(p.age * 0.08 + p.rotation) * spec.windCurl * 0.05;
        p.x += p.vx; p.y += p.vy;
        if (spec && spec.driftVy < 0) p.vy *= 0.985;
        if (spec?.rotate) p.rotation += 0.04;
        const lifeT = p.age / p.maxAge;
        const opacity = Math.max(0, 1 - Math.pow(lifeT, spec?.fadePower ?? 1.4));
        let size = p.size * (1 - lifeT * 0.5);
        if (spec?.pulse) size *= 0.7 + 0.3 * Math.abs(Math.sin(lifeT * Math.PI * 3));
        if (spec?.shape === "ring" && !p.isDust) size = p.size * (1 + lifeT * 1.5);
        if (size <= 0.3 || opacity <= 0.02) continue;
        if (spec) {
          drawParticle(
            ctx, p.shape, p.x, p.y, size, p.rotation,
            p.isDust ? spec.dustColor : spec.coreColor,
            p.isDust ? undefined : spec.coreColor2,
            opacity, p.vx, p.vy, p.age + p.x,
          );
        }
      }
      ctx.globalCompositeOperation = "source-over";

      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [lightId, width, height, straight]);

  return (
    <canvas
      ref={ref}
      className={className}
      style={{ width, height, display: "block" }}
    />
  );
}
