import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET — Token-Stand + Cooldown */
export async function GET() {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ ok: false, error: "not_authenticated" }, { status: 401 });
  const { data } = await sb.from("user_migration_tokens").select("tokens, last_used_at, cooldown_ends_at").eq("user_id", user.id).maybeSingle();
  return NextResponse.json({ ok: true, tokens: data?.tokens ?? 0, cooldown_ends_at: data?.cooldown_ends_at ?? null });
}

/** POST — Body: { target_city_slug } */
export async function POST(req: Request) {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ ok: false, error: "not_authenticated" }, { status: 401 });
  const body = await req.json() as { target_city_slug?: string };
  if (!body.target_city_slug) return NextResponse.json({ ok: false, error: "missing_target" }, { status: 400 });
  const { data, error } = await sb.rpc("change_home_city", { p_target_city_slug: body.target_city_slug });
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
