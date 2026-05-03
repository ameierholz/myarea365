import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Pack = {
  sku: string;
  price_eur: number;
  label: string;
  rewards: {
    gems?: number;
    coins?: number;
    items?: Array<{ catalog_id: string; count: number }>;
  };
};

/**
 * GET /api/runner/popups
 * Listet offene Pop-Up-Angebote des Users.
 */
export async function GET() {
  const sb = await createClient();
  const { data: auth } = await sb.auth.getUser();
  if (!auth?.user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  // Best-effort expire
  await sb.rpc("expire_old_popups");

  const { data, error } = await sb.from("user_popup_offers")
    .select("id, template_id, trigger_event, status, packs_purchased, granted_at, expires_at, popup_offer_templates:template_id(id, title, subtitle, emoji, packs)")
    .eq("user_id", auth.user.id)
    .eq("status", "open")
    .order("granted_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ offers: data ?? [] });
}

/**
 * POST /api/runner/popups
 * Body: { offer_id, action: "dismiss" | "purchase", sku?: string }
 *
 * Phase-1: dismiss schließt Angebot. purchase markiert Pack als gekauft + grants
 * rewards (Stripe-Wire-Up Phase 2 — aktuell direkt-grant für Test).
 */
export async function POST(req: Request) {
  const sb = await createClient();
  const { data: auth } = await sb.auth.getUser();
  if (!auth?.user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null) as { offer_id?: string; action?: string; sku?: string } | null;
  if (!body?.offer_id || !body.action) return NextResponse.json({ error: "bad_request" }, { status: 400 });

  if (body.action === "dismiss") {
    const { error } = await sb.from("user_popup_offers")
      .update({ status: "dismissed", closed_at: new Date().toISOString() })
      .eq("id", body.offer_id)
      .eq("user_id", auth.user.id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  if (body.action === "purchase" && body.sku) {
    // Lade Offer + Template um Pack-Rewards zu bestimmen
    const { data: offer } = await sb.from("user_popup_offers")
      .select("id, packs_purchased, popup_offer_templates:template_id(packs)")
      .eq("id", body.offer_id)
      .eq("user_id", auth.user.id)
      .eq("status", "open")
      .maybeSingle<{
        id: string;
        packs_purchased: string[];
        popup_offer_templates: { packs: Pack[] } | { packs: Pack[] }[];
      }>();
    if (!offer) return NextResponse.json({ error: "offer_not_found" }, { status: 404 });

    const tpl = Array.isArray(offer.popup_offer_templates) ? offer.popup_offer_templates[0] : offer.popup_offer_templates;
    const pack = tpl?.packs.find((p) => p.sku === body.sku);
    if (!pack) return NextResponse.json({ error: "pack_not_found" }, { status: 404 });

    const already = (offer.packs_purchased ?? []) as string[];
    if (already.includes(body.sku)) return NextResponse.json({ error: "already_purchased" }, { status: 400 });

    // PHASE 2: Stripe Checkout. Aktuell Direkt-Grant (Test).
    // grant items
    for (const it of pack.rewards.items ?? []) {
      await sb.rpc("grant_inventory_item", {
        p_user_id: auth.user.id,
        p_catalog_id: it.catalog_id,
        p_count: it.count,
      });
    }
    // gems/coins → würde echtes wallet-update brauchen; aktuell nur als Hinweis

    const newPurchased = [...already, body.sku];
    const allPacksBought = (tpl?.packs ?? []).every((p) => newPurchased.includes(p.sku));

    const { error: updErr } = await sb.from("user_popup_offers")
      .update({
        packs_purchased: newPurchased,
        status: allPacksBought ? "purchased" : "open",
        closed_at: allPacksBought ? new Date().toISOString() : null,
      })
      .eq("id", body.offer_id);
    if (updErr) return NextResponse.json({ error: updErr.message }, { status: 500 });

    return NextResponse.json({ ok: true, granted: pack.rewards });
  }

  return NextResponse.json({ error: "bad_request" }, { status: 400 });
}
