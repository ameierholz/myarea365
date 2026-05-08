import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/base/collect
 * Body: { building_id?: string }
 *   - mit building_id: 1 Production-Building einsammeln
 *   - ohne building_id: alle Production-Buildings einsammeln
 *
 * Pending wird server-seitig in collect_building / collect_all_buildings
 * berechnet — Frontend-Werte sind nur Anzeige.
 */
export async function POST(req: Request) {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: "not_authenticated" }, { status: 401 });

  let body: { building_id?: string } = {};
  try { body = await req.json() as { building_id?: string }; } catch { /* empty body OK */ }

  if (body.building_id) {
    const { data, error } = await sb.rpc("collect_building", { p_building_id: body.building_id });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    const row = (data as Array<{ resource: string | null; amount: number; capped: boolean }> | null)?.[0];
    return NextResponse.json({
      ok: true,
      resource: row?.resource ?? null,
      amount:   row?.amount   ?? 0,
      capped:   row?.capped   ?? false,
    });
  }

  const { data, error } = await sb.rpc("collect_all_buildings");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const row = (data as Array<{ collected_count: number; totals: Record<string, number> }> | null)?.[0];
  return NextResponse.json({
    ok: true,
    collected_count: row?.collected_count ?? 0,
    totals:          row?.totals ?? { wood: 0, stone: 0, gold: 0, mana: 0 },
  });
}
