import { NextResponse } from "next/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { requireAdmin } from "@/lib/admin";
import { TABLE_TARGETS, COSMETIC_TARGETS, type ArtworkTargetType } from "@/lib/artwork-targets";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function adminSb() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Supabase admin creds missing");
  return createAdminClient(url, key, { auth: { persistSession: false } });
}

// Cosmetic-Targets benutzen feste Folder-Namen; hier zentral festgehalten.
// (TABLE_TARGETS bringt ihren Folder selbst mit.)
const COSMETIC_FOLDER_MAP: Record<string, string> = {
  marker: "markers", light: "lights", pin_theme: "pin-themes", siegel: "siegel",
  potion: "potions", rank: "ranks", base_theme: "base-themes", building: "buildings",
  resource: "resources", chest: "chests", stronghold: "strongholds", ui_icon: "ui-icons",
  troop: "troops", nameplate: "nameplates", base_ring: "base-rings", loot_drop: "loot-drops",
  resource_node: "resource-nodes", inventory_item: "inventory-items", modal_background: "modal-backgrounds",
};

function folderForTarget(targetType: string): string | null {
  if (targetType in TABLE_TARGETS) return TABLE_TARGETS[targetType].folder;
  return COSMETIC_FOLDER_MAP[targetType] ?? null;
}

const ALL_TARGETS: string[] = [...Object.keys(TABLE_TARGETS), ...COSMETIC_TARGETS];

export async function POST(req: Request) {
  await requireAdmin();
  const sb = adminSb();

  const body = await req.json() as {
    target_type: ArtworkTargetType;
    target_id: string;
    file_name: string;
    content_type: string;
    variant?: "neutral" | "male" | "female";
  };

  if (!body.target_id || !body.file_name) {
    return NextResponse.json({ error: "missing_params" }, { status: 400 });
  }
  if (!ALL_TARGETS.includes(body.target_type)) {
    return NextResponse.json({ error: "bad_target_type" }, { status: 400 });
  }

  const ext = (body.file_name.split(".").pop() || "png").toLowerCase();
  const safeId = body.target_id.replace(/[^a-z0-9_-]/gi, "_");
  const variant = body.variant && ["neutral","male","female"].includes(body.variant) ? body.variant : "neutral";
  const isVideo = (body.content_type || "").startsWith("video/") || ["mp4", "webm", "mov"].includes(ext);

  const folder = folderForTarget(body.target_type);
  if (!folder) return NextResponse.json({ error: "unknown_folder" }, { status: 400 });
  // Marker hat per-variant Files (male/female/neutral)
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
