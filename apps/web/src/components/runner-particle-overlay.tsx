"use client";

// Particle-Overlay über der Mapbox-Karte. Zeichnet pro Frame Partikel am
// Runner-Kopf mit shape-spezifischen Draw-Funktionen (Stern, Schneeflocke,
// Flamme, Tropfen, Lightning-Bolt, ...). Identisches Particle-Modell wie
// in /admin/lights-preview HTML-Demo (genutzt damit beides 1:1 aussieht).

import { useEffect, useRef } from "react";
import type { Map as MapboxMap } from "mapbox-gl";
import { LIGHT_PARTICLE_SPECS, hexA, type ParticleSpec, type ParticleShape } from "@/lib/runner-light-particles";

type Particle = {
  x: number; y: number;
  vx: number; vy: number;
  age: number; maxAge: number;
  size: number;
  isDust: boolean;
  shape: ParticleShape;
  rotation: number;
};

// ── Shape-Draw-Funktionen ───────────────────────────────────────────
// Jede zeichnet ein einzelnes Partikel zentriert auf 0,0 (Caller hat schon
// translate(x,y) + rotate gemacht). Größe/Opacity/Color kommen via Args.

function drawCircle(ctx: CanvasRenderingContext2D, size: number, c1: string, c2: string | undefined, op: number) {
  const grad = ctx.createRadialGradient(0, 0, 0, 0, 0, size);
  if (c2) {
    grad.addColorStop(0, hexA(c1, op));
    grad.addColorStop(0.4, hexA(c2, op * 0.7));
    grad.addColorStop(1, hexA(c2, 0));
  } else {
    grad.addColorStop(0, hexA(c1, op));
    grad.addColorStop(1, hexA(c1, 0));
  }
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(0, 0, size, 0, Math.PI * 2);
  ctx.fill();
}

// 4-strahliger Glitter-Stern (Plus + Diagonalen + Glow)
function drawSpark(ctx: CanvasRenderingContext2D, size: number, c1: string, c2: string | undefined, op: number) {
  // Bright glow background
  const glow = ctx.createRadialGradient(0, 0, 0, 0, 0, size * 1.8);
  glow.addColorStop(0, hexA(c1, op * 0.6));
  glow.addColorStop(0.5, hexA(c2 || c1, op * 0.3));
  glow.addColorStop(1, hexA(c1, 0));
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(0, 0, size * 1.8, 0, Math.PI * 2);
  ctx.fill();
  // 4-strahliger Stern (Lensflare-Look)
  ctx.fillStyle = hexA("#FFFFFF", op);
  const long = size * 2.5;
  const thin = size * 0.25;
  ctx.beginPath();
  ctx.moveTo(0, -long); ctx.lineTo(thin, 0); ctx.lineTo(0, long); ctx.lineTo(-thin, 0);
  ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(-long, 0); ctx.lineTo(0, thin); ctx.lineTo(long, 0); ctx.lineTo(0, -thin);
  ctx.closePath();
  ctx.fill();
  // Bright center dot
  ctx.fillStyle = hexA("#FFFFFF", op);
  ctx.beginPath(); ctx.arc(0, 0, size * 0.4, 0, Math.PI * 2); ctx.fill();
}

// 6-strahlige Schneeflocke
function drawSnow(ctx: CanvasRenderingContext2D, size: number, c1: string, c2: string | undefined, op: number) {
  // Soft halo
  const glow = ctx.createRadialGradient(0, 0, 0, 0, 0, size * 1.5);
  glow.addColorStop(0, hexA(c1, op * 0.5));
  glow.addColorStop(1, hexA(c1, 0));
  ctx.fillStyle = glow;
  ctx.beginPath(); ctx.arc(0, 0, size * 1.5, 0, Math.PI * 2); ctx.fill();
  // 6 Strahlen
  ctx.strokeStyle = hexA(c2 || "#FFFFFF", op);
  ctx.lineWidth = size * 0.25;
  ctx.lineCap = "round";
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(Math.cos(a) * size, Math.sin(a) * size);
    ctx.stroke();
    // Mini-Querstriche für Schneeflocken-Look
    const midX = Math.cos(a) * size * 0.6;
    const midY = Math.sin(a) * size * 0.6;
    const perpA = a + Math.PI / 2;
    ctx.beginPath();
    ctx.moveTo(midX - Math.cos(perpA) * size * 0.2, midY - Math.sin(perpA) * size * 0.2);
    ctx.lineTo(midX + Math.cos(perpA) * size * 0.2, midY + Math.sin(perpA) * size * 0.2);
    ctx.stroke();
  }
  // Center
  ctx.fillStyle = hexA("#FFFFFF", op);
  ctx.beginPath(); ctx.arc(0, 0, size * 0.2, 0, Math.PI * 2); ctx.fill();
}

// 5-strahliger Stern (Galaxy, Cosmic)
function drawStar(ctx: CanvasRenderingContext2D, size: number, c1: string, c2: string | undefined, op: number) {
  // Glow
  const glow = ctx.createRadialGradient(0, 0, 0, 0, 0, size * 2.2);
  glow.addColorStop(0, hexA(c2 || c1, op * 0.6));
  glow.addColorStop(1, hexA(c2 || c1, 0));
  ctx.fillStyle = glow;
  ctx.beginPath(); ctx.arc(0, 0, size * 2.2, 0, Math.PI * 2); ctx.fill();
  // 5-Punkt-Stern
  ctx.fillStyle = hexA(c1, op);
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2 - Math.PI / 2;
    const r = i % 2 === 0 ? size : size * 0.4;
    const x = Math.cos(a) * r;
    const y = Math.sin(a) * r;
    if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
  }
  ctx.closePath();
  ctx.fill();
}

// Vertikaler Flammen-Tropfen (Fire)
function drawFlame(ctx: CanvasRenderingContext2D, size: number, c1: string, c2: string | undefined, op: number) {
  // Gradient von hell unten zu transparent oben
  const grad = ctx.createLinearGradient(0, size * 1.5, 0, -size * 0.5);
  grad.addColorStop(0, hexA(c2 || c1, op));        // hot bottom
  grad.addColorStop(0.5, hexA(c1, op * 0.85));
  grad.addColorStop(1, hexA(c1, 0));               // fade top
  ctx.fillStyle = grad;
  // Flammen-Form: schmal oben, breit unten, geschwungen
  ctx.beginPath();
  ctx.moveTo(0, -size * 0.5);                       // Spitze oben
  ctx.bezierCurveTo(size * 0.5, -size * 0.2, size * 0.8, size * 0.3, size * 0.4, size);
  ctx.bezierCurveTo(size * 0.2, size * 1.2, -size * 0.2, size * 1.2, -size * 0.4, size);
  ctx.bezierCurveTo(-size * 0.8, size * 0.3, -size * 0.5, -size * 0.2, 0, -size * 0.5);
  ctx.closePath();
  ctx.fill();
}

// Tropfen (Lava, Ocean) — runde Kugel mit kleinem Schweif
function drawDrop(ctx: CanvasRenderingContext2D, size: number, c1: string, c2: string | undefined, op: number) {
  const grad = ctx.createRadialGradient(0, -size * 0.2, 0, 0, 0, size);
  grad.addColorStop(0, hexA(c2 || c1, op));
  grad.addColorStop(0.5, hexA(c1, op * 0.85));
  grad.addColorStop(1, hexA(c1, 0));
  ctx.fillStyle = grad;
  // Tropfen-Form: rund unten, leicht spitz oben
  ctx.beginPath();
  ctx.moveTo(0, -size * 0.9);                       // Spitze oben
  ctx.bezierCurveTo(size * 0.85, -size * 0.6, size, size * 0.3, 0, size);
  ctx.bezierCurveTo(-size, size * 0.3, -size * 0.85, -size * 0.6, 0, -size * 0.9);
  ctx.closePath();
  ctx.fill();
}

// Wisp (Shadow, Aurora) — vertikal elongierter, sehr soft
function drawWisp(ctx: CanvasRenderingContext2D, size: number, c1: string, c2: string | undefined, op: number) {
  // Elliptischer Gradient — schmal aber lang
  ctx.save();
  ctx.scale(0.5, 1.6);
  const grad = ctx.createRadialGradient(0, 0, 0, 0, 0, size);
  grad.addColorStop(0, hexA(c1, op * 0.85));
  if (c2) grad.addColorStop(0.5, hexA(c2, op * 0.5));
  grad.addColorStop(1, hexA(c1, 0));
  ctx.fillStyle = grad;
  ctx.beginPath(); ctx.arc(0, 0, size, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}

// Blatt (Forest) — schräg gestelltes Oval
function drawLeaf(ctx: CanvasRenderingContext2D, size: number, c1: string, c2: string | undefined, op: number) {
  ctx.save();
  ctx.scale(1, 0.55);
  const grad = ctx.createRadialGradient(0, 0, 0, 0, 0, size);
  grad.addColorStop(0, hexA(c2 || c1, op));
  grad.addColorStop(0.6, hexA(c1, op * 0.7));
  grad.addColorStop(1, hexA(c1, 0));
  ctx.fillStyle = grad;
  ctx.beginPath();
  // Blatt-Form: Mandel-artig
  ctx.moveTo(-size, 0);
  ctx.bezierCurveTo(-size * 0.5, -size * 1.2, size * 0.5, -size * 1.2, size, 0);
  ctx.bezierCurveTo(size * 0.5, size * 1.2, -size * 0.5, size * 1.2, -size, 0);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

// Lightning-Bolt (Plasma) — Zigzag-Linie mit Glow
function drawBolt(ctx: CanvasRenderingContext2D, size: number, c1: string, c2: string | undefined, op: number, dirX: number, dirY: number, seed: number) {
  // Bolt-Länge entspricht size, geht in (dirX,dirY)-Richtung
  const len = size;
  const dx = dirX * len;
  const dy = dirY * len;
  const segments = 4;
  // Generiere Zigzag-Punkte mit deterministischem Seed
  const pts: Array<[number, number]> = [[0, 0]];
  for (let i = 1; i < segments; i++) {
    const tt = i / segments;
    const baseX = dx * tt;
    const baseY = dy * tt;
    // Perpendikuläre Streuung
    const perpX = -dirY;
    const perpY = dirX;
    const noise = (Math.sin(seed * 13.7 + i * 7) * Math.cos(seed * 5.3 + i * 3)) * size * 0.3;
    pts.push([baseX + perpX * noise, baseY + perpY * noise]);
  }
  pts.push([dx, dy]);
  // Glow-Layer (breit + transparent)
  ctx.strokeStyle = hexA(c2 || c1, op * 0.5);
  ctx.lineWidth = 5;
  ctx.lineCap = "round"; ctx.lineJoin = "round";
  ctx.shadowColor = c1;
  ctx.shadowBlur = 8;
  ctx.beginPath();
  ctx.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
  ctx.stroke();
  ctx.shadowBlur = 0;
  // Inner bright line
  ctx.strokeStyle = hexA("#FFFFFF", op);
  ctx.lineWidth = 1.8;
  ctx.beginPath();
  ctx.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
  ctx.stroke();
}

// Ring (Sapphire, Neon) — expandierender Kreis
function drawRing(ctx: CanvasRenderingContext2D, size: number, c1: string, c2: string | undefined, op: number) {
  ctx.strokeStyle = hexA(c1, op);
  ctx.lineWidth = Math.max(1, size * 0.18);
  ctx.shadowColor = c2 || c1;
  ctx.shadowBlur = size * 0.8;
  ctx.beginPath(); ctx.arc(0, 0, size, 0, Math.PI * 2); ctx.stroke();
  ctx.shadowBlur = 0;
}

export function drawParticle(
  ctx: CanvasRenderingContext2D,
  shape: ParticleShape,
  x: number, y: number, size: number, rotation: number,
  c1: string, c2: string | undefined, opacity: number,
  vx?: number, vy?: number, seed?: number,
) {
  ctx.save();
  ctx.translate(x, y);
  if (rotation !== 0 && shape !== "bolt" && shape !== "ring") ctx.rotate(rotation);
  switch (shape) {
    case "circle": drawCircle(ctx, size, c1, c2, opacity); break;
    case "spark":  drawSpark(ctx, size, c1, c2, opacity); break;
    case "snow":   drawSnow(ctx, size, c1, c2, opacity); break;
    case "star":   drawStar(ctx, size, c1, c2, opacity); break;
    case "flame":  drawFlame(ctx, size, c1, c2, opacity); break;
    case "drop":   drawDrop(ctx, size, c1, c2, opacity); break;
    case "wisp":   drawWisp(ctx, size, c1, c2, opacity); break;
    case "leaf":   drawLeaf(ctx, size, c1, c2, opacity); break;
    case "ring":   drawRing(ctx, size, c1, c2, opacity); break;
    case "bolt": {
      const len = Math.hypot(vx ?? 1, vy ?? 0) || 1;
      drawBolt(ctx, size, c1, c2, opacity, (vx ?? 1) / len, (vy ?? 0) / len, seed ?? 0);
      break;
    }
  }
  ctx.restore();
}

export function RunnerParticleOverlay({
  map, posRef, lightId, containerEl, active,
}: {
  map: MapboxMap | null;
  posRef: React.MutableRefObject<{ lat: number; lng: number } | null>;
  lightId: string;
  containerEl: HTMLElement | null;
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
      const w = canvas.width / dpr, h = canvas.height / dpr;
      ctx.clearRect(0, 0, w, h);

      const spec: ParticleSpec | null = LIGHT_PARTICLE_SPECS[lightIdRef.current] ?? null;
      const pos = posRef.current;

      if (spec && activeRef.current && pos) {
        let sx: number, sy: number;
        try {
          const p = map.project([pos.lng, pos.lat]);
          sx = p.x; sy = p.y;
        } catch { sx = -1; sy = -1; }

        if (sx >= -50 && sy >= -50 && sx <= w + 50 && sy <= h + 50) {
          const list = particlesRef.current;
          for (let i = 0; i < spec.spawnPerFrame; i++) {
            const isDust = Math.random() < spec.dustRatio;
            const useShape2 = !isDust && spec.shape2 && Math.random() < (spec.shape2Ratio ?? 0);
            const shape = isDust ? "circle" : (useShape2 ? spec.shape2! : spec.shape);
            const spread = isDust ? spec.dustSpread : spec.coreSpread;
            const sizeMin = isDust ? spec.dustSize[0] : spec.coreSize[0];
            const sizeMax = isDust ? spec.dustSize[1] : spec.coreSize[1];
            const ageMin = isDust ? spec.dustMaxAge[0] : spec.coreMaxAge[0];
            const ageMax = isDust ? spec.dustMaxAge[1] : spec.coreMaxAge[1];
            list.push({
              x: sx + (Math.random() - 0.5) * spread,
              y: sy + (Math.random() - 0.5) * spread,
              vx: spec.driftVx + (Math.random() - 0.5) * spec.driftRandomX,
              vy: spec.driftVy + (Math.random() - 0.5) * spec.driftRandomY,
              age: 0,
              maxAge: ageMin + Math.random() * (ageMax - ageMin),
              size: sizeMin + Math.random() * (sizeMax - sizeMin),
              isDust, shape,
              rotation: Math.random() * Math.PI * 2,
            });
          }
        }
      }

      ctx.globalCompositeOperation = (spec?.blendMode ?? "lighter") as GlobalCompositeOperation;
      const list = particlesRef.current;
      for (let i = list.length - 1; i >= 0; i--) {
        const p = list[i];
        p.age++;
        if (p.age > p.maxAge) { list.splice(i, 1); continue; }
        // Wind-Curl
        if (spec?.windCurl) {
          p.vx += Math.sin(p.age * 0.08 + p.rotation) * spec.windCurl * 0.05;
        }
        p.x += p.vx; p.y += p.vy;
        // Schwerkraft-Decay für aufsteigende Particles
        if (spec && spec.driftVy < 0) p.vy *= 0.985;
        // Rotation während Flug
        if (spec?.rotate) p.rotation += 0.04;
        const lifeT = p.age / p.maxAge;
        const opacity = Math.max(0, 1 - Math.pow(lifeT, spec?.fadePower ?? 1.4));
        let size = p.size * (1 - lifeT * 0.5);
        if (spec?.pulse) size *= 0.7 + 0.3 * Math.abs(Math.sin(lifeT * Math.PI * 3));
        if (spec?.shape === "ring" && !p.isDust) {
          // Ring expandiert
          size = p.size * (1 + lifeT * 1.5);
        }
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
