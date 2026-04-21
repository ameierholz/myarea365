import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/arena/potions
 * Liefert Inventar + Katalog + aktive Tränke.
 */
export async function GET() {
  const sb = await createClient();
  const { data: auth } = await sb.auth.getUser();
  if (!auth?.user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const [{ data: catalog }, { data: inventory }] = await Promise.all([
    sb.from("potion_catalog").select("*").order("sort"),
    sb.from("user_potions")
      .select("id, potion_id, acquired_at, activated_at, expires_at, used_at")
      .eq("user_id", auth.user.id)
      .is("used_at", null)
      .order("acquired_at", { ascending: false }),
  ]);

  return NextResponse.json({
    catalog: catalog ?? [],
    inventory: inventory ?? [],
  });
}

/**
 * POST /api/arena/potions
 * Body: { action: "activate", instance_id }
 */
export async function POST(req: Request) {
  const sb = await createClient();
  const { data: auth } = await sb.auth.getUser();
  if (!auth?.user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = await req.json() as { action: "activate"; instance_id: string };
  if (body.action !== "activate") return NextResponse.json({ error: "bad_action" }, { status: 400 });

  const { data, error } = await sb.rpc("activate_potion", { p_instance_id: body.instance_id });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
