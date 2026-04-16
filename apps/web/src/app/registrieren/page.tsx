"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Mail, Lock, User, Loader2, AlertCircle, CheckCircle2 } from "lucide-react";

export default function RegisterPage() {
  const router = useRouter();

  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    if (username.length < 3) {
      setError("Username muss mindestens 3 Zeichen haben.");
      setLoading(false);
      return;
    }

    if (password.length < 6) {
      setError("Passwort muss mindestens 6 Zeichen haben.");
      setLoading(false);
      return;
    }

    const supabase = createClient();

    // Check username availability
    const { data: existing } = await supabase
      .from("users")
      .select("id")
      .eq("username", username.toLowerCase())
      .single();

    if (existing) {
      setError("Dieser Username ist bereits vergeben.");
      setLoading(false);
      return;
    }

    // Sign up
    const { data, error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { username: username.toLowerCase(), display_name: username },
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    });

    if (signUpError) {
      setError(signUpError.message);
      setLoading(false);
      return;
    }

    // Create user profile
    if (data.user) {
      await supabase.from("users").insert({
        id: data.user.id,
        username: username.toLowerCase(),
        display_name: username,
      });
    }

    setSuccess(true);
    setLoading(false);
  }

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="w-full max-w-md text-center">
          <Link href="/" className="block mb-10">
            <span className="text-3xl font-bold tracking-tight">
              My<span className="text-primary">Area</span>365
            </span>
          </Link>

          <div className="p-8 rounded-2xl bg-bg-card border border-border">
            <CheckCircle2 className="w-16 h-16 text-primary mx-auto mb-4" />
            <h1 className="text-2xl font-bold mb-2">Fast geschafft!</h1>
            <p className="text-text-muted mb-6">
              Wir haben dir eine Bestätigungsmail an <strong className="text-text">{email}</strong> geschickt.
              Klicke auf den Link, um deinen Account zu aktivieren.
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
    <div className="min-h-screen flex items-center justify-center px-4">
      {/* Glow */}
      <div className="fixed top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] rounded-full bg-accent/5 blur-[100px] pointer-events-none" />

      <div className="relative w-full max-w-md">
        {/* Logo */}
        <Link href="/" className="block text-center mb-10">
          <span className="text-3xl font-bold tracking-tight">
            My<span className="text-primary">Area</span>365
          </span>
        </Link>

        {/* Card */}
        <div className="p-8 rounded-2xl bg-bg-card border border-border">
          <h1 className="text-2xl font-bold mb-2">Account erstellen</h1>
          <p className="text-sm text-text-muted mb-8">
            Wähle deinen Runner-Namen und leg los.
          </p>

          {error && (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-danger/10 border border-danger/20 text-danger text-sm mb-6">
              <AlertCircle className="w-4 h-4 shrink-0" />
              {error}
            </div>
          )}

          <form onSubmit={handleRegister} className="space-y-4">
            <div>
              <label htmlFor="username" className="block text-sm font-medium mb-1.5">
                Runner-Name
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
                  placeholder="dein_username"
                  className="w-full pl-10 pr-4 py-2.5 rounded-lg bg-bg-elevated border border-border text-text placeholder:text-text-muted/50 focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/20 transition-colors"
                />
              </div>
              <p className="text-xs text-text-muted mt-1">
                3–24 Zeichen, Buchstaben, Zahlen, _ und -
              </p>
            </div>

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
                  placeholder="deine@email.de"
                  className="w-full pl-10 pr-4 py-2.5 rounded-lg bg-bg-elevated border border-border text-text placeholder:text-text-muted/50 focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/20 transition-colors"
                />
              </div>
            </div>

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
                  minLength={6}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Mindestens 6 Zeichen"
                  className="w-full pl-10 pr-4 py-2.5 rounded-lg bg-bg-elevated border border-border text-text placeholder:text-text-muted/50 focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/20 transition-colors"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg bg-primary text-bg-deep font-semibold hover:bg-primary-dim disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {loading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                "Account erstellen"
              )}
            </button>
          </form>

          <p className="text-xs text-text-muted mt-4 text-center">
            Mit der Registrierung akzeptierst du unsere{" "}
            <Link href="/datenschutz" className="text-primary hover:underline">
              Datenschutzerklärung
            </Link>
            .
          </p>
        </div>

        {/* Login link */}
        <p className="text-center text-sm text-text-muted mt-6">
          Schon einen Account?{" "}
          <Link
            href="/login"
            className="text-primary hover:text-primary-dim font-medium transition-colors"
          >
            Anmelden
          </Link>
        </p>
      </div>
    </div>
  );
}
