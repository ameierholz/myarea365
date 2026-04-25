import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { CrewJoinButton } from "./join-button";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const t = await getTranslations("CrewInvite");
  const sb = await createClient();
  const { data: crew } = await sb
    .from("crews")
    .select("name, member_count")
    .eq("invite_code", code.toUpperCase())
    .maybeSingle<{ name: string; member_count: number | null }>();

  const title = crew
    ? t("metaTitleNamed", { name: crew.name })
    : t("metaTitleUnknown", { code: code.toUpperCase() });
  const desc = crew
    ? t("metaDescNamed", { name: crew.name, members: crew.member_count ?? 0 })
    : t("metaDescDefault");

  return {
    title,
    description: desc,
    alternates: { canonical: `/crew/${code.toUpperCase()}` },
    openGraph: {
      title,
      description: desc,
      images: ["/og-default.png"],
    },
  };
}

export default async function CrewInvitePage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const t = await getTranslations("CrewInvite");
  const sb = await createClient();
  const { data: crew } = await sb
    .from("crews")
    .select("id, name, zip, color, faction, member_count, owner_id, invite_code")
    .eq("invite_code", code.toUpperCase())
    .maybeSingle();

  if (!crew) notFound();

  const accent = crew.color || "#22D1C3";
  const factionLabel = (crew.faction === "syndicate" || crew.faction === "gossenbund") ? t("factionGossenbund")
                     : (crew.faction === "vanguard" || crew.faction === "kronenwacht") ? t("factionKronenwacht")
                     : null;

  return (
    <main className="min-h-screen flex items-center justify-center px-4 py-12">
      <div className="max-w-md w-full">
        <div className="text-center mb-6">
          <Image src="/logo.png" alt="MyArea365" width={56} height={56} className="mx-auto mb-3 rounded-full" />
          <div className="text-xs font-bold tracking-widest text-text-muted">{t("kicker")}</div>
        </div>

        <div
          className="rounded-3xl p-8 text-center"
          style={{
            background: `linear-gradient(135deg, ${accent}22, rgba(70,82,122,0.45))`,
            border: `1px solid ${accent}66`,
          }}
        >
          <div
            className="w-20 h-20 mx-auto rounded-2xl flex items-center justify-center text-3xl font-black mb-4"
            style={{ background: `linear-gradient(135deg, ${accent}, ${accent}aa)`, color: "#0F1115", boxShadow: `0 0 24px ${accent}77` }}
          >
            {crew.name.charAt(0).toUpperCase()}
          </div>
          <h1 className="text-2xl font-black text-white mb-2">{crew.name}</h1>
          <div className="text-sm text-text-muted mb-4">
            {factionLabel && <span>{factionLabel} · </span>}
            {crew.zip && <span>{t("zipPrefix", { zip: crew.zip })} · </span>}
            {t("members", { count: crew.member_count ?? 0 })}
          </div>

          <div className="p-4 rounded-xl bg-black/30 mb-6">
            <div className="text-xs text-text-muted">{t("inviteCodeLabel")}</div>
            <div className="text-2xl font-black tracking-widest" style={{ color: accent }}>{crew.invite_code}</div>
          </div>

          <CrewJoinButton crewId={crew.id} code={crew.invite_code} accent={accent} />
        </div>

        <div className="mt-6 p-4 rounded-2xl bg-bg-card border border-border">
          <div className="text-sm font-bold text-white mb-2">{t("whatIsTitle")}</div>
          <p className="text-xs text-text-muted leading-relaxed">
            {t("whatIsBody")}
          </p>
          <Link href="/" className="block text-xs text-primary mt-3 hover:underline">{t("learnMore")}</Link>
        </div>
      </div>
    </main>
  );
}
