"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "../../../_components/ui";
import { appAlert, appConfirm } from "@/components/app-dialog";

export function CampaignActions({ id, status, template }: { id: string; status: string; template: string }) {
  const router = useRouter();
  const sb = createClient();
  const [pending, start] = useTransition();

  function update(patch: Record<string, unknown>, action: string) {
    start(async () => {
      await sb.from("email_campaigns").update(patch).eq("id", id);
      await sb.from("admin_audit_log").insert({ action, target_type: "campaign", target_id: id, details: patch });
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-2">
      <Button variant="secondary" onClick={() => window.open(`/dev/emails/${template}`, "_blank")}>
        👁 Template-Preview
      </Button>
      {status === "draft" && (
        <Button variant="primary" onClick={() => update({ status: "scheduled" }, "campaign.schedule")} disabled={pending}>
          📤 Zum Versand freigeben
        </Button>
      )}
      {status === "scheduled" && (
        <>
          <Button variant="primary" onClick={async () => {
            if (!(await appConfirm("Kampagne jetzt versenden? Das kann nicht rückgängig gemacht werden."))) return;
            update({ status: "sending", sent_at: new Date().toISOString() }, "campaign.send");
            appAlert("Versand gestartet. Echter E-Mail-Versand läuft über Edge-Function (to-do).");
          }} disabled={pending}>
            🚀 Jetzt versenden
          </Button>
          <Button variant="secondary" onClick={() => update({ status: "draft" }, "campaign.unschedule")} disabled={pending}>
            ↩ Zurück in Entwurf
          </Button>
        </>
      )}
      {status !== "sent" && (
        <Button variant="danger" onClick={async () => {
          if (!(await appConfirm({ message: "Kampagne wirklich löschen?", danger: true }))) return;
          start(async () => {
            await sb.from("email_campaigns").delete().eq("id", id);
            await sb.from("admin_audit_log").insert({ action: "campaign.delete", target_type: "campaign", target_id: id });
            router.push("/admin/marketing/campaigns");
          });
        }} disabled={pending}>🗑 Löschen</Button>
      )}
    </div>
  );
}
