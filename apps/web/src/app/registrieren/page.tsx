"use client";

import { useState, useMemo } from "react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Mail, Lock, User, Loader2, AlertCircle, Users as UsersIcon, MapPin } from "lucide-react";
import { HeroMap } from "@/components/hero-map-client";
import { openLegalModal } from "@/components/legal-modal";

export default function RegisterPage() {
  const t = useTranslations("Register");
  const router = useRouter();

  const FACTIONS = useMemo(() => [
    {
      id: "kronenwacht" as const,
      name: t("factionKronenwacht"),
      icon: "👑",
      color: "#FFD700",
      motto: t("factionKronenwachtMotto"),
      buff_name: t("factionKronenwachtBuff"),
      buff_lines: [t("factionKronenwachtBuff1"), t("factionKronenwachtBuff2")],
    },
    {
      id: "gossenbund" as const,
      name: t("factionGossenbund"),
      icon: "🗝️",
      color: "#22D1C3",
      motto: t("factionGossenbundMotto"),
      buff_name: t("factionGossenbundBuff"),
      buff_lines: [t("factionGossenbundBuff1"), t("factionGossenbundBuff2")],
    },
  ], [t]);

  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [heimatPlz, setHeimatPlz] = useState("");
  const [faction, setFaction] = useState<"kronenwacht" | "gossenbund" | null>(null);
  const [newsletter, setNewsletter] = useState(false);
  const [inviteCode, setInviteCode] = useState("");
  const [acceptTerms, setAcceptTerms] = useState(false);

  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (username.length < 3) return setError(t("runnerNameMin"));
    if (password.length < 8) return setError(t("passwordMin"));
    if (!faction) return setError(t("factionRequired"));
    if (!acceptTerms) return setError(t("termsRequired"));
    if (heimatPlz && !/^[0-9]{5}$/.test(heimatPlz)) {
      return setError(t("plzInvalid"));
    }

    setLoading(true);
    const supabase = createClient();

    const { data: existing } = await supabase
      .from("users").select("id").eq("username", username.toLowerCase()).maybeSingle();
    if (existing) {
      setError(t("usernameTaken"));
      setLoading(false);
      return;
    }

    const { data, error: signUpError } = await supabase.auth.signUp({
      email, password,
      options: {
        data: {
          username: username.toLowerCase(),
          display_name: username,
          faction,
          heimat_plz: heimatPlz || null,
          newsletter_opt_in: newsletter,
          invite_code: inviteCode.trim() || null,
        },
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    });

    if (signUpError) {
      setError(signUpError.message);
      setLoading(false);
      return;
    }

    if (data.user) {
      await supabase.from("users").insert({
        id: data.user.id,
        username: username.toLowerCase(),
        display_name: username,
        faction,
        heimat_plz: heimatPlz || null,
        newsletter_opt_in: newsletter,
      });
    }

    router.push(`/registrierung-bestaetigen?email=${encodeURIComponent(email)}`);
    setLoading(false);
  }

  return (
    <div className="relative min-h-screen overflow-hidden">
      <div className="absolute inset-0 -z-10">
        <HeroMap />
      </div>

      <div className="relative min-h-screen flex items-start justify-center px-4 py-10">
        <div className="w-full max-w-md">
          <Link href="/" className="block text-center mb-6">
            <span className="text-3xl font-bold tracking-tight drop-shadow-[0_2px_10px_rgba(0,0,0,0.6)]">
              My<span className="text-primary">Area</span>365
            </span>
          </Link>

          <div className="p-6 sm:p-8 rounded-2xl bg-bg-card/90 border border-border backdrop-blur-md shadow-2xl">
            <h1 className="text-2xl font-bold mb-1">{t("title")}</h1>
            <p className="text-sm text-text-muted mb-6">{t("subtitle")}</p>

            {error && (
              <div className="flex items-center gap-2 p-3 rounded-lg bg-danger/10 border border-danger/20 text-danger text-sm mb-5">
                <AlertCircle className="w-4 h-4 shrink-0" />
                {error}
              </div>
            )}

            <form onSubmit={handleRegister} className="space-y-4">
              <div>
                <label htmlFor="username" className="block text-sm font-medium mb-1.5">
                  {t("runnerNameLabel")} <span className="text-text-muted font-normal">{t("runnerNameHint")}</span>
                </label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
                  <input
                    id="username" type="text" required minLength={3} maxLength={24}
                    value={username}
                    onChange={(e) => setUsername(e.target.value.replace(/[^a-zA-Z0-9_-]/g, ""))}
                    placeholder={t("runnerNamePlaceholder")}
                    className="w-full pl-10 pr-4 py-2.5 rounded-lg bg-bg-elevated border border-border text-text placeholder:text-text-muted/50 focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/20 transition-colors"
                  />
                </div>
                <p className="text-xs text-text-muted mt-1">{t("runnerNameRule")}</p>
              </div>

              <div>
                <label htmlFor="email" className="block text-sm font-medium mb-1.5">{t("emailLabel")}</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
                  <input
                    id="email" type="email" required value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder={t("emailPlaceholder")}
                    className="w-full pl-10 pr-4 py-2.5 rounded-lg bg-bg-elevated border border-border text-text placeholder:text-text-muted/50 focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/20 transition-colors"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="password" className="block text-sm font-medium mb-1.5">{t("passwordLabel")}</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
                  <input
                    id="password" type="password" required minLength={8} value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder={t("passwordPlaceholder")}
                    className="w-full pl-10 pr-4 py-2.5 rounded-lg bg-bg-elevated border border-border text-text placeholder:text-text-muted/50 focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/20 transition-colors"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="plz" className="block text-sm font-medium mb-1.5">
                  {t("plzLabel")} <span className="text-text-muted font-normal">{t("plzOptional")}</span>
                </label>
                <div className="relative">
                  <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
                  <input
                    id="plz" type="text" inputMode="numeric" pattern="[0-9]{5}" maxLength={5}
                    value={heimatPlz}
                    onChange={(e) => setHeimatPlz(e.target.value.replace(/\D/g, "").slice(0, 5))}
                    placeholder={t("plzPlaceholder")}
                    className="w-full pl-10 pr-4 py-2.5 rounded-lg bg-bg-elevated border border-border text-text placeholder:text-text-muted/50 focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/20 transition-colors"
                  />
                </div>
                <p className="text-xs text-text-muted mt-1">{t("plzHint")}</p>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">
                  {t("factionLabel")} <span className="text-text-muted font-normal">{t("factionSwitchHint")}</span>
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {FACTIONS.map((f) => {
                    const active = faction === f.id;
                    return (
                      <button
                        key={f.id} type="button" onClick={() => setFaction(f.id)}
                        className={`p-3 rounded-lg border text-left transition-all ${active ? "border-transparent" : "border-border hover:border-primary/30"}`}
                        style={{
                          background: active ? `${f.color}22` : undefined,
                          borderColor: active ? f.color : undefined,
                          boxShadow: active ? `0 0 16px ${f.color}44` : undefined,
                        }}
                      >
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-xl">{f.icon}</span>
                          <span className="font-bold" style={{ color: active ? f.color : undefined }}>{f.name}</span>
                        </div>
                        <div className="text-[11px] text-text-muted leading-tight mb-2">{f.motto}</div>
                        <div className="text-[11px] font-bold mb-1" style={{ color: f.color }}>⚡ {f.buff_name}</div>
                        <ul className="text-[10px] text-text-muted leading-snug space-y-0.5 list-none">
                          {f.buff_lines.map((line) => (
                            <li key={line} className="flex items-start gap-1">
                              <span style={{ color: f.color }}>+</span>
                              <span>{line}</span>
                            </li>
                          ))}
                        </ul>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <label htmlFor="invite" className="block text-sm font-medium mb-1.5">
                  {t("inviteLabel")} <span className="text-text-muted font-normal">{t("plzOptional")}</span>
                </label>
                <div className="relative">
                  <UsersIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
                  <input
                    id="invite" type="text" maxLength={20} value={inviteCode}
                    onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
                    placeholder={t("invitePlaceholder")}
                    className="w-full pl-10 pr-4 py-2.5 rounded-lg bg-bg-elevated border border-border text-text placeholder:text-text-muted/50 focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/20 transition-colors font-mono uppercase"
                  />
                </div>
              </div>

              <label className="flex items-start gap-2.5 cursor-pointer p-3 rounded-lg bg-bg-elevated border border-border hover:border-primary/30 transition-colors">
                <input
                  type="checkbox" checked={newsletter}
                  onChange={(e) => setNewsletter(e.target.checked)}
                  className="mt-0.5 w-4 h-4 rounded border-border accent-primary"
                />
                <div className="text-sm">
                  <div className="font-medium">{t("newsletterTitle")}</div>
                  <div className="text-xs text-text-muted mt-0.5">{t("newsletterDesc")}</div>
                </div>
              </label>

              <label className="flex items-start gap-2.5 cursor-pointer">
                <input
                  type="checkbox" checked={acceptTerms}
                  onChange={(e) => setAcceptTerms(e.target.checked)}
                  className="mt-0.5 w-4 h-4 rounded border-border accent-primary"
                />
                <div className="text-xs text-text-muted leading-relaxed">
                  {t.rich("termsAccept", {
                    p: (c) => <button type="button" onClick={() => openLegalModal("datenschutz")} className="text-primary hover:underline">{c}</button>,
                    a: (c) => <button type="button" onClick={() => openLegalModal("agb")} className="text-primary hover:underline">{c}</button>,
                  })}
                </div>
              </label>

              <button
                type="submit"
                disabled={loading || !acceptTerms || !faction}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-lg bg-primary text-bg-deep font-bold hover:bg-primary-dim disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : t("createAccount")}
              </button>
            </form>
          </div>

          <p className="text-center text-sm text-text-muted mt-6 drop-shadow">
            {t("alreadyMember")}{" "}
            <Link href="/login" className="text-primary hover:text-primary-dim font-medium transition-colors">{t("signIn")}</Link>
          </p>

          <div className="flex flex-wrap justify-center gap-3 mt-5 text-[11px] text-text-muted">
            <button onClick={() => openLegalModal("impressum")} className="hover:text-text transition-colors">{t("footerImprint")}</button>
            <span className="opacity-40">·</span>
            <button onClick={() => openLegalModal("datenschutz")} className="hover:text-text transition-colors">{t("footerPrivacy")}</button>
            <span className="opacity-40">·</span>
            <button onClick={() => openLegalModal("agb")} className="hover:text-text transition-colors">{t("footerTerms")}</button>
            <span className="opacity-40">·</span>
            <Link href="/support" className="hover:text-text transition-colors">{t("footerSupport")}</Link>
          </div>
        </div>
      </div>
    </div>
  );
}
