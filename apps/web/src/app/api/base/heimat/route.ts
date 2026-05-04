import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/base/heimat
 *   → Aggregierter Snapshot für die Heimat-Karte (CoD-UX):
 *     - active_marches: eigene + Crew-Märsche (Sprite-Render)
 *     - incoming: eingehende Feind-Märsche (?-Marker)
 *     - garrisons: eigene + Crew-Garrisons
 *     - relocate_status: Cooldown + Kosten
 */
export async function GET() {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: "not_authenticated" }, { status: 401 });

  const [marches, incoming, garrisons, baseRow, gold] = await Promise.all([
    sb.rpc("get_heimat_active_marches"),
    sb.rpc("get_heimat_incoming"),
    sb.from("base_garrisons")
      .select("*")
      .is("released_at", null),
    sb.from("bases")
      .select("lat, lng, last_relocate_at, relocate_count")
      .eq("owner_user_id", user.id)
      .single(),
    sb.from("user_resources").select("gold").eq("user_id", user.id).single(),
  ]);

  const cooldownMs = 24 * 3600 * 1000;
  const lastReloc = baseRow.data?.last_relocate_at ? new Date(baseRow.data.last_relocate_at).getTime() : 0;
  const nextReloc = lastReloc ? new Date(lastReloc + cooldownMs).toISOString() : null;
  const canRelocate = !lastReloc || (Date.now() - lastReloc > cooldownMs);

  return NextResponse.json({
    ok: true,
    active_marches: marches.data ?? [],
    incoming: incoming.data ?? [],
    garrisons: garrisons.data ?? [],
    base: baseRow.data ?? null,
    relocate: {
      cooldown_seconds: 24 * 3600,
      cost_gold: 50,
      max_distance_m: 5000,
      next_at: nextReloc,
      can_relocate: canRelocate,
      have_gold: gold.data?.gold ?? 0,
    },
  });
}
