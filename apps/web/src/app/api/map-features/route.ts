import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/map-features
 * Liefert alle Map-Features in einem Schwung:
 * - power_zones, boss_raids (active), sanctuaries (+ trained_today für aktuellen User)
 * - shop_reviews_agg, flash_pushes (active), explored_cells des Users
 */
export async function GET(req: Request) {
  const sb = await createClient();
  const { data: auth } = await sb.auth.getUser();
  const userId = auth?.user?.id ?? null;

  const [zones, raids, sanctuaries, reviews, pushes, cells, visits, trail] = await Promise.all([
    sb.from("power_zones").select("*"),
    sb.from("boss_raids").select("*").eq("status", "active"),
    sb.from("sanctuaries").select("*"),
    sb.from("shop_reviews_agg").select("*"),
    sb.from("shop_push_messages").select("id, business_id, message, radius_m, expires_at, local_businesses(id, name, lat, lng)").gt("expires_at", new Date().toISOString()),
    userId ? sb.from("explored_cells").select("cell_x, cell_y").eq("user_id", userId) : Promise.resolve({ data: [] }),
    userId ? sb.from("sanctuary_visits").select("sanctuary_id, visited_at").eq("user_id", userId).gte("visited_at", new Date(Date.now() - 24 * 3600 * 1000).toISOString()) : Promise.resolve({ data: [] }),
    userId ? sb.from("deal_redemptions").select("business_id, local_businesses(id, name, lat, lng)").eq("user_id", userId).eq("status", "verified") : Promise.resolve({ data: [] }),
  ]);

  // Trained-today flag je Sanctuary
  const trainedIds = new Set<string>((visits.data ?? []).map((v: { sanctuary_id: string }) => v.sanctuary_id));
  const sanctuariesOut = (sanctuaries.data ?? []).map((s: { id: string }) => ({
    ...s, trained_today: trainedIds.has(s.id),
  }));

  // Flash-Push umformen
  type PushRow = { id: string; business_id: string; message: string | null; radius_m: number; expires_at: string; local_businesses: { id: string; name: string; lat: number; lng: number } | { id: string; name: string; lat: number; lng: number }[] | null };
  const flashPushes = (pushes.data ?? []).map((p: PushRow) => {
    const biz = Array.isArray(p.local_businesses) ? p.local_businesses[0] : p.local_businesses;
    if (!biz) return null;
    return {
      id: p.id,
      business_id: p.business_id,
      business_name: biz.name,
      business_lat: biz.lat,
      business_lng: biz.lng,
      radius_m: p.radius_m,
      expires_at: p.expires_at,
      message: p.message,
    };
  }).filter(Boolean);

  // Shop-Trail: Top-3 meist-besuchte Shops des Users
  type TrailRow = { business_id: string; local_businesses: { id: string; name: string; lat: number; lng: number } | { id: string; name: string; lat: number; lng: number }[] | null };
  const counts = new Map<string, { biz: { id: string; name: string; lat: number; lng: number }; count: number }>();
  for (const t of (trail.data as TrailRow[] | null) ?? []) {
    const biz = Array.isArray(t.local_businesses) ? t.local_businesses[0] : t.local_businesses;
    if (!biz) continue;
    const existing = counts.get(biz.id);
    if (existing) existing.count++;
    else counts.set(biz.id, { biz, count: 1 });
  }
  const trailTop = Array.from(counts.values())
    .sort((a, b) => b.count - a.count).slice(0, 3)
    .map(({ biz, count }) => ({
      business_id: biz.id, name: biz.name, lat: biz.lat, lng: biz.lng,
      icon: "🛍️", color: "#22D1C3", visit_count: count,
    }));

  return NextResponse.json({
    power_zones: zones.data ?? [],
    boss_raids: raids.data ?? [],
    sanctuaries: sanctuariesOut,
    shop_reviews: reviews.data ?? [],
    flash_pushes: flashPushes,
    explored_cells: cells.data ?? [],
    shop_trail: trailTop,
  });
}

/**
 * POST /api/map-features
 * Actions:
 * - train_sanctuary: { action: "train_sanctuary", sanctuary_id }
 * - boss_damage:     { action: "boss_damage", raid_id, damage }
 * - mark_cells:      { action: "mark_cells", cells: [{x,y}, ...] }
 * - review_shop:     { action: "review_shop", business_id, rating, comment? }
 */
export async function POST(req: Request) {
  const sb = await createClient();
  const { data: auth } = await sb.auth.getUser();
  if (!auth?.user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const body = await req.json() as Record<string, unknown>;
  const action = body.action as string;

  if (action === "train_sanctuary") {
    const { data, error } = await sb.rpc("train_at_sanctuary", { p_sanctuary_id: body.sanctuary_id as string });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(data);
  }
  if (action === "boss_damage") {
    const { data, error } = await sb.rpc("contribute_boss_damage", {
      p_raid_id: body.raid_id as string, p_damage: body.damage as number,
    });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(data);
  }
  if (action === "mark_cells") {
    const { data, error } = await sb.rpc("mark_cells_explored", { p_cells: body.cells });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, count: data });
  }
  if (action === "review_shop") {
    const { data, error } = await sb.from("shop_reviews").upsert({
      business_id: body.business_id as string,
      user_id: auth.user.id,
      rating: body.rating as number,
      comment: (body.comment as string | undefined) ?? null,
    }, { onConflict: "business_id,user_id" }).select().single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, review: data });
  }

  return NextResponse.json({ error: "bad_request" }, { status: 400 });
}
