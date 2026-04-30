import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ participants: [] });

  const { id } = await params;
  const { data, error } = await sb.rpc("get_crew_rally_participants", { p_rally_id: id });
  if (error) return NextResponse.json({ error: error.message, participants: [] }, { status: 500 });
  const obj = data as { participants?: unknown[] } | null;
  return NextResponse.json({ participants: obj?.participants ?? [] });
}
