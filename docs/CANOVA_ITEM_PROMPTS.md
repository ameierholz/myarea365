# Canova Pro / Scenario.gg Prompts für Wächter-Ausrüstung

Alle 108 Items im `item_catalog` (Migration 00020). Für Canova Pro oder Scenario.gg zum Generieren der Artwork.

## Globale Style-Anker

```
Ein einzelnes [ITEM] auf dunkelblauem Gradient-Hintergrund #0F1115 → #1A1D23,
zentriert, 3/4-Perspektive, subtile Reflexion,
Beleuchtung warm von rechts oben.
Stil: Magic: The Gathering Key Art, Diablo-4-Inventar, Duelyst.
Lesbare Silhouette, weicher Drop-Shadow, KEIN Text, KEIN Logo.
Auflösung 1024×1024, Transparenz-kompatibel (Alpha-Edges sanft).
```

## Rarity-Farbmodifier (immer hinzufügen)

- **Common (grau)**: `matte grey-silver metal, leather, plain, muted tones`
- **Rare (grün)**: `emerald green accents, subtle teal runes, polished steel`
- **Epic (lila)**: `deep violet glow, arcane purple runes, floating sparkles, translucent crystal`
- **Legendary (gold)**: `glowing gold, fire particles, godly aura, legendary halo, molten highlights`

## Slot-Basis-Prompts

### 🪖 Kopf (helm) — 12 Items
| ID | Name | Rarity | Prompt-Basis |
|---|---|---|---|
| helm_common_1 | Runner-Stirnband | common | `simple knitted headband with reflective stripe, black fabric` |
| helm_common_2 | Wollmütze | common | `grey knit beanie with small tag` |
| helm_common_3 | Leinenkappe | common | `plain linen cap, medieval style, weathered` |
| helm_rare_1 | Lauf-Visor | rare | `sport visor with polarized green visor, carbon-finish frame` |
| helm_rare_2 | Kettenhaube | rare | `chainmail coif, blackened steel, emerald rivets` |
| helm_rare_3 | Eisenhelm | rare | `iron kettle helm, riveted plates, subtle green engraving` |
| helm_epic_1 | Arkane Kapuze | epic | `hooded mage cap, floating violet runes along the edge, translucent fabric` |
| helm_epic_2 | Schatten-Mesh | epic | `obsidian mesh hood, glowing purple eyes, wispy smoke` |
| helm_epic_3 | Schattenkapuze | epic | `pitch-black assassin hood, violet glow underneath, silver dagger pattern` |
| helm_legend_1 | Himmelskrone | legend | `royal golden crown with sunburst rays, floating halo, diamond insets` |
| helm_legend_2 | Drachenhelm | legend | `draconic fire helm, molten gold scales, flame wisps at the top` |
| helm_legend_3 | Krone der Nacht | legend | `black-gold night crown with starfield mantle, glowing constellation gems` |

### 🎽 Schulter (shoulders) — 12 Items
| ID | Name | Rarity | Prompt-Basis |
|---|---|---|---|
| shoulders_common_1 | Lederriemen | common | `leather straps with simple buckle, worn brown` |
| shoulders_common_2 | Wollumhang | common | `short grey wool shawl, rough weave` |
| shoulders_common_3 | Stoffpolster | common | `cloth pauldron padding, khaki, practical` |
| shoulders_rare_1 | Bronze-Schulter | rare | `single bronze pauldron with emerald trim` |
| shoulders_rare_2 | Geweihter Mantel | rare | `short blessed mantle, green-white embroidery, iron clasp` |
| shoulders_rare_3 | Stahlepauletten | rare | `polished steel epaulettes with tiny green gems` |
| shoulders_epic_1 | Mystischer Umhang | epic | `starfield mantle, violet nebula texture, floating runes` |
| shoulders_epic_2 | Arkan-Pauldrons | epic | `crystalline purple pauldrons, levitating shards, violet mist` |
| shoulders_epic_3 | Schattenmantel | epic | `flowing black mantle with purple inner lining, smoke wisps` |
| shoulders_legend_1 | Drachenschulter | legend | `massive dragon scale pauldron, molten gold veins, small flames` |
| shoulders_legend_2 | Götter-Mantel | legend | `radiant golden mantle with sunrays, celestial embroidery` |
| shoulders_legend_3 | Äther-Pauldrons | legend | `crystalline gold pauldrons with floating orbs, godly aura` |

### 🛡️ Brust (chest) — 12 Items
| ID | Name | Rarity | Prompt-Basis |
|---|---|---|---|
| chest_common_1 | Laufshirt | common | `simple grey running t-shirt with reflective strip` |
| chest_common_2 | Wollweste | common | `plain grey wool vest, practical, utility pockets` |
| chest_common_3 | Leinentunika | common | `medieval beige linen tunic, rope belt` |
| chest_rare_1 | Lederharnisch | rare | `studded leather cuirass, green laces` |
| chest_rare_2 | Kettenpanzer | rare | `chainmail hauberk, emerald sash, riveted plates` |
| chest_rare_3 | Kettenrüstung | rare | `shining chainmail with subtle green gems` |
| chest_epic_1 | Arkane Robe | epic | `deep violet mage robe with gold trim, floating runes` |
| chest_epic_2 | Schatten-Harnisch | epic | `black iron breastplate with violet glow, dark smoke` |
| chest_epic_3 | Kristall-Rüstung | epic | `translucent purple crystal breastplate, levitating shards` |
| chest_legend_1 | Titanharnisch | legend | `heavy golden plate with fire engravings, molten veins, flame aura` |
| chest_legend_2 | Götterrobe | legend | `divine white-gold robe with celestial patterns, holy light` |
| chest_legend_3 | Drachenbrustplatte | legend | `massive dragon scale cuirass, red-gold, flame wisps` |

### 🧤 Hände (hands) — 12 Items
Items `hands_common_1` bis `hands_legend_3`. Konzepte: Lederhandschuhe, Faustwickel, Wollfäustlinge, Stahlfäuste, Pfotenklauen, Runengauntlet, Schattenfäuste, Sturmklauen, Arkane Gauntlets, Titan-Fäuste, Göttergauntlets, Drachenklauen.

Basis-Prompt: `[ITEM-NAME], detailed gauntlets or gloves, [RARITY modifier], 3/4 view, shown as pair, tangible materials.`

### ⌚ Handgelenk (wrist) — 12 Items
Items `wrist_common_1` bis `wrist_legend_3`. Konzepte: Stoffband, Sportuhr, Armschiene, Runenarmband, Stahlreif, Bogen-Bracer, Arkanes Armband, Schattenreif, Mystik-Bracer, Götter-Armschiene, Drachen-Reif, Ewigkeits-Bracer.

Basis-Prompt: `[ITEM-NAME], bracer/wristband, [RARITY modifier], shown on invisible wrist or floating, side view.`

### 📿 Kette (neck) — 12 Items
Items `neck_common_1` bis `neck_legend_3`. Konzepte: Paracord-Kette, Lederband, Hanfkette, Bronze-Medaillon, Silber-Anhänger, Kristall-Pendant, Arkan-Pentagramm, Schatten-Amulett, Runen-Torque, Götter-Torque, Drachen-Zahn, Ewigkeits-Kette.

Basis-Prompt: `[ITEM-NAME], necklace floating centered, pendant visible, [RARITY modifier], soft specular.`

### 💍 Ring (ring) — 12 Items
Items `ring_common_1` bis `ring_legend_3`. Stat-fokussierte Ringe (HP/ATK/DEF/SPD).

Basis-Prompt: `A single ring [RARITY modifier], centered, 3/4 view, inscribed band, stylized as [HP = green heart gem / ATK = red blade gem / DEF = blue shield gem / SPD = gold lightning gem].`

### 👟 Schuhe (boots) — 12 Items
Items `boots_common_1` bis `boots_legend_3`. Konzepte: Laufschuhe, Sandalen, Gummistiefel, Carbon-Runner, Windläufer, Stahlkappen, Schattenläufer, Sturmstiefel, Mystische Mocs, Götterschuhe, Drachenstiefel, Titanenschritt.

Basis-Prompt: `[ITEM-NAME] boots, pair, [RARITY modifier], side-angle, shown standing as if invisible foot inside.`

### ⚔️ Waffe (weapon) — 12 Items
Items `weapon_common_1` bis `weapon_legend_3`. Konzepte: Holzstock, Schlüsselbund, Taschenlampe, Eisendolch, Stadtstab, Handschmiede-Axt, Schattenklinge, Arkan-Stab, Sturm-Hammer, Götter-Zweihänder, Drachentöter, Titanen-Axt.

Basis-Prompt: `[ITEM-NAME], single weapon centered, diagonal 45-degree, [RARITY modifier], dramatic lighting, glowing runes/edge for rare+.`

## Scenario.gg Workflow

1. Model-Training: 5-10 Reference-Images im gewünschten Stil (Diablo/MTG/Duelyst).
2. Pro Slot ein eigenes Generator-Preset erstellen.
3. Batch-Generieren mit Prompt pro Item, `seed` fest für Konsistenz innerhalb einer Rarity.
4. Output nach `apps/web/public/items/<id>.png` speichern.
5. `item_catalog.image_url` Spalte später hinzufügen und befüllen.

## Naming-Konvention für Files

```
/public/items/<slot>/<id>.png
z.B.
/public/items/helm/helm_epic_2.png
/public/items/weapon/weapon_legend_1.png
```

---
Letzte Aktualisierung: 2026-04-20 · Siehe auch `lib/loot-drops-public.ts` für Drop-Raten.
