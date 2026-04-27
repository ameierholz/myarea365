import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/base/troops — Truppenkatalog + eigener Bestand + Trainings-Queue */
export async function GET() {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: "not_authenticated" }, { status: 401 });
  const [catalog, owned, queue, base] = await Promise.all([
    sb.from("troops_catalog")
      .select("id, name, emoji, troop_class, tier, base_atk, base_def, base_hp, cost_wood, cost_stone, cost_gold, cost_mana, train_time_seconds, required_building_level, description")
      .order("troop_class").order("tier"),
    sb.from("user_troops").select("troop_id, count").eq("user_id", user.id),
    sb.from("troop_training_queue").select("id, troop_id, count, ends_at, finished").eq("user_id", user.id).eq("finished", false),
    sb.from("bases").select("id").eq("owner_user_id", user.id).maybeSingle(),
  ]);

  // Trainings-Caps pro Klasse: Gebäude-Level × 10 (Solo)
  const caps: Record<string, number> = { infantry: 0, cavalry: 0, marksman: 0, siege: 0 };
  const baseRow = base.data as { id: string } | null;
  if (baseRow) {
    const { data: bb } = await sb.from("base_buildings").select("building_id, level").eq("base_id", baseRow.id);
    const byBuilding = new Map<string, number>(((bb ?? []) as Array<{ building_id: string; level: number }>).map((r) => [r.building_id, r.level]));
    caps.infantry = (byBuilding.get("kaserne")            ?? 0) * 10;
    caps.cavalry  = (byBuilding.get("stall")              ?? 0) * 10;
    caps.marksman = (byBuilding.get("schiessstand")       ?? 0) * 10;
    caps.siege    = (byBuilding.get("belagerungsschuppen")?? 0) * 10;
  }

  return NextResponse.json({
    catalog: catalog.data ?? [],
    owned: owned.data ?? [],
    queue: queue.data ?? [],
    caps,
  });
}

/** POST /api/base/troops — Body: { troop_id, count, for_crew? } → trainiert */
export async function POST(req: Request) {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: "not_authenticated" }, { status: 401 });
  const body = (await req.json()) as { troop_id?: string; count?: number; for_crew?: string; instant?: boolean };
  if (!body.troop_id || !body.count) return NextResponse.json({ error: "missing_params" }, { status: 400 });
  const rpc = body.instant ? "instant_train_troop" : "train_troop";
  const { data, error } = await sb.rpc(rpc, {
    p_troop_id: body.troop_id, p_count: body.count, p_for_crew: body.for_crew ?? null,
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json(data);
}
