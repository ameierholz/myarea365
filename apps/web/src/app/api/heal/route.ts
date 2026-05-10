import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET — Status: injured-Liste + heal-queue + cap */
export async function GET() {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ ok: false, error: "not_authenticated" }, { status: 401 });

  // Tick — fertige Heals werden zurückgeführt
  await sb.rpc("finish_heal_queue");

  const [injuredR, queueR, capR] = await Promise.all([
    sb.from("injured_troops").select("troop_id, count").eq("user_id", user.id),
    sb.from("heal_queue").select("id, troop_id, count, ends_at, finished").eq("user_id", user.id).eq("finished", false).order("ends_at"),
    sb.rpc("get_hospital_cap", { p_user_id: user.id }),
  ]);
  return NextResponse.json({
    ok: true,
    injured: injuredR.data ?? [],
    queue: queueR.data ?? [],
    cap: capR.data ?? 50,
  });
}

/** POST — Body: { troop_id, count } → start_heal */
export async function POST(req: Request) {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ ok: false, error: "not_authenticated" }, { status: 401 });

  const body = await req.json() as { troop_id?: string; count?: number };
  if (!body.troop_id || !body.count) return NextResponse.json({ ok: false, error: "missing_params" }, { status: 400 });
  const { data, error } = await sb.rpc("start_heal", { p_troop_id: body.troop_id, p_count: body.count });
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
