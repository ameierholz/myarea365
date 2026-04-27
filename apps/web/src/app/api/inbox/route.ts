import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/inbox?category=...&subcategory=...&unread=1&starred=1
 * Liefert Nachrichten der gewählten Kategorie inkl. Render-Daten.
 */
export async function GET(req: Request) {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: "not_authenticated" }, { status: 401 });

  const url = new URL(req.url);
  const category = url.searchParams.get("category") ?? "system";
  const subcategory = url.searchParams.get("subcategory");
  const unread = url.searchParams.get("unread") === "1";
  const starred = url.searchParams.get("starred") === "1";

  const { data, error } = await sb.rpc("get_inbox_messages", {
    p_category: category,
    p_subcategory: subcategory,
    p_only_unread: unread,
    p_starred_only: starred,
    p_limit: 100,
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ messages: data ?? [] });
}
