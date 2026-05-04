import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/heimat/crew-member-stats?user_id=...
 *   → Stats für CrewMemberModal (Avatar/Name/Crew/Ansehen/Verdienste/aktive Verstärkungen)
 */
export async function GET(req: NextRequest) {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: "not_authenticated" }, { status: 401 });
  const url = new URL(req.url);
  const userId = url.searchParams.get("user_id");
  if (!userId) return NextResponse.json({ error: "missing_user_id" }, { status: 400 });

  const { data, error } = await sb.rpc("get_crew_member_stats", { p_user_id: userId });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
