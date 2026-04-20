import { createClient } from "@/lib/supabase/client";

type Coord = { lat: number; lng: number };

export async function exportRunAsGPX(runId: string, streetName: string | null): Promise<{ ok: boolean; error?: string }> {
  const sb = createClient();
  const { data, error } = await sb.from("territories")
    .select("route, created_at, distance_m, duration_s")
    .eq("id", runId)
    .maybeSingle<{ route: Coord[] | null; created_at: string; distance_m: number; duration_s: number }>();

  if (error || !data?.route || data.route.length < 2) {
    return { ok: false, error: "Route nicht verfügbar" };
  }

  const startTime = new Date(data.created_at).getTime();
  const stepMs = data.duration_s > 0 ? (data.duration_s * 1000) / data.route.length : 0;

  const trkpts = data.route.map((p, i) => {
    const t = new Date(startTime + i * stepMs).toISOString();
    return `      <trkpt lat="${p.lat}" lon="${p.lng}"><time>${t}</time></trkpt>`;
  }).join("\n");

  const name = (streetName || "MyArea365-Walk").replace(/[<>&"']/g, " ");

  const gpx = `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="MyArea365" xmlns="http://www.topografix.com/GPX/1/1">
  <metadata>
    <name>${name}</name>
    <time>${new Date(data.created_at).toISOString()}</time>
  </metadata>
  <trk>
    <name>${name}</name>
    <trkseg>
${trkpts}
    </trkseg>
  </trk>
</gpx>
`;

  const blob = new Blob([gpx], { type: "application/gpx+xml" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  const dateStr = new Date(data.created_at).toISOString().slice(0, 10);
  a.href = url;
  a.download = `myarea365-${dateStr}-${runId.slice(0, 8)}.gpx`;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { document.body.removeChild(a); URL.revokeObjectURL(url); }, 200);
  return { ok: true };
}

export async function shareRun(run: {
  street_name: string | null;
  distance_m: number;
  duration_s: number;
  xp_earned: number;
}): Promise<{ ok: boolean; shared: boolean; error?: string }> {
  const km = (run.distance_m / 1000).toFixed(2);
  const durMin = Math.floor(run.duration_s / 60);
  const durSec = run.duration_s % 60;
  const durStr = `${durMin}:${String(durSec).padStart(2, "0")}`;
  const text =
    `🏃 ${run.street_name || "Lauf"}\n` +
    `📏 ${km} km · ⏱️ ${durStr} · ⚡ +${run.xp_earned} XP\n\n` +
    `Läuft mit mir auf MyArea365 — myarea365.de`;
  const url = typeof window !== "undefined" ? window.location.origin : "https://myarea365.de";

  if (typeof navigator !== "undefined" && (navigator as Navigator & { share?: (d: ShareData) => Promise<void> }).share) {
    try {
      await (navigator as Navigator & { share: (d: ShareData) => Promise<void> }).share({
        title: "Mein MyArea365-Lauf", text, url,
      });
      return { ok: true, shared: true };
    } catch (e) {
      if (e instanceof Error && e.name === "AbortError") return { ok: true, shared: false };
    }
  }

  try {
    await navigator.clipboard.writeText(`${text}\n${url}`);
    return { ok: true, shared: true };
  } catch {
    return { ok: false, shared: false, error: "Share nicht verfügbar" };
  }
}
