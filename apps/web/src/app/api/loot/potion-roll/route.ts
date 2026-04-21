import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/loot/potion-roll
 * Wird beim Einsammeln einer Loot-Box aufgerufen.
 * Server rollt gewichtet: 30% common, 10% rare, 3% epic, 57% nichts.
 */
export async function POST() {
  const sb = await createClient();
  const { data: auth } = await sb.auth.getUser();
  if (!auth?.user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { data, error } = await sb.rpc("roll_loot_potion", { p_user_id: auth.user.id });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
