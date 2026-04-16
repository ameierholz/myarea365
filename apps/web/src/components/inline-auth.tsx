"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Loader2, ArrowRight } from "lucide-react";

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
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleGoogle() {
    const supabase = createClient();
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSuccess("");
    setLoading(true);

    const supabase = createClient();

    if (mode === "login") {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (error) {
        setError(
          error.message === "Invalid login credentials"
            ? "E-Mail oder Passwort falsch."
            : error.message
        );
        setLoading(false);
        return;
      }
      router.push("/dashboard");
      router.refresh();
      return;
    }

    // Register
    if (username.length < 3) {
      setError("Runner-Name: mindestens 3 Zeichen.");
      setLoading(false);
      return;
    }

    const { data: existing } = await supabase
      .from("users")
      .select("id")
      .eq("username", username.toLowerCase())
      .single();

    if (existing) {
      setError("Dieser Runner-Name ist bereits vergeben.");
      setLoading(false);
      return;
    }

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

    if (data.user) {
      await supabase.from("users").insert({
        id: data.user.id,
        username: username.toLowerCase(),
        display_name: username,
      });
    }

    setSuccess("Bestätigungsmail gesendet! Prüfe dein Postfach.");
    setLoading(false);
  }

  return (
    <div className="w-full max-w-sm mx-auto">
      {/* Google Button */}
      <button
        onClick={handleGoogle}
        className="w-full flex items-center justify-center gap-3 py-2.5 rounded-lg bg-white text-gray-800 font-semibold text-sm hover:bg-gray-100 transition-colors mb-3"
      >
        <GoogleIcon className="w-4 h-4" />
        Mit Google {mode === "register" ? "registrieren" : "anmelden"}
      </button>

      {/* Divider */}
      <div className="flex items-center gap-3 mb-3">
        <div className="flex-1 h-px bg-border" />
        <span className="text-xs text-text-muted">oder per E-Mail</span>
        <div className="flex-1 h-px bg-border" />
      </div>

      <form onSubmit={handleSubmit} className="space-y-2.5">
        {mode === "register" && (
          <input
            type="text"
            required
            minLength={3}
            maxLength={24}
            value={username}
            onChange={(e) =>
              setUsername(e.target.value.replace(/[^a-zA-Z0-9_-]/g, ""))
            }
            placeholder="Runner-Name wählen"
            className="w-full px-4 py-2.5 rounded-lg bg-bg-elevated/80 border border-border text-text placeholder:text-text-muted/50 focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/20 transition-colors backdrop-blur-sm text-sm"
          />
        )}

        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="E-Mail"
          className="w-full px-4 py-2.5 rounded-lg bg-bg-elevated/80 border border-border text-text placeholder:text-text-muted/50 focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/20 transition-colors backdrop-blur-sm text-sm"
        />
        <input
          type="password"
          required
          minLength={6}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Passwort (min. 6 Zeichen)"
          className="w-full px-4 py-2.5 rounded-lg bg-bg-elevated/80 border border-border text-text placeholder:text-text-muted/50 focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/20 transition-colors backdrop-blur-sm text-sm"
        />

        {error && (
          <p className="text-xs text-danger text-center">{error}</p>
        )}
        {success && (
          <p className="text-xs text-primary text-center">{success}</p>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg bg-primary text-bg-deep font-bold hover:bg-primary-dim disabled:opacity-50 transition-colors"
        >
          {loading ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <>
              {mode === "register" ? "Kostenlos starten" : "Anmelden"}
              <ArrowRight className="w-4 h-4" />
            </>
          )}
        </button>
      </form>

      <p className="text-center text-xs text-text-muted mt-2.5">
        {mode === "register" ? (
          <>
            Schon dabei?{" "}
            <button
              onClick={() => { setMode("login"); setError(""); setSuccess(""); }}
              className="text-primary hover:text-primary-dim font-medium transition-colors"
            >
              Anmelden
            </button>
          </>
        ) : (
          <>
            Neu hier?{" "}
            <button
              onClick={() => { setMode("register"); setError(""); setSuccess(""); }}
              className="text-primary hover:text-primary-dim font-medium transition-colors"
            >
              Kostenlos registrieren
            </button>
          </>
        )}
      </p>
    </div>
  );
}
