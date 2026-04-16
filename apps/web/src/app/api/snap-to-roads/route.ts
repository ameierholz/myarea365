import { NextResponse } from "next/server";

/**
 * Mapbox Map Matching — Snap-to-Roads für Gehwege/Pfade/Straßen.
 * Erwartet POST-Body: { coords: Array<{ lat: number; lng: number }> }
 * Gibt zurück: { path, distance_m, duration_s, streets, confidence } oder null bei Fehler.
 *
 * Mapbox hat 100 Punkte/Request Limit → wir chunken automatisch.
 */

const MAPBOX_TOKEN = process.env.MAPBOX_ACCESS_TOKEN;
const MAPBOX_URL = "https://api.mapbox.com/matching/v5/mapbox/walking";
const MAX_POINTS_PER_REQUEST = 100;

type Coord = { lat: number; lng: number };

type Matching = {
  confidence: number;
  geometry: { coordinates: [number, number][] };
  distance: number;
  duration: number;
  legs: Array<{ summary?: string }>;
};

type MapboxResponse = {
  code?: string;
  matchings?: Matching[];
  message?: string;
};

async function matchChunk(coords: Coord[]): Promise<Matching | null> {
  if (coords.length < 2 || !MAPBOX_TOKEN) return null;

  const coordsStr = coords.map((c) => `${c.lng},${c.lat}`).join(";");
  const radiuses = coords.map(() => "25").join(";"); // 25m Suchradius pro Punkt

  const url = `${MAPBOX_URL}/${coordsStr}?geometries=geojson&annotations=distance,duration&overview=full&steps=true&radiuses=${radiuses}&access_token=${MAPBOX_TOKEN}`;

  try {
    const res = await fetch(url);
    const data = (await res.json()) as MapboxResponse;
    if (data.code !== "Ok" || !data.matchings?.length) return null;
    return data.matchings[0];
  } catch {
    return null;
  }
}

// Dünnt GPS-Punkte aus wenn zu viele (nur jeden N-ten nehmen)
function decimate(coords: Coord[], maxTotal: number): Coord[] {
  if (coords.length <= maxTotal) return coords;
  const step = coords.length / maxTotal;
  const out: Coord[] = [];
  for (let i = 0; i < maxTotal; i++) {
    out.push(coords[Math.floor(i * step)]);
  }
  // letzter Punkt muss immer drin sein
  if (out[out.length - 1] !== coords[coords.length - 1]) {
    out.push(coords[coords.length - 1]);
  }
  return out;
}

export async function POST(req: Request) {
  if (!MAPBOX_TOKEN) {
    return NextResponse.json(
      { error: "MAPBOX_ACCESS_TOKEN fehlt in .env.local" },
      { status: 500 }
    );
  }

  let body: { coords: Coord[] };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Ungültiges JSON" }, { status: 400 });
  }

  const coords = body.coords;
  if (!Array.isArray(coords) || coords.length < 2) {
    return NextResponse.json({ error: "Mindestens 2 Koordinaten nötig" }, { status: 400 });
  }

  // Auf höchstens 500 Punkte ausdünnen (= max 5 Chunks à 100)
  const decimated = decimate(coords, 500);

  // In Chunks à 100 Punkte schicken, 1 Punkt Overlap für Kontinuität
  const chunks: Coord[][] = [];
  for (let i = 0; i < decimated.length; i += MAX_POINTS_PER_REQUEST - 1) {
    chunks.push(decimated.slice(i, i + MAX_POINTS_PER_REQUEST));
  }

  const results = await Promise.all(chunks.map(matchChunk));

  const validMatches = results.filter((m): m is Matching => m !== null);
  if (validMatches.length === 0) {
    return NextResponse.json({ error: "Mapbox konnte Route nicht matchen" }, { status: 502 });
  }

  // Ergebnisse zusammenfügen
  const allCoords: [number, number][] = [];
  const streetSet = new Set<string>();
  let totalDistance = 0;
  let totalDuration = 0;
  let confidenceSum = 0;

  validMatches.forEach((m, idx) => {
    // Overlap-Punkt beim zweiten+ Chunk überspringen
    const coords = idx === 0 ? m.geometry.coordinates : m.geometry.coordinates.slice(1);
    allCoords.push(...coords);
    totalDistance += m.distance;
    totalDuration += m.duration;
    confidenceSum += m.confidence;
    m.legs.forEach((leg) => {
      if (leg.summary) {
        leg.summary.split(",").forEach((s) => {
          const trimmed = s.trim();
          if (trimmed) streetSet.add(trimmed);
        });
      }
    });
  });

  return NextResponse.json({
    path: allCoords.map(([lng, lat]) => ({ lat, lng })),
    distance_m: totalDistance,
    duration_s: totalDuration,
    streets: Array.from(streetSet),
    confidence: confidenceSum / validMatches.length,
  });
}
