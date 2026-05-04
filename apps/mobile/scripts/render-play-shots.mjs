#!/usr/bin/env node
/**
 * Rendert via Playwright:
 *  - feature-graphic.png (1024×500) aus apps/web/public/feature-graphic.html
 *  - phone-screenshots (1080×1920) für sechs Routen
 *
 * Cookie-Consent wird vor jedem Page-Load via localStorage gesetzt,
 * sodass das Banner nie aufpoppt.
 *
 * Run (Playwright lebt in apps/web):
 *   cp apps/mobile/scripts/render-play-shots.mjs apps/web/_play.mjs
 *   cd apps/web && node _play.mjs && rm _play.mjs
 */
import { chromium } from "@playwright/test";
import { fileURLToPath } from "node:url";
import path from "node:path";
import fs from "node:fs/promises";

const here = path.dirname(fileURLToPath(import.meta.url));
// Wenn aus apps/web ausgeführt → here = apps/web
// Wir wollen Output unter apps/mobile/play-assets/ ablegen.
const PLAY_ASSETS = path.resolve(here, "..", "mobile", "play-assets");
const SHOT_DIR = path.join(PLAY_ASSETS, "screenshots");
await fs.mkdir(SHOT_DIR, { recursive: true });

const BASE = process.env.SCREENSHOT_BASE_URL || "http://localhost:3000";
const EMAIL = process.env.PLAY_REVIEW_EMAIL || "";
const PASSWORD = process.env.PLAY_REVIEW_PASSWORD || "";

const browser = await chromium.launch({ headless: true });

// ─── 1) Feature-Graphic 1024×500 ──────────────────────────────────────
{
  console.log("→ feature-graphic 1024×500 …");
  const ctx = await browser.newContext({
    viewport: { width: 1024, height: 500 },
    deviceScaleFactor: 2,
  });
  const page = await ctx.newPage();
  await page.goto(`${BASE}/feature-graphic.html`, { waitUntil: "networkidle", timeout: 30000 });
  await page.waitForTimeout(800);
  const out = path.join(PLAY_ASSETS, "feature-graphic.png");
  await page.screenshot({ path: out, omitBackground: false, fullPage: false });
  console.log("✓ feature-graphic.png");
  await ctx.close();
}

// ─── 2) Phone-Screenshots 1080×1920 ───────────────────────────────────
const VIEWPORT = { width: 1080, height: 1920, deviceScaleFactor: 2 };

const ctx = await browser.newContext({
  viewport: VIEWPORT,
  deviceScaleFactor: 2,
  isMobile: true,
  userAgent: "Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Mobile Safari/537.36",
  locale: "de-DE",
});

// Cookie-Consent vorab im Storage setzen → Banner erscheint nie
await ctx.addInitScript(() => {
  try {
    window.localStorage.setItem(
      "ma365_consent_v1",
      JSON.stringify({ necessary: true, analytics: false, ads: false, decided_at: new Date().toISOString() })
    );
  } catch {}
});

// Next.js Dev-Badge ausblenden
async function hideDevOverlays(page) {
  await page.addStyleTag({
    content: `
      nextjs-portal, [data-nextjs-toast], [data-nextjs-dialog-overlay] { display: none !important; }
    `,
  }).catch(() => {});
}

// Play-Store-Limits: min 320 px, max 3840 px auf längerer Seite.
const PLAY_MAX_PX = 3840;

// Optional: Login
let isLoggedIn = false;
if (EMAIL && PASSWORD) {
  console.log("→ Auth-Setup …");
  const page = await ctx.newPage();
  try {
    await page.goto(`${BASE}/login`, { waitUntil: "networkidle", timeout: 30000 });
    await page.fill('input[type="email"]', EMAIL);
    await page.fill('input[type="password"]', PASSWORD);
    await page.click('button[type="submit"]');
    await page.waitForURL(/\/dashboard/, { timeout: 20000 });
    isLoggedIn = true;
    console.log("✓ angemeldet");
  } catch (e) {
    console.warn("⚠ Auth fehlgeschlagen:", e?.message ?? e);
  } finally {
    await page.close();
  }
}

const SHOTS = [
  { name: "01-landing", url: "/", needsAuth: false, wait: 2500 },
  { name: "02-pricing", url: "/pricing", needsAuth: false, wait: 1500, fullPage: true },
  { name: "03-leaderboard", url: "/leaderboard", needsAuth: false, wait: 1800 },
  { name: "04-runner-profile", url: "/u/kaelthor", needsAuth: false, wait: 1800 },
  { name: "05-dashboard", url: "/dashboard", needsAuth: true, wait: 4500 },
  { name: "06-deals", url: "/deals", needsAuth: true, wait: 1500 },
];

for (const s of SHOTS) {
  if (s.needsAuth && !isLoggedIn) {
    console.log(`⏭  ${s.name} → übersprungen (kein Login)`);
    continue;
  }
  const page = await ctx.newPage();
  try {
    console.log(`→ ${s.name} …`);
    await page.goto(`${BASE}${s.url}`, { waitUntil: "networkidle", timeout: 30000 });
    await hideDevOverlays(page);
    if (s.scrollTo != null) await page.evaluate((y) => window.scrollTo(0, y), s.scrollTo);
    await page.waitForTimeout(s.wait ?? 1000);
    const out = path.join(SHOT_DIR, `${s.name}.png`);
    // Fixes Phone-Viewport (Pixel 7 Format) — entspricht echtem Nutzer-UX.
    // fullPage nur bei Long-Content-Routen wo Scrolling Sinn macht.
    await page.screenshot({ path: out, fullPage: !!s.fullPage });
    console.log(`✓ ${s.name}.png`);
  } catch (e) {
    console.warn(`⚠  ${s.name} fehlgeschlagen: ${e?.message ?? e}`);
  } finally {
    await page.close();
  }
}

await browser.close();
console.log(`\nDone.\n  Feature-Graphic: ${PLAY_ASSETS}/feature-graphic.png\n  Screenshots:     ${SHOT_DIR}/`);
