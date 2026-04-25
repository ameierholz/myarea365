"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { RunnerFightsClient } from "@/app/runner-fights/runner-fights-client";

type ActivityId = "walk" | "shop" | "runner_fight" | "arena" | "area_boss";

type Activity = {
  id: ActivityId;
  icon: string;
  title: string;
  hook: string;
  gradient: [string, string];
  accent: string;
};

type ModalContent = {
  icon: string;
  title: string;
  subtitle: string;
  accent: string;
  how: Array<{ step: number; text: string }>;
  tips?: string[];
  reward?: string;
  cta?: { label: string; href: string };
};

export function RunnerActivityCards() {
  const tA = useTranslations("ActivityCards");
  const ACTIVITIES: Activity[] = useMemo(() => [
    { id: "walk",         icon: "🥾", title: tA("walkTitle"),  hook: tA("walkHook"),  gradient: ["#22D1C3", "#5ddaf0"], accent: "#22D1C3" },
    { id: "shop",         icon: "🏪", title: tA("shopTitle"),  hook: tA("shopHook"),  gradient: ["#FFD700", "#FF6B4A"], accent: "#FFD700" },
    { id: "runner_fight", icon: "⚔️", title: tA("fightTitle"), hook: tA("fightHook"), gradient: ["#FF2D78", "#a855f7"], accent: "#FF2D78" },
    { id: "arena",        icon: "🏛️", title: tA("ligaTitle"),  hook: tA("ligaHook"),  gradient: ["#a855f7", "#5ddaf0"], accent: "#a855f7" },
    { id: "area_boss",    icon: "👹", title: tA("bossTitle"),  hook: tA("bossHook"),  gradient: ["#FF6B4A", "#FF2D78"], accent: "#FF6B4A" },
  ], [tA]);
  const [open, setOpen] = useState<ActivityId | null>(null);
  const [showArena, setShowArena] = useState(false);
  return (
    <div style={{ padding: "0 20px", marginBottom: 24 }}>
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        marginBottom: 12,
      }}>
        <div style={{ fontSize: 11, fontWeight: 900, letterSpacing: 2, color: "#8B8FA3" }}>
          {tA("header")}
        </div>
        <div style={{ fontSize: 10, color: "#a8b4cf" }}>{tA("tapForDetails")}</div>
      </div>

      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))",
        gap: 10,
      }}>
        {ACTIVITIES.map((a) => (
          <button
            key={a.id}
            onClick={() => setOpen(a.id)}
            style={{
              position: "relative",
              padding: "14px 12px",
              borderRadius: 16,
              background: `linear-gradient(135deg, ${a.gradient[0]}22, ${a.gradient[1]}11)`,
              border: `1px solid ${a.accent}55`,
              color: "#FFF",
              cursor: "pointer",
              textAlign: "left",
              transition: "transform 0.15s ease",
              boxShadow: `0 4px 20px ${a.accent}10`,
            }}
            onMouseOver={(e) => { e.currentTarget.style.transform = "translateY(-2px)"; }}
            onMouseOut={(e) => { e.currentTarget.style.transform = "translateY(0)"; }}
          >
            <div style={{ fontSize: 32, marginBottom: 4 }}>{a.icon}</div>
            <div style={{ fontSize: 13, fontWeight: 900, color: "#FFF" }}>{a.title}</div>
            <div style={{ fontSize: 10, color: "#a8b4cf", marginTop: 2, lineHeight: 1.3 }}>{a.hook}</div>
          </button>
        ))}
      </div>

      {open && <ActivityModal id={open} onClose={() => setOpen(null)} onOpenArena={() => { setOpen(null); setShowArena(true); }} />}
      {showArena && (
        <div onClick={() => setShowArena(false)} style={{
          position: "fixed", inset: 0, zIndex: 2600,
          background: `
            radial-gradient(ellipse at 50% 100%, rgba(255,107,74,0.18) 0%, transparent 60%),
            radial-gradient(ellipse at 0% 0%, rgba(168,85,247,0.12) 0%, transparent 50%),
            rgba(5,5,10,0.96)
          `,
          backdropFilter: "blur(16px)",
          padding: 16, overflowY: "auto",
        }}>
          <div onClick={(e) => e.stopPropagation()} style={{
            maxWidth: 1200, margin: "0 auto", padding: 18,
            background: `
              radial-gradient(ellipse at top, rgba(255,215,0,0.06) 0%, transparent 40%),
              linear-gradient(180deg, #12090e 0%, #0a0a0f 100%)
            `,
            borderRadius: 20,
            border: "1px solid rgba(255, 45, 120, 0.4)",
            boxShadow: "0 20px 80px rgba(0,0,0,0.8), inset 0 1px 0 rgba(255,255,255,0.04)",
          }}>
            <RunnerFightsClient inModal onClose={() => setShowArena(false)} />
          </div>
        </div>
      )}
    </div>
  );
}

function ActivityModal({ id, onClose, onOpenArena }: { id: ActivityId; onClose: () => void; onOpenArena?: () => void }) {
  const tA = useTranslations("ActivityCards");
  const CONTENT: Record<ActivityId, ModalContent> = useMemo(() => ({
    walk: {
      icon: "🥾", title: tA("walkTitle"), subtitle: tA("walkSubtitle"), accent: "#22D1C3",
      how: [
        { step: 1, text: tA("walkStep1") },
        { step: 2, text: tA("walkStep2") },
        { step: 3, text: tA("walkStep3") },
      ],
      tips: [tA("walkTip1"), tA("walkTip2"), tA("walkTip3")],
      reward: tA("walkReward"),
    },
    shop: {
      icon: "🏪", title: tA("shopTitle"), subtitle: tA("shopSubtitle"), accent: "#FFD700",
      how: [
        { step: 1, text: tA("shopStep1") },
        { step: 2, text: tA("shopStep2") },
        { step: 3, text: tA("shopStep3") },
        { step: 4, text: tA("shopStep4") },
      ],
      tips: [tA("shopTip1"), tA("shopTip2"), tA("shopTip3")],
      reward: tA("shopReward"),
    },
    runner_fight: {
      icon: "⚔️", title: tA("fightTitle"), subtitle: tA("fightSubtitle"), accent: "#FF2D78",
      how: [
        { step: 1, text: tA("fightStep1") },
        { step: 2, text: tA("fightStep2") },
        { step: 3, text: tA("fightStep3") },
        { step: 4, text: tA("fightStep4") },
      ],
      tips: [tA("fightTip1"), tA("fightTip2"), tA("fightTip3")],
      reward: tA("fightReward"),
      cta: { label: tA("ctaArena"), href: "/runner-fights" },
    },
    arena: {
      icon: "🏛️", title: tA("ligaTitle"), subtitle: tA("ligaSubtitle"), accent: "#a855f7",
      how: [
        { step: 1, text: tA("ligaStep1") },
        { step: 2, text: tA("ligaStep2") },
        { step: 3, text: tA("ligaStep3") },
        { step: 4, text: tA("ligaStep4") },
      ],
      tips: [tA("ligaTip1"), tA("ligaTip2"), tA("ligaTip3")],
      reward: tA("ligaReward"),
    },
    area_boss: {
      icon: "👹", title: tA("bossTitle"), subtitle: tA("bossSubtitle"), accent: "#FF6B4A",
      how: [
        { step: 1, text: tA("bossStep1") },
        { step: 2, text: tA("bossStep2") },
        { step: 3, text: tA("bossStep3") },
        { step: 4, text: tA("bossStep4") },
      ],
      tips: [tA("bossTip1"), tA("bossTip2"), tA("bossTip3")],
      reward: tA("bossReward"),
    },
  }), [tA]);
  const c = CONTENT[id];
  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed", inset: 0, zIndex: 2500,
        background: "rgba(15,17,21,0.92)", backdropFilter: "blur(12px)",
        display: "flex", alignItems: "center", justifyContent: "center", padding: 16,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "100%", maxWidth: 500, maxHeight: "92vh", overflowY: "auto",
          background: "#1A1D23", borderRadius: 20,
          border: `1px solid ${c.accent}55`,
          boxShadow: `0 20px 60px rgba(0,0,0,0.6), 0 0 40px ${c.accent}25`,
          color: "#F0F0F0",
        }}
      >
        {/* Header */}
        <div style={{
          padding: "20px 22px 14px",
          background: `linear-gradient(135deg, ${c.accent}22, transparent)`,
          borderBottom: `1px solid ${c.accent}33`,
          display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10,
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <div style={{ fontSize: 44 }}>{c.icon}</div>
            <div>
              <div style={{ color: "#FFF", fontSize: 18, fontWeight: 900 }}>{c.title}</div>
              <div style={{ color: "#a8b4cf", fontSize: 12 }}>{c.subtitle}</div>
            </div>
          </div>
          <button onClick={onClose} aria-label={tA("closeAria")} style={{
            background: "rgba(255,255,255,0.08)", border: "none", color: "#a8b4cf",
            width: 32, height: 32, borderRadius: 999, cursor: "pointer", fontSize: 16,
          }}>✕</button>
        </div>

        {/* Body */}
        <div style={{ padding: 20 }}>
          <div style={{ color: c.accent, fontSize: 10, fontWeight: 900, letterSpacing: 2, marginBottom: 10 }}>
            {tA("soGehts")}
          </div>
          <ol style={{ listStyle: "none", padding: 0, margin: "0 0 18px 0" }}>
            {c.how.map((h) => (
              <li key={h.step} style={{ display: "flex", gap: 10, marginBottom: 10 }}>
                <div style={{
                  width: 26, height: 26, borderRadius: 999,
                  background: `${c.accent}20`, color: c.accent,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 12, fontWeight: 900, flexShrink: 0,
                }}>{h.step}</div>
                <div style={{ color: "#DDD", fontSize: 13, lineHeight: 1.45, paddingTop: 3 }}>{h.text}</div>
              </li>
            ))}
          </ol>

          {c.tips && c.tips.length > 0 && (
            <>
              <div style={{ color: "#FFD700", fontSize: 10, fontWeight: 900, letterSpacing: 2, marginBottom: 8 }}>
                {tA("tips")}
              </div>
              <ul style={{ listStyle: "none", padding: 0, margin: "0 0 18px 0" }}>
                {c.tips.map((t, i) => (
                  <li key={i} style={{
                    padding: "8px 12px",
                    background: "rgba(255,215,0,0.05)",
                    borderLeft: "2px solid #FFD70055",
                    marginBottom: 6, borderRadius: "0 8px 8px 0",
                    color: "#a8b4cf", fontSize: 12, lineHeight: 1.4,
                  }}>{t}</li>
                ))}
              </ul>
            </>
          )}

          {c.reward && (
            <div style={{
              padding: 12, borderRadius: 12,
              background: `${c.accent}15`, border: `1px solid ${c.accent}44`, marginBottom: 14,
            }}>
              <div style={{ color: c.accent, fontSize: 10, fontWeight: 900, letterSpacing: 2, marginBottom: 4 }}>
                {tA("rewards")}
              </div>
              <div style={{ color: "#FFF", fontSize: 12, lineHeight: 1.5 }}>{c.reward}</div>
            </div>
          )}

          {c.cta && (
            id === "runner_fight" && onOpenArena ? (
              <button onClick={onOpenArena} style={{
                display: "block", width: "100%", padding: "14px 16px",
                borderRadius: 12, textAlign: "center", border: "none",
                background: `linear-gradient(135deg, ${c.accent}, ${c.accent}aa)`,
                color: "#0F1115", fontSize: 14, fontWeight: 900, cursor: "pointer",
              }}>
                {c.cta.label}
              </button>
            ) : (
              <Link href={c.cta.href} onClick={onClose} style={{
                display: "block", width: "100%", padding: "14px 16px",
                borderRadius: 12, textAlign: "center",
                background: `linear-gradient(135deg, ${c.accent}, ${c.accent}aa)`,
                color: "#0F1115", fontSize: 14, fontWeight: 900,
                textDecoration: "none",
              }}>
                {c.cta.label}
              </Link>
            )
          )}
        </div>
      </div>
    </div>
  );
}
