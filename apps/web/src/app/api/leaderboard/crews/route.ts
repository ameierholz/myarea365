import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const revalidate = 60;

/**
 * GET /api/leaderboard/crews
 * Top Crews nach XP, Member-Count und aktuellen Arena-Punkten.
 */
export async function GET() {
  const sb = await createClient();

  const { data: topCrews } = await sb.from("crews")
    .select("id, name, color, custom_emblem_url, total_xp, member_count, territory_count")
    .order("total_xp", { ascending: false, nullsFirst: false })
    .limit(30);

  return NextResponse.json({ crews: topCrews ?? [] });
}
