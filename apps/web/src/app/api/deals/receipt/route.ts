import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { extractReceiptAmount, isReceiptAmountValid } from "@/lib/ai-receipt";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Body = {
  redemption_id: string;
  amount_cents: number;
  receipt_image_base64: string;
  content_type: string;
};

/**
 * POST /api/deals/receipt
 * Runner lädt Kassenbon hoch nach Einlösung. KI-OCR prüft Betrag,
 * dann wird Bonus-Loot abhängig vom verifizierten Betrag gewährt.
 */
export async function POST(req: NextRequest) {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ ok: false, error: "Nicht eingeloggt" }, { status: 401 });

  const body = await req.json() as Body;
  if (!body.redemption_id || !body.amount_cents || !body.receipt_image_base64) {
    return NextResponse.json({ ok: false, error: "missing_params" }, { status: 400 });
  }
  if (body.amount_cents < 100 || body.amount_cents > 100000000) {
    return NextResponse.json({ ok: false, error: "invalid_amount" }, { status: 400 });
  }

  // Redemption gehört User + ist verified + noch keinen Bon eingereicht?
  const { data: red } = await sb.from("deal_redemptions")
    .select("id, user_id, status, verified_at, receipt_submitted_at, business_id")
    .eq("id", body.redemption_id)
    .maybeSingle<{ id: string; user_id: string; status: string; verified_at: string | null; receipt_submitted_at: string | null; business_id: string }>();
  if (!red || red.user_id !== user.id) return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });
  if (red.status !== "verified") return NextResponse.json({ ok: false, error: "not_verified_yet" }, { status: 400 });
  if (red.receipt_submitted_at) return NextResponse.json({ ok: false, error: "already_submitted" }, { status: 409 });

  // Rate-Limit: max 1 Bon pro Runner pro Shop pro Tag
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { count } = await sb.from("deal_redemptions")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id)
    .eq("business_id", red.business_id)
    .not("receipt_submitted_at", "is", null)
    .gte("receipt_submitted_at", since);
  if ((count ?? 0) >= 1) {
    return NextResponse.json({ ok: false, error: "daily_limit_reached", message: "Max. 1 Bonus-Bon pro Shop pro Tag." }, { status: 429 });
  }

  // Storage: Bon hochladen (admin client, geschützer Bucket 'receipts')
  const urlEnv = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const keyEnv = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!urlEnv || !keyEnv) return NextResponse.json({ ok: false, error: "server_misconfigured" }, { status: 500 });
  const admin = createAdminClient(urlEnv, keyEnv, { auth: { persistSession: false } });

  const ext = body.content_type.includes("png") ? "png" : body.content_type.includes("webp") ? "webp" : "jpg";
  const path = `${user.id}/${body.redemption_id}.${ext}`;
  const buf = Buffer.from(body.receipt_image_base64, "base64");
  if (buf.length > 6 * 1024 * 1024) {
    return NextResponse.json({ ok: false, error: "file_too_large", message: "Max. 6 MB." }, { status: 413 });
  }
  const { error: upErr } = await admin.storage.from("receipts").upload(path, buf, {
    contentType: body.content_type, upsert: true,
  });
  if (upErr) {
    // Bucket fehlt? Kurzer Versuch ihn anzulegen
    const { error: createErr } = await admin.storage.createBucket("receipts", { public: false });
    if (createErr && !createErr.message.includes("already exists")) {
      return NextResponse.json({ ok: false, error: "storage_failed", message: upErr.message }, { status: 500 });
    }
    const { error: retryErr } = await admin.storage.from("receipts").upload(path, buf, {
      contentType: body.content_type, upsert: true,
    });
    if (retryErr) return NextResponse.json({ ok: false, error: "storage_failed", message: retryErr.message }, { status: 500 });
  }

  // OCR prüfen
  const ocr = await extractReceiptAmount(body.receipt_image_base64, body.content_type);
  const verified = isReceiptAmountValid(body.amount_cents, ocr.amount_cents, ocr.confidence);

  // Bonus-Loot gewähren
  const { data: loot, error: lootErr } = await sb.rpc("grant_receipt_bonus_loot", {
    p_redemption_id: body.redemption_id,
    p_amount_cents: body.amount_cents,
    p_verified: verified,
  });
  if (lootErr) return NextResponse.json({ ok: false, error: lootErr.message }, { status: 500 });

  // Receipt-URL in Redemption speichern (signed URL für Admin-Review).
  // DSGVO: 7 Tage TTL — konsistent mit Zusage in Datenschutzerklärung. Storage-
  // Lifecycle-Rule im Supabase-Dashboard löscht das Objekt anschließend ebenfalls.
  const { data: signed } = await admin.storage.from("receipts").createSignedUrl(path, 60 * 60 * 24 * 7);
  await sb.from("deal_redemptions").update({
    receipt_url: signed?.signedUrl ?? null,
    receipt_ocr_amount_cents: ocr.amount_cents ?? null,
  }).eq("id", body.redemption_id);

  // Shop-Quests gegen erkannte Bon-Items matchen (nur bei verifiziertem Bon)
  let quests: unknown = null;
  if (verified && ocr.items && ocr.items.length > 0) {
    const { data: qmatch } = await sb.rpc("match_shop_quests", {
      p_user_id: user.id,
      p_business_id: red.business_id,
      p_redemption_id: body.redemption_id,
      p_items: ocr.items,
    });
    quests = qmatch;
  }

  return NextResponse.json({
    ok: true,
    loot,
    verified,
    ocr_amount_cents: ocr.amount_cents,
    ocr_confidence: ocr.confidence,
    ocr_reason: ocr.reason,
    ocr_items: ocr.items,
    quests,
  });
}
