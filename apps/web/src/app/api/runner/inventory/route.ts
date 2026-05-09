import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/runner/inventory
 *
 * Aggregiert das gesamte Runner-Inventar über alle Quellen:
 *   - equipment   (user_items + item_catalog) — Wächter-Equipment 8-Slot
 *   - potions     (user_potions + potion_catalog) — Combat-Tränke
 *   - guardianXp  (user_guardian_xp_items + guardian_xp_items) — XP-Bücher
 *   - materials   (user_materials) — Forge-Materialien
 *   - generic     (user_inventory_items + inventory_item_catalog) — Speedups, Boosts, Truhen, Schlüssel, Elixier, Tokens
 */
export async function GET() {
  const sb = await createClient();
  const { data: auth } = await sb.auth.getUser();
  if (!auth?.user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const uid = auth.user.id;

  // ── Equipment ───────────────────────────────────────────────────
  const equipQ = await sb.from("user_items")
    .select("id, item_id, acquired_at, upgrade_tier, item_catalog:item_id(id, name, emoji, slot, rarity, image_url, bonus_hp, bonus_atk, bonus_def, bonus_spd)")
    .eq("user_id", uid)
    .order("acquired_at", { ascending: false });

  // ── Potions (Catalog + Inventory) ───────────────────────────────
  const [potionCatQ, potionInvQ] = await Promise.all([
    sb.from("potion_catalog").select("id, name, icon, rarity, effect_key, effect_value, duration_min, description"),
    sb.from("user_potions")
      .select("id, potion_id, acquired_at, activated_at, expires_at, used_at")
      .eq("user_id", uid)
      .is("used_at", null)
      .order("acquired_at", { ascending: false }),
  ]);

  // ── Guardian XP Items ───────────────────────────────────────────
  const xpQ = await sb.from("user_guardian_xp_items")
    .select("item_id, count, guardian_xp_items:item_id(id, name, emoji, xp_value, rarity, image_url)")
    .eq("user_id", uid);

  // ── Materials ───────────────────────────────────────────────────
  const matQ = await sb.from("user_materials")
    .select("scrap, crystal, essence, relikt")
    .eq("user_id", uid)
    .maybeSingle();

  // ── Generic Inventory (Speedups / Boosts / Truhen / etc.) ───────
  const [genericCatQ, genericInvQ] = await Promise.all([
    sb.from("inventory_item_catalog")
      .select("id, category, name, description, emoji, image_url, rarity, payload, sort_order")
      .eq("active", true)
      .order("sort_order", { ascending: true }),
    sb.from("user_inventory_items")
      .select("catalog_id, count, acquired_at")
      .eq("user_id", uid)
      .gt("count", 0),
  ]);

  return NextResponse.json({
    equipment: equipQ.data ?? [],
    potions: {
      catalog: potionCatQ.data ?? [],
      inventory: potionInvQ.data ?? [],
    },
    guardianXp: xpQ.data ?? [],
    materials: matQ.data ?? { scrap: 0, crystal: 0, essence: 0, relikt: 0 },
    generic: {
      catalog: genericCatQ.data ?? [],
      inventory: genericInvQ.data ?? [],
    },
  });
}

/**
 * POST /api/runner/inventory
 * Body: { action: "consume", catalog_id: string, count?: number }
 *
 * Verbraucht ein generisches Inventar-Item. Die Effekt-Logik (Speedup
 * auf aktive Bauschlange anwenden, Schild aktivieren, Truhe öffnen) ist
 * Phase 2 — aktuell wird nur der Bestand reduziert und ein Stub
 * "applied" zurückgegeben.
 */
export async function POST(req: Request) {
  const sb = await createClient();
  const { data: auth } = await sb.auth.getUser();
  if (!auth?.user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null) as {
    action?: string; catalog_id?: string; item_id?: string; count?: number; choice?: string;
  } | null;
  if (!body) return NextResponse.json({ error: "bad_request" }, { status: 400 });

  // Ressourcen-Truhe öffnen (random oder Auswahl)
  if (body.action === "open_resource_chest" && body.item_id) {
    const { data, error } = await sb.rpc("consume_resource_chest", {
      p_item_id: body.item_id, p_choice: body.choice ?? null,
    });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(data);
  }

  // Truhe mit Schlüssel öffnen (Silber/Gold/Event/Legendary)
  if (body.action === "open_chest" && body.item_id) {
    const { data, error } = await sb.rpc("consume_chest_with_key", { p_chest_id: body.item_id });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(data);
  }

  if (body.action === "consume" && body.catalog_id) {
    const { data, error } = await sb.rpc("consume_inventory_item", {
      p_user_id: auth.user.id, p_catalog_id: body.catalog_id, p_count: body.count ?? 1,
    });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    if (data === false) return NextResponse.json({ error: "insufficient" }, { status: 400 });
    return NextResponse.json({ ok: true, applied: "stub" });
  }

  return NextResponse.json({ error: "bad_request" }, { status: 400 });
}
