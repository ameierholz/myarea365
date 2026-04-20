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

export async function POST(req: Request) {
  const sb = await createClient();
  const { data: auth } = await sb.auth.getUser();
  if (!auth?.user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = await req.json() as
    | { action: "sign"; file_name: string; content_type: string }
    | { action: "finalize"; path: string }
    | { action: "delete" };

  const admin = adminSb();

  if (body.action === "sign") {
    const ext = (body.file_name.split(".").pop() || "jpg").toLowerCase();
    const path = `avatars/${auth.user.id}.${ext}`;
    const { data, error } = await admin.storage.from("artwork").createSignedUploadUrl(path, { upsert: true });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ upload_url: data.signedUrl, token: data.token, path: data.path });
  }

  if (body.action === "finalize") {
    const { data: pub } = admin.storage.from("artwork").getPublicUrl(body.path);
    const url = `${pub.publicUrl}?v=${Date.now()}`;
    const { error } = await sb.from("users").update({
      avatar_url: url, avatar_status: "pending", media_rejection_reason: null,
    }).eq("id", auth.user.id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, avatar_url: url, status: "pending" });
  }

  if (body.action === "delete") {
    const { data: row } = await sb.from("users").select("avatar_url").eq("id", auth.user.id).maybeSingle<{ avatar_url: string | null }>();
    if (row?.avatar_url) {
      const m = row.avatar_url.match(/\/artwork\/(.+?)(\?|$)/);
      if (m) await admin.storage.from("artwork").remove([m[1]]);
    }
    await sb.from("users").update({ avatar_url: null, avatar_status: "approved" }).eq("id", auth.user.id);
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "bad_action" }, { status: 400 });
}
