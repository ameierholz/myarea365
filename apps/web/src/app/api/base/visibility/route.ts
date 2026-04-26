import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/base/visibility
 * Body: { visibility: "public" | "crew" | "private" }
 */
export async function POST(req: Request) {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: "not_authenticated" }, { status: 401 });

  const body = (await req.json()) as { visibility?: string };
  if (!body.visibility || !["public", "crew", "private"].includes(body.visibility)) {
    return NextResponse.json({ error: "invalid_visibility" }, { status: 400 });
  }

  const { data, error } = await sb.rpc("set_base_visibility", { p_visibility: body.visibility });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
