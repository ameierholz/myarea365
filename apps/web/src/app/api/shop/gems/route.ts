import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/shop/gems
 * Liefert Shop-Katalog + Edelstein-Stand + aktive Käufe.
 */
export async function GET() {
  const sb = await createClient();
  const { data: auth } = await sb.auth.getUser();
  if (!auth?.user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const [{ data: items }, { data: gems }, { data: purchases }] = await Promise.all([
    sb.from("gem_shop_items").select("*").eq("active", true).order("category").order("sort"),
    sb.from("user_gems").select("*").eq("user_id", auth.user.id).maybeSingle(),
    sb.from("user_shop_purchases").select("id, shop_item_id, price_paid_gems, expires_at, created_at").eq("user_id", auth.user.id).order("created_at", { ascending: false }),
  ]);

  return NextResponse.json({
    items: items ?? [],
    gems: gems ?? { user_id: auth.user.id, gems: 0, arena_pass_expires_at: null, total_purchased: 0, total_spent: 0 },
    purchases: purchases ?? [],
  });
}

/**
 * POST /api/shop/gems
 * Body: { action: "purchase", item_id }  — Edelstein-Kauf eines Shop-Items
 * Body: { action: "topup", gems }        — Nur Dev/Demo: Edelstein-Top-up (in Prod: Stripe-Webhook)
 */
export async function POST(req: Request) {
  const sb = await createClient();
  const { data: auth } = await sb.auth.getUser();
  if (!auth?.user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = await req.json() as
    | { action: "purchase"; item_id: string }
    | { action: "topup"; gems: number };

  if (body.action === "topup") {
    // Nur Demo — echte Integration läuft über Stripe-Webhook
    const delta = Math.max(0, Math.min(10000, Math.round(body.gems)));
    await sb.from("user_gems").upsert(
      { user_id: auth.user.id, gems: delta, total_purchased: delta, updated_at: new Date().toISOString() },
      { onConflict: "user_id", ignoreDuplicates: false },
    );
    // Zusätzlich RPC-artig addieren falls Row schon existiert:
    const { data: existing } = await sb.from("user_gems").select("gems, total_purchased").eq("user_id", auth.user.id).maybeSingle<{ gems: number; total_purchased: number }>();
    if (existing) {
      await sb.from("user_gems").update({
        gems: existing.gems + delta,
        total_purchased: existing.total_purchased + delta,
        updated_at: new Date().toISOString(),
      }).eq("user_id", auth.user.id);
    }
    await sb.from("gem_transactions").insert({ user_id: auth.user.id, delta, reason: "topup_demo" });
    return NextResponse.json({ ok: true, added: delta });
  }

  if (body.action === "purchase") {
    const { data: item } = await sb.from("gem_shop_items")
      .select("id, price_gems, duration_hours, category, active").eq("id", body.item_id).maybeSingle<{ id: string; price_gems: number; duration_hours: number | null; category: string; active: boolean }>();
    if (!item || !item.active) return NextResponse.json({ error: "item_unavailable" }, { status: 400 });

    const { data: gems } = await sb.from("user_gems").select("gems").eq("user_id", auth.user.id).maybeSingle<{ gems: number }>();
    const balance = gems?.gems ?? 0;
    if (balance < item.price_gems) {
      return NextResponse.json({ error: "not_enough_gems", have: balance, need: item.price_gems }, { status: 400 });
    }

    const expires = item.duration_hours ? new Date(Date.now() + item.duration_hours * 3600_000).toISOString() : null;

    const { error: insertErr } = await sb.from("user_shop_purchases").insert({
      user_id: auth.user.id, shop_item_id: item.id, price_paid_gems: item.price_gems, expires_at: expires,
    });
    if (insertErr) return NextResponse.json({ error: insertErr.message }, { status: 500 });

    await sb.from("user_gems").update({
      gems: balance - item.price_gems,
      total_spent: (await sb.from("user_gems").select("total_spent").eq("user_id", auth.user.id).maybeSingle<{ total_spent: number }>()).data?.total_spent ?? 0 + item.price_gems,
      updated_at: new Date().toISOString(),
      ...(item.category === "arena_pass" && expires ? { arena_pass_expires_at: expires } : {}),
    }).eq("user_id", auth.user.id);

    await sb.from("gem_transactions").insert({
      user_id: auth.user.id, delta: -item.price_gems, reason: `shop:${item.category}`, metadata: { item_id: item.id },
    });

    return NextResponse.json({ ok: true, expires_at: expires });
  }

  return NextResponse.json({ error: "bad_action" }, { status: 400 });
}
