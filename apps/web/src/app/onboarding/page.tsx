"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { createClient } from "@/lib/supabase/client";
import { Loader2, ArrowRight, Info } from "lucide-react";

const FACTIONS = [
  { id: "syndicate", name: "Nachtpuls",   icon: "🌙", color: "#22D1C3", motto: "Strategie · Rhythmus" },
  { id: "vanguard",  name: "Sonnenwacht", icon: "☀️", color: "#FF6B4A", motto: "Mut · Tempo" },
] as const;

export default function OnboardingPage() {
  const router = useRouter();
  const supabase = createClient();
  const [username, setUsername] = useState("");
  const [faction, setFaction] = useState<"syndicate" | "vanguard" | null>(null);
  const [newsletter, setNewsletter] = useState(false);
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [showInfo, setShowInfo] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [email, setEmail] = useState("");

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push("/login"); return; }
      setUserId(user.id);
      setEmail(user.email || "");
      const { data: profile } = await supabase
        .from("users").select("username, faction").eq("id", user.id).maybeSingle();
      if (profile?.username && profile?.faction) { router.push("/dashboard"); return; }
      if (profile?.username) setUsername(profile.username);
      else {
        const suggested = (user.user_metadata?.name || user.email?.split("@")[0] || "")
          .replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 24);
        setUsername(suggested);
      }
    })();
  }, [supabase, router]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!userId) return;
    if (username.length < 3) return setError("Runner-Name: mindestens 3 Zeichen.");
    if (!faction) return setError("Bitte wähle eine Fraktion.");
    if (!acceptTerms) return setError("Bitte akzeptiere AGB und Datenschutz.");

    setLoading(true);
    const { data: existing } = await supabase
      .from("users").select("id").eq("username", username.toLowerCase()).neq("id", userId).maybeSingle();
    if (existing) { setError("Dieser Runner-Name ist vergeben."); setLoading(false); return; }

    const { error: upsertErr } = await supabase.from("users").upsert({
      id: userId,
      username: username.toLowerCase(),
      display_name: username,
      faction,
      newsletter_opt_in: newsletter,
    });
    if (upsertErr) { setError(upsertErr.message); setLoading(false); return; }

    router.push("/dashboard");
    router.refresh();
  }

  return (
    <main className="min-h-screen flex items-center justify-center px-4 py-10 bg-bg">
      <div className="w-full max-w-md">
        <div className="text-center mb-6">
          <Image src="/logo.png" alt="MyArea365" width={64} height={64} className="mx-auto mb-3 rounded-full" />
          <h1 className="text-2xl font-bold">Willkommen, Runner!</h1>
          <p className="text-sm text-text-muted mt-1">
            Noch ein paar Angaben — {email && <span className="text-text">{email}</span>}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3 p-5 rounded-2xl bg-bg-card border border-border">
          <div>
            <label className="text-xs font-semibold text-text-muted">Runner-Name</label>
            <input
              type="text" required minLength={3} maxLength={24} value={username}
              onChange={(e) => setUsername(e.target.value.replace(/[^a-zA-Z0-9_-]/g, ""))}
              placeholder="z. B. Kaelthor"
              className="mt-1 w-full px-4 py-2.5 rounded-lg bg-bg-elevated/80 border border-border text-text text-sm focus:outline-none focus:border-primary/50"
            />
          </div>

          <div className="relative">
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-semibold text-text-muted">Fraktion wählen</label>
              <button type="button" onClick={() => setShowInfo(v => !v)} className="inline-flex items-center gap-1 text-xs text-primary">
                <Info className="w-3 h-3" />{showInfo ? "Schließen" : "Was ist das?"}
              </button>
            </div>
            {showInfo && (
              <div className="absolute right-0 -top-2 -translate-y-full z-40 w-72 p-3 rounded-lg bg-bg-elevated border border-primary/60 text-[11px] text-text-muted leading-relaxed shadow-2xl">
                <b className="text-text">2 weltweite Teams</b>, die sich jede Saison duellieren. Deine km zählen für deine Fraktion — weltweit, pro Land, Stadt, PLZ. Trotzdem eigene Crew möglich.
                <span className="block mt-1 text-danger font-semibold">Nicht änderbar nach Registrierung.</span>
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
              Ja, ich will den <b className="text-text">Kiez-Newsletter</b> (max. 1× / Monat, jederzeit abbestellbar).
            </span>
          </label>

          <label className="flex items-start gap-2 cursor-pointer">
            <input type="checkbox" checked={acceptTerms} onChange={(e) => setAcceptTerms(e.target.checked)}
              className="mt-0.5 w-3.5 h-3.5 rounded border-border accent-primary" />
            <span className="text-[11px] text-text-muted leading-relaxed">
              Ich akzeptiere die <Link href="/agb" className="text-primary hover:underline">AGB</Link>
              {" und die "}
              <Link href="/datenschutz" className="text-primary hover:underline">Datenschutzerklärung</Link>.
            </span>
          </label>

          {error && <p className="text-xs text-danger text-center">{error}</p>}

          <button type="submit" disabled={loading || !faction || !acceptTerms || username.length < 3}
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg bg-primary text-bg-deep font-bold hover:bg-primary-dim disabled:opacity-50 disabled:cursor-not-allowed transition-colors">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <>Loslegen <ArrowRight className="w-4 h-4" /></>}
          </button>
        </form>
      </div>
    </main>
  );
}
