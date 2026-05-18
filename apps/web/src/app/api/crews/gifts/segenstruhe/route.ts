import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** POST /api/crews/gifts/segenstruhe
 *  Body: { action: 'open' | 'upgrade' }
 */
export async function POST(req: NextRequest) {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: "not_authenticated" }, { status: 401 });

  let body: { action?: "open" | "upgrade" } = {};
  try { body = await req.json() as { action?: "open" | "upgrade" }; } catch { /* noop */ }

  if (body.action === "open") {
    const { data, error } = await sb.rpc("open_segenstruhe");
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json(data ?? {});
  }
  if (body.action === "upgrade") {
    const { data, error } = await sb.rpc("upgrade_segenstruhe");
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json(data ?? {});
  }
  return NextResponse.json({ error: "invalid_action" }, { status: 400 });
}
