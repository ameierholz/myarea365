/**
 * i18n-Translator: übersetzt en.json → Ziel-Locale via Anthropic Claude API.
 *
 * Strategie:
 *  - Nutzt Claude Sonnet 4.6 (kosteneffizient + sehr gut bei Übersetzungen)
 *  - Prompt-Caching für System-Instructions + Glossar (5 min TTL → günstig)
 *  - Übersetzt pro Top-Level-Namespace (kleine Chunks → resilient)
 *  - Behält JSON-Struktur exakt + Platzhalter ({var}) + Emojis bei
 *
 * Usage:
 *   ANTHROPIC_API_KEY=sk-ant-... pnpm tsx scripts/translate-i18n.ts <locale>
 *   pnpm tsx scripts/translate-i18n.ts es           → einzelne Sprache
 *   pnpm tsx scripts/translate-i18n.ts all          → alle Skeleton-Locales
 *
 * Wenn die Ziel-Datei bereits Inhalt hat (mehr als nur "Common"), werden NUR
 * fehlende Namespaces übersetzt — vorhandene bleiben unangetastet.
 */

import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const MODEL = "claude-sonnet-4-6";

const LOCALE_NATIVE: Record<string, string> = {
  es: "Spanish (Spain) — natural, modern, used by walking-game community in Spain",
  fr: "French (France) — natural, modern, slightly playful but never formal/stiff",
  it: "Italian (Italy) — natural, modern, walking-community friendly",
  tr: "Turkish (Turkey) — natural, modern, casual gaming style",
  pl: "Polish (Poland) — natural, modern, casual gaming style",
  ru: "Russian (Russia) — natural, modern, gaming style",
  ar: "Arabic (Modern Standard Arabic / Saudi-friendly) — natural, modern, careful with RTL placeholders",
  zh: "Simplified Chinese (Mainland China) — natural, modern, mobile-game style",
};

const SYS_PROMPT = `You are a professional game-localization translator for "MyArea365",
a gamified walking community game (think Pokémon GO meets Strava with crew/clan layer).

Translate from English to the target language. Output ONLY the translated JSON object,
no commentary, no Markdown fences, no preamble.

CRITICAL RULES:
1. Keep ALL placeholders verbatim: {name}, {n}, {coins}, {level}, etc. — do NOT translate.
2. Keep emojis in place — they're shared visual symbols.
3. Keep proper nouns: "MyArea365", "Berlin", crew names like "Wegelager", "Wächter".
4. Keep brand-specific game terms when listed in glossary below.
5. Match register: casual gaming tone, never formal/stiff. Snappy and fun.
6. Keep the JSON structure EXACTLY: same keys, same nesting, same types.
7. Translate VALUES only, never KEYS.
8. Preserve trailing punctuation (… — !).
9. For very short strings (1-3 words / button labels), prefer concise idiomatic equivalents
   even if literal translation would be longer.

GLOSSARY (do NOT translate these — keep verbatim or transliterate to language):
- "Wegemünzen" → may translate to "Way Coins" / "Monedas del Camino" / "Pièces de Voyage" etc.
  but keep the concept (XP-currency from walking).
- "Wächter" = guardian-pet companion. Translate to local equivalent of "Guardian".
- "Wegelager" = roaming bandit camp/stronghold. Translate as "Bandit Camp" / "Embuscade" etc.
- "Crew" → keep as "Crew" (international gaming term).
- "Aufgebot" = rally/levy of troops. Translate to natural equivalent.
- "Späti" = corner shop (Berlin slang). Use local equivalent or generic "corner shop".`;

type Json = unknown;
type Obj = Record<string, Json>;

function isObj(v: Json): v is Obj {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

async function callClaude(opts: {
  apiKey: string;
  systemPrompt: string;
  glossaryRef?: string;
  userMessage: string;
}): Promise<string> {
  const body = {
    model: MODEL,
    max_tokens: 16000,
    system: [
      { type: "text", text: opts.systemPrompt, cache_control: { type: "ephemeral" } },
    ],
    messages: [
      ...(opts.glossaryRef
        ? [{ role: "user" as const, content: [{ type: "text" as const, text: opts.glossaryRef, cache_control: { type: "ephemeral" } }] }]
        : []),
      { role: "user" as const, content: opts.userMessage },
    ],
  };

  const r = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": opts.apiKey,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify(body),
  });
  if (!r.ok) {
    const t = await r.text();
    throw new Error(`API error ${r.status}: ${t}`);
  }
  const j = await r.json() as { content: Array<{ type: string; text?: string }> };
  const text = j.content.filter((c) => c.type === "text").map((c) => c.text ?? "").join("");
  // Strip code fences if model included them despite instructions
  return text.replace(/^```(?:json)?\s*\n?/, "").replace(/\n?```\s*$/, "").trim();
}

function safeParse(text: string, ns: string): Obj {
  try {
    return JSON.parse(text) as Obj;
  } catch (e) {
    // Save broken output for debugging
    writeFileSync(join("scripts", `_broken_${ns}.txt`), text);
    throw new Error(`JSON parse failed for namespace "${ns}". Raw output saved to scripts/_broken_${ns}.txt. ${(e as Error).message}`);
  }
}

async function translateNamespace(opts: {
  apiKey: string;
  locale: string;
  ns: string;
  source: Obj;
}): Promise<Obj> {
  const langDesc = LOCALE_NATIVE[opts.locale] ?? opts.locale;
  const userMsg = `Target language: ${langDesc}.

Translate this JSON namespace "${opts.ns}" to the target language.
Output ONLY the translated JSON object (no namespace key wrapper, just the inner object body).

INPUT:
${JSON.stringify(opts.source, null, 2)}`;

  const out = await callClaude({
    apiKey: opts.apiKey,
    systemPrompt: SYS_PROMPT,
    userMessage: userMsg,
  });
  return safeParse(out, opts.ns);
}

async function translateLocale(apiKey: string, locale: string, source: Obj, existing: Obj): Promise<void> {
  const out: Obj = { ...existing };
  const namespaces = Object.keys(source);

  console.log(`\n  → Locale: ${locale} (${namespaces.length} namespaces)`);

  for (let i = 0; i < namespaces.length; i++) {
    const ns = namespaces[i];
    if (out[ns] && isObj(out[ns]) && Object.keys(out[ns] as Obj).length > 0) {
      console.log(`    [${i + 1}/${namespaces.length}] ${ns} — exists, skipping`);
      continue;
    }
    const srcNs = source[ns];
    if (!isObj(srcNs)) {
      out[ns] = srcNs;
      continue;
    }
    process.stdout.write(`    [${i + 1}/${namespaces.length}] ${ns} … `);
    try {
      const translated = await translateNamespace({ apiKey, locale, ns, source: srcNs });
      out[ns] = translated;
      console.log("✓");
      // Small pause to be nice to the API
      await new Promise((res) => setTimeout(res, 300));
      // Snapshot after each NS — resilient to interrupts
      const path = join("apps", "web", "messages", `${locale}.json`);
      writeFileSync(path, JSON.stringify(out, null, 2) + "\n", "utf8");
    } catch (e) {
      console.error(`✗ ${(e as Error).message}`);
      // Continue with other namespaces
    }
  }
}

async function main() {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.error("Missing ANTHROPIC_API_KEY env var");
    process.exit(1);
  }

  const arg = process.argv[2];
  if (!arg) {
    console.error("Usage: pnpm tsx scripts/translate-i18n.ts <locale>|all");
    console.error(`Available: ${Object.keys(LOCALE_NATIVE).join(", ")}`);
    process.exit(1);
  }

  const enJson = JSON.parse(readFileSync(join("apps", "web", "messages", "en.json"), "utf8")) as Obj;

  const targets = arg === "all" ? Object.keys(LOCALE_NATIVE) : [arg];
  for (const locale of targets) {
    if (!LOCALE_NATIVE[locale]) {
      console.error(`Unknown locale: ${locale}`);
      continue;
    }
    const path = join("apps", "web", "messages", `${locale}.json`);
    let existing: Obj = {};
    try { existing = JSON.parse(readFileSync(path, "utf8")) as Obj; } catch { /* fresh file */ }
    await translateLocale(apiKey, locale, enJson, existing);
    console.log(`  ✓ ${locale}.json written`);
  }
  console.log("\nDone.");
}

void main();
