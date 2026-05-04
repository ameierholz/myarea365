import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/heimat/donate-resources
 * Body: { to_user_id, amounts: { wood?, stone?, gold?, mana? } }
 *
 * Ruft donate_to_crew_member pro Resource-Type auf (RPC limitiert auf 1000/call,
 * 5000 daily empfangs-cap). Mehrere Calls pro Resource bis Wunsch-Menge erreicht.
 */
export async function POST(req: NextRequest) {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: "not_authenticated" }, { status: 401 });

  const body = await req.json() as {
    to_user_id?: string;
    amounts?: { wood?: number; stone?: number; gold?: number; mana?: number };
  };
  if (!body.to_user_id || !body.amounts) {
    return NextResponse.json({ error: "missing_params" }, { status: 400 });
  }

  const results: Record<string, { sent: number; error: string | null }> = {};
  for (const [type, total] of Object.entries(body.amounts)) {
    if (!total || total <= 0) continue;
    let sent = 0;
    let err: string | null = null;
    while (sent < total) {
      const chunk = Math.min(1000, total - sent);
      const { data, error } = await sb.rpc("donate_to_crew_member", {
        p_to_user: body.to_user_id,
        p_resource_type: type,
        p_amount: chunk,
      });
      if (error) { err = error.message; break; }
      const j = data as { ok?: boolean; error?: string } | null;
      if (!j?.ok) { err = j?.error ?? "donate_failed"; break; }
      sent += chunk;
    }
    results[type] = { sent, error: err };
  }

  return NextResponse.json({ ok: true, results });
}
