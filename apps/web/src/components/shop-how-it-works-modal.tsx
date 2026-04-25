"use client";

import { useTranslations } from "next-intl";

export function ShopHowItWorksModal({ onClose }: { onClose: () => void }) {
  const t = useTranslations("ShopPanels");
  return (
    <div onClick={onClose} style={{
      position: "fixed", inset: 0, zIndex: 3900,
      background: "rgba(15,17,21,0.92)", backdropFilter: "blur(10px)",
      display: "flex", alignItems: "center", justifyContent: "center", padding: 16,
    }}>
      <div onClick={(e) => e.stopPropagation()} style={{
        width: "100%", maxWidth: 620, maxHeight: "92vh", overflowY: "auto",
        background: "#1A1D23", borderRadius: 20,
        border: "1px solid rgba(34,209,195,0.4)",
        color: "#F0F0F0", boxShadow: "0 20px 60px rgba(0,0,0,0.7)",
      }}>
        <div style={{ padding: "18px 22px", borderBottom: "1px solid rgba(255,255,255,0.08)", display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ fontSize: 26 }}>🤝</div>
          <div style={{ flex: 1 }}>
            <div style={{ color: "#22D1C3", fontSize: 10, fontWeight: 900, letterSpacing: 2 }}>{t("howKicker")}</div>
            <div style={{ color: "#FFF", fontSize: 16, fontWeight: 900 }}>{t("howTitle")}</div>
          </div>
          <button onClick={onClose} style={{ background: "rgba(255,255,255,0.08)", border: "none", color: "#a8b4cf", width: 32, height: 32, borderRadius: 999, cursor: "pointer", fontSize: 16 }}>✕</button>
        </div>

        <div style={{ padding: 22 }}>
          <Section title={t("howSec1")}>
            <Step n={1} icon="🏷️" title={t("howSec1S1Title")} body={t("howSec1S1Body")} />
            <Step n={2} icon="🔲" title={t("howSec1S2Title")} body={t("howSec1S2Body")} />
            <Step n={3} icon="🎯" title={t("howSec1S3Title")} body={t("howSec1S3Body")} />
          </Section>

          <Section title={t("howSec2")}>
            <Step n={1} icon="📱" title={t("howSec2S1Title")} body={t("howSec2S1Body")} />
            <Step n={2} icon="✓" title={t("howSec2S2Title")} body={
              <>{t("howSec2S2Body1")}<b style={{ color: "#4ade80" }}>{t("howSec2S2BoldGreen")}</b>{t("howSec2S2Plus")}<b>{t("howSec2S2BoldName")}</b>{t("howSec2S2Plus")}<b>{t("howSec2S2BoldTime")}</b>{t("howSec2S2RingHint")}<br /><i style={{ color: "#8B8FA3" }}>{t("howSec2S2Italic")}</i></>
            } />
            <Step n={3} icon="🛍️" title={t("howSec2S3Title")} body={t("howSec2S3Body")} />
            <Step n={4} icon="🧾" title={t("howSec2S4Title")} body={t("howSec2S4Body")} />
          </Section>

          <Section title={t("howSec3")}>
            <Feature icon="📸" title={t("howF1Title")} body={t("howF1Body")} />
            <Feature icon="🎯" title={t("howF2Title")} body={t("howF2Body")} />
            <Feature icon="🏆" title={t("howF3Title")} body={t("howF3Body")} />
            <Feature icon="📊" title={t("howF4Title")} body={t("howF4Body")} />
          </Section>

          <div style={{
            marginTop: 20, padding: 14, borderRadius: 12,
            background: "rgba(34,209,195,0.1)",
            border: "1px solid rgba(34,209,195,0.3)",
          }}>
            <div style={{ fontSize: 13, fontWeight: 900, color: "#22D1C3", marginBottom: 4 }}>
              {t("howEffortTitle")}
            </div>
            <div style={{ fontSize: 12, color: "#a8b4cf", lineHeight: 1.55 }}>
              {t("howEffortBody")}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 20 }}>
      <div style={{ fontSize: 11, fontWeight: 900, letterSpacing: 2, color: "#22D1C3", marginBottom: 10 }}>
        {title.toUpperCase()}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>{children}</div>
    </div>
  );
}

function Step({ n, icon, title, body }: { n: number; icon: string; title: string; body: React.ReactNode }) {
  return (
    <div style={{
      display: "flex", gap: 12,
      padding: 12, borderRadius: 12,
      background: "rgba(255,255,255,0.03)",
      border: "1px solid rgba(255,255,255,0.06)",
    }}>
      <div style={{
        width: 30, height: 30, borderRadius: 999,
        background: "linear-gradient(135deg, #22D1C3, #5ddaf0)",
        color: "#0F1115", fontSize: 13, fontWeight: 900,
        display: "flex", alignItems: "center", justifyContent: "center",
        flexShrink: 0,
      }}>{n}</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 900, color: "#FFF", marginBottom: 2 }}>
          {icon} {title}
        </div>
        <div style={{ fontSize: 12, color: "#a8b4cf", lineHeight: 1.5 }}>{body}</div>
      </div>
    </div>
  );
}

function Feature({ icon, title, body }: { icon: string; title: string; body: React.ReactNode }) {
  return (
    <div style={{
      padding: 10, borderRadius: 10,
      background: "rgba(255,215,0,0.06)",
      border: "1px solid rgba(255,215,0,0.15)",
    }}>
      <div style={{ fontSize: 12, fontWeight: 900, color: "#FFD700", marginBottom: 2 }}>{icon} {title}</div>
      <div style={{ fontSize: 11, color: "#a8b4cf", lineHeight: 1.5 }}>{body}</div>
    </div>
  );
}
