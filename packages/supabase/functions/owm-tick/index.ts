// Supabase Edge Function: owm-tick
// Aufruf: pg_cron (alle 30 Min). Holt aktuelle Wetterdaten + 5-Tage-Forecast
// von OpenWeatherMap für alle Cities in city_weather_provider_config, deren
// provider='openweathermap'. Persistiert via record_owm_payload / record_owm_forecast.
//
// Env: OPENWEATHERMAP_API_KEY, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
//
// Deploy:
//   pnpm exec supabase functions deploy owm-tick --no-verify-jwt
//   (--no-verify-jwt weil Cron-Job ruft ohne JWT auf; alternativ Custom-Header-Auth)

// @ts-expect-error Deno runtime
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
// @ts-expect-error Deno runtime
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const OWM_API_KEY = Deno.env.get("OPENWEATHERMAP_API_KEY")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

type CityCfg = { city_slug: string; lat: number; lng: number };

serve(async () => {
  if (!OWM_API_KEY) {
    return new Response(JSON.stringify({ ok: false, error: "missing_api_key" }), { status: 500 });
  }

  const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  const { data: cities, error: citiesErr } = await sb
    .from("city_weather_provider_config")
    .select("city_slug, lat, lng")
    .eq("provider", "openweathermap")
    .not("lat", "is", null)
    .not("lng", "is", null);

  if (citiesErr) {
    return new Response(JSON.stringify({ ok: false, error: citiesErr.message }), { status: 500 });
  }
  if (!cities || cities.length === 0) {
    return new Response(JSON.stringify({ ok: true, ticked: 0, note: "no cities on owm provider" }));
  }

  const results: Array<{ city: string; current?: string; forecast?: number; error?: string }> = [];

  for (const c of cities as CityCfg[]) {
    try {
      // Current Weather
      const curUrl = `https://api.openweathermap.org/data/2.5/weather?lat=${c.lat}&lon=${c.lng}&units=metric&appid=${OWM_API_KEY}`;
      const curRes = await fetch(curUrl);
      if (!curRes.ok) {
        results.push({ city: c.city_slug, error: `current ${curRes.status}` });
        continue;
      }
      const curPayload = await curRes.json();
      const curRpc = await sb.rpc("record_owm_payload", {
        p_city_slug: c.city_slug,
        p_payload: curPayload,
      });
      if (curRpc.error) {
        results.push({ city: c.city_slug, error: `current rpc: ${curRpc.error.message}` });
        continue;
      }

      // 5-Tage-Forecast (daily aggregation — kostet Pro-Tier credit, deshalb /forecast als 3-stündlich,
      // wir aggregieren clientseitig)
      const fcUrl = `https://api.openweathermap.org/data/2.5/forecast?lat=${c.lat}&lon=${c.lng}&units=metric&appid=${OWM_API_KEY}`;
      const fcRes = await fetch(fcUrl);
      if (!fcRes.ok) {
        results.push({
          city: c.city_slug,
          current: (curRpc.data as { condition?: string })?.condition,
          error: `forecast ${fcRes.status}`,
        });
        continue;
      }
      const fcPayload = await fcRes.json();

      // OWM /forecast liefert 5 Tage × 8 3h-Slots. In Tages-Buckets aggregieren.
      const list: Array<{ dt: number; main: { temp_max: number; temp_min: number; humidity: number };
                          weather: Array<{ id: number }>; clouds: { all: number };
                          wind: { speed: number }; rain?: { "3h": number }; snow?: { "3h": number } }>
        = fcPayload.list ?? [];
      const buckets = new Map<string, {
        temps: number[]; codes: number[]; humidity: number[]; clouds: number[];
        wind: number[]; rain: number; snow: number;
      }>();
      for (const slot of list) {
        const date = new Date(slot.dt * 1000).toISOString().slice(0, 10);
        let b = buckets.get(date);
        if (!b) {
          b = { temps: [], codes: [], humidity: [], clouds: [], wind: [], rain: 0, snow: 0 };
          buckets.set(date, b);
        }
        b.temps.push(slot.main.temp_max, slot.main.temp_min);
        b.codes.push(slot.weather[0]?.id ?? 800);
        b.humidity.push(slot.main.humidity);
        b.clouds.push(slot.clouds.all);
        b.wind.push(slot.wind.speed);
        b.rain += slot.rain?.["3h"] ?? 0;
        b.snow += slot.snow?.["3h"] ?? 0;
      }

      const aggList = Array.from(buckets.entries())
        .sort(([a], [b]) => a.localeCompare(b))
        .slice(0, 5)
        .map(([_date, b]) => ({
          weather: [{ id: dominantCode(b.codes) }],
          temp: { max: Math.max(...b.temps), min: Math.min(...b.temps) },
          humidity: Math.round(avg(b.humidity)),
          clouds: Math.round(avg(b.clouds)),
          speed: avg(b.wind),
          rain: b.rain,
          snow: b.snow,
        }));

      const fcRpc = await sb.rpc("record_owm_forecast", {
        p_city_slug: c.city_slug,
        p_payload: { list: aggList },
      });

      results.push({
        city: c.city_slug,
        current: (curRpc.data as { condition?: string })?.condition,
        forecast: (fcRpc.data as number) ?? 0,
      });
    } catch (err) {
      results.push({ city: c.city_slug, error: (err as Error).message });
    }
  }

  return new Response(JSON.stringify({ ok: true, ticked: cities.length, results }), {
    headers: { "Content-Type": "application/json" },
  });
});

function avg(xs: number[]): number {
  return xs.length === 0 ? 0 : xs.reduce((a, b) => a + b, 0) / xs.length;
}

function dominantCode(codes: number[]): number {
  // gewichteter Median: schwerste Bedingung gewinnt (Sturm > Schnee > Regen > Nebel > Wolken > Klar)
  const weight: Record<string, number> = {
    "2": 100, "3": 60, "5": 70, "6": 80, "7": 50, "8": 10, "80": 20,
  };
  let best = codes[0] ?? 800;
  let bestW = -1;
  for (const code of codes) {
    const prefix = code === 800 ? "8" : String(code).slice(0, 1);
    const w = weight[prefix] ?? 0;
    if (w > bestW) { best = code; bestW = w; }
  }
  return best;
}
