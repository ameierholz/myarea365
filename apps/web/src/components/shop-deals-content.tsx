"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { SHOP_CATEGORIES } from "@/lib/shop-categories";

type DealRow = {
  deal_id: string;
  shop_id: string;
  shop_name: string;
  shop_category: string | null;
  shop_city: string | null;
  shop_zip: string | null;
  shop_address: string | null;
  shop_logo_url: string | null;
  deal_title: string;
  deal_description: string | null;
  xp_cost: number;
  min_order_amount_cents: number | null;
  frequency: string;
  redemption_count: number;
  active_until: string | null;
  distance_m: number | null;
};

type Pos = { lat: number; lng: number } | null;

const CATEGORIES: string[] = ["", ...SHOP_CATEGORIES];

const FREQ: Record<string, string> = {
  daily:      "1×/Tag",
  weekly:     "1×/Woche",
  monthly:    "1×/Monat",
  quarterly:  "1×/Quartal",
  unlimited:  "unbegrenzt",
};

const INP: React.CSSProperties = {
  padding: "8px 12px", borderRadius: 8,
  background: "#1A1D23", border: "1px solid rgba(255,255,255,0.1)",
  color: "#F0F0F0", fontSize: 12,
};

/**
 * Inhalt der Shop-Deals-Suche — gemeinsam genutzt von /deals (Vollseite,
 * SEO-/Bookmark-fähig) und vom Bottom-Nav-Modal (Overlay über Dashboard).
 */
export function ShopDealsContent() {
  const [deals, setDeals] = useState<DealRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [pos, setPos] = useState<Pos>(null);
  const [posAsked, setPosAsked] = useState(false);

  const [country, setCountry] = useState("DE");
  const [state, setState] = useState("");
  const [city, setCity] = useState("");
  const [zip, setZip] = useState("");
  const [category, setCategory] = useState("");
  const [radiusKm, setRadiusKm] = useState(0);
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<"distance" | "price_asc" | "popular" | "newest">("distance");

  function requestLocation() {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setPosAsked(true);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (p) => { setPos({ lat: p.coords.latitude, lng: p.coords.longitude }); setPosAsked(true); },
      () => { setPos(null); setPosAsked(true); },
      { enableHighAccuracy: false, timeout: 5000, maximumAge: 60000 },
    );
  }

  useEffect(() => {
    const t = setTimeout(() => {
      const qs = new URLSearchParams();
      if (country)  qs.set("country", country);
      if (state)    qs.set("state", state);
      if (city)     qs.set("city", city);
      if (zip)      qs.set("zip", zip);
      if (category) qs.set("category", category);
      if (q)        qs.set("q", q);
      if (pos)      { qs.set("lat", String(pos.lat)); qs.set("lng", String(pos.lng)); }
      if (radiusKm > 0) qs.set("radius_km", String(radiusKm));
      qs.set("sort", sort);
      qs.set("limit", "60");

      setLoading(true);
      fetch(`/api/deals/search?${qs.toString()}`, { cache: "no-store" })
        .then((r) => r.json())
        .then((j: { deals: DealRow[] }) => setDeals(j.deals ?? []))
        .catch(() => setDeals([]))
        .finally(() => setLoading(false));
    }, 300);
    return () => clearTimeout(t);
  }, [country, state, city, zip, category, q, pos, radiusKm, sort]);

  const activeFilterCount = useMemo(() => {
    let n = 0;
    if (state) n++;
    if (city) n++;
    if (zip) n++;
    if (category) n++;
    if (q) n++;
    if (radiusKm > 0) n++;
    return n;
  }, [state, city, zip, category, q, radiusKm]);

  return (
    <div>
      {/* Suchleiste + Filter */}
      <div style={{ marginBottom: 14 }}>
        <input
          value={q} onChange={(e) => setQ(e.target.value)}
          placeholder="Suche: Cappuccino, Pizza, Sportladen …"
          style={{
            width: "100%", padding: "11px 14px", borderRadius: 10,
            background: "#1A1D23", border: "1px solid rgba(255,255,255,0.12)",
            color: "#F0F0F0", fontSize: 14,
          }}
        />

        <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap", alignItems: "flex-end" }}>
          <Select value={country} onChange={setCountry} label="Land" options={[["DE","🇩🇪 DE"], ["AT","🇦🇹 AT"], ["CH","🇨🇭 CH"]]} />
          <Select value={category} onChange={setCategory} label="Kategorie" options={CATEGORIES.map((c) => [c, c || "Alle"])} />
          <Select value={String(radiusKm)} onChange={(v) => setRadiusKm(Number(v))}
            label="Radius"
            options={[["0", pos ? "beliebig" : "beliebig (GPS aus)"], ["1","1 km"], ["3","3 km"], ["5","5 km"], ["10","10 km"], ["25","25 km"]]}
            disabled={!pos && radiusKm === 0}
          />
          <Select value={sort} onChange={(v) => setSort(v as typeof sort)}
            label="Sortierung"
            options={[
              ["distance", pos ? "Nächste zuerst" : "Nächste zuerst (GPS aus)"],
              ["price_asc", "🪙 günstig zuerst"],
              ["popular", "🔥 beliebt"],
              ["newest", "neu"],
            ]}
          />
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginTop: 8 }}>
          <input value={city} onChange={(e) => setCity(e.target.value)} placeholder="Stadt" style={INP} />
          <input value={zip} onChange={(e) => setZip(e.target.value)} placeholder="PLZ" style={INP} maxLength={5} />
          <input value={state} onChange={(e) => setState(e.target.value)} placeholder="Bundesland" style={INP} />
        </div>

        {activeFilterCount > 0 && (
          <div style={{ marginTop: 8, display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 11, color: "#a8b4cf" }}>{activeFilterCount} Filter aktiv</span>
            <button onClick={() => { setState(""); setCity(""); setZip(""); setCategory(""); setQ(""); setRadiusKm(0); }}
              style={{
                padding: "4px 10px", borderRadius: 8,
                background: "rgba(255,45,120,0.12)", border: "1px solid rgba(255,45,120,0.35)",
                color: "#FF2D78", fontSize: 11, fontWeight: 700, cursor: "pointer",
              }}>
              Zurücksetzen
            </button>
          </div>
        )}
      </div>

      {/* GPS-Aufforderung */}
      {!pos && !posAsked && (
        <div style={{
          padding: 12, marginBottom: 14, borderRadius: 10,
          background: "rgba(34,209,195,0.08)", border: "1px solid rgba(34,209,195,0.35)",
          display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap",
        }}>
          <div style={{ flex: 1, minWidth: 200, fontSize: 12, color: "#a8b4cf" }}>
            📍 <b style={{ color: "#FFF" }}>Nächste Deals finden?</b> Mit deinem Standort sortieren wir Deals nach Entfernung.
            Wir speichern deinen Standort nicht — er wird nur lokal für diese Seite verwendet.
          </div>
          <button onClick={requestLocation} style={{
            padding: "10px 16px", borderRadius: 10, border: "none",
            background: "#22D1C3", color: "#0F1115", fontWeight: 900, fontSize: 12, cursor: "pointer",
          }}>Standort erlauben</button>
        </div>
      )}
      {!pos && posAsked && (
        <div style={{
          padding: 10, marginBottom: 14, borderRadius: 10,
          background: "rgba(255,215,0,0.1)", border: "1px solid rgba(255,215,0,0.3)",
          color: "#FFD700", fontSize: 12,
        }}>
          💡 GPS aus — Radius-Filter und Entfernungs-Sortierung sind deaktiviert.
        </div>
      )}

      {/* Ergebnisse */}
      {loading && deals.length === 0 ? (
        <div style={{ padding: 40, textAlign: "center", color: "#8B8FA3" }}>Lade Deals…</div>
      ) : deals.length === 0 ? (
        <div style={{
          padding: 40, textAlign: "center",
          background: "#1A1D23", borderRadius: 14, border: "1px solid rgba(255,255,255,0.06)",
        }}>
          <div style={{ fontSize: 40, marginBottom: 8 }}>🔍</div>
          <div style={{ fontSize: 14, fontWeight: 900, color: "#FFF" }}>Keine Deals gefunden</div>
          <div style={{ fontSize: 12, color: "#a8b4cf", marginTop: 4 }}>
            Probier weniger Filter oder einen größeren Radius.
          </div>
        </div>
      ) : (
        <>
          <div style={{ fontSize: 11, color: "#8B8FA3", marginBottom: 10 }}>
            {deals.length} {deals.length === 1 ? "Deal" : "Deals"}
            {pos && radiusKm > 0 && ` im Umkreis von ${radiusKm} km`}
          </div>
          <div style={{ display: "grid", gap: 10 }}>
            {deals.map((d) => <DealCard key={d.deal_id} deal={d} />)}
          </div>
        </>
      )}
    </div>
  );
}

function Select({ value, onChange, label, options, disabled }: {
  value: string;
  onChange: (v: string) => void;
  label: string;
  options: [string, string][];
  disabled?: boolean;
}) {
  return (
    <label style={{ display: "flex", flexDirection: "column", gap: 3 }}>
      <span style={{ fontSize: 9, color: "#8B8FA3", fontWeight: 700, letterSpacing: 1 }}>{label.toUpperCase()}</span>
      <select value={value} onChange={(e) => onChange(e.target.value)} disabled={disabled} style={{
        padding: "7px 10px", borderRadius: 8,
        background: "#1A1D23", border: "1px solid rgba(255,255,255,0.1)",
        color: disabled ? "#6c7590" : "#F0F0F0", fontSize: 12,
        cursor: disabled ? "not-allowed" : "pointer",
      }}>
        {options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
      </select>
    </label>
  );
}

function DealCard({ deal }: { deal: DealRow }) {
  const distanceLabel = deal.distance_m == null
    ? null
    : deal.distance_m < 1000
      ? `${Math.round(deal.distance_m)} m`
      : `${(deal.distance_m / 1000).toFixed(1)} km`;
  return (
    <Link href={`/shop/${deal.shop_id}`} style={{
      display: "flex", gap: 12,
      padding: 14, borderRadius: 14,
      background: "#1A1D23", border: "1px solid rgba(255,255,255,0.06)",
      color: "#FFF", textDecoration: "none",
    }}>
      <div style={{
        width: 56, height: 56, borderRadius: 12, flexShrink: 0,
        background: deal.shop_logo_url ? `url(${deal.shop_logo_url}) center/cover` : "linear-gradient(135deg, #22D1C3, #5ddaf0)",
        display: "flex", alignItems: "center", justifyContent: "center",
        color: "#0F1115", fontSize: 24, fontWeight: 900,
      }}>
        {!deal.shop_logo_url && (deal.shop_name?.[0]?.toUpperCase() ?? "🏪")}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 8, flexWrap: "wrap" }}>
          <span style={{ fontSize: 14, fontWeight: 900 }}>{deal.shop_name}</span>
          {deal.shop_category && <span style={{ fontSize: 10, color: "#8B8FA3" }}>· {deal.shop_category}</span>}
        </div>
        <div style={{ fontSize: 13, fontWeight: 700, color: "#FFD700", marginTop: 2 }}>{deal.deal_title}</div>
        {deal.deal_description && (
          <div style={{ fontSize: 11, color: "#a8b4cf", marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {deal.deal_description}
          </div>
        )}
        <div style={{ display: "flex", gap: 10, marginTop: 6, flexWrap: "wrap", fontSize: 11, color: "#8B8FA3" }}>
          <span style={{ color: "#22D1C3", fontWeight: 700 }}>🪙 {deal.xp_cost.toLocaleString("de-DE")}</span>
          {deal.min_order_amount_cents && deal.min_order_amount_cents > 0 && (
            <span>ab {(deal.min_order_amount_cents / 100).toFixed(2).replace(".", ",")} €</span>
          )}
          <span>🔁 {FREQ[deal.frequency] ?? deal.frequency}</span>
          {distanceLabel && <span>📍 {distanceLabel}</span>}
          {deal.shop_city && !distanceLabel && <span>📍 {deal.shop_city}</span>}
          {(deal.redemption_count ?? 0) >= 20 && <span style={{ color: "#FF6B4A" }}>🔥 {deal.redemption_count} eingelöst</span>}
        </div>
      </div>
    </Link>
  );
}
