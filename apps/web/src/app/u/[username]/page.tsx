import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import { getTranslations, getLocale } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { AdSenseSlot } from "@/components/adsense-slot";
import { getNumberLocale } from "@/i18n/config";

export const revalidate = 300;

export async function generateMetadata({ params }: { params: Promise<{ username: string }> }) {
  const t = await getTranslations("PublicProfile");
  const { username } = await params;
  const decoded = decodeURIComponent(username);
  return {
    title: `${decoded} · MyArea365`,
    description: t("metaDescription", { name: decoded }),
    openGraph: {
      images: [`/api/share-card/${decoded}`],
    },
    alternates: { canonical: `https://myarea365.de/u/${decoded}` },
  };
}

export default async function PublicProfilePage({ params }: { params: Promise<{ username: string }> }) {
  const t = await getTranslations("PublicProfile");
  const locale = await getLocale();
  const numLocale = getNumberLocale(locale);
  const { username } = await params;
  const sb = await createClient();
  const { data: user } = await sb
    .from("v_public_profiles")
    .select("*")
    .eq("username", decodeURIComponent(username).toLowerCase())
    .maybeSingle();

  if (!user) notFound();

  const { data: prestigeRows } = await sb.from("user_prestige")
    .select("season_id, final_rank, final_wins, prestige_points, title, awarded_at, arena_seasons!inner(number, name)")
    .eq("user_id", user.id)
    .order("awarded_at", { ascending: false });
  const totalPrestige = (prestigeRows ?? []).reduce((s, r: { prestige_points: number }) => s + r.prestige_points, 0);

  const km = ((user.total_distance_m ?? 0) / 1000).toFixed(1);
  const fNorm = (user.faction === "vanguard" || user.faction === "kronenwacht") ? "kronenwacht"
              : (user.faction === "syndicate" || user.faction === "gossenbund") ? "gossenbund"
              : null;
  const color = fNorm === "gossenbund" ? "#22D1C3" : fNorm === "kronenwacht" ? "#FFD700" : "#22D1C3";
  const factionLabel = fNorm === "gossenbund" ? t("factionGossen") : fNorm === "kronenwacht" ? t("factionKronen") : null;
  const displayName = user.display_name ?? user.username;

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
          <h1 className="text-3xl font-black text-white">{displayName}</h1>
          <div className="text-sm text-text-muted mt-1">@{user.username}</div>
          {factionLabel && <div className="mt-2 text-sm font-bold" style={{ color }}>{factionLabel}</div>}
        </div>

        <div className="grid grid-cols-3 gap-3 mb-3">
          <Stat label={t("statKm")} value={km} color={color} />
          <Stat label={t("statRuns")} value={String(user.total_walks ?? 0)} color="#FFD700" />
          <Stat label={t("statLevel")} value={String(user.level ?? 1)} color="#FF2D78" />
        </div>
        <div className="grid grid-cols-3 gap-3 mb-6">
          <Stat label={t("statCoins")}  value={(user.wegemuenzen ?? 0).toLocaleString(numLocale)}  color="#22D1C3" />
          <Stat label={t("statRep")}    value={(user.gebietsruf ?? 0).toLocaleString(numLocale)}   color="#FF2D78" />
          <Stat label={t("statHonor")}  value={(user.sessionehre ?? 0).toLocaleString(numLocale)}  color="#FFD700" />
        </div>

        <AdSenseSlot placement="public_profile" />

        {prestigeRows && prestigeRows.length > 0 && (
          <div className="mb-6 p-5 rounded-2xl" style={{
            background: "radial-gradient(ellipse at top, rgba(255,215,0,0.12) 0%, transparent 60%), rgba(26,29,35,0.9)",
            border: "1px solid rgba(255,215,0,0.35)",
          }}>
            <div className="flex items-center justify-between mb-4">
              <div>
                <div className="text-[10px] font-black tracking-widest text-[#FFD700]">{t("prestigeKicker")}</div>
                <div className="text-xl font-black text-white mt-0.5">
                  {totalPrestige.toLocaleString(numLocale)} <span className="text-xs text-[#a8b4cf] font-bold">{t("prestigePoints")}</span>
                </div>
              </div>
              <div className="text-right">
                <div className="text-[10px] text-[#8B8FA3] font-bold tracking-wider">{t("prestigeSeasons")}</div>
                <div className="text-xl font-black text-[#FFD700]">{prestigeRows.length}</div>
              </div>
            </div>
            <div className="space-y-2">
              {prestigeRows.slice(0, 6).map((p: {
                season_id: string; final_rank: number; prestige_points: number; title: string | null;
                arena_seasons: { number: number; name: string } | { number: number; name: string }[];
              }) => {
                const s = Array.isArray(p.arena_seasons) ? p.arena_seasons[0] : p.arena_seasons;
                const titleMeta = p.title === "Champion" ? { color: "#FFD700", icon: "🥇" }
                               : p.title === "Gladiator" ? { color: "#C0C0C0", icon: "🥈" }
                               : p.title === "Kriegsmeister" ? { color: "#CD7F32", icon: "🥉" }
                               : p.title === "Veteran" ? { color: "#a855f7", icon: "🎖️" }
                               : { color: "#8B8FA3", icon: "⚔️" };
                return (
                  <div key={p.season_id} className="flex items-center gap-3 p-2 rounded-lg bg-black/30">
                    <div className="text-2xl">{titleMeta.icon}</div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-black text-white">{t("seasonHeader", { n: s.number, name: s.name })}</div>
                      <div className="text-[11px] text-[#a8b4cf]">
                        {t("rankLabel")} <b style={{ color: titleMeta.color }}>#{p.final_rank}</b>
                        {p.title && <> · <span style={{ color: titleMeta.color, fontWeight: 800 }}>{p.title}</span></>}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-black text-[#FFD700]">{p.prestige_points}</div>
                      <div className="text-[9px] text-[#8B8FA3]">{t("prestigeLabel")}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <div className="p-6 rounded-2xl bg-bg-card border border-border text-center">
          <div className="text-lg font-bold text-white mb-2">{t("ctaTitle", { name: displayName })}</div>
          <p className="text-sm text-text-muted mb-4">
            {t("ctaBody")}
          </p>
          <Link href="/#start" className="inline-block px-6 py-3 rounded-lg bg-primary text-bg-deep font-bold hover:bg-primary-dim">
            {t("ctaBtn")}
          </Link>
        </div>

        <div className="mt-6 text-center">
          <Link href="/leaderboard" className="text-xs text-primary hover:underline">{t("leaderboardLink")}</Link>
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
