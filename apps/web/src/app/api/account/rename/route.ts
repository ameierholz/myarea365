import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/account/rename
 * Body: { display_name: string }
 *
 * Ruft `rename_runner_with_gems` (security definer) auf:
 *  - Erstes Setzen ist gratis.
 *  - Jede weitere Änderung kostet 500 Edelsteine.
 *  - Eindeutigkeit (case-insensitive) gegen display_name + username wird in DB geprüft.
 */
export async function POST(req: Request) {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: "auth_required" }, { status: 401 });

  let body: { display_name?: string };
  try { body = await req.json(); } catch { return NextResponse.json({ error: "invalid_json" }, { status: 400 }); }

  const { data, error } = await sb.rpc("rename_runner_with_gems", {
    p_new_name: (body.display_name ?? "").trim(),
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const result = data as {
    ok: boolean; error?: string; message?: string;
    display_name?: string; cost?: number; first_time?: boolean; have?: number; unchanged?: boolean;
  };

  if (!result?.ok) {
    const status = result?.error === "auth_required" ? 401
      : result?.error === "name_taken" ? 409
      : result?.error === "insufficient_gems" ? 402
      : 400;
    return NextResponse.json(result, { status });
  }
  return NextResponse.json(result);
}
