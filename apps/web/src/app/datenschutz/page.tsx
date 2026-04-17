import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Datenschutzerklärung" };

export default function DatenschutzPage() {
  return (
    <div className="min-h-screen px-4 py-10 max-w-3xl mx-auto">
      <Link href="/" className="text-sm text-primary hover:underline">← Zurück</Link>
      <h1 className="text-3xl font-bold mt-6 mb-6">Datenschutzerklärung</h1>
      <div className="space-y-6 text-text-muted leading-relaxed">

        <section>
          <h2 className="text-lg font-bold text-text mb-2">1. Verantwortlicher</h2>
          <p>
            Andre Meierholz · [Anschrift] · E-Mail:{" "}
            <a href="mailto:support@myarea365.de" className="text-primary hover:underline">support@myarea365.de</a>
          </p>
        </section>

        <section>
          <h2 className="text-lg font-bold text-text mb-2">2. Welche Daten wir verarbeiten</h2>
          <ul className="list-disc list-inside space-y-1 text-sm">
            <li><b className="text-text">Konto-Daten</b>: E-Mail, Runner-Name, Anzeigename, Passwort-Hash, Fraktions-Wahl</li>
            <li><b className="text-text">Bewegungs-Daten</b>: GPS-Tracks, Zeitstempel, zurückgelegte Strecke, eroberte Gebiete (nur während aktiver Lauf-Session)</li>
            <li><b className="text-text">Crew-Daten</b>: Mitgliedschaften, Invites, Chat-Nachrichten</li>
            <li><b className="text-text">Shop-Interaktionen</b>: Check-ins (Zeit + Shop), eingelöste Deals</li>
            <li><b className="text-text">Technische Daten</b>: IP (temporär, Web-Server-Log 7 Tage), Browser-Typ, Screen-Auflösung</li>
            <li><b className="text-text">Marketing</b> (nur bei Opt-in): E-Mail-Adresse für Newsletter</li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-bold text-text mb-2">3. Rechtsgrundlagen</h2>
          <ul className="list-disc list-inside space-y-1 text-sm">
            <li>Vertragserfüllung (Art. 6 Abs. 1 lit. b DSGVO) — Konto, Lauf-Tracking, Gamification-Funktionen</li>
            <li>Einwilligung (Art. 6 Abs. 1 lit. a DSGVO) — Newsletter, GPS-Tracking, Standort-basierte Shop-Check-ins</li>
            <li>Berechtigtes Interesse (Art. 6 Abs. 1 lit. f DSGVO) — Sicherheit, Fraud-Prevention, Stabilität</li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-bold text-text mb-2">4. Auftragsverarbeiter</h2>
          <ul className="list-disc list-inside space-y-1 text-sm">
            <li><b className="text-text">Supabase</b> (EU-Server Frankfurt) — Auth, Datenbank, Storage</li>
            <li><b className="text-text">Vercel</b> (EU-Region fra1) — Hosting</li>
            <li><b className="text-text">Mapbox</b> (USA, Standard Contract Clauses) — Kartendarstellung, Geocoding</li>
            <li><b className="text-text">Resend</b> (USA, DPA vorhanden) — Transaktions- und Newsletter-E-Mails</li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-bold text-text mb-2">5. Speicherdauer</h2>
          <p className="text-sm">
            Konto-Daten werden bis zur Löschung deines Accounts gespeichert. Bewegungs-Daten max. 24 Monate (gesetzliche
            Aufbewahrung + Streak-Berechnung). Web-Server-Logs 7 Tage.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-bold text-text mb-2">6. Deine Rechte</h2>
          <p className="text-sm">
            Du hast jederzeit das Recht auf Auskunft, Berichtigung, Löschung, Einschränkung der Verarbeitung, Datenübertragbarkeit
            und Widerspruch. Schreib einfach an{" "}
            <a href="mailto:support@myarea365.de" className="text-primary hover:underline">support@myarea365.de</a>.
            Einwilligungen (z.B. Newsletter) kannst du jederzeit per Link in jeder E-Mail oder im Profil widerrufen.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-bold text-text mb-2">7. Cookies</h2>
          <p className="text-sm">
            Wir verwenden nur technisch notwendige Cookies (Session, Sprach-Präferenz, Auth-Token). Keine Tracking- oder Werbe-Cookies.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-bold text-text mb-2">8. Standortdaten</h2>
          <p className="text-sm">
            GPS-Daten werden nur während einer aktiven Lauf-Session erfasst. Die Route wird gespeichert um Gebiete zu berechnen
            und XP zu vergeben. Wir verkaufen keine Standortdaten. Nach 24 Monaten werden GPS-Tracks anonymisiert (Aggregat-Heatmap bleibt).
          </p>
        </section>

        <section>
          <h2 className="text-lg font-bold text-text mb-2">9. Shop-Check-ins</h2>
          <p className="text-sm">
            Bei einem Check-in bei einem Partner-Shop erhält dieser nur deinen anonymen Runner-Namen + die Tatsache, dass du
            einen Deal eingelöst hast. Keine E-Mail, kein Klarname, keine sonstigen Profildaten.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-bold text-text mb-2">10. Beschwerde</h2>
          <p className="text-sm">
            Du hast das Recht, bei der zuständigen Datenschutzbehörde Beschwerde einzulegen (für Berlin: Berliner Beauftragte
            für Datenschutz und Informationsfreiheit).
          </p>
        </section>

        <section className="text-xs pt-4 border-t border-border">
          Stand: {new Date().toLocaleDateString("de-DE", { month: "long", year: "numeric" })}
          <br />
          <span className="italic">
            Hinweis: Dieser Entwurf ersetzt keine Rechtsberatung. Vor dem Produktiv-Launch von einem Anwalt prüfen lassen.
          </span>
        </section>
      </div>
    </div>
  );
}
