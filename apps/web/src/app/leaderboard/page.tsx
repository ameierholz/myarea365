import Link from "next/link";
import Image from "next/image";
import { createClient } from "@/lib/supabase/server";

export const revalidate = 300;

export async function generateMetadata({ searchParams }: { searchParams: Promise<{ faction?: string; scope?: string }> }) {
  const sp = await searchParams;
  const titleSuffix = sp.faction === "syndicate" ? " · Nachtpuls" : sp.faction === "vanguard" ? " · Sonnenwacht" : "";
  return {
    title: `Leaderboard${titleSuffix} · MyArea365`,
    description: "Die aktivsten Runner deutschlandweit. Gamifizierte Lauf-Community — erobere deine Stadt.",
    alternates: { canonical: "https://myarea365.de/leaderboard" },
  };
}

export default async function LeaderboardPage({ searchParams }: { searchParams: Promise<{ faction?: string }> }) {
  const sp = await searchParams;
  const sb = await createClient();

  let q = sb.from("v_public_profiles")
    .select("username, display_name, faction, total_distance_m, total_walks, total_xp, level, team_color")
    .order("total_xp", { ascending: false })
    .limit(100);
  if (sp.faction === "syndicate" || sp.faction === "vanguard") q = q.eq("faction", sp.faction);

  const { data: runners } = await q;

  return (
    <main className="min-h-screen px-4 py-12">
      <div className="max-w-3xl mx-auto">
        <div className="text-center mb-8">
          <Image src="/logo.png" alt="MyArea365" width={48} height={48} className="mx-auto mb-3 rounded-full" />
          <Link href="/" className="text-xs text-text-muted hover:text-white">← MyArea365.de</Link>
          <h1 className="text-3xl sm:text-4xl font-black text-white mt-3">🏆 Leaderboard</h1>
          <p className="text-text-muted mt-2">Die aktivsten Runner deutschlandweit</p>
        </div>

        <div className="flex justify-center gap-2 mb-6 flex-wrap">
          <FilterChip href="/leaderboard" label="🌍 Alle" active={!sp.faction} />
          <FilterChip href="/leaderboard?faction=syndicate" label="🌙 Nachtpuls" active={sp.faction === "syndicate"} />
          <FilterChip href="/leaderboard?faction=vanguard" label="☀️ Sonnenwacht" active={sp.faction === "vanguard"} />
        </div>

        <div className="bg-bg-card border border-border rounded-2xl overflow-hidden">
          {(runners ?? []).map((r, i) => {
            const km = ((r.total_distance_m ?? 0) / 1000).toFixed(1);
            const color = r.team_color || "#22D1C3";
            return (
              <Link
                key={r.username}
                href={`/u/${r.username}`}
                className="flex items-center gap-3 px-4 py-3 border-b border-border/50 last:border-0 hover:bg-white/5 transition-colors"
              >
                <div className="w-8 text-center text-xs font-black" style={{ color: i < 3 ? "#FFD700" : "#8b8fa3" }}>#{i + 1}</div>
                <div className="w-10 h-10 rounded-full flex items-center justify-center font-bold" style={{ background: `linear-gradient(135deg, ${color}, ${color}aa)`, color: "#0F1115" }}>
                  {(r.display_name ?? r.username ?? "?").charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-white font-bold truncate">{r.display_name ?? r.username}</div>
                  <div className="text-xs text-text-muted">@{r.username} · Lvl {r.level ?? 1}</div>
                </div>
                <div className="text-right">
                  <div className="text-sm font-black" style={{ color }}>{(r.total_xp ?? 0).toLocaleString("de-DE")} XP</div>
                  <div className="text-xs text-text-muted">{km} km</div>
                </div>
              </Link>
            );
          })}
          {(runners ?? []).length === 0 && (
            <div className="p-12 text-center text-text-muted text-sm">Noch keine Runner im Ranking.</div>
          )}
        </div>

        <div className="mt-8 text-center">
          <Link href="/#start" className="inline-block px-6 py-3 rounded-lg bg-primary text-bg-deep font-bold hover:bg-primary-dim">
            Kostenlos mitmachen →
          </Link>
        </div>
      </div>
    </main>
  );
}

function FilterChip({ href, label, active }: { href: string; label: string; active: boolean }) {
  return (
    <Link
      href={href}
      className={`px-3 py-1.5 rounded-full text-sm font-bold transition-colors ${active ? "bg-primary text-bg-deep" : "bg-white/5 text-text-muted hover:text-white"}`}
    >
      {label}
    </Link>
  );
}
