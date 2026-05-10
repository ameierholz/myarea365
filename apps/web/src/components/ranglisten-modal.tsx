"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Modal, ModalHeader, ModalBody, Z } from "@/components/ui";
import type { Profile } from "@/app/karte/_tabs/_shared";

const RankingTab = dynamic(
  () => import("@/app/karte/_tabs/ranking-tab").then((m) => m.RankingTab),
  { ssr: false, loading: () => <RankingLoadingState /> },
);

/**
 * RanglistenModal — Standalone-Modal für die Rangliste-UI vom Base-Tile.
 * Wraps die existierende RankingTab in eine Modal-Shell. Zieht eigene
 * Profil- + Leaderboard-Daten beim Öffnen, damit das Modal autark läuft.
 */
export function RanglistenModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [leaderboard, setLeaderboard] = useState<Profile[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setError(null);
    void (async () => {
      try {
        const sb = createClient();
        const { data: { user } } = await sb.auth.getUser();
        if (!user) { if (!cancelled) setError("Nicht eingeloggt."); return; }
        const [me, board] = await Promise.all([
          sb.from("users").select("*").eq("id", user.id).maybeSingle(),
          sb.from("users")
            .select("id, username, display_name, xp, level, team_color")
            .order("xp", { ascending: false })
            .limit(20),
        ]);
        if (cancelled) return;
        setProfile((me.data ?? null) as Profile | null);
        setLeaderboard((board.data ?? []) as Profile[]);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e));
      }
    })();
    return () => { cancelled = true; };
  }, [open]);

  return (
    <Modal open={open} onClose={onClose} size="xl" zIndex={Z.modal} reserveLeftSpace={372}>
      <ModalHeader title="Ranglisten" onClose={onClose} accent="primary" />
      <ModalBody padding="flush">
        {error ? (
          <div style={{ padding: 24, color: "#FF6B4A", fontSize: 12, textAlign: "center" }}>
            ❌ {error}
          </div>
        ) : (
          <RankingTab profile={profile} leaderboard={leaderboard} />
        )}
      </ModalBody>
    </Modal>
  );
}

function RankingLoadingState() {
  return (
    <div style={{ padding: 24, color: "#a8b4cf", fontSize: 12, textAlign: "center" }}>
      Lade Ranglisten…
    </div>
  );
}
