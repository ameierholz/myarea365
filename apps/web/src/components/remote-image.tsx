/**
 * RemoteImage — leichter `<img>`-Ersatz mit lazy-loading + sensible Defaults.
 *
 * Warum nicht `next/image`?
 *   Viele unserer Bilder kommen dynamisch aus Supabase Storage und haben
 *   keine bekannten Dimensionen. `next/image` erfordert width/height oder
 *   `fill`-Mode mit positioniertem Container, was die meisten Use-Cases
 *   (Avatar/Banner/Artwork in Listen) brechen würde.
 *
 *   Stattdessen nutzen wir `<img>` mit:
 *     - `loading="lazy"` (außer wenn `priority` gesetzt) → spart LCP
 *     - `decoding="async"` → Render-Thread bleibt frei
 *     - `referrerPolicy="no-referrer"` → keine ungewollten URL-Leaks
 *
 *   Für AVIF/WebP setzen wir auf Supabase-Image-Transform-API (nicht hier
 *   abstrahiert — bleibt explicit pro Use-Case).
 *
 * Migration-Pfad: `<img src=... />` → `<RemoteImage src=... />`. Drop-in.
 */

import type { ImgHTMLAttributes } from "react";

export type RemoteImageProps = ImgHTMLAttributes<HTMLImageElement> & {
  /** Wenn true, lädt das Bild eagerly (für Above-the-fold Hero-Bilder). */
  priority?: boolean;
};

export function RemoteImage({ priority, loading, decoding, referrerPolicy, alt, ...rest }: RemoteImageProps) {
  return (
    // eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text
    <img
      loading={loading ?? (priority ? "eager" : "lazy")}
      decoding={decoding ?? "async"}
      referrerPolicy={referrerPolicy ?? "no-referrer"}
      alt={alt ?? ""}
      {...rest}
    />
  );
}
