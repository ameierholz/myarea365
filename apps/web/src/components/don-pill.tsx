"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

const GOLD = "#FFD700";

type Don = {
  city_slug: string;
  user_id: string;
  crew_id: string;
  took_office_at: string;
  total_terms: number;
  don_name: string;
  crew_name: string | null;
  crew_tag: string | null;
  crew_color: string;
};

/**
 * Kompakte Don-Pill: zeigt aktuellen Don der Stadt des Spielers.
 * Wenn ich selbst Don bin: Crown-Highlight. Sonst: Don-Name + "vom Throne stoßen"-Hint.
 * Click öffnet ein kleines Detail-Modal.
 */
export function DonPill({ onOpenThrone }: { onOpenThrone?: () => void }) {
  const [don, setDon] = useState<Don | null>(null);
  const [city, setCity] = useState<string | null>(null);
  const [meIsDon, setMeIsDon] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    void (async () => {
      const sb = createClient();
      const { data } = await sb.rpc("get_my_city_don");
      const r = data as { ok?: boolean; don?: Don | null; city_slug?: string } | null;
      if (!r?.ok) return;
      setCity(r.city_slug ?? null);
      setDon(r.don ?? null);
      const { data: { user } } = await sb.auth.getUser();
      if (user && r.don?.user_id === user.id) setMeIsDon(true);
    })();
  }, []);

  if (!city) return null;

  const cityLabel = city.charAt(0).toUpperCase() + city.slice(1);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        style={{
          display: "inline-flex", alignItems: "center", gap: 6,
          padding: "5px 10px", borderRadius: 999,
          background: meIsDon ? `linear-gradient(135deg, ${GOLD}, #E6A700)` : "rgba(15,17,21,0.85)",
          border: meIsDon ? `1px solid ${GOLD}` : `1px solid ${GOLD}55`,
          color: meIsDon ? "#0F1115" : "#FFF",
          fontSize: 11, fontWeight: 800, letterSpacing: 0.3,
          cursor: "pointer",
          boxShadow: meIsDon ? `0 0 12px ${GOLD}88` : "none",
        }}
        title="Don der Stadt"
      >
        <span style={{ fontSize: 13 }}>👑</span>
        {don ? (
          <>
            <span style={{ fontWeight: 900 }}>{don.crew_tag || "—"}</span>
            <span style={{ opacity: 0.85 }}>· {don.don_name}</span>
          </>
        ) : (
          <span style={{ color: "#8B8FA3" }}>Throne frei · {cityLabel}</span>
        )}
      </button>

      {open && (
        <div
          onClick={() => setOpen(false)}
          style={{
            position: "fixed", inset: 0, zIndex: 9300,
            background: "rgba(8,10,14,0.78)", backdropFilter: "blur(6px)",
            display: "flex", alignItems: "center", justifyContent: "center", padding: 12,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: "100%", maxWidth: 440,
              background: "rgba(15,17,21,0.97)",
              border: `1px solid ${GOLD}55`,
              borderRadius: 16,
              boxShadow: `0 16px 48px rgba(0,0,0,0.7), 0 0 32px ${GOLD}33`,
              overflow: "hidden",
            }}
          >
            <div style={{
              padding: "20px 16px 16px", textAlign: "center",
              background: `radial-gradient(ellipse at 50% 0%, ${GOLD}55 0%, transparent 70%), linear-gradient(180deg, rgba(20,22,28,0.85), rgba(15,17,21,0.95))`,
              borderBottom: `1px solid ${GOLD}33`,
            }}>
              <div style={{ fontSize: 56, lineHeight: 1, filter: `drop-shadow(0 0 16px ${GOLD}88)` }}>👑</div>
              <div style={{ color: "#FFF", fontSize: 22, fontWeight: 400, fontFamily: "var(--font-display-stack)", letterSpacing: 0.6, marginTop: 4 }}>
                Don von {cityLabel}
              </div>
              <div style={{ color: GOLD, fontSize: 10, fontWeight: 900, letterSpacing: 1.2, textTransform: "uppercase", marginTop: 2 }}>
                Throne-Status
              </div>
            </div>
            <div style={{ padding: "16px 18px", display: "flex", flexDirection: "column", gap: 12 }}>
              {don ? (
                <div style={{ padding: 14, borderRadius: 12, background: `${don.crew_color}1a`, border: `1px solid ${don.crew_color}55` }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <span style={{
                      padding: "4px 8px", borderRadius: 6, background: `${don.crew_color}33`,
                      color: don.crew_color, fontSize: 11, fontWeight: 900, letterSpacing: 0.5,
                    }}>{don.crew_tag}</span>
                    <span style={{ color: "#FFF", fontSize: 14, fontWeight: 800 }}>{don.crew_name}</span>
                  </div>
                  <div style={{ marginTop: 8, color: "#FFF", fontSize: 13 }}>
                    <b>{don.don_name}</b>
                  </div>
                  <div style={{ color: "#8B8FA3", fontSize: 11, marginTop: 4 }}>
                    Im Amt seit {new Date(don.took_office_at).toLocaleDateString("de-DE")}
                    {don.total_terms > 1 && ` · ${don.total_terms} Terms`}
                  </div>
                  {meIsDon && (
                    <div style={{
                      marginTop: 10, padding: 8, borderRadius: 8,
                      background: `${GOLD}22`, color: GOLD,
                      fontSize: 11, fontWeight: 800, textAlign: "center",
                    }}>
                      Du bist der Don. +5% all-stats für deine Crew aktiv.
                    </div>
                  )}
                </div>
              ) : (
                <div style={{ padding: 14, borderRadius: 12, background: "rgba(255,255,255,0.04)", textAlign: "center", color: "#8B8FA3" }}>
                  Niemand hat den Throne von {cityLabel} erobert. Greift das Throne-Stronghold im Stadtzentrum an um Don zu werden.
                </div>
              )}

              <div style={{ padding: 12, borderRadius: 10, background: "rgba(255,255,255,0.03)", color: "#a8b4cf", fontSize: 11, lineHeight: 1.5 }}>
                <div style={{ color: GOLD, fontWeight: 900, fontSize: 10, letterSpacing: 0.6, textTransform: "uppercase", marginBottom: 6 }}>
                  So funktioniert der Throne
                </div>
                Im Zentrum jeder Stadt steht ein Throne-Stronghold (👑). Die Crew die es zerstört, deren Anführer wird automatisch Don. Das Stronghold respawnt sofort — wer es als Nächstes besiegt, übernimmt. <b>Kein Auto-Reset</b>: ein Don bleibt im Amt bis er entthront wird.
              </div>

              {onOpenThrone && (
                <button
                  onClick={() => { setOpen(false); onOpenThrone(); }}
                  style={{
                    width: "100%", padding: "10px 14px", borderRadius: 10,
                    background: `linear-gradient(135deg, ${GOLD}, #E6A700)`,
                    border: "none", color: "#0F1115",
                    fontWeight: 900, fontSize: 12, letterSpacing: 0.5, textTransform: "uppercase",
                    fontFamily: "var(--font-display-stack)",
                    cursor: "pointer",
                  }}
                >
                  ⚔ Throne anvisieren
                </button>
              )}

              <button
                onClick={() => setOpen(false)}
                style={{
                  width: "100%", padding: "8px 12px", borderRadius: 8,
                  background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.15)",
                  color: "#FFF", fontSize: 11, fontWeight: 800, cursor: "pointer",
                }}
              >Schließen</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
