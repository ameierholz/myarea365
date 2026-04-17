// Supabase Edge Function: send-monthly-stats
// Läuft monatlich (1. des Monats) via pg_cron und sendet jedem aktiven Runner
// seine persönlichen Vormonats-Statistiken.
//
// Cron-Setup (Supabase SQL Editor):
//   select cron.schedule(
//     'monthly-stats-mailer',
//     '0 8 1 * *',   -- 1. des Monats, 08:00 UTC
//     $$ select net.http_post(
//          url := 'https://<project>.supabase.co/functions/v1/send-monthly-stats',
//          headers := '{"Authorization": "Bearer <anon-key>", "Content-Type": "application/json"}'::jsonb,
//          body := '{}'::jsonb
//        ); $$
//   );

// @ts-expect-error Deno runtime
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
// @ts-expect-error Deno runtime
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const FROM = "MyArea365 <hello@myarea365.de>";

const MONTHS_DE = ["Januar","Februar","März","April","Mai","Juni","Juli","August","September","Oktober","November","Dezember"];

// Template als Konstante — bei Änderung in apps/web/emails/monthly-stats.html spiegeln
const STATS_TEMPLATE = `<!DOCTYPE html>
<html lang="de"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#0F1115;color:#F0F0F0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#0F1115;padding:32px 16px;"><tr><td align="center">
    <table role="presentation" width="600" cellspacing="0" cellpadding="0" border="0" style="max-width:600px;width:100%;">
      <tr><td align="center" style="padding:0 0 16px;"><div style="font-size:11px;color:#a8b4cf;letter-spacing:1.5px;font-weight:800;">DEINE LAUF-STATISTIK · {{month_label}}</div></td></tr>
      <tr><td style="background:linear-gradient(135deg,#22D1C322 0%,#FF2D7822 100%);border-radius:20px 20px 0 0;padding:40px 32px 32px;text-align:center;">
        <div style="font-size:48px;margin-bottom:8px;">🏁</div>
        <h1 style="margin:0 0 8px;font-size:26px;font-weight:900;color:#FFF;line-height:1.2;">Stark gelaufen, {{display_name}}!</h1>
        <p style="margin:0;font-size:15px;color:#dde3f5;line-height:1.5;">{{month_label}} ist rum — hier deine Zahlen.</p>
      </td></tr>
      <tr><td style="background:#1A1D23;padding:28px 32px 10px;text-align:center;">
        <p style="margin:0 0 4px;font-size:12px;color:#a8b4cf;font-weight:800;letter-spacing:1px;">GESAMT-STRECKE</p>
        <div style="font-size:56px;font-weight:900;color:#22D1C3;line-height:1;">{{user_km}} km</div>
        <p style="margin:8px 0 0;font-size:13px;color:#dde3f5;">das sind <b style="color:#FFF;">{{user_steps}} Schritte</b> und <b style="color:#FFF;">{{user_kcal}} kcal</b></p>
      </td></tr>
      <tr><td style="background:#1A1D23;padding:14px 32px 16px;"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
        <tr>
          <td width="33%" valign="top" style="padding:8px;"><div style="background:rgba(34,209,195,0.1);border:1px solid rgba(34,209,195,0.3);border-radius:12px;padding:12px 10px;text-align:center;"><div style="font-size:20px;">🏃</div><div style="color:#22D1C3;font-size:22px;font-weight:900;margin-top:2px;">{{user_runs}}</div><div style="color:#a8b4cf;font-size:10px;font-weight:700;">LÄUFE</div></div></td>
          <td width="33%" valign="top" style="padding:8px;"><div style="background:rgba(255,215,0,0.1);border:1px solid rgba(255,215,0,0.3);border-radius:12px;padding:12px 10px;text-align:center;"><div style="font-size:20px;">⚡</div><div style="color:#FFD700;font-size:22px;font-weight:900;margin-top:2px;">+{{user_xp}}</div><div style="color:#a8b4cf;font-size:10px;font-weight:700;">XP</div></div></td>
          <td width="33%" valign="top" style="padding:8px;"><div style="background:rgba(255,45,120,0.1);border:1px solid rgba(255,45,120,0.3);border-radius:12px;padding:12px 10px;text-align:center;"><div style="font-size:20px;">🗺️</div><div style="color:#FF2D78;font-size:22px;font-weight:900;margin-top:2px;">{{user_territories}}</div><div style="color:#a8b4cf;font-size:10px;font-weight:700;">TERRITORIEN</div></div></td>
        </tr>
        <tr>
          <td width="33%" valign="top" style="padding:8px;"><div style="background:rgba(255,107,74,0.1);border:1px solid rgba(255,107,74,0.3);border-radius:12px;padding:12px 10px;text-align:center;"><div style="font-size:20px;">🔥</div><div style="color:#FF6B4A;font-size:22px;font-weight:900;margin-top:2px;">{{user_streak}}</div><div style="color:#a8b4cf;font-size:10px;font-weight:700;">STREAK-TAGE</div></div></td>
          <td width="33%" valign="top" style="padding:8px;"><div style="background:rgba(168,85,247,0.1);border:1px solid rgba(168,85,247,0.3);border-radius:12px;padding:12px 10px;text-align:center;"><div style="font-size:20px;">⏱️</div><div style="color:#a855f7;font-size:22px;font-weight:900;margin-top:2px;">{{user_duration}}</div><div style="color:#a8b4cf;font-size:10px;font-weight:700;">AKTIV</div></div></td>
          <td width="33%" valign="top" style="padding:8px;"><div style="background:rgba(74,222,128,0.1);border:1px solid rgba(74,222,128,0.3);border-radius:12px;padding:12px 10px;text-align:center;"><div style="font-size:20px;">🎯</div><div style="color:#4ade80;font-size:22px;font-weight:900;margin-top:2px;">{{user_avg_pace}}</div><div style="color:#a8b4cf;font-size:10px;font-weight:700;">Ø PACE</div></div></td>
        </tr>
      </table></td></tr>
      <tr><td style="background:#1A1D23;padding:0 32px 28px;text-align:center;">
        <a href="https://myarea365.de/dashboard/?tab=profil" style="display:inline-block;padding:14px 28px;background:#22D1C3;color:#0F1115;font-weight:900;font-size:14px;text-decoration:none;border-radius:12px;">Volle Statistik im Profil →</a>
      </td></tr>
      <tr><td style="background:#1A1D23;border-radius:0 0 20px 20px;padding:20px 32px;text-align:center;font-size:11px;color:#a8b4cf;line-height:1.6;">
        Los geht's in den neuen Monat 🏃<br>
        <a href="https://myarea365.de/datenschutz" style="color:#a8b4cf;text-decoration:underline;">Datenschutz</a> ·
        <a href="{{unsubscribe_url}}" style="color:#a8b4cf;text-decoration:underline;">Monats-Report abbestellen</a>
      </td></tr>
    </table>
  </td></tr></table>
</body></html>`;

function fmt(n: number, digits = 0): string {
  return n.toLocaleString("de-DE", { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

function paceOf(distance_m: number, duration_s: number): string {
  if (distance_m < 100 || duration_s < 10) return "—";
  const secPerKm = duration_s / (distance_m / 1000);
  const m = Math.floor(secPerKm / 60);
  const s = Math.round(secPerKm - m * 60);
  return `${m}:${String(s).padStart(2, "0")} /km`;
}

function durationLabel(sec: number): string {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec - h * 3600) / 60);
  return h > 0 ? `${h}:${String(m).padStart(2, "0")} h` : `${m} min`;
}

serve(async () => {
  try {
    const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const now = new Date();
    const prevMonthEnd = new Date(now.getFullYear(), now.getMonth(), 1);
    const prevMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const monthLabel = `${MONTHS_DE[prevMonthStart.getMonth()]} ${prevMonthStart.getFullYear()}`;

    const { data: users, error: usersErr } = await sb
      .from("users")
      .select("id, display_name, username, email_notif_runs, email_notif_monthly")
      .or("email_notif_monthly.eq.true,email_notif_runs.eq.true");

    if (usersErr) throw usersErr;

    let sent = 0, skipped = 0, failed = 0;

    for (const u of users || []) {
      const { data: authUser } = await sb.auth.admin.getUserById(u.id);
      const email = authUser?.user?.email;
      if (!email) { skipped++; continue; }

      // Aggregierte Vormonats-Statistik
      const { data: territories } = await sb
        .from("territories")
        .select("distance_m, duration_s, xp_earned, created_at")
        .eq("user_id", u.id)
        .gte("created_at", prevMonthStart.toISOString())
        .lt("created_at", prevMonthEnd.toISOString());

      if (!territories || territories.length === 0) { skipped++; continue; }

      const total_m = territories.reduce((s: number, t: { distance_m?: number }) => s + (t.distance_m || 0), 0);
      const total_s = territories.reduce((s: number, t: { duration_s?: number }) => s + (t.duration_s || 0), 0);
      const total_xp = territories.reduce((s: number, t: { xp_earned?: number }) => s + (t.xp_earned || 0), 0);
      const km = total_m / 1000;

      const variables = {
        month_label: monthLabel,
        display_name: u.display_name || u.username || "Runner",
        user_km: fmt(km, 1),
        user_steps: fmt(Math.round(total_m / 0.76)),
        user_kcal: fmt(Math.round(km * 62)),
        user_runs: String(territories.length),
        user_xp: fmt(total_xp),
        user_territories: String(territories.length),
        user_streak: String(0), // TODO: aus streak-Tabelle
        user_duration: durationLabel(total_s),
        user_avg_pace: paceOf(total_m, total_s),
        unsubscribe_url: `https://myarea365.de/unsubscribe?uid=${u.id}`,
      };

      let html = STATS_TEMPLATE;
      for (const [k, v] of Object.entries(variables)) {
        html = html.split(`{{${k}}}`).join(v);
      }

      const resendRes = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { "Authorization": `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          from: FROM,
          to: email,
          subject: `Dein ${monthLabel}: ${variables.user_km} km 🏁`,
          html,
          reply_to: "support@myarea365.de",
          headers: {
            "List-Unsubscribe": `<${variables.unsubscribe_url}>, <mailto:support@myarea365.de?subject=unsubscribe>`,
            "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
          },
        }),
      });

      await sb.from("email_events").insert({
        user_id: u.id,
        email,
        type: "monthly-stats",
        status: resendRes.ok ? "sent" : "bounced",
        sent_at: resendRes.ok ? new Date().toISOString() : null,
      });

      if (resendRes.ok) sent++;
      else failed++;
    }

    return new Response(JSON.stringify({ sent, skipped, failed, month: monthLabel }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : String(err) }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }
});
