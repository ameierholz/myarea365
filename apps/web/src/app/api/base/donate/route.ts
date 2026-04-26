import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** POST /api/base/donate — Body: { to_user: uuid, resource_type: 'wood'|'stone'|'gold'|'mana', amount: int } */
export async function POST(req: Request) {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: "not_authenticated" }, { status: 401 });

  const body = (await req.json()) as { to_user?: string; resource_type?: string; amount?: number };
  if (!body.to_user || !body.resource_type || !body.amount) {
    return NextResponse.json({ error: "missing_params" }, { status: 400 });
  }

  const { data, error } = await sb.rpc("donate_to_crew_member", {
    p_to_user: body.to_user,
    p_resource_type: body.resource_type,
    p_amount: body.amount,
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json(data);
}
