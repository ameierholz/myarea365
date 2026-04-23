"use client";

import { useEffect, useState } from "react";

type Reward = {
  id: string;
  tier: number;
  threshold: number;
  label: string;
  reward_kind: "discount_percent" | "free_item" | "wegemuenzen_unlock" | "gebietsruf_unlock" | "crew_emblem";
  reward_value_int: number | null;
  reward_value_text: string | null;
  active: boolean;
};

type TopCrew = {
  crew_id: string;
  crew_name: string;
  crew_color: string | null;
  stamp_count: number;
  tier_unlocked: number;
  last_stamp_at: string | null;
};

const TIER_META = [
  null,
  { color: "#CD7F32", defaultLabel: "Bronze",  defaultThreshold: 10 },
  { color: "#C0C0C0", defaultLabel: "Silber",  defaultThreshold: 25 },
  { color: "#FFD700", defaultLabel: "Gold",    defaultThreshold: 50 },
];

const KIND_LABEL: Record<Reward["reward_kind"], string> = {
  discount_percent:   "Rabatt in %",
  free_item:          "Gratis-Artikel (Text)",
  wegemuenzen_unlock: "🪙 Wegemünzen-Bonus (In-App)",
  gebietsruf_unlock:  "🏴 Gebietsruf-Bonus (In-App)",
  crew_emblem:        "Crew-Emblem am Shop-Pin",
};

export function ShopCrewStampsPanel({ shopId }: { shopId: string }) {
  const [rewards, setRewards] = useState<Reward[] | null>(null);
  const [topCrews, setTopCrews] = useState<TopCrew[]>([]);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    const res = await fetch(`/api/shop/crew-rewards?shop_id=${shopId}`, { cache: "no-store" });
    const j = await res.json();
    setRewards(j.rewards ?? []);
    setTopCrews(j.top_crews ?? []);
  }
  useEffect(() => { void load(); }, [shopId]); // eslint-disable-line react-hooks/exhaustive-deps

  async function saveTier(form: Partial<Reward> & { tier: number }) {
    setError(null);
    const res = await fetch("/api/shop/crew-rewards", {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ shop_id: shopId, ...form }),
    });
    const j = await res.json();
    if (!j.ok) { setError(j.error ?? "Fehler"); return; }
    void load();
  }

  async function removeTier(id: string) {
    if (!window.confirm("Diese Stufe wirklich entfernen?")) return;
    const res = await fetch(`/api/shop/crew-rewards?id=${id}`, { method: "DELETE" });
    const j = await res.json();
    if (!j.ok) { setError(j.error ?? "Fehler"); return; }
    void load();
  }

  if (rewards === null) return <div style={{ padding: 20, color: "#a8b4cf" }}>Lade Stempel-System …</div>;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      {/* Intro */}
      <div style={{
        padding: 14, borderRadius: 12,
        background: "linear-gradient(135deg, rgba(255,215,0,0.12), rgba(34,209,195,0.08))",
        border: "1px solid rgba(255,215,0,0.35)",
      }}>
        <div style={{ fontSize: 10, letterSpacing: 2, color: "#FFD700", fontWeight: 900 }}>
          STAMMKUNDEN-STEMPELKARTE
        </div>
        <div style={{ color: "#FFF", fontSize: 14, fontWeight: 900, marginTop: 2 }}>
          Crews belohnen, die regelmäßig kommen
        </div>
        <div style={{ color: "#a8b4cf", fontSize: 12, lineHeight: 1.55, marginTop: 6 }}>
          Jede Deal-Einlösung eines Crew-Mitglieds zählt als Stempel für die gesamte Crew.
          Ab deinen definierten Schwellen schaltet automatisch die Belohnung frei — für
          alle Crew-Mitglieder. Du musst nichts tun, läuft im Hintergrund. Ein perfektes
          Stammkunden-Feature für Kiez-nahe Crews.
        </div>
      </div>

      {/* Tier-Editor */}
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {[1, 2, 3].map((tier) => {
          const existing = rewards.find((r) => r.tier === tier);
          return (
            <TierCard
              key={tier}
              tier={tier}
              existing={existing}
              onSave={saveTier}
              onDelete={existing ? () => removeTier(existing.id) : undefined}
            />
          );
        })}
      </div>

      {error && (
        <div style={{ padding: 10, borderRadius: 8, background: "rgba(255,45,120,0.12)", color: "#FF2D78", fontSize: 12 }}>
          ⚠️ {error}
        </div>
      )}

      {/* Top-Crews */}
      <div>
        <div style={{ color: "#22D1C3", fontSize: 11, fontWeight: 900, letterSpacing: 2, marginBottom: 8 }}>
          🏆 TOP-STAMMCREWS
        </div>
        {topCrews.length === 0 ? (
          <div style={{
            padding: 20, textAlign: "center",
            background: "rgba(255,255,255,0.03)", borderRadius: 10,
            color: "#8B8FA3", fontSize: 12,
          }}>
            Noch keine Crew hat bei dir gesammelt. Sobald ein Crew-Mitglied einlöst, taucht die Crew hier auf.
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {topCrews.map((c, i) => (
              <div key={c.crew_id} style={{
                display: "flex", alignItems: "center", gap: 10,
                padding: 10, borderRadius: 10,
                background: "rgba(255,255,255,0.03)",
                border: "1px solid rgba(255,255,255,0.06)",
              }}>
                <div style={{
                  width: 28, textAlign: "center",
                  fontSize: 14, fontWeight: 900,
                  color: i === 0 ? "#FFD700" : i === 1 ? "#C0C0C0" : i === 2 ? "#CD7F32" : "#8B8FA3",
                }}>#{i + 1}</div>
                <div style={{
                  width: 8, height: 8, borderRadius: 999,
                  background: c.crew_color ?? "#22D1C3",
                }} />
                <div style={{ flex: 1, fontSize: 13, fontWeight: 800, color: "#FFF" }}>{c.crew_name}</div>
                <div style={{ fontSize: 13, fontWeight: 900, color: "#FFD700" }}>
                  {c.stamp_count} {c.stamp_count === 1 ? "Stempel" : "Stempel"}
                </div>
                {c.tier_unlocked > 0 && (
                  <div style={{
                    padding: "2px 8px", borderRadius: 999,
                    background: `${TIER_META[c.tier_unlocked]?.color}33`,
                    border: `1px solid ${TIER_META[c.tier_unlocked]?.color}`,
                    color: TIER_META[c.tier_unlocked]?.color,
                    fontSize: 9, fontWeight: 900, letterSpacing: 1,
                  }}>
                    {TIER_META[c.tier_unlocked]?.defaultLabel.toUpperCase()}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function TierCard({ tier, existing, onSave, onDelete }: {
  tier: number;
  existing: Reward | undefined;
  onSave: (form: Partial<Reward> & { tier: number }) => Promise<void>;
  onDelete?: () => void;
}) {
  const meta = TIER_META[tier]!;
  const [editing, setEditing] = useState(false);

  if (!editing && !existing) {
    return (
      <div style={{
        padding: 14, borderRadius: 12,
        background: "rgba(255,255,255,0.03)",
        border: `1px dashed ${meta.color}55`,
        display: "flex", alignItems: "center", gap: 12,
      }}>
        <div style={{
          width: 36, height: 36, borderRadius: 10,
          background: `${meta.color}22`, border: `1px solid ${meta.color}`,
          color: meta.color, display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 14, fontWeight: 900,
        }}>{tier}</div>
        <div style={{ flex: 1, color: "#a8b4cf", fontSize: 13 }}>
          <b style={{ color: meta.color }}>{meta.defaultLabel}</b> · noch nicht konfiguriert
        </div>
        <button onClick={() => setEditing(true)} style={{
          padding: "6px 12px", borderRadius: 8, border: "none",
          background: meta.color, color: "#0F1115",
          fontSize: 11, fontWeight: 900, cursor: "pointer",
        }}>+ Anlegen</button>
      </div>
    );
  }

  if (!editing && existing) {
    return (
      <div style={{
        padding: 14, borderRadius: 12,
        background: `${meta.color}10`,
        border: `1px solid ${meta.color}55`,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 8 }}>
          <div style={{
            width: 36, height: 36, borderRadius: 10,
            background: meta.color, color: "#0F1115",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 14, fontWeight: 900,
          }}>{tier}</div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 14, fontWeight: 900, color: "#FFF" }}>{existing.label}</div>
            <div style={{ fontSize: 11, color: "#a8b4cf" }}>
              Ab <b style={{ color: meta.color }}>{existing.threshold} Stempeln</b>
            </div>
          </div>
          <button onClick={() => setEditing(true)} style={BTN_ICON}>✏️</button>
          {onDelete && <button onClick={onDelete} style={{ ...BTN_ICON, color: "#FF2D78" }}>🗑️</button>}
        </div>
        <div style={{ fontSize: 12, color: "#D0D0D5" }}>
          🎁 {KIND_LABEL[existing.reward_kind]}
          {existing.reward_value_int != null && <span> · <b>{existing.reward_value_int}</b></span>}
          {existing.reward_value_text && <span> · {existing.reward_value_text}</span>}
        </div>
      </div>
    );
  }

  return (
    <TierForm tier={tier} meta={meta} existing={existing}
      onCancel={() => setEditing(false)}
      onSaved={async (form) => { await onSave(form); setEditing(false); }}
    />
  );
}

function TierForm({ tier, meta, existing, onCancel, onSaved }: {
  tier: number;
  meta: NonNullable<(typeof TIER_META)[1]>;
  existing: Reward | undefined;
  onCancel: () => void;
  onSaved: (form: Partial<Reward> & { tier: number }) => Promise<void>;
}) {
  const [kind, setKind] = useState<Reward["reward_kind"]>(existing?.reward_kind ?? "free_item");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    const fd = new FormData(e.currentTarget);
    const form: Partial<Reward> & { tier: number } = {
      tier,
      threshold: Number(fd.get("threshold")) || meta.defaultThreshold,
      label: String(fd.get("label") ?? meta.defaultLabel),
      reward_kind: kind,
      reward_value_int: ["discount_percent", "wegemuenzen_unlock", "gebietsruf_unlock"].includes(kind)
        ? Number(fd.get("value_int")) || 0
        : null,
      reward_value_text: ["free_item"].includes(kind)
        ? String(fd.get("value_text") ?? "")
        : null,
      active: true,
    };
    await onSaved(form);
    setBusy(false);
  }

  return (
    <form onSubmit={submit} style={{
      padding: 14, borderRadius: 12,
      background: `${meta.color}10`,
      border: `1px solid ${meta.color}`,
    }}>
      <div style={{ color: meta.color, fontSize: 11, fontWeight: 900, letterSpacing: 2, marginBottom: 10 }}>
        STUFE {tier} · KONFIGURIEREN
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        <label style={LBL}>
          <span>Name der Stufe</span>
          <input name="label" defaultValue={existing?.label ?? meta.defaultLabel} style={INP} />
        </label>
        <label style={LBL}>
          <span>Ab wie vielen Stempeln</span>
          <input name="threshold" type="number" min={1} defaultValue={existing?.threshold ?? meta.defaultThreshold} style={INP} />
        </label>
      </div>

      <label style={LBL}>
        <span>Belohnung</span>
        <select value={kind} onChange={(e) => setKind(e.target.value as Reward["reward_kind"])} style={INP}>
          {Object.entries(KIND_LABEL).map(([k, lbl]) => <option key={k} value={k}>{lbl}</option>)}
        </select>
      </label>

      {["discount_percent", "wegemuenzen_unlock", "gebietsruf_unlock"].includes(kind) && (
        <label style={LBL}>
          <span>
            {kind === "discount_percent" && "% Rabatt (an der Kasse, für alle Crew-Mitglieder)"}
            {kind === "wegemuenzen_unlock" && "🪙 Bonus pro Crew-Mitglied (einmalig bei Freischaltung)"}
            {kind === "gebietsruf_unlock" && "🏴 Bonus pro Crew-Mitglied (einmalig bei Freischaltung)"}
          </span>
          <input name="value_int" type="number" min={0}
            defaultValue={existing?.reward_value_int ?? (kind === "discount_percent" ? 10 : kind === "wegemuenzen_unlock" ? 200 : 100)}
            style={INP} />
        </label>
      )}
      {kind === "free_item" && (
        <label style={LBL}>
          <span>Beschreibung der Gratis-Leistung</span>
          <input name="value_text" placeholder="z.B. Gratis-Cappuccino pro Mitglied 1×/Monat"
            defaultValue={existing?.reward_value_text ?? ""} style={INP} />
        </label>
      )}
      {kind === "crew_emblem" && (
        <div style={{ fontSize: 11, color: "#a8b4cf", padding: 8, background: "rgba(255,255,255,0.03)", borderRadius: 8 }}>
          Die Crew erscheint als sichtbares Emblem am Shop-Pin auf der Karte. Prestige-Belohnung ohne Kosten.
        </div>
      )}

      <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
        <button type="button" onClick={onCancel} style={{
          flex: 1, padding: "9px", borderRadius: 8,
          background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.15)",
          color: "#FFF", fontSize: 12, fontWeight: 700, cursor: "pointer",
        }}>Abbrechen</button>
        <button type="submit" disabled={busy} style={{
          flex: 2, padding: "9px", borderRadius: 8, border: "none",
          background: meta.color, color: "#0F1115",
          fontSize: 13, fontWeight: 900, cursor: "pointer", opacity: busy ? 0.6 : 1,
        }}>{busy ? "Speichert…" : "Speichern"}</button>
      </div>
    </form>
  );
}

const LBL: React.CSSProperties = { display: "flex", flexDirection: "column", gap: 4, fontSize: 11, color: "#a8b4cf", fontWeight: 700, marginBottom: 10 };
const INP: React.CSSProperties = {
  padding: "9px 11px", borderRadius: 8,
  background: "#0F1115", border: "1px solid rgba(255,255,255,0.12)",
  color: "#F0F0F0", fontSize: 13, fontFamily: "inherit",
};
const BTN_ICON: React.CSSProperties = {
  width: 32, height: 32, borderRadius: 8,
  background: "rgba(255,255,255,0.06)",
  border: "1px solid rgba(255,255,255,0.1)",
  color: "#F0F0F0", fontSize: 12, cursor: "pointer",
};
