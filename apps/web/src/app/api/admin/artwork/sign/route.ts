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
    target_type: "archetype" | "item" | "marker" | "light" | "pin_theme" | "siegel" | "potion" | "rank";
    target_id: string;
    file_name: string;
    content_type: string;
    variant?: "neutral" | "male" | "female";
  };

  if (!body.target_id || !body.file_name) {
    return NextResponse.json({ error: "missing_params" }, { status: 400 });
  }
  if (!["archetype", "item", "marker", "light", "pin_theme", "siegel", "potion", "rank"].includes(body.target_type)) {
    return NextResponse.json({ error: "bad_target_type" }, { status: 400 });
  }

  const ext = (body.file_name.split(".").pop() || "png").toLowerCase();
  const safeId = body.target_id.replace(/[^a-z0-9_-]/gi, "_");
  const variant = body.variant && ["neutral","male","female"].includes(body.variant) ? body.variant : "neutral";
  const isVideo = (body.content_type || "").startsWith("video/") || ["mp4", "webm", "mov"].includes(ext);

  const folderMap: Record<string, string> = {
    archetype: isVideo ? "archetypes/video" : "archetypes",
    item:      "items",
    marker:    isVideo ? "markers/video" : "markers",
    light:     isVideo ? "lights/video" : "lights",
    pin_theme: isVideo ? "pin-themes/video" : "pin-themes",
    siegel:    isVideo ? "siegel/video" : "siegel",
    potion:    isVideo ? "potions/video" : "potions",
    rank:      isVideo ? "ranks/video" : "ranks",
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
