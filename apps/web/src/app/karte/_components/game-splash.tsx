"use client";

/**
 * Game-Splash — Vollbild-Pre-Loader im RoK/CoD-Stil.
 *
 * Versteckt das initiale Asset-Loading (Cosmetic-Artwork-Manifest, eigene
 * Marker/Theme/Ring/Nameplate-Bilder, Aktive Marches) hinter einem Branding-
 * Splash mit Logo + Tagline + Progress-Bar. Sobald alles fertig ist + die
 * Mindest-Anzeigezeit erreicht ist, fadet der Splash aus und gibt die Map frei.
 *
 * Mindest-Anzeigezeit (1500ms) verhindert "Flicker" auf schnellen Verbindungen
 * — der Splash soll als Branding-Moment wahrgenommen werden, nicht als kurzes
 * Aufblitzen.
 */

import { useEffect, useRef, useState } from "react";
import { SplashRadarBg } from "./splash-radar-bg";

// Splash läuft in 2 Phasen:
// 1) "logo"   → Beide Logos solo (Branding-Moment, keine Wortmarke, kein Loader)
// 2) "loader" → Logos schrumpfen nach oben + Wortmarke + Tagline + Progress-Bar
// Dann Fade-out auf die Map.
const LOGO_PHASE_MS = 3000;     // Phase 1: Logos allein 3s
const CROSSFADE_MS = 0;         // Harter Cut Logo→Loader (kein Fade)
const LOADER_MIN_MS = 8000;     // Phase 2: Loader mind. 8s mit Ruckler-Effekt
const FADE_OUT_MS = 700;        // Out-Fade zur Map

const PRELOAD_TASKS: Array<{ key: string; label: string }> = [
  { key: "artwork",  label: "Lade Artwork" },
  { key: "profile",  label: "Lade Profil & Crew" },
  { key: "marches",  label: "Lade aktive Marches" },
  { key: "decode",   label: "Bereite Visuals vor" },
  { key: "mapbox",   label: "Initialisiere Karte" },
];

export function GameSplash({ onReady }: { onReady: () => void }) {
  const [completed, setCompleted] = useState<Set<string>>(new Set());
  const [statusText, setStatusText] = useState(PRELOAD_TASKS[0].label);
  const [phase, setPhase] = useState<"logo" | "loader">("logo");
  const [fadingOut, setFadingOut] = useState(false);
  const [timeProgress, setTimeProgress] = useState(0); // 0..100 zeitbasiert
  const mountTsRef = useRef<number>(Date.now());

  // Phase-Übergang: Logo → Loader nach LOGO_PHASE_MS
  useEffect(() => {
    const t1 = window.setTimeout(() => setPhase("loader"), LOGO_PHASE_MS);
    return () => window.clearTimeout(t1);
  }, []);

  // Splash-Ende: erst wenn ALLE Tasks fertig (echtes Pre-Decode!) UND
  // Mindestzeit erreicht. Sonst sieht man die Base nach Splash-Ende noch laden.
  useEffect(() => {
    const allDone = completed.size >= PRELOAD_TASKS.length;
    if (!allDone) return; // warten bis decode etc. wirklich durch sind
    const minEndTs = LOGO_PHASE_MS + LOADER_MIN_MS;
    const timeLeft = Math.max(0, minEndTs - (Date.now() - mountTsRef.current));
    const t2 = window.setTimeout(() => setFadingOut(true), timeLeft);
    const t3 = window.setTimeout(onReady, timeLeft + FADE_OUT_MS);
    return () => { window.clearTimeout(t2); window.clearTimeout(t3); };
  }, [completed, onReady]);

  // ── Realistic Progress mit Ruckler-Effekt ──
  // Statt linearer Bar: Plateau-Phasen (kurzer Stillstand) + Sprünge dazwischen.
  // Fühlt sich an wie echtes Network-Loading mit Latenz-Spitzen.
  // 5 Plateaus → 5 Tasks → 5 Status-Texte synchron.
  useEffect(() => {
    if (phase !== "loader") return;
    const start = performance.now();
    let rafId = 0;
    // Stutter-Schedule: jedes Plateau = [pause-ms, target-pct]
    // Das ergibt ein "ruckelndes" Loading-Feel statt smooth-linear.
    // 8 Plateaus über 8s mit längeren Pausen zwischen Sprüngen — realistisches Network-Feel
    const schedule: Array<{ atMs: number; toPct: number; label: string }> = [
      { atMs: 600,  toPct: 12,  label: "Lade Artwork" },
      { atMs: 1700, toPct: 25,  label: "Lade Artwork" },
      { atMs: 2600, toPct: 42,  label: "Lade Profil & Crew" },
      { atMs: 3700, toPct: 55,  label: "Lade Profil & Crew" },
      { atMs: 4900, toPct: 68,  label: "Lade aktive Marches" },
      { atMs: 6000, toPct: 82,  label: "Bereite Visuals vor" },
      { atMs: 7100, toPct: 94,  label: "Initialisiere Karte" },
      { atMs: 8000, toPct: 100, label: "Bereit" },
    ];
    const tick = (now: number) => {
      const elapsed = now - start;
      // Finde aktuelles Segment
      let prevAt = 0, prevPct = 0;
      let curAt = schedule[0].atMs, curPct = schedule[0].toPct, curLabel = schedule[0].label;
      for (let i = 0; i < schedule.length; i++) {
        if (elapsed < schedule[i].atMs) {
          curAt = schedule[i].atMs; curPct = schedule[i].toPct; curLabel = schedule[i].label;
          break;
        }
        prevAt = schedule[i].atMs; prevPct = schedule[i].toPct;
        if (i === schedule.length - 1) {
          curAt = schedule[i].atMs; curPct = schedule[i].toPct; curLabel = schedule[i].label;
        }
      }
      const segmentProgress = (elapsed - prevAt) / Math.max(1, curAt - prevAt);
      const eased = 1 - Math.pow(1 - Math.min(1, segmentProgress), 2); // ease-out-quad
      const pct = prevPct + (curPct - prevPct) * eased;
      setTimeProgress(Math.min(100, pct));
      // Status-Label nur setzen wenn wir das nächste Plateau erreichen (Vermeidung
      // von zu schnellem Hin-und-Her-Wechsel)
      setStatusText(curLabel);
      if (elapsed < LOADER_MIN_MS) rafId = requestAnimationFrame(tick);
    };
    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [phase]);

  // ── Parallel pre-loading ──
  useEffect(() => {
    let cancelled = false;
    const mark = (key: string, _label?: string) => {
      if (cancelled) return;
      setCompleted((prev) => {
        const next = new Set(prev);
        next.add(key);
        return next;
      });
      // Status-Text wird vom Loader-Schedule gesteuert, nicht von hier — sonst
      // springt der Text zu schnell auf "Bereit" weil dev-Loads schnell sind.
    };

    void (async () => {
      // ── Artwork-Manifest ──
      try {
        await fetch(`/api/cosmetic-artwork?v=2`, { cache: "no-cache" });
      } catch { /* tolerate */ }
      mark("artwork", "Lade Profil & Crew");

      // ── Profile + Active Marches ── (parallel)
      const [, marchesRes] = await Promise.allSettled([
        fetch("/api/base/me", { cache: "no-store" }),
        fetch("/api/base/marches", { cache: "no-store" }),
      ]);
      mark("profile");
      mark("marches", "Bereite Visuals vor");

      // ── Pre-decode der eigenen Base-Bilder ──
      // Holt das Artwork-Manifest erneut aus dem Cache + decodiert relevante PNGs/JPGs
      // damit der Map-Marker beim Erscheinen instant gerendert wird.
      try {
        const artR = await fetch(`/api/cosmetic-artwork?v=2`, { cache: "no-cache" });
        const profR = await fetch(`/api/base/me?v=2`, { cache: "no-cache" });
        if (artR.ok && profR.ok) {
          const art = await artR.json() as {
            base_theme?: Record<string, { image_url: string | null; video_url: string | null }>;
            base_ring?: Record<string, { image_url: string | null; video_url: string | null }>;
            nameplate?: Record<string, { image_url: string | null; video_url: string | null }>;
            marker?: Record<string, Record<string, { image_url: string | null; video_url: string | null }>>;
          };
          const prof = await profR.json() as {
            base?: { theme_id?: string | null; kind?: "runner" | "crew" | null };
            user?: { equipped_base_ring_id?: string | null; equipped_nameplate_id?: string | null; equipped_marker_id?: string | null; equipped_marker_variant?: string | null };
          };
          const themeId = prof.base?.theme_id;
          // Scope = runner (default) oder crew. Ohne explizites Feld nehmen wir runner als Standard.
          const scope = prof.base?.kind === "crew" ? "crew" : "runner";
          const ringId  = prof.user?.equipped_base_ring_id;
          const npId    = prof.user?.equipped_nameplate_id;
          const markerId = prof.user?.equipped_marker_id;
          const markerVar = prof.user?.equipped_marker_variant ?? "neutral";

          // Sammle BEIDE — Image-URLs UND Video-URLs der eigenen Assets.
          const imageUrls: string[] = [];
          const videoUrls: string[] = [];
          const collect = (a: { image_url: string | null; video_url: string | null } | undefined | null) => {
            if (!a) return;
            if (a.image_url && !imageUrls.includes(a.image_url)) imageUrls.push(a.image_url);
            if (a.video_url && !videoUrls.includes(a.video_url)) videoUrls.push(a.video_url);
          };
          if (themeId) {
            for (const sc of ["runner", "crew", scope] as const) {
              collect(art.base_theme?.[`${themeId}_${sc}_pin`]);
              collect(art.base_theme?.[`${themeId}_${sc}_banner`]);
            }
          }
          if (ringId)  collect(art.base_ring?.[ringId]);
          if (npId)    collect(art.nameplate?.[npId]);
          if (markerId) collect(art.marker?.[markerId]?.[markerVar] ?? art.marker?.[markerId]?.neutral);

          // Pre-decode Bilder (Image+decode) UND Videos (loadeddata-Event).
          await Promise.allSettled([
            ...imageUrls.map((url) => {
              const img = new Image();
              img.src = url;
              return img.decode().catch(() => undefined);
            }),
            ...videoUrls.map((url) => new Promise<void>((resolve) => {
              const v = document.createElement("video");
              v.src = url;
              v.muted = true; v.playsInline = true; v.preload = "auto";
              const done = () => resolve();
              v.addEventListener("loadeddata", done, { once: true });
              v.addEventListener("error", done, { once: true });
              // Safety-Timeout: nach 10s nicht mehr blockieren
              window.setTimeout(done, 10000);
              v.load();
            })),
          ]);
          // eslint-disable-next-line no-console
          console.log("[splash] pre-decoded", imageUrls.length, "images +", videoUrls.length, "videos");
        }
      } catch { /* tolerate */ }
      mark("decode", "Initialisiere Karte");

      // ── Mapbox-SDK-Lazy-Load anstossen ──
      // Importiert mapbox-gl früh damit der Map-Init beim ersten Render keinen
      // Code-Split-Wait mehr macht.
      try { await import("mapbox-gl"); } catch { /* tolerate */ }
      mark("mapbox");
      // Status-Text wird vom Loader-Schedule (rAF-Effect) gesteuert, nicht hier.
    })();

    return () => { cancelled = true; };
  }, []);

  // (Trigger-Logik ist jetzt im deterministischen Timer-Block oben.
  //  Die parallel laufenden Pre-Load-Tasks beeinflussen die Splash-Dauer nicht
  //  mehr — sie laufen einfach im Hintergrund, was bei Splash-Ende fertig ist
  //  ist fertig. Das Pre-Decode der eigenen Base-Bilder läuft parallel.)

  // Progress wird komplett von der zeitbasierten Schedule gesteuert (keine Mischung
  // mit tatsächlichem Task-Status mehr, sonst springt's auf 100% bevor visuell sinnvoll).
  const progress = timeProgress;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 100000,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        // Brand-Verlauf: Pink → Lila → Teal aus dem Logo
        background: "radial-gradient(ellipse at 50% 35%, #2A1838 0%, #0F1115 70%, #000 100%)",
        opacity: fadingOut ? 0 : 1,
        pointerEvents: fadingOut ? "none" : "auto",
        transition: `opacity ${FADE_OUT_MS}ms ease-out`,
        overflow: "hidden",
      }}
    >
      <style>{`
        @keyframes ma365SplashLogoPulse { 0%,100% { transform: scale(1); filter: drop-shadow(0 0 24px rgba(255,45,120,0.45)) drop-shadow(0 0 48px rgba(34,209,195,0.35)); } 50% { transform: scale(1.04); filter: drop-shadow(0 0 32px rgba(255,45,120,0.7)) drop-shadow(0 0 64px rgba(34,209,195,0.5)); } }
        @keyframes ma365SplashShimmer { 0% { transform: translateX(-100%); } 100% { transform: translateX(100%); } }
        @keyframes ma365SplashFadeIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes ma365SplashRing { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
      `}</style>

      {/* Radar-Map als Hintergrund — fadet in der Loader-Phase rein, gleicher
          Look wie die Landing-Page (HeroMap). Logo-Phase bleibt clean dunkel. */}
      <div style={{
        position: "absolute", inset: 0,
        opacity: phase === "loader" ? 0.9 : 0,
        transition: `opacity ${CROSSFADE_MS}ms ease-in-out`,
        pointerEvents: "none",
        zIndex: 0,
      }}>
        <SplashRadarBg />
      </div>

      {/* Atmosphärische Sparkles im Hintergrund */}
      <div style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
        {Array.from({ length: 24 }).map((_, i) => (
          <span
            key={i}
            style={{
              position: "absolute",
              width: 3, height: 3, borderRadius: "50%",
              background: i % 3 === 0 ? "#FF2D78" : i % 3 === 1 ? "#22D1C3" : "#FFD27A",
              boxShadow: `0 0 8px currentColor`,
              top: `${(i * 37) % 95}%`,
              left: `${(i * 53) % 95}%`,
              opacity: 0.6,
              animation: `ma365SplashLogoPulse ${2 + (i % 4)}s ease-in-out infinite`,
              animationDelay: `${(i % 5) * 0.3}s`,
            }}
          />
        ))}
      </div>


      {/* PHASE 1: Beide Logos zentriert nebeneinander, KEINE Wortmarke.
          Phase 2: Logos faden komplett aus, Wortmarke + Loader übernehmen die Bühne. */}
      <div style={{
        position: "fixed",
        top: 0, left: 0, right: 0, bottom: 0,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        opacity: phase === "logo" ? 1 : 0,
        transition: `opacity ${CROSSFADE_MS}ms ease-in-out`,
        pointerEvents: "none",
        zIndex: 2,
      }}>
        <div style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 24,
          height: 110,
          // Kein Pulse-Animation mehr — Logos sollen statisch stehen, nur Glow
        }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/icon-192.png"
            alt="MyArea365"
            decoding="sync"
            loading="eager"
            fetchPriority="high"
            style={{
              height: "100%",
              width: "auto",
              objectFit: "contain",
              filter: "drop-shadow(0 0 40px rgba(255,45,120,0.55)) drop-shadow(0 0 80px rgba(34,209,195,0.45))",
            }}
          />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/base365-logo.webp"
            alt="Base365"
            decoding="sync"
            loading="eager"
            fetchPriority="high"
            style={{
              height: "100%",
              width: "auto",
              objectFit: "contain",
              filter: "drop-shadow(0 0 30px rgba(255,255,255,0.35))",
            }}
          />
        </div>
      </div>

      {/* Wortmarke "MyArea365" — NUR in Phase 2 sichtbar */}
      <div style={{
        position: "fixed",
        top: 0, left: 0, right: 0, bottom: 0,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        opacity: phase === "loader" ? 1 : 0,
        transition: `opacity ${CROSSFADE_MS}ms ease-in-out`,
        pointerEvents: "none",
        zIndex: 2,
        marginTop: -60,
      }}>
        <div style={{
          fontSize: 38,
          fontWeight: 900,
          letterSpacing: 3,
          background: "linear-gradient(90deg, #FF2D78 0%, #A855F7 50%, #22D1C3 100%)",
          WebkitBackgroundClip: "text",
          WebkitTextFillColor: "transparent",
          backgroundClip: "text",
          textShadow: "0 0 40px rgba(168,85,247,0.4)",
          whiteSpace: "nowrap",
        }}>
          MyArea365
        </div>
      </div>

      {/* PHASE 2: Loader-UI (Tagline, Progress-Bar, Status). Fadet rein nach Phase 1. */}
      <div style={{
        position: "absolute",
        top: "calc(50% + 30px)",
        left: "50%",
        transform: "translate(-50%, 0)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        opacity: phase === "loader" ? 1 : 0,
        transition: `opacity ${CROSSFADE_MS}ms ease-in-out`,
        pointerEvents: phase === "loader" ? "auto" : "none",
      }}>
        {/* Tagline */}
        <div style={{
          fontSize: 13,
          color: "#C8CDD9",
          letterSpacing: 4,
          textTransform: "uppercase",
          fontWeight: 600,
          textShadow: "0 1px 4px rgba(0,0,0,0.85)",
          marginBottom: 28,
        }}>
          Erobere deine Stadt
        </div>

        {/* Progress-Bar mit Prozent-Zahl daneben */}
        <div style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          marginBottom: 14,
        }}>
          <div style={{
            position: "relative",
            width: "min(260px, 60vw)",
            height: 6,
            borderRadius: 999,
            background: "rgba(255,255,255,0.08)",
            border: "1px solid rgba(255,255,255,0.1)",
            overflow: "hidden",
          }}>
            <div style={{
              position: "absolute", top: 0, left: 0, bottom: 0,
              width: `${progress}%`,
              background: "linear-gradient(90deg, #FF2D78, #A855F7, #22D1C3)",
              borderRadius: 999,
              boxShadow: "0 0 14px rgba(34,209,195,0.6)",
              // KEIN width-transition — wir updaten via rAF auf 60fps, native smooth
            }}>
              <div style={{
                position: "absolute", inset: 0,
                background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.4), transparent)",
                animation: "ma365SplashShimmer 1.6s ease-in-out infinite",
              }} />
            </div>
          </div>
          <div style={{
            minWidth: 36,
            fontSize: 11,
            fontWeight: 800,
            color: "#FFE4B8",
            letterSpacing: 0.5,
            textShadow: "0 1px 2px rgba(0,0,0,0.85)",
            fontVariantNumeric: "tabular-nums",
          }}>
            {Math.round(progress)}%
          </div>
        </div>
      </div>

      {/* Status-Text — auch nur in Loader-Phase */}
      <div style={{
        position: "absolute",
        bottom: 30,
        left: "50%",
        transform: "translateX(-50%)",
        opacity: phase === "loader" ? 1 : 0,
        transition: `opacity ${CROSSFADE_MS}ms ease-in-out`,
        fontSize: 11,
        color: "#8B8FA3",
        letterSpacing: 1.5,
        textTransform: "uppercase",
        fontWeight: 600,
        minHeight: 16,
        textShadow: "0 1px 2px rgba(0,0,0,0.8)",
      }}>
        {statusText}
      </div>
    </div>
  );
}
