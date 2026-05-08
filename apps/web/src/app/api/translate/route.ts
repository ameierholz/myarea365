import { NextResponse, type NextRequest } from "next/server";
import crypto from "node:crypto";
import { createClient } from "@/lib/supabase/server";
import { rateLimitSmart, rateLimitResponse } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/translate
 *
 * Body: { text, target_lang, source_lang? }
 *
 * Übersetzt User-Texte (Marker-Labels, Inbox-Messages, Chat) via MyMemory
 * und cacht das Ergebnis in `translation_cache`. Bei Cache-Hit instant
 * zurückgegeben, sonst MyMemory-Roundtrip + Insert.
 *
 * Rate-Limit: 200 Calls/Tag pro User. Bei Limit → 429.
 *
 * Response: { translated, source_lang, target_lang, cached, service }
 */
export async function POST(req: NextRequest) {
  const sb = await createClient();
  const { data: auth } = await sb.auth.getUser();
  if (!auth?.user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const limit = await rateLimitSmart(`translate:${auth.user.id}`, 200, 24 * 60 * 60 * 1000);
  const limitResp = rateLimitResponse(limit);
  if (limitResp) return limitResp;

  let body: { text?: string; target_lang?: string; source_lang?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const text = (body.text ?? "").toString().trim();
  const target = (body.target_lang ?? "").toString().toLowerCase().split("-")[0];
  const source = (body.source_lang ?? "de").toString().toLowerCase().split("-")[0];

  if (!text) return NextResponse.json({ error: "text_empty" }, { status: 400 });
  if (text.length > 1000) return NextResponse.json({ error: "text_too_long" }, { status: 400 });
  if (!target || !/^[a-z]{2}$/.test(target)) return NextResponse.json({ error: "invalid_target_lang" }, { status: 400 });
  if (!/^[a-z]{2}$/.test(source)) return NextResponse.json({ error: "invalid_source_lang" }, { status: 400 });
  if (source === target) {
    return NextResponse.json({ translated: text, source_lang: source, target_lang: target, cached: false, service: "noop" });
  }

  const hash = crypto.createHash("sha256").update(text).digest("hex");

  // Cache-Hit?
  const { data: cached } = await sb
    .from("translation_cache")
    .select("translated_text, service, match_quality")
    .eq("source_hash", hash)
    .eq("source_lang", source)
    .eq("target_lang", target)
    .maybeSingle();

  if (cached) {
    return NextResponse.json({
      translated: (cached as { translated_text: string }).translated_text,
      source_lang: source,
      target_lang: target,
      cached: true,
      service: (cached as { service: string }).service,
      match_quality: (cached as { match_quality: number | null }).match_quality,
    });
  }

  // MyMemory-Aufruf
  const url = new URL("https://api.mymemory.translated.net/get");
  url.searchParams.set("q", text);
  url.searchParams.set("langpair", `${source}|${target}`);
  // Optional: eigenes Mailkonto erhöht das Tageslimit von 5k → 50k Zeichen.
  // Wenn ENV `MYMEMORY_EMAIL` gesetzt → mitsenden.
  const email = process.env.MYMEMORY_EMAIL;
  if (email) url.searchParams.set("de", email);

  let translated: string | null = null;
  let matchQuality: number | null = null;

  try {
    const r = await fetch(url.toString(), {
      cache: "no-store",
      headers: { "user-agent": "MyArea365/1.0" },
    });
    if (!r.ok) throw new Error(`mymemory_status_${r.status}`);
    const j = await r.json() as {
      responseData?: { translatedText?: string; match?: number };
      responseStatus?: number;
    };
    translated = j.responseData?.translatedText ?? null;
    matchQuality = typeof j.responseData?.match === "number" ? j.responseData.match : null;
  } catch (e) {
    return NextResponse.json({
      error: "translate_service_failed",
      detail: e instanceof Error ? e.message : String(e),
    }, { status: 502 });
  }

  if (!translated) return NextResponse.json({ error: "no_translation_returned" }, { status: 502 });

  // Cache schreiben (idempotent via PK on conflict)
  await sb.from("translation_cache").upsert({
    source_hash: hash,
    source_lang: source,
    target_lang: target,
    source_text: text,
    translated_text: translated,
    service: "mymemory",
    match_quality: matchQuality,
  }, { onConflict: "source_hash,source_lang,target_lang" });

  return NextResponse.json({
    translated,
    source_lang: source,
    target_lang: target,
    cached: false,
    service: "mymemory",
    match_quality: matchQuality,
  });
}
