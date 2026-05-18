import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/base/pending-rss
 *
 * Liefert die aktuell einsammelbaren Resource-Mengen über alle Production-
 * Buildings der eigenen Base. Wird vom Heimat-Karten-Indikator und ähnlichen
 * Live-UI-Stellen genutzt um zu entscheiden, ob ein "RSS bereit"-Badge
 * angezeigt werden soll.
 *
 * Berechnung folgt 1:1 der Server-Logik in _collect_one_building
 * (Migration 00288): pending = floor(min(elapsed_h * rate, 6 * rate)).
 */
type Row = {
  building_id: string;
  resource: "wood" | "stone" | "gold" | "mana" | null;
  rate: number;
  cap: number;
  last_collected_at: string;
};

export async function GET() {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: "not_authenticated" }, { status: 401 });

  const { data, error } = await sb.rpc("get_building_production_rates");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const rows = (data as Row[] | null) ?? [];
  const now = Date.now();
  const by_resource: Record<"wood" | "stone" | "gold" | "mana", number> = {
    wood: 0, stone: 0, gold: 0, mana: 0,
  };
  let any_capped = false;

  for (const r of rows) {
    if (!r.resource) continue;
    const elapsed_h = Math.max(0, (now - new Date(r.last_collected_at).getTime()) / 3_600_000);
    const raw = elapsed_h * r.rate;
    const amount = Math.floor(Math.min(raw, r.cap));
    if (raw >= r.cap) any_capped = true;
    by_resource[r.resource] += amount;
  }

  const total = by_resource.wood + by_resource.stone + by_resource.gold + by_resource.mana;
  return NextResponse.json({ ok: true, total, by_resource, any_capped });
}
