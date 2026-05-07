import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/me/stats — kompletter Counter-Dump des aktuellen Users.
 * Wird vom Statistik-Modal im Profil-Dashboard aufgerufen.
 */
export async function GET() {
  const sb = await createClient();
  const { data: auth } = await sb.auth.getUser();
  if (!auth?.user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  // Row sicherstellen (idempotent insert) — vermeidet leere Response wenn noch nie inkrementiert
  await sb.from("user_stats").insert({ user_id: auth.user.id }).select().maybeSingle();

  const { data, error } = await sb
    .from("user_stats")
    .select("*")
    .eq("user_id", auth.user.id)
    .maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ stats: data ?? {} });
}
