import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const sb = await createClient();
  const { data: auth } = await sb.auth.getUser();
  if (!auth?.user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const [seasonsQ, lordsQ] = await Promise.all([
    sb.from("city_lord_seasons").select("*").order("started_at", { ascending: false }).limit(10),
    sb.from("city_lord").select("*"),
  ]);
  return NextResponse.json({ seasons: seasonsQ.data ?? [], lords: lordsQ.data ?? [] });
}

export async function POST(req: Request) {
  const sb = await createClient();
  const { data: auth } = await sb.auth.getUser();
  if (!auth?.user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const body = await req.json().catch(() => null) as { season_id?: string } | null;
  if (!body?.season_id) return NextResponse.json({ error: "bad_request" }, { status: 400 });
  const { data, error } = await sb.rpc("claim_city_lordship", { p_season_id: body.season_id });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
