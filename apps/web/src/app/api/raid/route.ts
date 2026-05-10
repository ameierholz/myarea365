import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { rateLimitSmart, rateLimitResponse } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET — aktive Raid-Bosses + eigene Damage-Stats */
export async function GET() {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ ok: false, error: "not_authenticated" }, { status: 401 });
  const { data, error } = await sb.rpc("list_raid_bosses");
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

/** POST — Body: { raid_id } → Boss angreifen */
export async function POST(req: Request) {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ ok: false, error: "not_authenticated" }, { status: 401 });
  const rl = await rateLimitSmart(`raid:${user.id}`, 10, 60_000);
  const limited = rateLimitResponse(rl);
  if (limited) return limited;
  const body = await req.json() as { raid_id?: string };
  if (!body.raid_id) return NextResponse.json({ ok: false, error: "missing_raid_id" }, { status: 400 });
  const { data, error } = await sb.rpc("attack_raid_boss", { p_raid_id: body.raid_id });
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
