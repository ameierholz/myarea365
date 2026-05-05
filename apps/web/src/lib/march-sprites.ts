/**
 * Helpers für das Rendering von 3D-Begleitern als 2D-Sprite-Billboards
 * auf der Karte (Phase 3a).
 *
 * Wird verbraucht vom MarchSpritesLayer (custom Mapbox WebGL layer).
 */

export type SpriteManifest = {
  char_id: string;
  action: string;
  cell_w: number;
  cell_h: number;
  directions: number;
  frames: number;
  atlas: string;       // public URL zum Sprite-Atlas (z.B. /sprites/lorekeeper/walk.png)
  atlas_w: number;
  atlas_h: number;
};

export type ActionTag = "idle" | "walk" | "run" | "attack" | "hit";
const ALL_ACTIONS: ActionTag[] = ["idle", "walk", "run", "attack", "hit"];

const _cache = new Map<string, Promise<SpriteManifest>>();
const _imageCache = new Map<string, Promise<HTMLImageElement>>();

/** Lädt das JSON-Manifest für eine (char, action)-Kombination — gecached. */
export function loadManifest(charId: string, action: ActionTag): Promise<SpriteManifest> {
  const key = `${charId}/${action}`;
  let p = _cache.get(key);
  if (p) return p;
  p = fetch(`/sprites/${charId}/${action}.json`, { cache: "force-cache" })
    .then((r) => {
      if (!r.ok) throw new Error(`Sprite manifest 404: ${key}`);
      return r.json() as Promise<SpriteManifest>;
    });
  _cache.set(key, p);
  return p;
}

/** Lädt alle 5 Action-Manifeste eines Chars. Schluckt 404 falls eine Action fehlt. */
export async function loadAllManifests(charId: string): Promise<Partial<Record<ActionTag, SpriteManifest>>> {
  const results = await Promise.all(
    ALL_ACTIONS.map(async (action) => {
      try {
        const m = await loadManifest(charId, action);
        return [action, m] as const;
      } catch {
        return [action, null] as const;
      }
    })
  );
  const out: Partial<Record<ActionTag, SpriteManifest>> = {};
  for (const [k, v] of results) if (v) out[k] = v;
  return out;
}

/** Lädt das Atlas-PNG als HTMLImageElement (für WebGL-Texture-Upload). */
export function loadAtlasImage(url: string): Promise<HTMLImageElement> {
  let p = _imageCache.get(url);
  if (p) return p;
  p = new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = (e) => reject(new Error(`Atlas load failed: ${url} (${e})`));
    img.src = url;
  });
  _imageCache.set(url, p);
  return p;
}

/**
 * Berechnet aus einem Bearing (Grad, 0=Nord, im Uhrzeigersinn) den
 * Direction-Index (0..directions-1) für das Sprite-Sheet.
 * dir 0 = Süd (Char schaut zur Kamera), dir 2 = Ost, dir 4 = Nord, dir 6 = West.
 */
export function bearingToDirectionIndex(bearingDeg: number, directions: number): number {
  // Normalize 0..360
  let b = ((bearingDeg % 360) + 360) % 360;
  // Verschiebe so dass 0° (Nord) → mittig zwischen Süd-Bins fällt
  // (Char-Render-Konvention: dir 0 = facing camera = south-facing)
  b = (b + 180) % 360;
  const sliceWidth = 360 / directions;
  return Math.floor((b + sliceWidth / 2) / sliceWidth) % directions;
}

/**
 * Lineare Interpolation zwischen zwei lat/lng-Punkten basierend auf
 * progress (0..1). Für kurze Distanzen (Stadt-Range) ausreichend genau.
 * Für grosse Distanzen oder bei Bedarf an Straßen-Routen → Mapbox-Directions-API.
 */
export function interpolatePosition(
  fromLat: number, fromLng: number,
  toLat: number, toLng: number,
  progress: number,
): [number, number] {
  const t = Math.max(0, Math.min(1, progress));
  return [
    fromLat + (toLat - fromLat) * t,
    fromLng + (toLng - fromLng) * t,
  ];
}

/** Großkreis-Bearing in Grad (0=Nord, im Uhrzeigersinn) zwischen zwei Punkten. */
export function bearingBetween(fromLat: number, fromLng: number, toLat: number, toLng: number): number {
  const φ1 = (fromLat * Math.PI) / 180;
  const φ2 = (toLat * Math.PI) / 180;
  const Δλ = ((toLng - fromLng) * Math.PI) / 180;
  const y = Math.sin(Δλ) * Math.cos(φ2);
  const x = Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);
  const θ = Math.atan2(y, x);
  return ((θ * 180) / Math.PI + 360) % 360;
}

/** Berechnet den aktuellen Frame-Index für eine animierte Action. */
export function frameIndexForTime(timeMs: number, frameCount: number, fps = 12): number {
  if (frameCount <= 1) return 0;
  return Math.floor((timeMs * fps) / 1000) % frameCount;
}
