import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "AGB — Nutzungsbedingungen",
  description: "Allgemeine Geschäftsbedingungen und Nutzungsbedingungen von MyArea365.",
};

export default function AgbPage() {
  return (
    <div className="min-h-screen px-4 py-10 max-w-3xl mx-auto">
      <Link href="/" className="text-sm text-primary hover:underline">← Zurück</Link>
      <h1 className="text-3xl font-bold mt-6 mb-2">Allgemeine Geschäftsbedingungen</h1>
      <p className="text-sm text-text-muted mb-1">Nutzungsbedingungen für MyArea365</p>
      <p className="text-xs text-text-muted mb-8">
        Stand: {new Date().toLocaleDateString("de-DE", { day: "2-digit", month: "long", year: "numeric" })}
      </p>

      <div className="space-y-8 text-text-muted leading-relaxed">

        <section>
          <p className="text-sm">
            Diese Allgemeinen Geschäftsbedingungen (nachfolgend &bdquo;AGB&ldquo;) regeln die Nutzung des Dienstes
            <b className="text-text"> MyArea365</b>, bestehend aus der Website unter myarea365.de, zugehörigen
            Web-Anwendungen und mobilen Apps (zusammen &bdquo;Dienst&ldquo; oder &bdquo;Plattform&ldquo;). Diese AGB bilden
            zusammen mit der <Link href="/datenschutz" className="text-primary hover:underline">Datenschutzerklärung</Link>{" "}
            und der <Link href="/impressum" className="text-primary hover:underline">Anbieterkennzeichnung (Impressum)</Link>{" "}
            die vertragliche Grundlage zwischen dir und dem Betreiber.
          </p>
        </section>

        <Section num="1" title="Geltungsbereich und Anbieter">
          <p>
            Anbieter und Vertragspartner ist Andre Meierholz (Anschrift siehe{" "}
            <Link href="/impressum" className="text-primary hover:underline">Impressum</Link>), nachfolgend
            &bdquo;Anbieter&ldquo;, &bdquo;wir&ldquo; oder &bdquo;uns&ldquo;. Diese AGB gelten gegenüber Verbrauchern im Sinne
            des § 13 BGB sowie gegenüber Unternehmern im Sinne des § 14 BGB. Abweichende, entgegenstehende oder ergänzende
            Bedingungen des Nutzers werden nicht Vertragsbestandteil, es sei denn, wir stimmen ihrer Geltung ausdrücklich
            schriftlich zu.
          </p>
        </Section>

        <Section num="2" title="Begriffsbestimmungen">
          <ul className="list-disc list-inside space-y-1 text-sm">
            <li><b className="text-text">Nutzer / Runner:</b> natürliche Person, die den Dienst verwendet</li>
            <li><b className="text-text">Verbraucher:</b> natürliche Person, die zu privaten Zwecken handelt (§ 13 BGB)</li>
            <li><b className="text-text">Unternehmer:</b> Person, die zu gewerblichen Zwecken handelt (§ 14 BGB)</li>
            <li><b className="text-text">Partner-Shop:</b> Geschäft, das Deals auf der Plattform anbietet</li>
            <li><b className="text-text">Inhalt:</b> alle vom Nutzer hochgeladenen oder erstellten Daten (Texte, Bilder, Chat-Nachrichten)</li>
            <li><b className="text-text">Virtuelle Güter:</b> Diamanten, Items, Wächter, XP, Siegel — siehe § 8</li>
            <li><b className="text-text">Saison:</b> zeitlich begrenzter Spielabschnitt mit eigenen Ranglisten und Belohnungen</li>
          </ul>
        </Section>

        <Section num="3" title="Leistungsbeschreibung">
          <p>
            MyArea365 ist eine gamifizierte Lauf- und Geh-Community. Zu den Kernfunktionen gehören unter anderem:
          </p>
          <ul className="list-disc list-inside space-y-1 text-sm mt-2">
            <li>Aufzeichnung von Lauf-Sessions via GPS</li>
            <li>Eroberung virtueller Gebiete auf Basis gelaufener Strecken</li>
            <li>Vergabe von Erfahrungspunkten (XP), Level und Achievements</li>
            <li>Sammeln und Aufwerten von &bdquo;Wächtern&ldquo; und virtueller Ausrüstung</li>
            <li>Teilnahme an Arena-Kämpfen (Spieler gegen Spieler) und Saison-Ranglisten</li>
            <li>Gründen oder Beitreten von Crews inklusive Crew-Chat</li>
            <li>Einlösung von Rabatt-Deals bei teilnehmenden Partner-Shops</li>
            <li>Öffentliches Profil, Hall-of-Fame und Bestenlisten</li>
          </ul>
          <p className="text-sm mt-2">
            Der konkrete Funktionsumfang entwickelt sich fortlaufend weiter. Wir behalten uns vor, einzelne Funktionen
            hinzuzufügen, zu ändern oder einzustellen, sofern dies für den Nutzer zumutbar ist und wesentliche
            Vertragspflichten nicht betroffen sind.
          </p>
        </Section>

        <Section num="4" title="Vertragsschluss und Registrierung">
          <p className="text-sm">
            Die Darstellung des Dienstes auf unserer Website stellt kein verbindliches Angebot dar, sondern eine
            Einladung zur Abgabe eines Angebots (invitatio ad offerendum). Mit der Registrierung gibst du ein Angebot
            auf Abschluss eines Nutzungsvertrags ab. Durch unsere Bestätigung per E-Mail oder die Freischaltung deines
            Zugangs kommt der Vertrag zustande.
          </p>
          <p className="text-sm mt-2">
            Du versicherst, bei der Registrierung wahrheitsgemäße, vollständige und aktuelle Angaben zu machen. Änderungen
            teilst du uns unverzüglich mit. Pro Person ist grundsätzlich nur ein Konto zulässig.
          </p>
        </Section>

        <Section num="5" title="Mindestalter und Minderjährige">
          <p className="text-sm">
            Die Nutzung steht Personen ab <b className="text-text">16 Jahren</b> offen. Personen unter 16 Jahren dürfen den
            Dienst nur mit ausdrücklicher Einwilligung der Erziehungsberechtigten nutzen (Art. 8 DSGVO, §§ 107, 108 BGB).
            Wir behalten uns vor, bei begründeten Zweifeln am Mindestalter einen Nachweis zu verlangen oder das Konto
            vorsorglich zu sperren.
          </p>
          <p className="text-sm mt-2">
            Der Dienst enthält Gamification- und Social-Features, die an den Jugendmedienschutz-Staatsvertrag (JMStV)
            angepasst sind. Chat-Funktionen für Minderjährige unterliegen besonderer Moderation.
          </p>
        </Section>

        <Section num="6" title="Kostenloses Grundangebot">
          <p className="text-sm">
            Die Grundfunktionen (Lauf-Tracking, Gebiete, XP, Crews, Rabatt-Einlösung bei Partner-Shops) stehen dir
            dauerhaft und kostenfrei zur Verfügung. Für die Nutzung benötigst du lediglich ein internetfähiges Endgerät
            und ggf. mobile Datenübertragung. Hieraus entstehende Verbindungskosten trägst du selbst.
          </p>
        </Section>

        <Section num="7" title="Kostenpflichtige Zusatzleistungen und Abonnements">
          <SubSection title="7.1 Einmalige Käufe">
            <p className="text-sm">
              Wir bieten kostenpflichtige Einmal-Käufe an, insbesondere Diamanten-Pakete, Skins und saisonale Boost-Items.
              Preise werden brutto inklusive gesetzlicher Umsatzsteuer angezeigt (§ 1 PAngV).
            </p>
          </SubSection>
          <SubSection title="7.2 Abonnements (z. B. Season Pass)">
            <p className="text-sm">
              Bestimmte Angebote werden als zeitlich begrenzte oder wiederkehrende Abonnements geführt (z.&nbsp;B. Season Pass
              über die Dauer einer Saison). Laufzeit, Preis, Verlängerungsbedingungen und Kündigungsfrist werden dir
              vor Bestellung transparent angezeigt.
            </p>
          </SubSection>
          <SubSection title="7.3 Zahlungsmittel">
            <p className="text-sm">
              Zahlungen erfolgen über unseren Zahlungsdienstleister (derzeit Stripe Payments Europe Ltd.). Akzeptierte
              Zahlungsarten werden im Bestellvorgang angezeigt. Die Abrechnung erfolgt sofort mit Vertragsschluss.
            </p>
          </SubSection>
          <SubSection title="7.4 Fälligkeit und Rechnung">
            <p className="text-sm">
              Der Kaufpreis wird sofort fällig. Bei wiederkehrenden Leistungen wird automatisch zum nächsten
              Abrechnungstermin abgebucht, bis du kündigst. Eine Rechnung stellen wir dir elektronisch zur Verfügung.
            </p>
          </SubSection>
          <SubSection title="7.5 Eigentumsvorbehalt">
            <p className="text-sm">
              Virtuelle Güter bleiben bis zur vollständigen Bezahlung unser Eigentum bzw. unser Nutzungsvorbehalt.
            </p>
          </SubSection>
        </Section>

        <Section num="8" title="Virtuelle Güter und virtuelle Währung">
          <p className="text-sm">
            Diamanten, XP, Wächter, Items, Siegel und sonstige virtuelle Güter sind ausschließlich zur Nutzung innerhalb
            des Dienstes bestimmt.
          </p>
          <ul className="list-disc list-inside space-y-1 text-sm mt-2">
            <li>Sie stellen <b className="text-text">keine gesetzlichen Zahlungsmittel</b> und keine E-Geld im Sinne des ZAG dar</li>
            <li>Sie können <b className="text-text">nicht in echtes Geld zurückgetauscht</b> werden</li>
            <li>Sie sind <b className="text-text">nicht übertragbar</b> zwischen Konten (sofern nicht ausdrücklich vorgesehen)</li>
            <li>Sie verfallen mit der Löschung deines Kontos ohne Anspruch auf Ausgleich</li>
            <li>Du erhältst daran ein <b className="text-text">einfaches, nicht ausschließliches Nutzungsrecht</b></li>
          </ul>
          <p className="text-sm mt-2">
            Wir behalten uns vor, aus Gründen der Spielbalance einzelne virtuelle Güter anzupassen, zu entfernen oder durch
            gleichwertige zu ersetzen, soweit dies unter Berücksichtigung deiner Interessen zumutbar ist.
          </p>
        </Section>

        <Section num="9" title="Widerrufsrecht für Verbraucher">
          <SubSection title="9.1 Widerrufsbelehrung">
            <p className="text-sm">
              Du hast das Recht, binnen <b className="text-text">14 Tagen</b> ohne Angabe von Gründen diesen Vertrag zu
              widerrufen. Die Widerrufsfrist beträgt 14 Tage ab dem Tag des Vertragsschlusses.
            </p>
            <p className="text-sm mt-2">
              Um dein Widerrufsrecht auszuüben, musst du uns mittels einer eindeutigen Erklärung (z.&nbsp;B. per E-Mail) über
              deinen Entschluss, diesen Vertrag zu widerrufen, informieren:
            </p>
            <p className="text-sm mt-2 pl-4 border-l-2 border-border">
              Andre Meierholz<br />
              [Straße Hausnummer], [PLZ Ort]<br />
              E-Mail:{" "}
              <a href="mailto:support@myarea365.de" className="text-primary hover:underline">support@myarea365.de</a>
            </p>
            <p className="text-sm mt-2">
              Zur Wahrung der Widerrufsfrist reicht es aus, dass du die Mitteilung über die Ausübung des Widerrufsrechts
              vor Ablauf der Widerrufsfrist absendest.
            </p>
          </SubSection>

          <SubSection title="9.2 Folgen des Widerrufs">
            <p className="text-sm">
              Wenn du diesen Vertrag widerrufst, haben wir dir alle Zahlungen, die wir von dir erhalten haben, unverzüglich
              und spätestens binnen 14 Tagen ab dem Tag zurückzuzahlen, an dem die Mitteilung über deinen Widerruf bei uns
              eingegangen ist. Für die Rückzahlung verwenden wir dasselbe Zahlungsmittel, das du bei der ursprünglichen
              Transaktion eingesetzt hast, es sei denn, mit dir wurde ausdrücklich etwas anderes vereinbart.
            </p>
          </SubSection>

          <SubSection title="9.3 Vorzeitiges Erlöschen des Widerrufsrechts bei digitalen Inhalten">
            <p className="text-sm">
              Bei Verträgen über die Lieferung von digitalen Inhalten, die nicht auf einem körperlichen Datenträger
              geliefert werden (insbesondere <b className="text-text">Diamanten, Skins und sonstige virtuelle Güter</b>),
              erlischt das Widerrufsrecht nach § 356 Abs. 5 BGB, wenn:
            </p>
            <ul className="list-disc list-inside space-y-1 text-sm mt-2">
              <li>du ausdrücklich zugestimmt hast, dass wir mit der Ausführung vor Ablauf der Widerrufsfrist beginnen</li>
              <li>du deine Kenntnis davon bestätigt hast, dass durch deine Zustimmung mit Beginn der Ausführung dein Widerrufsrecht verloren geht</li>
              <li>wir dir eine Bestätigung des Vertrags und dieser Zustimmung zur Verfügung gestellt haben</li>
            </ul>
            <p className="text-sm mt-2">
              Beim Kauf von Diamanten und sonstigen Sofort-Freischaltungen holen wir diese Zustimmung im Bestellvorgang
              ein. Nach erfolgter Gutschrift ist ein Widerruf daher nicht mehr möglich.
            </p>
          </SubSection>

          <SubSection title="9.4 Muster-Widerrufsformular">
            <p className="text-sm">
              Wenn du den Vertrag widerrufen willst, kannst du dieses Formular verwenden (nicht erforderlich, aber zulässig):
            </p>
            <div className="mt-2 p-3 bg-black/20 border border-border rounded text-xs">
              An: Andre Meierholz, [Anschrift], support@myarea365.de<br />
              <br />
              Hiermit widerrufe(n) ich/wir (*) den von mir/uns (*) abgeschlossenen Vertrag über den Kauf der folgenden Waren
              (*) / die Erbringung der folgenden Dienstleistung (*):<br />
              <br />
              Bestellt am (*) / erhalten am (*):<br />
              Name des/der Verbraucher(s):<br />
              Anschrift des/der Verbraucher(s):<br />
              Unterschrift des/der Verbraucher(s) (nur bei Mitteilung auf Papier):<br />
              Datum:<br />
              <br />
              <span className="italic">(*) Unzutreffendes streichen.</span>
            </div>
          </SubSection>
        </Section>

        <Section num="10" title="Preise und Zahlungsbedingungen">
          <p className="text-sm">
            Alle Preise sind Bruttopreise inklusive gesetzlicher Umsatzsteuer und sonstiger Preisbestandteile nach
            Preisangabenverordnung (PAngV). Preisänderungen kündigen wir mindestens 4 Wochen vorher an; laufende Abos
            laufen zum ursprünglich vereinbarten Preis bis zum nächsten Verlängerungstermin weiter.
          </p>
          <p className="text-sm mt-2">
            Bei Zahlungsverzug behalten wir uns vor, Zusatzleistungen zu sperren und gesetzliche Verzugszinsen nach
            §§ 288, 286 BGB sowie angemessene Mahnkosten geltend zu machen.
          </p>
        </Section>

        <Section num="11" title="Nutzungsrechte an der Plattform">
          <p className="text-sm">
            Wir räumen dir für die Vertragsdauer ein einfaches, nicht übertragbares, nicht unterlizenzierbares Recht ein,
            den Dienst für den vertraglich vorgesehenen Zweck zu nutzen. Eine automatisierte oder systematische Abfrage
            (Scraping, Crawling) sowie Reverse Engineering sind untersagt, soweit keine zwingenden gesetzlichen Ausnahmen
            bestehen (§§ 69a ff. UrhG).
          </p>
        </Section>

        <Section num="12" title="Nutzungsrechte an deinen Inhalten">
          <p className="text-sm">
            An den von dir hochgeladenen oder erstellten Inhalten (Avatar, Banner, Crew-Beschreibung, Chat-Nachrichten,
            Shop-Vorschläge, Feedback) behältst du alle Rechte. Du räumst uns jedoch ein einfaches, zeitlich und räumlich
            unbeschränktes, unentgeltliches Nutzungsrecht ein, deine Inhalte
          </p>
          <ul className="list-disc list-inside space-y-1 text-sm mt-2">
            <li>im Rahmen des Dienstes zu speichern, anzuzeigen, zu vervielfältigen und an andere Nutzer zu übermitteln</li>
            <li>für technische Zwecke (Backups, Skalierung, Moderation) zu bearbeiten</li>
            <li>in anonymisierter oder aggregierter Form für Statistiken und Produktverbesserung zu nutzen</li>
          </ul>
          <p className="text-sm mt-2">
            Du versicherst, die erforderlichen Rechte an den Inhalten zu besitzen und keine Rechte Dritter zu verletzen.
            Bei Verstößen stellst du uns von Ansprüchen Dritter frei.
          </p>
        </Section>

        <Section num="13" title="Verhaltensregeln / Community-Guidelines">
          <p className="text-sm">Untersagt sind insbesondere:</p>
          <ul className="list-disc list-inside space-y-1 text-sm mt-2">
            <li>Manipulierte GPS-Daten, Fake-Routen, automatisierte Bewegung (Fahrzeug, Bot, Emulator)</li>
            <li>Mehrfach-Accounts oder die Umgehung einer Sperre mit einem neuen Konto</li>
            <li>Beleidigung, Hass, Diskriminierung, Belästigung oder Bedrohung anderer Nutzer</li>
            <li>Rechtswidrige, jugendgefährdende, pornografische oder urheberrechtsverletzende Inhalte</li>
            <li>Spam, kommerzielle Werbung ohne Zustimmung, Pyramidenspiele, Phishing</li>
            <li>Versuchte Umgehung technischer Beschränkungen (Rate-Limits, Anti-Cheat)</li>
            <li>Malware, Exploits, unbefugter Zugriff auf fremde Konten oder auf unsere Infrastruktur</li>
            <li>Kommerzielle Nutzung ohne ausdrückliche Zustimmung</li>
            <li>Handel mit Accounts, virtuellen Gütern oder In-Game-Vorteilen außerhalb des offiziellen Shops</li>
            <li>Preisgabe personenbezogener Daten Dritter</li>
          </ul>
          <p className="text-sm mt-3">
            <b className="text-text">Sicherheit geht vor:</b> Nimm im Straßenverkehr Rücksicht, halte die
            Straßenverkehrsordnung ein und lass dich nicht von der App ablenken. Du bist für deine Sicherheit selbst
            verantwortlich (siehe § 16).
          </p>
        </Section>

        <Section num="14" title="Konsequenzen bei Verstößen">
          <p className="text-sm">Je nach Schwere und Häufigkeit behalten wir uns folgende Maßnahmen vor:</p>
          <ul className="list-disc list-inside space-y-1 text-sm mt-2">
            <li>Warnung</li>
            <li>Löschen oder Ausblenden einzelner Inhalte</li>
            <li>Zurücksetzen unrechtmäßig erlangter virtueller Güter</li>
            <li>Vorübergehende Sperre des Kontos oder einzelner Funktionen</li>
            <li>Dauerhafte Sperre (Ban) bei schwerwiegenden Verstößen</li>
            <li>Kündigung des Nutzungsvertrags aus wichtigem Grund (§ 314 BGB)</li>
            <li>Einbehalt zu Unrecht erlangter Werte ohne Rückerstattung</li>
            <li>Strafanzeige bei rechtswidrigen Inhalten</li>
          </ul>
          <p className="text-sm mt-2">
            Vor dauerhaften Maßnahmen erhältst du grundsätzlich Gelegenheit zur Stellungnahme, sofern nicht Eilbedarf
            besteht.
          </p>
        </Section>

        <Section num="15" title="Beschwerdeverfahren, Melde- und Abhilfeverfahren (DSA)">
          <p className="text-sm">
            Als Anbieter eines Vermittlungs- und Hosting-Dienstes im Sinne der EU-Verordnung 2022/2065 (Digital Services
            Act) stellen wir folgende Verfahren bereit:
          </p>
          <ul className="list-disc list-inside space-y-1 text-sm mt-2">
            <li>
              <b className="text-text">Meldung rechtswidriger Inhalte</b> (Art. 16 DSA): formlose Meldung an{" "}
              <a href="mailto:support@myarea365.de" className="text-primary hover:underline">support@myarea365.de</a> oder
              über die In-App-Meldefunktion. Angaben: Inhalt/URL, Art der Rechtsverletzung, Kontaktdaten des Meldenden.
            </li>
            <li>
              <b className="text-text">Internes Beschwerdemanagement</b> (Art. 20 DSA): Betroffene können Moderationsentscheidungen
              innerhalb von 6 Monaten kostenfrei anfechten. Wir entscheiden binnen 14 Tagen.
            </li>
            <li>
              <b className="text-text">Außergerichtliche Streitbeilegung</b> (Art. 21 DSA): Du kannst dich an eine von der
              nationalen Aufsichtsbehörde zertifizierte außergerichtliche Streitbeilegungsstelle wenden.
            </li>
            <li>
              <b className="text-text">Vertrauenswürdige Hinweisgeber</b> (Art. 22 DSA): Meldungen anerkannter Trusted Flagger
              werden vorrangig bearbeitet.
            </li>
            <li>
              <b className="text-text">Transparenzberichte</b>: Wir veröffentlichen jährlich Angaben zu Moderationsentscheidungen
              und Nutzermeldungen.
            </li>
          </ul>
        </Section>

        <Section num="16" title="Haftung und Haftungsbeschränkung">
          <SubSection title="16.1 Allgemeines">
            <p className="text-sm">
              Wir haften unbeschränkt bei Vorsatz und grober Fahrlässigkeit, für schuldhaft verursachte Schäden an Leben,
              Körper oder Gesundheit, bei arglistig verschwiegenen Mängeln, bei Garantieübernahme und nach dem
              Produkthaftungsgesetz.
            </p>
          </SubSection>
          <SubSection title="16.2 Einfache Fahrlässigkeit">
            <p className="text-sm">
              Bei leicht fahrlässiger Verletzung einer wesentlichen Vertragspflicht (Kardinalpflicht) ist unsere Haftung
              auf den bei Vertragsschluss vorhersehbaren, vertragstypischen Schaden begrenzt. Für leicht fahrlässige
              Pflichtverletzungen außerhalb wesentlicher Vertragspflichten haften wir nicht.
            </p>
          </SubSection>
          <SubSection title="16.3 Haftungsausschluss für Lauf- und Geh-Aktivitäten">
            <p className="text-sm">
              <b className="text-text">Du nutzt die App auf eigene Gefahr</b>, insbesondere im öffentlichen Straßenraum.
              Für Stürze, Verletzungen, Unfälle, Verlust oder Beschädigung deines Geräts und sonstige Schäden, die durch
              deine Lauf- oder Geh-Aktivität entstehen, übernehmen wir keine Haftung, es sei denn, wir haben die Schäden
              schuldhaft verursacht.
            </p>
          </SubSection>
          <SubSection title="16.4 Haftung für Netzverfügbarkeit und Richtigkeit der Daten">
            <p className="text-sm">
              Wir bemühen uns um eine hohe Verfügbarkeit, garantieren diese aber nicht zu 100&nbsp;%. Wartungen und
              technische Störungen können zu Unterbrechungen führen. Kartendaten und Entfernungsberechnungen erfolgen
              nach bestem Wissen, können aber insbesondere bei schlechtem GPS-Empfang ungenau sein.
            </p>
          </SubSection>
          <SubSection title="16.5 Haftung für verlinkte externe Angebote">
            <p className="text-sm">
              Für Inhalte und Leistungen verlinkter Dritter (insbesondere Partner-Shops) haften wir nur, soweit uns
              positive Kenntnis von einer Rechtsverletzung vorliegt und wir eine Abhilfe unterlassen haben.
            </p>
          </SubSection>
        </Section>

        <Section num="17" title="Partner-Shops und Rabatt-Einlösungen">
          <p className="text-sm">
            Rabatte werden direkt vom jeweiligen Partner-Shop gewährt. <b className="text-text">Wir sind nicht
            Vertragspartner des Kaufvertrags zwischen dir und dem Shop</b>. Streitigkeiten über Warenqualität, Lieferung
            oder Gewährleistung klärst du direkt mit dem Shop.
          </p>
          <p className="text-sm mt-2">
            Wir prüfen Partner-Shops vor Aufnahme nach bestem Wissen, übernehmen jedoch keine Gewähr für deren
            Zuverlässigkeit oder Qualität. Bei Problemen kannst du einen Shop über die In-App-Funktion melden.
          </p>
        </Section>

        <Section num="18" title="Arena-Kämpfe und Saison-System">
          <p className="text-sm">
            Arena-Kämpfe sind virtuelle Gefechte zwischen Wächtern. Pro Tag stehen dir eine begrenzte Anzahl Gratis-Kämpfe
            sowie kostenpflichtige Zusatz-Kämpfe zur Verfügung. Die genauen Parameter (Anzahl, Kosten) können wir aus
            Balance-Gründen anpassen.
          </p>
          <p className="text-sm mt-2">
            Saisons laufen typischerweise über 90 Tage. Am Saison-Ende wird der Saison-Wächter archiviert, dein
            Ewiger Wächter bleibt erhalten. Items aus der Saison landen im Inventar. Prestige-Punkte und erspielte Titel
            werden dauerhaft deinem Profil gutgeschrieben. Details siehe{" "}
            <Link href="/datenschutz" className="text-primary hover:underline">Datenschutzerklärung</Link> und In-App-Informationen.
          </p>
        </Section>

        <Section num="19" title="Marken- und Urheberrechte">
          <p className="text-sm">
            Der Name &bdquo;MyArea365&ldquo;, das Logo, die Gestaltung, Grafiken, Wächter-Designs und sonstige geschützte
            Elemente sind urheber-, marken- und wettbewerbsrechtlich geschützt. Jede nicht ausdrücklich gestattete Nutzung
            ist unzulässig. Kurze Zitate zu Informations- oder Berichterstattungszwecken bleiben zulässig.
          </p>
        </Section>

        <Section num="20" title="Vertragslaufzeit und Kündigung">
          <SubSection title="20.1 Kostenloses Konto">
            <p className="text-sm">
              Der Vertrag über das kostenlose Konto läuft auf unbestimmte Zeit. Du kannst jederzeit ohne Angabe von
              Gründen kündigen, indem du dein Konto in den Einstellungen löschst oder uns eine entsprechende Nachricht
              zusendest. Wir können den Vertrag mit einer Frist von 30 Tagen zum Monatsende kündigen.
            </p>
          </SubSection>
          <SubSection title="20.2 Abonnements">
            <p className="text-sm">
              Laufende Abonnements kannst du jederzeit zum Ende des laufenden Abrechnungszeitraums kündigen. Nach
              § 312k BGB bieten wir hierzu einen gut sichtbaren Kündigungsbutton in deinen Kontoeinstellungen an
              (&bdquo;Jetzt kündigen&ldquo;). Die Kündigung wird mit Ende der bereits bezahlten Periode wirksam.
            </p>
          </SubSection>
          <SubSection title="20.3 Außerordentliche Kündigung">
            <p className="text-sm">
              Das Recht beider Parteien zur außerordentlichen Kündigung aus wichtigem Grund (§ 314 BGB) bleibt unberührt.
              Ein wichtiger Grund liegt für uns insbesondere bei schwerwiegenden oder wiederholten Verstößen gegen § 13 vor.
            </p>
          </SubSection>
          <SubSection title="20.4 Folgen der Kündigung">
            <p className="text-sm">
              Nach Kündigung wird dein Zugang gesperrt und das Konto nach einer Schonfrist von 14 Tagen gelöscht (Details
              siehe Datenschutzerklärung, Abschnitt &bdquo;Konto-Löschung&ldquo;). Virtuelle Güter verfallen ohne
              Ausgleichsanspruch, soweit nicht ein Widerrufsrecht greift oder eine schuldhafte Pflichtverletzung unsererseits
              vorliegt.
            </p>
          </SubSection>
        </Section>

        <Section num="21" title="Änderungen der AGB">
          <p className="text-sm">
            Wir sind berechtigt, diese AGB anzupassen, wenn dies aufgrund technischer Weiterentwicklungen, veränderter
            Rechtslage, Rechtsprechung oder aus wirtschaftlichen Gründen erforderlich ist und deine Rechte dadurch nicht
            unangemessen beeinträchtigt werden.
          </p>
          <p className="text-sm mt-2">
            Änderungen kündigen wir spätestens 6 Wochen vor Inkrafttreten per E-Mail oder In-App-Benachrichtigung an.
            Widersprichst du den Änderungen nicht innerhalb von 6 Wochen nach Zugang, gelten sie als genehmigt. Auf dieses
            Widerspruchsrecht weisen wir in der Mitteilung gesondert hin. Widersprichst du, bleibt es bei den bisherigen
            Bedingungen; wir behalten uns jedoch eine ordentliche Kündigung nach § 20.1 vor.
          </p>
        </Section>

        <Section num="22" title="Datenschutz">
          <p className="text-sm">
            Informationen zur Verarbeitung personenbezogener Daten findest du in unserer{" "}
            <Link href="/datenschutz" className="text-primary hover:underline">Datenschutzerklärung</Link>. Diese ist
            Bestandteil der vertraglichen Grundlage.
          </p>
        </Section>

        <Section num="23" title="Ergänzende Bestimmungen für Partner-Shops (B2B)">
          <p className="text-sm">
            Für Partner-Shops gelten neben diesen AGB die individuell vereinbarten Geschäftsbedingungen (Pay-per-Visit,
            Territory-Bonus, Shop-Quests). Gegenüber Unternehmern gilt bezüglich Gerichtsstand und Erfüllungsort
            ausschließlich Berlin. § 312i BGB findet gegenüber Unternehmern keine Anwendung.
          </p>
          <p className="text-sm mt-2">
            Pflichten des Partner-Shops umfassen insbesondere:
          </p>
          <ul className="list-disc list-inside space-y-1 text-sm mt-2">
            <li>Wahrheitsgemäße Angabe von Shop-Daten, Öffnungszeiten und Deals</li>
            <li>Einhaltung aller verbraucherrechtlichen Vorgaben gegenüber Endkunden</li>
            <li>Annahme der eingelösten Deals zu den angegebenen Konditionen</li>
            <li>Diskriminierungsfreie Behandlung der Runner</li>
          </ul>
        </Section>

        <Section num="24" title="Höhere Gewalt">
          <p className="text-sm">
            Keine Partei ist für die Nichterfüllung vertraglicher Pflichten verantwortlich, wenn diese auf höherer Gewalt
            beruht (Krieg, Streik, Naturkatastrophen, Pandemien, behördliche Anordnungen, weiträumige Internet-Ausfälle).
            Die betroffene Partei informiert die andere unverzüglich.
          </p>
        </Section>

        <Section num="25" title="Abtretung und Vertragsübernahme">
          <p className="text-sm">
            Deine Rechte und Pflichten aus diesem Vertrag kannst du nur mit unserer schriftlichen Zustimmung auf Dritte
            übertragen. Wir sind berechtigt, den Vertrag auf ein verbundenes Unternehmen zu übertragen; dir steht in
            diesem Fall ein Sonderkündigungsrecht zu.
          </p>
        </Section>

        <Section num="26" title="Barrierefreiheit">
          <p className="text-sm">
            Wir streben eine möglichst barrierefreie Gestaltung unseres Dienstes gemäß Barrierefreiheitsstärkungsgesetz
            (BFSG) und den WCAG 2.2-Kriterien an. Hinweise auf Barrieren nehmen wir gerne entgegen unter{" "}
            <a href="mailto:support@myarea365.de" className="text-primary hover:underline">support@myarea365.de</a>.
          </p>
        </Section>

        <Section num="27" title="Online-Streitbeilegung und Verbraucherschlichtung">
          <p className="text-sm">
            Die Europäische Kommission stellt eine Plattform zur Online-Streitbeilegung bereit:{" "}
            <a href="https://ec.europa.eu/consumers/odr/" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
              ec.europa.eu/consumers/odr
            </a>. Zur Teilnahme an einem Streitbeilegungsverfahren vor einer Verbraucherschlichtungsstelle sind wir weder
            bereit noch verpflichtet.
          </p>
        </Section>

        <Section num="28" title="Anwendbares Recht und Gerichtsstand">
          <p className="text-sm">
            Es gilt das Recht der Bundesrepublik Deutschland unter Ausschluss des UN-Kaufrechts. Die Rechtswahl gilt
            gegenüber Verbrauchern nur insoweit, als nicht zwingende Verbraucherschutz­vorschriften des Staates, in dem
            der Verbraucher seinen gewöhnlichen Aufenthalt hat, entgegenstehen (Art. 6 Abs. 2 Rom-I-VO).
          </p>
          <p className="text-sm mt-2">
            Gerichtsstand für Streitigkeiten mit Unternehmern und Personen ohne allgemeinen Gerichtsstand in Deutschland
            ist Berlin. Verbraucher können Ansprüche auch an ihrem Wohnsitz geltend machen.
          </p>
        </Section>

        <Section num="29" title="Sprache und maßgebliche Fassung">
          <p className="text-sm">
            Vertragssprache ist Deutsch. Sollten wir Übersetzungen dieser AGB anbieten, dient dies der Information; bei
            Abweichungen ist die deutsche Fassung maßgeblich.
          </p>
        </Section>

        <Section num="30" title="Schlussbestimmungen">
          <p className="text-sm">
            Mündliche Nebenabreden bestehen nicht. Änderungen und Ergänzungen dieser AGB bedürfen der Textform; dies gilt
            auch für den Verzicht auf das Textformerfordernis.
          </p>
          <p className="text-sm mt-2">
            <b className="text-text">Salvatorische Klausel:</b> Sollte eine Bestimmung dieser AGB unwirksam oder
            undurchführbar sein oder werden, bleibt die Wirksamkeit der übrigen Bestimmungen unberührt. Anstelle der
            unwirksamen Bestimmung tritt die gesetzliche Regelung bzw. eine Regelung, die dem wirtschaftlichen Zweck
            der unwirksamen Bestimmung möglichst nahekommt.
          </p>
        </Section>

        <section className="text-xs pt-4 border-t border-border italic">
          Diese Nutzungsbedingungen wurden unter Berücksichtigung der einschlägigen Vorschriften (BGB, UWG, TMG, TTDSG,
          DSGVO, PAngV, ZAG, DSA, JMStV, BFSG) erstellt. Vor dem Produktiv-Launch empfehlen wir eine abschließende
          rechtsanwaltliche Prüfung, insbesondere bei Hinzukommen neuer Leistungen oder Einführung neuer Zahlungsmodelle.
          Frühere Fassungen stellen wir auf Anfrage zur Verfügung.
        </section>
      </div>
    </div>
  );
}

function Section({ num, title, children }: { num: string; title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="text-lg font-bold text-text mb-2">§ {num} {title}</h2>
      <div className="text-sm">{children}</div>
    </section>
  );
}

function SubSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mt-4">
      <h3 className="font-bold text-text text-sm mb-1">{title}</h3>
      {children}
    </div>
  );
}
