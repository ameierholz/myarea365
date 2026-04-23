import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/shop/my
 * Liefert die Shops, deren Owner der eingeloggte User ist.
 */
export async function GET() {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ shops: [] });

  const { data: shops } = await sb.from("local_businesses")
    .select("id, name, category, address, city, status, plan, plan_expires_at, logo_url, spotlight_until, flash_push_credits, total_checkins, total_redemptions, rejection_reason, submitted_at, approved_at")
    .eq("owner_id", user.id)
    .order("created_at", { ascending: false });

  return NextResponse.json({ shops: shops ?? [] });
}
