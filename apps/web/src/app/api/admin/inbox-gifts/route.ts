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

/**
 * POST /api/admin/inbox-gifts
 * Body: {
 *   recipient_ids: string[],  // 1 oder mehr User-IDs
 *   title: string,
 *   body: string,
 *   resources?: Resources,
 *   items?: Item[],
 *   reason: string,
 * }
 *
 * Sendet jedem Empfänger eine Inbox-Nachricht mit reward_payload.
 * Audit-Log über admin_audit_log.
 */
export async function POST(req: NextRequest) {
  const { userId: actorId } = await requireAdmin();
  const sb = await createClient();
  const body = await req.json() as {
    recipient_ids: string[];
    title: string;
    body: string;
    resources?: Resources;
    items?: Item[];
    reason: string;
  };

  if (!Array.isArray(body.recipient_ids) || body.recipient_ids.length === 0) {
    return NextResponse.json({ ok: false, error: "recipient_ids erforderlich" }, { status: 400 });
  }
  if (!body.title?.trim() || !body.body?.trim()) {
    return NextResponse.json({ ok: false, error: "title und body erforderlich" }, { status: 400 });
  }
  if (!body.reason?.trim()) {
    return NextResponse.json({ ok: false, error: "reason erforderlich (Audit)" }, { status: 400 });
  }

  const resources = body.resources ?? {};
  const items = (body.items ?? []).filter((i) => i?.catalog_id && (i?.count ?? 0) > 0);

  const { data, error } = await sb.rpc("admin_send_inbox_gift_bulk", {
    p_recipient_ids: body.recipient_ids,
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
    targetId: body.recipient_ids.join(","),
    details: {
      recipient_count: body.recipient_ids.length,
      title: body.title,
      resources,
      items,
      reason: body.reason,
      actor: actorId,
    },
  });

  return NextResponse.json({ ok: true, ...(data ?? {}) });
}

/**
 * GET /api/admin/inbox-gifts/catalog
 * Liefert verfügbare Items aus inventory_item_catalog + guardian_xp_items
 * gemeinsam (für Item-Picker).
 */
export async function GET() {
  await requireAdmin();
  const sb = await createClient();

  const [inv, xp] = await Promise.all([
    sb.from("inventory_item_catalog")
      .select("id, name, emoji, image_url, category, rarity")
      .eq("active", true)
      .order("category")
      .order("sort_order"),
    sb.from("guardian_xp_items")
      .select("id, name, emoji, image_url, rarity, xp_amount")
      .order("sort"),
  ]);

  const inventory = (inv.data ?? []).map((r) => ({
    catalog_id: r.id as string,
    name: r.name as string,
    emoji: (r.emoji ?? "📦") as string,
    image_url: (r.image_url ?? null) as string | null,
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
