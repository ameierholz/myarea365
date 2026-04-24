/**
 * Minimal Resend-Client via fetch — kein SDK nötig.
 * Wenn RESEND_API_KEY nicht gesetzt ist, wird die Mail verworfen
 * (mit Log), damit lokale Entwicklung nicht crasht.
 *
 * ENV:
 *   RESEND_API_KEY     = "re_..."
 *   EMAIL_FROM         = "MyArea365 <hello@myarea365.de>" (Default-Absender)
 */

type SendMailInput = {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
  from?: string;
  replyTo?: string;
};

export async function sendMail(input: SendMailInput): Promise<{ ok: boolean; id?: string; error?: string }> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = input.from ?? process.env.EMAIL_FROM ?? "MyArea365 <no-reply@myarea365.de>";

  if (!apiKey) {
    // In Produktion ist ein fehlender Key ein Konfig-Bug — laut loggen statt stumm schlucken.
    const isProd = process.env.VERCEL_ENV === "production" || process.env.NODE_ENV === "production";
    const line = `[email] RESEND_API_KEY fehlt — Mail verworfen: "${input.subject}" → ${Array.isArray(input.to) ? input.to.join(",") : input.to}`;
    if (isProd) console.error(line);
    else console.log(line);
    return { ok: false, error: "no_api_key" };
  }

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        from,
        to: Array.isArray(input.to) ? input.to : [input.to],
        subject: input.subject,
        html: input.html,
        text: input.text,
        reply_to: input.replyTo,
      }),
    });
    const j = await res.json();
    if (!res.ok) {
      console.error("[email] resend error:", j);
      return { ok: false, error: j?.message ?? "resend_error" };
    }
    return { ok: true, id: j?.id };
  } catch (e) {
    console.error("[email] send failed:", e);
    return { ok: false, error: e instanceof Error ? e.message : "unknown" };
  }
}

/**
 * Gemeinsame Basis-Wrapper für HTML-Mails.
 */
export function renderLayout(opts: { preheader?: string; title: string; bodyHtml: string; cta?: { label: string; url: string } }): string {
  const { preheader = "", title, bodyHtml, cta } = opts;
  return `<!doctype html>
<html lang="de"><head><meta charset="utf-8"><title>${escape(title)}</title>
<style>
  body { margin:0; padding:0; background:#0F1115; color:#F0F0F0; font-family: -apple-system, system-ui, Segoe UI, Roboto, sans-serif; }
  .card { max-width: 560px; margin: 24px auto; padding: 24px; background:#1A1D23; border-radius:16px; border:1px solid rgba(34,209,195,0.2); }
  .brand { font-size:11px; font-weight:900; letter-spacing:2px; color:#22D1C3; }
  .h1 { font-size:22px; font-weight:900; color:#FFF; margin: 8px 0 12px; }
  .body { font-size:14px; line-height:1.55; color:#D0D0D5; }
  .body b { color:#FFF; }
  .btn { display:inline-block; margin-top:16px; padding:12px 18px; border-radius:10px; background:#22D1C3; color:#0F1115; font-weight:900; text-decoration:none; font-size:13px; }
  .foot { font-size:11px; color:#8B8FA3; text-align:center; margin-top:16px; }
  .preheader { display:none !important; visibility:hidden; opacity:0; color:transparent; height:0; width:0; }
</style></head>
<body>
  <span class="preheader">${escape(preheader)}</span>
  <div class="card">
    <div class="brand">MYAREA365</div>
    <div class="h1">${escape(title)}</div>
    <div class="body">${bodyHtml}</div>
    ${cta ? `<p><a class="btn" href="${escape(cta.url)}">${escape(cta.label)} →</a></p>` : ""}
    <div class="foot">myarea365.de · Unterstützt von deinem Kiez.</div>
  </div>
</body></html>`;
}

function escape(s: string): string {
  return s.replace(/[<>&"]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;" }[c] || c));
}
