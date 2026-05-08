import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";
import { createClient as createAdminClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function adminSb() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Supabase admin creds missing");
  return createAdminClient(url, key, { auth: { persistSession: false } });
}

/**
 * POST /api/admin/system-messages/translate
 *
 * Body: { kind, target_locales: ["en","es",...] }
 *
 * Übersetzt die DE-Variante (title + body) eines Templates in die genannten
 * Ziel-Sprachen via MyMemory (siehe /api/translate). {{var}}-Platzhalter
 * werden vor der Übersetzung temporär maskiert (durch __VARi__-Token), damit
 * sie nicht zerschossen werden, und danach wieder eingesetzt.
 *
 * Response: { results: [{ locale, title, body, ok, error? }, ...] }
 */
export async function POST(req: Request) {
  await requireAdmin();
  const body = await req.json().catch(() => null) as {
    kind?: string;
    target_locales?: string[];
  } | null;
  if (!body?.kind || !body.target_locales?.length) {
    return NextResponse.json({ error: "missing_params" }, { status: 400 });
  }

  const sb = adminSb();
  const { data: deTpl, error } = await sb.from("system_message_templates")
    .select("title, body, available_vars, category, emoji, color, hero_label, default_reward, description")
    .eq("kind", body.kind).eq("locale", "de").maybeSingle();
  if (error || !deTpl) return NextResponse.json({ error: "de_template_missing" }, { status: 404 });

  const t = deTpl as {
    title: string; body: string; available_vars: string[];
    category: string; emoji: string; color: string; hero_label: string;
    default_reward: Record<string, unknown>; description: string;
  };

  // Variablen vor Übersetzung maskieren ({{var}} → __VARi__) — Token enthalten
  // keine Sonderzeichen die ein Übersetzer interpretieren würde.
  const maskString = (s: string): { masked: string; tokens: string[] } => {
    const tokens: string[] = [];
    const masked = s.replace(/\{\{([a-z_][a-z0-9_]*)\}\}/gi, (_m, name) => {
      tokens.push(name as string);
      return ` __VAR${tokens.length - 1}__ `;
    });
    return { masked, tokens };
  };
  const unmaskString = (s: string, tokens: string[]): string => {
    let out = s;
    for (let i = 0; i < tokens.length; i++) {
      // tolerant: __VAR0__, __ var0 __, __VAR 0 __ etc.
      const re = new RegExp(`__\\s*VAR\\s*${i}\\s*__`, "gi");
      out = out.replace(re, `{{${tokens[i]}}}`);
    }
    return out;
  };

  const { masked: titleMasked, tokens: titleTokens } = maskString(t.title);
  const { masked: bodyMasked, tokens: bodyTokens } = maskString(t.body);

  // Translate-Endpoint hostnamen-relativ aufrufen
  const reqUrl = new URL(req.url);
  const apiBase = `${reqUrl.protocol}//${reqUrl.host}`;
  const cookie = req.headers.get("cookie") ?? "";

  const callTranslate = async (text: string, target: string): Promise<{ ok: boolean; translated?: string; error?: string }> => {
    try {
      const r = await fetch(`${apiBase}/api/translate`, {
        method: "POST",
        headers: { "content-type": "application/json", cookie },
        body: JSON.stringify({ text, source_lang: "de", target_lang: target }),
      });
      const j = await r.json() as { translated?: string; error?: string };
      if (!r.ok || !j.translated) return { ok: false, error: j.error ?? "fail" };
      return { ok: true, translated: j.translated };
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : String(e) };
    }
  };

  const results: Array<{ locale: string; title?: string; body?: string; ok: boolean; error?: string }> = [];
  for (const loc of body.target_locales) {
    const target = loc.toLowerCase().split("-")[0];
    if (!/^[a-z]{2}$/.test(target)) {
      results.push({ locale: loc, ok: false, error: "invalid_locale" });
      continue;
    }
    if (target === "de") {
      results.push({ locale: loc, ok: false, error: "skip_de" });
      continue;
    }
    const [titleR, bodyR] = await Promise.all([
      callTranslate(titleMasked, target),
      callTranslate(bodyMasked, target),
    ]);
    if (!titleR.ok || !bodyR.ok) {
      results.push({ locale: loc, ok: false, error: titleR.error ?? bodyR.error ?? "fail" });
      continue;
    }
    const title = unmaskString(titleR.translated!, titleTokens);
    const txtBody = unmaskString(bodyR.translated!, bodyTokens);

    // Direkt persistieren (Editor zeigt die neue Variante danach).
    // Pflichtfelder werden aus dem DE-Template gespiegelt damit NOT-NULL-Constraints erfüllt sind.
    await sb.from("system_message_templates").upsert({
      kind: body.kind,
      locale: target,
      category: t.category,
      title, body: txtBody,
      emoji: t.emoji, color: t.color, hero_label: t.hero_label,
      default_reward: t.default_reward ?? {},
      available_vars: t.available_vars ?? [],
      description: "Auto-translated from DE", active: true,
      updated_at: new Date().toISOString(),
    }, { onConflict: "kind,locale" });

    results.push({ locale: loc, ok: true, title, body: txtBody });
  }

  return NextResponse.json({ results });
}
