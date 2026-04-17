"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "../../_components/ui";

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
        await sb.from("groups").update({ privacy: "public" }).eq("id", crewId);
      })} disabled={pending}>🌍 Öffentlich machen</Button>
      <Button variant="secondary" onClick={() => act("group.privacy_private", async () => {
        await sb.from("groups").update({ privacy: "private" }).eq("id", crewId);
      })} disabled={pending}>🔒 Privat setzen</Button>
      <Button variant="danger" onClick={() => {
        if (!confirm("Crew wirklich auflösen? Alle Mitgliedschaften werden entfernt.")) return;
        act("group.delete", async () => {
          await sb.from("group_members").delete().eq("group_id", crewId);
          await sb.from("groups").delete().eq("id", crewId);
          router.push("/admin/crews");
        });
      }} disabled={pending}>🗑 Crew löschen</Button>
    </div>
  );
}
