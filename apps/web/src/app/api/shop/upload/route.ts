import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as createAdminSb, type SupabaseClient } from "@supabase/supabase-js";

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

const ALLOWED = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);
const MAX_BYTES = 5 * 1024 * 1024;

/**
 * POST /api/shop/upload
 * Multipart-Form mit Feldern:
 *   - file:   Image-File (max 5 MB, JPEG/PNG/WEBP/GIF)
 *   - shop_id: UUID des Shops
 *   - kind:   "logo" | "cover"
 *
 * Owner-Check erfolgt serverseitig gegen local_businesses.owner_id.
 * Datei wird im Bucket "shop-media" unter {shop_id}/{kind}-{ts}.{ext} abgelegt.
 * Im Erfolg wird local_businesses.{logo_url|cover_url} aktualisiert.
 */
export async function POST(req: NextRequest) {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ ok: false, error: "auth" }, { status: 401 });

  const form = await req.formData();
  const file = form.get("file");
  const shopId = String(form.get("shop_id") ?? "");
  const kind = String(form.get("kind") ?? "logo") as "logo" | "cover";

  if (!shopId) return NextResponse.json({ ok: false, error: "missing_shop_id" }, { status: 400 });
  if (!["logo", "cover"].includes(kind)) {
    return NextResponse.json({ ok: false, error: "invalid_kind" }, { status: 400 });
  }
  if (!(file instanceof File)) {
    return NextResponse.json({ ok: false, error: "missing_file" }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ ok: false, error: "file_too_large", max_mb: 5 }, { status: 400 });
  }
  if (!ALLOWED.has(file.type)) {
    return NextResponse.json({ ok: false, error: "invalid_mime", allowed: Array.from(ALLOWED) }, { status: 400 });
  }

  // Owner-Check
  const { data: shop } = await sb.from("local_businesses")
    .select("id, logo_url, cover_url").eq("id", shopId).eq("owner_id", user.id).maybeSingle();
  if (!shop) return NextResponse.json({ ok: false, error: "not_owner" }, { status: 403 });

  const ext = file.type.split("/")[1].replace("jpeg", "jpg");
  const path = `${shopId}/${kind}-${Date.now()}.${ext}`;

  const admin = adminSb();
  const buffer = Buffer.from(await file.arrayBuffer());
  const { error: upErr } = await admin.storage
    .from("shop-media")
    .upload(path, buffer, { contentType: file.type, cacheControl: "3600", upsert: false });
  if (upErr) return NextResponse.json({ ok: false, error: upErr.message }, { status: 500 });

  const { data: pub } = admin.storage.from("shop-media").getPublicUrl(path);
  const publicUrl = pub.publicUrl;

  const patch: Record<string, string> = {};
  patch[kind === "logo" ? "logo_url" : "cover_url"] = publicUrl;
  const { error: updErr } = await admin.from("local_businesses")
    .update(patch).eq("id", shopId);
  if (updErr) return NextResponse.json({ ok: false, error: updErr.message }, { status: 500 });

  // Alten Blob wegräumen (best-effort). Path muss streng im Shop-Ordner liegen.
  const oldUrl = kind === "logo" ? shop.logo_url : shop.cover_url;
  if (oldUrl && typeof oldUrl === "string") {
    try {
      const match = oldUrl.match(/\/storage\/v1\/object\/public\/shop-media\/([^?#]+)$/);
      const oldPath = match?.[1];
      // Nur löschen, wenn Path wirklich mit diesem Shop-Ordner beginnt (kein Traversal).
      if (oldPath && oldPath.startsWith(`${shopId}/`) && !oldPath.includes("..")) {
        await admin.storage.from("shop-media").remove([oldPath]);
      }
    } catch {
      /* ignore */
    }
  }

  return NextResponse.json({ ok: true, url: publicUrl });
}
