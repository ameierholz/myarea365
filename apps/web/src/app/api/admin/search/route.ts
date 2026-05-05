import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireStaff } from "@/lib/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/admin/search?q=…
 * Sucht über Runner, Shops, Crews, Tickets in einem Call.
 */
export async function GET(req: NextRequest) {
  await requireStaff();
  const sb = await createClient();
  const url = new URL(req.url);
  const q = (url.searchParams.get("q") ?? "").trim();
  if (q.length < 2) return NextResponse.json({ ok: true, results: [] });

  const like = `%${q}%`;

  // Shops + Groups archived (pivot 2026-05-05) — Suche nur über Users, Crews, Tickets
  const [users, crews, tickets] = await Promise.all([
    sb.from("users").select("id, username, display_name, email")
      .or(`username.ilike.${like},display_name.ilike.${like},email.ilike.${like}`)
      .limit(8),
    sb.from("crews").select("id, name, city, color").ilike("name", like).limit(5),
    sb.from("support_tickets").select("id, subject, email, status")
      .or(`subject.ilike.${like},email.ilike.${like},body.ilike.${like}`)
      .limit(5).then((r) => r, () => ({ data: [] })),
  ]);

  type UserRow = { id: string; username: string | null; display_name: string | null; email: string | null };
  type CrewRow = { id: string; name: string | null; city?: string | null };
  type TicketRow = { id: string; subject: string; email: string; status: string };

  const results: Array<{ kind: string; id: string; title: string; subtitle: string; href: string }> = [];
  for (const u of (users.data ?? []) as UserRow[]) {
    results.push({ kind: "runner", id: u.id, title: u.display_name ?? u.username ?? "—", subtitle: `@${u.username} · ${u.email ?? ""}`, href: `/admin/runners/${u.id}` });
  }
  for (const c of (crews.data ?? []) as CrewRow[]) {
    results.push({ kind: "crew", id: c.id, title: c.name ?? "—", subtitle: c.city ?? "", href: `/admin/crews/${c.id}` });
  }
  for (const t of (tickets.data ?? []) as TicketRow[]) {
    results.push({ kind: "ticket", id: t.id, title: t.subject, subtitle: `${t.email} · ${t.status}`, href: `/admin/support` });
  }

  return NextResponse.json({ ok: true, results });
}
