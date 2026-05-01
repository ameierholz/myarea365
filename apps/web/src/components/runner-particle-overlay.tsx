"use client";

// Particle-Overlay über der Mapbox-Karte. Ein <canvas> der die ganze Map
// abdeckt, pointer-events: none, und am Runner-Kopf (current GPS position)
// pro Frame Partikel spawnt + animiert + zeichnet. Particle-Spec kommt aus
// LIGHT_PARTICLE_SPECS, definiert Look + Spawn-Rate + Drift + Lifetime.
//
// Wichtig:
// - Position kommt via Refs (nicht effect-deps) damit die Particle-Loop nicht
//   re-mounted wird wenn der User läuft (sonst wären alle Partikel weg).
// - map.project() wird in jedem Frame neu aufgerufen → Partikel werden am
//   Runner gespawnt, leben dann in Screen-Space (driften nach oben + faden).
//   Beim Pannen "verlassen" sie ihre Geo-Position kurz, das fällt aber nicht
//   auf weil sie in <2s sterben.

import { useEffect, useRef } from "react";
import type { Map as MapboxMap } from "mapbox-gl";
import { LIGHT_PARTICLE_SPECS, hexA, type ParticleSpec } from "@/lib/runner-light-particles";

type Particle = {
  x: number; y: number;
  vx: number; vy: number;
  age: number; maxAge: number;
  size: number;
  isDust: boolean;
};

export function RunnerParticleOverlay({
  map,
  posRef,
  lightId,
  containerEl,
  active,
}: {
  map: MapboxMap | null;
  /** Ref auf die aktuelle Runner-Position. Wird jeden Frame gelesen. */
  posRef: React.MutableRefObject<{ lat: number; lng: number } | null>;
  /** ID des aktuellen Lights (z.B. "ice", "fire") — bestimmt die Particle-Spec. */
  lightId: string;
  /** DOM-Element der Map (canvas wird absolut darüber positioniert). */
  containerEl: HTMLElement | null;
  /** Wenn false → keine neuen Partikel spawnen (User pausiert das Tracking). */
  active: boolean;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const particlesRef = useRef<Particle[]>([]);
  const activeRef = useRef(active);
  const lightIdRef = useRef(lightId);

  useEffect(() => { activeRef.current = active; }, [active]);
  useEffect(() => { lightIdRef.current = lightId; }, [lightId]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!map || !canvas || !containerEl) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const resize = () => {
      const r = containerEl.getBoundingClientRect();
      canvas.width = Math.max(1, Math.floor(r.width * dpr));
      canvas.height = Math.max(1, Math.floor(r.height * dpr));
      canvas.style.width = `${r.width}px`;
      canvas.style.height = `${r.height}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    window.addEventListener("resize", resize);
    const ro = new ResizeObserver(resize);
    ro.observe(containerEl);

    let raf = 0;
    const tick = () => {
      const w = canvas.width / dpr;
      const h = canvas.height / dpr;
      ctx.clearRect(0, 0, w, h);

      const spec: ParticleSpec | null = LIGHT_PARTICLE_SPECS[lightIdRef.current] ?? null;
      const pos = posRef.current;

      // Spawn nur wenn aktiv + es einen Light-Effekt gibt + Position bekannt
      if (spec && activeRef.current && pos) {
        let screenX: number, screenY: number;
        try {
          const projected = map.project([pos.lng, pos.lat]);
          screenX = projected.x; screenY = projected.y;
        } catch { screenX = -1; screenY = -1; }

        if (screenX >= -50 && screenY >= -50 && screenX <= w + 50 && screenY <= h + 50) {
          const list = particlesRef.current;
          for (let i = 0; i < spec.spawnPerFrame; i++) {
            const isDust = Math.random() < spec.dustRatio;
            const spread = isDust ? spec.dustSpread : spec.coreSpread;
            const sizeMin = isDust ? spec.dustSize[0] : spec.coreSize[0];
            const sizeMax = isDust ? spec.dustSize[1] : spec.coreSize[1];
            const ageMin = isDust ? spec.dustMaxAge[0] : spec.coreMaxAge[0];
            const ageMax = isDust ? spec.dustMaxAge[1] : spec.coreMaxAge[1];
            list.push({
              x: screenX + (Math.random() - 0.5) * spread,
              y: screenY + (Math.random() - 0.5) * spread,
              vx: spec.driftVx + (Math.random() - 0.5) * spec.driftRandomX,
              vy: spec.driftVy + (Math.random() - 0.5) * spec.driftRandomY,
              age: 0,
              maxAge: ageMin + Math.random() * (ageMax - ageMin),
              size: sizeMin + Math.random() * (sizeMax - sizeMin),
              isDust,
            });
          }
        }
      }

      // Update + Draw alle aktiven Partikel
      ctx.globalCompositeOperation = (spec?.blendMode ?? "lighter") as GlobalCompositeOperation;
      const list = particlesRef.current;
      for (let i = list.length - 1; i >= 0; i--) {
        const p = list[i];
        p.age++;
        if (p.age > p.maxAge) { list.splice(i, 1); continue; }
        p.x += p.vx;
        p.y += p.vy;
        const lifeT = p.age / p.maxAge;
        const opacity = Math.max(0, 1 - Math.pow(lifeT, spec?.fadePower ?? 1.4));
        let size = p.size * (1 - lifeT * 0.6);
        if (spec?.pulse) {
          // Sinus-Pulse über die Lebensdauer (3 Halbwellen → wirkt elektrisch)
          size *= 0.7 + 0.3 * Math.abs(Math.sin(lifeT * Math.PI * 3));
        }
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

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
      ro.disconnect();
    };
  }, [map, containerEl, posRef]);

  return (
    <canvas
      ref={canvasRef}
      style={{ position: "absolute", inset: 0, pointerEvents: "none", zIndex: 5 }}
    />
  );
}
