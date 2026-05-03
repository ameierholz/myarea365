import { NextResponse } from "next/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { requireAdmin } from "@/lib/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function adminSb() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Supabase admin creds missing");
  return createAdminClient(url, key, { auth: { persistSession: false } });
}

/**
 * POST /api/admin/artwork/sign
 * Body: { target_type: "archetype"|"item", target_id, file_name, content_type }
 * Returns: { upload_url, token, path, is_video }
 *
 * Generiert eine Signed-Upload-URL mit Service-Role — der Client lädt dann
 * direkt zu Supabase Storage. Umgeht das 4.5 MB Body-Limit von Vercel für Videos.
 */
export async function POST(req: Request) {
  await requireAdmin();
  const sb = adminSb();

  const body = await req.json() as {
    target_type: "archetype" | "item" | "material" | "marker" | "light" | "pin_theme" | "siegel" | "potion" | "rank" | "base_theme" | "building" | "resource" | "chest" | "stronghold" | "ui_icon" | "troop" | "nameplate" | "base_ring" | "loot_drop" | "resource_node";
    target_id: string;
    file_name: string;
    content_type: string;
    variant?: "neutral" | "male" | "female";
  };

  if (!body.target_id || !body.file_name) {
    return NextResponse.json({ error: "missing_params" }, { status: 400 });
  }
  if (!["archetype", "item", "material", "marker", "light", "pin_theme", "siegel", "potion", "rank", "base_theme", "building", "resource", "chest", "stronghold", "ui_icon", "troop", "nameplate", "base_ring", "loot_drop", "resource_node"].includes(body.target_type)) {
    return NextResponse.json({ error: "bad_target_type" }, { status: 400 });
  }

  const ext = (body.file_name.split(".").pop() || "png").toLowerCase();
  const safeId = body.target_id.replace(/[^a-z0-9_-]/gi, "_");
  const variant = body.variant && ["neutral","male","female"].includes(body.variant) ? body.variant : "neutral";
  const isVideo = (body.content_type || "").startsWith("video/") || ["mp4", "webm", "mov"].includes(ext);

  // Bild + Video liegen im selben Folder — unterscheiden sich über die Endung.
  // Die alte Subfolder-Trennung (/video/) hatte Bucket-Policy-Probleme bei neuen Pfaden.
  const folderMap: Record<string, string> = {
    archetype: "archetypes",
    item:      "items",
    material:  "materials",
    marker:    "markers",
    light:     "lights",
    pin_theme: "pin-themes",
    siegel:    "siegel",
    potion:    "potions",
    rank:      "ranks",
    base_theme: "base-themes",
    building:   "buildings",
    resource:   "resources",
    chest:      "chests",
    stronghold: "strongholds",
    ui_icon:    "ui-icons",
    troop:      "troops",
    nameplate:    "nameplates",
    base_ring:    "base-rings",
    loot_drop:    "loot-drops",
    resource_node:"resource-nodes",
    inventory_item:"inventory-items",
  };
  const folder = folderMap[body.target_type] ?? "items";
  const filename = body.target_type === "marker" ? `${safeId}_${variant}.${ext}` : `${safeId}.${ext}`;
  const path = `${folder}/${filename}`;

  const { data, error } = await sb.storage.from("artwork").createSignedUploadUrl(path, { upsert: true });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({
    upload_url: data.signedUrl,
    token: data.token,
    path: data.path,
    is_video: isVideo,
    variant,
  });
}
