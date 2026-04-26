import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/base/packages — aktive Resource-Pakete (für Shop-Anzeige) */
export async function GET() {
  const sb = await createClient();
  const { data, error } = await sb.from("resource_packages")
    .select("id, name, description, price_cents, reward_wood, reward_stone, reward_gold, reward_mana, reward_speed_tokens, bonus_label, sort")
    .eq("active", true).order("sort");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, packages: data ?? [] });
}
