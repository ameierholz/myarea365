// Supabase Edge Function: send-welcome-email
// Aufruf: Database-Webhook auf auth.users UPDATE wenn email_confirmed_at von NULL → Timestamp
// Env: RESEND_API_KEY, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
//
// Deploy:
//   supabase functions deploy send-welcome-email
// Webhook (in Supabase Dashboard → Database → Webhooks):
//   Table: auth.users
//   Events: UPDATE
//   Condition: NEW.email_confirmed_at IS NOT NULL AND OLD.email_confirmed_at IS NULL
//   → HTTP POST an die Function-URL

// @ts-expect-error Deno runtime
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
// @ts-expect-error Deno runtime
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const FROM = "MyArea365 <hello@myarea365.de>";

// Hinweis: Dieses HTML ist 1:1 die Quelle aus apps/web/emails/welcome.html.
// Bei Änderungen dort → hier spiegeln und Function neu deployen.
const WELCOME_TEMPLATE = `<!DOCTYPE html>
<html lang="de">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Los geht's! — MyArea365</title></head>
<body style="margin:0;padding:0;background:#0F1115;color:#F0F0F0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#0F1115;padding:32px 16px;">
    <tr><td align="center">
      <table role="presentation" width="600" cellspacing="0" cellpadding="0" border="0" style="max-width:600px;width:100%;">
        <tr>
          <td style="background:linear-gradient(135deg,#22D1C322 0%,#FF2D7822 100%);border-radius:20px 20px 0 0;padding:40px 32px 32px;text-align:center;">
            <div style="font-size:48px;margin-bottom:8px;">🎉</div>
            <h1 style="margin:0 0 8px;font-size:26px;font-weight:900;color:#FFF;line-height:1.2;">Account aktiv, {{display_name}}!</h1>
            <p style="margin:0;font-size:15px;color:#dde3f5;line-height:1.5;">Deine Straßen warten. Ab jetzt ist jeder Schritt Währung.</p>
          </td>
        </tr>
        <tr>
          <td style="background:#1A1D23;padding:28px 32px 16px;text-align:center;">
            <p style="margin:0 0 20px;font-size:15px;color:#dde3f5;line-height:1.5;">In 30 Sekunden startklar:</p>
            <a href="https://myarea365.de/dashboard/" style="display:inline-block;padding:16px 36px;background:#22D1C3;color:#0F1115;font-weight:900;font-size:15px;text-decoration:none;border-radius:14px;box-shadow:0 4px 20px rgba(34,209,195,0.3);">🚀 Zum Dashboard</a>
          </td>
        </tr>
        <tr>
          <td style="background:#1A1D23;padding:8px 32px 8px;">
            <p style="margin:24px 0 12px;font-size:11px;font-weight:800;color:#22D1C3;letter-spacing:1.5px;">DEINE ERSTEN 3 SCHRITTE</p>
            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin-bottom:18px;">
              <tr>
                <td width="48" valign="top" style="padding:4px 0;"><div style="width:36px;height:36px;border-radius:10px;background:#22D1C322;text-align:center;line-height:36px;font-size:18px;">📍</div></td>
                <td valign="top" style="padding:4px 0 4px 12px;">
                  <div style="color:#FFF;font-weight:800;font-size:14px;margin-bottom:3px;">1. Starte deinen ersten Lauf</div>
                  <div style="color:#a8b4cf;font-size:12px;line-height:1.5;">Öffne die Karte, tippe "Eroberung starten", geh raus. GPS zeichnet deinen Weg.</div>
                </td>
              </tr>
            </table>
            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin-bottom:18px;">
              <tr>
                <td width="48" valign="top" style="padding:4px 0;"><div style="width:36px;height:36px;border-radius:10px;background:#FFD70022;text-align:center;line-height:36px;font-size:18px;">👥</div></td>
                <td valign="top" style="padding:4px 0 4px 12px;">
                  <div style="color:#FFF;font-weight:800;font-size:14px;margin-bottom:3px;">2. Finde deine Crew</div>
                  <div style="color:#a8b4cf;font-size:12px;line-height:1.5;">Freunde, Kollegen, Nachbarn — zusammen gehts weiter. Kostenlos gründen oder mit Code beitreten.</div>
                </td>
              </tr>
            </table>
            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin-bottom:24px;">
              <tr>
                <td width="48" valign="top" style="padding:4px 0;"><div style="width:36px;height:36px;border-radius:10px;background:#FF2D7822;text-align:center;line-height:36px;font-size:18px;">🎁</div></td>
                <td valign="top" style="padding:4px 0 4px 12px;">
                  <div style="color:#FFF;font-weight:800;font-size:14px;margin-bottom:3px;">3. Löse XP in lokalen Shops ein</div>
                  <div style="color:#a8b4cf;font-size:12px;line-height:1.5;">Gratis Cappuccino, 15% im Sportladen, Fitness-Probewoche — echte Rabatte statt Punkte-Zirkus.</div>
                </td>
              </tr>
            </table>
          </td>
        </tr>
        <tr>
          <td style="background:#1A1D23;padding:0 32px 24px;">
            <div style="background:linear-gradient(135deg,#4ade8014 0%,transparent 100%);border:1px solid #4ade8044;border-radius:14px;padding:16px;">
              <div style="display:block;margin-bottom:6px;"><span style="font-size:18px;">❤️</span><strong style="color:#FFF;font-size:14px;margin-left:6px;">Bewegung lohnt sich doppelt</strong></div>
              <div style="color:#a8b4cf;font-size:12px;line-height:1.55;">Studien zeigen: Regelmäßiges Gehen/Laufen senkt das Herzrisiko um 42%, verbessert Schlafqualität und mentale Stärke. MyArea365 motiviert dich — spielerisch, mit Crew und echten Rewards.</div>
            </div>
          </td>
        </tr>
        <tr>
          <td style="background:#1A1D23;padding:0 32px 24px;">
            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
              <tr><td style="padding:6px 0;"><a href="https://myarea365.de/dashboard/" style="color:#22D1C3;text-decoration:none;font-size:13px;">→ Karte öffnen</a></td></tr>
              <tr><td style="padding:6px 0;"><a href="https://myarea365.de/dashboard/?tab=crew" style="color:#22D1C3;text-decoration:none;font-size:13px;">→ Crews durchsuchen</a></td></tr>
              <tr><td style="padding:6px 0;"><a href="https://myarea365.de/dashboard/?tab=shops" style="color:#22D1C3;text-decoration:none;font-size:13px;">→ Shops in deiner Nähe</a></td></tr>
            </table>
          </td>
        </tr>
        <tr>
          <td style="background:#1A1D23;border-radius:0 0 20px 20px;padding:20px 32px;text-align:center;font-size:11px;color:#a8b4cf;line-height:1.6;">
            <p style="margin:0 0 8px;">Fragen? Schreib an <a href="mailto:support@myarea365.de" style="color:#22D1C3;text-decoration:none;">support@myarea365.de</a>.</p>
            <p style="margin:0 0 12px;">Dein Andre von MyArea365 🏃</p>
            <p style="margin:0;">
              <a href="https://myarea365.de/datenschutz" style="color:#a8b4cf;text-decoration:underline;">Datenschutz</a> ·
              <a href="https://myarea365.de/impressum" style="color:#a8b4cf;text-decoration:underline;">Impressum</a> ·
              <a href="{{unsubscribe_url}}" style="color:#a8b4cf;text-decoration:underline;">Abbestellen</a>
            </p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

type WebhookPayload = {
  type: "UPDATE";
  table: string;
  record: { id: string; email: string; email_confirmed_at: string | null };
  old_record: { email_confirmed_at: string | null };
};

serve(async (req) => {
  try {
    if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });

    const payload = (await req.json()) as WebhookPayload;

    // Nur triggern wenn E-Mail-Bestätigung gerade passiert ist
    if (
      payload.type !== "UPDATE" ||
      payload.table !== "users" ||
      !payload.record.email_confirmed_at ||
      payload.old_record.email_confirmed_at
    ) {
      return new Response(JSON.stringify({ skipped: true }), { status: 200 });
    }

    const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // User-Profil laden
    const { data: profile } = await sb
      .from("users")
      .select("id, display_name, username, welcome_email_sent_at")
      .eq("id", payload.record.id)
      .single();

    if (!profile) return new Response("User not found", { status: 404 });
    if (profile.welcome_email_sent_at) {
      return new Response(JSON.stringify({ skipped: "already sent" }), { status: 200 });
    }

    const displayName = profile.display_name || profile.username || "Runner";
    const unsubscribeUrl = `https://myarea365.de/unsubscribe?uid=${profile.id}`;

    const html = WELCOME_TEMPLATE
      .replaceAll("{{display_name}}", displayName)
      .replaceAll("{{unsubscribe_url}}", unsubscribeUrl);

    // Resend-Request
    const resendRes = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: FROM,
        to: payload.record.email,
        subject: `Willkommen bei MyArea365, ${displayName}! 🎉`,
        html,
        reply_to: "support@myarea365.de",
        // RFC 8058: One-Click-Unsubscribe — Gmail/Outlook zeigen automatisch Abmelde-Link
        headers: {
          "List-Unsubscribe": `<${unsubscribeUrl}>, <mailto:support@myarea365.de?subject=unsubscribe>`,
          "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
        },
      }),
    });

    const result = await resendRes.json();

    // Log
    await sb.from("email_events").insert({
      user_id: profile.id,
      email: payload.record.email,
      type: "welcome",
      provider_id: result?.id || null,
      status: resendRes.ok ? "sent" : "bounced",
      error: resendRes.ok ? null : JSON.stringify(result),
      sent_at: resendRes.ok ? new Date().toISOString() : null,
    });

    if (resendRes.ok) {
      await sb.from("users")
        .update({ welcome_email_sent_at: new Date().toISOString() })
        .eq("id", profile.id);
    }

    return new Response(JSON.stringify({ ok: resendRes.ok, id: result?.id }), {
      status: resendRes.ok ? 200 : 500,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : String(err) }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }
});
