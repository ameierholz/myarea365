import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** POST /api/chat/geo — Body: { plz, bezirk, city } → Auto-Join Heimat-Rooms */
export async function POST(req: NextRequest) {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: "not_authenticated" }, { status: 401 });
  const body = await req.json() as { plz?: string; bezirk?: string; city?: string };
  const { data, error } = await sb.rpc("chat_join_geo_rooms", {
    p_plz: body.plz ?? null, p_bezirk: body.bezirk ?? null, p_city: body.city ?? null,
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, ...(data as object) });
}
