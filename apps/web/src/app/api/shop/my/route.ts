import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/shop/my
 * Liefert die Shops, deren Owner der eingeloggte User ist —
 * mit allen Feldern, die das Shop-Dashboard/Settings-Panel braucht.
 */
export async function GET() {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ shops: [] });

  const { data: shops } = await sb.from("local_businesses")
    .select(`
      id, name, slug, category, description, address, street,
      city, zip, state, country,
      contact_email, contact_phone, website,
      logo_url, cover_url,
      status, plan, plan_expires_at,
      spotlight_until, flash_push_credits, event_host_credits,
      challenge_sponsor_credits, email_campaign_credits,
      total_checkins, total_redemptions,
      rejection_reason, submitted_at, approved_at,
      opening_hours, paused_at, active,
      created_at
    `)
    .eq("owner_id", user.id)
    .order("created_at", { ascending: false });

  return NextResponse.json({ shops: shops ?? [] });
}
