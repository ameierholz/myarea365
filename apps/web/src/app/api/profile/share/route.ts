import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const REWARD = 50;

/**
 * POST /api/profile/share — vergibt einmalig +50 Wegemünzen, wenn der User
 * sein Profil noch nie geteilt hat. Wird vom Profil-„Teilen"-Button nach
 * erfolgreichem Share/Copy aufgerufen. Idempotent über users.profile_shared_at.
 */
export async function POST() {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ ok: false, error: "Nicht eingeloggt" }, { status: 401 });

  const { data: row } = await sb.from("users")
    .select("wegemuenzen, profile_shared_at")
    .eq("id", user.id)
    .maybeSingle<{ wegemuenzen: number | null; profile_shared_at: string | null }>();

  if (row?.profile_shared_at) {
    return NextResponse.json({ ok: true, awarded: 0, already_claimed: true });
  }

  const { error } = await sb.from("users")
    .update({
      wegemuenzen: (row?.wegemuenzen ?? 0) + REWARD,
      profile_shared_at: new Date().toISOString(),
    })
    .eq("id", user.id)
    .is("profile_shared_at", null); // Race-safe: zweiter Concurrent-Call schreibt 0 Rows

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, awarded: REWARD });
}
