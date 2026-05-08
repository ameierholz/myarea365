"use client";

import { useEffect, useState } from "react";
import { Modal, ModalHeader, ModalBody, Z } from "@/components/ui";

const PRIMARY = "#22D1C3";
const ACCENT = "#FF2D78";
const GOLD = "#FFD700";

type Server = {
  slug: string;
  name: string;
  country: string;
  opened_at: string;
  era: { number: number; started_at: string | null; days_running: number } | null;
  stats: { player_count: number; crew_count: number };
  top_crew: { id: string; name: string; members: number } | null;
  is_home: boolean;
};

/**
 * In-Game Server-Übersicht: zeigt alle aktiven Stadt-Server.
 * User sieht ihre Heimat (highlighted), kann andere Server inspizieren.
 *
 * Server-Wechsel ist Phase 2 — "Wechseln"-Button ist Placeholder, deaktiviert
 * mit "Coming soon"-Hint.
 *
 * Trigger: window.dispatchEvent(new CustomEvent("ma365:open-server-overview"))
 */
export function ServerOverviewModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [servers, setServers] = useState<Server[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setError(null);
    setServers(null);
    void (async () => {
      try {
        const r = await fetch("/api/cities", { cache: "no-store" });
        const j = await r.json() as { servers?: Server[]; error?: string };
        if (cancelled) return;
        if (!r.ok) throw new Error(j.error ?? "Fehler beim Laden");
        setServers(j.servers ?? []);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e));
      }
    })();
    return () => { cancelled = true; };
  }, [open]);

  if (!open) return null;

  return (
    <Modal open={open} onClose={onClose} size="md" zIndex={Z.modalDeep}>
      <ModalHeader title="🏙️ STADT-SERVER" onClose={onClose} accent="primary" />
      <ModalBody padding="padded">
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {error && (
            <div style={{ padding: 12, borderRadius: 10, background: "rgba(255,107,74,0.1)", border: "1px solid rgba(255,107,74,0.3)", color: "#FF6B4A", fontSize: 12 }}>
              ❌ {error}
            </div>
          )}

          {!servers && !error && (
            <div style={{ color: "#8B8FA3", fontSize: 12, textAlign: "center", padding: 24 }}>Lade Server…</div>
          )}

          {servers && servers.length === 0 && (
            <div style={{ color: "#8B8FA3", fontSize: 12, textAlign: "center", padding: 24 }}>
              Noch keine aktiven Server.
            </div>
          )}

          {servers && servers.map((s) => <ServerCard key={s.slug} server={s} />)}

          {/* Hinweis Server-Wechsel */}
          <div style={{
            marginTop: 8, padding: 12, borderRadius: 10,
            background: "rgba(255,215,0,0.06)",
            border: "1px solid rgba(255,215,0,0.25)",
            fontSize: 11, color: "#C8CDD9", lineHeight: 1.5,
          }}>
            <div style={{ color: GOLD, fontWeight: 800, marginBottom: 4 }}>🔄 Server-Wechsel kommt</div>
            Aktuell ist deine Heimat fest an deine PLZ gebunden. Server-Wechsel
            (mit Cooldown + Carry-Over-Regeln für Premium-Inhalte) ist in Planung.
          </div>
        </div>
      </ModalBody>
    </Modal>
  );
}

function ServerCard({ server }: { server: Server }) {
  const isHome = server.is_home;
  const accent = isHome ? PRIMARY : "rgba(255,255,255,0.12)";
  return (
    <div style={{
      padding: 12, borderRadius: 12,
      background: isHome
        ? `linear-gradient(135deg, ${PRIMARY}1f, ${PRIMARY}06)`
        : "rgba(255,255,255,0.03)",
      border: `1px solid ${accent}`,
      boxShadow: isHome ? `0 0 14px ${PRIMARY}33, inset 0 1px 0 rgba(255,255,255,0.06)` : "none",
      display: "flex", flexDirection: "column", gap: 8,
    }}>
      {/* Name + Heimat-Badge + Era */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
        <div style={{
          fontSize: 16, fontWeight: 900, color: "#F0F0F0",
          flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
        }}>
          {server.name}
          <span style={{ color: "#8B8FA3", fontSize: 10, fontWeight: 600, marginLeft: 6 }}>
            · {server.country}
          </span>
        </div>
        {isHome && (
          <span style={{
            fontSize: 9, fontWeight: 900, letterSpacing: 1.2,
            color: PRIMARY,
            padding: "2px 8px", borderRadius: 4,
            background: `${PRIMARY}1f`, border: `1px solid ${PRIMARY}66`,
          }}>HEIMAT</span>
        )}
        {server.era && (
          <span style={{
            fontSize: 10, fontWeight: 800, letterSpacing: 0.6,
            color: GOLD,
            padding: "2px 7px", borderRadius: 4,
            background: `${GOLD}1a`, border: `1px solid ${GOLD}55`,
          }}>ÄRA {server.era.number}</span>
        )}
      </div>

      {/* Stats-Zeile */}
      <div style={{
        display: "flex", gap: 14, flexWrap: "wrap",
        fontSize: 11, color: "#C8CDD9",
      }}>
        <Stat label="Spieler" value={server.stats.player_count} />
        <Stat label="Crews"   value={server.stats.crew_count} />
        {server.era && (
          <Stat label="läuft"  value={`${server.era.days_running}d`} />
        )}
      </div>

      {/* Top-Crew */}
      {server.top_crew && (
        <div style={{
          padding: "6px 8px", borderRadius: 8,
          background: "rgba(255,255,255,0.04)",
          fontSize: 11, color: "#C8CDD9",
          display: "flex", alignItems: "center", gap: 6,
        }}>
          <span style={{ fontSize: 14 }}>🥇</span>
          <span style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            <span style={{ color: "#8B8FA3" }}>Spitzen-Crew: </span>
            <span style={{ color: "#F0F0F0", fontWeight: 800 }}>{server.top_crew.name}</span>
          </span>
          <span style={{ color: "#8B8FA3", fontVariantNumeric: "tabular-nums" }}>
            {server.top_crew.members} Mitgl.
          </span>
        </div>
      )}

      {/* Wechsel-Button (deaktiviert in Phase 1) */}
      {!isHome && (
        <button
          disabled
          title="Server-Wechsel ist in Planung"
          style={{
            padding: "6px 10px", borderRadius: 8,
            background: "rgba(255,255,255,0.04)",
            border: "1px solid rgba(255,255,255,0.1)",
            color: "#8B8FA3", fontSize: 10, fontWeight: 700, letterSpacing: 0.4,
            cursor: "not-allowed", opacity: 0.7,
            alignSelf: "flex-start",
          }}
        >
          🔒 Wechseln (bald)
        </button>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number | string }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
      <span style={{ color: "#8B8FA3", fontSize: 9, letterSpacing: 0.6, fontWeight: 700, textTransform: "uppercase" }}>
        {label}
      </span>
      <span style={{ color: "#F0F0F0", fontWeight: 900, fontVariantNumeric: "tabular-nums" }}>
        {typeof value === "number" ? value.toLocaleString("de-DE") : value}
      </span>
    </span>
  );
}
