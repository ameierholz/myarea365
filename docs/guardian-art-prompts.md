# Guardian Art Generation — Prompt Master

## Workflow

1. **Tool**: Midjourney (`--style raw --ar 2:3 --v 6.1`) oder DALL-E 3 oder Scenario.gg.
2. **Konsistenz**: gleicher **Style-Prefix** für alle 20 Wächter. Bei Midjourney `--seed 42` wiederverwenden.
3. **Pro Wächter 2 Bilder**: `_idle.png` + `_attack.png`.
4. **Export**: transparenter PNG 512×768, Dateiname `{id}_idle.png` / `{id}_attack.png`.
5. **Ablage**: `apps/web/public/guardians/`

## Style-Prefix (vor jeden Prompt kopieren)

```
urban fantasy character portrait, full body, dark neon Berlin background,
cinematic rim lighting, trading card game style, painterly detail,
transparent background PNG, consistent style across series, same lighting,
```

## Pro Wächter

### COMMON

**stadtfuchs — Gossendieb** (🥷)
- Lore: Schnelle Finger, schnelle Füße.
- Idle: `{STYLE} a lean street thief in dark hoodie, face half-hidden, two throwing daggers, smirking`
- Attack: `{STYLE} same thief lunging forward with dagger strike, motion blur, dust kicked up`

**dachs — Schildwache** (🛡️)
- Lore: Wer an ihm vorbeikommt hat sich verlaufen.
- Idle: `{STYLE} stocky guard in iron helmet holding a warhammer, round shield, heavy posture`
- Attack: `{STYLE} same guard slamming hammer down, shield raised, sparks flying`

**taube — Tänzer** (💃)
- Lore: Schwerelos zwischen Schlägen.
- Idle: `{STYLE} elegant dancer in flowing silver beret and robes, mid-pose, fan in hand`
- Attack: `{STYLE} same dancer spinning, fan slicing air, ribbons trailing`

**spatz — Gassenjunge** (🧒)
- Lore: Schmal, schnell, kommt in Schwärmen.
- Idle: `{STYLE} scrappy street kid in oversized cap, holding small dagger, street-smart grin`
- Attack: `{STYLE} same kid darting forward with quick stab, low angle`

**strassenhund — Söldner** (🤺)
- Lore: Bezahlt mit Treue — wenn sie knapp wird, wird er gefährlich.
- Idle: `{STYLE} tough mercenary in bandana, sword resting on shoulder, scars on face`
- Attack: `{STYLE} same mercenary swinging sword in wide arc, fierce expression`

**ratte — Apotheker** (⚗️)
- Lore: Heilung für Freunde, Gift für Feinde.
- Idle: `{STYLE} hooded alchemist in dark cowl, holding bubbling green vial and flail`
- Attack: `{STYLE} same alchemist throwing green poison vial, smoke cloud rising`

### RARE

**nachteule — Straßenmagier** (🧙)
- Lore: Er sieht deine Angriffe bevor du sie denkst.
- Idle: `{STYLE} teal-robed street mage, pointed hat with star, crystal staff glowing cyan`
- Attack: `{STYLE} same mage casting lightning from staff, arcane runes glowing around him`

**waschbaer — Dieb** (🦹)
- Lore: Dir fehlt etwas. Er hat es.
- Idle: `{STYLE} masked thief in teal cloak, two daggers, sly grin, night sky background`
- Attack: `{STYLE} same thief leaping with dagger spin, coins falling around`

**stadtkatze — Parkour-Mönch** (🧘)
- Lore: Gefallen, aufgestanden, wieder gefallen — und wieder auf.
- Idle: `{STYLE} lean monk in teal martial-arts robe, barefoot, calm stance, no weapon`
- Attack: `{STYLE} same monk flying kick mid-air, wind trails behind`

**eule — Gelehrte** (📜)
- Lore: Studiert jeden Gegner bevor sie zuschlägt.
- Idle: `{STYLE} teal-robed scholar woman, round glasses, floating tome with glowing runes`
- Attack: `{STYLE} same scholar hurling magical script, glowing letters striking forward`

**fledermaus — Schatten** (👤)
- Lore: Du hörst sie nicht, du siehst sie nicht, du triffst sie nicht.
- Idle: `{STYLE} shadowy assassin in teal dark cowl, only eyes visible, dagger drawn`
- Attack: `{STYLE} same figure dissolving into shadow mid-strike, ink-like smoke trail`

**moewe — Meuchler** (🗡️)
- Lore: Einmal zuschlagen, einmal verschwinden.
- Idle: `{STYLE} rogue in teal hooded cape, crouched, dagger in reverse grip, rooftop setting`
- Attack: `{STYLE} same rogue pouncing from above with dagger, cape flaring`

### EPIC

**rudelalpha — Hauptmann** (🎖️)
- Lore: Wo er steht, steht die ganze Crew.
- Idle: `{STYLE} regal captain in purple armor with gold trim, warcrown, spear planted, banner behind`
- Attack: `{STYLE} same captain thrusting spear forward, shield raised, rallying pose`

**eber — Paladin** (🛡️)
- Lore: Der Boden bebt wenn er anrückt.
- Idle: `{STYLE} massive paladin in purple plate armor, horned helm, warhammer, tower shield`
- Attack: `{STYLE} same paladin slamming hammer into ground, shockwave, stone cracking`

**wolf — Assassine** (🥷)
- Lore: Er schlägt zweimal bevor du ihn siehst.
- Idle: `{STYLE} sleek assassin in purple-black leather, dual daggers, shadow cloak hood`
- Attack: `{STYLE} same assassin mid-backstab, two daggers crossed, shadow trail behind`

**baer — Berserker** (🪓)
- Lore: Je mehr du triffst, desto gefährlicher wird er.
- Idle: `{STYLE} massive berserker in purple fur armor, horned helm, giant axe, scars`
- Attack: `{STYLE} same berserker mid-swing with axe, flames around blade, roaring`

### LEGEND

**falke — Schnellklinge** (⚔️)
- Lore: Legende erzählt: ein Hieb reicht.
- Idle: `{STYLE} golden-armored swordmaster, regal crown, glowing longsword, feathered cape`
- Attack: `{STYLE} same swordmaster mid-dash, sword trail of gold light, afterimage effect`

**drache — Erzmagier** (🔥)
- Lore: Aus einer Zeit vor Städten und Straßen.
- Idle: `{STYLE} ancient archmage in gold-trim purple robes, pointed hat, staff with floating orb`
- Attack: `{STYLE} same archmage hurling massive fireball, flames engulfing his hands`

**phoenix — Hohepriester** (✨)
- Lore: Tod ist für ihn nur ein Übergang.
- Idle: `{STYLE} serene high priest in white-gold robes, floating halo of light, staff with feather`
- Attack: `{STYLE} same priest bathed in golden resurrection light, phoenix wings of fire behind`

**wyvern — Sturmritter** (⚡)
- Lore: Dächer sind seine Jagdgründe, Straßen seine Speisekammer.
- Idle: `{STYLE} armored knight in golden plate with dragon motifs, dragon-hilted spear, cape`
- Attack: `{STYLE} same knight descending from sky with spear strike, lightning crackling around him`

## Nach dem Generieren

1. Bilder in `apps/web/public/guardians/` ablegen mit exakt diesen Dateinamen:
   - `stadtfuchs_idle.png`, `stadtfuchs_attack.png`
   - `dachs_idle.png`, `dachs_attack.png`
   - ... (20 × 2 = 40 Dateien)
2. Commit + Push. Die `<GuardianAvatar>`-Komponente erkennt automatisch ob Bild existiert und nutzt PNG statt SVG.

## Alternativ: erstmal 2–3 Test-Bilder machen

Generier erst nur **Gossendieb + Paladin + Erzmagier** als Test — damit wir sehen ob der Stil konsistent wird bevor du alle 40 machst.
