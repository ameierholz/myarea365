import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/base/walk-record
 * Body: { walk_id: string }
 * Voraussetzung: walks-Eintrag existiert + km_in_park/_residential/_commercial/_near_water sind gesetzt
 * (clientseitig via OSM-Tag-Lookup oder geo-Klassifizierung).
 */
export async function POST(req: Request) {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: "not_authenticated" }, { status: 401 });

  const body = await req.json() as { walk_id?: string };
  if (!body.walk_id) return NextResponse.json({ error: "missing_walk_id" }, { status: 400 });

  const { data, error } = await sb.rpc("record_walk_resources", { p_walk_id: body.walk_id });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
