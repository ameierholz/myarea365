import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: "not_authenticated" }, { status: 401 });

  const { data, error } = await sb.rpc("inbox_counts");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ counts: data ?? {} });
}
