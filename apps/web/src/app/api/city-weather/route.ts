import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const sb = await createClient();
  const { data, error } = await sb.rpc("get_user_city_weather");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ weather: data ?? null });
}
