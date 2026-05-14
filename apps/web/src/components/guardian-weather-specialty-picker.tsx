"use client";

/**
 * GuardianWeatherSpecialtyPicker — kleine Sektion im Wächter-Detail-Modal.
 * Lädt den Specialty-Catalog (6 Optionen), zeigt die aktuelle Auswahl mit
 * dem passenden Wetter-Buff (+15 %), und erlaubt Änderung via /api/me/...
 */

import { useEffect, useState } from "react";

export type SpecialtyOption = {
  code: string;
  label: string;
  emoji: string;
  weather: string;
  description: string;
};

export function GuardianWeatherSpecialtyPicker({
  guardianId,
  current,
  onChange,
}: {
  guardianId: string;
  current: string | null;
  onChange?: (newCode: string | null) => void;
}) {
  const [options, setOptions] = useState<SpecialtyOption[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(current);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const r = await fetch("/api/specialty-catalog", { cache: "force-cache" });
        if (!r.ok) return;
        const j = await r.json();
        if (!cancelled) setOptions(j.options ?? []);
      } catch { /* ignore */ }
    })();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => { setSelected(current); }, [current]);

  async function save(code: string | null) {
    setBusy(true);
    setError(null);
    try {
      const r = await fetch(`/api/me/guardians/${guardianId}/specialty`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      });
      const j = await r.json();
      if (!r.ok || j?.ok === false) {
        setError(j?.error ?? "Fehler beim Speichern");
      } else {
        setSelected(code);
        onChange?.(code);
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  if (options.length === 0) return null;

  return (
    <div style={{
      marginTop: 12, padding: 12, borderRadius: 10,
      background: "linear-gradient(135deg, rgba(34,209,195,0.08), rgba(168,85,247,0.06))",
      border: "1px solid rgba(34,209,195,0.25)",
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
        <span style={{ fontSize: 14 }}>🌦️</span>
        <span style={{ fontSize: 11, fontWeight: 900, letterSpacing: 0.6, color: "#22D1C3" }}>
          WETTER-SPEZIALTALENT
        </span>
        <span style={{ fontSize: 9, fontWeight: 700, color: "rgba(255,255,255,0.55)" }}>
          (+15 % bei passendem Wetter)
        </span>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))", gap: 5 }}>
        <SpecialtyButton
          option={null}
          active={selected === null}
          busy={busy}
          onClick={() => save(null)}
        />
        {options.map((opt) => (
          <SpecialtyButton
            key={opt.code}
            option={opt}
            active={selected === opt.code}
            busy={busy}
            onClick={() => save(opt.code)}
          />
        ))}
      </div>

      {error && (
        <div style={{ marginTop: 8, fontSize: 10, color: "#FF6B4A", fontWeight: 700 }}>
          {error}
        </div>
      )}
    </div>
  );
}

function SpecialtyButton({
  option, active, busy, onClick,
}: {
  option: SpecialtyOption | null;
  active: boolean;
  busy: boolean;
  onClick: () => void;
}) {
  const emoji = option?.emoji ?? "🚫";
  const label = option?.label ?? "Kein Talent";
  const description = option?.description ?? "Kein Wetter-Bonus.";
  return (
    <button
      onClick={onClick}
      disabled={busy}
      title={description}
      style={{
        cursor: busy ? "wait" : "pointer",
        padding: "6px 8px",
        borderRadius: 7,
        border: `1px solid ${active ? "rgba(34,209,195,0.6)" : "rgba(255,255,255,0.1)"}`,
        background: active ? "rgba(34,209,195,0.18)" : "rgba(255,255,255,0.03)",
        color: active ? "#22D1C3" : "#FFF",
        fontFamily: "Inter,-apple-system,sans-serif",
        display: "flex", alignItems: "center", gap: 5,
        opacity: busy ? 0.6 : 1,
        textAlign: "left",
        minWidth: 0,
      }}
    >
      <span style={{ fontSize: 14, lineHeight: 1, flexShrink: 0 }}>{emoji}</span>
      <span style={{ fontSize: 10, fontWeight: 800, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
        {label}
      </span>
    </button>
  );
}
