import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireStaff } from "@/lib/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET — Snapshot der city_stats_daily-MV */
export async function GET() {
  await requireStaff();
  const sb = await createClient();
  const { data, error } = await sb.from("city_stats_daily").select("*").order("players_total", { ascending: false });
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, stats: data ?? [] });
}

/** POST — Refresh der MV */
export async function POST() {
  await requireStaff();
  const sb = await createClient();
  const { error } = await sb.rpc("refresh_city_stats");
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
