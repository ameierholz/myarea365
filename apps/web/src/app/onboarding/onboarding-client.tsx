"use client";

import { useState, useEffect, useMemo } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { createClient } from "@/lib/supabase/client";
import { Loader2, ArrowRight, Info } from "lucide-react";

type GuardianFaction = "gossenbund" | "kronenwacht" | "netzhueter";

type StarterMap = Record<GuardianFaction, {
  archetype_id: string;
  name: string;
  rarity: string;
  guardian_type: string;
}>;

export function OnboardingClient() {
  const t = useTranslations("OnboardingPage");
  const router = useRouter();
  const supabase = createClient();

  const FACTIONS = useMemo(() => [
    { id: "gossenbund" as const,  name: t("factionGossenbund"),  icon: "🔗",  color: "#FF6B4A", motto: t("factionGossenbundMotto") },
    { id: "kronenwacht" as const, name: t("factionKronenwacht"), icon: "🛡️", color: "#FFD700", motto: t("factionKronenwachtMotto") },
    { id: "netzhueter" as const,  name: t("factionNetzhueter"),  icon: "💻", color: "#22D1C3", motto: t("factionNetzhueterMotto") },
  ], [t]);

  const [username, setUsername] = useState("");
  const [guardianFaction, setGuardianFaction] = useState<GuardianFaction | null>(null);
  const [newsletter, setNewsletter] = useState(false);
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [showInfo, setShowInfo] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [starterMap, setStarterMap] = useState<StarterMap | null>(null);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push("/login"); return; }
      setUserId(user.id);
      setEmail(user.email || "");

      // Profile lesen — wenn schon komplett, direkt weiter
      const { data: profile } = await supabase
        .from("users").select("username, guardian_faction").eq("id", user.id).maybeSingle();
      if (profile?.username && profile?.guardian_faction) {
        const { data: guardian } = await supabase
          .from("user_guardians").select("id").eq("user_id", user.id).limit(1).maybeSingle();
        if (guardian) { router.push("/karte"); return; }
        // Guardian fehlt trotz Faction → noch granten
        await supabase.rpc("grant_starter_guardian");
        router.push("/karte");
        return;
      }
      if (profile?.username) {
        setUsername(profile.username);
      } else {
        const suggested = (user.user_metadata?.name || user.email?.split("@")[0] || "")
          .replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 24);
        setUsername(suggested);
      }

      // Starter-Map laden — pro Fraktion ein Wächter mit Anzeigedaten
      const { data: starters } = await supabase
        .from("faction_starter_guardian")
        .select("faction, archetype_id, guardian_archetypes!inner(name, rarity, guardian_type)");
      if (starters) {
        const map: StarterMap = {} as StarterMap;
        for (const raw of starters as unknown as Array<{ faction: string; archetype_id: string; guardian_archetypes: { name: string; rarity: string; guardian_type: string } | { name: string; rarity: string; guardian_type: string }[] }>) {
          const arch = Array.isArray(raw.guardian_archetypes) ? raw.guardian_archetypes[0] : raw.guardian_archetypes;
          if (!arch) continue;
          map[raw.faction as GuardianFaction] = {
            archetype_id: raw.archetype_id,
            name: arch.name,
            rarity: arch.rarity,
            guardian_type: arch.guardian_type,
          };
        }
        setStarterMap(map);
      }
    })();
  }, [supabase, router]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!userId) return;
    if (username.length < 3) return setError(t("runnerNameMin"));
    if (!guardianFaction) return setError(t("factionRequired"));
    if (!acceptTerms) return setError(t("termsRequired"));

    setLoading(true);

    // Username-Kollision prüfen
    const { data: existing } = await supabase
      .from("users").select("id").eq("username", username.toLowerCase()).neq("id", userId).maybeSingle();
    if (existing) { setError(t("usernameTaken")); setLoading(false); return; }

    // Profile + guardian_faction speichern (faction-Spalte für Spielstil bleibt unangetastet)
    const { error: upsertErr } = await supabase.from("users").upsert({
      id: userId,
      username: username.toLowerCase(),
      display_name: username,
      guardian_faction: guardianFaction,
      newsletter_opt_in: newsletter,
    });
    if (upsertErr) { setError(upsertErr.message); setLoading(false); return; }

    // Start-Wächter granten
    const { data: grantRes, error: grantErr } = await supabase.rpc("grant_starter_guardian");
    if (grantErr || (grantRes as { error?: string })?.error) {
      setError(grantErr?.message || (grantRes as { error?: string })?.error || t("guardianGrantError"));
      setLoading(false);
      return;
    }

    router.push("/karte");
    router.refresh();
  }

  const selectedStarter = guardianFaction ? starterMap?.[guardianFaction] : null;

  return (
    <main className="min-h-screen flex items-center justify-center px-4 py-10 bg-bg">
      <div className="w-full max-w-lg">
        <div className="text-center mb-6">
          <Image src="/logo.png" alt="MyArea365" width={64} height={64} className="mx-auto mb-3 rounded-full" />
          <h1 className="text-2xl font-bold">{t("title")}</h1>
          <p className="text-sm text-text-muted mt-1">
            {t.rich("subtitle", { email: () => <span className="text-text">{email}</span> })}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3 p-5 rounded-2xl bg-bg-card border border-border">
          <div>
            <label className="text-xs font-semibold text-text-muted">{t("runnerName")}</label>
            <input
              type="text" required minLength={3} maxLength={24} value={username}
              onChange={(e) => setUsername(e.target.value.replace(/[^a-zA-Z0-9_-]/g, ""))}
              placeholder={t("runnerNamePlaceholder")}
              className="mt-1 w-full px-4 py-2.5 rounded-lg bg-bg-elevated/80 border border-border text-text text-sm focus:outline-none focus:border-primary/50"
            />
          </div>

          <div className="relative">
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-semibold text-text-muted">{t("factionLabel")}</label>
              <button type="button" onClick={() => setShowInfo(v => !v)} className="inline-flex items-center gap-1 text-xs text-primary">
                <Info className="w-3 h-3" />{showInfo ? t("factionInfoClose") : t("factionInfo")}
              </button>
            </div>
            {showInfo && (
              <div className="absolute right-0 -top-2 -translate-y-full z-40 w-72 p-3 rounded-lg bg-bg-elevated border border-primary/60 text-[11px] text-text-muted leading-relaxed shadow-2xl">
                {t.rich("factionInfoBody", { b: (c) => <b className="text-text">{c}</b> })}
                <span className="block mt-1 text-text-muted">{t("factionInfoSwitch")}</span>
              </div>
            )}
            <div className="grid grid-cols-3 gap-2">
              {FACTIONS.map((f) => {
                const active = guardianFaction === f.id;
                const starter = starterMap?.[f.id];
                return (
                  <button key={f.id} type="button" onClick={() => setGuardianFaction(f.id)}
                    className={`p-2.5 rounded-lg border text-left transition-all ${active ? "border-transparent" : "border-border hover:border-primary/30"}`}
                    style={{ background: active ? `${f.color}22` : undefined, borderColor: active ? f.color : undefined, boxShadow: active ? `0 0 12px ${f.color}33` : undefined }}>
                    <div className="flex items-center gap-1.5 mb-0.5">
                      <span className="text-base">{f.icon}</span>
                      <span className="font-bold text-xs" style={{ color: active ? f.color : undefined }}>{f.name}</span>
                    </div>
                    <div className="text-[10px] text-text-muted leading-tight mb-1.5">{f.motto}</div>
                    {starter && (
                      <div className="pt-1.5 border-t border-white/5">
                        <div className="text-[8px] text-text-muted uppercase tracking-wider">{t("starterGuardianHint")}</div>
                        <div className="text-[10px] font-bold text-text leading-tight mt-0.5">{starter.name}</div>
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          <label className="flex items-start gap-2 cursor-pointer pt-1">
            <input type="checkbox" checked={newsletter} onChange={(e) => setNewsletter(e.target.checked)}
              className="mt-0.5 w-3.5 h-3.5 rounded border-border accent-primary" />
            <span className="text-[11px] text-text-muted leading-relaxed">
              {t.rich("newsletterLabel", { b: (c) => <b className="text-text">{c}</b> })}
            </span>
          </label>

          <label className="flex items-start gap-2 cursor-pointer">
            <input type="checkbox" checked={acceptTerms} onChange={(e) => setAcceptTerms(e.target.checked)}
              className="mt-0.5 w-3.5 h-3.5 rounded border-border accent-primary" />
            <span className="text-[11px] text-text-muted leading-relaxed">
              {t.rich("termsAccept", {
                a: (c) => <Link href="/agb" className="text-primary hover:underline">{c}</Link>,
                p: (c) => <Link href="/datenschutz" className="text-primary hover:underline">{c}</Link>,
              })}
            </span>
          </label>

          {error && <p className="text-xs text-danger text-center">{error}</p>}

          <button type="submit" disabled={loading || !guardianFaction || !acceptTerms || username.length < 3}
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg bg-primary text-bg-deep font-bold hover:bg-primary-dim disabled:opacity-50 disabled:cursor-not-allowed transition-colors">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : (
              <>
                {selectedStarter ? t("submitWith", { guardianName: selectedStarter.name }) : t("submit")}
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>
      </div>
    </main>
  );
}
