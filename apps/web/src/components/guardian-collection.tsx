"use client";

// Profil-Collection-Panel — CoD-Rework-Version
// Zeigt owned crew_guardians + alle 60 guardian_archetypes (nicht die alten Rassen).

import { useEffect, useState, useCallback } from "react";
import { useTranslations } from "next-intl";
import { GuardianAvatar } from "@/components/guardian-avatar";
import { GuardianDetailModal } from "@/components/guardian-detail-modal";
import { GemShopModal } from "@/components/gem-shop-modal";
import { GuardianGalleryModal } from "@/components/guardian-gallery-modal";
import { createClient } from "@/lib/supabase/client";
import {
  rarityMeta, TYPE_META,
  type GuardianArchetype, type AnyRarity, type GuardianType, type GuardianRole,
} from "@/lib/guardian";

type OwnedGuardian = {
  id: string;
  archetype_id: string;
  custom_name: string | null;
  level: number;
  xp: number;
  wins: number;
  losses: number;
  is_active: boolean;
  talent_points_available: number;
  acquired_at: string;
  archetype: GuardianArchetype;
};

type CollectionResponse = {
  owned: OwnedGuardian[];
  archetypes: GuardianArchetype[];
  active_id: string | null;
};

export function GuardianCollectionPanel({ onChange }: { onChange?: () => void }) {
  const tGC = useTranslations("GuardianCollection");
  const [col, setCol] = useState<CollectionResponse | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [shopOpen, setShopOpen] = useState(false);
  const [galleryOpen, setGalleryOpen] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    (async () => {
      const sb = createClient();
      const { data: auth } = await sb.auth.getUser();
      if (!auth?.user) return;
      const { data } = await sb.from("users").select("role").eq("id", auth.user.id).maybeSingle<{ role: string | null }>();
      if (data?.role && ["admin", "super_admin"].includes(data.role)) setIsAdmin(true);
    })();
  }, []);

  const load = useCallback(async () => {
    const res = await fetch("/api/guardian/my-collection");
    if (res.ok) setCol(await res.json() as CollectionResponse);
  }, []);
  useEffect(() => { load(); }, [load]);

  async function activate(guardianId: string) {
    setBusy(true); setErr(null);
    try {
      const res = await fetch("/api/guardian/my-collection", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "activate", guardian_id: guardianId }),
      });
      const json = await res.json() as { ok?: boolean; error?: string };
      if (!json.ok && json.error) setErr(json.error);
      else { await load(); onChange?.(); }
    } finally { setBusy(false); }
  }

  async function claimStarter(archetypeId: string) {
    setBusy(true); setErr(null);
    try {
      const res = await fetch("/api/guardian/claim-starter", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ archetype_id: archetypeId }),
      });
      const json = await res.json() as { ok?: boolean; error?: string };
      if (!json.ok && json.error) setErr(json.error);
      else { await load(); onChange?.(); }
    } finally { setBusy(false); }
  }

  if (!col) return <div style={{ padding: 20, textAlign: "center", color: "#8B8FA3", fontSize: 12 }}>{tGC("loading")}</div>;

  const ownedIds = new Set(col.owned.map((g) => g.archetype_id));
  const unowned = col.archetypes.filter((a) => !ownedIds.has(a.id));

  return (
    <div>
      {/* Header: Sammel-Status */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "10px 14px", borderRadius: 12,
        background: "linear-gradient(135deg, rgba(34,209,195,0.15), rgba(255,45,120,0.08))",
        border: "1px solid rgba(34,209,195,0.3)", marginBottom: 12,
      }}>
        <div>
          <div style={{ color: "#FFF", fontSize: 13, fontWeight: 900 }}>
            {tGC("headerTitle", { owned: col.owned.length, total: col.archetypes.length })}
          </div>
          <div style={{ color: "#a8b4cf", fontSize: 10, marginTop: 1 }}>
            {tGC("headerHint")}
          </div>
        </div>
        <button onClick={() => setShopOpen(true)} style={{
          display: "flex", alignItems: "center", gap: 4,
          padding: "6px 10px", borderRadius: 999,
          background: "rgba(255,215,0,0.15)", border: "1px solid rgba(255,215,0,0.5)",
          color: "#FFD700", fontSize: 11, fontWeight: 900, cursor: "pointer",
        }}>{tGC("shopBtn")}</button>
      </div>

      {/* Starter-Wahl wenn User noch keinen Wächter hat */}
      {col.owned.length === 0 && (
        <div style={{
          padding: 12, borderRadius: 12, marginBottom: 12,
          background: "linear-gradient(135deg, rgba(34,209,195,0.18), rgba(255,45,120,0.1))",
          border: "1px solid rgba(34,209,195,0.4)",
        }}>
          <div style={{ color: "#22D1C3", fontSize: 10, fontWeight: 900, letterSpacing: 1.5 }}>{tGC("starterKicker")}</div>
          <div style={{ color: "#FFF", fontSize: 12, marginTop: 3, marginBottom: 10 }}>
            {tGC("starterIntro")}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(130px, 1fr))", gap: 6 }}>
            {col.archetypes.filter((a) => a.rarity === "elite").map((a) => {
              const typ = a.guardian_type ? TYPE_META[a.guardian_type] : null;
              return (
                <button key={a.id} onClick={() => claimStarter(a.id)} disabled={busy}
                  title={a.lore || a.ability_name || ""}
                  style={{
                    padding: 8, borderRadius: 10, textAlign: "left",
                    background: "rgba(15,17,21,0.6)", border: "1px solid rgba(34,209,195,0.3)",
                    color: "#FFF", cursor: busy ? "not-allowed" : "pointer",
                  }}>
                  <div style={{ width: "100%", aspectRatio: "1 / 1", display: "flex", justifyContent: "center", marginBottom: 4 }}>
                    <GuardianAvatar archetype={a} size={72} animation="idle" />
                  </div>
                  <div style={{ color: typ?.color ?? "#22D1C3", fontSize: 8, fontWeight: 900 }}>
                    {typ ? tGC("starterTypeLabel", { icon: typ.icon, label: typ.label.toUpperCase() }) : tGC("starterEliteFallback")}
                  </div>
                  <div style={{ fontSize: 11, fontWeight: 900, marginTop: 1 }}>{a.name}</div>
                  <div style={{ color: "#FFD700", fontSize: 9, marginTop: 1 }}>⚡ {a.ability_name}</div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Besessene Wächter */}
      <div style={{ color: "#8B8FA3", fontSize: 10, fontWeight: 800, letterSpacing: 0.8, marginBottom: 6 }}>
        {tGC("myGuardians", { count: col.owned.length })}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: 8, marginBottom: 16 }}>
        {col.owned.map((g) => {
          const r = rarityMeta(g.archetype.rarity);
          const typ = g.archetype.guardian_type ? TYPE_META[g.archetype.guardian_type] : null;
          return (
            <div key={g.id} style={{
              padding: 10, borderRadius: 12,
              background: g.is_active ? `linear-gradient(135deg, ${r.glow}, rgba(15,17,21,0.7))` : "rgba(70,82,122,0.18)",
              border: `1px solid ${g.is_active ? r.color : "rgba(255,255,255,0.08)"}`,
              boxShadow: g.is_active ? `0 0 14px ${r.glow}` : "none",
              position: "relative",
            }}>
              {g.is_active && (
                <div style={{
                  position: "absolute", top: 6, right: 6,
                  padding: "2px 7px", borderRadius: 999,
                  background: r.color, color: "#0F1115", fontSize: 8, fontWeight: 900, letterSpacing: 0.5,
                }}>{tGC("active")}</div>
              )}
              {g.talent_points_available > 0 && (
                <div style={{
                  position: "absolute", top: 6, left: 6,
                  padding: "2px 6px", borderRadius: 999,
                  background: "#FFD700", color: "#0F1115", fontSize: 8, fontWeight: 900,
                }}>+{g.talent_points_available}</div>
              )}

              <div style={{ width: "100%", aspectRatio: "1 / 1", display: "flex", justifyContent: "center", marginBottom: 4 }}>
                <GuardianAvatar archetype={g.archetype} size={100} animation="idle" />
              </div>

              <div style={{ color: r.color, fontSize: 8, fontWeight: 900, letterSpacing: 1 }}>
                {r.label.toUpperCase()}{typ ? ` · ${typ.icon}` : ""}
              </div>
              <div style={{ color: "#FFF", fontSize: 12, fontWeight: 900, marginTop: 1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                {g.custom_name ?? g.archetype.name}
              </div>
              <div style={{ color: "#a8b4cf", fontSize: 10, marginTop: 1 }}>
                {tGC("lvlWl", { level: g.level, wins: g.wins, losses: g.losses })}
              </div>

              <div style={{ display: "flex", gap: 4, marginTop: 6 }}>
                <button onClick={() => setDetailId(g.id)} style={{
                  flex: 1, padding: "4px 6px", borderRadius: 6,
                  background: "rgba(255,255,255,0.08)", border: "none", cursor: "pointer",
                  color: "#FFF", fontSize: 9, fontWeight: 900, textAlign: "center",
                }}>{tGC("open")}</button>
                {!g.is_active && (
                  <button onClick={() => activate(g.id)} disabled={busy}
                    style={{
                      flex: 1, padding: "4px 6px", borderRadius: 6,
                      background: `${r.color}33`, border: `1px solid ${r.color}`, color: r.color,
                      fontSize: 9, fontWeight: 900, cursor: busy ? "not-allowed" : "pointer",
                    }}>
                    {tGC("activate")}
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Noch nicht gesammelt — als Button, Modal mit Tabs */}
      {unowned.length > 0 && (
        <button onClick={() => setGalleryOpen(true)} style={{
          width: "100%", padding: "12px 14px", borderRadius: 12,
          background: "linear-gradient(135deg, rgba(34,209,195,0.18), rgba(255,45,120,0.08))",
          border: "1px solid rgba(34,209,195,0.4)",
          color: "#FFF", cursor: "pointer",
          display: "flex", alignItems: "center", gap: 10, textAlign: "left",
        }}>
          <span style={{ fontSize: 24 }}>📖</span>
          <div style={{ flex: 1 }}>
            <div style={{ color: "#22D1C3", fontSize: 10, fontWeight: 900, letterSpacing: 1.5 }}>
              {tGC("uncollectedKicker", { owned: unowned.length, total: col.archetypes.length })}
            </div>
            <div style={{ color: "#FFF", fontSize: 13, fontWeight: 900, marginTop: 2 }}>
              {tGC("viewAll")}
            </div>
            <div style={{ color: "#a8b4cf", fontSize: 10, marginTop: 1 }}>
              {isAdmin ? tGC("viewAllHintAdmin") : tGC("viewAllHint")}
            </div>
          </div>
          <span style={{ color: "#22D1C3", fontSize: 18 }}>→</span>
        </button>
      )}

      {err && (
        <div style={{
          marginTop: 10, padding: 8, borderRadius: 8,
          background: "rgba(255,45,120,0.1)", border: "1px solid rgba(255,45,120,0.4)",
          color: "#FF6BA1", fontSize: 11,
        }}>{err}</div>
      )}

      {detailId && <GuardianDetailModal guardianId={detailId} onClose={() => setDetailId(null)} />}
      {shopOpen && <GemShopModal onClose={() => setShopOpen(false)} />}
      {galleryOpen && (
        <GuardianGalleryModal
          archetypes={col.archetypes}
          ownedIds={ownedIds}
          onClose={() => setGalleryOpen(false)}
          isAdmin={isAdmin}
          onImageUploaded={() => load()}
        />
      )}
    </div>
  );
}
