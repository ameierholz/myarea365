"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "../../_components/ui";
import { appAlert, appConfirm } from "@/components/app-dialog";

export function CrewActions({ crewId }: { crewId: string }) {
  const router = useRouter();
  const sb = createClient();
  const [pending, start] = useTransition();

  async function act(action: string, fn: () => Promise<void>) {
    start(async () => {
      await fn();
      await sb.from("admin_audit_log").insert({ action, target_type: "group", target_id: crewId });
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-2">
      <Button variant="secondary" onClick={() => act("group.privacy_public", async () => {
        await sb.from("crews").update({ privacy: "public" }).eq("id", crewId);
      })} disabled={pending}>🌍 Öffentlich machen</Button>
      <Button variant="secondary" onClick={() => act("group.privacy_private", async () => {
        await sb.from("crews").update({ privacy: "private" }).eq("id", crewId);
      })} disabled={pending}>🔒 Privat setzen</Button>

      <div className="my-2 pt-3 border-t border-[#FF2D78]/30">
        <div className="text-[10px] font-bold tracking-wider text-[#FF2D78] mb-2">⚠️ DANGER-ZONE</div>
      </div>

      <Button variant="danger" onClick={async () => {
        if (!(await appConfirm({ message: "Alle Mitglieder (außer Owner) entfernen? Crew bleibt bestehen.", danger: true, confirmLabel: "Entfernen" }))) return;
        act("group.kick_all_non_owners", async () => {
          await sb.from("crew_members").delete().eq("crew_id", crewId).neq("role", "owner");
        });
      }} disabled={pending}>👢 Alle außer Owner kicken</Button>

      <Button variant="danger" onClick={async () => {
        if (!(await appConfirm({ message: "Crew in Quarantäne setzen? Sie ist nicht mehr im Leaderboard, kann keine neuen Mitglieder werben und keine Wegelager angreifen, bleibt aber bestehen.", danger: true, confirmLabel: "Quarantäne" }))) return;
        act("group.quarantine", async () => {
          await sb.from("crews").update({ quarantined_at: new Date().toISOString() } as Record<string, unknown>).eq("id", crewId);
        });
      }} disabled={pending}>🚧 Quarantäne (Soft-Mod)</Button>

      <Button variant="danger" onClick={async () => {
        if (!(await appConfirm({ message: "Crew-Stats zurücksetzen (Power, Wins, Territory-Score)? Mitglieder bleiben.", danger: true, confirmLabel: "Zurücksetzen" }))) return;
        act("group.reset_stats", async () => {
          await sb.from("crews").update({ total_power: 0, total_wins: 0, territory_score: 0 } as Record<string, unknown>).eq("id", crewId);
        });
      }} disabled={pending}>↺ Stats zurücksetzen</Button>

      <Button variant="danger" onClick={async () => {
        if (!(await appConfirm({ message: "Crew WIRKLICH komplett auflösen? Alle Mitgliedschaften werden entfernt und die Crew gelöscht. NICHT umkehrbar.", danger: true, confirmLabel: "Endgültig löschen" }))) return;
        const second = prompt('Tippe "AUFLÖSEN" zur Bestätigung:');
        if (second !== "AUFLÖSEN") { appAlert("Abgebrochen — falsche Eingabe."); return; }
        act("group.delete", async () => {
          await sb.from("crew_members").delete().eq("crew_id", crewId);
          await sb.from("crews").delete().eq("id", crewId);
          router.push("/admin/crews");
        });
      }} disabled={pending}>🗑 Crew endgültig löschen</Button>
    </div>
  );
}
