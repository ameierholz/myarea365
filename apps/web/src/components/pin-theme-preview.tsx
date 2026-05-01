"use client";

// Animierte Live-Vorschau pro Pin-Theme — analog zu LightTrailPreview.
// Zeichnet einen stilisierten Pin in der Mitte + theme-spezifischen Effekt
// (Schneeflocken, Lava-Risse, Blitze, Halo, Vortex, Scan-Lines, etc.).
// Ziel: jeder Look so cool dass man ihn haben will.

import { useEffect, useRef } from "react";
import { hexA } from "@/lib/runner-light-particles";
import type { PinTheme } from "@/lib/pin-themes";

type P = {
  x: number; y: number;
  vx: number; vy: number;
  age: number; maxAge: number;
  size: number;
  hue?: number;
  rot?: number;
  kind?: string;
};

export function PinThemePreview({
  theme, icon, accent, glow, bg,
  size = 72,
  className,
}: {
  theme: PinTheme;
  icon: string;
  accent: string;
  glow: string;
  bg: string;
  size?: number;
  className?: string;
}) {
  const ref = useRef<HTMLCanvasElement | null>(null);
  const iconRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const c = ref.current; if (!c) return;
    const dpr = window.devicePixelRatio || 1;
    c.width = size * dpr;
    c.height = size * dpr;
    const ctx = c.getContext("2d"); if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const cx = size / 2;
    const cy = size / 2;
    const pinR = size * 0.22; // Pin-Radius (gemalt unter Icon)

    const particles: P[] = [];
    let frame = 0;
    let raf = 0;

    const tick = () => {
      frame++;
      ctx.clearRect(0, 0, size, size);

      // ── BACKGROUND-EFFECT (hinter dem Pin) ───────────────────────────
      drawBackground(ctx, theme, size, cx, cy, frame, accent, glow);

      // ── PIN-KÖRPER (Glow + Kreis, Icon kommt als HTML drüber) ────────
      drawPinBody(ctx, cx, cy, pinR, theme, accent, glow, frame);

      // ── PARTICLE-SPAWN + UPDATE (vor dem Pin) ────────────────────────
      spawnAndDraw(ctx, particles, theme, size, cx, cy, pinR, frame, accent, glow);

      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [theme, accent, glow, bg, size]);

  return (
    <div className={className} style={{
      position: "relative", width: size, height: size,
      borderRadius: 16,
      background: bg,
      border: `2px solid ${accent}`,
      boxShadow: `0 0 14px ${glow}`,
      overflow: "hidden",
    }}>
      <canvas ref={ref} style={{ position: "absolute", inset: 0, width: size, height: size }} />
      <div ref={iconRef} style={{
        position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: size * 0.42, pointerEvents: "none",
        filter: theme === "void" ? "brightness(0.6)" : undefined,
      }}>{icon}</div>
    </div>
  );
}

// ── BACKGROUND-EFFEKTE ───────────────────────────────────────────────────

function drawBackground(
  ctx: CanvasRenderingContext2D, theme: PinTheme, S: number, cx: number, cy: number,
  f: number, accent: string, glow: string,
) {
  switch (theme) {
    case "matrix": {
      // Digital-Regen (grüne Spalten)
      ctx.font = "bold 9px monospace";
      const cols = 8;
      for (let i = 0; i < cols; i++) {
        const x = (i + 0.5) * (S / cols);
        const offset = (f * 0.6 + i * 13) % (S + 20);
        for (let j = 0; j < 5; j++) {
          const y = (offset - j * 11 + S) % S;
          const alpha = (1 - j / 5) * 0.7;
          ctx.fillStyle = hexA("#00FF66", alpha);
          ctx.fillText(String.fromCharCode(0x30 + ((i * 7 + j * 3 + Math.floor(f / 8)) % 10)), x - 3, y);
        }
      }
      break;
    }
    case "vaporwave": {
      // Perspektivisches Grid Richtung Horizon
      ctx.strokeStyle = hexA(accent, 0.5);
      ctx.lineWidth = 0.6;
      const horizon = S * 0.55;
      const off = (f * 0.5) % 12;
      for (let i = 0; i < 8; i++) {
        const y = horizon + i * 4 + off;
        const w = ((y - horizon) / (S - horizon)) * S;
        ctx.beginPath();
        ctx.moveTo(cx - w / 2, y);
        ctx.lineTo(cx + w / 2, y);
        ctx.stroke();
      }
      for (let i = -4; i <= 4; i++) {
        ctx.beginPath();
        ctx.moveTo(cx + i * 3, horizon);
        ctx.lineTo(cx + i * (S / 6), S);
        ctx.strokeStyle = hexA(glow, 0.4);
        ctx.stroke();
      }
      // Sun
      const sunGrad = ctx.createLinearGradient(cx, horizon - 20, cx, horizon);
      sunGrad.addColorStop(0, hexA(accent, 0.9));
      sunGrad.addColorStop(1, hexA(glow, 0.5));
      ctx.fillStyle = sunGrad;
      ctx.beginPath(); ctx.arc(cx, horizon, 14, Math.PI, Math.PI * 2); ctx.fill();
      break;
    }
    case "cyberpunk":
    case "neon": {
      // Scan-Lines
      const off = (f * 0.4) % 4;
      for (let y = -off; y < S; y += 4) {
        ctx.fillStyle = hexA(accent, 0.08);
        ctx.fillRect(0, y, S, 1);
      }
      // Glitch-Bar gelegentlich
      if (theme === "cyberpunk" && Math.floor(f / 30) % 7 === 0) {
        const gy = (f * 13) % S;
        ctx.fillStyle = hexA(glow, 0.4);
        ctx.fillRect(0, gy, S, 2);
      }
      break;
    }
    case "hologram": {
      // Rotierende Regenbogen-Konuse
      const ang = (f * 0.04) % (Math.PI * 2);
      for (let i = 0; i < 6; i++) {
        const a = ang + (i * Math.PI) / 3;
        const hue = (i * 60 + f * 2) % 360;
        ctx.strokeStyle = `hsla(${hue}, 90%, 60%, 0.25)`;
        ctx.lineWidth = 8;
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.lineTo(cx + Math.cos(a) * S * 0.6, cy + Math.sin(a) * S * 0.6);
        ctx.stroke();
      }
      break;
    }
    case "nebula": {
      // Sanfte rotierende Wirbel
      ctx.globalCompositeOperation = "lighter";
      for (let i = 0; i < 3; i++) {
        const a = f * 0.01 + (i * Math.PI * 2) / 3;
        const r = S * 0.32 + Math.sin(f * 0.03 + i) * 4;
        const x = cx + Math.cos(a) * r * 0.6;
        const y = cy + Math.sin(a) * r * 0.6;
        const grad = ctx.createRadialGradient(x, y, 0, x, y, S * 0.3);
        grad.addColorStop(0, hexA(i % 2 ? accent : glow, 0.5));
        grad.addColorStop(1, hexA(accent, 0));
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, S, S);
      }
      ctx.globalCompositeOperation = "source-over";
      break;
    }
    case "bloodmoon": {
      // Dunkle pulsierende Aura
      const pulse = 0.5 + Math.sin(f * 0.05) * 0.2;
      const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, S * 0.5);
      grad.addColorStop(0, hexA("#DC143C", pulse * 0.5));
      grad.addColorStop(0.7, hexA("#8B0000", pulse * 0.3));
      grad.addColorStop(1, hexA("#1a0000", 0));
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, S, S);
      break;
    }
    case "void": {
      // Schwarzes Loch — verzerrter Ring
      const ang = f * 0.06;
      ctx.globalCompositeOperation = "lighter";
      for (let i = 0; i < 24; i++) {
        const a = ang + (i / 24) * Math.PI * 2;
        const r = S * 0.34 + Math.sin(a * 3 + f * 0.05) * 3;
        const x = cx + Math.cos(a) * r;
        const y = cy + Math.sin(a) * r;
        ctx.fillStyle = hexA(i % 2 ? accent : glow, 0.6);
        ctx.beginPath(); ctx.arc(x, y, 2, 0, Math.PI * 2); ctx.fill();
      }
      ctx.globalCompositeOperation = "source-over";
      // Dunkle Mitte
      const dark = ctx.createRadialGradient(cx, cy, 0, cx, cy, S * 0.3);
      dark.addColorStop(0, "rgba(0,0,0,0.85)");
      dark.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = dark;
      ctx.fillRect(0, 0, S, S);
      break;
    }
    case "celestial": {
      // Rotierender Strahlenkranz
      const ang = f * 0.015;
      ctx.globalCompositeOperation = "lighter";
      for (let i = 0; i < 12; i++) {
        const a = ang + (i / 12) * Math.PI * 2;
        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate(a);
        const grad = ctx.createLinearGradient(0, 0, S * 0.5, 0);
        grad.addColorStop(0, hexA(accent, 0.5));
        grad.addColorStop(1, hexA(accent, 0));
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.moveTo(0, -2); ctx.lineTo(S * 0.5, -1);
        ctx.lineTo(S * 0.5, 1); ctx.lineTo(0, 2);
        ctx.fill();
        ctx.restore();
      }
      ctx.globalCompositeOperation = "source-over";
      break;
    }
    case "prismatic": {
      // Rotierende Refraktions-Hexagonen
      const ang = f * 0.02;
      ctx.globalCompositeOperation = "lighter";
      for (let i = 0; i < 6; i++) {
        const a = ang + (i / 6) * Math.PI * 2;
        const hue = (i * 60 + f * 3) % 360;
        const x = cx + Math.cos(a) * S * 0.28;
        const y = cy + Math.sin(a) * S * 0.28;
        const grad = ctx.createRadialGradient(x, y, 0, x, y, S * 0.18);
        grad.addColorStop(0, `hsla(${hue}, 90%, 60%, 0.55)`);
        grad.addColorStop(1, `hsla(${hue}, 90%, 60%, 0)`);
        ctx.fillStyle = grad;
        ctx.beginPath(); ctx.arc(x, y, S * 0.18, 0, Math.PI * 2); ctx.fill();
      }
      ctx.globalCompositeOperation = "source-over";
      break;
    }
    case "lava": {
      // Glühende Risse im Boden
      ctx.strokeStyle = hexA("#FFC700", 0.6 + Math.sin(f * 0.08) * 0.2);
      ctx.lineWidth = 1.2;
      ctx.shadowColor = "#FF6B00";
      ctx.shadowBlur = 6;
      for (let i = 0; i < 3; i++) {
        const seed = i * 23;
        ctx.beginPath();
        ctx.moveTo(0, S * 0.3 + i * 10);
        for (let x = 0; x < S; x += 8) {
          const y = S * 0.3 + i * 10 + Math.sin(x * 0.2 + seed + f * 0.02) * 4;
          ctx.lineTo(x, y);
        }
        ctx.stroke();
      }
      ctx.shadowBlur = 0;
      break;
    }
    case "thunderstorm": {
      // Dunkler Wolken-Hintergrund (statisch sanft)
      const grad = ctx.createLinearGradient(0, 0, 0, S);
      grad.addColorStop(0, "rgba(20,30,55,0.4)");
      grad.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = grad; ctx.fillRect(0, 0, S, S);
      break;
    }
    case "arcade": {
      // Pixel-Rainbow-Border
      const colors = ["#FF2D78", "#FFD700", "#22D1C3", "#a855f7"];
      const step = 4;
      for (let i = 0; i < S; i += step) {
        const idx = (Math.floor(i / step) + Math.floor(f / 6)) % colors.length;
        ctx.fillStyle = colors[idx];
        ctx.fillRect(i, 0, step, 2);
        ctx.fillRect(i, S - 2, step, 2);
        ctx.fillRect(0, i, 2, step);
        ctx.fillRect(S - 2, i, 2, step);
      }
      break;
    }
    case "frost": {
      // Frost-Schimmer am Rand
      ctx.strokeStyle = hexA("#B0E6FF", 0.4 + Math.sin(f * 0.08) * 0.2);
      ctx.lineWidth = 0.8;
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2 + f * 0.005;
        ctx.beginPath();
        ctx.moveTo(cx + Math.cos(a) * S * 0.4, cy + Math.sin(a) * S * 0.4);
        ctx.lineTo(cx + Math.cos(a) * S * 0.48, cy + Math.sin(a) * S * 0.48);
        ctx.stroke();
      }
      break;
    }
    case "toxic": {
      // Grünlicher Slime-Pool unten
      const grad = ctx.createLinearGradient(0, S * 0.6, 0, S);
      grad.addColorStop(0, hexA("#66FF00", 0));
      grad.addColorStop(1, hexA("#66FF00", 0.35));
      ctx.fillStyle = grad; ctx.fillRect(0, 0, S, S);
      break;
    }
    default: break;
  }
}

// ── PIN-KÖRPER ───────────────────────────────────────────────────────────

function drawPinBody(
  ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number,
  theme: PinTheme, accent: string, glow: string, f: number,
) {
  // Pulse für viele Themes
  const pulse = 1 + Math.sin(f * 0.08) * 0.06;
  const rr = r * pulse;

  // Outer Glow
  ctx.shadowColor = glow;
  ctx.shadowBlur = theme === "celestial" || theme === "neon" || theme === "thunderstorm" ? 18 : 10;

  // Body
  const grad = ctx.createRadialGradient(cx - rr * 0.3, cy - rr * 0.3, 0, cx, cy, rr);
  if (theme === "hologram" || theme === "prismatic") {
    const hue = (f * 3) % 360;
    grad.addColorStop(0, `hsl(${hue}, 90%, 70%)`);
    grad.addColorStop(0.7, `hsl(${(hue + 120) % 360}, 90%, 50%)`);
    grad.addColorStop(1, `hsl(${(hue + 240) % 360}, 90%, 35%)`);
  } else {
    grad.addColorStop(0, hexA(accent, 1));
    grad.addColorStop(0.7, hexA(accent, 0.85));
    grad.addColorStop(1, hexA(glow, 0.5));
  }
  ctx.fillStyle = grad;
  ctx.beginPath(); ctx.arc(cx, cy, rr, 0, Math.PI * 2); ctx.fill();
  ctx.shadowBlur = 0;

  // Highlight
  ctx.fillStyle = "rgba(255,255,255,0.35)";
  ctx.beginPath(); ctx.arc(cx - rr * 0.35, cy - rr * 0.35, rr * 0.25, 0, Math.PI * 2); ctx.fill();
}

// ── PARTICLE-SPAWN + DRAW ────────────────────────────────────────────────

function spawnAndDraw(
  ctx: CanvasRenderingContext2D, particles: P[], theme: PinTheme,
  S: number, cx: number, cy: number, pinR: number, f: number,
  accent: string, glow: string,
) {
  // Spawn-Logik per Theme
  const spawn = (n: number, factory: () => P) => {
    for (let i = 0; i < n; i++) particles.push(factory());
  };

  switch (theme) {
    case "golden":
      spawn(2, () => ({
        x: cx + (Math.random() - 0.5) * pinR * 2,
        y: cy + (Math.random() - 0.5) * pinR * 2,
        vx: (Math.random() - 0.5) * 0.4,
        vy: -0.3 - Math.random() * 0.5,
        age: 0, maxAge: 30 + Math.random() * 20,
        size: 1 + Math.random() * 1.5,
        kind: "spark",
      }));
      break;
    case "frost":
      spawn(1, () => ({
        x: Math.random() * S,
        y: -3,
        vx: (Math.random() - 0.5) * 0.2,
        vy: 0.3 + Math.random() * 0.4,
        age: 0, maxAge: 80,
        size: 1.2 + Math.random() * 1.2,
        rot: Math.random() * Math.PI * 2,
        kind: "snow",
      }));
      break;
    case "inferno":
    case "lava":
      spawn(2, () => ({
        x: cx + (Math.random() - 0.5) * pinR * 1.6,
        y: cy + pinR * 0.6,
        vx: (Math.random() - 0.5) * 0.3,
        vy: -0.6 - Math.random() * 0.7,
        age: 0, maxAge: 25 + Math.random() * 15,
        size: 2 + Math.random() * 2,
        kind: "flame",
      }));
      break;
    case "thunderstorm":
      // Gelegentlich Blitz spawnen
      if (f % 18 === 0) {
        const a = Math.random() * Math.PI * 2;
        particles.push({
          x: cx + Math.cos(a) * pinR * 1.4,
          y: cy + Math.sin(a) * pinR * 1.4,
          vx: 0, vy: 0,
          age: 0, maxAge: 8,
          size: pinR * (1.8 + Math.random() * 0.6),
          rot: a,
          kind: "bolt",
        });
      }
      break;
    case "celestial":
      spawn(1, () => ({
        x: cx + (Math.random() - 0.5) * S * 0.5,
        y: cy + (Math.random() - 0.5) * S * 0.5,
        vx: 0, vy: 0,
        age: 0, maxAge: 30,
        size: 0.8 + Math.random() * 1.2,
        kind: "twinkle",
      }));
      break;
    case "toxic":
      if (f % 4 === 0) particles.push({
        x: cx + (Math.random() - 0.5) * pinR * 2,
        y: S - 4,
        vx: (Math.random() - 0.5) * 0.15,
        vy: -0.5 - Math.random() * 0.4,
        age: 0, maxAge: 50,
        size: 1.5 + Math.random() * 2,
        kind: "bubble",
      });
      break;
    case "void":
      // Inward-spiral particles
      if (f % 2 === 0) {
        const a = Math.random() * Math.PI * 2;
        const r = S * 0.45;
        particles.push({
          x: cx + Math.cos(a) * r,
          y: cy + Math.sin(a) * r,
          vx: -Math.cos(a) * 0.6,
          vy: -Math.sin(a) * 0.6,
          age: 0, maxAge: 50,
          size: 1.2 + Math.random() * 0.8,
          rot: a,
          kind: "spiral",
        });
      }
      break;
    case "nebula":
      spawn(1, () => ({
        x: cx + (Math.random() - 0.5) * S * 0.7,
        y: cy + (Math.random() - 0.5) * S * 0.7,
        vx: (Math.random() - 0.5) * 0.2,
        vy: (Math.random() - 0.5) * 0.2,
        age: 0, maxAge: 60,
        size: 0.8 + Math.random() * 1.2,
        kind: "stardust",
      }));
      break;
    case "neon":
    case "cyberpunk":
      // Pulsierende Ring-Wellen
      if (f % 22 === 0) particles.push({
        x: cx, y: cy, vx: 0, vy: 0,
        age: 0, maxAge: 30,
        size: pinR * 1.2,
        kind: "ring",
      });
      break;
    case "bloodmoon":
      if (f % 3 === 0) particles.push({
        x: cx + (Math.random() - 0.5) * pinR * 2.4,
        y: cy + (Math.random() - 0.5) * pinR * 2.4,
        vx: (Math.random() - 0.5) * 0.1,
        vy: (Math.random() - 0.5) * 0.1,
        age: 0, maxAge: 35,
        size: 1 + Math.random() * 1.5,
        kind: "drip",
      });
      break;
    default: break;
  }

  ctx.globalCompositeOperation = "lighter";
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.age++;
    if (p.age > p.maxAge) { particles.splice(i, 1); continue; }
    p.x += p.vx; p.y += p.vy;
    if (p.kind === "flame") p.vy *= 0.97;
    if (p.kind === "spark") p.vy += 0.02;
    if (p.kind === "snow") { if (p.rot !== undefined) p.rot += 0.04; p.vx += Math.sin(p.age * 0.1) * 0.02; }
    const lifeT = p.age / p.maxAge;
    const op = Math.max(0, 1 - lifeT);

    switch (p.kind) {
      case "spark":
        drawTwinkle(ctx, p.x, p.y, p.size * (1 - lifeT * 0.4), "#FFD700", "#FFAC33", op);
        break;
      case "snow":
        drawSnow(ctx, p.x, p.y, p.size, p.rot ?? 0, "#B0E6FF", "#FFFFFF", op * 0.95);
        break;
      case "flame":
        drawFlame(ctx, p.x, p.y, p.size * (1 - lifeT * 0.3), theme === "lava" ? "#FF6B00" : "#FF4500", "#FFD700", op);
        break;
      case "bolt":
        drawBolt(ctx, p.x, p.y, p.size, p.rot ?? 0, "#FFEE00", "#60a5fa", op, p.age);
        break;
      case "twinkle":
        drawTwinkle(ctx, p.x, p.y, p.size * (1 + Math.sin(lifeT * Math.PI) * 1.2), "#FFFFFF", "#FFE066", Math.sin(lifeT * Math.PI) * 0.9);
        break;
      case "bubble":
        drawBubble(ctx, p.x, p.y, p.size, "#66FF00", "#CCFF33", op);
        break;
      case "spiral":
        drawCircle(ctx, p.x, p.y, p.size * (1 - lifeT * 0.5), accent, glow, op);
        break;
      case "stardust":
        drawCircle(ctx, p.x, p.y, p.size * (1 + Math.sin(lifeT * Math.PI)), accent, glow, op * 0.8);
        break;
      case "ring": {
        const rad = p.size * (1 + lifeT * 1.6);
        ctx.strokeStyle = hexA(accent, op * 0.8);
        ctx.lineWidth = 1.4;
        ctx.beginPath(); ctx.arc(p.x, p.y, rad, 0, Math.PI * 2); ctx.stroke();
        break;
      }
      case "drip":
        drawCircle(ctx, p.x, p.y, p.size * (1 - lifeT * 0.5), "#DC143C", "#8B0000", op);
        break;
    }
  }
  ctx.globalCompositeOperation = "source-over";
}

// ── SHAPE-DRAWS ──────────────────────────────────────────────────────────

function drawCircle(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, c1: string, c2: string, op: number) {
  const grad = ctx.createRadialGradient(x, y, 0, x, y, size);
  grad.addColorStop(0, hexA(c1, op));
  grad.addColorStop(0.4, hexA(c2, op * 0.7));
  grad.addColorStop(1, hexA(c2, 0));
  ctx.fillStyle = grad;
  ctx.beginPath(); ctx.arc(x, y, size, 0, Math.PI * 2); ctx.fill();
}

function drawTwinkle(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, c1: string, c2: string, op: number) {
  const glow = ctx.createRadialGradient(x, y, 0, x, y, size * 2);
  glow.addColorStop(0, hexA(c1, op));
  glow.addColorStop(0.5, hexA(c2, op * 0.5));
  glow.addColorStop(1, hexA(c1, 0));
  ctx.fillStyle = glow;
  ctx.beginPath(); ctx.arc(x, y, size * 2, 0, Math.PI * 2); ctx.fill();
  // 4 strahlen
  ctx.strokeStyle = hexA("#FFFFFF", op);
  ctx.lineWidth = 0.8;
  ctx.beginPath();
  ctx.moveTo(x - size * 1.6, y); ctx.lineTo(x + size * 1.6, y);
  ctx.moveTo(x, y - size * 1.6); ctx.lineTo(x, y + size * 1.6);
  ctx.stroke();
}

function drawSnow(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, rot: number, c1: string, c2: string, op: number) {
  ctx.save();
  ctx.translate(x, y); ctx.rotate(rot);
  ctx.strokeStyle = hexA(c1, op);
  ctx.lineWidth = 0.7;
  for (let i = 0; i < 3; i++) {
    ctx.rotate(Math.PI / 3);
    ctx.beginPath();
    ctx.moveTo(-size, 0); ctx.lineTo(size, 0);
    ctx.stroke();
  }
  ctx.fillStyle = hexA(c2, op);
  ctx.beginPath(); ctx.arc(0, 0, 0.6, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}

function drawFlame(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, c1: string, c2: string, op: number) {
  ctx.save();
  ctx.translate(x, y);
  const grad = ctx.createRadialGradient(0, size * 0.3, 0, 0, 0, size * 1.5);
  grad.addColorStop(0, hexA(c2, op));
  grad.addColorStop(0.4, hexA(c1, op * 0.85));
  grad.addColorStop(1, hexA(c1, 0));
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.moveTo(0, -size * 1.4);
  ctx.quadraticCurveTo(size * 0.9, -size * 0.3, size * 0.5, size * 0.7);
  ctx.quadraticCurveTo(0, size * 1.1, -size * 0.5, size * 0.7);
  ctx.quadraticCurveTo(-size * 0.9, -size * 0.3, 0, -size * 1.4);
  ctx.fill();
  ctx.restore();
}

function drawBolt(ctx: CanvasRenderingContext2D, x: number, y: number, len: number, ang: number, c1: string, c2: string, op: number, seed: number) {
  ctx.save();
  ctx.translate(x, y); ctx.rotate(ang);
  // Zigzag
  const segs = 5;
  const points: Array<{ x: number; y: number }> = [{ x: 0, y: 0 }];
  for (let i = 1; i <= segs; i++) {
    const t = i / segs;
    const off = Math.sin(seed * 0.7 + i * 2.3) * 3;
    points.push({ x: t * len, y: off });
  }
  ctx.strokeStyle = hexA(c2, op * 0.6);
  ctx.lineWidth = 4; ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(points[0].x, points[0].y);
  for (const p of points.slice(1)) ctx.lineTo(p.x, p.y);
  ctx.stroke();
  ctx.strokeStyle = hexA(c1, op);
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(points[0].x, points[0].y);
  for (const p of points.slice(1)) ctx.lineTo(p.x, p.y);
  ctx.stroke();
  ctx.restore();
}

function drawBubble(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, c1: string, c2: string, op: number) {
  ctx.fillStyle = hexA(c1, op * 0.4);
  ctx.beginPath(); ctx.arc(x, y, size, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = hexA(c2, op);
  ctx.lineWidth = 0.8;
  ctx.beginPath(); ctx.arc(x, y, size, 0, Math.PI * 2); ctx.stroke();
}
