import { NextResponse, type NextRequest } from "next/server";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { requireStaff, logAudit } from "@/lib/admin";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/admin/impersonate
 * body: { user_id: string }
 *
 * Generiert einen Magic-Link via Supabase Admin-API (service-role).
 * Admin öffnet den Link in einem Private-Window und ist damit als Ziel-User eingeloggt.
 * Aktion wird im admin_audit_log protokolliert.
 */
export async function POST(req: NextRequest) {
  const { userId: adminId, role, email } = await requireStaff();
  const sb = await createServerClient();
  const body = await req.json() as { user_id?: string };
  if (!body.user_id) return NextResponse.json({ ok: false, error: "user_id fehlt" }, { status: 400 });

  // Ziel-User laden (Email + Metadaten)
  const { data: target } = await sb.from("users").select("id, username, display_name").eq("id", body.user_id).maybeSingle();
  if (!target) return NextResponse.json({ ok: false, error: "user_not_found" }, { status: 404 });

  // Email aus auth.users (nur via service-role erreichbar)
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    return NextResponse.json({ ok: false, error: "server_misconfigured" }, { status: 500 });
  }
  const admin = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });

  const { data: authUser, error: authErr } = await admin.auth.admin.getUserById(body.user_id);
  if (authErr || !authUser.user?.email) {
    return NextResponse.json({ ok: false, error: "no_email" }, { status: 400 });
  }

  const { data: link, error: linkErr } = await admin.auth.admin.generateLink({
    type: "magiclink",
    email: authUser.user.email,
  });
  if (linkErr) return NextResponse.json({ ok: false, error: linkErr.message }, { status: 500 });

  const actionLink = link.properties.action_link;

  // SECURITY: Magic-Link NICHT im Response-Body zurückgeben — XSS im Admin-Panel
  // wäre sonst ein Full-Account-Takeover-Vehikel für jeden User. Link wird per
  // Email an die verifizierte Admin-Adresse gesendet.
  let linkDelivered = false;
  try {
    const resendKey = process.env.RESEND_API_KEY;
    if (resendKey && email) {
      const targetName = (target as { username: string }).username;
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${resendKey}` },
        body: JSON.stringify({
          from: "MyArea365 Admin <no-reply@myarea365.de>",
          to: email,
          subject: `[Impersonate] Magic-Link für ${targetName}`,
          text: [
            `Du hast gerade einen Impersonate-Link für @${targetName} (${authUser.user.email}) angefordert.`,
            "",
            "Link gültig ca. 60 Minuten. In einem Private-/Inkognito-Window öffnen, sonst wird deine Admin-Session ersetzt.",
            "",
            actionLink,
            "",
            "Wenn du diese Anfrage nicht gestellt hast: Admin-Audit-Log prüfen und Passwort ändern.",
          ].join("\n"),
        }),
      });
      linkDelivered = res.ok;
    }
  } catch {
    linkDelivered = false;
  }

  await logAudit({
    action: "impersonate_generate_link",
    targetType: "user",
    targetId: body.user_id,
    details: {
      target_email: authUser.user.email,
      target_username: (target as { username: string }).username,
      link_delivered_via: linkDelivered ? "email" : "pending_email",
    },
  });

  return NextResponse.json({
    ok: true,
    link_sent_to_admin_email: linkDelivered,
    admin_email: linkDelivered ? email : null,
    expires_in_minutes: 60,
    target: { id: body.user_id, username: (target as { username: string }).username, email: authUser.user.email, display_name: (target as { display_name: string | null }).display_name },
    notice: linkDelivered
      ? "Magic-Link wurde an deine Admin-Email gesendet. In einem Private-Window öffnen."
      : "Email-Versand fehlgeschlagen (RESEND_API_KEY fehlt oder Admin hat keine Email). Kontaktiere Ops.",
    admin: { id: adminId, role, email },
  });
}
