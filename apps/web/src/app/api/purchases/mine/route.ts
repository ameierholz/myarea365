import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/purchases/mine
 * Letzte Käufe des eingeloggten Runners — vor allem um offene
 * Zahlungen (SEPA/Banküberweisung/ACH) anzuzeigen.
 */
export async function GET() {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ purchases: [] });

  const { data } = await sb.from("purchases")
    .select("id, sku, status, created_at")
    .eq("user_id", user.id)
    .in("status", ["pending_payment", "failed"])
    .order("created_at", { ascending: false })
    .limit(5);

  return NextResponse.json({ purchases: data ?? [] });
}
