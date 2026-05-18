import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/crews/gifts/count → { common: N, rare: N, total: N } */
export async function GET() {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ common: 0, rare: 0, total: 0 });
  const { data, error } = await sb.rpc("count_crew_gifts_pending");
  if (error) return NextResponse.json({ common: 0, rare: 0, total: 0 });
  return NextResponse.json(data ?? { common: 0, rare: 0, total: 0 });
}
