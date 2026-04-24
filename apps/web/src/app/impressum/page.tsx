import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Impressum" };

export default function ImpressumPage() {
  return (
    <div className="min-h-screen px-4 py-10 max-w-3xl mx-auto">
      <Link href="/" className="text-sm text-primary hover:underline">← Zurück</Link>
      <h1 className="text-3xl font-bold mt-6 mb-6">Impressum</h1>
      <div className="space-y-6 text-text-muted leading-relaxed">
        <section>
          <h2 className="text-lg font-bold text-text mb-2">Angaben gemäß § 5 DDG</h2>
          <p>
            Andre Meierholz<br />
            Kolonnenstr. 8<br />
            10827 Berlin<br />
            Deutschland
          </p>
        </section>

        <section>
          <h2 className="text-lg font-bold text-text mb-2">Kontakt</h2>
          <p>
            E-Mail: <a href="mailto:support@myarea365.de" className="text-primary hover:underline">support@myarea365.de</a>
          </p>
        </section>

        <section>
          <h2 className="text-lg font-bold text-text mb-2">Verantwortlich für journalistisch-redaktionelle Inhalte nach § 18 Abs. 2 MStV</h2>
          <p>Andre Meierholz (Anschrift wie oben)</p>
        </section>

        <section>
          <h2 className="text-lg font-bold text-text mb-2">Umsatzsteuerliche Angaben</h2>
          <p className="text-sm">
            Kleinunternehmer gemäß § 19 UStG. Es wird keine Umsatzsteuer ausgewiesen. Eine Umsatzsteuer-Identifikationsnummer
            nach § 27a UStG wird aus diesem Grund nicht geführt.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-bold text-text mb-2">Zentrale Kontaktstelle nach Art. 11 / 12 DSA</h2>
          <p className="text-sm">
            Für Anfragen von Behörden, Nutzerinnen und Nutzern sowie für Meldungen rechtswidriger Inhalte nach der
            EU-Verordnung 2022/2065 (Digital Services Act) steht folgende elektronische Kontaktstelle zur Verfügung:
          </p>
          <p className="text-sm mt-2">
            E-Mail:{" "}
            <a href="mailto:support@myarea365.de" className="text-primary hover:underline">support@myarea365.de</a>
            <br />
            Bevorzugte Sprachen: Deutsch, Englisch
          </p>
        </section>

        <section>
          <h2 className="text-lg font-bold text-text mb-2">EU-Streitschlichtung</h2>
          <p className="text-sm">
            Die Europäische Kommission stellt eine Plattform zur Online-Streitbeilegung (OS) bereit:{" "}
            <a href="https://ec.europa.eu/consumers/odr/" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
              https://ec.europa.eu/consumers/odr/
            </a>
            . Unsere E-Mail-Adresse findest du oben.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-bold text-text mb-2">Verbraucherstreitbeilegung</h2>
          <p className="text-sm">
            Wir sind nicht bereit oder verpflichtet, an Streitbeilegungsverfahren vor einer Verbraucherschlichtungsstelle
            teilzunehmen.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-bold text-text mb-2">Haftung für Inhalte</h2>
          <p className="text-sm">
            Als Anbieter eines Telemediendienstes sind wir nach § 7 Abs. 1 DDG für eigene Inhalte auf diesen Seiten nach
            den allgemeinen Gesetzen verantwortlich. Nach §§ 8 bis 10 DDG sind wir als Diensteanbieter nicht verpflichtet,
            übermittelte oder gespeicherte fremde Informationen zu überwachen oder nach Umständen zu forschen, die auf
            eine rechtswidrige Tätigkeit hinweisen. Verpflichtungen zur Entfernung oder Sperrung der Nutzung von
            Informationen nach den allgemeinen Gesetzen bleiben hiervon unberührt.
          </p>
          <p className="text-sm mt-2">
            Nutzerseitig hochgeladene oder eingestellte Inhalte geben nicht unsere Auffassung wieder. Rechtswidrige
            Inhalte können über die In-App-Meldefunktion oder per E-Mail an{" "}
            <a href="mailto:support@myarea365.de" className="text-primary hover:underline">support@myarea365.de</a>{" "}
            gemeldet werden (Art. 16 DSA).
          </p>
        </section>

        <section>
          <h2 className="text-lg font-bold text-text mb-2">Haftung für Links</h2>
          <p className="text-sm">
            Unser Angebot enthält Links zu externen Websites Dritter, auf deren Inhalte wir keinen Einfluss haben.
            Deshalb können wir für diese fremden Inhalte auch keine Gewähr übernehmen. Für die Inhalte der verlinkten
            Seiten ist stets der jeweilige Anbieter oder Betreiber der Seiten verantwortlich. Die verlinkten Seiten
            wurden zum Zeitpunkt der Verlinkung auf mögliche Rechtsverstöße überprüft; rechtswidrige Inhalte waren zum
            Zeitpunkt der Verlinkung nicht erkennbar. Eine permanente inhaltliche Kontrolle ohne konkrete Anhaltspunkte
            ist nicht zumutbar. Bei Bekanntwerden von Rechtsverletzungen entfernen wir derartige Links umgehend.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-bold text-text mb-2">Urheberrecht</h2>
          <p className="text-sm">
            Die durch uns erstellten Inhalte und Werke auf diesen Seiten unterliegen dem deutschen Urheberrecht. Jede
            Art der Vervielfältigung, Bearbeitung, Verbreitung oder Verwertung außerhalb der Grenzen des Urheberrechts
            bedarf unserer schriftlichen Zustimmung. Downloads und Kopien sind nur für den privaten, nicht kommerziellen
            Gebrauch gestattet. Soweit Inhalte auf dieser Website nicht von uns erstellt wurden, werden Urheberrechte
            Dritter beachtet und als solche gekennzeichnet.
          </p>
        </section>

        <section className="text-xs pt-4 border-t border-border">
          Stand: {new Date().toLocaleDateString("de-DE", { month: "long", year: "numeric" })}
        </section>
      </div>
    </div>
  );
}
