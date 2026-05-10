"use client";

/**
 * Reward-FX — psychologisches Belohnungs-Feedback fürs ganze Spiel.
 *
 * Drei Effekt-Klassen:
 *  - burst     : "+150 🪙" Pop-Up das nach oben driftet und ausfadet (ohne Ziel)
 *  - collect   : Coins fliegen vom Source-Punkt zur Resource-Bar, Pill pulsed,
 *                Number tickt hoch. Die "Pavlov-Trifecta" für Einsammeln.
 *  - celebrate : Großer Sparkle-Burst + Ring-Expand für Level-Up / Build-Complete
 *
 * Architektur:
 *  - <RewardFxProvider> lebt am Root (z.B. map-dashboard) und rendert eine
 *    fixed-position FxLayer via Portal. z-Index 9500 (über allen Modals).
 *  - useRewardFx() liefert die Trigger-Funktionen.
 *  - Resource-Bar Pills haben `data-rss-pill="<kind>"` als Fly-Targets.
 *  - Pill-Pulse via `ma365:pill-pulse` CustomEvent.
 *
 * Design-Prinzip: Coins erst fliegen → DANN `ma365:resources-changed` —
 * der Spieler sieht visuell die RSS ankommen, bevor die Zahl sich ändert.
 */

import {
  createContext, useCallback, useContext, useEffect,
  useId, useMemo, useRef, useState, type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { ResourceIcon, useResourceArt, type ResourceArtMap } from "@/components/resource-icon";

type ResourceKind = "wood" | "stone" | "gold" | "mana";
const RESOURCE_KINDS = ["wood", "stone", "gold", "mana"] as const;

const COIN_FB: Record<ResourceKind, { icon: string; color: string }> = {
  wood:  { icon: "⚙️", color: "#FF6B4A" },
  stone: { icon: "🔩", color: "#9ba8c7" },
  gold:  { icon: "💸", color: "#FFD700" },
  mana:  { icon: "📡", color: "#22D1C3" },
};

const SPECIAL_FB: Record<string, { icon: string; color: string }> = {
  gems:        { icon: "💎", color: "#FF2D78" },
  ansehen:     { icon: "👑", color: "#FFD700" },
  guardian_xp: { icon: "✨", color: "#22D1C3" },
};

export type FxRewards = Partial<Record<ResourceKind | "gems" | "ansehen" | "guardian_xp", number>>;

type Point = { x: number; y: number };

type BurstFx = {
  id: string;
  kind: "burst";
  from: Point;
  rewards: FxRewards;
  createdAt: number;
};
type CollectFx = {
  id: string;
  kind: "collect";
  from: Point;
  rewards: FxRewards;
  createdAt: number;
};
type CelebrateFx = {
  id: string;
  kind: "celebrate";
  at: Point;
  title?: string;
  subtitle?: string;
  color: string;
  createdAt: number;
};

type AnyFx = BurstFx | CollectFx | CelebrateFx;

type RewardFxApi = {
  /** Floating numbers that drift up from a source point. Lightweight feedback. */
  burst: (opts: { from: Point; rewards: FxRewards }) => void;
  /** Coins fly from source to resource-bar, pill pulses, value ticks up. */
  collect: (opts: { from: Point; rewards: FxRewards }) => void;
  /** Sparkle burst + ring expand. Use for level-up, build-complete, big wins. */
  celebrate: (opts: { at: Point; title?: string; subtitle?: string; color?: string }) => void;
};

const Ctx = createContext<RewardFxApi | null>(null);

export function useRewardFx(): RewardFxApi {
  const ctx = useContext(Ctx);
  if (!ctx) {
    // No-op fallback wenn Provider fehlt (z.B. SSR oder Tests) — kein Crash.
    return {
      burst: () => {},
      collect: () => {},
      celebrate: () => {},
    };
  }
  return ctx;
}

/** Liest position des Resource-Bar Pills für gegebenen Kind. */
function getPillPosition(kind: ResourceKind | "gems"): Point | null {
  if (typeof document === "undefined") return null;
  const el = document.querySelector<HTMLElement>(`[data-rss-pill="${kind}"]`);
  if (!el) return null;
  const r = el.getBoundingClientRect();
  return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
}

export function RewardFxProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<AnyFx[]>([]);
  const counter = useRef(0);
  const art = useResourceArt();

  const remove = useCallback((id: string) => {
    setItems((prev) => prev.filter((x) => x.id !== id));
  }, []);

  const api = useMemo<RewardFxApi>(() => ({
    burst: ({ from, rewards }) => {
      const id = `fx-${++counter.current}`;
      setItems((prev) => [...prev, { id, kind: "burst", from, rewards, createdAt: Date.now() }]);
      window.setTimeout(() => remove(id), 1800);
    },
    collect: ({ from, rewards }) => {
      const id = `fx-${++counter.current}`;
      setItems((prev) => [...prev, { id, kind: "collect", from, rewards, createdAt: Date.now() }]);
      // Cleanup nach längster Coin-Flugzeit + Tick-Up
      window.setTimeout(() => remove(id), 2400);
    },
    celebrate: ({ at, title, subtitle, color }) => {
      const id = `fx-${++counter.current}`;
      setItems((prev) => [...prev, {
        id, kind: "celebrate", at, title, subtitle,
        color: color ?? "#FFD700", createdAt: Date.now(),
      }]);
      window.setTimeout(() => remove(id), 2200);
    },
  }), [remove]);

  return (
    <Ctx.Provider value={api}>
      {children}
      <FxLayer items={items} art={art} />
    </Ctx.Provider>
  );
}

function FxLayer({ items, art }: { items: AnyFx[]; art: ResourceArtMap }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);
  if (!mounted) return null;

  const layer = (
    <div
      aria-hidden
      style={{
        position: "fixed", inset: 0, zIndex: 9500,
        pointerEvents: "none", overflow: "hidden",
      }}
    >
      <FxGlobalStyles />
      {items.map((it) => {
        if (it.kind === "burst") return <BurstView key={it.id} fx={it} art={art} />;
        if (it.kind === "collect") return <CollectView key={it.id} fx={it} art={art} />;
        return <CelebrateView key={it.id} fx={it} />;
      })}
    </div>
  );

  return createPortal(layer, document.body);
}

/** Globale Keyframes für alle FX. Einmalig gemounted. */
function FxGlobalStyles() {
  return (
    <style>{`
      @keyframes ma365-fx-float {
        0%   { transform: translate(-50%, -50%) translateY(0)   scale(0.6); opacity: 0; }
        15%  { transform: translate(-50%, -50%) translateY(-10px) scale(1.15); opacity: 1; }
        70%  { transform: translate(-50%, -50%) translateY(-70px) scale(1);    opacity: 1; }
        100% { transform: translate(-50%, -50%) translateY(-110px) scale(0.85); opacity: 0; }
      }
      @keyframes ma365-fx-ring {
        0%   { transform: translate(-50%, -50%) scale(0.2);  opacity: 0.9; border-width: 4px; }
        100% { transform: translate(-50%, -50%) scale(2.6);  opacity: 0;   border-width: 1px; }
      }
      @keyframes ma365-fx-ring-2 {
        0%   { transform: translate(-50%, -50%) scale(0.4);  opacity: 0.7; }
        100% { transform: translate(-50%, -50%) scale(3.4);  opacity: 0;   }
      }
      @keyframes ma365-fx-spark {
        0%   { transform: translate(-50%, -50%) translate(0, 0)   scale(0); opacity: 0; }
        20%  { transform: translate(-50%, -50%) translate(var(--dx), var(--dy)) scale(1.2); opacity: 1; }
        100% { transform: translate(-50%, -50%) translate(calc(var(--dx) * 1.6), calc(var(--dy) * 1.6 + 30px)) scale(0.2); opacity: 0; }
      }
      @keyframes ma365-fx-celebrate-title {
        0%   { transform: translate(-50%, -50%) scale(0.3) translateY(0);    opacity: 0; }
        20%  { transform: translate(-50%, -50%) scale(1.25) translateY(-10px); opacity: 1; }
        50%  { transform: translate(-50%, -50%) scale(1) translateY(-30px);    opacity: 1; }
        100% { transform: translate(-50%, -50%) scale(0.95) translateY(-90px); opacity: 0; }
      }
      @keyframes ma365-fx-celebrate-subtitle {
        0%   { transform: translate(-50%, -50%) scale(0.5) translateY(0);    opacity: 0; }
        30%  { transform: translate(-50%, -50%) scale(1) translateY(20px);   opacity: 1; }
        70%  { transform: translate(-50%, -50%) scale(1) translateY(28px);   opacity: 1; }
        100% { transform: translate(-50%, -50%) scale(0.95) translateY(60px); opacity: 0; }
      }
      @keyframes ma365-fx-pill-pulse {
        0%   { transform: scale(1);    filter: brightness(1)   drop-shadow(0 0 0 transparent); }
        30%  { transform: scale(1.18); filter: brightness(1.5) drop-shadow(0 0 12px var(--pulse-color, #FFD700)); }
        100% { transform: scale(1);    filter: brightness(1)   drop-shadow(0 0 0 transparent); }
      }
    `}</style>
  );
}

/** Liefert (icon, color, label) für einen Reward-Key. */
function rewardMeta(
  key: keyof FxRewards,
  art: ResourceArtMap,
): { kind: ResourceKind | null; fallback: string; color: string } {
  if (key === "wood" || key === "stone" || key === "gold" || key === "mana") {
    const fb = COIN_FB[key];
    return { kind: key, fallback: fb.icon, color: fb.color };
  }
  const fb = SPECIAL_FB[key] ?? { icon: "✨", color: "#FFD700" };
  return { kind: null, fallback: fb.icon, color: fb.color };
  void art;
}

function BurstView({ fx, art }: { fx: BurstFx; art: ResourceArtMap }) {
  const entries = (Object.entries(fx.rewards) as [keyof FxRewards, number][])
    .filter(([, v]) => typeof v === "number" && v > 0);
  return (
    <>
      {entries.map(([key, amount], i) => {
        const meta = rewardMeta(key, art);
        const offsetX = (i - (entries.length - 1) / 2) * 36;
        return (
          <div
            key={key}
            style={{
              position: "absolute",
              left: fx.from.x + offsetX, top: fx.from.y,
              transform: "translate(-50%, -50%)",
              animation: `ma365-fx-float 1700ms cubic-bezier(.22,.9,.32,1) forwards`,
              animationDelay: `${i * 90}ms`,
              willChange: "transform, opacity",
              display: "flex", alignItems: "center", gap: 4,
              padding: "4px 10px",
              background: "rgba(0,0,0,0.55)",
              border: `1px solid ${meta.color}88`,
              borderRadius: 999,
              boxShadow: `0 4px 12px rgba(0,0,0,0.45), 0 0 18px ${meta.color}55`,
              backdropFilter: "blur(4px)",
              WebkitBackdropFilter: "blur(4px)",
              fontSize: 14, fontWeight: 900, color: "#FFF",
              textShadow: "0 1px 2px rgba(0,0,0,0.85)",
              fontVariantNumeric: "tabular-nums",
              whiteSpace: "nowrap",
            }}
          >
            {meta.kind ? (
              <ResourceIcon kind={meta.kind} size={20} fallback={meta.fallback} art={art} />
            ) : (
              <span style={{ fontSize: 18, lineHeight: 1 }}>{meta.fallback}</span>
            )}
            <span style={{ color: meta.color }}>+{formatAmount(amount)}</span>
          </div>
        );
      })}
    </>
  );
}

function CollectView({ fx, art }: { fx: CollectFx; art: ResourceArtMap }) {
  const entries = (Object.entries(fx.rewards) as [keyof FxRewards, number][])
    .filter(([, v]) => typeof v === "number" && v > 0);
  return (
    <>
      {entries.map(([key, amount]) => {
        const meta = rewardMeta(key, art);
        const targetKey: ResourceKind | "gems" | null =
          meta.kind ?? (key === "gems" ? "gems" : null);
        return (
          <CollectStream
            key={key}
            from={fx.from}
            targetKey={targetKey}
            amount={amount}
            meta={meta}
            art={art}
            label={key as string}
          />
        );
      })}
    </>
  );
}

function CollectStream({
  from, targetKey, amount, meta, art, label,
}: {
  from: Point;
  targetKey: ResourceKind | "gems" | null;
  amount: number;
  meta: { kind: ResourceKind | null; fallback: string; color: string };
  art: ResourceArtMap;
  label: string;
}) {
  const target = useMemo<Point>(() => {
    if (targetKey) {
      const t = getPillPosition(targetKey);
      if (t) return t;
    }
    // Fallback: oben rechts wenn kein Pill gefunden
    if (typeof window !== "undefined") {
      return { x: window.innerWidth - 40, y: window.innerHeight / 2 };
    }
    return { x: 0, y: 0 };
  }, [targetKey]);

  const COIN_COUNT = Math.min(8, Math.max(4, Math.floor(Math.log2(Math.max(2, amount)))));
  const coins = useMemo(() => Array.from({ length: COIN_COUNT }, (_, i) => i), [COIN_COUNT]);

  // Pill-Pulse + resources-changed broadcast nach letztem Coin
  useEffect(() => {
    const lastArrival = 250 + (COIN_COUNT - 1) * 80 + 700; // delay + flight
    const t = window.setTimeout(() => {
      if (targetKey) {
        window.dispatchEvent(new CustomEvent("ma365:pill-pulse", {
          detail: { kind: targetKey, color: meta.color },
        }));
      }
    }, lastArrival - 100);
    return () => window.clearTimeout(t);
  }, [targetKey, meta.color, COIN_COUNT]);

  return (
    <>
      {/* Source-Burst-Label: zeigt was eingesammelt wird */}
      <div
        style={{
          position: "absolute",
          left: from.x, top: from.y,
          transform: "translate(-50%, -50%)",
          animation: `ma365-fx-float 1100ms cubic-bezier(.22,.9,.32,1) forwards`,
          willChange: "transform, opacity",
          display: "flex", alignItems: "center", gap: 4,
          padding: "3px 9px",
          background: "rgba(0,0,0,0.6)",
          border: `1px solid ${meta.color}aa`,
          borderRadius: 999,
          boxShadow: `0 4px 14px rgba(0,0,0,0.5), 0 0 20px ${meta.color}66`,
          fontSize: 13, fontWeight: 900, color: meta.color,
          textShadow: "0 1px 2px rgba(0,0,0,0.85)",
          fontVariantNumeric: "tabular-nums",
          whiteSpace: "nowrap",
        }}
      >
        +{formatAmount(amount)}
      </div>

      {/* Coins fliegen ankom Pill */}
      {coins.map((i) => (
        <FlyingCoin
          key={`${label}-${i}`}
          from={from}
          to={target}
          delay={250 + i * 80}
          duration={650 + (i % 3) * 60}
          meta={meta}
          art={art}
        />
      ))}
    </>
  );
}

function FlyingCoin({
  from, to, delay, duration, meta, art,
}: {
  from: Point;
  to: Point;
  delay: number;
  duration: number;
  meta: { kind: ResourceKind | null; fallback: string; color: string };
  art: ResourceArtMap;
}) {
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    // Slight angle variance + arc via mid-keyframe
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const lateral = (Math.random() - 0.5) * 80;
    const arcUp = -60 - Math.abs(dx) * 0.05;
    const initRot = (Math.random() - 0.5) * 80;
    const finRot = (Math.random() - 0.5) * 360;

    const anim = el.animate(
      [
        { transform: `translate(0px, 0px) rotate(${initRot}deg) scale(0.4)`, opacity: 0 },
        { transform: `translate(${lateral}px, ${arcUp}px) rotate(${finRot * 0.3}deg) scale(1.1)`, opacity: 1, offset: 0.2 },
        { transform: `translate(${dx * 0.5 + lateral * 0.5}px, ${dy * 0.5 + arcUp}px) rotate(${finRot * 0.6}deg) scale(1)`, opacity: 1, offset: 0.55 },
        { transform: `translate(${dx}px, ${dy}px) rotate(${finRot}deg) scale(0.55)`, opacity: 0.9 },
      ],
      {
        duration,
        delay,
        easing: "cubic-bezier(.5,.05,.5,.95)",
        fill: "forwards",
      },
    );
    return () => { try { anim.cancel(); } catch { /* ignore */ } };
  }, [from.x, from.y, to.x, to.y, delay, duration]);

  return (
    <div
      ref={ref}
      style={{
        position: "absolute",
        left: from.x, top: from.y,
        transform: "translate(0px, 0px) scale(0.4)",
        opacity: 0,
        willChange: "transform, opacity",
        width: 32, height: 32,
        marginLeft: -16, marginTop: -16,
        display: "flex", alignItems: "center", justifyContent: "center",
        filter: `drop-shadow(0 0 8px ${meta.color}bb) drop-shadow(0 2px 5px rgba(0,0,0,0.5))`,
      }}
    >
      {meta.kind ? (
        <ResourceIcon kind={meta.kind} size={32} fallback={meta.fallback} art={art} />
      ) : (
        <span style={{ fontSize: 32, lineHeight: 1 }}>{meta.fallback}</span>
      )}
    </div>
  );
}

function CelebrateView({ fx }: { fx: CelebrateFx }) {
  const SPARKS = 14;
  return (
    <>
      {/* Inner Ring */}
      <div
        style={{
          position: "absolute",
          left: fx.at.x, top: fx.at.y,
          transform: "translate(-50%, -50%) scale(0.2)",
          width: 80, height: 80, borderRadius: "50%",
          border: `4px solid ${fx.color}`,
          boxShadow: `0 0 30px ${fx.color}88, inset 0 0 20px ${fx.color}55`,
          animation: `ma365-fx-ring 1100ms cubic-bezier(.22,.9,.32,1) forwards`,
          willChange: "transform, opacity",
        }}
      />
      {/* Outer Ring (delayed) */}
      <div
        style={{
          position: "absolute",
          left: fx.at.x, top: fx.at.y,
          transform: "translate(-50%, -50%) scale(0.4)",
          width: 80, height: 80, borderRadius: "50%",
          border: `2px solid ${fx.color}`,
          boxShadow: `0 0 40px ${fx.color}55`,
          animation: `ma365-fx-ring-2 1400ms cubic-bezier(.22,.9,.32,1) 150ms forwards`,
          opacity: 0,
          willChange: "transform, opacity",
        }}
      />
      {/* Sparkles radial */}
      {Array.from({ length: SPARKS }).map((_, i) => {
        const angle = (i / SPARKS) * Math.PI * 2;
        const dist = 70 + Math.random() * 60;
        const dx = Math.cos(angle) * dist;
        const dy = Math.sin(angle) * dist;
        const isGold = i % 3 === 0;
        const color = isGold ? "#FFE08A" : fx.color;
        return (
          <span
            key={i}
            style={{
              position: "absolute",
              left: fx.at.x, top: fx.at.y,
              transform: "translate(-50%, -50%)",
              ["--dx" as never]: `${dx}px`,
              ["--dy" as never]: `${dy}px`,
              width: 6, height: 6, borderRadius: "50%",
              background: color,
              boxShadow: `0 0 8px ${color}, 0 0 14px ${color}aa`,
              animation: `ma365-fx-spark 1300ms cubic-bezier(.18,.85,.45,1) forwards`,
              animationDelay: `${i * 18}ms`,
              willChange: "transform, opacity",
            }}
          />
        );
      })}
      {/* Title */}
      {fx.title && (
        <div
          style={{
            position: "absolute",
            left: fx.at.x, top: fx.at.y,
            transform: "translate(-50%, -50%)",
            animation: `ma365-fx-celebrate-title 1800ms cubic-bezier(.22,.9,.32,1) forwards`,
            willChange: "transform, opacity",
            fontSize: 22, fontWeight: 900,
            color: fx.color,
            letterSpacing: 2,
            textTransform: "uppercase",
            textShadow: `0 0 12px ${fx.color}aa, 0 2px 6px rgba(0,0,0,0.8), 0 0 24px ${fx.color}66`,
            whiteSpace: "nowrap",
            fontVariantNumeric: "tabular-nums",
          }}
        >
          {fx.title}
        </div>
      )}
      {/* Subtitle */}
      {fx.subtitle && (
        <div
          style={{
            position: "absolute",
            left: fx.at.x, top: fx.at.y,
            transform: "translate(-50%, -50%)",
            animation: `ma365-fx-celebrate-subtitle 1900ms cubic-bezier(.22,.9,.32,1) 100ms forwards`,
            willChange: "transform, opacity",
            fontSize: 13, fontWeight: 800,
            color: "#FFF",
            letterSpacing: 1.2,
            textShadow: "0 1px 3px rgba(0,0,0,0.85)",
            whiteSpace: "nowrap",
            fontVariantNumeric: "tabular-nums",
          }}
        >
          {fx.subtitle}
        </div>
      )}
    </>
  );
}

function formatAmount(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1).replace(/\.0$/, "") + "M";
  if (n >= 10_000) return Math.round(n / 1000) + "K";
  if (n >= 1000) return (n / 1000).toFixed(1).replace(/\.0$/, "") + "K";
  return n.toLocaleString("de-DE");
}

/** Helper für Components die einen DOM-Node-Ref haben und FX-Source brauchen. */
export function getElementCenter(el: HTMLElement | null): Point {
  if (!el) return { x: 0, y: 0 };
  const r = el.getBoundingClientRect();
  return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
}

/** Helper für click-events: liefert Click-Punkt. */
export function getClickPoint(e: { clientX: number; clientY: number }): Point {
  return { x: e.clientX, y: e.clientY };
}

void RESOURCE_KINDS; // keep import side-effect typed
