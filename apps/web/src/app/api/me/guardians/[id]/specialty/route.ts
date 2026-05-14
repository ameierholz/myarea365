import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/me/guardians/[id]/specialty
 *   Body: { code: string | null }
 *   → Setzt das Wetter-Specialty-Tag eines Wächters (oder löscht via null).
 *     Catalog siehe public.guardian_weather_specialties.
 */
export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ ok: false, error: "not_authenticated" }, { status: 401 });

  const { id } = await ctx.params;
  let body: { code?: string | null };
  try { body = await req.json(); } catch { body = {}; }
  const code = body.code === null ? null : (body.code?.trim() || null);

  const { data, error } = await sb.rpc("set_guardian_specialty", {
    p_guardian_id: id,
    p_code: code,
  });
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
