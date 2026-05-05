#!/usr/bin/env node
/**
 * Generiert Phone-Screenshots für Google Play Store via Playwright.
 *
 * Voraussetzungen:
 *  - Web-App läuft auf http://localhost:3000 (pnpm dev:web)
 *  - Test-Account existiert (env: PLAY_REVIEW_EMAIL + PLAY_REVIEW_PASSWORD)
 *
 * Output: apps/mobile/play-assets/screenshots/
 *
 * Run (Playwright lebt in apps/web):
 *   cp apps/mobile/scripts/generate-screenshots.mjs apps/web/_screenshots.mjs
 *   cd apps/web && node _screenshots.mjs && rm _screenshots.mjs
 * (oder pnpm-Workspace-Resolver konfigurieren)
 */
import { chromium } from "@playwright/test";
import { fileURLToPath } from "node:url";
import path from "node:path";
import fs from "node:fs/promises";

const here = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.resolve(here, "..", "play-assets", "screenshots");
await fs.mkdir(OUT_DIR, { recursive: true });

const BASE = process.env.SCREENSHOT_BASE_URL || "http://localhost:3000";
const EMAIL = process.env.PLAY_REVIEW_EMAIL || "";
const PASSWORD = process.env.PLAY_REVIEW_PASSWORD || "";

// Pixel 7 / typical 1080×1920 Phone
const VIEWPORT = { width: 1080, height: 1920, deviceScaleFactor: 2 };

const SHOTS = [
  { name: "01-landing", url: "/", needsAuth: false, wait: 2000 },
  { name: "02-pricing", url: "/pricing", needsAuth: false, wait: 1500 },
  { name: "03-leaderboard", url: "/leaderboard", needsAuth: false, wait: 1500 },
  { name: "04-dashboard-map", url: "/karte", needsAuth: true, wait: 4000 },
  { name: "05-deals", url: "/deals", needsAuth: false, wait: 1500 },
  { name: "06-impressum", url: "/impressum", needsAuth: false, wait: 1000 },
];

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
  viewport: VIEWPORT,
  deviceScaleFactor: 2,
  isMobile: true,
  userAgent: "Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Mobile Safari/537.36",
  locale: "de-DE",
});

// Auth einmal vorab, falls Credentials gesetzt
if (EMAIL && PASSWORD) {
  console.log("→ Auth-Setup …");
  const page = await context.newPage();
  try {
    await page.goto(`${BASE}/login`, { waitUntil: "networkidle", timeout: 30000 });
    await page.fill('input[type="email"]', EMAIL);
    await page.fill('input[type="password"]', PASSWORD);
    await page.click('button[type="submit"]');
    await page.waitForURL(/\/karte/, { timeout: 20000 });
    console.log("✓ angemeldet");
  } catch (e) {
    console.warn("⚠ Auth fehlgeschlagen — authenticated Shots werden übersprungen");
    console.warn(e?.message ?? e);
  } finally {
    await page.close();
  }
}

for (const s of SHOTS) {
  if (s.needsAuth && !EMAIL) {
    console.log(`⏭  ${s.name} → übersprungen (kein Login)`);
    continue;
  }
  const page = await context.newPage();
  try {
    console.log(`→ ${s.name} …`);
    await page.goto(`${BASE}${s.url}`, { waitUntil: "networkidle", timeout: 30000 });
    await page.waitForTimeout(s.wait ?? 1000);
    const out = path.join(OUT_DIR, `${s.name}.png`);
    await page.screenshot({ path: out, fullPage: false });
    console.log(`✓ ${s.name}.png`);
  } catch (e) {
    console.warn(`⚠  ${s.name} fehlgeschlagen: ${e?.message ?? e}`);
  } finally {
    await page.close();
  }
}

await browser.close();
console.log(`\nDone. Screenshots in ${OUT_DIR}`);
