import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/rally/{id}/apply-boost
 * Body: { catalog_id: "speedup_march_50" | "speedup_march_100" | "speedup_march_250" | "speedup_march_500" }
 *
 * Verbraucht 1× Speedup-Item aus dem User-Inventar und verkürzt die
 * verbleibende Marsch-Zeit der Rally um den Item-Multiplier.
 * Nur erlaubt während status='marching' und nur durch den Rally-Leader.
 */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ ok: false, error: "auth_required" }, { status: 401 });

  const { id } = await params;
  const body = await req.json().catch(() => null) as { catalog_id?: string } | null;
  if (!body?.catalog_id) {
    return NextResponse.json({ ok: false, error: "missing_catalog_id" }, { status: 400 });
  }

  const { data, error } = await sb.rpc("apply_march_boost", {
    p_rally_id: id,
    p_catalog_id: body.catalog_id,
  });
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
