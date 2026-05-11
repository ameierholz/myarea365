/**
 * Blog-Registry — Single Source of Truth für alle Artikel.
 *
 * Jeder Artikel ist als Markdown-ähnliches Block-Array hinterlegt. Die Render-
 * Komponente in `[slug]/page.tsx` mappt die Blöcke auf JSX und ergänzt Schema.org-
 * Markup (Article + BlogPosting) sowie OG-/Twitter-Meta.
 *
 * Warum kein MDX? Wir brauchen weder MDX-Components noch Plugin-Pipeline — der
 * Content ist statisch, in TypeScript editierbar, läuft durch denselben i18n-
 * Build-Process und lässt sich problemlos diff/merge'n in PRs.
 */

export type Block =
  | { kind: "p"; text: string }
  | { kind: "h2"; text: string }
  | { kind: "h3"; text: string }
  | { kind: "ul"; items: string[] }
  | { kind: "ol"; items: string[] }
  | { kind: "callout"; tone: "info" | "tip" | "warn"; text: string }
  | { kind: "table"; columns: string[]; rows: string[][] }
  | { kind: "cta"; href: string; label: string };

export type Article = {
  slug: string;
  title: string;
  description: string;
  publishedAt: string; // ISO date
  updatedAt: string;   // ISO date
  readingMinutes: number;
  category: "Strategie" | "Crew" | "Saga" | "Wächter" | "Wirtschaft" | "Onboarding";
  heroEmoji: string;
  blocks: Block[];
};

export const ARTICLES: Article[] = [
  {
    slug: "stadt-server-strategie",
    title: "Stadt-Server-Strategie: Wie du deine Heimat-Stadt sichert und ausbaust",
    description: "Jede Stadt ist ein eigener Server in MyArea365. Wie du PLZ-Zuweisung, Migration-Tokens und Strength-Matchmaking nutzt, um vom Außenseiter zum Stadtmacher zu werden.",
    publishedAt: "2026-05-12",
    updatedAt: "2026-05-12",
    readingMinutes: 7,
    category: "Strategie",
    heroEmoji: "🏙️",
    blocks: [
      { kind: "p", text: "MyArea365 ist anders als klassische Strategiespiele: Jede reale Stadt ist ein eigener Server. Deine Heimat-Stadt wird automatisch aus deiner Postleitzahl abgeleitet, sobald du deine Base setzt. Wer dort spielt, kämpft auf einer geteilten Karte mit anderen Spielern derselben Stadt — und genau das macht den Reiz aus." },
      { kind: "p", text: "Der Unterschied zu den großen Genre-Vertretern: Du kannst nicht einfach den \"besten Server\" wählen. Aber du kannst mit etwas Strategie die Bedingungen auf deiner Heimat-Karte aktiv mitgestalten — oder per Migration-Token wechseln, wenn die Stadt zu konkurrenz-arm ist." },

      { kind: "h2", text: "PLZ-Zuweisung verstehen" },
      { kind: "p", text: "Wenn du deine Base zum ersten Mal setzt, ermittelt das Backend deine Stadt anhand der Koordinaten. Das passiert genau einmal — auch wenn du physisch umziehst, bleibt deine Heimat-Stadt erstmal fix. Das ist Absicht: Würde sich die Stadt automatisch ändern, würden Crews zerfallen und der politische Aufbau wäre nichts mehr wert." },
      { kind: "p", text: "Im Modal Server siehst du deinen aktuellen Stadt-Server, die Anzahl aktiver Spieler und das Crew-Power-Ranking. Schau dir das vor jedem Wechsel genau an: Ein leerer Server bedeutet wenig Reibung, aber auch wenig Wirtschaft. Ein voller Server bedeutet permanente Konkurrenz, aber auch lebendigere Crew-Politik und höhere Belohnungen." },

      { kind: "h2", text: "Wann ein Server-Wechsel sinnvoll ist" },
      { kind: "p", text: "Migration-Tokens sind kostbar — du bekommst sie nicht zum Nulltarif. Bevor du einen einsetzt, frage dich:" },
      { kind: "ul", items: [
        "Ist meine Heimat-Stadt unter 50 aktive Spieler? → Wechseln lohnt sich für mehr Crew-Optionen.",
        "Dominiert eine einzige Crew alles? → Wechseln nur sinnvoll wenn du nicht die nächsten 2-3 Saisons aktiv investieren willst.",
        "Steht in meiner Stadt gerade ein Don-Fenster offen? → BLEIBEN. Throne-Stronghold-Aura ist saisonweise das Wertvollste was du holen kannst.",
        "Bin ich der einzige aktive Spieler in meiner PLZ? → Wechseln in eine Nachbar-Stadt, dort baust du dir ein Standbein und kannst später zurückkehren.",
      ]},

      { kind: "h2", text: "Strength-Matchmaking richtig lesen" },
      { kind: "p", text: "Bei CvC-Maps (Crew-vs-Crew) wirst du nicht zufällig zugeordnet. Das Matchmaking betrachtet die Gesamt-Stärke deiner Crew — Burg-Level, Truppen, Wächter-Talente, aktive Forschungen. Eine schwache Crew, die plötzlich mit 50 Mitgliedern auftaucht, landet trotzdem in einer höheren Bracket, weil die Mitglieder-Anzahl Stärke ist." },
      { kind: "callout", tone: "tip", text: "Tipp: Lass schwache Mitglieder nicht offiziell beitreten, bevor du in die Saison gehst. Ein Trupp aus 20 starken Spielern schlägt 50 mittelmäßige fast immer — wegen Talent-Boni, Wächter-Synergien und koordinierten Rally-Calls." },

      { kind: "h2", text: "Die zwei Karten unterscheiden" },
      { kind: "p", text: "Heimat-Karte und CvC-Karte sind getrennte Welten. Auf der Heimat-Karte siehst du deine Base als Pin, kannst Nodes plündern und Belagerungs-Repeater bauen. Auf der CvC-Karte (Metropol-Saga) bewegst du dich virtuell durch Zonen Richtung Apex." },
      { kind: "p", text: "Wichtig: Deine Heimat-Stadt-Crew bleibt dieselbe — egal welche CvC du spielst. Aber deine Truppen, Resourcen und Forschungen sind auf der CvC-Karte separat. Du startest pro Saison frisch, das macht das Matchmaking fairer und neue Spieler haben echte Chancen." },

      { kind: "h2", text: "Investitions-Reihenfolge für neue Spieler" },
      { kind: "ol", items: [
        "Burg auf Level 5 hochziehen — vorher keine seriöse Crew-Anwerbung möglich.",
        "Pflicht-Resourcen-Buildings (Recycling-Hof I, Komponenten-Werk I, Krypto-Mine I, Datacenter I) parallel hochziehen.",
        "Wächter-Halle bauen, ersten Wächter aktivieren.",
        "Crew gründen oder beitreten — beides hat Vor- und Nachteile (siehe Crew-Aufbau-Artikel).",
        "Erst dann: Kampf-Gebäude. Vorher hat man weder Truppen-Kapazität noch Resourcen-Polster für echte Konflikte.",
      ]},

      { kind: "h2", text: "Was du auf keinen Fall machst" },
      { kind: "p", text: "Frühe Migration: Wenn du in den ersten 7 Tagen schon wechselst, verlierst du den First-Purchase-Bonus für die neue Stadt nicht — aber alle deine Heimat-Stadt-Achievements werden eingefroren. Manche Spieler haben das übersehen und plötzlich fehlen 30% ihrer Trophäen-Punkte." },
      { kind: "p", text: "Resourcen-Überproduktion ohne Schutz: Wenn deine Lager voll sind und du keinen Geheim-Tresor gebaut hast, sind alle ungeschützten Resourcen Plünder-frei. Eine einzige feindliche Crew kann dich an einem Abend um Tage zurückwerfen." },
      { kind: "cta", href: "/saga", label: "Aktuelle Saga ansehen" },
    ],
  },

  {
    slug: "crew-aufbau",
    title: "Crew-Aufbau: Officer-Hierarchie, Recruiting und die ersten Wochen",
    description: "Eine Crew ist mehr als ein Tag im Namen. Wie du Officer-Rollen sinnvoll besetzt, deine ersten 20 Mitglieder findest und die Crew durch die erste CvC-Saison bringst.",
    publishedAt: "2026-05-12",
    updatedAt: "2026-05-12",
    readingMinutes: 8,
    category: "Crew",
    heroEmoji: "🛡",
    blocks: [
      { kind: "p", text: "Solo-Spiel in MyArea365 funktioniert — bis zu einem gewissen Punkt. Sobald du auf einen Stadt-Server kommst, an dem mehrere aktive Crews um die Throne-Stronghold-Position kämpfen, wirst du allein chancenlos. Eine Crew zu gründen oder beizutreten ist keine Option, sondern Pflicht ab Burg-Level 7." },

      { kind: "h2", text: "Gründen oder Beitreten?" },
      { kind: "p", text: "Beide Wege haben ihre Tücken. Wer eine Crew gründet, wird automatisch Leader — mit aller Verantwortung und vollem Zugriff auf das Schwarzmarkt-Treasury. Wer einer bestehenden Crew beitritt, profitiert sofort von Hangout-Buffs, Set-Bonus-Equipment und einem etablierten War-Targeting-Netzwerk." },
      { kind: "table", columns: ["Aspekt", "Gründer", "Mitglied"], rows: [
        ["Tag-Wahl", "Du bestimmst", "Vorgegeben"],
        ["Treasury", "Voller Zugriff", "Kein Zugriff (nur Withdraw)"],
        ["Politik", "Du machst die Regeln", "Du folgst"],
        ["Zeit-Investment", "Sehr hoch", "Moderat"],
        ["Lernkurve", "Steil", "Sanft"],
      ]},
      { kind: "callout", tone: "info", text: "Mein Rat: Erst beitreten, mindestens eine CvC mitspielen, dann entscheiden ob du selbst gründen willst. Wer ohne eigene Saga-Erfahrung gründet, scheitert in 80% der Fälle am eigenen Burnout." },

      { kind: "h2", text: "Die fünf Officer-Rollen" },
      { kind: "p", text: "Eine Crew hat in MyArea365 eine klare Hierarchie: Leader, Co-Leader, Officer, Veteran, Member. Jede Rolle hat eigene Rechte — wer aus dem Schwarzmarkt-Treasury abheben darf, wer Krieg erklärt, wer Mitglieder rausschmeißt." },
      { kind: "ul", items: [
        "Leader: Krieg erklären, Diplomatie schließen, Treasury-Zugriff, Crew auflösen — der einzige der das alles kann.",
        "Co-Leader: Stellvertretung in allem außer Auflösen. Wichtig wenn der Leader mal in Urlaub ist.",
        "Officer: Recruiting, Member-Kicks (außer höhere Ränge), Crew-Mail schreiben. Das Tagesgeschäft.",
        "Veteran: Wie Member, aber mit zusätzlichen Buffs aus Hangout. Symbolische Belohnung für lange Treue.",
        "Member: Standard. Kämpft mit, kann nicht repräsentieren.",
      ]},
      { kind: "p", text: "Häufiger Fehler: Zu viele Officer ernennen. Wenn fünf Officer parallel Mitglieder anwerben, kommt es zu Wildwuchs — manche Mitglieder werden in Spam-Recruit-Wellen aus Versehen rausgekickt, weil keiner die Übersicht hat. Optimal sind 1-2 Officer pro 15 Mitglieder." },

      { kind: "h2", text: "Recruiting: Wo du Mitglieder findest" },
      { kind: "ol", items: [
        "Stadt-Chat: Der größte Kanal. Schreib hier nicht 'JOIN US PLS'. Schreib worauf eure Crew Wert legt (CvC-First? F2P-Friendly? Casual?).",
        "Welt-Chat: Größerer Pool, aber meist Spieler die noch keine Heimat-Stadt-Zugehörigkeit aufgebaut haben. Gute Quelle für Migration-Token-Spieler.",
        "Ranglisten: Klick auf Spieler-Namen im Leaderboard. Wer Top-50 ist und keiner Crew angehört, ist meistens unzufrieden mit der bisherigen — sprich ihn an.",
        "Crew-Bewerbungs-System: Aktiviere Beitritts-Anträge mit Antwortpflicht. Macht Spam-Bewerbungen unattraktiv.",
      ]},

      { kind: "h2", text: "Die ersten 20 Mitglieder" },
      { kind: "p", text: "Hier zerfällt jede zweite Crew. Du wirst Anfragen von Leuten bekommen die Burg-Level 3 sind und sich für Top-Hits halten. Lass dich nicht weichkochen. Setze ein Minimum: Burg 8 + erste Saga gespielt. Wer das nicht erfüllt, lass auf Member-Slot ohne Stimme starten — wenn er in 2 Wochen liefert, kriegt er Veteran." },
      { kind: "callout", tone: "warn", text: "Achte besonders auf Spy-Anwärter aus konkurrierender Crew. Wenn jemand am ersten Tag fragt wo eure Repeater stehen oder wann eure nächste CvC ist, kick sofort. Diese Information geht IMMER zur gegnerischen Crew." },

      { kind: "h2", text: "Schwarzmarkt-Treasury: Politik der Verteilung" },
      { kind: "p", text: "Crew-Treasury sammelt passiv Krypto über den Schwarzmarkt-Building. Wer da als Leader oder Officer abhebt, sollte das transparent machen. Der Crew-Mail-Composer hat dafür einen 'War'-Kategorie-Modus — nutze ihn für Treasury-Updates." },
      { kind: "p", text: "Häufige Fehler: Leader hebt 90% ab und sagt nichts. Resultat: Officer fragen, Streit, Crew-Split. Bessere Regel: Maximal 50% für Leader-Personal-Boosts, der Rest in War-Vorbereitung." },

      { kind: "h2", text: "Hangout, Bunker, Tunnel — die drei Säulen" },
      { kind: "p", text: "Eure Crew-Buildings sind keine Deko. Hangout gibt euch alle 6h einen zufälligen Crew-weiten Buff (10-35% je nach Level). Bunker macht euer 600m-Umkreis-Gebiet zur Festung. Tunnel verbindet zwei Endpunkte für Repeater-Placement weit weg vom Hauptquartier." },
      { kind: "p", text: "Reihenfolge: Erst Hangout (passiver Vorteil für alle), dann Bunker (defensive Stabilität), dann Tunnel (offensive Reichweite). Wer Tunnel zuerst baut, verschenkt 2-3 Wochen passive Verbesserung." },
      { kind: "cta", href: "/leaderboard", label: "Crew-Rangliste ansehen" },
    ],
  },

  {
    slug: "don-mechanik",
    title: "Don-Mechanik: Throne-Stronghold und der Kampf um die Stadt-Aura",
    description: "Wer den Throne-Stronghold im Stadtzentrum hält, wird Don der Stadt — mit dauerhafter +5% all-stats-Aura für die ganze Crew. Wie der Don-Status funktioniert und wann es sich lohnt ihn anzugreifen.",
    publishedAt: "2026-05-12",
    updatedAt: "2026-05-12",
    readingMinutes: 6,
    category: "Strategie",
    heroEmoji: "👑",
    blocks: [
      { kind: "p", text: "Don zu sein bedeutet mehr als ein Titel. Wer den Throne-Stronghold im Zentrum seiner Heimat-Stadt hält, bekommt für seine gesamte Crew eine permanente +5% all-stats-Aura. Das wirkt auf Angriff, Verteidigung, Lebenspunkte, March-Speed — alles. Ein Don-Vorteil entscheidet 70% aller CvC-Schlachten zwischen ähnlich starken Crews." },

      { kind: "h2", text: "Wie man Don wird" },
      { kind: "p", text: "Jede aktive Stadt hat genau einen Throne-Stronghold. Du findest ihn auf der Heimat-Karte als golden glühender Pin im geografischen Stadt-Zentrum. Wer als erster eine erfolgreiche Eroberung durchführt, wird Don. Der bisherige Don wird automatisch entthront." },
      { kind: "p", text: "Wichtig: Es gibt kein Auto-Reset. Wer Don wird, bleibt Don bis er besiegt wird. Manche Crews halten die Position monatelang — andere wechseln wöchentlich. Das hängt komplett von der politischen Landschaft eurer Stadt ab." },

      { kind: "h2", text: "Den Throne angreifen" },
      { kind: "p", text: "Eine Don-Eroberung ist keine normale Schlacht. Der Throne ist ein NPC-Stronghold mit Crew-Damage-Logging — jede Crew, die mit eigenem Rally Schaden anrichtet, bekommt anteilige Bonus-Beute, wenn am Ende eine Crew (egal welche) den Sieg holt." },
      { kind: "ol", items: [
        "Rally vorbereiten: Mindestens 4 Crew-Mitglieder, alle mit voller Truppen-Kapazität.",
        "Wächter aktivieren: Der Wächter des Rally-Anführers wirkt auf alle Teilnehmer. Tank-Wächter empfohlen.",
        "Diplomatie-Status checken: Wenn ihr mit der aktuellen Don-Crew NAP habt, müsst ihr erst kündigen (24h Cooldown).",
        "Timing: Throne wird stark verteidigt wenn die Don-Crew online ist. Spy auf den Garnison-Status zuerst.",
        "Beim Angriff: Die letzte Crew die zuschlägt holt die Don-Position — wenn ihr zur falschen Zeit angreift, eröffnet ihr nur das Tor für die nächste.",
      ]},

      { kind: "h2", text: "Die +5% all-stats-Aura im Detail" },
      { kind: "p", text: "Die Aura wirkt auf alle Member der Don-Crew, egal wo sie sich gerade aufhalten. Sie stackt zusätzlich mit Hangout-Buffs und Wächter-Talenten. Eine Don-Crew mit aktivem Hangout-Buff und Tank-Wächter-Stack hat schnell +50% effektive Stats gegenüber einer ähnlich großen Nicht-Don-Crew." },
      { kind: "callout", tone: "tip", text: "Beim Rechnen vergessen viele dass Aura-Bonus mit Awakening-Multiplikator multiplikativ kombiniert. Erweckter Wächter (+25% Lebenspunkte) plus Don-Aura (+5%) gibt nicht 30%, sondern (1.25 × 1.05 - 1) = 31.25%. Klein, aber bei knappen Kämpfen entscheidend." },

      { kind: "h2", text: "Wann es sich NICHT lohnt Don anzugreifen" },
      { kind: "p", text: "Don-Crew online und aktiv: Wenn der Don gerade durchgeplant ist mit Notifications, ist die Verteidigung in Minuten organisiert. Greife nur an wenn ihr klar mehr Aktivität als die Don-Crew habt." },
      { kind: "p", text: "Mid-Saga: Während einer aktiven Metropol-Saga sind die meisten guten Spieler woanders. Eine Don-Eroberung kurz vor Saga-Start oder kurz nach Saga-Ende ist deutlich planbarer." },
      { kind: "p", text: "Kein Followup-Plan: Don werden ist einfach. Don bleiben ist schwer. Wenn ihr keine 5-10 Verteidiger habt die 24/7 online sind, verliert ihr den Status schon am ersten Tag." },

      { kind: "h2", text: "Don-Cliquen und Wechsel-Politik" },
      { kind: "p", text: "Manche Städte etablieren stille Absprachen: Crew A hält Don im Mai, Crew B im Juni. Das funktioniert wenn alle Beteiligten Don nur als Saisonal-Vorteil sehen. Wenn jemand aus dem Kreis ausbricht, eskaliert das schnell zu Mehr-Fronten-Krieg." },
      { kind: "p", text: "Wer in einer neuen Stadt anfängt: Beobachte erst die Don-Wechsel-Frequenz. Wechselt der Don alle 2 Tage = unstabile Stadt, lass die Finger weg bis du eine starke Crew hast. Wechselt der Don nie = eine Crew dominiert komplett, du bist Außenseiter. Eine 1-2-wöchige Wechsel-Frequenz ist gesund." },
      { kind: "cta", href: "/saga", label: "Metropol-Saga öffnen" },
    ],
  },

  {
    slug: "saga-guide",
    title: "Metropol-Saga: Spawn, Gate, Apex — der komplette Phasen-Guide",
    description: "Die Metropol-Saga ist MyArea365s Crew-vs-Crew-Hauptsaison. 23 Tage, 4 Etappen, Apex am Ende. Wie du in jeder Phase richtig priorisierst und nicht in der Etappen-Falle landest.",
    publishedAt: "2026-05-12",
    updatedAt: "2026-05-12",
    readingMinutes: 9,
    category: "Saga",
    heroEmoji: "⚔️",
    blocks: [
      { kind: "p", text: "Die Metropol-Saga ist anders als alles was du aus klassischen Strategiespielen kennst. Eine reale Stadt wird zur Schlachtfeld-Karte, Spawn-Edges werden zum Startpunkt, und der Apex im Zentrum ist das Ziel. 23 Tage, vier Etappen, eine Sieger-Crew. So funktioniert es richtig." },

      { kind: "h2", text: "Phase 1: Auftakt (Tage 1-7)" },
      { kind: "p", text: "Die ersten 7 Tage sind die ruhigsten — auf den ersten Blick. Spawn-Edges öffnen, alle Crews landen am Rand der Karte und müssen sich erst einrichten. Hier wird die Saison gewonnen oder verloren, lange bevor der erste Apex-Kampf läuft." },
      { kind: "ul", items: [
        "Erkundung: Heilige Stätten finden (+10-25% Buffs), Gather-Tiles markieren, gegnerische Spawn-Edges identifizieren.",
        "Versorgung: Trupps mit Resourcen ausstatten, sodass jeder Member in Phase 2 sofort losziehen kann.",
        "Konditions-Drill: Wer in Phase 1 keine Trupps ausgehoben hat, ist in Phase 2 chancenlos. Holzkanone mit blanker Faust — passiert öfter als man denkt.",
      ]},
      { kind: "callout", tone: "info", text: "Die Sieger-Crew der Auftakt-Phase startet mit +15% Heimvorteil-Buff in Phase 2. Wenn ihr es nicht aufs Auftakt-Podium schafft, ist das nicht das Saison-Ende — aber der Buff gibt anderen Crews einen ernst zu nehmenden Vorsprung." },

      { kind: "h2", text: "Phase 2-4: Etappen-Wochen (Tage 8-21)" },
      { kind: "p", text: "Jetzt geht es um Zonen-Eroberung. Die Karte ist in Ringe gegliedert — Ring 4 ist der Rand (Spawn), Ring 0 der Apex. Pro Ring zwischen Spawn und Apex gibt es Tore. Tore sind nicht einfach durchschreitbare Linien, sondern eigene Stronghold-Kämpfe." },
      { kind: "p", text: "Gate-Status verstehen:" },
      { kind: "table", columns: ["Status", "Bedeutung", "Aktion"], rows: [
        ["open", "Tor steht offen, niemand garnisoniert", "Durchmarsch ohne Kampf möglich"],
        ["garrisoned", "Gegner-Crew hat Garnison gelegt", "Erst die Garnison ausschalten, dann durch"],
        ["besieged", "Aktuell wird belagert", "Anschluss-Rally oder warten bis Sieger feststeht"],
        ["closed", "Tor wurde nach Belagerung versiegelt", "12h Cooldown, dann erneut versuchen"],
      ]},

      { kind: "h2", text: "Heilige Stätten gezielt einnehmen" },
      { kind: "p", text: "Auf jeder Saga-Karte verteilt liegen 4-6 heilige Stätten. Wer sie hält, bekommt einen permanenten Buff für die eigene Crew bis zum Saga-Ende. Beispiele: +15% Gather-Yield, +10% March-Speed, +20% Stronghold-HP." },
      { kind: "p", text: "Heilige Stätten sind oft auf Ring 2-3 platziert — weit genug vom Spawn entfernt um nicht trivial zu sein, aber nicht so tief dass nur die Spitzenreiter sie erreichen. Wer als erste Crew ein heiliges Heiligtum hält, behält den Buff oft bis Ende der Saison — Verteidigung schlägt Eroberung im Saga-Format fast immer." },

      { kind: "h2", text: "Trupps richtig zusammenstellen" },
      { kind: "p", text: "Die vier Trupp-Klassen (Infanterie, Kavallerie, Schütze, Werkstatt) haben ein Stein-Schere-Papier-Verhältnis. Wer nur Infanterie schickt, kann gegen Werkstatt-Heavy nichts ausrichten. Wer nur Schützen mitnimmt, fällt gegen Kavallerie." },
      { kind: "ul", items: [
        "Balanced-Stack: 40% Infanterie, 30% Schützen, 20% Kavallerie, 10% Werkstatt — solider Standard.",
        "Anti-Kavallerie-Stack: 60% Schützen, 30% Infanterie, 10% Werkstatt — gegen mobile Gegner.",
        "Belagerungs-Stack: 50% Werkstatt, 30% Schützen, 20% Kavallerie — gegen befestigte Strongholds.",
        "Rally-Anführer-Stack: Wer den Rally leitet, sollte Tank-Klasse + Tank-Wächter aktiv haben. Sein HP-Pool zieht die Erstwellen-Damage.",
      ]},

      { kind: "h2", text: "Phase 5: Apex (Tage 22-23)" },
      { kind: "p", text: "Die letzten 48 Stunden gehören dem Apex. Wer ihn hält, gewinnt die Saga. Der Apex-Hold ist nicht statisch — du musst kontinuierlich verteidigen, weil Gegner-Crews Rally nach Rally schicken." },
      { kind: "p", text: "Apex-Verteidigung ist eine Frage des Schichtbetriebs. Eine Crew die 8 Spieler in europäischer Zeitzone hat, ist in der Nacht verwundbar wenn alle schlafen. Eine internationale Crew mit Asia/America-Kontingent hält den Apex deutlich stabiler." },
      { kind: "callout", tone: "warn", text: "Häufiger Fehler: In den letzten 2 Stunden alle Reserven verfeuern. Wer das macht, hat keine Verteidigung mehr und wird in den letzten Minuten überrannt. Halte mindestens 30% deiner Trupps als Reserve bis zum Saga-Ende." },

      { kind: "h2", text: "Belohnungen und was sie wert sind" },
      { kind: "p", text: "Die Sieger-Crew holt Diamanten (~2500 pro Mitglied), Universal-Siegel, einen 30-Tage-Stadt-Bonus (+10% Resourcen für die ganze Heimat-Stadt) und das Recht, das Saga-Plakettenabzeichen zu tragen." },
      { kind: "p", text: "Die Top-Beitragenden innerhalb jeder Crew (auch Verlierer-Crews) bekommen anteilige Beute basierend auf Merits — Schlacht-Punkte, Verteidigungen, Erkundungs-Beiträge. Wer auch in einer Verlierer-Crew aktiv spielt, holt mehr als ein Sieger-Crew-Mitglied das nichts tut." },
      { kind: "cta", href: "/saga", label: "Aktuelle Saga betreten" },
    ],
  },

  {
    slug: "waechter-synergien",
    title: "Wächter-Synergien: Welcher Wächter zu deinem Spielstil passt",
    description: "21 Wächter-Archetypen in 4 Rarities und 3 Fraktionen. Welche Trupp-Komposition welcher Wächter unterstützt — und welche Awakening-Strategie sich für deinen Stil lohnt.",
    publishedAt: "2026-05-12",
    updatedAt: "2026-05-12",
    readingMinutes: 8,
    category: "Wächter",
    heroEmoji: "🛡️",
    blocks: [
      { kind: "p", text: "Wächter sind nicht einfach kosmetische Begleiter. Jeder Wächter hat eigene Stats, eine aktive Fähigkeit und einen Talent-Baum. Wer den falschen Wächter zum eigenen Spielstil aktiviert, verschenkt 20-30% Combat-Performance. Hier der Überblick wie du den passenden findest." },

      { kind: "h2", text: "Die drei Wächter-Fraktionen" },
      { kind: "p", text: "Jeder Wächter gehört einer von drei Fraktionen an. Die Fraktionswahl ist keine reine Optik — sie beeinflusst welche Truppen den jeweiligen Wächter-Buff bekommen." },
      { kind: "ul", items: [
        "Orden: Verstärkt Infanterie und Schützen. Defensive Spielstile, lange Belagerungen, Stronghold-Halten.",
        "Wildhüter: Verstärkt Kavallerie und Werkstatt. Offensive Spielstile, schnelle Rallys, mobile Operationen.",
        "Schmiede: Verstärkt Werkstatt und Truppen-Heilung. Hospital-Effizienz, Großkampagnen mit hohen Verlustraten.",
      ]},

      { kind: "h2", text: "Rarities richtig einschätzen" },
      { kind: "p", text: "Common-Wächter sind nicht 'schlecht'. Ein Common mit Awakening und 5 Sternen schlägt einen unausgebauten Epic. Die Frage ist: Investierst du Sculpts in den schnellen Aufstieg eines Common, oder spielst du auf einen Epic?" },
      { kind: "table", columns: ["Rarity", "Sculpts/Level", "Awakening-Cost", "Empfehlung"], rows: [
        ["Common", "20", "200", "Erste Wahl für F2P, Starter-Stuff"],
        ["Rare", "40", "200", "Erst nach Burg 15 sinnvoll investieren"],
        ["Epic", "80", "200", "Langzeit-Investment, Endgame-Material"],
        ["Legendary", "160", "200", "Whales-Tier — nicht F2P-realistisch"],
      ]},

      { kind: "h2", text: "Talent-Tree-Strategien" },
      { kind: "p", text: "Jeder Wächter hat einen 3-Zweig-Talent-Baum. Wer alle drei Zweige gleichzeitig hochzieht, hat überall etwas — aber nirgendwo etwas Starkes. Spezialisierung schlägt Generalismus." },
      { kind: "ol", items: [
        "Angriff-Spec: 80% der Talente in den ATK-Zweig, Rest in Universal-Buffs. Optimal für PvP-Pushen.",
        "Verteidigung-Spec: 80% DEF-Zweig + HP-Boni. Optimal für Stronghold-Verteidigung und CvC-Rally-Empfang.",
        "Utility-Spec: Gleichmäßig verteilt mit Fokus auf March-Speed und Gather-Yield. Optimal für Wirtschafts-Profile.",
      ]},
      { kind: "callout", tone: "tip", text: "Respec ist möglich (Talent-Points-Reset), kostet aber Diamanten. Plane deine Spec im Voraus statt zu re-shuffeln nach jeder Niederlage." },

      { kind: "h2", text: "Awakening: Wann es sich lohnt" },
      { kind: "p", text: "Awakening (200 Sculpts) gibt deinem Wächter dauerhaft +25% Lebenspunkte, +20% Angriff, +20% Verteidigung. Klingt simpel — ist aber ein 200-Sculpt-Investment auf einen einzelnen Wächter." },
      { kind: "p", text: "Die Mathematik: Erst nach 5 Sternen freigeschaltet. Wer einen Common von 0 auf erweckt bringt, braucht ca. 350 Sculpts total. Ein Epic braucht 1000+. Der Zeit-zu-Wert-Quotient ist also massiv besser bei Commons — auch wenn die Epic-Base-Stats höher sind." },
      { kind: "p", text: "Strategie für F2P: Einen Common voll durchziehen (Awakening + Talent-Spec), bevor du auf einen zweiten Wächter wechselst. Strategie für Pay-To-Progress: Direkt auf Epic gehen, Sculpts via Battle-Pass+Shop sammeln." },

      { kind: "h2", text: "Wächter wechseln im Kampf" },
      { kind: "p", text: "Du kannst nur EINEN Wächter gleichzeitig aktiv haben. Ein Wechsel hat einen 8-Stunden-Cooldown. Das verhindert dass Spieler vor jedem Kampf den optimalen Counter aktivieren." },
      { kind: "p", text: "Praktische Konsequenz: Wähle einen Wächter der zu deinen häufigsten Aktivitäten passt, nicht zum geplanten Großkampf nächste Woche. Wenn du 80% deiner Zeit Resourcen sammelst und 20% kämpfst, ist ein Wirtschafts-Wächter besser als ein Kampf-Monster." },

      { kind: "h2", text: "Die 3 häufigsten Wächter-Fehler" },
      { kind: "ol", items: [
        "Mehrere Wächter parallel hochziehen: Du teilst deine Sculpts auf, am Ende ist KEINER fertig.",
        "Awakening bevor Talent-Tree ausgereizt ist: Awakening gibt 25/20/20% — aber Talents können auf einem Tier-1-Wächter +60% kombinieren. Spezialisiere zuerst.",
        "Wächter aktivieren und dann nie mehr beachten: Das XP-Level steigt nur wenn der Wächter aktiv war. Wer alle 2 Wochen wechselt verschenkt 30-50% Wachstum.",
      ]},
      { kind: "cta", href: "/leaderboard", label: "Wächter-Rangliste" },
    ],
  },

  {
    slug: "diamanten-f2p-strategie",
    title: "Diamanten effizient: F2P-Pfad vs. Battle-Pass vs. Whaling",
    description: "Die wichtigste Währung im Spiel — und gleichzeitig die in der die meisten Spieler suboptimal investieren. Wo dein Diamant 10x mehr wert ist als anderswo.",
    publishedAt: "2026-05-12",
    updatedAt: "2026-05-12",
    readingMinutes: 7,
    category: "Wirtschaft",
    heroEmoji: "💎",
    blocks: [
      { kind: "p", text: "Diamanten sind die Premium-Währung in MyArea365. Du bekommst sie über Stripe-Käufe, Battle-Pass-Belohnungen, Achievement-Drops und gelegentliche Event-Pakete. Was viele Spieler nicht wissen: Der Wert eines Diamanten variiert je nach Verwendung um Faktor 10." },

      { kind: "h2", text: "Wo Diamanten 'verbrannt' werden" },
      { kind: "p", text: "Diese Ausgaben kosten dich am meisten Diamanten relativ zum Spielfortschritt:" },
      { kind: "ul", items: [
        "Bau-Speedups bei Stufe 1-15: Geduld wäre die bessere Antwort, die Zeit ist hier noch human.",
        "Truppen-Heilung: Nutze stattdessen den Hospital — passive Heilung kostet nichts.",
        "Resource-Direktkauf: Plündern und Sammeln bringt mehr pro Stunde als jeder Diamant-Resource-Kauf.",
        "Kosmetik-Skins außerhalb von Events: Event-Skins haben oft 50% Rabatt — warte.",
      ]},

      { kind: "h2", text: "Wo Diamanten 10x wert sind" },
      { kind: "table", columns: ["Verwendung", "Effektiv-Wert", "Empfehlung"], rows: [
        ["First-Purchase-Bonus", "+100% Gems", "Jeder F2P sollte einmal kaufen — der Bonus ist absurd"],
        ["Monthly Pass", "~30x Gem-Wert", "Bestes Tages-zu-Diamant-Verhältnis im Spiel"],
        ["Battle-Pass Premium", "~15x Gem-Wert", "Lohnt sich wenn du täglich 30+ Min spielst"],
        ["Erweckung-Sculpts", "Sehr hoch", "Awakening + Stat-Boost permanent"],
        ["Migration-Token", "Hoch", "Wenn deine Stadt wirklich tot ist"],
        ["Extra-March-Slot (Forschung)", "Mittel-Hoch", "Mehr parallele Aktivität = mehr passive Erträge"],
      ]},

      { kind: "h2", text: "First-Purchase-Bonus: Das wichtigste Detail" },
      { kind: "p", text: "Wenn du irgendwann mal etwas kaufen willst — egal welches Bundle — mach deinen ersten Kauf zum größten, den du dir leisten würdest. Der First-Purchase-Bonus verdoppelt die Diamanten EINMAL. Bei einem 50€-Bundle bekommst du also die 100€-Menge. Bei einem 5€-Bundle nur die 10€-Menge." },
      { kind: "p", text: "Häufiger Fehler: First-Purchase auf das kleinste Starter-Pack verbrauchen 'weil das billig ist'. Das ist die schlechteste Diamant-Entscheidung im ganzen Spiel." },

      { kind: "h2", text: "Battle-Pass-Rechnung" },
      { kind: "p", text: "Premium-Track kostet 9,99€. Über die 30-Tage-Saison verteilt bekommst du:" },
      { kind: "ul", items: [
        "~2000 Diamanten (gegenüber 300 im F2P-Track)",
        "8 Speed-Token (große Bau-Beschleuniger)",
        "Saisonalen Avatar-Rahmen",
        "Pet-Food + Sculpts für aktuelle Saison-Wächter",
        "Bonus-Ansehen-Punkte",
      ]},
      { kind: "p", text: "Wenn du täglich 30+ Min spielst, holst du die Hälfte des Tracks in der ersten Woche raus. Wer nur Wochenend-Spieler ist, verfehlt typisch 40-60% der Belohnungen und sollte den Pass nicht kaufen." },

      { kind: "h2", text: "F2P-Pfad: Wo du deine Gratis-Diamanten holst" },
      { kind: "ol", items: [
        "Daily Login Streak: ~30 Diamanten/Tag wenn ohne Lücke",
        "Achievement-Unlocks: ~50-200 Diamanten je nach Tier",
        "Event-Drops: alle 2-3 Wochen ein Event mit ~500 Diamanten Belohnung",
        "Ranglisten-Top: Top-100 Wochen-Rangliste bringt ~100 Diamanten",
        "Saga-Sieger-Crew: ~2500 Diamanten pro Member (wenn ihr aktiv mitspielt)",
        "Crew-Boss-Raid: bis zu 800 Diamanten pro Boss-Kill",
        "Ad-Rewards: Beim Daily-Reward kannst du Werbung schauen für +1 Speed-Token",
      ]},
      { kind: "p", text: "Realistisch holt ein aktiver F2P-Spieler ~3000-5000 Diamanten pro Monat. Das reicht für 1.5 Wächter-Awakenings oder 2 Migration-Tokens — also strategisch limitiert, aber nicht hoffnungslos." },

      { kind: "h2", text: "Whaling-Strategie für Pay-To-Progress-Spieler" },
      { kind: "p", text: "Wenn du bereit bist 50-200€ pro Saison auszugeben, ist die Reihenfolge entscheidend:" },
      { kind: "ol", items: [
        "Zuerst: First-Purchase mit großem Bundle (verdoppelt)",
        "Monthly Pass abonnieren (laufende Versorgung)",
        "Battle-Pass jeder Saison",
        "Gezielte Sculpts-Käufe für deinen Main-Wächter",
        "Equipment-Sets (Tank/Brawler/Sniper) wenn Saga ansteht",
      ]},
      { kind: "callout", tone: "warn", text: "Was du NICHT machst: 100€ in Resource-Pakete stecken. Das ist die schlechteste Effizienz im ganzen Shop. Resourcen sind in 24-48h durch normales Spielen rausgeholt." },
      { kind: "cta", href: "/pricing", label: "Preise ansehen" },
    ],
  },

  {
    slug: "anfaenger-guide-tag-eins",
    title: "Anfänger-Guide: Was du am ersten Tag in MyArea365 machst",
    description: "Die ersten 4 Stunden entscheiden über die nächsten 4 Wochen. Welche Buildings du baust, welche Crew du suchst, welche Forschungen du startest.",
    publishedAt: "2026-05-12",
    updatedAt: "2026-05-12",
    readingMinutes: 6,
    category: "Onboarding",
    heroEmoji: "🎮",
    blocks: [
      { kind: "p", text: "Willkommen bei MyArea365. Wenn du diesen Guide liest hast du wahrscheinlich gerade die Tutorial-Schritte hinter dir und stehst vor einer halb-vollen Heimat-Karte. Die nächsten 4 Stunden bestimmen mehr über deinen Spielfortschritt als die nächsten 4 Wochen. Hier die Reihenfolge die F2P-erprobt funktioniert." },

      { kind: "h2", text: "Schritt 1: Base setzen wo du wirklich wohnst" },
      { kind: "p", text: "Die Base-Position legt deine Heimat-Stadt fest. Wenn du gerade Urlaub machst, setze die Base lieber nicht vom Strand aus. Die Heimat-Stadt ist 'klebrig' — sie zu wechseln kostet Migration-Tokens (~2000 Diamanten oder Wochen-Sammelei)." },

      { kind: "h2", text: "Schritt 2: Recycling-Hof + Komponenten-Werk zuerst" },
      { kind: "p", text: "Die vier Produktions-Buildings (Recycling-Hof, Komponenten-Werk, Krypto-Mine, Datacenter) sind das wirtschaftliche Rückgrat. Bau sie alle vier auf Level 5 bevor du irgendetwas anderes anfasst. Die Burg auf Level 5 ist Voraussetzung dafür — diese Reihenfolge kostet ~3 Stunden mit Daily-Reward-Speedups." },
      { kind: "callout", tone: "tip", text: "Die ersten 3 Tage hast du Anfänger-Schutz: Niemand kann deine Resourcen plündern, niemand kann dich angreifen. Nutze das Fenster radikal — bau Lager NICHT, sondern verbrau die Resourcen sofort." },

      { kind: "h2", text: "Schritt 3: Wächter aktivieren" },
      { kind: "p", text: "Du bekommst beim ersten Login einen Starter-Wächter zugewiesen. Aktivier ihn. Auch wenn er Common-Rarity ist — XP sammelt er nur wenn er aktiv ist, und ohne XP keine Talent-Punkte." },
      { kind: "p", text: "Was du NICHT tust: Wächter aktivieren, vergessen, 3 Tage warten, dann wechseln. Das ist verlorene XP." },

      { kind: "h2", text: "Schritt 4: Crew suchen, nicht gründen" },
      { kind: "p", text: "Geh in den Stadt-Chat. Schau wer recruitet. Stell dich höflich vor (Name, Burg-Level, Spielzeiten). Wähle keine Crew bei der niemand antwortet — die ist tot. Wähle keine Crew die jeden ohne Frage nimmt — die ist Spam-recruited." },
      { kind: "ol", items: [
        "Frage nach Crew-Aktivität: 'Wann ist eure nächste Saga?' Antwort 'wir sind nicht in Saga aktiv' = Casual-Crew, OK für Anfänger.",
        "Frage nach Schwarzmarkt-Politik: 'Wer hebt Treasury ab?' Gute Antwort: Officer-Council mit Regeln. Schlechte Antwort: 'Der Leader regelt das'.",
        "Frage nach Officer-Slots: Wie viele Officer pro 15 Member? Antwort >5 = Wildwuchs, Antwort 1-2 = professionell.",
      ]},

      { kind: "h2", text: "Schritt 5: Erste Forschungen" },
      { kind: "p", text: "Das Forschungs-Modal hat 5 Branchen: Wirtschaft, Militär, Verteidigung, Kampf, Wächter. Für Tag 1 priorisierst du Wirtschaft — Resourcen-Produktion +5% pro Level ist nicht spektakulär, aber 30-Tage-summiert massiv." },
      { kind: "ul", items: [
        "Wirtschaft Tier 1: alle Pflichtknoten (Holz-/Stein-/Gold-/Mana-Produktion) auf Level 5.",
        "Lager-Kapazität: +10% pro Stufe, hilft gegen Resource-Cap-Limit.",
        "Bau-Slot-Erweiterung: gibt dir einen zweiten parallelen Bau-Auftrag — DAS ist Gold-wert.",
      ]},

      { kind: "h2", text: "Schritt 6: Mautstation für RSS-Schutz" },
      { kind: "p", text: "Sobald dein Anfänger-Schutz endet, bist du Plünderziel. Eine Mautstation auf Level 3 schützt dauerhaft einen Teil deiner ungebundenen Resourcen — Geheim-Tresor ab Burg 3 erweitert das massiv." },

      { kind: "h2", text: "Was du am ersten Tag nicht machst" },
      { kind: "ul", items: [
        "Crew gründen ohne Erfahrung: Du wirst frustriert sein. Versprochen.",
        "Diamanten ausgeben: Das First-Purchase-Bonus-Fenster ist zu wertvoll für Impuls-Käufe.",
        "Konflikte suchen: Du verlierst gegen jeden Burg-15+-Spieler. Wirtschaft erst, Aggression später.",
        "Migration-Token kaufen: Du kennst deine Stadt noch nicht. Warte mindestens 1 Woche bevor du wechselst.",
        "Alle Achievements jagen: Frühe Achievements geben kleine Belohnungen. Spar dir die Zeit für Aktivitäten die deinen Account-Wachstum beschleunigen.",
      ]},

      { kind: "h2", text: "Tag-2-Checkliste" },
      { kind: "ol", items: [
        "Crew gefunden und akzeptiert",
        "Burg auf Level 7 (mindestens)",
        "4 Produktions-Buildings auf Level 5",
        "Wächter Level 5+ (durch passive XP über Nacht)",
        "Wirtschafts-Forschung Tier 1 abgeschlossen",
        "Daily-Reward 2x kassiert",
      ]},
      { kind: "p", text: "Wenn du das schaffst bist du in der oberen Hälfte aller Tag-2-Spieler. Nicht weil's schwer ist, sondern weil viele die Reihenfolge falsch angehen." },
      { kind: "cta", href: "/registrieren", label: "Jetzt anmelden und loslegen" },
    ],
  },
];

export function getArticleBySlug(slug: string): Article | undefined {
  return ARTICLES.find((a) => a.slug === slug);
}
