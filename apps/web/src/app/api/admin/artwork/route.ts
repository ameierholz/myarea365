import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/admin/artwork
 * Listet alle Wächter-Archetypen + alle Items mit aktuellem image_url.
 */
export async function GET() {
  await requireAdmin();
  const sb = await createClient();
  const [arch, items, races] = await Promise.all([
    sb.from("guardian_archetypes").select("id, name, emoji, rarity, guardian_type, role, ability_name, lore, image_url, video_url").order("rarity").order("name"),
    sb.from("item_catalog").select("id, name, emoji, slot, rarity, image_url, cosmetic_only, race").order("race", { nullsFirst: true }).order("slot").order("rarity").order("name"),
    sb.from("races_catalog").select("name, role, lore, material_desc, energy_color").order("role").order("name"),
  ]);
  return NextResponse.json({
    archetypes: arch.data ?? [],
    items:      items.data ?? [],
    races:      races.data ?? [],
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
      target_type: "archetype" | "item";
      target_id: string;
      path: string;
      is_video: boolean;
    };
    if (!body.target_id || !body.path) return NextResponse.json({ error: "missing_params" }, { status: 400 });
    if (!["archetype", "item"].includes(body.target_type)) return NextResponse.json({ error: "bad_target_type" }, { status: 400 });

    const { data: pub } = sb.storage.from("artwork").getPublicUrl(body.path);
    const publicUrl = pub.publicUrl;

    const table = body.target_type === "archetype" ? "guardian_archetypes" : "item_catalog";
    const updatePayload = (body.is_video && body.target_type === "archetype")
      ? { video_url: publicUrl }
      : { image_url: publicUrl };
    const { error: dbErr } = await sb.from(table).update(updatePayload).eq("id", body.target_id);
    if (dbErr) return NextResponse.json({ error: dbErr.message }, { status: 500 });

    return NextResponse.json({ ok: true, image_url: body.is_video ? null : publicUrl, video_url: body.is_video ? publicUrl : null, is_video: body.is_video });
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
    ? (isVideo ? "archetypes/video" : "archetypes")
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
  const { error: dbErr } = await sb.from(table).update(updatePayload).eq("id", targetId);
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
  if (!["archetype", "item"].includes(targetType) || !targetId) return NextResponse.json({ error: "bad_request" }, { status: 400 });

  const table = targetType === "archetype" ? "guardian_archetypes" : "item_catalog";
  const selectCols = targetType === "archetype" ? "image_url, video_url" : "image_url";
  const { data: row } = await sb.from(table).select(selectCols).eq("id", targetId).maybeSingle<{ image_url: string | null; video_url?: string | null }>();
  const urlsToRemove: string[] = [];
  if (row?.image_url) urlsToRemove.push(row.image_url);
  if (row?.video_url) urlsToRemove.push(row.video_url);
  for (const url of urlsToRemove) {
    const m = url.match(/\/artwork\/(.+)$/);
    if (m) await sb.storage.from("artwork").remove([m[1]]);
  }
  const clearPayload = targetType === "archetype" ? { image_url: null, video_url: null } : { image_url: null };
  await sb.from(table).update(clearPayload).eq("id", targetId);
  return NextResponse.json({ ok: true });
}
