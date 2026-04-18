"use client";

export function RainbowName({ name, active, size = 14 }: { name: string; active: boolean; size?: number }) {
  if (!active) return <span style={{ fontSize: size }}>{name}</span>;
  return (
    <span
      style={{
        fontSize: size,
        backgroundImage: "linear-gradient(90deg,#ff0080,#ff8c00,#ffd700,#22D1C3,#a855f7,#ff0080)",
        backgroundSize: "300% 100%",
        WebkitBackgroundClip: "text",
        backgroundClip: "text",
        color: "transparent",
        WebkitTextFillColor: "transparent",
        animation: "rainbowShift 3s linear infinite",
        fontWeight: 900,
        display: "inline-block",
      }}
    >
      {name}
      <style>{`@keyframes rainbowShift { 0% { background-position: 0% 50% } 100% { background-position: 300% 50% } }`}</style>
    </span>
  );
}

export function isRainbowActive(until: string | null | undefined): boolean {
  if (!until) return false;
  return new Date(until).getTime() > Date.now();
}
