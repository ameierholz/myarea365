import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/account/rename/check?name=Foo
 * Liefert ob der gewünschte Anzeigename frei ist (case-insensitive),
 * ohne tatsächlich zu ändern oder Diamanten abzubuchen.
 *
 * → { ok, available: boolean, valid: boolean, reason?: string }
 */
export async function GET(req: Request) {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: "auth_required" }, { status: 401 });

  const url = new URL(req.url);
  const raw = (url.searchParams.get("name") ?? "").trim();

  if (raw.length < 2 || raw.length > 15) {
    return NextResponse.json({ ok: true, valid: false, available: false, reason: "name_length" });
  }
  if (!/^[\p{L}\p{N} _.\-äöüÄÖÜß]+$/u.test(raw)) {
    return NextResponse.json({ ok: true, valid: false, available: false, reason: "name_invalid_chars" });
  }

  const lower = raw.toLowerCase();

  // Eigener aktueller Name → "frei" zurückgeben (kein Konflikt mit sich selbst)
  const { data: me } = await sb.from("users").select("display_name").eq("id", user.id).maybeSingle<{ display_name: string | null }>();
  if (me?.display_name && me.display_name.trim().toLowerCase() === lower) {
    return NextResponse.json({ ok: true, valid: true, available: true, self: true });
  }

  // Andere User mit identischem display_name oder username
  const { count: dupCount } = await sb
    .from("users")
    .select("id", { count: "exact", head: true })
    .neq("id", user.id)
    .or(`display_name.ilike.${lower},username.ilike.${lower}`);

  return NextResponse.json({
    ok: true,
    valid: true,
    available: (dupCount ?? 0) === 0,
  });
}
