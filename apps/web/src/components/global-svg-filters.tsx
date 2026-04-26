/**
 * Globale SVG-Filter die in der ganzen App per `filter: url(#id)` verwendbar sind.
 * Wird einmal im Root-Layout gerendert.
 */
export function GlobalSvgFilters() {
  return (
    <svg
      width="0"
      height="0"
      style={{ position: "absolute", width: 0, height: 0, overflow: "hidden" }}
      aria-hidden
    >
      <defs>
        {/* Chroma-Key Green-Screen mit DE-SPILL.
            Vorher: 1R − 2G + 1B + 0.2 mit slope=14 → tötete bronze-/gold-/feuer-
            farbige Objekte mit Green-Spill (Waffen, Mündungsfeuer) zu aggressiv.

            Jetzt: 1R − 1G + 1B + 0.1 mit slope=12 → keyt nur Pixel wo G > R+B
            (echte Chroma-Greens), behält warme Töne mit Grünanteil. */}
        <filter id="ma365-chroma-black" colorInterpolationFilters="sRGB">
          {/* Pfad A: Alpha-Key — Chroma-Differenz (R+B vs G).
              Pure Green (0,1,0)         → -0.9   → -10.8 → α=0  (transparent)
              Lime (0.5,1,0)             → -0.4   →  -4.8 → α=0  (transparent)
              Yellow Beak (1,0.95,0)     →  0.15  →   1.8 → α=1  (sichtbar)
              Bronze (0.6,0.4,0.05)      →  0.35  →   4.2 → α=1  (sichtbar)
              Bronze+Spill (0.5,0.5,0.05)→  0.15  →   1.8 → α=1  (sichtbar) ← Waffe!
              Fire (1,0.7,0.2)           →  0.60  →   7.2 → α=1  (sichtbar) ← Mündung! */}
          <feColorMatrix
            in="SourceGraphic"
            result="keyAlphaRaw"
            type="matrix"
            values="
              0  0  0 0 0
              0  0  0 0 0
              0  0  0 0 0
              1 -1  1 0 0.1
            "
          />
          <feComponentTransfer in="keyAlphaRaw" result="keyAlpha">
            <feFuncA type="linear" slope={12} intercept={0} />
          </feComponentTransfer>
          {/* Pfad B: despilled RGB — sanftes De-Spill: G um 30% gedämpft, durch
              R+B teilweise ersetzt. Erhält ursprüngliche Farben besser als das
              alte 50/50-Replace, das alle Grüntöne flach gemacht hat. */}
          <feColorMatrix
            in="SourceGraphic"
            result="despilled"
            type="matrix"
            values="
              1    0    0    0 0
              0.15 0.7  0.15 0 0
              0    0    1    0 0
              0    0    0    1 0
            "
          />
          {/* Composite: despilled Farben × keyAlpha.alpha */}
          <feComposite in="despilled" in2="keyAlpha" operator="in" />
        </filter>
      </defs>
    </svg>
  );
}
