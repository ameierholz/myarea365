import { createClient } from "@/lib/supabase/server";
import { SupportForm } from "./support-form";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "Support & Kontakt",
  description:
    "Hilfe, Bug-Report oder Partner-Anfrage — wir sind für dich da.",
};

export default async function SupportPage() {
  const sb = await createClient();
  const { data: auth } = await sb.auth.getUser();
  let prefillEmail = "";
  let prefillName = "";
  if (auth?.user) {
    prefillEmail = auth.user.email ?? "";
    const { data: profile } = await sb
      .from("users")
      .select("display_name, username")
      .eq("id", auth.user.id)
      .maybeSingle();
    prefillName =
      (profile as { display_name?: string; username?: string } | null)
        ?.display_name ??
      (profile as { username?: string } | null)?.username ??
      "";
  }

  return (
    <main className="min-h-screen bg-[#0F1115] text-[#F0F0F0]">
      <div className="max-w-xl mx-auto px-4 py-8">
        <a
          href="/"
          className="inline-block text-xs text-[#22D1C3] hover:underline mb-4"
        >
          ← Zurück
        </a>
        <h1 className="text-3xl font-black mb-2">🎫 Support & Kontakt</h1>
        <p className="text-sm text-[#a8b4cf] mb-8">
          Bug gefunden? Frage zum Spiel? Interesse als Partner? Schreib uns —
          wir antworten meist innerhalb von 24h.
        </p>

        <SupportForm prefillEmail={prefillEmail} prefillName={prefillName} />

        <div className="mt-8 p-4 rounded-xl bg-[#1A1D23] border border-white/5 text-xs text-[#8B8FA3]">
          <div className="font-bold text-white mb-1">Alternative Wege:</div>
          <div>📧 support@myarea365.de</div>
          <div>📄 Siehe auch unser Impressum, AGB und Datenschutz im Footer</div>
        </div>
      </div>
    </main>
  );
}
