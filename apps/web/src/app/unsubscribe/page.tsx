import Link from "next/link";
import { createClient } from "@supabase/supabase-js";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Newsletter abbestellen — MyArea365",
  robots: { index: false },
};

type SearchParams = Promise<{ uid?: string; token?: string; email?: string }>;

async function unsubscribeByUserId(uid: string): Promise<boolean> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return false;
  const sb = createClient(url, key, { auth: { persistSession: false } });

  const { error: userErr } = await sb
    .from("users")
    .update({ newsletter_opt_in: false })
    .eq("id", uid);
  if (userErr) return false;

  return true;
}

async function unsubscribeByEmail(email: string): Promise<boolean> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return false;
  const sb = createClient(url, key, { auth: { persistSession: false } });

  const { error } = await sb
    .from("newsletter_subscribers")
    .update({ unsubscribed_at: new Date().toISOString() })
    .eq("email", email.toLowerCase().trim());

  return !error;
}

export default async function UnsubscribePage({ searchParams }: { searchParams: SearchParams }) {
  const sp = await searchParams;
  const uid = sp.uid;
  const email = sp.email;

  let status: "success" | "error" | "missing" = "missing";
  if (uid) status = (await unsubscribeByUserId(uid)) ? "success" : "error";
  else if (email) status = (await unsubscribeByEmail(email)) ? "success" : "error";

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-md">
        <Link href="/" className="block text-center mb-8">
          <span className="text-2xl font-bold tracking-tight">
            My<span className="text-primary">Area</span>365
          </span>
        </Link>

        <div className="p-8 rounded-2xl bg-bg-card border border-border text-center">
          {status === "success" && (
            <>
              <div className="text-5xl mb-4">✓</div>
              <h1 className="text-2xl font-bold mb-2 text-primary">Abgemeldet</h1>
              <p className="text-text-muted leading-relaxed">
                Du bekommst ab jetzt keine Newsletter-Mails mehr von uns. Dein Konto und deine Läufe bleiben aktiv.
              </p>
              <p className="text-xs text-text-muted mt-6">
                Hast du deine Meinung geändert? Im Profil → Einstellungen kannst du den Newsletter jederzeit
                wieder aktivieren.
              </p>
            </>
          )}

          {status === "error" && (
            <>
              <div className="text-5xl mb-4">⚠️</div>
              <h1 className="text-2xl font-bold mb-2">Hmm, irgendwas lief schief</h1>
              <p className="text-text-muted leading-relaxed">
                Wir konnten die Abmeldung nicht ausführen. Bitte schreib kurz an{" "}
                <a href="mailto:support@myarea365.de" className="text-primary hover:underline">
                  support@myarea365.de
                </a>{" "}
                — wir nehmen dich manuell raus.
              </p>
            </>
          )}

          {status === "missing" && (
            <>
              <div className="text-5xl mb-4">📬</div>
              <h1 className="text-2xl font-bold mb-2">Newsletter abbestellen</h1>
              <p className="text-text-muted leading-relaxed mb-6">
                Gib deine E-Mail ein, um dich vom Newsletter abzumelden:
              </p>
              <form method="get" action="/unsubscribe/" className="space-y-3">
                <input
                  type="email"
                  name="email"
                  required
                  placeholder="deine@mail.de"
                  className="w-full px-4 py-2.5 rounded-lg bg-bg-elevated border border-border text-text placeholder:text-text-muted/50 focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/20 transition-colors"
                />
                <button
                  type="submit"
                  className="w-full py-2.5 rounded-lg bg-primary text-bg-deep font-bold hover:bg-primary-dim transition-colors"
                >
                  Abbestellen
                </button>
              </form>
            </>
          )}
        </div>

        <p className="text-center text-xs text-text-muted mt-6">
          <Link href="/datenschutz" className="hover:text-text">Datenschutz</Link> ·{" "}
          <Link href="/impressum" className="hover:text-text">Impressum</Link> ·{" "}
          <Link href="/" className="hover:text-text">Zurück zur Startseite</Link>
        </p>
      </div>
    </div>
  );
}
