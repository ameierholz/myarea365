"use client";

import { useState, useEffect, useMemo } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { createClient } from "@/lib/supabase/client";
import { Loader2, ArrowRight, ArrowLeft, Info, Check } from "lucide-react";

type Race = {
  id: string; name: string; role: string;
  lore: string | null; material_desc: string | null; energy_color: string | null;
};

export default function OnboardingPage() {
  const t = useTranslations("OnboardingPage");
  const router = useRouter();
  const supabase = createClient();

  const FACTIONS = useMemo(() => [
    { id: "gossenbund",  name: t("factionGossenbund"),  icon: "🗝️", color: "#22D1C3", motto: t("factionGossenbundMotto") },
    { id: "kronenwacht", name: t("factionKronenwacht"), icon: "👑", color: "#FFD700", motto: t("factionKronenwachtMotto") },
  ] as const, [t]);

  const ROLE_META: Record<string, { label: string; emoji: string; color: string; desc: string }> = useMemo(() => ({
    tank:       { label: t("roleTank"),    emoji: "🛡️", color: "#6991d8", desc: t("roleTankDesc") },
    healer:     { label: t("roleHealer"),  emoji: "💚", color: "#1db682", desc: t("roleHealerDesc") },
    melee_dps:  { label: t("roleMelee"),   emoji: "⚔️", color: "#ef7169", desc: t("roleMeleeDesc") },
    ranged_dps: { label: t("roleRanged"),  emoji: "🏹", color: "#a855f7", desc: t("roleRangedDesc") },
  }), [t]);

  const [step, setStep] = useState<1 | 2>(1);
  const [username, setUsername] = useState("");
  const [faction, setFaction] = useState<"gossenbund" | "kronenwacht" | null>(null);
  const [newsletter, setNewsletter] = useState(false);
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [showInfo, setShowInfo] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [email, setEmail] = useState("");

  const [races, setRaces] = useState<Race[]>([]);
  const [pickedRace, setPickedRace] = useState<string | null>(null);
  const [roleFilter, setRoleFilter] = useState<string>("ALL");

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push("/login"); return; }
      setUserId(user.id);
      setEmail(user.email || "");
      const { data: profile } = await supabase
        .from("users").select("username, faction").eq("id", user.id).maybeSingle();
      if (profile?.username && profile?.faction) {
        const { data: guardian } = await supabase
          .from("user_guardians").select("id, race_id").eq("user_id", user.id).eq("is_active", true).maybeSingle();
        if (guardian?.race_id) { router.push("/dashboard"); return; }
        setUsername(profile.username);
        setFaction(profile.faction as "gossenbund" | "kronenwacht");
        setStep(2);
      } else {
        if (profile?.username) setUsername(profile.username);
        else {
          const suggested = (user.user_metadata?.name || user.email?.split("@")[0] || "")
            .replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 24);
          setUsername(suggested);
        }
      }
      const { data: racesData } = await supabase
        .from("races_catalog").select("id, name, role, lore, material_desc, energy_color")
        .order("role").order("name");
      if (racesData) setRaces(racesData as Race[]);
    })();
  }, [supabase, router]);

  async function handleStep1(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!userId) return;
    if (username.length < 3) return setError(t("runnerNameMin"));
    if (!faction) return setError(t("factionRequired"));
    if (!acceptTerms) return setError(t("termsRequired"));

    setLoading(true);
    const { data: existing } = await supabase
      .from("users").select("id").eq("username", username.toLowerCase()).neq("id", userId).maybeSingle();
    if (existing) { setError(t("usernameTaken")); setLoading(false); return; }

    const { error: upsertErr } = await supabase.from("users").upsert({
      id: userId,
      username: username.toLowerCase(),
      display_name: username,
      faction,
      newsletter_opt_in: newsletter,
    });
    if (upsertErr) { setError(upsertErr.message); setLoading(false); return; }
    setLoading(false);
    setStep(2);
  }

  async function handleStep2() {
    if (!pickedRace) return setError(t("guardianRequired"));
    setError("");
    setLoading(true);
    const { data, error: rpcErr } = await supabase.rpc("pick_guardian_race", { p_race_id: pickedRace });
    if (rpcErr || data?.error) {
      setError(rpcErr?.message || data?.error || t("guardianSaveError"));
      setLoading(false);
      return;
    }
    router.push("/dashboard");
    router.refresh();
  }

  const filteredRaces = roleFilter === "ALL"
    ? races
    : races.filter((r) => r.role === roleFilter);

  return (
    <main className="min-h-screen flex items-center justify-center px-4 py-10 bg-bg">
      <div className="w-full max-w-lg">
        <div className="text-center mb-6">
          <Image src="/logo.png" alt="MyArea365" width={64} height={64} className="mx-auto mb-3 rounded-full" />
          <h1 className="text-2xl font-bold">
            {step === 1 ? t("step1Title") : t("step2Title")}
          </h1>
          <p className="text-sm text-text-muted mt-1">
            {step === 1
              ? t.rich("step1Subtitle", { email: () => <span className="text-text">{email}</span> })
              : t("step2Subtitle")}
          </p>
          <div className="flex items-center justify-center gap-2 mt-3">
            {[1, 2].map((n) => (
              <div key={n} style={{
                width: 28, height: 4, borderRadius: 2,
                background: step >= n ? "#22D1C3" : "rgba(255,255,255,0.15)",
                transition: "background 0.2s",
              }} />
            ))}
          </div>
        </div>

        {step === 1 && (
          <form onSubmit={handleStep1} className="space-y-3 p-5 rounded-2xl bg-bg-card border border-border">
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
              <div className="grid grid-cols-2 gap-2">
                {FACTIONS.map((f) => {
                  const active = faction === f.id;
                  return (
                    <button key={f.id} type="button" onClick={() => setFaction(f.id)}
                      className={`p-2.5 rounded-lg border text-left transition-all ${active ? "border-transparent" : "border-border hover:border-primary/30"}`}
                      style={{ background: active ? `${f.color}22` : undefined, borderColor: active ? f.color : undefined, boxShadow: active ? `0 0 12px ${f.color}33` : undefined }}>
                      <div className="flex items-center gap-1.5 mb-0.5">
                        <span className="text-base">{f.icon}</span>
                        <span className="font-bold text-xs" style={{ color: active ? f.color : undefined }}>{f.name}</span>
                      </div>
                      <div className="text-[10px] text-text-muted">{f.motto}</div>
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

            <button type="submit" disabled={loading || !faction || !acceptTerms || username.length < 3}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg bg-primary text-bg-deep font-bold hover:bg-primary-dim disabled:opacity-50 disabled:cursor-not-allowed transition-colors">
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <>{t("next")} <ArrowRight className="w-4 h-4" /></>}
            </button>
          </form>
        )}

        {step === 2 && (
          <div className="space-y-3 p-5 rounded-2xl bg-bg-card border border-border">
            {/* Rollen-Filter */}
            <div className="flex gap-1.5 overflow-x-auto pb-1">
              <button
                onClick={() => setRoleFilter("ALL")}
                className="shrink-0 px-3 py-1.5 rounded-lg text-[11px] font-bold transition"
                style={{
                  background: roleFilter === "ALL" ? "#22D1C3" : "rgba(255,255,255,0.05)",
                  color: roleFilter === "ALL" ? "#0F1115" : "#a8b4cf",
                }}
              >{t("roleAll", { count: races.length })}</button>
              {Object.entries(ROLE_META).map(([id, meta]) => {
                const count = races.filter((r) => r.role === id).length;
                const active = roleFilter === id;
                return (
                  <button key={id} onClick={() => setRoleFilter(id)}
                    className="shrink-0 px-3 py-1.5 rounded-lg text-[11px] font-bold transition inline-flex items-center gap-1"
                    style={{
                      background: active ? meta.color : "rgba(255,255,255,0.05)",
                      color: active ? "#0F1115" : meta.color,
                      border: `1px solid ${active ? meta.color : meta.color + "33"}`,
                    }}
                  >
                    <span>{meta.emoji}</span><span>{meta.label}</span><span className="opacity-60">· {count}</span>
                  </button>
                );
              })}
            </div>

            {/* Rassen-Grid */}
            <div className="grid grid-cols-2 gap-2 max-h-[52vh] overflow-y-auto pr-1">
              {filteredRaces.map((r) => {
                const meta = ROLE_META[r.role];
                const active = pickedRace === r.id;
                return (
                  <button
                    key={r.id}
                    onClick={() => setPickedRace(r.id)}
                    className="text-left p-2.5 rounded-lg transition-all relative"
                    style={{
                      background: active
                        ? `linear-gradient(135deg, ${r.energy_color || meta.color}33, rgba(15,17,21,0.8))`
                        : "rgba(15,17,21,0.5)",
                      border: `1px solid ${active ? (r.energy_color || meta.color) : "rgba(255,255,255,0.08)"}`,
                      boxShadow: active ? `0 0 14px ${r.energy_color || meta.color}66` : undefined,
                    }}
                  >
                    {active && (
                      <div className="absolute top-1.5 right-1.5 w-5 h-5 rounded-full flex items-center justify-center"
                        style={{ background: r.energy_color || meta.color }}>
                        <Check className="w-3 h-3 text-bg-deep" />
                      </div>
                    )}
                    <div className="text-[9px] font-bold uppercase tracking-wider mb-1" style={{ color: meta.color }}>
                      {meta.emoji} {meta.label}
                    </div>
                    <div className="text-sm font-black text-text mb-0.5">{r.name}</div>
                    {r.lore && (
                      <div className="text-[10px] text-text-muted leading-tight">{r.lore}</div>
                    )}
                  </button>
                );
              })}
            </div>

            {error && <p className="text-xs text-danger text-center">{error}</p>}

            <div className="flex gap-2 pt-1">
              <button
                type="button" onClick={() => setStep(1)}
                className="inline-flex items-center gap-1 py-2.5 px-4 rounded-lg bg-bg-elevated border border-border text-text-muted text-sm font-bold hover:text-text"
              >
                <ArrowLeft className="w-4 h-4" />{t("back")}
              </button>
              <button
                onClick={handleStep2} disabled={loading || !pickedRace}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg bg-primary text-bg-deep font-bold hover:bg-primary-dim disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <>{t("deployGuardian")} <ArrowRight className="w-4 h-4" /></>}
              </button>
            </div>

            <div className="text-[10px] text-text-muted text-center pt-1">
              {t("guardianSwitchHint")}
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
