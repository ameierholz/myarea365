import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/guardian/claim-starter
 * Body: { archetype_id }
 * Nur Elite-Archetypen dürfen als Starter gewählt werden.
 */
export async function POST(req: Request) {
  const sb = await createClient();
  const { data: auth } = await sb.auth.getUser();
  if (!auth?.user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = await req.json() as { archetype_id: string };
  if (!body.archetype_id) return NextResponse.json({ error: "archetype_id_missing" }, { status: 400 });

  const { data, error } = await sb.rpc("claim_starter_guardian", { p_archetype_id: body.archetype_id });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
