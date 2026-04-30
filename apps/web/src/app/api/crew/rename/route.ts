import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/crew/rename
 * Body: { name?: string; tag?: string }
 * Owner-only: ändert Crew-Namen (max 12) und/oder Crew-Tag (genau 4 Zeichen, A-Z0-9).
 */
export async function POST(req: Request) {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: "auth_required" }, { status: 401 });

  let body: { name?: string; tag?: string };
  try { body = await req.json(); } catch { return NextResponse.json({ error: "invalid_json" }, { status: 400 }); }

  // Crew finden in der der User Owner ist
  const { data: crew } = await sb
    .from("crews")
    .select("id, name, tag, owner_id")
    .eq("owner_id", user.id)
    .maybeSingle<{ id: string; name: string; tag: string | null; owner_id: string }>();

  if (!crew) return NextResponse.json({ error: "not_owner", message: "Nur der Crew-Owner kann den Namen ändern" }, { status: 403 });

  const update: { name?: string; tag?: string } = {};

  if (typeof body.name === "string") {
    const n = body.name.trim();
    if (n.length < 2 || n.length > 12) {
      return NextResponse.json({ error: "name_length", message: "Crew-Name muss 2–12 Zeichen lang sein" }, { status: 400 });
    }
    if (!/^[\p{L}\p{N} _.\-äöüÄÖÜß]+$/u.test(n)) {
      return NextResponse.json({ error: "name_invalid_chars", message: "Crew-Name: nur Buchstaben, Zahlen, Leerzeichen, _ . - erlaubt" }, { status: 400 });
    }
    update.name = n;
  }

  if (typeof body.tag === "string") {
    const t = body.tag.trim().toUpperCase();
    if (!/^[A-Z0-9]{4}$/.test(t)) {
      return NextResponse.json({ error: "tag_invalid", message: "Tag muss exakt 4 Zeichen sein (A–Z, 0–9)" }, { status: 400 });
    }
    // Eindeutigkeit (case-insensitive)
    const { data: dup } = await sb
      .from("crews")
      .select("id")
      .eq("tag", t)
      .neq("id", crew.id)
      .maybeSingle();
    if (dup) {
      return NextResponse.json({ error: "tag_taken", message: `Tag [${t}] ist bereits vergeben` }, { status: 409 });
    }
    update.tag = t;
  }

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: "no_changes" }, { status: 400 });
  }

  const { error } = await sb.from("crews").update(update).eq("id", crew.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true, ...update });
}
