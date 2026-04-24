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
        {/* Chroma-Key Green-Screen mit DE-SPILL (schwarze Kante weg).
            Schritt 1: Alpha aus Original berechnen (R + B − G + 0.3)
            Schritt 2: Alpha hart schwellen
            Schritt 3: Separater Pfad: Farben „entgrünen" (G → Mittel aus R und B)
            Schritt 4: Composite → Charakter-Kanten haben cleane Farben statt grünem Rand */}
        <filter id="ma365-chroma-black" colorInterpolationFilters="sRGB">
          {/* Pfad A: Alpha-Key — stärker auf Grün gewichtet (G zählt doppelt negativ),
              damit mittlere Oliv-/Limetten-Grüntöne auch noch ausgeblendet werden. */}
          <feColorMatrix
            in="SourceGraphic"
            result="keyAlphaRaw"
            type="matrix"
            values="
              0  0 0 0 0
              0  0 0 0 0
              0  0 0 0 0
              1 -2 1 0 0.2
            "
          />
          <feComponentTransfer in="keyAlphaRaw" result="keyAlpha">
            <feFuncA type="linear" slope={14} intercept={-0.25} />
          </feComponentTransfer>
          {/* Pfad B: despilled RGB — Grün durch Mittel aus Rot und Blau ersetzt
              (entfernt grünen Kantensaum an Charakter-Silhouetten) */}
          <feColorMatrix
            in="SourceGraphic"
            result="despilled"
            type="matrix"
            values="
              1   0   0   0 0
              0.5 0   0.5 0 0
              0   0   1   0 0
              0   0   0   1 0
            "
          />
          {/* Composite: despilled Farben × keyAlpha.alpha */}
          <feComposite in="despilled" in2="keyAlpha" operator="in" />
        </filter>
      </defs>
    </svg>
  );
}
