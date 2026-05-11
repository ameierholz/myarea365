import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin, logAudit } from "@/lib/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Item = { catalog_id: string; count: number };
type Resources = {
  wood?: number;
  stone?: number;
  gold?: number;
  mana?: number;
  gems?: number;
  speed_tokens?: number;
};
type RecipientFilter =
  | { mode: "ids"; ids: string[] }
  | { mode: "all" }
  | { mode: "city"; city_slug: string };

/**
 * POST /api/admin/inbox-gifts
 * Body: {
 *   filter: RecipientFilter,
 *   title: string,
 *   body: string,
 *   resources?: Resources,
 *   items?: Item[],
 *   reason: string,
 * }
 *
 * Resolved Empfänger-IDs server-seitig via admin_resolve_recipients,
 * dann admin_send_inbox_gift_bulk. Audit-Log über admin_audit_log.
 */
export async function POST(req: NextRequest) {
  const { userId: actorId } = await requireAdmin();
  const sb = await createClient();
  const body = await req.json() as {
    filter: RecipientFilter;
    title: string;
    body: string;
    resources?: Resources;
    items?: Item[];
    reason: string;
  };

  if (!body.filter?.mode) {
    return NextResponse.json({ ok: false, error: "filter.mode erforderlich" }, { status: 400 });
  }
  if (!body.title?.trim() || !body.body?.trim()) {
    return NextResponse.json({ ok: false, error: "title und body erforderlich" }, { status: 400 });
  }
  if (!body.reason?.trim()) {
    return NextResponse.json({ ok: false, error: "reason erforderlich (Audit)" }, { status: 400 });
  }

  // Empfänger resolven
  const { data: resolvedIds, error: resolveErr } = await sb.rpc("admin_resolve_recipients", {
    p_mode: body.filter.mode,
    p_city_slug: body.filter.mode === "city" ? body.filter.city_slug : null,
    p_ids: body.filter.mode === "ids" ? body.filter.ids : null,
  });
  if (resolveErr) return NextResponse.json({ ok: false, error: resolveErr.message }, { status: 500 });

  const recipientIds = (resolvedIds ?? []) as string[];
  if (recipientIds.length === 0) {
    return NextResponse.json({ ok: false, error: "Keine Empfänger im Filter — Abbruch" }, { status: 400 });
  }

  const resources = body.resources ?? {};
  const items = (body.items ?? []).filter((i) => i?.catalog_id && (i?.count ?? 0) > 0);

  const { data, error } = await sb.rpc("admin_send_inbox_gift_bulk", {
    p_recipient_ids: recipientIds,
    p_title: body.title.trim(),
    p_body: body.body.trim(),
    p_resources: resources,
    p_items: items,
    p_reason: body.reason.trim(),
  });
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

  await logAudit({
    action: "inbox_gift.sent",
    targetType: "user",
    targetId: body.filter.mode === "ids" ? body.filter.ids.join(",") : `filter:${body.filter.mode}`,
    details: {
      filter: body.filter,
      recipient_count: recipientIds.length,
      title: body.title,
      resources,
      items,
      reason: body.reason,
      actor: actorId,
    },
  });

  return NextResponse.json({ ok: true, recipient_count: recipientIds.length, ...(data ?? {}) });
}

/**
 * GET /api/admin/inbox-gifts
 *   ?action=catalog (default) — Item-Katalog
 *   ?action=count&mode=all|city|ids&city_slug=...&ids=... — Empfänger-Count-Preview
 *   ?action=cities — verfügbare home_city_slug-Werte
 */
export async function GET(req: NextRequest) {
  await requireAdmin();
  const sb = await createClient();
  const url = new URL(req.url);
  const action = url.searchParams.get("action") ?? "catalog";

  if (action === "count") {
    const mode = url.searchParams.get("mode") ?? "all";
    const citySlug = url.searchParams.get("city_slug");
    const idsParam = url.searchParams.get("ids");
    const ids = idsParam ? idsParam.split(",").filter(Boolean) : null;
    const { data, error } = await sb.rpc("admin_count_recipients", {
      p_mode: mode,
      p_city_slug: citySlug,
      p_ids: ids,
    });
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, count: data ?? 0 });
  }

  if (action === "cities") {
    const { data } = await sb.from("cities").select("slug, name, is_active").order("name");
    return NextResponse.json({
      cities: (data ?? []).filter((c) => c.is_active !== false).map((c) => ({ slug: c.slug, name: c.name })),
    });
  }

  const [inv, xp, art] = await Promise.all([
    sb.from("inventory_item_catalog")
      .select("id, name, emoji, image_url, category, rarity")
      .eq("active", true)
      .order("category")
      .order("sort_order"),
    sb.from("guardian_xp_items")
      .select("id, name, emoji, image_url, rarity, xp_amount")
      .order("sort"),
    sb.from("cosmetic_artwork")
      .select("slot_id, image_url")
      .eq("kind", "inventory_item")
      .eq("variant", "neutral"),
  ]);

  // Cosmetic-Artwork als Fallback wenn inventory_item_catalog.image_url leer ist.
  // (Manche Items haben ihre Bilder ausschließlich in cosmetic_artwork.)
  const artMap = new Map<string, string>(
    ((art.data ?? []) as Array<{ slot_id: string; image_url: string | null }>)
      .filter((a) => a.image_url)
      .map((a) => [a.slot_id, a.image_url as string])
  );

  const inventory = (inv.data ?? []).map((r) => ({
    catalog_id: r.id as string,
    name: r.name as string,
    emoji: (r.emoji ?? "📦") as string,
    image_url: (r.image_url ?? artMap.get(r.id) ?? null) as string | null,
    category: r.category as string,
    rarity: (r.rarity ?? "common") as string,
    source: "inventory_item_catalog" as const,
  }));

  // guardian_xp_items sind bereits in inventory_item_catalog gespiegelt
  // (Mig 00342). Nicht doppelt liefern — nur fehlende ergänzen.
  const haveIds = new Set(inventory.map((i) => i.catalog_id));
  for (const r of (xp.data ?? [])) {
    if (haveIds.has(r.id)) continue;
    inventory.push({
      catalog_id: r.id,
      name: r.name,
      emoji: r.emoji ?? "🧪",
      image_url: r.image_url ?? null,
      category: "guardian_xp",
      rarity: r.rarity ?? "common",
      source: "guardian_xp_items" as never,
    });
  }

  return NextResponse.json({ items: inventory });
}
