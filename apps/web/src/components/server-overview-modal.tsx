"use client";

import { useCallback, useEffect, useState } from "react";
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
type TokenInfo = { tokens: number; cooldown_ends_at: string | null };

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
  const [tokens, setTokens] = useState<TokenInfo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const reload = useCallback(async () => {
    try {
      const [r, tr] = await Promise.all([
        fetch("/api/cities", { cache: "no-store" }),
        fetch("/api/me/migrate-server", { cache: "no-store" }),
      ]);
      const j = await r.json() as { servers?: Server[]; error?: string };
      if (!r.ok) throw new Error(j.error ?? "Fehler beim Laden");
      setServers(j.servers ?? []);
      const tj = await tr.json() as { ok?: boolean; tokens?: number; cooldown_ends_at?: string | null };
      setTokens({ tokens: tj.tokens ?? 0, cooldown_ends_at: tj.cooldown_ends_at ?? null });
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, []);

  useEffect(() => {
    if (!open) return;
    setError(null); setServers(null); setMsg(null);
    void reload();
  }, [open, reload]);

  async function migrate(slug: string, name: string) {
    if (!confirm(`Wirklich nach "${name}" wechseln?\n\nDeine Crew-Mitgliedschaft wird beendet, und es startet ein 7-Tage-Cooldown bis zum nächsten Wechsel.`)) return;
    setBusy(slug); setMsg(null);
    try {
      const r = await fetch("/api/me/migrate-server", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ target_city_slug: slug }),
      });
      const j = await r.json() as { ok?: boolean; error?: string; new_home_city_slug?: string };
      if (j.ok) { setMsg(`✓ Erfolgreich nach "${name}" migriert.`); await reload(); }
      else if (j.error === "no_token") setMsg("⚠ Kein Migration-Token verfügbar — verdiene eines durch Era-Reset oder kaufe im Shop.");
      else if (j.error === "cooldown_active") setMsg("⏳ Cooldown läuft noch. Warte bis er abgelaufen ist.");
      else if (j.error === "already_home") setMsg("ℹ Du bist schon dort.");
      else if (j.error === "city_not_active") setMsg("⚠ Server nicht aktiv.");
      else setMsg(`⚠ ${j.error ?? "Fehler"}`);
    } finally { setBusy(null); }
  }

  if (!open) return null;
  const cooldownActive = tokens?.cooldown_ends_at && new Date(tokens.cooldown_ends_at).getTime() > Date.now();
  const cooldownRemain = cooldownActive
    ? Math.ceil((new Date(tokens!.cooldown_ends_at!).getTime() - Date.now()) / (3600 * 1000))
    : 0;

  return (
    <Modal open={open} onClose={onClose} size="md" zIndex={Z.modalDeep} reserveLeftSpace={372}>
      <ModalHeader title="🏙️ STADT-SERVER" onClose={onClose} accent="primary" />
      <ModalBody padding="padded">
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {error && (
            <div style={{ padding: 12, borderRadius: 10, background: "rgba(255,107,74,0.1)", border: "1px solid rgba(255,107,74,0.3)", color: "#FF6B4A", fontSize: 12 }}>
              ❌ {error}
            </div>
          )}

          {/* Migration-Token-Status */}
          {tokens && (
            <div style={{
              padding: 10, borderRadius: 10,
              background: tokens.tokens > 0 ? "rgba(34,209,195,0.1)" : "rgba(255,255,255,0.04)",
              border: `1px solid ${tokens.tokens > 0 ? "rgba(34,209,195,0.3)" : "rgba(255,255,255,0.08)"}`,
              fontSize: 11, color: "#C8CDD9", display: "flex", alignItems: "center", gap: 8,
            }}>
              <span style={{ fontSize: 18 }}>🎟</span>
              <div style={{ flex: 1 }}>
                <div style={{ color: tokens.tokens > 0 ? PRIMARY : "#8B8FA3", fontWeight: 800 }}>
                  {tokens.tokens} Migration-Token
                </div>
                <div style={{ color: "#8B8FA3", fontSize: 10 }}>
                  {cooldownActive ? `Cooldown: noch ${cooldownRemain}h` : tokens.tokens > 0 ? "Bereit zum Wechseln" : "Verdiene eines durch Era-Reset oder Shop"}
                </div>
              </div>
            </div>
          )}

          {msg && (
            <div style={{
              padding: 10, borderRadius: 10,
              background: msg.startsWith("✓") ? "rgba(74,222,128,0.1)" : "rgba(255,107,74,0.1)",
              color: msg.startsWith("✓") ? "#4ade80" : "#FF6B4A",
              fontSize: 11, fontWeight: 700,
            }}>{msg}</div>
          )}

          {!servers && !error && (
            <div style={{ color: "#8B8FA3", fontSize: 12, textAlign: "center", padding: 24 }}>Lade Server…</div>
          )}

          {servers && servers.length === 0 && (
            <div style={{ color: "#8B8FA3", fontSize: 12, textAlign: "center", padding: 24 }}>
              Noch keine aktiven Server.
            </div>
          )}

          {servers && servers.map((s) => (
            <ServerCard key={s.slug} server={s}
              canMigrate={!s.is_home && (tokens?.tokens ?? 0) > 0 && !cooldownActive}
              busy={busy === s.slug}
              onMigrate={() => void migrate(s.slug, s.name)} />
          ))}
        </div>
      </ModalBody>
    </Modal>
  );
}

function ServerCard({ server, canMigrate, busy, onMigrate }: { server: Server; canMigrate: boolean; busy: boolean; onMigrate: () => void }) {
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

      {/* Wechsel-Button */}
      {!isHome && (
        <button
          onClick={onMigrate}
          disabled={!canMigrate || busy}
          title={canMigrate ? `Wechseln zu ${server.name}` : "Migration-Token + Cooldown abwarten"}
          style={{
            padding: "8px 12px", borderRadius: 8,
            background: canMigrate ? `linear-gradient(180deg, ${PRIMARY}, #1aa89c)` : "rgba(255,255,255,0.04)",
            border: `1px solid ${canMigrate ? PRIMARY : "rgba(255,255,255,0.1)"}`,
            color: canMigrate ? "#0F1115" : "#8B8FA3",
            fontSize: 11, fontWeight: 900, letterSpacing: 0.4,
            cursor: canMigrate ? "pointer" : "not-allowed", opacity: busy ? 0.5 : 1,
            alignSelf: "flex-start",
          }}
        >
          {busy ? "…" : canMigrate ? "🚀 Hierhin wechseln (1 Token)" : "🔒 Token / Cooldown"}
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
