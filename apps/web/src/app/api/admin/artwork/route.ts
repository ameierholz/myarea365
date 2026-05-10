import { NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createClient as createAdminSb, type SupabaseClient } from "@supabase/supabase-js";
import { requireAdmin } from "@/lib/admin";
import { TABLE_TARGETS, COSMETIC_TARGETS, type ArtworkTargetType } from "@/lib/artwork-targets";

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

const ALL_TARGETS: string[] = [...Object.keys(TABLE_TARGETS), ...COSMETIC_TARGETS];
const COSMETIC_SET = new Set<string>(COSMETIC_TARGETS);

/**
 * GET /api/admin/artwork
 * Listet bestehende Wächter/Items/Materialien — bleibt für Backwards-Compat.
 * Neue Entity-Listen kommen über /api/admin/artwork-entities/[type].
 */
export async function GET() {
  await requireAdmin();
  const sb = await createClient();
  const [arch, items, races, materials] = await Promise.all([
    sb.from("guardian_archetypes").select("id, name, emoji, rarity, guardian_type, class_id, role, species, gender, ability_name, lore, image_url, video_url, faction, wave_number").order("wave_number", { nullsFirst: false }).order("rarity").order("name"),
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
 * Finalize nach Direct-Upload (Signed URL).
 * Body: { target_type, target_id, path, is_video, variant? }
 */
export async function POST(req: Request) {
  await requireAdmin();
  const sb = await createClient();

  const contentType = req.headers.get("content-type") || "";

  if (contentType.includes("application/json")) {
    const body = await req.json() as {
      target_type: ArtworkTargetType;
      target_id: string;
      path: string;
      is_video: boolean;
      variant?: "neutral" | "male" | "female";
    };
    if (!body.target_id || !body.path) return NextResponse.json({ error: "missing_params" }, { status: 400 });
    if (!ALL_TARGETS.includes(body.target_type)) return NextResponse.json({ error: "bad_target_type" }, { status: 400 });

    const { data: pub } = sb.storage.from("artwork").getPublicUrl(body.path);
    const publicUrl = pub.publicUrl;

    // ── Cosmetic-Targets: cosmetic_artwork-Tabelle (kind, slot_id, variant) ──
    if (COSMETIC_SET.has(body.target_type)) {
      const col = body.is_video ? "video_url" : "image_url";
      const variant = body.target_type === "marker"
        ? (body.variant && ["neutral","male","female"].includes(body.variant) ? body.variant : "neutral")
        : "neutral";
      const { error: dbErr } = await adminSb().from("cosmetic_artwork").upsert({
        kind: body.target_type, slot_id: body.target_id, variant, [col]: publicUrl, updated_at: new Date().toISOString(),
      }, { onConflict: "kind,slot_id,variant" });
      if (dbErr) return NextResponse.json({ error: dbErr.message }, { status: 500 });
      revalidateTag("cosmetic-artwork", { expire: 0 });
      return NextResponse.json({ ok: true, image_url: body.is_video ? null : publicUrl, video_url: body.is_video ? publicUrl : null, is_video: body.is_video, variant });
    }

    // ── Table-Targets: image_url / video_url Spalte direkt in der Entity-Tabelle ──
    const spec = TABLE_TARGETS[body.target_type];
    if (!spec) return NextResponse.json({ error: "unknown_target" }, { status: 400 });
    const isVideoFinal = body.is_video && spec.allowsVideo;
    const updatePayload = isVideoFinal ? { video_url: publicUrl } : { image_url: publicUrl };
    const { data: updatedRows, error: dbErr } = await adminSb().from(spec.table).update(updatePayload).eq("id", body.target_id).select();
    if (dbErr) return NextResponse.json({ error: dbErr.message }, { status: 500 });
    if (!updatedRows || updatedRows.length === 0) {
      return NextResponse.json({ error: `kein Eintrag mit id="${body.target_id}" in ${spec.table}` }, { status: 404 });
    }
    return NextResponse.json({ ok: true, image_url: isVideoFinal ? null : publicUrl, video_url: isVideoFinal ? publicUrl : null, is_video: isVideoFinal });
  }

  // ─── Pfad B: Legacy Multipart-Form Upload (nur fuer kleine Bilder <4.5 MB) ───
  const form = await req.formData();
  const file = form.get("file") as File | null;
  const targetType = form.get("target_type") as ArtworkTargetType;
  const targetId   = form.get("target_id") as string;

  if (!file) return NextResponse.json({ error: "file_missing" }, { status: 400 });
  if (!ALL_TARGETS.includes(targetType)) return NextResponse.json({ error: "bad_target_type" }, { status: 400 });
  if (!targetId) return NextResponse.json({ error: "target_id_missing" }, { status: 400 });
  // Legacy nur für Tabellen-Targets (cosmetic_artwork verlangt Variant-Handling)
  const spec = TABLE_TARGETS[targetType];
  if (!spec) return NextResponse.json({ error: "use_signed_upload_for_cosmetic" }, { status: 400 });

  const ext = (file.name.split(".").pop() || "png").toLowerCase();
  const safeId = targetId.replace(/[^a-z0-9_-]/gi, "_");
  const isVideo = (file.type || "").startsWith("video/") || ["mp4", "webm", "mov"].includes(ext);
  const path = `${spec.folder}/${safeId}.${ext}`;

  const buf = Buffer.from(await file.arrayBuffer());
  const { error: upErr } = await sb.storage.from("artwork").upload(path, buf, {
    contentType: file.type || (isVideo ? "video/mp4" : "image/png"),
    upsert: true,
  });
  if (upErr) return NextResponse.json({ error: upErr.message }, { status: 500 });

  const { data: pub } = sb.storage.from("artwork").getPublicUrl(path);
  const publicUrl = pub.publicUrl;

  const isVideoFinal = isVideo && spec.allowsVideo;
  const updatePayload = isVideoFinal ? { video_url: publicUrl } : { image_url: publicUrl };
  const { error: dbErr } = await adminSb().from(spec.table).update(updatePayload).eq("id", targetId);
  if (dbErr) return NextResponse.json({ error: dbErr.message }, { status: 500 });

  return NextResponse.json({ ok: true, image_url: isVideoFinal ? null : publicUrl, video_url: isVideoFinal ? publicUrl : null, is_video: isVideoFinal });
}

/**
 * DELETE /api/admin/artwork?target_type=X&target_id=Y
 * Entfernt Bild aus Storage und setzt image_url/video_url=null.
 */
export async function DELETE(req: Request) {
  await requireAdmin();
  const sb = await createClient();
  const url = new URL(req.url);
  const targetType = url.searchParams.get("target_type") || "";
  const targetId   = url.searchParams.get("target_id") || "";
  const variant    = url.searchParams.get("variant") || "neutral";
  const clear      = url.searchParams.get("clear") || "all"; // "image" | "video" | "all"
  if (!targetId) return NextResponse.json({ error: "bad_request" }, { status: 400 });

  // ── Cosmetic ──
  if (COSMETIC_SET.has(targetType)) {
    const { data: row } = await adminSb().from("cosmetic_artwork")
      .select("image_url, video_url")
      .eq("kind", targetType).eq("slot_id", targetId).eq("variant", variant)
      .maybeSingle<{ image_url: string | null; video_url: string | null }>();
    const urlsToRemove: string[] = [];
    if ((clear === "all" || clear === "image") && row?.image_url) urlsToRemove.push(row.image_url);
    if ((clear === "all" || clear === "video") && row?.video_url) urlsToRemove.push(row.video_url);
    for (const u of urlsToRemove) {
      const m = u.match(/\/artwork\/(.+)$/);
      if (m) await sb.storage.from("artwork").remove([m[1]]);
    }
    const payload: Record<string, null | string> = { updated_at: new Date().toISOString() };
    if (clear === "all" || clear === "image") payload.image_url = null;
    if (clear === "all" || clear === "video") payload.video_url = null;
    await adminSb().from("cosmetic_artwork").update(payload).eq("kind", targetType).eq("slot_id", targetId).eq("variant", variant);
    revalidateTag("cosmetic-artwork", { expire: 0 });
    return NextResponse.json({ ok: true });
  }

  // ── Table ──
  const spec = TABLE_TARGETS[targetType];
  if (!spec) return NextResponse.json({ error: "bad_request" }, { status: 400 });

  const selectCols = spec.allowsVideo ? "image_url, video_url" : "image_url";
  const { data: row } = await sb.from(spec.table).select(selectCols).eq("id", targetId).maybeSingle<{ image_url: string | null; video_url?: string | null }>();
  const urlsToRemove: string[] = [];
  if ((clear === "all" || clear === "image") && row?.image_url) urlsToRemove.push(row.image_url);
  if ((clear === "all" || clear === "video") && spec.allowsVideo && row?.video_url) urlsToRemove.push(row.video_url);
  for (const u of urlsToRemove) {
    const m = u.match(/\/artwork\/(.+)$/);
    if (m) await sb.storage.from("artwork").remove([m[1]]);
  }
  const payload: Record<string, null> = {};
  if (clear === "all" || clear === "image") payload.image_url = null;
  if (spec.allowsVideo && (clear === "all" || clear === "video")) payload.video_url = null;
  await adminSb().from(spec.table).update(payload).eq("id", targetId);
  return NextResponse.json({ ok: true });
}
