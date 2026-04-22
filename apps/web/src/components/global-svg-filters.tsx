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
        {/* Chroma-Key Green-Screen: macht pures #00FF00 transparent.
            alpha = R + B - G + 0.3 → Grün (0,1,0) ergibt -0.7 → 0.
            feComponentTransfer mit harter Schwelle für sauberen Kantenschnitt. */}
        <filter id="ma365-chroma-black" colorInterpolationFilters="sRGB">
          <feColorMatrix
            type="matrix"
            values="
              1  0 0 0 0
              0  1 0 0 0
              0  0 1 0 0
              1 -1 1 0 0.3
            "
          />
          <feComponentTransfer>
            <feFuncA type="linear" slope={8} intercept={-0.1} />
          </feComponentTransfer>
        </filter>
      </defs>
    </svg>
  );
}
