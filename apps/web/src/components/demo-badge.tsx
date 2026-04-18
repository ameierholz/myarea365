export function DemoBadge({ label = "DEMO", hint }: { label?: string; hint?: string }) {
  return (
    <span
      title={hint ?? "Beispiel-Daten — echte Werte folgen, sobald die Community größer ist"}
      style={{
        display: "inline-flex", alignItems: "center", gap: 4,
        padding: "2px 7px", borderRadius: 999,
        background: "rgba(255, 45, 120, 0.15)",
        border: "1px solid rgba(255, 45, 120, 0.4)",
        color: "#FF2D78", fontSize: 9, fontWeight: 900, letterSpacing: 0.5,
        whiteSpace: "nowrap",
      }}
    >
      🧪 {label}
    </span>
  );
}
