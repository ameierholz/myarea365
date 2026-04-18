export type SupporterTier = "bronze" | "silver" | "gold";

const TIER_CONFIG: Record<SupporterTier, { label: string; bg: string; border: string; text: string; shadow: string; icon: string }> = {
  bronze: {
    label: "Bronze",
    bg: "linear-gradient(135deg, #CD7F32, #A0522D)",
    border: "#CD7F32",
    text: "#FFF3E0",
    shadow: "0 0 8px rgba(205,127,50,0.5)",
    icon: "🥉",
  },
  silver: {
    label: "Silber",
    bg: "linear-gradient(135deg, #E0E0E0, #9A9A9A)",
    border: "#C0C0C0",
    text: "#1A1A1A",
    shadow: "0 0 10px rgba(192,192,192,0.6)",
    icon: "🥈",
  },
  gold: {
    label: "Gold",
    bg: "linear-gradient(135deg, #FFD700, #B8860B)",
    border: "#FFD700",
    text: "#1A1A1A",
    shadow: "0 0 14px rgba(255,215,0,0.7)",
    icon: "🥇",
  },
};

export function SupporterBadge({ tier, size = "sm", showLabel = false }: {
  tier: SupporterTier | null | undefined;
  size?: "xs" | "sm" | "md";
  showLabel?: boolean;
}) {
  if (!tier) return null;
  const cfg = TIER_CONFIG[tier];
  const sz = size === "xs"
    ? { pad: "1px 5px", font: 9, icon: 10 }
    : size === "md"
      ? { pad: "4px 10px", font: 12, icon: 14 }
      : { pad: "2px 7px", font: 10, icon: 12 };
  return (
    <span
      title={`${cfg.label}-Supporter · danke für deine Unterstützung!`}
      style={{
        display: "inline-flex", alignItems: "center", gap: 4,
        padding: sz.pad, borderRadius: 999,
        background: cfg.bg,
        border: `1px solid ${cfg.border}`,
        color: cfg.text,
        fontSize: sz.font, fontWeight: 900, letterSpacing: 0.3,
        boxShadow: cfg.shadow,
        whiteSpace: "nowrap",
      }}
    >
      <span style={{ fontSize: sz.icon }}>{cfg.icon}</span>
      {showLabel && <span>{cfg.label}</span>}
    </span>
  );
}
