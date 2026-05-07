import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/base/coord-march — Marsch zu Karten-Punkt (kein Defender).
 *
 * Body (Single):  { target_lat, target_lng, troops, guardian_id?, legion_label? }
 * Body (Multi):   { marches: Array<{ target_lat, target_lng, troops, guardian_id?, legion_label? }> }
 *
 * Mehrere Märsche werden sequentiell gestartet bis march_queue voll ist.
 */
export async function POST(req: NextRequest) {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: "not_authenticated" }, { status: 401 });

  const body = await req.json() as {
    target_lat?: number;
    target_lng?: number;
    troops?: Record<string, number>;
    guardian_id?: string | null;
    legion_label?: string | null;
    marches?: Array<{
      target_lat: number;
      target_lng: number;
      troops: Record<string, number>;
      guardian_id?: string | null;
      legion_label?: string | null;
    }>;
  };

  const marches = body.marches && body.marches.length > 0
    ? body.marches
    : (typeof body.target_lat === "number" && typeof body.target_lng === "number" && body.troops
       ? [{
           target_lat: body.target_lat,
           target_lng: body.target_lng,
           troops: body.troops,
           guardian_id: body.guardian_id ?? null,
           legion_label: body.legion_label ?? null,
         }]
       : []);

  if (marches.length === 0) {
    return NextResponse.json({ error: "missing_params" }, { status: 400 });
  }

  const results: Array<Record<string, unknown> & { ok: boolean }> = [];
  for (const m of marches) {
    const { data, error } = await sb.rpc("start_coord_march", {
      p_target_lat: m.target_lat,
      p_target_lng: m.target_lng,
      p_troops: m.troops,
      p_guardian_id: m.guardian_id ?? null,
      p_legion_label: m.legion_label ?? null,
    });
    if (error) {
      results.push({ ok: false, error: error.message, legion_label: m.legion_label ?? null });
    } else {
      const d = (data as Record<string, unknown> | null) ?? { ok: false };
      results.push({ ok: Boolean(d.ok), ...d, legion_label: m.legion_label ?? null });
    }
  }

  const allOk = results.every((r) => r.ok);
  return NextResponse.json({ ok: allOk, results });
}
