import { requireAdmin } from "@/lib/admin";
import { createClient } from "@/lib/supabase/server";
import { PageTitle } from "../_components/ui";
import { RefundsClient } from "./refunds-client";

export const dynamic = "force-dynamic";

export default async function RefundsPage() {
  await requireAdmin();
  const sb = await createClient();
  const { data: rows } = await sb.from("refund_requests")
    .select("id, user_id, amount_cents, currency, reason, external_ref, status, decision_at, decision_note, created_at, user:users!refund_requests_user_id_fkey(username, display_name, email)")
    .order("created_at", { ascending: false }).limit(200);

  return (
    <>
      <PageTitle title="💰 Refund-Anfragen" subtitle="Erstattungen verwalten und entscheiden" />
      <RefundsClient initial={(rows ?? []) as unknown as RefundRow[]} />
    </>
  );
}

export type RefundRow = {
  id: string;
  user_id: string;
  amount_cents: number;
  currency: string;
  reason: string;
  external_ref: string | null;
  status: "pending" | "approved" | "rejected" | "processed";
  decision_at: string | null;
  decision_note: string | null;
  created_at: string;
  user: { username: string | null; display_name: string | null; email: string | null } | null;
};
