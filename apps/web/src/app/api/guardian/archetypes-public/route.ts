import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/guardian/archetypes-public?ids=eisenhand,schrotthaendler
 * Öffentliche Artwork-URLs für Archetypes — z. B. für Demo-Daten im Leaderboard.
 */
export async function GET(req: NextRequest) {
  const sb = await createClient();
  const url = new URL(req.url);
  const idsParam = url.searchParams.get("ids") ?? "";
  const ids = idsParam.split(",").map((s) => s.trim()).filter(Boolean);
  if (ids.length === 0) return NextResponse.json({ archetypes: [] });
  const { data } = await sb.from("guardian_archetypes")
    .select("id, name, emoji, image_url, video_url")
    .in("id", ids);
  return NextResponse.json({ archetypes: data ?? [] });
}
