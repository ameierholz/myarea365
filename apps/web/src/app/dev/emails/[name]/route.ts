import { NextResponse } from "next/server";
import { readFile } from "fs/promises";
import path from "path";

const ALLOWED = new Set([
  "verify",
  "welcome",
  "reset-password",
  "magic-link",
  "change-email",
  "invite",
  "reauthentication",
  "monthly-stats",
  "newsletter-monthly",
]);

// Demo-Platzhalter für Variablen-Vorschau
const SAMPLES: Record<string, string> = {
  "{{ .ConfirmationURL }}": "https://myarea365.de/auth/callback?token=DEMO-TOKEN",
  "{{ .Email }}": "runner@myarea365.de",
  "{{ .Data.display_name }}": "Kaelthor",
  "{{ .Token }}": "428163",
  "{{display_name}}": "Kaelthor",
  "{{unsubscribe_url}}": "https://myarea365.de/unsubscribe?uid=DEMO-USER-ID&token=DEMO",
  "{{month_label}}": "April 2026",
  "{{user_km}}": "38.4",
  "{{user_runs}}": "12",
  "{{user_xp}}": "2.420",
  "{{user_rank_change}}": "Platz #14 Stadt (−3)",
  "{{user_steps}}": "52.840",
  "{{user_kcal}}": "2.380",
  "{{user_territories}}": "7",
  "{{user_streak}}": "18",
  "{{user_duration}}": "4:12 h",
  "{{user_avg_pace}}": "6:14 /km",
  "{{user_rank_label}}": "Kiez-König",
  "{{month_label_upper}}": "APRIL",
  "{{rank_country}}": "1.284", "{{rank_country_trend}}": "↑ −42", "{{rank_country_trend_color}}": "#4ade80",
  "{{rank_state}}": "187",    "{{rank_state_trend}}":   "↑ −15", "{{rank_state_trend_color}}":   "#4ade80",
  "{{rank_city}}": "94",      "{{rank_city_trend}}":    "↑ −7",  "{{rank_city_trend_color}}":    "#4ade80",
  "{{rank_district}}": "12",  "{{rank_district_trend}}":"↓ +2",  "{{rank_district_trend_color}}":"#ef7169",
  "{{rank_zip}}": "4",        "{{rank_zip_trend}}":     "↑ −1",  "{{rank_zip_trend_color}}":     "#4ade80",
  "{{rank_world}}": "14.720", "{{rank_world_trend}}":   "↑ −340","{{rank_world_trend_color}}":   "#4ade80",
  "{{next_milestone_title}}": "50-km-Marke 🎯",
  "{{next_milestone_body}}": "Mit aktuellem Tempo erreichst du das Ziel am 22. des nächsten Monats.",
  "{{next_milestone_pct}}": "77",
  "{{next_milestone_progress}}": "38.4 / 50 km (77%)",
  "{{achievements_unlocked}}": "⚡ Blitzläufer (5 km unter 25 Min) · 🔥 15-Tage-Streak · 🗺️ 5 neue Territorien · 👟 Halbmarathon-Crew",
  "{{trend_month}}": "+23% km",   "{{trend_month_color}}": "#4ade80",
  "{{trend_crew}}": "+12 km über Ø", "{{trend_crew_color}}": "#4ade80",
  "{{trend_champ_name}}": "NeonFuchs", "{{trend_champ}}": "−9.6 km", "{{trend_champ_color}}": "#FFD700",
  "{{crew_champ_name}}": "NeonFuchs",
  "{{stretch_goal_title}}": "Du brauchst nur 4 km mehr pro Woche für Platz #3 in deiner PLZ",
  "{{stretch_goal_body}}": "Nachbar-Runner StadtPuma ist auf #3 — mit einer Morgen-Runde zusätzlich holst du ihn ein.",
  "{{best_run_street}}": "Danziger Straße, Pankow",
  "{{best_run_date}}": "Samstag, 12. April",
  "{{best_run_km}}": "8.4",
  "{{best_run_duration}}": "42:30",
  "{{best_run_pace}}": "5:03 /km",
  "{{motivation_headline}}": "+23% mehr als letzten Monat — weiter so!",
  "{{motivation_body}}": "Bei gleichem Tempo erreichst du nächsten Monat die 50-km-Marke. Der 🏆 Monats-Champ deiner Crew lief 48 km — noch drin!",
  "{{top_news_title}}": "Neue Liga-Saison — Bronze bis Legende",
  "{{top_news_body}}": "Ab Mai zählen eure Wochen-km monatlich für die Liga. Wer schafft es in die Diamant-Liga?",
  "{{top_news_link}}": "https://myarea365.de",
  "{{event_title}}": "Mai-Kiez-Lauf Prenzlauer Berg",
  "{{event_when}}": "Samstag, 3. Mai · 10:00 Uhr",
  "{{event_location}}": "Mauerpark Haupteingang",
  "{{event_link}}": "https://myarea365.de/karte",
  "{{feature_title}}": "Flash-Deals für alle",
  "{{feature_body}}": "Shops können jetzt 30-Minuten-Pushes an nahe Runner schicken.",
  "{{feature_link}}": "https://myarea365.de",
  "{{tip_text}}": "Warmlaufen nicht vergessen — die ersten 800 m locker traben senkt Verletzungsrisiko deutlich.",
  "{{shop_icon}}": "☕",
  "{{shop_name}}": "Café Liebling",
  "{{shop_address}}": "Rykestraße 22, 10405 Berlin",
  "{{shop_deal}}": "Gratis Cappuccino ab 3 km Lauf",
};

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ name: string }> },
) {
  if (process.env.NODE_ENV === "production") {
    return new NextResponse("Not available in production", { status: 404 });
  }

  const { name } = await ctx.params;
  if (!ALLOWED.has(name)) {
    return new NextResponse("Unknown template. Allowed: " + [...ALLOWED].join(", "), { status: 404 });
  }

  const filePath = path.join(process.cwd(), "emails", `${name}.html`);
  let html: string;
  try {
    html = await readFile(filePath, "utf8");
  } catch {
    return new NextResponse(`Template not found: ${name}.html`, { status: 404 });
  }

  for (const [k, v] of Object.entries(SAMPLES)) {
    html = html.split(k).join(v);
  }

  // Einfache Navigation oben für schnelles Wechseln
  const nav = `
    <div style="position:sticky;top:0;background:#0F1115;padding:8px 16px;border-bottom:1px solid rgba(255,255,255,0.12);z-index:1000;display:flex;gap:8px;flex-wrap:wrap;font-family:system-ui;font-size:12px;">
      ${[...ALLOWED].map((n) =>
        `<a href="/dev/emails/${n}" style="color:${n === name ? "#0F1115" : "#22D1C3"};background:${n === name ? "#22D1C3" : "transparent"};padding:4px 10px;border-radius:6px;text-decoration:none;font-weight:${n === name ? "800" : "500"};border:1px solid ${n === name ? "#22D1C3" : "rgba(255,255,255,0.14)"}">${n}</a>`
      ).join("")}
    </div>
  `;

  const injected = html.replace(/<body([^>]*)>/i, `<body$1>${nav}`);
  return new NextResponse(injected, {
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}
