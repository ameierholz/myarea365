import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireStaff } from "@/lib/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  await requireStaff();
  const sb = await createClient();
  const { data, error } = await sb
    .from("ui_icon_slots")
    .select("id, category, name, description, fallback_emoji, sort")
    .order("sort");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ slots: data ?? [] });
}
