import { NextResponse } from "next/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function adminSb() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Supabase admin creds missing");
  return createAdminClient(url, key, { auth: { persistSession: false } });
}

type Kind = "banner" | "logo";

/**
 * POST /api/crew/media
 * Body:
 *   { action: "sign",     kind, crew_id, file_name, content_type } -> { upload_url, path }
 *   { action: "finalize", kind, crew_id, path }                    -> { ok, url, status, rejection? }
 *   { action: "delete",   kind, crew_id }                          -> { ok }
 *
 * Berechtigt: nur crew.owner_id
 */
export async function POST(req: Request) {
  const sb = await createClient();
  const { data: auth } = await sb.auth.getUser();
  if (!auth?.user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = await req.json() as
    | { action: "sign"; kind: Kind; crew_id: string; file_name: string; content_type: string }
    | { action: "finalize"; kind: Kind; crew_id: string; path: string }
    | { action: "delete"; kind: Kind; crew_id: string };

  const admin = adminSb();

  // Nur Crew-Owner darf Medien ändern
  const { data: crew } = await sb.from("crews").select("owner_id").eq("id", body.crew_id).maybeSingle<{ owner_id: string }>();
  if (!crew || crew.owner_id !== auth.user.id) {
    return NextResponse.json({ error: "forbidden", detail: "Nur der Crew-Gründer darf Medien ändern." }, { status: 403 });
  }

  const kind = body.kind;
  const urlField    = kind === "banner" ? "custom_banner_url"    : "custom_logo_url";
  const statusField = kind === "banner" ? "custom_banner_status" : "custom_logo_status";
  const reasonField = kind === "banner" ? "custom_banner_rejection_reason" : "custom_logo_rejection_reason";

  if (body.action === "sign") {
    const ext = (body.file_name.split(".").pop() || "jpg").toLowerCase();
    const path = `crews/${body.crew_id}-${kind}.${ext}`;
    const { data, error } = await admin.storage.from("artwork").createSignedUploadUrl(path, { upsert: true });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ upload_url: data.signedUrl, token: data.token, path: data.path });
  }

  if (body.action === "finalize") {
    const { data: pub } = admin.storage.from("artwork").getPublicUrl(body.path);
    const url = `${pub.publicUrl}?v=${Date.now()}`;

    // KI-Vormoderation
    const { moderateImageUrl } = await import("@/lib/ai-moderation");
    const mod = await moderateImageUrl(url);
    const newStatus = mod.approved === true ? "approved" : mod.approved === false ? "rejected" : "pending";
    const rejection = mod.approved === false ? `KI-Vorfilter: ${mod.reason ?? "unerlaubter Inhalt"}` : null;

    const { error } = await sb.from("crews").update({
      [urlField]: url, [statusField]: newStatus, [reasonField]: rejection,
    }).eq("id", body.crew_id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, url, status: newStatus, rejection });
  }

  if (body.action === "delete") {
    const { data: row } = await sb.from("crews").select(urlField).eq("id", body.crew_id).maybeSingle<Record<string, string | null>>();
    const currentUrl = row?.[urlField];
    if (currentUrl) {
      const m = currentUrl.match(/\/artwork\/(.+?)(\?|$)/);
      if (m) await admin.storage.from("artwork").remove([m[1]]);
    }
    await sb.from("crews").update({ [urlField]: null, [statusField]: "approved", [reasonField]: null }).eq("id", body.crew_id);
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "bad_action" }, { status: 400 });
}
