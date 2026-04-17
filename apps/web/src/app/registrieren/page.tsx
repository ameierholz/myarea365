"use client";

import { useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Mail, Lock, User, Loader2, AlertCircle, CheckCircle2, Users as UsersIcon } from "lucide-react";

const FACTIONS = [
  { id: "syndicate", name: "Nachtpuls",    icon: "🌙", color: "#22D1C3", motto: "Strategie · Rhythmus · Stille Siege" },
  { id: "vanguard",  name: "Sonnenwacht",  icon: "☀️", color: "#FF6B4A", motto: "Mut · Tempo · Offene Wege" },
] as const;

export default function RegisterPage() {
  const [username, setUsername] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [faction, setFaction] = useState<"syndicate" | "vanguard" | null>(null);
  const [newsletter, setNewsletter] = useState(false); // DSGVO: Opt-in, nicht vorausgewählt
  const [inviteCode, setInviteCode] = useState("");
  const [acceptTerms, setAcceptTerms] = useState(false);

  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (username.length < 3) return setError("Runner-Name muss mindestens 3 Zeichen haben.");
    if (password.length < 8) return setError("Passwort muss mindestens 8 Zeichen haben.");
    if (!faction) return setError("Bitte wähle eine Fraktion.");
    if (!acceptTerms) return setError("Bitte akzeptiere die Nutzungsbedingungen und Datenschutz.");

    setLoading(true);
    const supabase = createClient();

    const { data: existing } = await supabase
      .from("users")
      .select("id")
      .eq("username", username.toLowerCase())
      .maybeSingle();

    if (existing) {
      setError("Dieser Runner-Name ist bereits vergeben.");
      setLoading(false);
      return;
    }

    const { data, error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          username: username.toLowerCase(),
          display_name: displayName || username,
          faction,
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
        display_name: displayName || username,
        faction,
        newsletter_opt_in: newsletter,
      });
    }

    setSuccess(true);
    setLoading(false);
  }

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4 py-10">
        <div className="w-full max-w-md text-center">
          <Link href="/" className="block mb-10">
            <span className="text-3xl font-bold tracking-tight">
              My<span className="text-primary">Area</span>365
            </span>
          </Link>

          <div className="p-8 rounded-2xl bg-bg-card border border-border">
            <CheckCircle2 className="w-16 h-16 text-primary mx-auto mb-4" />
            <h1 className="text-2xl font-bold mb-2">Fast geschafft!</h1>
            <p className="text-text-muted mb-4 leading-relaxed">
              Wir haben dir eine Bestätigungsmail an <strong className="text-text">{email}</strong> geschickt.
            </p>
            <p className="text-text-muted text-sm mb-6 leading-relaxed">
              Klicke auf den Link in der Mail um deinen Account zu aktivieren.
              Falls du nichts findest — schau im Spam-Ordner.
            </p>
            <Link
              href="/login"
              className="inline-flex items-center justify-center px-6 py-2.5 rounded-lg bg-primary text-bg-deep font-semibold hover:bg-primary-dim transition-colors"
            >
              Zum Login
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-start justify-center px-4 py-10">
      <div className="fixed top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] rounded-full bg-accent/5 blur-[100px] pointer-events-none" />

      <div className="relative w-full max-w-md">
        <Link href="/" className="block text-center mb-8">
          <span className="text-3xl font-bold tracking-tight">
            My<span className="text-primary">Area</span>365
          </span>
        </Link>

        <div className="p-8 rounded-2xl bg-bg-card border border-border">
          <h1 className="text-2xl font-bold mb-1">Werde Runner</h1>
          <p className="text-sm text-text-muted mb-6">
            Erobere deine Stadt — gemeinsam. In 30 Sekunden bist du dabei.
          </p>

          {error && (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-danger/10 border border-danger/20 text-danger text-sm mb-5">
              <AlertCircle className="w-4 h-4 shrink-0" />
              {error}
            </div>
          )}

          <form onSubmit={handleRegister} className="space-y-4">
            {/* Runner-Name */}
            <div>
              <label htmlFor="username" className="block text-sm font-medium mb-1.5">
                Runner-Name <span className="text-text-muted font-normal">(öffentlich)</span>
              </label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
                <input
                  id="username"
                  type="text"
                  required
                  minLength={3}
                  maxLength={24}
                  value={username}
                  onChange={(e) => setUsername(e.target.value.replace(/[^a-zA-Z0-9_-]/g, ""))}
                  placeholder="neon_fuchs"
                  className="w-full pl-10 pr-4 py-2.5 rounded-lg bg-bg-elevated border border-border text-text placeholder:text-text-muted/50 focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/20 transition-colors"
                />
              </div>
              <p className="text-xs text-text-muted mt-1">3–24 Zeichen, a–z, 0–9, _ und -</p>
            </div>

            {/* Display Name */}
            <div>
              <label htmlFor="displayName" className="block text-sm font-medium mb-1.5">
                Anzeigename <span className="text-text-muted font-normal">(optional)</span>
              </label>
              <input
                id="displayName"
                type="text"
                maxLength={40}
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="z.B. Lena K."
                className="w-full px-4 py-2.5 rounded-lg bg-bg-elevated border border-border text-text placeholder:text-text-muted/50 focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/20 transition-colors"
              />
            </div>

            {/* E-Mail */}
            <div>
              <label htmlFor="email" className="block text-sm font-medium mb-1.5">
                E-Mail
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
                <input
                  id="email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="deine@mail.de"
                  className="w-full pl-10 pr-4 py-2.5 rounded-lg bg-bg-elevated border border-border text-text placeholder:text-text-muted/50 focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/20 transition-colors"
                />
              </div>
            </div>

            {/* Passwort */}
            <div>
              <label htmlFor="password" className="block text-sm font-medium mb-1.5">
                Passwort
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
                <input
                  id="password"
                  type="password"
                  required
                  minLength={8}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Mindestens 8 Zeichen"
                  className="w-full pl-10 pr-4 py-2.5 rounded-lg bg-bg-elevated border border-border text-text placeholder:text-text-muted/50 focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/20 transition-colors"
                />
              </div>
            </div>

            {/* Fraktion */}
            <div>
              <label className="block text-sm font-medium mb-2">
                Fraktion wählen <span className="text-text-muted font-normal">(später nicht mehr änderbar)</span>
              </label>
              <div className="grid grid-cols-2 gap-2">
                {FACTIONS.map((f) => {
                  const active = faction === f.id;
                  return (
                    <button
                      key={f.id}
                      type="button"
                      onClick={() => setFaction(f.id)}
                      className={`p-3 rounded-lg border text-left transition-all ${
                        active
                          ? "border-transparent"
                          : "border-border hover:border-primary/30"
                      }`}
                      style={{
                        background: active ? `${f.color}22` : undefined,
                        borderColor: active ? f.color : undefined,
                        boxShadow: active ? `0 0 16px ${f.color}44` : undefined,
                      }}
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xl">{f.icon}</span>
                        <span className="font-bold" style={{ color: active ? f.color : undefined }}>
                          {f.name}
                        </span>
                      </div>
                      <div className="text-[11px] text-text-muted leading-tight">{f.motto}</div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Invite-Code */}
            <div>
              <label htmlFor="invite" className="block text-sm font-medium mb-1.5">
                Crew-Einladungscode <span className="text-text-muted font-normal">(optional)</span>
              </label>
              <div className="relative">
                <UsersIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
                <input
                  id="invite"
                  type="text"
                  maxLength={20}
                  value={inviteCode}
                  onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
                  placeholder="z.B. KIEZ-42AB"
                  className="w-full pl-10 pr-4 py-2.5 rounded-lg bg-bg-elevated border border-border text-text placeholder:text-text-muted/50 focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/20 transition-colors font-mono uppercase"
                />
              </div>
              <p className="text-xs text-text-muted mt-1">Hast du einen von Freunden bekommen? Einfügen und direkt mit der Crew starten.</p>
            </div>

            {/* Newsletter */}
            <label className="flex items-start gap-2.5 cursor-pointer p-3 rounded-lg bg-bg-elevated border border-border hover:border-primary/30 transition-colors">
              <input
                type="checkbox"
                checked={newsletter}
                onChange={(e) => setNewsletter(e.target.checked)}
                className="mt-0.5 w-4 h-4 rounded border-border accent-primary"
              />
              <div className="text-sm">
                <div className="font-medium">📬 Kiez-Newsletter (max. 1× / Monat)</div>
                <div className="text-xs text-text-muted mt-0.5">
                  Neue Deals in deiner Nähe, Events, Feature-Updates. Jederzeit abbestellbar.
                </div>
              </div>
            </label>

            {/* Terms */}
            <label className="flex items-start gap-2.5 cursor-pointer">
              <input
                type="checkbox"
                checked={acceptTerms}
                onChange={(e) => setAcceptTerms(e.target.checked)}
                className="mt-0.5 w-4 h-4 rounded border-border accent-primary"
              />
              <div className="text-xs text-text-muted leading-relaxed">
                Ich akzeptiere die{" "}
                <Link href="/datenschutz" className="text-primary hover:underline">Datenschutzerklärung</Link>
                {" "}und{" "}
                <Link href="/impressum" className="text-primary hover:underline">Nutzungsbedingungen</Link>.
              </div>
            </label>

            <button
              type="submit"
              disabled={loading || !acceptTerms || !faction}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-lg bg-primary text-bg-deep font-bold hover:bg-primary-dim disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "🚀 Account erstellen"}
            </button>
          </form>
        </div>

        <p className="text-center text-sm text-text-muted mt-6">
          Schon dabei?{" "}
          <Link href="/login" className="text-primary hover:text-primary-dim font-medium transition-colors">
            Anmelden
          </Link>
        </p>
      </div>
    </div>
  );
}
