import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/admin";
import { TABLE_TARGETS, type TableTargetType } from "@/lib/artwork-targets";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/admin/artwork-entity-counts
 * Liefert pro TABLE_TARGETS-Typ { total, done } für die Statistik im Admin-UI.
 * Eine Query pro Tabelle (mit count-only) — billig.
 */
export async function GET() {
  await requireAdmin();
  const sb = await createClient();

  const types = Object.keys(TABLE_TARGETS) as TableTargetType[];
  const results = await Promise.all(types.map(async (t) => {
    const spec = TABLE_TARGETS[t];
    // Total
    const totalRes = await sb.from(spec.table).select("id", { count: "exact", head: true });
    // Done = mit image_url ODER (wenn allowsVideo) video_url
    const doneCols = spec.allowsVideo ? "id, image_url, video_url" : "id, image_url";
    const doneRes = await sb.from(spec.table).select(doneCols);
    const done = (doneRes.data ?? []).filter((r) => {
      const row = r as { image_url?: string | null; video_url?: string | null };
      return !!row.image_url || (spec.allowsVideo && !!row.video_url);
    }).length;
    return { type: t, total: totalRes.count ?? 0, done };
  }));

  const counts: Record<string, { total: number; done: number }> = {};
  for (const r of results) counts[r.type] = { total: r.total, done: r.done };
  return NextResponse.json({ counts });
}
