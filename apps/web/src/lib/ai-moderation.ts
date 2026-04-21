// KI-Bild-Moderation für Runner-/Crew-Medien
// Nutzt Anthropic Claude (Vision) wenn ANTHROPIC_API_KEY gesetzt, sonst skip.
//
// Returns:
//   { approved: true }                       → Bild ist unbedenklich, auto-approve
//   { approved: false, reason: "..." }       → Bild wurde abgelehnt (NSFW/Gewalt/etc)
//   { approved: null, reason: "no_ai" }      → Keine AI konfiguriert, menschlicher Admin-Review nötig

export type ModerationResult = {
  approved: boolean | null;
  reason?: string;
  categories?: string[];
};

type ClaudeResponse = {
  content?: Array<{ type: string; text?: string }>;
  error?: { message: string };
};

const MODERATION_PROMPT = `Du bist ein Content-Moderator für eine Fitness-/Gehen-App (alle Altersstufen, "MyArea365").

Prüfe das Bild auf FOLGENDE unerwünschte Inhalte:
- Nacktheit, sexuelle Inhalte
- Gewalt, blutige Darstellungen
- Hass-Symbole (z.B. Hakenkreuz, rassistische Zeichen)
- Drogen (Konsum, Paraphernalia)
- Waffen als Hauptmotiv (Alltagsszenen mit Sport-Geräten etc. sind OK)
- Unangemessene Werbung (Glücksspiel, Tabak, Alkohol-Marken)
- Privatsphäre-Verletzung (Gesichter Minderjähriger als Hauptmotiv)

ERLAUBT:
- Sport, Laufen, Natur, Städte, Wahrzeichen
- Fotos des Nutzers selbst (Gesicht OK)
- Haustiere, Teammotive, Maskottchen
- Abstrakte Kunst, Grafiken

Antworte EXAKT in diesem JSON-Format (ohne Markdown):
{"approved": true} ODER {"approved": false, "reason": "kurze Begründung auf Deutsch", "categories": ["nudity" | "violence" | "hate" | "drugs" | "weapons" | "ads" | "privacy"]}`;

export async function moderateImageUrl(imageUrl: string): Promise<ModerationResult> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return { approved: null, reason: "no_ai" };
  }

  try {
    // Bild laden und zu base64 konvertieren (Anthropic akzeptiert auch URL, aber public-URL-Zugriff aus edge ist unzuverlässig)
    const imgRes = await fetch(imageUrl);
    if (!imgRes.ok) return { approved: null, reason: "image_fetch_failed" };
    const contentType = imgRes.headers.get("content-type") || "image/jpeg";
    if (!["image/jpeg", "image/png", "image/gif", "image/webp"].includes(contentType)) {
      return { approved: false, reason: "unsupported_format", categories: ["invalid"] };
    }
    const buf = Buffer.from(await imgRes.arrayBuffer());
    if (buf.length > 5 * 1024 * 1024) {
      return { approved: null, reason: "image_too_large" };
    }
    const b64 = buf.toString("base64");

    const resp = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 200,
        messages: [{
          role: "user",
          content: [
            { type: "image", source: { type: "base64", media_type: contentType, data: b64 } },
            { type: "text", text: MODERATION_PROMPT },
          ],
        }],
      }),
    });

    const json = await resp.json() as ClaudeResponse;
    if (json.error || !json.content?.[0]?.text) {
      return { approved: null, reason: json.error?.message ?? "ai_no_response" };
    }

    const raw = json.content[0].text.trim();
    try {
      const parsed = JSON.parse(raw) as { approved: boolean; reason?: string; categories?: string[] };
      return {
        approved: !!parsed.approved,
        reason: parsed.reason,
        categories: parsed.categories,
      };
    } catch {
      // Fallback: wenn "approved" im Text auftaucht, approve; sonst Nein
      return raw.toLowerCase().includes("approved") && raw.toLowerCase().includes("true")
        ? { approved: true }
        : { approved: null, reason: "parse_error" };
    }
  } catch (e) {
    return { approved: null, reason: e instanceof Error ? e.message : "unknown_error" };
  }
}
