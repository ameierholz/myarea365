import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
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
 * GET /api/admin/artwork
 * Listet alle Wächter-Archetypen + alle Items mit aktuellem image_url.
 */
export async function GET() {
  await requireAdmin();
  const sb = await createClient();
  const [arch, items, races, materials] = await Promise.all([
    sb.from("guardian_archetypes").select("id, name, emoji, rarity, guardian_type, class_id, role, species, gender, ability_name, lore, image_url, video_url").order("rarity").order("name"),
    sb.from("item_catalog").select("id, name, emoji, slot, rarity, class_id, image_url, cosmetic_only, race").order("class_id", { nullsFirst: true }).order("slot").order("rarity").order("name"),
    sb.from("races_catalog").select("name, role, lore, material_desc, energy_color").order("role").order("name"),
    sb.from("material_catalog").select("id, name, emoji, description, tier, sort, image_url, video_url").order("sort"),
  ]);
  return NextResponse.json({
    archetypes: arch.data ?? [],
    items:      items.data ?? [],
    races:      races.data ?? [],
    materials:  materials.data ?? [],
  });
}

/**
 * POST /api/admin/artwork
 * FormData: file (image), target_type (archetype|item), target_id
 * Lädt in Storage 'artwork/<type>/<id>.<ext>' und setzt image_url.
 */
export async function POST(req: Request) {
  await requireAdmin();
  const sb = await createClient();

  const contentType = req.headers.get("content-type") || "";

  // ─── Pfad A: JSON-Finalize nach Direct-Upload via Signed URL ───
  // Body: { target_type, target_id, path, is_video }
  if (contentType.includes("application/json")) {
    const body = await req.json() as {
      target_type: "archetype" | "item" | "material" | "marker" | "light" | "pin_theme" | "siegel" | "potion" | "rank";
      target_id: string;
      path: string;
      is_video: boolean;
      variant?: "neutral" | "male" | "female";
    };
    if (!body.target_id || !body.path) return NextResponse.json({ error: "missing_params" }, { status: 400 });
    if (!["archetype", "item", "material", "marker", "light", "pin_theme", "siegel", "potion", "rank"].includes(body.target_type)) return NextResponse.json({ error: "bad_target_type" }, { status: 400 });

    const { data: pub } = sb.storage.from("artwork").getPublicUrl(body.path);
    const publicUrl = pub.publicUrl;

    if (body.target_type !== "archetype" && body.target_type !== "item" && body.target_type !== "material") {
      const col = body.is_video ? "video_url" : "image_url";
      const variant = body.target_type === "marker"
        ? (body.variant && ["neutral","male","female"].includes(body.variant) ? body.variant : "neutral")
        : "neutral";
      const { error: dbErr } = await adminSb().from("cosmetic_artwork").upsert({
        kind: body.target_type, slot_id: body.target_id, variant, [col]: publicUrl, updated_at: new Date().toISOString(),
      }, { onConflict: "kind,slot_id,variant" });
      if (dbErr) return NextResponse.json({ error: dbErr.message }, { status: 500 });
      return NextResponse.json({ ok: true, image_url: body.is_video ? null : publicUrl, video_url: body.is_video ? publicUrl : null, is_video: body.is_video, variant });
    }

    const table = body.target_type === "archetype"
      ? "guardian_archetypes"
      : body.target_type === "material"
        ? "material_catalog"
        : "item_catalog";
    // archetype + material erlauben sowohl Bild als auch Video; item nur Bild
    const allowsVideo = body.target_type === "archetype" || body.target_type === "material";
    const updatePayload = (body.is_video && allowsVideo)
      ? { video_url: publicUrl }
      : { image_url: publicUrl };
    // Service-Role — diese Kataloge haben keine UPDATE-RLS-Policy fuer Endnutzer
    const { data: updatedRows, error: dbErr } = await adminSb().from(table).update(updatePayload).eq("id", body.target_id).select();
    const hintMigration = body.target_type === "material"
      ? "Migration 00066_material_artwork_columns.sql im Supabase SQL Editor ausführen."
      : "Migration 00036_artwork_columns.sql im Supabase SQL Editor ausführen.";
    if (dbErr) return NextResponse.json({ error: dbErr.message, hint: dbErr.message?.includes("column") ? hintMigration : undefined }, { status: 500 });
    if (!updatedRows || updatedRows.length === 0) {
      return NextResponse.json({ error: `kein Eintrag mit id="${body.target_id}" in ${table}` }, { status: 404 });
    }
    // Sicherheitscheck: wurde die Spalte wirklich persistiert?
    const row = updatedRows[0] as Record<string, unknown>;
    const expectedCol = body.is_video && allowsVideo ? "video_url" : "image_url";
    if (row[expectedCol] !== publicUrl) {
      return NextResponse.json({
        error: `DB-Update lief durch, aber ${expectedCol} wurde nicht gesetzt (Spalte existiert vermutlich nicht). ${hintMigration}`,
        got: row[expectedCol],
        expected: publicUrl,
      }, { status: 500 });
    }

    const isVideoFinal = body.is_video && allowsVideo;
    return NextResponse.json({ ok: true, image_url: isVideoFinal ? null : publicUrl, video_url: isVideoFinal ? publicUrl : null, is_video: isVideoFinal });
  }

  // ─── Pfad B: Legacy Multipart-Form Upload (nur fuer kleine Bilder <4.5 MB) ───
  const form = await req.formData();
  const file = form.get("file") as File | null;
  const targetType = form.get("target_type") as string;
  const targetId   = form.get("target_id") as string;

  if (!file) return NextResponse.json({ error: "file_missing" }, { status: 400 });
  if (!["archetype", "item"].includes(targetType)) return NextResponse.json({ error: "bad_target_type" }, { status: 400 });
  if (!targetId) return NextResponse.json({ error: "target_id_missing" }, { status: 400 });

  const ext = (file.name.split(".").pop() || "png").toLowerCase();
  const safeId = targetId.replace(/[^a-z0-9_-]/gi, "_");
  const isVideo = (file.type || "").startsWith("video/") || ["mp4", "webm", "mov"].includes(ext);
  const folder = targetType === "archetype"
    ? "archetypes"
    : "items";
  const path = `${folder}/${safeId}.${ext}`;

  const buf = Buffer.from(await file.arrayBuffer());
  const { error: upErr } = await sb.storage.from("artwork").upload(path, buf, {
    contentType: file.type || (isVideo ? "video/mp4" : "image/png"),
    upsert: true,
  });
  if (upErr) return NextResponse.json({ error: upErr.message }, { status: 500 });

  const { data: pub } = sb.storage.from("artwork").getPublicUrl(path);
  const publicUrl = pub.publicUrl;

  const table = targetType === "archetype" ? "guardian_archetypes" : "item_catalog";
  const updatePayload = (isVideo && targetType === "archetype")
    ? { video_url: publicUrl }
    : { image_url: publicUrl };
  const { error: dbErr } = await adminSb().from(table).update(updatePayload).eq("id", targetId);
  if (dbErr) return NextResponse.json({ error: dbErr.message }, { status: 500 });

  return NextResponse.json({ ok: true, image_url: isVideo ? null : publicUrl, video_url: isVideo ? publicUrl : null, is_video: isVideo });
}

/**
 * DELETE /api/admin/artwork?target_type=X&target_id=Y
 * Entfernt Bild aus Storage und setzt image_url=null.
 */
export async function DELETE(req: Request) {
  await requireAdmin();
  const sb = await createClient();
  const url = new URL(req.url);
  const targetType = url.searchParams.get("target_type") || "";
  const targetId   = url.searchParams.get("target_id") || "";
  if (!["archetype", "item", "material"].includes(targetType) || !targetId) return NextResponse.json({ error: "bad_request" }, { status: 400 });

  const table = targetType === "archetype"
    ? "guardian_archetypes"
    : targetType === "material"
      ? "material_catalog"
      : "item_catalog";
  const allowsVideo = targetType === "archetype" || targetType === "material";
  const selectCols = allowsVideo ? "image_url, video_url" : "image_url";
  const { data: row } = await sb.from(table).select(selectCols).eq("id", targetId).maybeSingle<{ image_url: string | null; video_url?: string | null }>();
  const urlsToRemove: string[] = [];
  if (row?.image_url) urlsToRemove.push(row.image_url);
  if (row?.video_url) urlsToRemove.push(row.video_url);
  for (const url of urlsToRemove) {
    const m = url.match(/\/artwork\/(.+)$/);
    if (m) await sb.storage.from("artwork").remove([m[1]]);
  }
  const clearPayload = allowsVideo ? { image_url: null, video_url: null } : { image_url: null };
  await adminSb().from(table).update(clearPayload).eq("id", targetId);
  return NextResponse.json({ ok: true });
}
