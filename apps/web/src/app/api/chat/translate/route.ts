import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** POST /api/chat/translate
 *  Body: { text: string; target?: string }   → { text: translated, source: detected }
 *  Free-Tier: MyMemory (kein Key nötig). Optional DeepL wenn DEEPL_API_KEY gesetzt.
 */
export async function POST(req: NextRequest) {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: "not_authenticated" }, { status: 401 });

  const { text, target } = await req.json() as { text?: string; target?: string };
  if (!text || typeof text !== "string" || text.trim().length === 0) {
    return NextResponse.json({ error: "missing_text" }, { status: 400 });
  }
  const targetLang = (target ?? "de").slice(0, 5);

  // DeepL preferred (Pro)
  const deeplKey = process.env.DEEPL_API_KEY;
  if (deeplKey) {
    try {
      const res = await fetch("https://api-free.deepl.com/v2/translate", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded", "Authorization": `DeepL-Auth-Key ${deeplKey}` },
        body: new URLSearchParams({ text, target_lang: targetLang.toUpperCase().slice(0, 2) }),
        signal: AbortSignal.timeout(8000),
      });
      if (res.ok) {
        const j = await res.json() as { translations?: Array<{ text: string; detected_source_language: string }> };
        if (j.translations?.[0]) {
          return NextResponse.json({ text: j.translations[0].text, source: j.translations[0].detected_source_language.toLowerCase() });
        }
      }
    } catch { /* fallback */ }
  }

  // MyMemory (free, ~5000 chars/day pro IP)
  try {
    const url = new URL("https://api.mymemory.translated.net/get");
    url.searchParams.set("q", text.slice(0, 1500));
    url.searchParams.set("langpair", `auto|${targetLang}`);
    const res = await fetch(url.toString(), { signal: AbortSignal.timeout(8000) });
    if (!res.ok) return NextResponse.json({ error: "translate_failed" }, { status: 502 });
    const j = await res.json() as { responseData?: { translatedText: string }; responseStatus?: number; matches?: Array<{ source: string }> };
    if (j.responseStatus !== 200 || !j.responseData?.translatedText) {
      return NextResponse.json({ error: "translate_failed" }, { status: 502 });
    }
    const source = j.matches?.[0]?.source?.split("-")[0] ?? null;
    return NextResponse.json({ text: j.responseData.translatedText, source });
  } catch {
    return NextResponse.json({ error: "translate_timeout" }, { status: 504 });
  }
}
