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
          <h2 className="text-lg font-bold text-text mb-2">Angaben gemäß § 5 TMG</h2>
          <p>
            Andre Meierholz<br />
            [Straße Hausnummer]<br />
            [PLZ Ort]<br />
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
          <h2 className="text-lg font-bold text-text mb-2">Verantwortlich für den Inhalt nach § 55 Abs. 2 RStV</h2>
          <p>Andre Meierholz (Anschrift wie oben)</p>
        </section>

        <section>
          <h2 className="text-lg font-bold text-text mb-2">EU-Streitschlichtung</h2>
          <p>
            Die Europäische Kommission stellt eine Plattform zur Online-Streitbeilegung (OS) bereit:{" "}
            <a href="https://ec.europa.eu/consumers/odr/" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
              https://ec.europa.eu/consumers/odr/
            </a>
          </p>
        </section>

        <section>
          <h2 className="text-lg font-bold text-text mb-2">Verbraucherstreitbeilegung</h2>
          <p>Wir sind nicht bereit oder verpflichtet, an Streitbeilegungsverfahren vor einer Verbraucherschlichtungsstelle teilzunehmen.</p>
        </section>

        <section>
          <h2 className="text-lg font-bold text-text mb-2">Haftung für Inhalte</h2>
          <p className="text-sm">
            Als Diensteanbieter sind wir gemäß § 7 Abs. 1 TMG für eigene Inhalte auf diesen Seiten nach den allgemeinen Gesetzen
            verantwortlich. Nach §§ 8 bis 10 TMG sind wir als Diensteanbieter jedoch nicht verpflichtet, übermittelte oder
            gespeicherte fremde Informationen zu überwachen oder nach Umständen zu forschen, die auf eine rechtswidrige Tätigkeit hinweisen.
          </p>
        </section>

        <section className="text-xs pt-4 border-t border-border">
          Stand: {new Date().toLocaleDateString("de-DE", { month: "long", year: "numeric" })}
        </section>
      </div>
    </div>
  );
}
