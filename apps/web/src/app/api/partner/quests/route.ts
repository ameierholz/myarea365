import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/partner/quests?business_id=X
 * POST /api/partner/quests   Body: { business_id, title, description, article_pattern, reward_xp, reward_loot_rarity, max_completions_per_user, expires_at }
 * PATCH /api/partner/quests  Body: { id, ...updates }   (RLS sichert Ownership)
 * DELETE /api/partner/quests?id=X
 */
export async function GET(req: NextRequest) {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ quests: [] }, { status: 401 });
  const url = new URL(req.url);
  const businessId = url.searchParams.get("business_id");
  if (!businessId) return NextResponse.json({ error: "missing_business_id" }, { status: 400 });

  const { data, error } = await sb.from("shop_quests")
    .select("id, title, description, article_pattern, reward_xp, reward_loot_rarity, active, starts_at, expires_at, max_completions_per_user, total_completions, created_at")
    .eq("business_id", businessId)
    .order("created_at", { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ quests: data ?? [] });
}

export async function POST(req: NextRequest) {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: "auth" }, { status: 401 });
  const body = await req.json() as {
    business_id: string; title: string; description?: string;
    article_pattern: string; reward_xp?: number; reward_loot_rarity?: string | null;
    max_completions_per_user?: number; expires_at?: string | null;
  };
  if (!body.business_id || !body.title || !body.article_pattern) {
    return NextResponse.json({ error: "missing_params" }, { status: 400 });
  }
  const { data, error } = await sb.from("shop_quests").insert({
    business_id: body.business_id,
    title: body.title,
    description: body.description,
    article_pattern: body.article_pattern,
    reward_xp: body.reward_xp ?? 0,
    reward_loot_rarity: body.reward_loot_rarity || null,
    max_completions_per_user: body.max_completions_per_user ?? 1,
    expires_at: body.expires_at || null,
  }).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, quest: data });
}

export async function PATCH(req: NextRequest) {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: "auth" }, { status: 401 });
  const body = await req.json() as { id: string; [k: string]: unknown };
  const { id, ...updates } = body;
  if (!id) return NextResponse.json({ error: "missing_id" }, { status: 400 });
  const { error } = await sb.from("shop_quests").update(updates).eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: "auth" }, { status: 401 });
  const url = new URL(req.url);
  const id = url.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "missing_id" }, { status: 400 });
  const { error } = await sb.from("shop_quests").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
