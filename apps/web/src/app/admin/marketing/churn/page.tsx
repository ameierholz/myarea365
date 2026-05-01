import Link from "next/link";
import { requireStaff } from "@/lib/admin";
import { createClient } from "@/lib/supabase/server";
import { PageTitle, Card, Badge, Table, Tr, Td, Stat } from "../../_components/ui";

export const dynamic = "force-dynamic";

// Churn-Risiko-Heuristik:
// Score 0-100 basierend auf:
//  - Aktivitäts-Trend: lief in letzten 7d weniger als in 8-14d (Activity-Decline)
//  - Total-XP: höher = wertvoller (Verlust schmerzt mehr)
//  - Streak gebrochen
//  - Letzter Login >7d aber <30d (Frische gegangen, noch nicht weg)
// Kein ML — bewusst transparent + erklärbar.
export default async function ChurnPage() {
  await requireStaff();
  const sb = await createClient();
  const now = Date.now();
  const ago7  = new Date(now - 7  * 86400000).toISOString();
  const ago14 = new Date(now - 14 * 86400000).toISOString();
  const ago30 = new Date(now - 30 * 86400000).toISOString();

  // Hole users mit XP > 1000, last_login zwischen 7d und 30d (echte Risiko-Zone)
  const { data: candidates } = await sb.from("users")
    .select("id, username, display_name, email, total_xp, total_distance_m, streak_best, last_login_at, faction")
    .gte("total_xp", 1000)
    .gte("last_login_at", ago30)
    .lte("last_login_at", ago7)
    .order("total_xp", { ascending: false })
    .limit(200);

  // Walks-Counts in beiden Fenstern für Decline-Score
  const ids = (candidates ?? []).map((u) => u.id);
  let recentWalks = new Map<string, number>();
  let priorWalks = new Map<string, number>();
  if (ids.length > 0) {
    const [r1, r2] = await Promise.all([
      sb.from("walks").select("user_id").gte("created_at", ago7).in("user_id", ids),
      sb.from("walks").select("user_id").gte("created_at", ago14).lt("created_at", ago7).in("user_id", ids),
    ]);
    for (const w of r1.data ?? []) recentWalks.set(w.user_id, (recentWalks.get(w.user_id) ?? 0) + 1);
    for (const w of r2.data ?? []) priorWalks.set(w.user_id, (priorWalks.get(w.user_id) ?? 0) + 1);
  }

  type Candidate = NonNullable<typeof candidates>[number];
  type Scored = Candidate & { score: number; reasons: string[]; recent: number; prior: number };
  const scored: Scored[] = (candidates ?? []).map((u) => {
    const recent = recentWalks.get(u.id) ?? 0;
    const prior  = priorWalks.get(u.id) ?? 0;
    const reasons: string[] = [];
    let score = 0;
    // Activity-Decline
    if (prior > 0 && recent === 0) { score += 50; reasons.push("0 Walks letzten 7d (vorher aktiv)"); }
    else if (recent < prior / 2 && prior > 1) { score += 30; reasons.push("Walks halbiert vs Vorwoche"); }
    // Login-Frische
    const loginAgo = u.last_login_at ? Math.floor((now - new Date(u.last_login_at).getTime()) / 86400000) : 999;
    if (loginAgo > 14) { score += 25; reasons.push(`Letzter Login vor ${loginAgo}d`); }
    else if (loginAgo > 7) { score += 10; reasons.push(`Letzter Login vor ${loginAgo}d`); }
    // High-Value-Bonus
    if ((u.total_xp ?? 0) > 50000) { score += 15; reasons.push("High-Value-User (>50k XP)"); }
    else if ((u.total_xp ?? 0) > 10000) { score += 8; reasons.push("Wertvoller User (>10k XP)"); }
    // Streak gebrochen (relativ zu best)
    if ((u.streak_best ?? 0) >= 7 && loginAgo > 2) { score += 15; reasons.push(`Streak von ${u.streak_best} gebrochen`); }
    return { ...u, score: Math.min(100, score), reasons, recent, prior };
  }).sort((a, b) => b.score - a.score).slice(0, 50);

  const high = scored.filter((s) => s.score >= 60).length;
  const med  = scored.filter((s) => s.score >= 30 && s.score < 60).length;
  const lo   = scored.length - high - med;

  return (
    <>
      <PageTitle title="📉 Churn-Risiko" subtitle="Heuristisches Scoring: high-value User die wegzubrechen drohen" />

      <div className="grid grid-cols-3 gap-4 mb-6">
        <Stat label="Hohes Risiko (≥60)" value={high} color="#FF2D78" />
        <Stat label="Mittel (30-59)" value={med} color="#FFD700" />
        <Stat label="Niedrig (<30)" value={lo} color="#4ade80" />
      </div>

      <Card className="mb-4">
        <div className="text-xs text-[#8b8fa3]">
          <b className="text-white">So funktioniert das Score-Modell:</b> +50 wenn 0 Walks die letzten 7d (vorher aktiv) ·
          +30 wenn Walks halbiert vs Vorwoche · +25 wenn Letzter Login &gt;14d ·
          +15 wenn &gt;50k XP · +15 wenn 7d+ Streak gebrochen.
          Max 100. Kein ML — transparent &amp; erklärbar.
        </div>
      </Card>

      <Table headers={["Score", "Runner", "XP", "Walks 7d/14d", "Letzter Login", "Begründung", "Action"]}>
        {scored.map((s) => (
          <Tr key={s.id}>
            <Td>
              <Badge tone={s.score >= 60 ? "danger" : s.score >= 30 ? "warning" : "success"}>{s.score}</Badge>
            </Td>
            <Td>
              <Link href={`/admin/runners/${s.id}`} className="text-[#22D1C3] hover:underline">{s.display_name ?? s.username}</Link>
              <div className="text-[10px] text-[#8b8fa3]">{s.email}</div>
            </Td>
            <Td className="text-xs">{(s.total_xp ?? 0).toLocaleString("de-DE")}</Td>
            <Td className="text-xs">{s.recent} / {s.prior}</Td>
            <Td className="text-xs text-[#8b8fa3]">{s.last_login_at ? new Date(s.last_login_at).toLocaleDateString("de-DE") : "—"}</Td>
            <Td className="text-[10px] text-[#a8b4cf]">{s.reasons.join(" · ")}</Td>
            <Td>
              <Link href={`/admin/marketing/campaigns/new?to=${s.id}&template=winback`} className="text-xs px-2 py-1 rounded bg-[#22D1C3] text-black font-bold">📧 Winback</Link>
            </Td>
          </Tr>
        ))}
      </Table>
      {scored.length === 0 && <Card><p className="text-sm text-[#8b8fa3]">Aktuell keine Runner im Risiko-Fenster (XP ≥1000, Login 7-30d her).</p></Card>}
    </>
  );
}
