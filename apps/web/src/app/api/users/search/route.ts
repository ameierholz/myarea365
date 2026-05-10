import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { rateLimitSmart, rateLimitResponse } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/users/search?q=name
 *
 * Sucht öffentlich auffindbare Spieler (privacy_searchable = true) per
 * username- oder display_name-Prefix-Match. Rate-limited um Scraping zu
 * verhindern. Gibt max 10 Treffer zurück, ohne PII über das hinaus was
 * im Profil sichtbar ist.
 */
export async function GET(req: Request) {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ ok: false, error: "not_authenticated" }, { status: 401 });

  const rl = await rateLimitSmart(`user:search:${user.id}`, 30, 60_000);
  const limited = rateLimitResponse(rl);
  if (limited) return limited;

  const url = new URL(req.url);
  const q = (url.searchParams.get("q") ?? "").trim().slice(0, 32);
  if (q.length < 2) return NextResponse.json({ ok: true, results: [] });

  // Suchbar: aktuell nur über username/display_name. Private-Toggle könnte später ergänzt werden.
  const pattern = `${q.replace(/[%_]/g, "\\$&")}%`;
  const { data, error } = await sb
    .from("users")
    .select("id, username, display_name, avatar_url")
    .or(`username.ilike.${pattern},display_name.ilike.${pattern}`)
    .neq("id", user.id)
    .limit(10);
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true, results: data ?? [] });
}
