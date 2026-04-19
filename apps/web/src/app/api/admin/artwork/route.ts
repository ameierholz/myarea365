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
    sb.from("guardian_archetypes").select("id, name, emoji, rarity, guardian_type, role, ability_name, lore, image_url").order("rarity").order("name"),
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

  const form = await req.formData();
  const file = form.get("file") as File | null;
  const targetType = form.get("target_type") as string;
  const targetId   = form.get("target_id") as string;

  if (!file) return NextResponse.json({ error: "file_missing" }, { status: 400 });
  if (!["archetype", "item"].includes(targetType)) return NextResponse.json({ error: "bad_target_type" }, { status: 400 });
  if (!targetId) return NextResponse.json({ error: "target_id_missing" }, { status: 400 });

  const ext = (file.name.split(".").pop() || "png").toLowerCase();
  const safeId = targetId.replace(/[^a-z0-9_-]/gi, "_");
  const path = targetType === "archetype"
    ? `archetypes/${safeId}.${ext}`
    : `items/${safeId}.${ext}`;

  // Upload (upsert)
  const buf = Buffer.from(await file.arrayBuffer());
  const { error: upErr } = await sb.storage.from("artwork").upload(path, buf, {
    contentType: file.type || "image/png",
    upsert: true,
  });
  if (upErr) return NextResponse.json({ error: upErr.message }, { status: 500 });

  const { data: pub } = sb.storage.from("artwork").getPublicUrl(path);
  const imageUrl = pub.publicUrl;

  const table = targetType === "archetype" ? "guardian_archetypes" : "item_catalog";
  const { error: dbErr } = await sb.from(table).update({ image_url: imageUrl }).eq("id", targetId);
  if (dbErr) return NextResponse.json({ error: dbErr.message }, { status: 500 });

  return NextResponse.json({ ok: true, image_url: imageUrl });
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
  const { data: row } = await sb.from(table).select("image_url").eq("id", targetId).maybeSingle<{ image_url: string | null }>();
  if (row?.image_url) {
    // Extract path after /artwork/
    const m = row.image_url.match(/\/artwork\/(.+)$/);
    if (m) await sb.storage.from("artwork").remove([m[1]]);
  }
  await sb.from(table).update({ image_url: null }).eq("id", targetId);
  return NextResponse.json({ ok: true });
}
