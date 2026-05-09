import { NextResponse } from "next/server";
import { createClient as createAdminSb, type SupabaseClient } from "@supabase/supabase-js";
import { requireAdmin } from "@/lib/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

let _adminSb: SupabaseClient | null = null;
function adminSb(): SupabaseClient {
  if (_adminSb) return _adminSb;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Supabase admin creds missing");
  _adminSb = createAdminSb(url, key, { auth: { persistSession: false } });
  return _adminSb;
}

/**
 * POST /api/admin/artwork/wipe-archetypes
 * Löscht ALLE Files unter `artwork/archetypes/` im Storage und setzt
 * image_url + video_url auf NULL für alle Wächter-Archetypen.
 * Wird nach dem 5x4-Rework benötigt — die alten Bilder passen nicht mehr.
 */
export async function POST() {
  await requireAdmin();
  const sb = adminSb();

  const { data: list, error: listErr } = await sb.storage.from("artwork").list("archetypes", {
    limit: 1000,
    sortBy: { column: "name", order: "asc" },
  });
  if (listErr) return NextResponse.json({ error: listErr.message }, { status: 500 });

  const paths = (list ?? []).map((f) => `archetypes/${f.name}`);
  let removed = 0;
  if (paths.length > 0) {
    const { error: rmErr } = await sb.storage.from("artwork").remove(paths);
    if (rmErr) return NextResponse.json({ error: rmErr.message, removed }, { status: 500 });
    removed = paths.length;
  }

  const { error: dbErr } = await sb.from("guardian_archetypes")
    .update({ image_url: null, video_url: null })
    .not("id", "is", null);
  if (dbErr) return NextResponse.json({ error: dbErr.message, removed }, { status: 500 });

  return NextResponse.json({ ok: true, removed });
}
