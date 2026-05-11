import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Row = {
  id: string;
  username: string | null;
  display_name: string | null;
  level: number | null;
  ansehen: number | null;
  heimat_plz: string | null;
};

/**
 * GET /api/leaderboard/plz-thron?plz=10827
 *
 * Ohne plz: Liste aller PLZ-Throne — der/die Spieler:in mit dem höchsten
 * Ansehen pro Heimat-PLZ.
 *
 * Mit plz: Top-10-Ranking innerhalb dieser PLZ nach Ansehen.
 *
 * Im Gegensatz zur alten Kiez-Liga (wöchentlich, km-basiert) ist der
 * PLZ-Thron persistent — wer dauerhaft die höchste Reputation in seinem
 * Kiez hat, trägt die Krone. Reset findet via Ansehen-Decay statt.
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const plzFilter = url.searchParams.get("plz");
  const sb = await createClient();

  if (plzFilter && /^[0-9]{5}$/.test(plzFilter)) {
    const { data } = await sb
      .from("users")
      .select("id, username, display_name, level, ansehen, heimat_plz")
      .eq("heimat_plz", plzFilter)
      .neq("privacy_leaderboard", false)
      .neq("is_banned", true)
      .not("username", "is", null)
      .gt("ansehen", 0)
      .order("ansehen", { ascending: false })
      .limit(10);

    const rows = (data ?? []) as Row[];
    return NextResponse.json({
      plz: plzFilter,
      ranking: rows.map((r, i) => ({
        rank: i + 1,
        user_id: r.id,
        display_name: r.display_name,
        username: r.username,
        level: r.level ?? 1,
        ansehen: Number(r.ansehen ?? 0),
      })),
    });
  }

  // Übersicht: höchster Ansehen-Spieler pro Heimat-PLZ
  const { data } = await sb
    .from("users")
    .select("id, username, display_name, level, ansehen, heimat_plz")
    .neq("privacy_leaderboard", false)
    .neq("is_banned", true)
    .not("username", "is", null)
    .not("heimat_plz", "is", null)
    .gt("ansehen", 0)
    .order("ansehen", { ascending: false })
    .limit(2000);

  const rows = (data ?? []) as Row[];

  // PLZ-Gruppierung: erster Treffer pro PLZ = King (Order ist DESC ansehen)
  const seen = new Set<string>();
  const counts = new Map<string, number>();
  for (const r of rows) {
    if (!r.heimat_plz) continue;
    counts.set(r.heimat_plz, (counts.get(r.heimat_plz) ?? 0) + 1);
  }

  const kings = rows
    .filter((r) => {
      if (!r.heimat_plz || seen.has(r.heimat_plz)) return false;
      seen.add(r.heimat_plz);
      return true;
    })
    .map((r) => ({
      plz: r.heimat_plz!,
      user_id: r.id,
      display_name: r.display_name,
      username: r.username,
      level: r.level ?? 1,
      ansehen: Number(r.ansehen ?? 0),
      residents: counts.get(r.heimat_plz!) ?? 1,
    }))
    .sort((a, b) => a.plz.localeCompare(b.plz));

  return NextResponse.json({ kings });
}
