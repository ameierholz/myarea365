import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/base/legion — Multi-Aufgebot kompatibler Solo/Stack-Angriff.
 *
 * Body: {
 *   defender_user_id: string;
 *   troops: Record<string, number>;
 *   guardian_id?: string | null;
 *   legion_label?: string | null;
 *   legions?: Array<{ defender_user_id: string; troops: Record<string, number>; guardian_id?: string | null; legion_label?: string | null }>;
 * }
 *
 * - Wenn `legions` vorhanden ist → mehrere Legionen sequentiell (max. march_queue).
 * - Sonst → einzelne Legion.
 */
export async function POST(req: NextRequest) {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: "not_authenticated" }, { status: 401 });

  const body = await req.json() as {
    defender_user_id?: string;
    troops?: Record<string, number>;
    guardian_id?: string | null;
    legion_label?: string | null;
    legions?: Array<{
      defender_user_id: string;
      troops: Record<string, number>;
      guardian_id?: string | null;
      legion_label?: string | null;
    }>;
  };

  const legions = body.legions && body.legions.length > 0
    ? body.legions
    : (body.defender_user_id && body.troops
       ? [{ defender_user_id: body.defender_user_id, troops: body.troops, guardian_id: body.guardian_id ?? null, legion_label: body.legion_label ?? null }]
       : []);

  if (legions.length === 0) {
    return NextResponse.json({ error: "missing_params" }, { status: 400 });
  }

  const results: Array<Record<string, unknown> & { ok: boolean }> = [];
  for (const l of legions) {
    const { data, error } = await sb.rpc("start_attack_legion", {
      p_defender_user_id: l.defender_user_id,
      p_troops: l.troops,
      p_guardian_id: l.guardian_id ?? null,
      p_legion_label: l.legion_label ?? null,
    });
    if (error) {
      results.push({ ok: false, error: error.message, legion_label: l.legion_label ?? null });
    } else {
      const d = (data as Record<string, unknown> | null) ?? { ok: false };
      results.push({ ok: Boolean(d.ok), ...d, legion_label: l.legion_label ?? null });
    }
  }

  const allOk = results.every((r) => r.ok);
  return NextResponse.json({ ok: allOk, results });
}
