export type MmrTier = { id: string; label: string; color: string; icon: string; minMmr: number };

export const MMR_TIERS: MmrTier[] = [
  { id: "legend",  label: "Legende",  color: "#FFD700", icon: "👑", minMmr: 2200 },
  { id: "meister", label: "Meister",  color: "#FF2D78", icon: "🏆", minMmr: 2000 },
  { id: "diamant", label: "Diamant",  color: "#22D1C3", icon: "💎", minMmr: 1800 },
  { id: "platin",  label: "Platin",   color: "#a8b4cf", icon: "⭐", minMmr: 1600 },
  { id: "gold",    label: "Gold",     color: "#FFA500", icon: "🥇", minMmr: 1400 },
  { id: "silber",  label: "Silber",   color: "#C0C0C0", icon: "🥈", minMmr: 1200 },
  { id: "bronze",  label: "Bronze",   color: "#CD7F32", icon: "🥉", minMmr: 1000 },
  { id: "holz",    label: "Holz",     color: "#8B8FA3", icon: "🪵", minMmr: 0    },
];

export function tierForMmr(mmr: number): MmrTier {
  return MMR_TIERS.find((t) => mmr >= t.minMmr) ?? MMR_TIERS[MMR_TIERS.length - 1];
}
