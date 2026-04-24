"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Loader2, ArrowRight, Info } from "lucide-react";
import { getStoredReferralCode, clearStoredReferralCode } from "@/lib/referral";
import { isCapacitorNative, APP_AUTH_CALLBACK } from "@/lib/capacitor";
import { openLegalModal } from "@/components/legal-modal";

const FACTIONS = [
  {
    id: "kronenwacht",
    name: "Kronenwacht",
    icon: "👑",
    color: "#FFD700",
    motto: "Halten · Pflegen",
    buff_name: "Beständig",
    buff_lines: [
      "Bonus-Wegemünzen für lange gehaltene Straßen",
      "Deine Gebiete verblassen langsamer",
    ],
  },
  {
    id: "gossenbund",
    name: "Gossenbund",
    icon: "🗝️",
    color: "#22D1C3",
    motto: "Erobern · Vorstoßen",
    buff_name: "Raubzug",
    buff_lines: [
      "Bonus-Wegemünzen beim Erobern neuer Straßen",
      "Übermalst gegnerische Straßen schneller",
    ],
  },
] as const;

function GoogleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" />
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
    </svg>
  );
}

export function InlineAuth() {
  const router = useRouter();
  const [mode, setMode] = useState<"register" | "login">("register");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [heimatPlz, setHeimatPlz] = useState("");
  const [faction, setFaction] = useState<"kronenwacht" | "gossenbund" | null>(null);
  const [newsletter, setNewsletter] = useState(false); // DSGVO: Opt-in, nicht vorausgewählt
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [showFactionInfo, setShowFactionInfo] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleGoogle() {
    const supabase = createClient();

    // Capacitor-Android: Google blockt OAuth in WebViews (disallowed_useragent).
    // Wir öffnen den Flow in Chrome Custom Tabs und lassen Supabase via
    // Custom-Scheme zurück zur App redirecten (siehe AndroidManifest).
    if (isCapacitorNative()) {
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo: APP_AUTH_CALLBACK, skipBrowserRedirect: true },
      });
      if (error || !data?.url) {
        setError(error?.message ?? "Google-Login konnte nicht gestartet werden.");
        return;
      }
      const { Browser } = await import("@capacitor/browser");
      await Browser.open({ url: data.url, presentationStyle: "popover" });
      return;
    }

    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSuccess("");

    if (mode === "register") {
      if (!faction) return setError("Bitte wähle eine Fraktion.");
      if (!acceptTerms) return setError("Bitte akzeptiere AGB und Datenschutz.");
      if (heimatPlz && !/^[0-9]{5}$/.test(heimatPlz)) {
        return setError("PLZ muss 5-stellig sein (oder leer lassen).");
      }
    }

    setLoading(true);
    const supabase = createClient();

    if (mode === "login") {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        setError(error.message === "Invalid login credentials" ? "E-Mail oder Passwort falsch." : error.message);
        setLoading(false);
        return;
      }
      router.push("/dashboard");
      router.refresh();
      return;
    }

    if (username.length < 3) { setError("Runner-Name: mindestens 3 Zeichen."); setLoading(false); return; }

    const { data: existing } = await supabase
      .from("users").select("id").eq("username", username.toLowerCase()).maybeSingle();
    if (existing) { setError("Dieser Runner-Name ist vergeben."); setLoading(false); return; }

    const { data, error: signUpError } = await supabase.auth.signUp({
      email, password,
      options: {
        data: {
          username: username.toLowerCase(),
          display_name: username,
          faction,
          newsletter_opt_in: newsletter,
        },
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    });
    if (signUpError) { setError(signUpError.message); setLoading(false); return; }

    if (data.user) {
      const refCode = getStoredReferralCode();
      let referredBy: string | null = null;
      if (refCode) {
        const { data: referrer } = await supabase.from("users").select("id").eq("referral_code", refCode).maybeSingle();
        if (referrer) referredBy = referrer.id;
      }
      await supabase.from("users").insert({
        id: data.user.id,
        username: username.toLowerCase(),
        display_name: username,
        faction,
        heimat_plz: heimatPlz || null,
        newsletter_opt_in: newsletter,
        referred_by: referredBy,
      });
      if (referredBy) {
        await supabase.from("referrals").insert({ referrer_id: referredBy, referred_id: data.user.id });
        clearStoredReferralCode();
      }
    }

    router.push(`/registrierung-bestaetigen?email=${encodeURIComponent(email)}`);
    setLoading(false);
  }

  return (
    <div className="w-full max-w-sm sm:max-w-md mx-auto">
      <button
        onClick={handleGoogle}
        className="w-full flex items-center justify-center gap-3 py-2.5 rounded-lg bg-white text-gray-800 font-semibold text-sm hover:bg-gray-100 transition-colors mb-3"
      >
        <GoogleIcon className="w-4 h-4" />
        Mit Google {mode === "register" ? "registrieren" : "anmelden"}
      </button>

      <div className="flex items-center gap-3 mb-3">
        <div className="flex-1 h-px bg-border" />
        <span className="text-xs text-text-muted">oder per E-Mail</span>
        <div className="flex-1 h-px bg-border" />
      </div>

      <form onSubmit={handleSubmit} className="space-y-2.5">
        {mode === "register" && (
          <input
            type="text" required minLength={3} maxLength={24}
            value={username}
            onChange={(e) => setUsername(e.target.value.replace(/[^a-zA-Z0-9_-]/g, ""))}
            placeholder="Runner-Name wählen"
            className="w-full px-4 py-2.5 rounded-lg bg-bg-elevated/80 border border-border text-text placeholder:text-text-muted/50 focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/20 transition-colors backdrop-blur-sm text-sm"
          />
        )}

        <input
          type="email" required value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="E-Mail"
          className="w-full px-4 py-2.5 rounded-lg bg-bg-elevated/80 border border-border text-text placeholder:text-text-muted/50 focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/20 transition-colors backdrop-blur-sm text-sm"
        />
        <input
          type="password" required minLength={mode === "register" ? 8 : 6} value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder={mode === "register" ? "Passwort (min. 8 Zeichen)" : "Passwort"}
          className="w-full px-4 py-2.5 rounded-lg bg-bg-elevated/80 border border-border text-text placeholder:text-text-muted/50 focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/20 transition-colors backdrop-blur-sm text-sm"
        />

        {mode === "register" && (
          <>
            {/* Fraktion */}
            <div className="relative">
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-semibold text-text-muted">Fraktion wählen</label>
                <button
                  type="button"
                  onClick={() => setShowFactionInfo((v) => !v)}
                  className="inline-flex items-center gap-1 text-xs text-primary hover:text-primary-dim"
                >
                  <Info className="w-3 h-3" />
                  {showFactionInfo ? "Schließen" : "Was ist das?"}
                </button>
              </div>
              {showFactionInfo && (
                <div className="absolute right-0 -top-2 -translate-y-full z-40 w-72 p-3 rounded-lg bg-bg-elevated border border-primary/60 text-[11px] text-text-muted leading-relaxed text-left shadow-2xl">
                  <b className="text-text">2 weltweite Teams</b>, die sich jede Saison duellieren. Deine km zählen für
                  deine Fraktion — weltweit, pro Land, Stadt, PLZ. Trotzdem eigene Crew möglich.
                  <span className="block mt-1 text-danger font-semibold">Nicht änderbar nach Registrierung.</span>
                </div>
              )}
              <div className="grid grid-cols-2 gap-2">
                {FACTIONS.map((f) => {
                  const active = faction === f.id;
                  return (
                    <button
                      key={f.id} type="button" onClick={() => setFaction(f.id)}
                      className={`p-3 rounded-lg border text-left transition-all backdrop-blur-sm ${active ? "border-transparent" : "border-border hover:border-primary/30 bg-bg-elevated/60"}`}
                      style={{
                        background: active ? `${f.color}22` : undefined,
                        borderColor: active ? f.color : undefined,
                        boxShadow: active ? `0 0 12px ${f.color}33` : undefined,
                      }}
                    >
                      <div className="flex items-center gap-1.5 mb-0.5">
                        <span className="text-base">{f.icon}</span>
                        <span className="font-bold text-xs" style={{ color: active ? f.color : undefined }}>{f.name}</span>
                      </div>
                      <div className="text-[10px] text-text-muted mb-2">{f.motto}</div>
                      <div className="text-[10px] font-bold mb-1" style={{ color: f.color }}>⚡ {f.buff_name}</div>
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

            {/* Heimat-PLZ (optional) — für Kiez-Badge & Nachbarschafts-Features */}
            <input
              type="text"
              inputMode="numeric"
              pattern="[0-9]{5}"
              maxLength={5}
              value={heimatPlz}
              onChange={(e) => setHeimatPlz(e.target.value.replace(/\D/g, "").slice(0, 5))}
              placeholder="Heimat-PLZ (optional, z. B. 10827)"
              className="w-full px-4 py-2.5 rounded-lg bg-bg-elevated/80 border border-border text-text placeholder:text-text-muted/50 focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/20 transition-colors backdrop-blur-sm text-sm"
            />

            {/* Newsletter — DSGVO: NICHT vorausgewählt */}
            <label className="flex items-start gap-2 cursor-pointer pt-1">
              <input
                type="checkbox" checked={newsletter}
                onChange={(e) => setNewsletter(e.target.checked)}
                className="mt-0.5 w-3.5 h-3.5 rounded border-border accent-primary"
              />
              <span className="text-[11px] text-text-muted leading-relaxed">
                Ja, ich will den <b className="text-text">Kiez-Newsletter</b> (max. 1× / Monat, jederzeit abbestellbar).
              </span>
            </label>

            {/* AGB & Datenschutz */}
            <label className="flex items-start gap-2 cursor-pointer">
              <input
                type="checkbox" checked={acceptTerms}
                onChange={(e) => setAcceptTerms(e.target.checked)}
                className="mt-0.5 w-3.5 h-3.5 rounded border-border accent-primary"
              />
              <span className="text-[11px] text-text-muted leading-relaxed">
                Ich akzeptiere die{" "}
                <button type="button" onClick={() => openLegalModal("agb")} className="text-primary hover:underline">AGB</button>
                {" und die "}
                <button type="button" onClick={() => openLegalModal("datenschutz")} className="text-primary hover:underline">Datenschutzerklärung</button>.
              </span>
            </label>
          </>
        )}

        {error && <p className="text-xs text-danger text-center">{error}</p>}
        {success && <p className="text-xs text-primary text-center">{success}</p>}

        <button
          type="submit"
          disabled={loading || (mode === "register" && (!faction || !acceptTerms))}
          className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg bg-primary text-bg-deep font-bold hover:bg-primary-dim disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : (
            <>{mode === "register" ? "Kostenlos starten" : "Anmelden"} <ArrowRight className="w-4 h-4" /></>
          )}
        </button>
      </form>

      <p className="text-center text-xs text-text-muted mt-2.5">
        {mode === "register" ? (
          <>Schon dabei? <button onClick={() => { setMode("login"); setError(""); setSuccess(""); }} className="text-primary hover:text-primary-dim font-medium transition-colors">Anmelden</button></>
        ) : (
          <>Neu hier? <button onClick={() => { setMode("register"); setError(""); setSuccess(""); }} className="text-primary hover:text-primary-dim font-medium transition-colors">Kostenlos registrieren</button></>
        )}
      </p>

      {/* Legal-Links — immer sichtbar, öffnen Modal statt Navigation */}
      <div className="flex items-center justify-center gap-3 mt-3 text-[10px] text-text-muted">
        <button type="button" onClick={() => openLegalModal("agb")} className="hover:text-primary transition-colors">AGB</button>
        <span>·</span>
        <button type="button" onClick={() => openLegalModal("datenschutz")} className="hover:text-primary transition-colors">Datenschutz</button>
        <span>·</span>
        <button type="button" onClick={() => openLegalModal("impressum")} className="hover:text-primary transition-colors">Impressum</button>
        <span>·</span>
        <Link href="/support" className="hover:text-primary transition-colors">Support</Link>
      </div>
    </div>
  );
}
