import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export const revalidate = 300;

export async function generateMetadata({ params }: { params: Promise<{ username: string }> }) {
  const { username } = await params;
  const decoded = decodeURIComponent(username);
  return {
    title: `${decoded} · MyArea365`,
    description: `Das öffentliche Runner-Profil von @${decoded} auf MyArea365.`,
    openGraph: {
      images: [`/api/share-card/${decoded}`],
    },
    alternates: { canonical: `https://myarea365.de/u/${decoded}` },
  };
}

export default async function PublicProfilePage({ params }: { params: Promise<{ username: string }> }) {
  const { username } = await params;
  const sb = await createClient();
  const { data: user } = await sb
    .from("v_public_profiles")
    .select("*")
    .eq("username", decodeURIComponent(username).toLowerCase())
    .maybeSingle();

  if (!user) notFound();

  const km = ((user.total_distance_m ?? 0) / 1000).toFixed(1);
  const color = user.team_color || "#22D1C3";
  const factionLabel = user.faction === "syndicate" ? "🌙 Nachtpuls" : user.faction === "vanguard" ? "☀️ Sonnenwacht" : null;

  return (
    <main className="min-h-screen px-4 py-12">
      <div className="max-w-xl mx-auto">
        <div className="text-center mb-6">
          <Image src="/logo.png" alt="MyArea365" width={44} height={44} className="mx-auto mb-2 rounded-full" />
          <Link href="/" className="text-xs text-text-muted hover:text-white">MyArea365.de</Link>
        </div>

        <div
          className="rounded-3xl p-8 text-center mb-6"
          style={{ background: `linear-gradient(135deg, ${color}22, rgba(70,82,122,0.45))`, border: `1px solid ${color}55` }}
        >
          <div
            className="w-24 h-24 mx-auto rounded-3xl flex items-center justify-center text-4xl font-black mb-4"
            style={{ background: `linear-gradient(135deg, ${color}, ${color}aa)`, color: "#0F1115", boxShadow: `0 0 30px ${color}77` }}
          >
            {(user.display_name ?? user.username ?? "?").charAt(0).toUpperCase()}
          </div>
          <h1 className="text-3xl font-black text-white">{user.display_name ?? user.username}</h1>
          <div className="text-sm text-text-muted mt-1">@{user.username}</div>
          {factionLabel && <div className="mt-2 text-sm font-bold" style={{ color }}>{factionLabel}</div>}
        </div>

        <div className="grid grid-cols-3 gap-3 mb-6">
          <Stat label="km" value={km} color={color} />
          <Stat label="Läufe" value={String(user.total_walks ?? 0)} color="#FFD700" />
          <Stat label="Level" value={String(user.level ?? 1)} color="#FF2D78" />
        </div>

        <div className="p-6 rounded-2xl bg-bg-card border border-border text-center">
          <div className="text-lg font-bold text-white mb-2">Lauf mit {user.display_name ?? user.username}</div>
          <p className="text-sm text-text-muted mb-4">
            Tritt MyArea365 bei, baue deine eigene Runner-Identität auf und erobere deinen Kiez.
          </p>
          <Link href="/#start" className="inline-block px-6 py-3 rounded-lg bg-primary text-bg-deep font-bold hover:bg-primary-dim">
            Kostenlos registrieren →
          </Link>
        </div>

        <div className="mt-6 text-center">
          <Link href="/leaderboard" className="text-xs text-primary hover:underline">Komplettes Leaderboard →</Link>
        </div>
      </div>
    </main>
  );
}

function Stat({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="p-4 rounded-xl bg-bg-card border border-border text-center">
      <div className="text-2xl font-black" style={{ color }}>{value}</div>
      <div className="text-[10px] font-bold text-text-muted uppercase tracking-wider mt-1">{label}</div>
    </div>
  );
}
