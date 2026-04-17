import Link from "next/link";
import Image from "next/image";

export const metadata = { title: "E-Mail bestätigen · MyArea365" };

export default function ConfirmPendingPage({ searchParams }: { searchParams: { email?: string } }) {
  return (
    <main className="min-h-screen flex items-center justify-center px-4 py-10">
      <div className="max-w-md w-full text-center">
        <Image src="/logo.png" alt="MyArea365" width={72} height={72} className="mx-auto mb-4 rounded-full" />
        <div className="text-5xl mb-4">📬</div>
        <h1 className="text-2xl font-black text-white mb-3">Fast geschafft!</h1>
        <p className="text-text-muted leading-relaxed mb-6">
          Wir haben dir eine Bestätigungs-Mail an{" "}
          {searchParams.email ? <b className="text-primary">{searchParams.email}</b> : <b className="text-primary">deine E-Mail-Adresse</b>}{" "}
          geschickt. Klick den Link in der Mail, um dein Konto zu aktivieren.
        </p>
        <div className="p-4 rounded-xl bg-bg-card border border-border text-left text-sm text-text-soft space-y-2 mb-6">
          <p><b className="text-white">So geht&apos;s weiter:</b></p>
          <ol className="list-decimal list-inside space-y-1 text-text-muted">
            <li>Postfach öffnen (auch Spam-Ordner checken)</li>
            <li>Mail von <code>hello@myarea365.de</code> suchen</li>
            <li>Auf &quot;E-Mail bestätigen&quot; klicken</li>
            <li>Automatisch zurück zur App — los geht&apos;s!</li>
          </ol>
        </div>
        <p className="text-xs text-text-muted">
          Keine Mail erhalten? Manchmal dauert es 1–2 Minuten. Falls nicht: schreib an{" "}
          <a href="mailto:support@myarea365.de" className="text-primary hover:underline">support@myarea365.de</a>.
        </p>
        <div className="mt-6 pt-6 border-t border-border text-xs text-text-muted">
          <Link href="/" className="hover:text-primary">← Zur Startseite</Link>
        </div>
      </div>
    </main>
  );
}
