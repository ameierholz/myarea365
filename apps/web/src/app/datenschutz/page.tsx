import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Datenschutzerklärung",
  description: "Datenschutzerklärung von MyArea365 – DSGVO, TDDDG, CCPA, UK-GDPR, FADP, LGPD.",
};

export default function DatenschutzPage() {
  return (
    <div className="min-h-screen px-4 py-10 max-w-3xl mx-auto">
      <Link href="/" className="text-sm text-primary hover:underline">← Zurück</Link>
      <h1 className="text-3xl font-bold mt-6 mb-2">Datenschutzerklärung</h1>
      <p className="text-xs text-text-muted mb-8">
        Stand: {new Date().toLocaleDateString("de-DE", { day: "2-digit", month: "long", year: "numeric" })}
      </p>

      <div className="space-y-8 text-text-muted leading-relaxed">

        <section>
          <p className="text-sm">
            Diese Datenschutzerklärung informiert dich gemäß Artikel 13 und 14 der Datenschutz-Grundverordnung (DSGVO) und
            äquivalenten internationalen Regelungen (UK-GDPR, Schweizer FADP, Kalifornische CCPA/CPRA, Brasilianische
            LGPD, Kanadische PIPEDA) über die Verarbeitung personenbezogener Daten, wenn du unsere Website{" "}
            <b className="text-text">myarea365.de</b> sowie die zugehörige Web-App und mobile App (zusammen &bdquo;Dienst&ldquo;)
            nutzt.
          </p>
        </section>

        <Section num="1" title="Verantwortlicher">
          <p>
            Verantwortlicher im Sinne der DSGVO, Controller im Sinne der UK-GDPR, Verantwortlicher gemäß FADP, Business im
            Sinne des CCPA und Controlador gemäß LGPD ist:
          </p>
          <p className="mt-2">
            Andre Meierholz<br />
            Kolonnenstr. 8<br />
            10827 Berlin<br />
            Deutschland<br />
            E-Mail:{" "}
            <a href="mailto:support@myarea365.de" className="text-primary hover:underline">
              support@myarea365.de
            </a>
          </p>
          <p className="text-xs mt-2 italic">
            Vollständiges Impressum siehe <Link href="/impressum" className="text-primary hover:underline">/impressum</Link>.
          </p>
        </Section>

        <Section num="2" title="Kontakt für Datenschutzanfragen">
          <p>
            Einen Datenschutzbeauftragten haben wir gemäß § 38 BDSG nicht bestellt, da die gesetzlichen Voraussetzungen
            hierfür nicht vorliegen. Für alle Anliegen rund um den Datenschutz &ndash; insbesondere die Ausübung deiner
            Betroffenenrechte (siehe Abschnitt 14) &ndash; erreichst du uns per E-Mail unter{" "}
            <a href="mailto:support@myarea365.de" className="text-primary hover:underline">support@myarea365.de</a>.
            Anfragen beantworten wir binnen 30 Tagen (DSGVO) bzw. 45 Tagen (CCPA/LGPD).
          </p>
        </Section>

        <Section num="3" title="Rechtsgrundlagen der Verarbeitung">
          <p>Wir verarbeiten personenbezogene Daten auf folgenden Rechtsgrundlagen:</p>
          <ul className="list-disc list-inside space-y-1 text-sm mt-2">
            <li>
              <b className="text-text">Art. 6 Abs. 1 lit. a DSGVO</b> &ndash; Einwilligung (Newsletter, Push-Nachrichten,
              Standort-Freigabe, optionale Analyse-Cookies, Marketing-Kommunikation)
            </li>
            <li>
              <b className="text-text">Art. 6 Abs. 1 lit. b DSGVO</b> &ndash; Vertragserfüllung oder vorvertragliche
              Maßnahmen (Nutzerkonto, Gamification, Deal-Einlösungen, Zahlungsabwicklung)
            </li>
            <li>
              <b className="text-text">Art. 6 Abs. 1 lit. c DSGVO</b> &ndash; rechtliche Verpflichtung (handels- und
              steuerrechtliche Aufbewahrungspflichten, Meldepflichten nach § 146a AO, Geldwäschegesetz)
            </li>
            <li>
              <b className="text-text">Art. 6 Abs. 1 lit. f DSGVO</b> &ndash; berechtigtes Interesse (IT-Sicherheit,
              Missbrauchs­prävention, Fehleranalyse, Qualitätsverbesserung des Dienstes)
            </li>
            <li>
              <b className="text-text">Art. 9 Abs. 2 lit. a DSGVO</b> &ndash; ausdrückliche Einwilligung, falls wir besondere
              Kategorien personenbezogener Daten verarbeiten (z.&nbsp;B. Gesundheitsdaten aus Bewegungsprofilen in
              aggregierter Form &ndash; nur mit deiner Zustimmung)
            </li>
            <li>
              <b className="text-text">§ 25 TDDDG</b> (seit 14.&nbsp;Mai 2024 Nachfolger des TTDSG) &ndash; Speichern von
              und Zugriff auf Informationen auf Endeinrichtungen (Cookies, LocalStorage)
            </li>
          </ul>
        </Section>

        <Section num="4" title="Konkret: Welche Daten wir speichern und tracken">
          <p className="mb-4">
            Nachfolgend findest du ein vollständiges Verzeichnis aller personenbezogenen Datenfelder, die in unseren
            Systemen gespeichert oder verarbeitet werden. Wir halten uns an das Prinzip der Datenminimierung (Art. 5 Abs. 1
            lit. c DSGVO) und erheben keine Daten &bdquo;auf Vorrat&ldquo;.
          </p>

          <SubSection title="4.1 Konto- und Profil-Daten">
            <DataList items={[
              "E-Mail-Adresse (Login-Identifier, Kommunikation)",
              "Benutzername (öffentlicher Identifier)",
              "Anzeigename (freier Textname)",
              "Passwort als Salted-Hash (niemals im Klartext; Argon2/bcrypt)",
              "Rollen-/Berechtigungs-Flag (user, support, marketing, sales, admin)",
              "Ban-Status und ggf. Sperrgrund",
              "Fraktions-Zugehörigkeit (Kronenwacht oder Gossenbund)",
              "Klasse und Rolle des aktiven Wächters (Tank/Support/Fernkampf/Nahkampf + Sub-Archetyp)",
              "Heimat-PLZ (optional, 5-stellig, für Kiez-Features)",
              "Aktuelle Crew-Zugehörigkeit (Fremdschlüssel auf Crew)",
              "Avatar-URL (selbst hochgeladen, nach Moderation öffentlich)",
              "Banner-URL (selbst hochgeladen, nach Moderation öffentlich)",
              "Spielerstatistik: Level, Gesamt-XP, Gesamt-Distanz, Anzahl Läufe",
              "Gewählte Sprache, Team-Farbe, Profil-Lore-Text",
              "Zeitstempel: Registrierung, letzte Aktivität",
              "Grobstandort: Land, Stadt (wenn freiwillig im Profil angegeben)",
            ]} />
            <p className="text-xs mt-2">Rechtsgrundlage: Art. 6 Abs. 1 lit. b DSGVO.</p>
          </SubSection>

          <SubSection title="4.2 Standort- und Bewegungsdaten">
            <DataList items={[
              "GPS-Koordinaten (Breite, Länge, Höhe, Genauigkeit) während aktiver Lauf-Session",
              "Zeitstempel jedes GPS-Punkts",
              "Berechnete Geschwindigkeit und Distanz zwischen Punkten",
              "Zuordnung der Punkte zu Straßen-Segmenten (Snap-to-road)",
              "Zurückgelegter Track als Geometrie-Objekt (PostGIS)",
              "Eroberte Gebiete als Polygon-Geometrie",
              "Zeitstempel der Gebiets-Eroberung und vergebene XP",
            ]} />
            <p className="text-xs mt-2">
              Erfassung ausschließlich während aktiver Lauf-Session, nur nach ausdrücklicher Freigabe durch Browser oder
              Betriebssystem. Im Hintergrund werden keine Standortdaten gesammelt. Rechtsgrundlage: Art. 6 Abs. 1 lit. a
              und lit. b DSGVO.
            </p>
          </SubSection>

          <SubSection title="4.3 Gamification-, Wächter- und Spielstands-Daten">
            <DataList items={[
              "Liste deiner Wächter-Archetypen, Level, Wegemünzen, Siege, Niederlagen, Wunden-Status",
              "Talent-Punkte, Fähigkeits-Level, investierte Punkte je Knoten",
              "Ausrüstungs-Inventar: Items, Slot, Rarität, Upgrade-Stufe, erhaltene Materialien (Schrott, Kristall, Essenz, Relikt-Splitter)",
              "Teilnahme an Arena-Saisons und finaler Platzierung",
              "Prestige-Historie: Punkte, Titel, Rang pro abgeschlossener Saison",
              "Erspielte Siegel (Tank, Support, Fernkampf, Nahkampf, Universal)",
              "Streak-Zähler (aufeinanderfolgende Tage mit Aktivität)",
              "Täglich-limitierte Aktionen (Arena-Kampf-Counter, Daily Deals)",
              "Wertung / Elo-Rating (Ranked-Modus), Peak-Wertung, Sieg/Niederlage-Historie",
            ]} />
            <p className="text-xs mt-2">Rechtsgrundlage: Art. 6 Abs. 1 lit. b DSGVO.</p>
          </SubSection>

          <SubSection title="4.4 Arena-Kämpfe (PvP-Gefechte)">
            <DataList items={[
              "Identifier Angreifer, Verteidiger, Gewinner",
              "Gesetzte Diamanten (kostenpflichtige Kämpfe nach Tagesquote)",
              "Runden-Protokoll mit Aktionen, Schadenswerten, Kritischen Treffern",
              "Seed für deterministische Kampf-Reproduktion",
              "Zeitstempel des Kampfes und zugeordnete Saison",
              "Wertungs-Änderung (Delta) für Angreifer und Verteidiger",
            ]} />
            <p className="text-xs mt-2">Rechtsgrundlage: Art. 6 Abs. 1 lit. b DSGVO.</p>
          </SubSection>

          <SubSection title="4.5 Crew-Daten und Kommunikation">
            <DataList items={[
              "Crew-Name, Crew-Farbe, Crew-Emblem, Motto",
              "Mitgliedschaft: wer ist Mitglied, Rolle (Mitglied, Admin)",
              "Offene und angenommene Einladungen",
              "Chat-Nachrichten innerhalb der Crew: Inhalt, Absender, Zeitstempel",
              "Crew-Events, Feed-Posts, Challenges",
            ]} />
            <p className="text-xs mt-2">
              Chat-Nachrichten sind nur für Crew-Mitglieder sichtbar und werden serverseitig zur Moderation gespeichert.
              Rechtsgrundlage: Art. 6 Abs. 1 lit. b DSGVO.
            </p>
          </SubSection>

          <SubSection title="4.6 Partner-Shop-Check-ins und Deal-Einlösungen">
            <DataList items={[
              "Zeitpunkt des Check-ins",
              "Partner-Shop-ID und eingelöster Deal",
              "QR-Code-ID (bei Scan)",
              "Hochgeladener Kassenbeleg (nur bei Bonus-Loot-Aktionen, kurzzeitig)",
              "Durch OCR erkannter Rechnungsbetrag",
              "Flag &bdquo;Beleg verifiziert&ldquo; (nach automatischer Prüfung)",
            ]} />
            <p className="text-xs mt-2">
              Der Shop-Betreiber sieht nur deinen anonymen Runner-Namen und die Tatsache der Einlösung &ndash; keine
              E-Mail, keinen Klarnamen, keine Profildaten. Belegbilder werden nach der OCR-Prüfung innerhalb von 7 Tagen
              gelöscht. Rechtsgrundlage: Art. 6 Abs. 1 lit. b DSGVO.
            </p>
          </SubSection>

          <SubSection title="4.7 Zahlungsdaten">
            <DataList items={[
              "Kaufhistorie: Zeitstempel, Produktnummer (SKU), Betrag, Währung",
              "Wegemünzen- und Diamanten-Salden sowie Transaktionen (Gutschrift, Verbrauch, Grund)",
              "Zahlungs-Provider-Referenz (Stripe Payment Intent, Checkout-Session-ID)",
              "Abonnement-Status und Verlängerungs-Termine (MyArea+, Supporter-Badges Bronze/Silber/Gold, Crew-Pro, Shop-Pakete, Arena-Pass)",
              "Supporter-Tier (bronze / silver / gold) sofern ein entsprechendes Abo aktiv ist",
              "Rechnungs- und Belegdaten gemäß §§ 14, 14a UStG",
            ]} />
            <p className="text-xs mt-2">
              Kreditkartennummern, Bankdaten und vollständige Zahlungs­mittelidentifikation erhalten wir nicht &ndash;
              diese verbleiben beim Zahlungsdienstleister. Rechtsgrundlage: Art. 6 Abs. 1 lit. b und lit. c DSGVO.
            </p>
          </SubSection>

          <SubSection title="4.8 Support-Anfragen und Tickets">
            <DataList items={[
              "E-Mail-Adresse und Name (soweit angegeben)",
              "Anfragen-Text und alle Folgekommunikation",
              "Interne Notizen des Support-Teams",
              "Status, Priorität, Kategorie, Zuweisung zu Mitarbeiter",
              "Quelle der Anfrage (Kontaktformular, E-Mail, In-App)",
              "User-Agent des Browsers, falls verfügbar",
            ]} />
            <p className="text-xs mt-2">Rechtsgrundlage: Art. 6 Abs. 1 lit. b bzw. lit. f DSGVO.</p>
          </SubSection>

          <SubSection title="4.9 Benutzer-Uploads und KI-Moderation">
            <DataList items={[
              "Hochgeladenes Bild (Avatar, Banner, Artwork-Entwürfe)",
              "Hochgeladener Beleg (Kassenbon für Bonus-Loot)",
              "Prüfergebnis (akzeptiert, abgelehnt, Begründung)",
              "Zeitstempel der Prüfung und geprüftes Modell (KI-Dienst)",
            ]} />
            <p className="text-xs mt-2">
              Uploads werden vor der Veröffentlichung automatisiert auf verbotene Inhalte geprüft (siehe Abschnitt 5).
              Abgelehnte Uploads werden 30 Tage zur Revision vorgehalten, danach gelöscht.
              Rechtsgrundlage: Art. 6 Abs. 1 lit. f DSGVO.
            </p>
          </SubSection>

          <SubSection title="4.10 Technische Daten und Server-Logs">
            <DataList items={[
              "IP-Adresse (nach 7 Tagen durch Kürzung der letzten 8 Bits anonymisiert)",
              "User-Agent (Browser-Typ und Version)",
              "Betriebssystem und Version",
              "Referrer-URL (woher der Besuch kam)",
              "Aufgerufene URL und HTTP-Status-Code",
              "Zeitpunkt des Zugriffs und Antwortzeit",
              "Gerätetyp (Desktop, Mobil, Tablet)",
              "App-Version (nur mobile App)",
              "Gerätesprache",
            ]} />
            <p className="text-xs mt-2">
              Technische Daten sind erforderlich, um den Dienst bereitzustellen und Missbrauch abzuwehren.
              Rechtsgrundlage: Art. 6 Abs. 1 lit. f DSGVO.
            </p>
          </SubSection>

          <SubSection title="4.11 Marketing, Push und In-App-Nachrichten">
            <DataList items={[
              "E-Mail-Adresse für Newsletter (nur bei Opt-in)",
              "Push-Token des Geräts für mobile Push-Nachrichten (nur bei Opt-in)",
              "Versand-Statistiken: zugestellt, geöffnet, geklickt, zurückgewiesen",
              "Einwilligungs-Nachweis: Zeitstempel, IP, Version des Consent-Texts",
              "Segment-Zuordnung für gezielte Kampagnen (Fraktion, Land, Level)",
              "In-App-Postfach: Broadcast-ID, Lesedatum",
            ]} />
            <p className="text-xs mt-2">
              Rechtsgrundlage: Art. 6 Abs. 1 lit. a DSGVO. Widerruf jederzeit über den Abmeldelink, die
              Benachrichtigungs-Einstellungen oder den Betriebssystem-Dialog möglich.
            </p>
          </SubSection>

          <SubSection title="4.12 A/B-Tests und Experimente">
            <p className="text-xs">
              A/B-Tests sind <b>derzeit nicht aktiv</b>. Die App-Infrastruktur (Tabelle
              <code>experiment_assignments</code>) ist für den späteren Einsatz vorbereitet.
              Sobald Experimente aktiviert werden, erfolgt eine Aktualisierung dieser
              Datenschutzerklärung. Zuweisungen wären dann pseudonymisiert auf Basis der
              Benutzer-ID.
            </p>
          </SubSection>

          <SubSection title="4.13 Moderations- und Melde-System">
            <DataList items={[
              "Gemeldeter Inhalt oder Benutzer, Meldegrund",
              "ID des Melders, Zeitstempel",
              "Prüfungsstatus, Entscheidung, interne Notiz",
            ]} />
            <p className="text-xs mt-2">
              Meldungen werden 24 Monate aufbewahrt, um Wiederholungsfälle zu erkennen.
              Rechtsgrundlage: Art. 6 Abs. 1 lit. f DSGVO.
            </p>
          </SubSection>

          <SubSection title="4.14 Admin-Audit-Log">
            <DataList items={[
              "Zeitstempel jeder administrativen Handlung",
              "ID und Rolle des Staff-Mitglieds",
              "Art der Handlung (z.&nbsp;B. Nutzer-Sperrung, Datenexport, Impersonation)",
              "Ziel-Objekt und relevante Metadaten",
            ]} />
            <p className="text-xs mt-2">
              Das Audit-Log dient der Nachvollziehbarkeit und Sicherheit. Auf dich bezogene Einträge kannst du im Rahmen
              deines Auskunftsrechts erhalten. Rechtsgrundlage: Art. 6 Abs. 1 lit. c und lit. f DSGVO.
            </p>
          </SubSection>

          <SubSection title="4.15 Öffentlich sichtbare Inhalte">
            <DataList items={[
              "Benutzername, Anzeigename, Avatar, Banner",
              "Level, Fraktion, Crew-Zugehörigkeit",
              "Position in Ranglisten (weltweit, nach Region, nach Kategorie)",
              "Prestige-Titel aus abgeschlossenen Saisons (Hall-of-Fame)",
              "Erspielte Siegel und Achievements",
              "Aktive Wächter-Auswahl im öffentlichen Profil",
              "Aggregierte Heatmap deiner Laufaktivität (nur auf Straßen-Ebene, nicht personenzuordenbar)",
            ]} />
            <p className="text-xs mt-2">
              Du kannst in den Profil-Einstellungen festlegen, welche dieser Daten öffentlich sichtbar sein sollen.
              Chat-Nachrichten, E-Mail-Adresse, genaue GPS-Tracks, Zahlungsdaten und Support-Tickets sind niemals öffentlich.
            </p>
          </SubSection>

          <SubSection title="4.16 Einladungen und Sharing">
            <DataList items={[
              "Einladungs-Codes für Crews (enthält Crew-ID, ablaufendes Token)",
              "Share-Link zu deinem Profil (/u/[username]) mit generierter Share-Karte",
              "UTM-Parameter aus geteilten Links zur Erfolgsmessung von Kampagnen",
              "Empfänger-E-Mail bei Freunde-Einladung (nur einmalig verwendet, nicht gespeichert)",
            ]} />
            <p className="text-xs mt-2">
              Wenn du einen Freund per E-Mail einlädst, speichern wir dessen Adresse nicht dauerhaft; sie wird ausschließlich
              zum Versand der Einladung verwendet und danach verworfen. Rechtsgrundlage: Art. 6 Abs. 1 lit. f DSGVO.
            </p>
          </SubSection>

          <SubSection title="4.17 Beta-Programme und Feedback">
            <DataList items={[
              "Teilnahme-Status an Beta-Features",
              "Feedback-Formular-Einträge inkl. Text, Bewertung, Kontext (URL, User-Agent)",
            ]} />
            <p className="text-xs mt-2">
              Feedback wird 24 Monate aufbewahrt. Rechtsgrundlage: Art. 6 Abs. 1 lit. f DSGVO.
              Automatisiertes Crash-Reporting ist <b>derzeit nicht aktiv</b>; sobald eingeführt, wird diese Erklärung aktualisiert.
            </p>
          </SubSection>

          <SubSection title="4.18 Partner-Shop-Vorschläge durch Nutzer">
            <p className="text-sm">
              Wenn du einen neuen Partner-Shop vorschlägst, speichern wir die Shop-Informationen (Name, Adresse, Kategorie)
              sowie deine ID als Vorschlagsgeber zur Rücksprache. Dein Name wird dem Shop-Betreiber nicht übermittelt.
            </p>
            <p className="text-xs mt-2">
              Vorschläge werden bis zur Prüfung und dann 12 Monate als Referenz gespeichert.
              Rechtsgrundlage: Art. 6 Abs. 1 lit. f DSGVO.
            </p>
          </SubSection>

          <SubSection title="4.19 Telemetrie und Performance-Monitoring">
            <p className="text-sm">
              Aktuell ist <b>keine aktive Telemetrie</b> (kein Sentry, kein Analytics-Dienst) integriert.
              Vercel Speed Insights und Vercel Analytics sind technisch vorbereitet, aber im Dashboard
              nicht aktiviert. Vor einer Aktivierung erfolgt eine Aktualisierung dieser Erklärung und
              — sofern personenbezogene Daten verarbeitet werden — eine Einwilligung über das
              Consent-Banner.
            </p>
          </SubSection>

          <SubSection title="4.20 Anti-Cheat und Missbrauchserkennung">
            <DataList items={[
              "Auffällige Geschwindigkeits-Werte (z.&nbsp;B. Teleportation, Fahrzeug-Erkennung)",
              "Muster mehrfacher Registrierungen vom selben Gerät",
              "Auffälliges Kampf-Verhalten (Bot-Verdacht)",
              "Rate-Limit-Überschreitungen und Drosselung",
              "Verdachtsfälle mit Zeitstempel, Grund und Reaktion",
            ]} />
            <p className="text-xs mt-2">
              Anti-Cheat-Logs werden 24 Monate aufbewahrt, um wiederkehrende Muster zu erkennen.
              Rechtsgrundlage: Art. 6 Abs. 1 lit. f DSGVO (Schutz der Integrität des Dienstes).
            </p>
          </SubSection>

          <SubSection title="4.21 Chat- und Inhalts-Moderation">
            <DataList items={[
              "Automatische Wortfilter für bekannte verbotene Begriffe",
              "KI-gestützte Moderation für hochgeladene Bilder (Anthropic Claude)",
              "Nutzer-Meldungen mit Grund und Zeitstempel",
              "Moderations-Entscheidungen (Warnung, Löschung, Sperre) mit Begründung",
            ]} />
            <p className="text-xs mt-2">
              Moderations-Protokolle werden 24 Monate aufbewahrt. Rechtsgrundlage: Art. 6 Abs. 1 lit. f DSGVO (Schutz der
              Community und Einhaltung gesetzlicher Vorgaben, insb. EU-Verordnung 2022/2065 &bdquo;Digital Services Act&ldquo;).
            </p>
          </SubSection>

          <SubSection title="4.22 Werbung (Google AdSense / AdMob)">
            <p className="text-sm">
              Teile des kostenlosen Dienstes finanzieren wir durch Werbung von <b className="text-text">Google Ireland Ltd.</b>
              {" "}(AdSense im Web, AdMob in der mobilen App). Eine Ausspielung personalisierter Werbung erfolgt{" "}
              <b className="text-text">nur nach ausdrücklicher Einwilligung</b> über unser Consent-Management
              (Google User Messaging Platform, UMP). Ohne Einwilligung werden ausschließlich nicht-personalisierte
              Anzeigen ausgeliefert.
            </p>
            <p className="text-sm mt-2">
              Google verarbeitet dabei ggf. IP-Adresse, Gerätekennung, ungefähren Standort und Interaktionsdaten.
              Näheres: <a href="https://policies.google.com/privacy" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">policies.google.com/privacy</a>.
              Werbeeinstellungen ändern: <a href="https://adssettings.google.com/" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">adssettings.google.com</a>.
            </p>
            <p className="text-sm mt-2">
              Nutzer mit aktivem <b className="text-text">MyArea+</b>- oder <b className="text-text">Supporter-Badge</b>-Abo
              sehen keine oder nur reduzierte Werbung, soweit technisch umsetzbar.
            </p>
            <p className="text-xs mt-2">
              Rechtsgrundlage: Art. 6 Abs. 1 lit. a DSGVO, § 25 Abs. 1 TDDDG (Einwilligung für Cookies/Device-ID) sowie
              Art. 6 Abs. 1 lit. f DSGVO (Refinanzierung des Dienstes bei nicht-personalisierter Werbung).
            </p>
          </SubSection>

          <SubSection title="4.23 Was wir NICHT tracken">
            <DataList items={[
              "Keine geräteübergreifenden Werbe-Cookies oder -Pixel ohne Einwilligung",
              "Keine Fingerprint-Analyse (Canvas, WebGL, Audio)",
              "Kein Weiterverkauf deiner Daten an Dritte",
              "Keine Profile für Drittanbieter-Werbung ohne Einwilligung",
              "Keine Standortdaten außerhalb aktiver Lauf-Sessions",
              "Kein Zugriff auf Kontakte, Kalender, Fotos oder Dateien auf deinem Gerät",
              "Keine biometrischen Daten (Gesichtserkennung, Stimmanalyse)",
              "Keine Beobachtung von Apps Dritter oder Browser-Historie",
              "Kein Hintergrund-Sammeln bei geschlossener App",
              "Kein Verkauf oder Austausch von E-Mail-Listen",
            ]} />
          </SubSection>
        </Section>

        <Section num="5" title="Automatisierte Entscheidungsfindung und Profiling">
          <p>
            Der Dienst bildet aus deinen Aktivitäten (Läufe, Kämpfe, Einlösungen) Kennzahlen wie Level, Prestige,
            Ranglisten und Arena-Matchmaking. Dies stellt <i>Profiling</i> im Sinne von Art. 4 Nr. 4 DSGVO dar, entfaltet
            aber keine rechtliche Wirkung gegenüber dir und keine vergleichbare erhebliche Beeinträchtigung.
          </p>
          <p className="mt-2 text-sm">
            Bei Bild-Uploads und Beleg-Scans kommt ein automatisches Prüfsystem zum Einsatz (Modell <i>Anthropic Claude</i>).
            Abgelehnte Inhalte kannst du per Support-Ticket zur manuellen Überprüfung eskalieren. Eine ausschließlich
            automatisierte Entscheidung im Sinne von Art. 22 DSGVO mit rechtlicher Wirkung findet nicht statt.
          </p>
        </Section>

        <Section num="6" title="Empfänger und Auftragsverarbeiter">
          <p>
            Wir nutzen folgende Dienstleister auf Grundlage von Vereinbarungen gemäß Art. 28 DSGVO. Für Datenübermittlungen
            in Drittländer setzen wir die EU-Standardvertragsklauseln (SCCs) und zusätzliche technische Maßnahmen ein.
          </p>
          <div className="overflow-x-auto mt-3">
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="border-b border-border text-text">
                  <th className="text-left py-2 pr-2 font-bold">Dienst</th>
                  <th className="text-left py-2 pr-2 font-bold">Zweck</th>
                  <th className="text-left py-2 font-bold">Standort / Garantien</th>
                </tr>
              </thead>
              <tbody>
                <Row d="Supabase Inc." z="Authentifizierung, Datenbank, Dateispeicher" l="EU (Frankfurt, eu-central-1)" />
                <Row d="Vercel Inc." z="Hosting, CDN, Edge-Functions" l="EU (fra1, Frankfurt)" />
                <Row d="Mapbox Inc." z="Kartendarstellung, Geocoding, Snap-to-Road" l="USA &ndash; SCCs + DPF" />
                <Row d="Resend Inc." z="Transaktions- und Newsletter-E-Mails" l="USA &ndash; SCCs + DPF" />
                <Row d="Anthropic PBC" z="KI-Moderation und Beleg-Erkennung" l="USA &ndash; SCCs; Zero-Retention gem. Anbieter-Richtlinie, DPA in Abschluss" />
                <Row d="Stripe Payments Europe Ltd." z="Zahlungsabwicklung" l="EU (Irland) &ndash; US-Sublieferanten mit SCCs" />
                <Row d="Apple Push Notification Service" z="Push-Nachrichten (iOS)" l="USA &ndash; SCCs" />
                <Row d="Google Firebase Cloud Messaging" z="Push-Nachrichten (Android, Web)" l="USA &ndash; SCCs + DPF" />
                <Row d="Google AdSense" z="Werbeanzeigen im Web (nur bei Einwilligung)" l="USA &ndash; SCCs + DPF" />
                <Row d="Google AdMob" z="Werbeanzeigen in der mobilen App (nur bei Einwilligung)" l="USA &ndash; SCCs + DPF" />
                <Row d="Nominatim / OpenStreetMap" z="Reverse-Geocoding (PLZ-Ermittlung)" l="EU (Frankreich, Deutschland)" />
              </tbody>
            </table>
          </div>
          <p className="text-xs italic mt-2">
            SCCs = EU-Standardvertragsklauseln nach Art. 46 Abs. 2 DSGVO. DPF = EU-US Data Privacy Framework
            (Angemessenheitsbeschluss vom 10. Juli 2023).
          </p>
        </Section>

        <Section num="7" title="Internationale Datenübermittlungen">
          <p>
            Wenn Daten in Drittländer außerhalb des Europäischen Wirtschaftsraums übertragen werden, sichern wir ein
            angemessenes Schutzniveau durch folgende Mechanismen:
          </p>
          <ul className="list-disc list-inside space-y-1 text-sm mt-2">
            <li>Angemessenheitsbeschluss der EU-Kommission (z.&nbsp;B. EU-US DPF, Vereinigtes Königreich, Schweiz)</li>
            <li>EU-Standardvertragsklauseln (SCCs) in aktueller Fassung von Juni 2021</li>
            <li>Transfer-Folgenabschätzung (TIA) für jeden US-Dienstleister</li>
            <li>Zusätzliche technische Maßnahmen (Verschlüsselung in Transit und at Rest, Pseudonymisierung)</li>
            <li>Vertragliche Beschränkungen, soweit mit dem jeweiligen Anbieter abgeschlossen (z.&nbsp;B. Zero-Retention, No-Training-on-User-Data bei Anthropic — DPA in Abschluss)</li>
          </ul>
          <p className="text-xs mt-2 italic">
            Kopien der SCCs und weitere Garantien stellen wir auf Anfrage zur Verfügung.
          </p>
        </Section>

        <Section num="8" title="Speicherdauer und Löschkonzept">
          <div className="overflow-x-auto">
            <table className="w-full text-xs border-collapse mt-2">
              <thead>
                <tr className="border-b border-border text-text">
                  <th className="text-left py-2 pr-2 font-bold">Datenkategorie</th>
                  <th className="text-left py-2 font-bold">Speicherdauer</th>
                </tr>
              </thead>
              <tbody>
                <Row d="Konto- und Profildaten" z="" l="bis Konto-Löschung + 30 Tage Backup" />
                <Row d="Standort- und GPS-Tracks" z="" l="max. 24 Monate, danach Anonymisierung zu Heatmap" />
                <Row d="Wächter, Inventar, Spielstand" z="" l="bis Konto-Löschung" />
                <Row d="Arena-Kämpfe (Rundenprotokoll)" z="" l="6 Monate, danach aggregierte Statistik" />
                <Row d="Saison-Historie und Prestige" z="" l="unbefristet (Hall-of-Fame) oder bis Konto-Löschung" />
                <Row d="Crew-Chat-Nachrichten" z="" l="12 Monate oder bis Crew-Auflösung" />
                <Row d="Shop-Check-ins, Deal-Einlösungen" z="" l="24 Monate für Missbrauchs-Nachweis" />
                <Row d="Kassenbeleg-Bilder" z="" l="7 Tage (ausschließlich zur OCR-Prüfung)" />
                <Row d="Rechnungen und Zahlungsdaten" z="" l="10 Jahre (§ 147 AO, § 257 HGB)" />
                <Row d="Einwilligungs-Nachweise" z="" l="bis 3 Jahre nach Widerruf" />
                <Row d="Server-Logs mit IP" z="" l="7 Tage, danach IP-Kürzung" />
                <Row d="Admin-Audit-Log" z="" l="36 Monate" />
                <Row d="Abgelehnte Uploads" z="" l="30 Tage zur Revision" />
                <Row d="Moderations-Meldungen" z="" l="24 Monate" />
                <Row d="Support-Tickets" z="" l="36 Monate nach Abschluss" />
                <Row d="A/B-Test-Zuweisungen" z="" l="Dauer des Experiments + 90 Tage für Auswertung" />
                <Row d="Newsletter-Events" z="" l="24 Monate" />
                <Row d="Sales-Leads (B2B)" z="" l="36 Monate ab letztem Kontakt" />
                <Row d="Verarbeitungsverzeichnis" z="" l="dauerhaft als interner Nachweis" />
              </tbody>
            </table>
          </div>
        </Section>

        <Section num="9" title="Cookies, LocalStorage und ähnliche Technologien">
          <p>
            Der Dienst verwendet ausschließlich technisch notwendige Cookies bzw. LocalStorage-Einträge, die nach
            § 25 Abs. 2 Nr. 2 TDDDG (vormals TTDSG) ohne Einwilligung zulässig sind:
          </p>
          <div className="overflow-x-auto mt-3">
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="border-b border-border text-text">
                  <th className="text-left py-2 pr-2 font-bold">Name</th>
                  <th className="text-left py-2 pr-2 font-bold">Zweck</th>
                  <th className="text-left py-2 font-bold">Dauer</th>
                </tr>
              </thead>
              <tbody>
                <Row d="sb-access-token" z="Authentifizierung (Supabase)" l="1 Stunde" />
                <Row d="sb-refresh-token" z="Session-Verlängerung" l="30 Tage" />
                <Row d="ma365-locale" z="Sprach-Präferenz" l="1 Jahr" />
                <Row d="ma365-consent" z="Zustimmungs-Status zu optionalen Features" l="6 Monate" />
                <Row d="ma365-theme" z="Dunkel-/Hell-Modus-Präferenz" l="1 Jahr" />
              </tbody>
            </table>
          </div>
          <p className="mt-2 text-sm">
            Wir setzen <b>keine</b> Tracking-Pixel, keine werblichen Cookies und keine geräteübergreifenden Kennungen ein.
            Sollten zukünftig optionale Analyse- oder Marketing-Cookies hinzukommen, erfolgt dies nur nach vorheriger
            Einwilligung über ein Consent-Banner.
          </p>
        </Section>

        <Section num="10" title="Kinder und Jugendliche">
          <p>
            Der Dienst richtet sich an Personen ab 16 Jahren (EU), 13 Jahren (USA, nach COPPA — 15 U.S.C. § 6501 ff.),
            bzw. dem jeweiligen Mindestalter der nationalen Regelung. Personen unterhalb dieser Altersgrenze dürfen den
            Dienst nur mit ausdrücklicher Einwilligung ihrer Erziehungsberechtigten nutzen (Art. 8 DSGVO, COPPA Rule
            16 CFR Part 312).
            Sollten wir Kenntnis erhalten, dass ohne die erforderliche Einwilligung Daten von Kindern verarbeitet werden,
            löschen wir diese umgehend.
          </p>
        </Section>

        <Section num="11" title="Datensicherheit und technische Maßnahmen">
          <ul className="list-disc list-inside space-y-1 text-sm">
            <li>Transport-Verschlüsselung HTTPS mit TLS 1.2+ auf allen Endpunkten</li>
            <li>Verschlüsselung at Rest für alle Datenbank- und Storage-Inhalte (AES-256)</li>
            <li>Passwort-Hashing nach aktuellem Stand der Technik (Argon2id / bcrypt mit Salt)</li>
            <li>Row-Level-Security in der Datenbank für nutzerbezogene Tabellen</li>
            <li>Staff-Zugriff nur mit dediziertem Rollen-System und vollständigem Audit-Log</li>
            <li>Zwei-Faktor-Authentifizierung für Administrator-Zugänge</li>
            <li>Regelmäßige Backups mit begrenzter Aufbewahrung und verschlüsselter Ablage</li>
            <li>Automatisierte Sicherheits-Scans der Code-Basis und Abhängigkeiten</li>
            <li>Vorfallmanagement mit Meldepflichten nach Art. 33/34 DSGVO (72-Stunden-Frist)</li>
          </ul>
        </Section>

        <Section num="12" title="Ergänzende Regelungen für bestimmte Rechtsräume">
          <SubSection title="12.1 Vereinigtes Königreich (UK-GDPR)">
            <p className="text-sm">
              Für Nutzer mit Wohnsitz im Vereinigten Königreich gilt die UK-GDPR in Ergänzung zum Data Protection Act 2018.
              Deine Rechte entsprechen inhaltlich den in Abschnitt 14 aufgeführten. Zuständige Aufsichtsbehörde ist das{" "}
              <a href="https://ico.org.uk/" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                Information Commissioner&apos;s Office (ICO)
              </a>.
            </p>
          </SubSection>

          <SubSection title="12.2 Schweiz (FADP / revDSG)">
            <p className="text-sm">
              Für Nutzer mit Wohnsitz in der Schweiz gilt das revidierte Bundesgesetz über den Datenschutz (revDSG, in Kraft
              seit 1. September 2023). Deine Rechte entsprechen denen der DSGVO. Zuständige Aufsichtsbehörde ist der{" "}
              <a href="https://www.edoeb.admin.ch/" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                Eidgenössische Datenschutz- und Öffentlichkeitsbeauftragte (EDÖB)
              </a>.
            </p>
          </SubSection>

          <SubSection title="12.3 Kalifornien (CCPA / CPRA)">
            <p className="text-sm">
              Nutzer mit Wohnsitz in Kalifornien haben nach dem California Consumer Privacy Act (CCPA) in der durch den
              California Privacy Rights Act (CPRA) geänderten Fassung zusätzliche Rechte:
            </p>
            <ul className="list-disc list-inside space-y-1 text-sm mt-2">
              <li><b className="text-text">Right to Know</b> &ndash; welche Kategorien personenbezogener Informationen erhoben werden</li>
              <li><b className="text-text">Right to Delete</b> &ndash; Löschung personenbezogener Informationen</li>
              <li><b className="text-text">Right to Correct</b> &ndash; Berichtigung ungenauer Informationen</li>
              <li><b className="text-text">Right to Opt-Out of Sale/Sharing</b> &ndash; Widerspruch gegen Verkauf / Weitergabe</li>
              <li><b className="text-text">Right to Limit Use of Sensitive Personal Information</b></li>
              <li><b className="text-text">Right to Non-Discrimination</b> bei Ausübung dieser Rechte</li>
              <li>Vertretung durch einen autorisierten Agenten möglich</li>
            </ul>
            <p className="text-sm mt-3">
              Wir erklären ausdrücklich: <b className="text-text">Wir verkaufen keine personenbezogenen Informationen</b> und
              geben sie nicht für gezielte Werbung Dritter weiter (&bdquo;Do Not Sell or Share My Personal Information&ldquo;).
              Kategorien, die wir im CCPA-Sinne sammeln: Identifier (A), Internet-Aktivität (F), Geolocation (G),
              kommerzielle Informationen (D), Inferenzen (K). Anfragen an{" "}
              <a href="mailto:support@myarea365.de" className="text-primary hover:underline">support@myarea365.de</a>.
            </p>
          </SubSection>

          <SubSection title="12.4 Brasilien (LGPD)">
            <p className="text-sm">
              Für Nutzer mit Wohnsitz in Brasilien gilt die Lei Geral de Proteção de Dados (LGPD). Deine Rechte nach
              Art. 18 LGPD umfassen Auskunft, Berichtigung, Löschung, Datenübertragbarkeit, Widerruf der Einwilligung und
              Beschwerde bei der{" "}
              <a href="https://www.gov.br/anpd/" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                Autoridade Nacional de Proteção de Dados (ANPD)
              </a>.
            </p>
          </SubSection>

          <SubSection title="12.5 Kanada (PIPEDA) und Australien (Privacy Act)">
            <p className="text-sm">
              Für Nutzer mit Wohnsitz in Kanada oder Australien gelten die lokalen Datenschutzgesetze (PIPEDA bzw.
              Australian Privacy Act 1988). Die in dieser Erklärung gewährten Rechte erfüllen die dortigen Anforderungen
              oder gehen darüber hinaus. Beschwerden an den{" "}
              <a href="https://www.priv.gc.ca/" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                Office of the Privacy Commissioner of Canada
              </a>{" "}
              oder das{" "}
              <a href="https://www.oaic.gov.au/" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                Office of the Australian Information Commissioner
              </a>.
            </p>
          </SubSection>
        </Section>

        <Section num="13" title="Besondere Kategorien personenbezogener Daten (Art. 9 DSGVO)">
          <p>
            GPS-Bewegungsdaten im Zusammenhang mit sportlicher Aktivität können Rückschlüsse auf Gesundheitsdaten zulassen.
            Wir behandeln diese Daten daher mit besonderer Sorgfalt:
          </p>
          <ul className="list-disc list-inside space-y-1 text-sm mt-2">
            <li>Keine Übermittlung an Dritte zu gesundheitlichen Analysezwecken</li>
            <li>Keine Verknüpfung mit Krankenversicherungen, Arbeitgebern oder ähnlichen Stellen</li>
            <li>Aggregation zu Heatmaps erfolgt nur anonymisiert auf Straßensegment-Ebene</li>
            <li>Verarbeitung ausschließlich auf Grundlage deiner ausdrücklichen Einwilligung (Art. 9 Abs. 2 lit. a DSGVO)</li>
          </ul>
        </Section>

        <Section num="14" title="Deine Rechte im Überblick">
          <p>Dir stehen nach der DSGVO folgende Rechte zu:</p>
          <ul className="list-disc list-inside space-y-1 text-sm mt-2">
            <li><b className="text-text">Auskunft</b> über die zu deiner Person verarbeiteten Daten (Art. 15 DSGVO)</li>
            <li><b className="text-text">Berichtigung</b> unrichtiger oder unvollständiger Daten (Art. 16 DSGVO)</li>
            <li><b className="text-text">Löschung</b> &ndash; &bdquo;Recht auf Vergessenwerden&ldquo; (Art. 17 DSGVO)</li>
            <li><b className="text-text">Einschränkung</b> der Verarbeitung (Art. 18 DSGVO)</li>
            <li><b className="text-text">Datenübertragbarkeit</b> in einem strukturierten, gängigen Format (Art. 20 DSGVO)</li>
            <li><b className="text-text">Widerspruch</b> gegen Verarbeitungen auf Basis berechtigter Interessen (Art. 21 DSGVO)</li>
            <li><b className="text-text">Widerruf</b> erteilter Einwilligungen mit Wirkung für die Zukunft (Art. 7 Abs. 3 DSGVO)</li>
            <li>
              <b className="text-text">Beschwerde</b> bei einer Datenschutz-Aufsichtsbehörde (Art. 77 DSGVO). Zuständig für
              Berlin ist die{" "}
              <a href="https://www.datenschutz-berlin.de/" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                Berliner Beauftragte für Datenschutz und Informationsfreiheit
              </a>.
            </li>
          </ul>
          <p className="mt-3 text-sm">
            Zur Ausübung genügt eine formlose E-Mail an{" "}
            <a href="mailto:support@myarea365.de" className="text-primary hover:underline">support@myarea365.de</a>.
            Wir antworten kostenfrei binnen 30 Tagen (bzw. 45 Tagen nach CCPA/LGPD). Ein vollständiger Datenexport
            nach Art. 20 DSGVO steht dir auch in deinen Kontoeinstellungen als JSON-Download zur Verfügung.
          </p>
        </Section>

        <Section num="15" title="Datenpannen und Benachrichtigung">
          <p>
            Bei einer Verletzung des Schutzes personenbezogener Daten, die voraussichtlich zu einem hohen Risiko für deine
            Rechte und Freiheiten führt, benachrichtigen wir dich unverzüglich gemäß Art. 34 DSGVO. Die zuständige
            Aufsichtsbehörde informieren wir spätestens binnen 72 Stunden (Art. 33 DSGVO).
          </p>
          <p className="text-sm mt-2">
            Wir führen ein internes Verzeichnis aller Vorfälle, auch solcher unterhalb der Meldeschwelle, um unser
            Sicherheitsniveau kontinuierlich zu verbessern. Betroffene Nutzer informieren wir direkt per E-Mail und
            In-App-Benachrichtigung, sofern ihr Datensatz konkret berührt war.
          </p>
        </Section>

        <Section num="16" title="Konto-Löschung und Deaktivierung im Detail">
          <p>
            Du kannst dein Konto jederzeit in den Einstellungen oder per formlose E-Mail an{" "}
            <a href="mailto:support@myarea365.de" className="text-primary hover:underline">support@myarea365.de</a> löschen
            lassen. Der Ablauf ist wie folgt:
          </p>
          <ul className="list-disc list-inside space-y-1 text-sm mt-2">
            <li><b className="text-text">Sofort:</b> Deaktivierung des Zugangs, Anzeige des Profils als &bdquo;gelöscht&ldquo;</li>
            <li><b className="text-text">Nach 14 Tagen:</b> Löschung aller personenbezogenen Daten (Widerrufsfrist)</li>
            <li><b className="text-text">Verbleibend:</b> Aggregierte, nicht personenbezogene Statistiken (z.&nbsp;B. &bdquo;100 km in Kreuzberg gelaufen&ldquo;)</li>
            <li><b className="text-text">Pflicht-Aufbewahrung:</b> Rechnungs- und Zahlungsdaten verbleiben 10 Jahre (§ 147 AO)</li>
            <li><b className="text-text">Chat-Nachrichten:</b> bleiben für andere Crew-Mitglieder unter &bdquo;[gelöschter Nutzer]&ldquo; lesbar</li>
            <li><b className="text-text">Erspielte Crew-/Saison-Titel:</b> werden in der Hall of Fame anonymisiert</li>
            <li><b className="text-text">Einwilligungen:</b> werden als Widerruf-Nachweis bis zu 3 Jahre weiter gespeichert</li>
          </ul>
          <p className="text-sm mt-2">
            Eine Wiederherstellung nach der 14-tägigen Frist ist technisch nicht möglich.
          </p>
        </Section>

        <Section num="17" title="Weitergabe an Behörden und gesetzliche Offenlegung">
          <p>
            Wir geben deine Daten nur dann an staatliche Stellen weiter, wenn wir dazu rechtlich verpflichtet sind, etwa
            auf Grundlage einer richterlichen Anordnung, strafprozessualer Ermittlungsmaßnahmen (z.&nbsp;B. §§ 100a, 100g
            StPO) oder einer Anordnung nach der EU-Verordnung 2022/2065 (Digital Services Act, Art. 9/10).
          </p>
          <p className="text-sm mt-2">
            Jede Offenlegung wird dokumentiert. Wir prüfen die Rechtmäßigkeit jedes Auskunftsersuchens und legen nur die
            konkret angeforderten Daten offen. Wo rechtlich zulässig, informieren wir den betroffenen Nutzer über die
            Anfrage.
          </p>
        </Section>

        <Section num="18" title="Nachlass und Tod eines Nutzers">
          <p>
            Erben können auf Anfrage Zugang zum Konto verstorbener Personen erhalten (BGH-Urteil vom 12. Juli 2018,
            Az. III ZR 183/17). Hierfür sind folgende Nachweise erforderlich:
          </p>
          <ul className="list-disc list-inside space-y-1 text-sm mt-2">
            <li>Sterbeurkunde (beglaubigte Kopie)</li>
            <li>Erbschein oder notariell beglaubigtes Testament</li>
            <li>Ausweiskopie der anfragenden Person</li>
          </ul>
          <p className="text-sm mt-2">
            Alternativ kannst du zu Lebzeiten schriftlich festlegen, dass dein Konto im Todesfall gelöscht werden soll.
            Schreib uns hierzu an{" "}
            <a href="mailto:support@myarea365.de" className="text-primary hover:underline">support@myarea365.de</a>.
          </p>
        </Section>

        <Section num="19" title="Verlinkte externe Dienste und Inhalte">
          <p>
            Unser Dienst enthält Links zu externen Webseiten, deren Inhalte wir nicht kontrollieren. Für die Datenschutz­praktiken
            dieser Dritten übernehmen wir keine Verantwortung. Insbesondere gilt dies für:
          </p>
          <ul className="list-disc list-inside space-y-1 text-sm mt-2">
            <li>Websites verlinkter Partner-Shops</li>
            <li>Social-Media-Plattformen beim Teilen von Profilen</li>
            <li>App-Store-Links zu Apple App Store und Google Play</li>
            <li>Landkarten-Dienste (OpenStreetMap, Mapbox)</li>
          </ul>
          <p className="text-sm mt-2">
            Bitte lies dort die jeweiligen Datenschutzerklärungen separat.
          </p>
        </Section>

        <Section num="20" title="Datenschutz-Folgenabschätzung (DPIA)">
          <p>
            Da unser Dienst GPS-Bewegungsdaten großflächig verarbeitet und öffentliche Ranglisten erstellt, haben wir eine
            Datenschutz-Folgenabschätzung nach Art. 35 DSGVO durchgeführt. Die DPIA dokumentiert:
          </p>
          <ul className="list-disc list-inside space-y-1 text-sm mt-2">
            <li>Die systematische Beschreibung der Verarbeitungsvorgänge</li>
            <li>Die Beurteilung der Notwendigkeit und Verhältnismäßigkeit</li>
            <li>Die identifizierten Risiken für Betroffene</li>
            <li>Die Abhilfemaßnahmen (Pseudonymisierung, Verschlüsselung, Zugriffsbeschränkungen)</li>
          </ul>
          <p className="text-sm mt-2">
            Eine Zusammenfassung stellen wir auf Anfrage zur Verfügung. Die vollständige DPIA unterliegt dem Betriebsgeheimnis.
          </p>
        </Section>

        <Section num="21" title="Datenportabilität und Export">
          <p>
            Nach Art. 20 DSGVO hast du das Recht, deine Daten in einem strukturierten, gängigen und maschinenlesbaren
            Format zu erhalten. Wir stellen dir folgende Möglichkeiten bereit:
          </p>
          <ul className="list-disc list-inside space-y-1 text-sm mt-2">
            <li>Self-Service-Export in deinen Kontoeinstellungen (JSON)</li>
            <li>Auf Anfrage zusätzlich als CSV je Datenkategorie</li>
            <li>Enthaltene Daten: Profil, Läufe, Gebiete, XP, Achievements, Einlösungen, Wächter, Items, Prestige, Fights</li>
          </ul>
          <p className="text-sm mt-2">
            Der Export steht dir einmal pro Monat kostenfrei zur Verfügung. Bei offensichtlich unbegründeten oder exzessiven
            Anträgen (Art. 12 Abs. 5 DSGVO) behalten wir uns ein angemessenes Entgelt oder eine Ablehnung vor.
          </p>
        </Section>

        <Section num="22" title="Anwendbares Recht und Gerichtsstand">
          <p>
            Auf diese Datenschutzerklärung und die Verarbeitung deiner personenbezogenen Daten findet deutsches Recht unter
            Ausschluss des UN-Kaufrechts Anwendung. Zwingende Verbraucherschutzvorschriften deines Wohnsitzlandes bleiben
            unberührt.
          </p>
          <p className="text-sm mt-2">
            Gerichtsstand für Streitigkeiten mit Unternehmern und Personen ohne allgemeinen Gerichtsstand in Deutschland ist
            Berlin. Verbraucher können Ansprüche auch an ihrem Wohnsitz geltend machen.
          </p>
        </Section>

        <Section num="23" title="Nutzung durch Vertragspartner und Geschäftskunden (B2B)">
          <p>
            Wenn du unseren Dienst als Partner-Shop, Werbekunde oder Geschäftspartner nutzt, gelten die
            Regelungen dieser Datenschutzerklärung analog. Für Daten, die du uns über deine Kunden oder Mitarbeiter
            übermittelst, schließen wir bei Bedarf einen separaten Auftragsverarbeitungs­vertrag nach Art. 28 DSGVO ab.
          </p>
        </Section>

        <Section num="24" title="Beschwerden und Alternative Streitbeilegung">
          <p>
            Wenn du der Auffassung bist, dass wir deine Daten nicht ordnungsgemäß verarbeiten, kannst du:
          </p>
          <ul className="list-disc list-inside space-y-1 text-sm mt-2">
            <li>Dich direkt an uns wenden (<a href="mailto:support@myarea365.de" className="text-primary hover:underline">support@myarea365.de</a>)</li>
            <li>Eine Beschwerde bei deiner Aufsichtsbehörde einreichen (Übersicht siehe Abschnitt 12 und 14)</li>
            <li>Die EU-Plattform zur Online-Streitbeilegung nutzen: <a href="https://ec.europa.eu/consumers/odr/" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">ec.europa.eu/consumers/odr</a></li>
            <li>Gerichtlichen Rechtsschutz nach Art. 79 DSGVO in Anspruch nehmen</li>
          </ul>
          <p className="text-sm mt-2">
            Eine Teilnahme an einem Streitbeilegungsverfahren vor einer Verbraucherschlichtungsstelle erfolgt nicht verpflichtend.
          </p>
        </Section>

        <Section num="25" title="Änderungen dieser Datenschutzerklärung">
          <p>
            Wir passen diese Erklärung bei technischen oder rechtlichen Änderungen an. Die jeweils aktuelle Fassung ist
            stets unter{" "}
            <Link href="/datenschutz" className="text-primary hover:underline">myarea365.de/datenschutz</Link>{" "}
            abrufbar. Bei wesentlichen Änderungen, die deine Rechte betreffen, informieren wir dich zusätzlich per E-Mail
            oder In-App-Benachrichtigung. Frühere Versionen archivieren wir und stellen sie auf Anfrage zur Verfügung.
          </p>
        </Section>

        <section className="text-xs pt-4 border-t border-border italic">
          Diese Datenschutzerklärung wurde mit großer Sorgfalt und mit Blick auf internationale Regelungen (DSGVO, UK-GDPR,
          FADP, CCPA/CPRA, LGPD, PIPEDA, Australian Privacy Act) erstellt. Sie beschreibt den gegenwärtigen Stand unserer
          Datenverarbeitung. Vor dem Produktiv-Launch und bei Einführung wesentlicher neuer Funktionen empfehlen wir eine
          abschließende Prüfung durch einen auf IT- und Datenschutzrecht spezialisierten Rechtsanwalt.
        </section>
      </div>
    </div>
  );
}

function Section({ num, title, children }: { num: string; title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="text-lg font-bold text-text mb-2">{num}. {title}</h2>
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

function DataList({ items }: { items: string[] }) {
  return (
    <ul className="list-disc list-inside space-y-0.5 text-sm">
      {items.map((it, i) => <li key={i}>{it}</li>)}
    </ul>
  );
}

function Row({ d, z, l }: { d: string; z: string; l: string }) {
  return (
    <tr className="border-b border-border/40">
      <td className="py-2 pr-2 text-text font-bold">{d}</td>
      {z && <td className="py-2 pr-2">{z}</td>}
      <td className="py-2" dangerouslySetInnerHTML={{ __html: l }} />
    </tr>
  );
}
