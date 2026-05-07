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

  // Soft-Block: Wenn PLZ keinem aktiven Server zugeordnet ist, zeigen wir ein
  // Modal mit Vorschlag der nächsten Stadt + Warteliste-Eintrag.
  type Suggestion = { slug: string; name: string; distance_km: number | null };
  const [waitlistSuggestion, setWaitlistSuggestion] = useState<Suggestion | null>(null);

  async function validateForm(): Promise<boolean> {
    setError("");
    if (username.length < 3) { setError(t("runnerNameMin")); return false; }
    if (password.length < 8) { setError(t("passwordMin")); return false; }
    if (!faction) { setError(t("factionRequired")); return false; }
    if (!acceptTerms) { setError(t("termsRequired")); return false; }
    if (!heimatPlz) { setError(t("plzRequired")); return false; }
    if (!/^[0-9]{5}$/.test(heimatPlz)) { setError(t("plzInvalid")); return false; }
    return true;
  }

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault();
    if (!(await validateForm())) return;

    setLoading(true);

    // 1) Vorab PLZ-Check — gibt es einen aktiven Server für diese PLZ?
    try {
      const r = await fetch(`/api/plz/check?plz=${encodeURIComponent(heimatPlz)}`, { cache: "no-store" });
      const j = await r.json() as {
        has_city: boolean;
        city: { slug: string; name: string } | null;
        suggestion: { slug: string; name: string; distance_km: number | null } | null;
      };
      if (!j.has_city) {
        // Kein direkter Match → Modal mit Vorschlag öffnen, Submission pausieren
        setWaitlistSuggestion(j.suggestion ?? { slug: "", name: "—", distance_km: null });
        setLoading(false);
        return;
      }
    } catch {
      // Bei API-Fehler trotzdem weitermachen (Best-Effort) — Trigger erledigt ggf. den Rest
    }

    await doRegister(null);
  }

  async function doRegister(fallbackCity: string | null) {
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
      // Wenn User auf Fallback-Stadt akzeptiert hat: home_city_slug explizit
      // überschreiben (Trigger setzt sonst NULL weil PLZ keinen Match hat).
      if (fallbackCity) {
        await supabase.from("users").update({ home_city_slug: fallbackCity }).eq("id", data.user.id);
        // Warteliste-Eintrag (auf Server-Side mit user_id)
        try {
          await fetch("/api/plz/waitlist", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              plz: heimatPlz,
              fallback_city_slug: fallbackCity,
              source: "register",
            }),
          });
        } catch { /* silent — Warteliste ist nice-to-have */ }
      }
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
                  {t("plzLabel")} <span className="text-primary font-normal">{t("plzOptional")}</span>
                </label>
                <div className="relative">
                  <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
                  <input
                    id="plz" type="text" inputMode="numeric" pattern="[0-9]{5}" maxLength={5} required
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

      {waitlistSuggestion && (
        <WaitlistModal
          plz={heimatPlz}
          suggestion={waitlistSuggestion}
          onAccept={async () => {
            const slug = waitlistSuggestion.slug;
            setWaitlistSuggestion(null);
            await doRegister(slug || null);
          }}
          onDismiss={() => setWaitlistSuggestion(null)}
          loading={loading}
          t={t}
        />
      )}
    </div>
  );
}

function WaitlistModal({
  plz, suggestion, onAccept, onDismiss, loading, t,
}: {
  plz: string;
  suggestion: { slug: string; name: string; distance_km: number | null };
  onAccept: () => void;
  onDismiss: () => void;
  loading: boolean;
  t: (key: string, vars?: Record<string, string | number>) => string;
}) {
  const km = suggestion.distance_km != null ? Math.round(suggestion.distance_km).toString() : "—";
  const hasCity = suggestion.slug !== "";
  return (
    <div
      onClick={onDismiss}
      style={{
        position: "fixed", inset: 0, zIndex: 9500,
        background: "rgba(0,0,0,0.72)",
        backdropFilter: "blur(6px)",
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: 16,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "min(440px, 100%)",
          background: "linear-gradient(160deg, #1A1D23 0%, #0F1115 100%)",
          border: "1px solid rgba(34,209,195,0.35)",
          borderRadius: 18,
          boxShadow: "0 0 40px rgba(34,209,195,0.18), 0 24px 64px rgba(0,0,0,0.7)",
          padding: 22,
          display: "flex", flexDirection: "column", gap: 14,
        }}
      >
        <div style={{ fontSize: 20, fontWeight: 900, color: "#22D1C3", letterSpacing: 0.4 }}>
          🛰  {t("waitlistTitle")}
        </div>
        <div style={{ fontSize: 13, color: "#C8CDD9", lineHeight: 1.5 }}>
          {t("waitlistBodyTop", { plz })}
        </div>
        <div style={{
          padding: "10px 12px", borderRadius: 10,
          background: "rgba(34,209,195,0.08)",
          border: "1px solid rgba(34,209,195,0.25)",
          fontSize: 12, color: "#A8E5DD", lineHeight: 1.45,
        }}>
          {t("waitlistAutoFeedback")}
        </div>
        {hasCity && (
          <div style={{ fontSize: 13, color: "#C8CDD9", lineHeight: 1.5 }}>
            {t("waitlistSuggestion", { city: suggestion.name, km })}
          </div>
        )}
        <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
          <button
            type="button"
            onClick={onDismiss}
            disabled={loading}
            style={{
              flex: 1, padding: "10px 12px", borderRadius: 10,
              background: "rgba(255,255,255,0.04)",
              border: "1px solid rgba(255,255,255,0.12)",
              color: "#C8CDD9", fontSize: 12, fontWeight: 700, cursor: "pointer",
            }}
          >
            {t("waitlistDismiss")}
          </button>
          {hasCity && (
            <button
              type="button"
              onClick={onAccept}
              disabled={loading}
              style={{
                flex: 1.4, padding: "10px 12px", borderRadius: 10,
                background: "linear-gradient(135deg, #22D1C3, #1AA89D)",
                border: "none",
                color: "#0F1115", fontSize: 13, fontWeight: 900, cursor: "pointer",
                boxShadow: "0 6px 18px rgba(34,209,195,0.35)",
              }}
            >
              {t("waitlistAccept", { city: suggestion.name })}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
