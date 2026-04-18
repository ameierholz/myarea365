import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/guardian/inventory
 * Gibt zurueck:
 * - items: Inventar mit Catalog-Detail + equipped-Flag
 * - equipped: { helm, armor, amulet } mit vollen Item-Infos
 * - guardian_id: aktiver Waechter des Users
 */
export async function GET() {
  const sb = await createClient();
  const { data: auth } = await sb.auth.getUser();
  if (!auth?.user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { data: guardian } = await sb.from("user_guardians")
    .select("id")
    .eq("user_id", auth.user.id).eq("is_active", true)
    .maybeSingle<{ id: string }>();

  const { data: items } = await sb.from("user_items")
    .select("id, item_id, acquired_at, source, item_catalog:item_id(id, name, emoji, slot, rarity, bonus_hp, bonus_atk, bonus_def, bonus_spd, lore)")
    .eq("user_id", auth.user.id)
    .order("acquired_at", { ascending: false });

  const { data: equipRows } = guardian ? await sb.from("guardian_equipment")
    .select("slot, user_item_id")
    .eq("guardian_id", guardian.id) : { data: [] };

  const equippedMap = new Map((equipRows ?? []).map((r: { slot: string; user_item_id: string }) => [r.slot, r.user_item_id]));
  const equippedIds = new Set(equippedMap.values());

  type Catalog = { id: string; name: string; emoji: string; slot: string; rarity: string; bonus_hp: number; bonus_atk: number; bonus_def: number; bonus_spd: number; lore: string | null };
  type Row = { id: string; item_id: string; acquired_at: string; source: string; item_catalog: Catalog | Catalog[] };
  const normalizedItems = (items ?? []).map((r: Row) => {
    const cat = Array.isArray(r.item_catalog) ? r.item_catalog[0] : r.item_catalog;
    return {
      id: r.id,
      item_id: r.item_id,
      acquired_at: r.acquired_at,
      source: r.source,
      catalog: cat,
      equipped: equippedIds.has(r.id),
    };
  });

  const equipped = { helm: null as typeof normalizedItems[0] | null, armor: null as typeof normalizedItems[0] | null, amulet: null as typeof normalizedItems[0] | null };
  for (const it of normalizedItems) {
    if (it.equipped) {
      if (it.catalog.slot === "helm") equipped.helm = it;
      if (it.catalog.slot === "armor") equipped.armor = it;
      if (it.catalog.slot === "amulet") equipped.amulet = it;
    }
  }

  return NextResponse.json({
    guardian_id: guardian?.id ?? null,
    items: normalizedItems,
    equipped,
  });
}

/**
 * POST /api/guardian/inventory
 * Body: { action: "equip" | "unequip", user_item_id?: string, slot?: "helm"|"armor"|"amulet" }
 */
export async function POST(req: Request) {
  const sb = await createClient();
  const { data: auth } = await sb.auth.getUser();
  if (!auth?.user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = await req.json() as { action: "equip" | "unequip"; user_item_id?: string; slot?: string };

  const { data: guardian } = await sb.from("user_guardians")
    .select("id").eq("user_id", auth.user.id).eq("is_active", true).maybeSingle<{ id: string }>();
  if (!guardian) return NextResponse.json({ error: "no_guardian" }, { status: 400 });

  if (body.action === "equip" && body.user_item_id) {
    const { data, error } = await sb.rpc("equip_item", { p_user_item_id: body.user_item_id, p_guardian_id: guardian.id });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(data);
  }
  if (body.action === "unequip" && body.slot) {
    const { data, error } = await sb.rpc("unequip_slot", { p_guardian_id: guardian.id, p_slot: body.slot });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(data);
  }
  return NextResponse.json({ error: "bad_request" }, { status: 400 });
}
