import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/admin";
import { TABLE_TARGETS, type TableTargetType } from "@/lib/artwork-targets";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/admin/artwork-entities/[type]
 * Lädt die Entity-Liste für einen TABLE_TARGETS-Typ + normalisiert auf
 * { id, label, icon, description, image_url, video_url, ...meta }.
 *
 * Wird vom Generic-EntityArtTab im Admin-UI konsumiert.
 */
export async function GET(_req: Request, ctx: { params: Promise<{ type: string }> }) {
  await requireAdmin();
  const { type } = await ctx.params;
  const spec = TABLE_TARGETS[type as TableTargetType];
  if (!spec) return NextResponse.json({ error: "unknown_type" }, { status: 400 });

  const sb = await createClient();
  const cols = ["id"];
  if (spec.labelCol) cols.push(spec.labelCol);
  if (spec.iconCol) cols.push(spec.iconCol);
  if (spec.descCol) cols.push(spec.descCol);
  cols.push("image_url");
  if (spec.allowsVideo) cols.push("video_url");

  let query = sb.from(spec.table).select([...new Set(cols)].join(","));
  if (spec.orderBy && spec.orderBy.length > 0) {
    for (const col of spec.orderBy) {
      query = query.order(col, { nullsFirst: false });
    }
  }
  const { data, error } = await query.limit(500);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Normalisieren auf einheitliches Schema
  const rows = (data ?? []).map((r) => {
    const row = r as unknown as Record<string, unknown>;
    return {
      id: String(row.id ?? ""),
      label: spec.labelCol ? String(row[spec.labelCol] ?? row.id ?? "") : String(row.id ?? ""),
      icon: spec.iconCol ? (row[spec.iconCol] as string | null) : null,
      description: spec.descCol ? (row[spec.descCol] as string | null) : null,
      image_url: (row.image_url as string | null) ?? null,
      video_url: spec.allowsVideo ? ((row.video_url as string | null) ?? null) : null,
    };
  });

  // Cache-Buster für gerade frisch hochgeladene Bilder
  const v = Date.now();
  const bust = (u: string | null) => (u ? `${u}?v=${v}` : null);
  return NextResponse.json({
    type,
    folder: spec.folder,
    allowsVideo: spec.allowsVideo,
    rows: rows.map(r => ({ ...r, image_url: bust(r.image_url), video_url: bust(r.video_url) })),
  });
}
