import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "AGB — Nutzungsbedingungen" };

export default function AgbPage() {
  return (
    <div className="min-h-screen px-4 py-10 max-w-3xl mx-auto">
      <Link href="/" className="text-sm text-primary hover:underline">← Zurück</Link>
      <h1 className="text-3xl font-bold mt-6 mb-6">Nutzungsbedingungen (AGB)</h1>
      <div className="space-y-6 text-text-muted leading-relaxed">

        <section>
          <h2 className="text-lg font-bold text-text mb-2">§ 1 Geltungsbereich</h2>
          <p className="text-sm">
            Diese Nutzungsbedingungen gelten für die Nutzung der Plattform MyArea365 (Web-App, später auch Native Apps), betrieben von
            Andre Meierholz (siehe Impressum).
          </p>
        </section>

        <section>
          <h2 className="text-lg font-bold text-text mb-2">§ 2 Leistungsbeschreibung</h2>
          <p className="text-sm">
            MyArea365 ist eine gamifizierte Lauf-Community. Nutzer:innen können ihre Bewegungen (Gehen/Laufen) via GPS tracken,
            auf einer Karte Gebiete „erobern", XP sammeln, Crews gründen oder beitreten, und XP bei lokalen Partner-Geschäften
            gegen Rabatte einlösen.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-bold text-text mb-2">§ 3 Registrierung und Mindestalter</h2>
          <p className="text-sm">
            Die Nutzung erfordert eine Registrierung. Mindestalter: 16 Jahre. Bei Minderjährigen ist die Zustimmung der
            Erziehungsberechtigten erforderlich. Du versicherst bei der Registrierung, dass deine Angaben korrekt sind.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-bold text-text mb-2">§ 4 Kostenloses Angebot, Premium-Optionen</h2>
          <p className="text-sm">
            Die Grund-Funktionen sind für Runner dauerhaft kostenlos. Optionale Premium-Funktionen werden transparent markiert
            und können kostenpflichtig sein. Shops zahlen pro Einlösung („Pay-per-Visit").
          </p>
        </section>

        <section>
          <h2 className="text-lg font-bold text-text mb-2">§ 5 Verhaltensregeln</h2>
          <ul className="list-disc list-inside space-y-1 text-sm">
            <li>Keine manipulierten GPS-Daten, keine Fake-Routen, kein Cheating</li>
            <li>Keine Beleidigungen, kein Hass, keine Belästigung anderer Nutzer:innen (Crew-Chat etc.)</li>
            <li>Keine kommerzielle Nutzung ohne ausdrückliche Zustimmung</li>
            <li>Kein Missbrauch von Deals (GPS-Check + QR-Rotation + DB-Limit verhindern technisch das Gröbste)</li>
            <li>Nimm Rücksicht auf Verkehr und Mitmenschen — Sicherheit hat Vorrang vor Gamification</li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-bold text-text mb-2">§ 6 XP, Ränge und Rabatte</h2>
          <p className="text-sm">
            XP sind keine echte Währung im Sinne des ZAG (Zahlungsdiensteaufsichtsgesetzes). Sie können nicht ausgezahlt oder
            übertragen werden. Rabatte werden direkt vom jeweiligen Shop gewährt — MyArea365 ist nicht Vertragspartner des
            Kaufvertrags zwischen dir und dem Shop.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-bold text-text mb-2">§ 7 Haftung</h2>
          <p className="text-sm">
            MyArea365 haftet für Schäden nur bei Vorsatz und grober Fahrlässigkeit sowie nach Produkthaftungsgesetz. Für leichte
            Fahrlässigkeit haften wir nur bei Verletzung einer wesentlichen Vertragspflicht, begrenzt auf den vorhersehbaren,
            vertragstypischen Schaden. Für Schäden beim Laufen/Gehen selbst (Stürze, Verkehrsunfälle etc.) übernehmen wir keine
            Haftung — du bist selbst verantwortlich.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-bold text-text mb-2">§ 8 Datenschutz</h2>
          <p className="text-sm">
            Informationen zum Datenschutz siehe{" "}
            <Link href="/datenschutz" className="text-primary hover:underline">Datenschutzerklärung</Link>.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-bold text-text mb-2">§ 9 Kündigung</h2>
          <p className="text-sm">
            Du kannst deinen Account jederzeit im Profil löschen. Wir behalten uns vor, Accounts bei schweren Verstößen (z.B. Cheating,
            Belästigung) zu sperren oder zu löschen.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-bold text-text mb-2">§ 10 Änderungen</h2>
          <p className="text-sm">
            Wir behalten uns vor, diese AGB anzupassen. Bei wesentlichen Änderungen wirst du per E-Mail informiert und kannst
            widersprechen.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-bold text-text mb-2">§ 11 Schlussbestimmungen</h2>
          <p className="text-sm">
            Anwendbares Recht: Recht der Bundesrepublik Deutschland. Gerichtsstand für Kaufleute: Berlin. Salvatorische Klausel:
            Sollte eine Bestimmung unwirksam sein, bleiben die übrigen wirksam.
          </p>
        </section>

        <section className="text-xs pt-4 border-t border-border">
          Stand: {new Date().toLocaleDateString("de-DE", { month: "long", year: "numeric" })}
          <br />
          <span className="italic">
            Hinweis: Dieser AGB-Entwurf ist ein Startpunkt und ersetzt keine Rechtsberatung. Vor Produktiv-Launch von einem Anwalt prüfen lassen.
          </span>
        </section>
      </div>
    </div>
  );
}
