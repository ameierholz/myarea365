import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: "not_authenticated" }, { status: 401 });

  const { id } = await params;
  const body = (await req.json()) as { troops?: Record<string, number> };
  if (!body.troops) return NextResponse.json({ error: "missing_troops" }, { status: 400 });

  const { data, error } = await sb.rpc("join_crew_repeater_rally", {
    p_rally_id: id, p_troops: body.troops,
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
