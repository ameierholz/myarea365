import { requireAdmin } from "@/lib/admin";
import { createClient } from "@/lib/supabase/server";
import { PageTitle } from "../_components/ui";
import { EventsClient } from "./events-client";

export const dynamic = "force-dynamic";

export default async function EventsPage() {
  await requireAdmin();
  const sb = await createClient();
  const { data: rows } = await sb.from("bulk_event_triggers")
    .select("id, event_kind, payload, starts_at, ends_at, notify_users, notify_text, status, created_at")
    .order("starts_at", { ascending: false }).limit(100);
  return (
    <>
      <PageTitle title="🎉 Event-Trigger" subtitle="Manuelle Events: Double-XP, Hunt-Reset, Crown-Drop, Turf-Krieg, Custom" />
      <EventsClient initial={(rows ?? []) as EventRow[]} />
    </>
  );
}

export type EventRow = {
  id: string;
  event_kind: string;
  payload: Record<string, unknown>;
  starts_at: string;
  ends_at: string | null;
  notify_users: boolean;
  notify_text: string | null;
  status: "scheduled" | "active" | "ended" | "cancelled";
  created_at: string;
};
