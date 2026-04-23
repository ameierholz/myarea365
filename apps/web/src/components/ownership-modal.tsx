"use client";

import { useEffect, useState } from "react";

export type OwnershipQuery =
  | { type: "segment"; id: string }
  | { type: "street"; id: string }
  | { type: "territory"; id: string };

type Owner = {
  user: { id: string; display_name: string | null; username: string | null } | null;
  crew: { id: string; name: string } | null;
};

type OwnershipData = {
  kind: "segment" | "street" | "territory";
  id: string;
  street_name?: string | null;
  length_m?: number;
  segments_count?: number;
  total_length_m?: number;
  area_m2?: number;
  perimeter_m?: number;
  status?: string;
  claimed_at?: string;
  stolen_at?: string | null;
  owner: Owner;
  stole_from?: Owner | null;
};

function ownerLabel(o: Owner | null | undefined): { label: string; sub: string | null; color: string } {
  if (!o) return { label: "Unbeansprucht", sub: null, color: "#8B8FA3" };
  if (o.crew) return { label: `👥 ${o.crew.name}`, sub: "Crew-Gebiet", color: "#22D1C3" };
  if (o.user) {
    const name = o.user.display_name ?? o.user.username ?? "Unbekannt";
    return { label: `🏃 ${name}`, sub: "Runner-Gebiet", color: "#FFD700" };
  }
  return { label: "Unbeansprucht", sub: null, color: "#8B8FA3" };
}

function fmtDate(iso?: string): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleString("de-DE", { dateStyle: "medium", timeStyle: "short" });
}

export function OwnershipModal({ query, onClose }: { query: OwnershipQuery; onClose: () => void }) {
  const [data, setData] = useState<OwnershipData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/ownership?type=${query.type}&id=${query.id}`);
        if (!res.ok) throw new Error(`${res.status}`);
        const json = await res.json();
        if (!cancelled) setData(json);
      } catch (e) {
        if (!cancelled) setError(String(e));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [query.type, query.id]);

  const title = query.type === "segment" ? "Straßenabschnitt" : query.type === "street" ? "Straßenzug" : "Gebiet";
  const icon = query.type === "segment" ? "🛤️" : query.type === "street" ? "🛣️" : "🏆";
  const owner = data ? ownerLabel(data.owner) : ownerLabel(null);

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed", inset: 0, zIndex: 3000,
        background: "rgba(15,17,21,0.88)", backdropFilter: "blur(10px)",
        display: "flex", alignItems: "center", justifyContent: "center", padding: 16,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "100%", maxWidth: 420,
          background: "#1A1D23", borderRadius: 18, padding: 22,
          border: "1px solid rgba(255,255,255,0.12)",
          color: "#F0F0F0",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
          <span style={{ fontSize: 28 }}>{icon}</span>
          <div style={{ flex: 1 }}>
            <div style={{ color: "#FFF", fontSize: 17, fontWeight: 900 }}>{title}</div>
            {data?.street_name && (
              <div style={{ color: "#a8b4cf", fontSize: 12 }}>{data.street_name}</div>
            )}
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", color: "#8B8FA3", fontSize: 22, cursor: "pointer" }}>×</button>
        </div>

        {loading ? (
          <div style={{ padding: "30px 0", textAlign: "center", color: "#8B8FA3" }}>Lade Besitzer-Info…</div>
        ) : error ? (
          <div style={{ padding: 14, borderRadius: 10, background: "rgba(255,45,120,0.15)", color: "#FF2D78", fontSize: 12 }}>
            Konnte Besitzer nicht laden ({error})
          </div>
        ) : data ? (
          <>
            <div style={{
              padding: 14, borderRadius: 12,
              background: `linear-gradient(135deg, ${owner.color}20, ${owner.color}08)`,
              border: `1px solid ${owner.color}55`,
              marginBottom: 12,
            }}>
              <div style={{ color: "#a8b4cf", fontSize: 10, fontWeight: 800, letterSpacing: 1, marginBottom: 4 }}>BESITZER</div>
              <div style={{ color: owner.color, fontSize: 20, fontWeight: 900 }}>{owner.label}</div>
              {owner.sub && <div style={{ color: "#a8b4cf", fontSize: 11, marginTop: 2 }}>{owner.sub}</div>}
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, fontSize: 11, marginBottom: 12 }}>
              {data.length_m !== undefined && (
                <Row label="Länge" value={`${data.length_m} m`} />
              )}
              {data.total_length_m !== undefined && (
                <Row label="Länge gesamt" value={`${(data.total_length_m / 1000).toFixed(2)} km`} />
              )}
              {data.segments_count !== undefined && (
                <Row label="Abschnitte" value={`${data.segments_count}`} />
              )}
              {data.area_m2 !== undefined && (
                <Row label="Fläche" value={`${data.area_m2.toLocaleString("de-DE")} m²`} />
              )}
              {data.perimeter_m !== undefined && (
                <Row label="Umfang" value={`${data.perimeter_m} m`} />
              )}
              {data.status && (
                <Row label="Status" value={data.status === "active" ? "✓ aktiv" : data.status === "stolen" ? "⚔️ erobert" : data.status} />
              )}
              <Row label="Beansprucht" value={fmtDate(data.claimed_at)} />
            </div>

            {data.stole_from && (data.stole_from.user || data.stole_from.crew) && (
              <div style={{
                padding: 12, borderRadius: 10,
                background: "rgba(255,45,120,0.1)", border: "1px solid rgba(255,45,120,0.35)",
                fontSize: 11, marginBottom: 12,
              }}>
                <div style={{ color: "#FF2D78", fontWeight: 900, marginBottom: 3 }}>⚔️ Zurückerobert von</div>
                <div style={{ color: "#FFF" }}>{ownerLabel(data.stole_from).label}</div>
                <div style={{ color: "#a8b4cf", fontSize: 10 }}>{fmtDate(data.stolen_at ?? undefined)}</div>
              </div>
            )}

            {data.kind === "territory" && data.status === "active" && (
              <div style={{
                padding: 10, borderRadius: 10,
                background: "rgba(34,209,195,0.08)", border: "1px dashed rgba(34,209,195,0.4)",
                fontSize: 11, color: "#a8b4cf",
              }}>
                💡 Lauf eine neue Runde durch dieses Gebiet um es zurückzuerobern. Crew-Gebiete sind nur als Crew schützbar.
              </div>
            )}
          </>
        ) : null}
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ padding: "8px 10px", borderRadius: 8, background: "rgba(70,82,122,0.3)" }}>
      <div style={{ color: "#8B8FA3", fontSize: 9, fontWeight: 800, letterSpacing: 1 }}>{label.toUpperCase()}</div>
      <div style={{ color: "#FFF", fontSize: 12, fontWeight: 700, marginTop: 2 }}>{value}</div>
    </div>
  );
}
