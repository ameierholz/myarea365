import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET — eigene Pets + verfügbare Archetypes */
export async function GET() {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ ok: false, error: "not_authenticated" }, { status: 401 });
  const { data, error } = await sb.rpc("list_my_pets");
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

/** POST — { action: "feed"|"activate", pet_id, food? } */
export async function POST(req: Request) {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ ok: false, error: "not_authenticated" }, { status: 401 });
  const body = await req.json() as { action?: string; pet_id?: string; food?: number };
  if (!body.pet_id) return NextResponse.json({ ok: false, error: "missing_pet_id" }, { status: 400 });
  if (body.action === "feed") {
    const { data, error } = await sb.rpc("feed_pet", { p_pet_id: body.pet_id, p_food: body.food ?? 1 });
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    return NextResponse.json(data);
  }
  if (body.action === "activate") {
    const { data, error } = await sb.rpc("set_active_pet", { p_pet_id: body.pet_id });
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    return NextResponse.json(data);
  }
  return NextResponse.json({ ok: false, error: "unknown_action" }, { status: 400 });
}
