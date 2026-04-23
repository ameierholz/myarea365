/**
 * Zentrale Shop-Kategorien-Liste.
 * Nach Gruppen gegliedert für optgroup-Darstellung in Dropdowns.
 * Als flache Liste für Filter/Validierung via SHOP_CATEGORIES.
 */

export const SHOP_CATEGORY_GROUPS: { label: string; items: string[] }[] = [
  {
    label: "Essen & Trinken",
    items: [
      "Café",
      "Bar",
      "Restaurant",
      "Imbiss / Takeaway",
      "Eisdiele",
      "Bäckerei",
      "Konditorei",
      "Weinbar",
      "Teeladen / Kaffeeladen",
    ],
  },
  {
    label: "Lebensmittel",
    items: [
      "Supermarkt",
      "Bio-Laden / Reformhaus",
      "Metzgerei",
      "Feinkost / Delikatessen",
      "Obst & Gemüse / Markt",
      "Kiosk / Spätkauf",
      "Zeitungsladen",
      "Getränkemarkt",
      "Wein- & Spirituosenhandel",
    ],
  },
  {
    label: "Shopping",
    items: [
      "Boutique / Modegeschäft",
      "Buchhandlung",
      "Schreibwaren",
      "Spielwaren",
      "Schuhladen",
      "Juwelier / Uhren",
      "Blumenladen",
      "Zoohandlung",
      "Elektronik",
      "Fahrradladen",
      "Second-Hand / Vintage",
    ],
  },
  {
    label: "Gesundheit & Körper",
    items: [
      "Apotheke",
      "Optiker",
      "Drogerie",
      "Friseur",
      "Kosmetik / Nagelstudio",
      "Massage / Spa",
      "Physio",
      "Zahnarzt / Praxis",
    ],
  },
  {
    label: "Sport & Freizeit",
    items: [
      "Sportgeschäft",
      "Fitness-Studio",
      "Yoga- / Pilates-Studio",
      "Kletter- / Boulderhalle",
      "Schwimmbad",
    ],
  },
  {
    label: "Service",
    items: [
      "Reinigung / Wäscherei",
      "Copyshop / Druckerei",
      "Paketshop / Post",
      "Reparatur (Handy / Elektro)",
      "Fahrrad-Werkstatt",
      "Coworking-Space",
    ],
  },
  {
    label: "Kultur & Übernachtung",
    items: [
      "Hotel / Pension",
      "Eventlocation",
      "Galerie / Museum",
      "Kino / Theater",
      "Tattoo / Piercing",
    ],
  },
  {
    label: "Sonstiges",
    items: ["Sonstiges"],
  },
];

/** Flache Liste aller Kategorien (für Validierung + Filter-Dropdowns). */
export const SHOP_CATEGORIES: string[] = SHOP_CATEGORY_GROUPS.flatMap((g) => g.items);
