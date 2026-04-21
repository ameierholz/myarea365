import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/guardian/materials
 * Liefert die Material-Balance des Runners.
 */
export async function GET() {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ scrap: 0, crystal: 0, essence: 0, relikt: 0 });

  const { data } = await sb.from("user_materials")
    .select("scrap, crystal, essence, relikt")
    .eq("user_id", user.id)
    .maybeSingle();

  return NextResponse.json({
    scrap:   data?.scrap   ?? 0,
    crystal: data?.crystal ?? 0,
    essence: data?.essence ?? 0,
    relikt:  data?.relikt  ?? 0,
  });
}
