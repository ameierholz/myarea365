"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "../_components/ui";

export function ModerationActions({ reportId, currentStatus }: { reportId: string; currentStatus: string }) {
  const router = useRouter();
  const sb = createClient();
  const [pending, start] = useTransition();

  function resolve(status: "resolved" | "dismissed" | "reviewing") {
    const action = prompt(status === "dismissed" ? "Grund der Ablehnung?" : "Welche Maßnahme wurde getroffen?");
    if (status !== "reviewing" && !action) return;
    start(async () => {
      await sb.from("moderation_reports").update({
        status, action_taken: action, resolved_at: status === "reviewing" ? null : new Date().toISOString(),
      }).eq("id", reportId);
      await sb.from("admin_audit_log").insert({ action: `report.${status}`, target_type: "report", target_id: reportId, details: { action } });
      router.refresh();
    });
  }

  if (currentStatus !== "open" && currentStatus !== "reviewing") return null;

  return (
    <div className="flex gap-1">
      {currentStatus === "open" && <Button size="sm" variant="secondary" onClick={() => resolve("reviewing")} disabled={pending}>Prüfen</Button>}
      <Button size="sm" variant="primary" onClick={() => resolve("resolved")} disabled={pending}>✓ Gelöst</Button>
      <Button size="sm" variant="ghost" onClick={() => resolve("dismissed")} disabled={pending}>✗ Abgelehnt</Button>
    </div>
  );
}
