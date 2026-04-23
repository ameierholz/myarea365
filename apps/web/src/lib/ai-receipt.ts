// KI-OCR für Kassenbons — extrahiert Kaufbetrag via Claude Vision.
// Gibt verifizierbaren Betrag zurück, damit Bonus-Loot fair skaliert.

export type ReceiptExtraction = {
  amount_cents: number | null;
  currency: string | null;
  confidence: "high" | "medium" | "low" | "failed";
  merchant_hint?: string;
  items?: string[];
  raw_text?: string;
  reason?: string;
};

type ClaudeResponse = {
  content?: Array<{ type: string; text?: string }>;
  error?: { message: string };
};

const RECEIPT_PROMPT = `Du bist ein Kassenbon-Analyst. Extrahiere aus dem Foto den GESAMTBETRAG und die gekauften Artikel.

Antworte EXAKT in diesem JSON-Format (keine Markdown-Fences, nichts sonst):
{"amount_cents": 1234, "currency": "EUR", "confidence": "high" | "medium" | "low", "merchant_hint": "kurzer Shop-Name oder null", "items": ["Artikel 1", "Artikel 2"]}

Regeln:
- amount_cents = Gesamtbetrag in Cent (z.B. 12,34 € → 1234); NICHT einzelne Positionen, NICHT Trinkgeld
- items = Liste der Artikel-Bezeichnungen (max 20), wie auf dem Bon; ohne Preise/Mengen
- Wenn kein klarer Gesamtbetrag erkennbar: amount_cents = null, confidence = "low"
- Wenn kein Kassenbon im Bild: amount_cents = null, confidence = "failed", items = []
- Bei Verdacht auf Fälschung / bearbeiteter Screenshot: confidence = "low"
- Nur Euro-Beträge extrahieren; andere Währungen → confidence = "low"`;

export async function extractReceiptAmount(imageBase64: string, contentType: string): Promise<ReceiptExtraction> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return { amount_cents: null, currency: null, confidence: "failed", reason: "KI-OCR nicht konfiguriert" };
  }
  if (!["image/jpeg", "image/png", "image/gif", "image/webp"].includes(contentType)) {
    return { amount_cents: null, currency: null, confidence: "failed", reason: "Dateiformat nicht unterstützt" };
  }

  try {
    const resp = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 250,
        messages: [{
          role: "user",
          content: [
            { type: "image", source: { type: "base64", media_type: contentType, data: imageBase64 } },
            { type: "text", text: RECEIPT_PROMPT },
          ],
        }],
      }),
    });

    const json = await resp.json() as ClaudeResponse;
    if (json.error || !json.content?.[0]?.text) {
      return { amount_cents: null, currency: null, confidence: "failed", reason: json.error?.message ?? "KI-Dienst ohne Antwort" };
    }

    const raw = json.content[0].text.trim();
    try {
      const parsed = JSON.parse(raw) as { amount_cents: number | null; currency: string | null; confidence: string; merchant_hint?: string; items?: string[] };
      return {
        amount_cents: typeof parsed.amount_cents === "number" ? parsed.amount_cents : null,
        currency: parsed.currency ?? null,
        confidence: (["high", "medium", "low", "failed"] as const).includes(parsed.confidence as "high" | "medium" | "low" | "failed")
          ? (parsed.confidence as "high" | "medium" | "low" | "failed")
          : "low",
        merchant_hint: parsed.merchant_hint,
        items: Array.isArray(parsed.items) ? parsed.items.filter((x): x is string => typeof x === "string").map(sanitizeReceiptItem).filter((x) => x.length > 0).slice(0, 20) : [],
        raw_text: raw,
      };
    } catch {
      return { amount_cents: null, currency: null, confidence: "failed", reason: "Antwort nicht lesbar", raw_text: raw };
    }
  } catch (e) {
    return { amount_cents: null, currency: null, confidence: "failed", reason: e instanceof Error ? e.message : "Unbekannter Fehler" };
  }
}

/**
 * Säubert OCR-Items vor DB-/RPC-Nutzung.
 * - Entfernt alle Zeichen außer Buchstaben, Zahlen, Leerzeichen, `-`, `&`, `.`, `/`.
 * - Trimmt auf max. 64 Zeichen (Schutz vor LIKE-Pattern-Abuse + DB-Bloat).
 * - Normalisiert Whitespace.
 */
export function sanitizeReceiptItem(raw: string): string {
  return raw
    .replace(/[^\p{L}\p{N}\s\-&./]/gu, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 64);
}

/**
 * Vergleicht eingegebenen Betrag mit OCR-Betrag. Toleranz ±5% oder ±50 Cent, whichever larger.
 */
export function isReceiptAmountValid(userAmountCents: number, ocrAmountCents: number | null, confidence: ReceiptExtraction["confidence"]): boolean {
  if (confidence === "failed" || ocrAmountCents === null) return false;
  if (confidence === "low") return false;
  const tolerance = Math.max(50, Math.round(userAmountCents * 0.05));
  return Math.abs(userAmountCents - ocrAmountCents) <= tolerance;
}
