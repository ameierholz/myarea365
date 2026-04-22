"use client";

import { useEffect, useRef, useState } from "react";

type Point = { lat: number; lng: number; t: number; acc?: number };
type Phase = "idle" | "recording" | "paused" | "submitting" | "done" | "error";

type SubmitResult = {
  new_segments: Array<{ id: string; street_name: string | null; length_m: number }>;
  total_new: number;
  total_length_m: number;
  newly_claimed_streets: Array<{ street_name: string; total_length_m: number }>;
  new_territories: Array<{ id: string; area_m2: number; stole_from: boolean }>;
};

function haversineM(a: Point, b: Point): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const la1 = toRad(a.lat);
  const la2 = toRad(b.lat);
  const x =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(la1) * Math.cos(la2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(x));
}

export function WalkClient() {
  const [phase, setPhase] = useState<Phase>("idle");
  const [trace, setTrace] = useState<Point[]>([]);
  const [distance, setDistance] = useState(0);
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [now, setNow] = useState<number>(Date.now());
  const [result, setResult] = useState<SubmitResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const watchId = useRef<number | null>(null);
  const lastPoint = useRef<Point | null>(null);

  // Ticking clock
  useEffect(() => {
    if (phase !== "recording") return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [phase]);

  function stopWatch() {
    if (watchId.current !== null) {
      navigator.geolocation.clearWatch(watchId.current);
      watchId.current = null;
    }
  }

  useEffect(() => () => stopWatch(), []);

  function onPos(pos: GeolocationPosition) {
    const p: Point = {
      lat: pos.coords.latitude,
      lng: pos.coords.longitude,
      t: pos.timestamp,
      acc: pos.coords.accuracy,
    };
    // Filter low-accuracy readings
    if (p.acc && p.acc > 40) return;
    const prev = lastPoint.current;
    if (prev) {
      const d = haversineM(prev, p);
      // Skip jitter (< 3m) and teleports (> 50 m/s)
      const dt = (p.t - prev.t) / 1000;
      if (d < 3) return;
      if (dt > 0 && d / dt > 50) return;
      setDistance((prev) => prev + d);
    }
    lastPoint.current = p;
    setTrace((prev) => [...prev, p]);
  }

  function onErr(err: GeolocationPositionError) {
    setError(
      err.code === 1
        ? "Standort-Berechtigung verweigert. Bitte in den Browser-Einstellungen freigeben."
        : err.code === 2
          ? "Standort derzeit nicht verfügbar."
          : "Standort-Timeout.",
    );
  }

  function start() {
    if (!("geolocation" in navigator)) {
      setError("Dein Gerät unterstützt keine Geolocation.");
      return;
    }
    setError(null);
    setResult(null);
    setTrace([]);
    setDistance(0);
    lastPoint.current = null;
    setStartedAt(Date.now());
    setPhase("recording");
    watchId.current = navigator.geolocation.watchPosition(onPos, onErr, {
      enableHighAccuracy: true,
      maximumAge: 0,
      timeout: 15_000,
    });
  }

  function pause() {
    stopWatch();
    setPhase("paused");
  }

  function resume() {
    setPhase("recording");
    watchId.current = navigator.geolocation.watchPosition(onPos, onErr, {
      enableHighAccuracy: true,
      maximumAge: 0,
      timeout: 15_000,
    });
  }

  async function finish() {
    stopWatch();
    if (trace.length < 2) {
      setError("Zu wenig GPS-Punkte — versuch es länger.");
      setPhase("error");
      return;
    }
    setPhase("submitting");
    try {
      const res = await fetch("/api/walk/segments", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          trace: trace.map((p) => ({ lat: p.lat, lng: p.lng })),
        }),
      });
      const j = (await res.json()) as SubmitResult & { error?: string };
      if (!res.ok) {
        setError(j.error ?? "Konnte Walk nicht speichern.");
        setPhase("error");
        return;
      }
      setResult(j);
      setPhase("done");
    } catch (e) {
      setError(String(e));
      setPhase("error");
    }
  }

  function reset() {
    setPhase("idle");
    setTrace([]);
    setDistance(0);
    setStartedAt(null);
    setResult(null);
    setError(null);
    lastPoint.current = null;
  }

  const secs = startedAt ? Math.floor((now - startedAt) / 1000) : 0;
  const mm = String(Math.floor(secs / 60)).padStart(2, "0");
  const ss = String(secs % 60).padStart(2, "0");
  const km = (distance / 1000).toFixed(2);
  const pace =
    distance > 50 && secs > 10 ? (secs / 60) / (distance / 1000) : 0; // min/km
  const paceStr =
    pace > 0
      ? `${Math.floor(pace)}:${String(Math.round((pace - Math.floor(pace)) * 60)).padStart(2, "0")}`
      : "—";

  return (
    <div className="space-y-4">
      {/* Status-Karte */}
      <div className="rounded-2xl bg-[#1A1D23] border border-white/5 p-5">
        <div className="text-[11px] font-black tracking-widest text-[#8B8FA3] mb-3">
          {phase === "idle" && "BEREIT"}
          {phase === "recording" && (
            <span className="text-[#22D1C3]">● AUFZEICHNUNG LÄUFT</span>
          )}
          {phase === "paused" && "⏸ PAUSIERT"}
          {phase === "submitting" && "SPEICHERE …"}
          {phase === "done" && (
            <span className="text-[#FFD700]">🏆 WALK BEENDET</span>
          )}
          {phase === "error" && <span className="text-[#FF2D78]">FEHLER</span>}
        </div>

        <div className="grid grid-cols-3 gap-3 text-center">
          <Stat label="DISTANZ" value={km} unit="km" color="#22D1C3" />
          <Stat label="ZEIT" value={`${mm}:${ss}`} unit="" color="#F0F0F0" />
          <Stat label="PACE" value={paceStr} unit="min/km" color="#FFD700" />
        </div>
        <div className="text-[10px] text-[#6c7590] text-center mt-3">
          {trace.length} GPS-Punkte erfasst
        </div>
      </div>

      {/* Aktionen */}
      {phase === "idle" && (
        <button
          onClick={start}
          className="w-full py-4 rounded-2xl text-base font-black text-[#0F1115]"
          style={{
            background: "linear-gradient(135deg, #22D1C3 0%, #FFD700 100%)",
          }}
        >
          ▶️ Walk starten
        </button>
      )}
      {phase === "recording" && (
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={pause}
            className="py-3 rounded-xl bg-white/5 border border-white/10 font-bold text-[#a8b4cf]"
          >
            ⏸ Pause
          </button>
          <button
            onClick={finish}
            className="py-3 rounded-xl bg-[#FF2D78] text-white font-black"
          >
            🏁 Beenden
          </button>
        </div>
      )}
      {phase === "paused" && (
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={resume}
            className="py-3 rounded-xl bg-[#22D1C3] text-[#0F1115] font-black"
          >
            ▶️ Fortsetzen
          </button>
          <button
            onClick={finish}
            className="py-3 rounded-xl bg-[#FF2D78] text-white font-black"
          >
            🏁 Beenden
          </button>
        </div>
      )}
      {phase === "submitting" && (
        <div className="text-center text-sm text-[#8B8FA3] py-4">
          Werte Route aus, matche Straßen gegen OpenStreetMap …
        </div>
      )}

      {phase === "done" && result && <ResultCard result={result} onReset={reset} />}
      {phase === "error" && (
        <div className="p-4 rounded-xl bg-[#FF2D78]/10 border border-[#FF2D78]/40 text-sm text-[#FF2D78]">
          {error}
          <button
            onClick={reset}
            className="block mt-3 text-xs text-white underline"
          >
            Neu starten
          </button>
        </div>
      )}
      {error && phase !== "error" && (
        <div className="text-xs text-[#FF2D78]">{error}</div>
      )}

      {phase === "idle" && (
        <div className="p-4 rounded-xl bg-white/5 border border-white/5 text-xs text-[#a8b4cf] leading-relaxed">
          <div className="font-black text-white mb-2">So funktioniert&apos;s</div>
          Starte den Walk, gehe oder jogge durch deine Straßen. Am Ende matchen
          wir deine GPS-Route gegen die OSM-Straßendaten und schalten frei:
          <ul className="mt-2 space-y-1 list-disc list-inside">
            <li>
              <b>50 XP</b> pro neuem Straßensegment
            </li>
            <li>
              <b>250 XP</b> wenn du eine Straße komplett geschafft hast
            </li>
            <li>
              <b>500+ XP</b> für geschlossene Gebiete (Polygone)
            </li>
          </ul>
          <div className="mt-2 text-[10px] text-[#6c7590]">
            💡 Tipp: Halte die Seite im Vordergrund und lass das Display an.
          </div>
        </div>
      )}
    </div>
  );
}

function Stat({
  label,
  value,
  unit,
  color,
}: {
  label: string;
  value: string;
  unit: string;
  color: string;
}) {
  return (
    <div>
      <div className="text-[9px] font-black tracking-widest text-[#6c7590]">
        {label}
      </div>
      <div className="text-2xl font-black" style={{ color }}>
        {value}
      </div>
      {unit && <div className="text-[10px] text-[#8B8FA3]">{unit}</div>}
    </div>
  );
}

function ResultCard({
  result,
  onReset,
}: {
  result: SubmitResult;
  onReset: () => void;
}) {
  const xpSegments = result.total_new * 50;
  const xpStreets = result.newly_claimed_streets.length * 250;
  const xpTerritories = result.new_territories.length * 500;
  const xpTotal = xpSegments + xpStreets + xpTerritories;

  return (
    <div className="space-y-3">
      <div className="rounded-2xl bg-[#FFD700]/10 border border-[#FFD700]/40 p-5 text-center">
        <div className="text-5xl mb-2">⭐</div>
        <div className="text-3xl font-black text-[#FFD700]">+{xpTotal} XP</div>
        <div className="text-xs text-[#a8b4cf] mt-1">
          {(result.total_length_m / 1000).toFixed(2)} km eingereicht
        </div>
      </div>

      <Stack>
        <Row
          emoji="🛣️"
          label="Neue Straßensegmente"
          value={`${result.total_new} × 50 XP`}
          dim={result.total_new === 0}
        />
        <Row
          emoji="🏙️"
          label="Straßenzüge komplett"
          value={`${result.newly_claimed_streets.length} × 250 XP`}
          dim={result.newly_claimed_streets.length === 0}
        />
        <Row
          emoji="🗺️"
          label="Neue Gebiete"
          value={`${result.new_territories.length} × 500+ XP`}
          dim={result.new_territories.length === 0}
          highlight={result.new_territories.some((t) => t.stole_from)}
          badge={
            result.new_territories.some((t) => t.stole_from) ? "STEAL!" : null
          }
        />
      </Stack>

      {result.newly_claimed_streets.length > 0 && (
        <div className="rounded-xl bg-[#1A1D23] border border-white/5 p-3">
          <div className="text-[10px] font-black tracking-widest text-[#FFD700] mb-2">
            ERSTMALIG KOMPLETT
          </div>
          <div className="space-y-1">
            {result.newly_claimed_streets.slice(0, 5).map((s) => (
              <div
                key={s.street_name}
                className="flex justify-between text-xs"
              >
                <span className="text-white">{s.street_name}</span>
                <span className="text-[#8B8FA3]">
                  {Math.round(s.total_length_m)} m
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      <button
        onClick={onReset}
        className="w-full py-3 rounded-xl bg-white/5 border border-white/10 font-bold text-[#a8b4cf]"
      >
        Nächster Walk
      </button>
    </div>
  );
}

function Stack({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-xl bg-[#1A1D23] border border-white/5 divide-y divide-white/5">
      {children}
    </div>
  );
}

function Row({
  emoji,
  label,
  value,
  dim,
  highlight,
  badge,
}: {
  emoji: string;
  label: string;
  value: string;
  dim?: boolean;
  highlight?: boolean;
  badge?: string | null;
}) {
  return (
    <div
      className={`flex items-center justify-between p-3 ${dim ? "opacity-50" : ""}`}
    >
      <div className="flex items-center gap-2">
        <span className="text-lg">{emoji}</span>
        <span className="text-sm text-white">{label}</span>
        {badge && (
          <span className="ml-1 px-1.5 py-0.5 rounded bg-[#FF2D78] text-white text-[9px] font-black">
            {badge}
          </span>
        )}
      </div>
      <span
        className={`text-sm font-black ${highlight ? "text-[#FF2D78]" : "text-[#FFD700]"}`}
      >
        {value}
      </span>
    </div>
  );
}
