import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/crew/gem-pool?crew_id=... → Pool-Stand + User-Gems */
export async function GET(req: NextRequest) {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const crewId = new URL(req.url).searchParams.get("crew_id");
  if (!crewId) return NextResponse.json({ error: "crew_id required" }, { status: 400 });

  const [{ data: pool }, { data: userGems }, { data: txns }] = await Promise.all([
    sb.from("crew_gem_pool").select("gems, total_deposited, total_spent, updated_at").eq("crew_id", crewId).maybeSingle<{ gems: number; total_deposited: number; total_spent: number; updated_at: string }>(),
    sb.from("user_gems").select("gems").eq("user_id", user.id).maybeSingle<{ gems: number }>(),
    sb.from("crew_gem_transactions").select("kind, amount, reason, created_at, user_id").eq("crew_id", crewId).order("created_at", { ascending: false }).limit(10),
  ]);

  return NextResponse.json({
    pool: pool ?? { gems: 0, total_deposited: 0, total_spent: 0 },
    my_gems: userGems?.gems ?? 0,
    recent_transactions: txns ?? [],
  });
}

/** POST /api/crew/gem-pool  { crew_id, amount } — User zahlt Diamanten in Pool ein */
export async function POST(req: Request) {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  let body: { crew_id?: string; amount?: number };
  try { body = await req.json(); } catch { return NextResponse.json({ error: "bad_json" }, { status: 400 }); }
  if (!body.crew_id || !body.amount || body.amount <= 0) return NextResponse.json({ error: "invalid" }, { status: 400 });

  const { error } = await sb.rpc("crew_gem_deposit", {
    p_user_id: user.id, p_crew_id: body.crew_id, p_amount: body.amount,
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
