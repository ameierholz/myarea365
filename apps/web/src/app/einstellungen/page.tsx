import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { DangerZone } from "./danger-zone";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const metadata = {
  title: "Einstellungen · MyArea365",
  description: "Datenschutz-Kontrollen: Konto-Export herunterladen, Konto löschen, Privatsphäre-Einstellungen.",
  robots: { index: false, follow: false },
};

export default async function SettingsPage() {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await sb
    .from("users")
    .select("username, display_name, deletion_requested_at")
    .eq("id", user.id)
    .maybeSingle<{ username: string; display_name: string | null; deletion_requested_at: string | null }>();

  return (
    <main className="min-h-screen px-4 py-12">
      <div className="max-w-xl mx-auto space-y-8">
        <div>
          <h1 className="text-3xl font-black text-white mb-2">Einstellungen</h1>
          <p className="text-sm text-text-muted">
            Angemeldet als <b className="text-white">{profile?.display_name ?? profile?.username}</b>
          </p>
        </div>

        <section className="p-5 rounded-2xl bg-bg-card border border-border">
          <h2 className="text-lg font-bold text-white mb-2">📥 Meine Daten</h2>
          <p className="text-sm text-text-muted mb-4">
            DSGVO Art. 20 — lade alle gespeicherten Daten als JSON herunter.
            Enthalten: Profil, Läufe, Gebiete, Transaktionen, Wächter, Kämpfe, Crew-Mitgliedschaft.
          </p>
          <a href="/api/account/export" download
             className="inline-block px-5 py-2.5 rounded-lg bg-primary/20 text-primary border border-primary/40 font-bold text-sm hover:bg-primary/30">
            Export herunterladen
          </a>
        </section>

        <section className="p-5 rounded-2xl bg-bg-card border border-border">
          <h2 className="text-lg font-bold text-white mb-2">📜 Rechtliches</h2>
          <ul className="space-y-1.5 text-sm">
            <li><Link href="/datenschutz" className="text-primary hover:underline">Datenschutzerklärung</Link></li>
            <li><Link href="/impressum" className="text-primary hover:underline">Impressum</Link></li>
            <li><Link href="/agb" className="text-primary hover:underline">AGB</Link></li>
          </ul>
        </section>

        <DangerZone deletionPending={!!profile?.deletion_requested_at} />
      </div>
    </main>
  );
}
