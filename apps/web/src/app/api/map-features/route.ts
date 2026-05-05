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

  // Loyalty-Shops archived (pivot 2026-05-05) — keine shop_reviews_agg / shop_push_messages / local_businesses mehr
  const [zones, raids, sanctuaries, cells, visits] = await Promise.all([
    sb.from("power_zones").select("*"),
    sb.from("boss_raids").select("*").eq("status", "active"),
    sb.from("sanctuaries").select("*"),
    userId ? sb.from("explored_cells").select("cell_x, cell_y").eq("user_id", userId) : Promise.resolve({ data: [] }),
    userId ? sb.from("sanctuary_visits").select("sanctuary_id, visited_at").eq("user_id", userId).gte("visited_at", new Date(Date.now() - 24 * 3600 * 1000).toISOString()) : Promise.resolve({ data: [] }),
  ]);
  // Loyalty-Stubs (alle archiviert)
  const reviews = { data: [] as Array<{ business_id: string; avg_rating: number; review_count: number }> };
  const pushes = { data: [] as Array<{ id: string; business_id: string; message: string | null; radius_m: number; expires_at: string; local_businesses: { id: string; name: string; lat: number; lng: number } | null }> };
  const trail = { data: [] as Array<{ business_id: string; local_businesses: { id: string; name: string; lat: number; lng: number } | null }> };

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
    const { data, error } = await sb.rpc("train_at_sanctuary", {
      p_sanctuary_id: body.sanctuary_id as string,
      p_user_lat: body.user_lat as number,
      p_user_lng: body.user_lng as number,
    });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(data);
  }
  if (action === "boss_damage") {
    // Schaden wird server-seitig berechnet — Client-Wert wird ignoriert (Anti-Cheat).
    // Formel: eff_atk × RNG[8..18] × crit-bonus × skill-bonus × (1 + talent.atk_pct)
    const { data: g } = await sb.from("user_guardians")
      .select("id, level, current_hp_pct, archetype_id, guardian_archetypes!inner(base_atk, base_hp)")
      .eq("user_id", auth.user.id).eq("is_active", true).maybeSingle();
    const gTyped = g as unknown as { id: string; level: number; current_hp_pct: number; guardian_archetypes: { base_atk: number; base_hp: number } } | null;
    if (!gTyped) return NextResponse.json({ error: "no_active_guardian" }, { status: 400 });

    // Equipment-Bonus
    const { data: eqRows } = await sb.from("guardian_equipment")
      .select("user_items!inner(item_catalog!inner(bonus_atk))")
      .eq("guardian_id", gTyped.id);
    let itemAtk = 0;
    for (const row of (eqRows ?? []) as unknown as Array<{ user_items: { item_catalog: { bonus_atk: number } } }>) {
      itemAtk += row.user_items?.item_catalog?.bonus_atk ?? 0;
    }

    // Talente & Skills laden
    const { loadGuardianBattleContext } = await import("@/lib/guardian-battle-context");
    const { getPowerZoneBuffs } = await import("@/lib/power-zone-buffs");
    const [ctx, zone, potionsRes] = await Promise.all([
      loadGuardianBattleContext(sb, gTyped.id),
      getPowerZoneBuffs(sb, body.user_lat as number | null, body.user_lng as number | null),
      sb.rpc("get_active_potions", { p_user_id: auth.user.id }),
    ]);
    // Aktive Tränke einrechnen
    type PotionRow = { effect_key: string; effect_value: number };
    for (const row of ((potionsRes.data ?? []) as PotionRow[])) {
      const key = row.effect_key as keyof typeof ctx.talent_bonuses;
      const val = Number(row.effect_value ?? 0);
      if (key in ctx.talent_bonuses) {
        (ctx.talent_bonuses as unknown as Record<string, number>)[key] =
          ((ctx.talent_bonuses as unknown as Record<string, number>)[key] ?? 0) + val;
      }
    }

    const baseAtk = gTyped.guardian_archetypes.base_atk * (1 + (gTyped.level - 1) * 0.06);
    const effAtk = (baseAtk + itemAtk + zone.atk) * (1 + (ctx.talent_bonuses.atk_pct ?? 0));
    const hpMod = 0.5 + 0.5 * (gTyped.current_hp_pct / 100); // verwundet → weniger Schaden

    // Skill-Bonus: jeder Skill-Level addiert 6% Outgoing-Damage (5 Skills × 5 Level = max +150%)
    const skillSum = ctx.skill_levels.active + ctx.skill_levels.passive + ctx.skill_levels.combat + ctx.skill_levels.role + ctx.skill_levels.expertise;
    const skillMult = 1 + skillSum * 0.06;

    // Krit
    const critChance = Math.min(0.6, ctx.talent_bonuses.crit_pct ?? 0);
    const critRoll = Math.random() < critChance;
    const critMult = critRoll ? (1.5 + (ctx.talent_bonuses.crit_dmg ?? 0)) : 1;

    // Basis-Range 8..18 ATK
    const roll = 8 + Math.random() * 10;
    const damage = Math.max(50, Math.round(effAtk * roll * hpMod * skillMult * critMult));

    const { data, error } = await sb.rpc("contribute_boss_damage", {
      p_raid_id: body.raid_id as string, p_damage: damage,
      p_user_lat: body.user_lat as number, p_user_lng: body.user_lng as number,
    });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ...data, damage, crit: critRoll, power_zones: zone.zones });
  }
  if (action === "assign_loot") {
    const { data, error } = await sb.rpc("assign_boss_loot", {
      p_loot_id: body.loot_id as string, p_to_user_id: body.to_user_id as string,
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
    // Loyalty-Shop-Reviews archived (pivot 2026-05-05)
    return NextResponse.json({ error: "shop_reviews_archived" }, { status: 410 });
  }

  return NextResponse.json({ error: "bad_request" }, { status: 400 });
}
