import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/nameplates → Katalog + welche der User besitzt + welches equipped ist */
export async function GET() {
  const sb = await createClient();
  const { data: auth } = await sb.auth.getUser();
  const userId = auth?.user?.id ?? null;

  const [catalog, owned, prof] = await Promise.all([
    sb.from("nameplates").select("*").eq("is_active", true).order("sort"),
    userId ? sb.from("user_nameplates").select("nameplate_id").eq("user_id", userId) : Promise.resolve({ data: [] }),
    userId ? sb.from("users").select("equipped_nameplate_id").eq("id", userId).maybeSingle() : Promise.resolve({ data: null }),
  ]);

  const ownedIds = new Set<string>(((owned.data ?? []) as Array<{ nameplate_id: string }>).map((r) => r.nameplate_id));
  const equipped = (prof.data as { equipped_nameplate_id: string | null } | null)?.equipped_nameplate_id ?? null;
  const items = (catalog.data ?? []).map((p: Record<string, unknown>) => ({
    ...p, owned: ownedIds.has(p.id as string), equipped: equipped === p.id,
  }));
  return NextResponse.json({ items, equipped });
}

/** POST /api/nameplates  body: { action: "equip"|"claim", nameplate_id } */
export async function POST(req: Request) {
  const sb = await createClient();
  const { data: auth } = await sb.auth.getUser();
  if (!auth?.user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const body = await req.json() as { action: string; nameplate_id?: string | null };
  if (body.action === "equip") {
    const { data, error } = await sb.rpc("equip_nameplate", { p_nameplate_id: body.nameplate_id ?? null });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(data);
  }
  if (body.action === "claim") {
    const { data, error } = await sb.rpc("claim_nameplate", { p_nameplate_id: body.nameplate_id });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(data);
  }
  return NextResponse.json({ error: "bad_request" }, { status: 400 });
}
