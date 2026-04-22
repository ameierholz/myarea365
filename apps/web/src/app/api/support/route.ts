import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  createClient as createAdminClient,
  type SupabaseClient,
} from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

let _admin: SupabaseClient | null = null;
function admin(): SupabaseClient {
  if (_admin) return _admin;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Supabase admin creds missing");
  _admin = createAdminClient(url, key, { auth: { persistSession: false } });
  return _admin;
}

const CATEGORIES = new Set([
  "general",
  "bug",
  "billing",
  "partner",
  "abuse",
  "other",
]);

export async function POST(req: NextRequest) {
  let body: {
    email?: string;
    name?: string;
    subject?: string;
    body?: string;
    category?: string;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { ok: false, error: "invalid JSON" },
      { status: 400 },
    );
  }

  const email = (body.email ?? "").trim().slice(0, 200);
  const name = (body.name ?? "").trim().slice(0, 120) || null;
  const subject = (body.subject ?? "").trim().slice(0, 200);
  const msg = (body.body ?? "").trim().slice(0, 4000);
  const category = CATEGORIES.has(body.category ?? "")
    ? (body.category as string)
    : "general";

  if (!email || !subject || !msg) {
    return NextResponse.json(
      { ok: false, error: "E-Mail, Betreff und Nachricht erforderlich." },
      { status: 400 },
    );
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json(
      { ok: false, error: "Ungültige E-Mail-Adresse." },
      { status: 400 },
    );
  }

  // Logged-in user (optional) — anonymes Formular erlaubt
  const sb = await createClient();
  const { data: auth } = await sb.auth.getUser();
  const userId = auth?.user?.id ?? null;

  // Priorität auto-heuristisch
  const priority =
    category === "billing" || category === "abuse"
      ? "high"
      : category === "bug"
        ? "normal"
        : "normal";

  // Rate-Limit: max 5 Tickets pro E-Mail in 1h
  const since = new Date(Date.now() - 3600_000).toISOString();
  const { count: recentCount } = await admin()
    .from("support_tickets")
    .select("id", { count: "exact", head: true })
    .eq("email", email)
    .gte("created_at", since);
  if ((recentCount ?? 0) >= 5) {
    return NextResponse.json(
      {
        ok: false,
        error:
          "Zu viele Anfragen in kurzer Zeit. Bitte warte eine Stunde oder kontaktiere uns per E-Mail.",
      },
      { status: 429 },
    );
  }

  const userAgent = req.headers.get("user-agent")?.slice(0, 500) ?? null;

  const { data: ticket, error } = await admin()
    .from("support_tickets")
    .insert({
      user_id: userId,
      email,
      name,
      subject,
      body: msg,
      category,
      priority,
      source: userId ? "in_app" : "contact_form",
      user_agent: userAgent,
    })
    .select("id")
    .single();

  if (error) {
    return NextResponse.json(
      { ok: false, error: error.message },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true, ticket_id: (ticket as { id: string }).id });
}
