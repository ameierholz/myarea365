import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/crew/feed?crew_id=...&limit=40 */
export async function GET(req: NextRequest) {
  const sb = await createClient();
  const url = new URL(req.url);
  const crewId = url.searchParams.get("crew_id");
  const limit = Math.min(80, Number(url.searchParams.get("limit") ?? 40));
  if (!crewId) return NextResponse.json({ error: "crew_id required" }, { status: 400 });

  const { data, error } = await sb.from("crew_feed")
    .select("id, kind, data, created_at, user:user_id(username, display_name, avatar_url)")
    .eq("crew_id", crewId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ feed: data ?? [] });
}
