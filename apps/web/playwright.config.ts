import { defineConfig, devices } from "@playwright/test";

/**
 * Playwright E2E-Konfig — kritische User-Journeys.
 *
 * Setup:
 *   pnpm add -D @playwright/test
 *   pnpm exec playwright install chromium
 *
 * Run:
 *   pnpm exec playwright test
 *   pnpm exec playwright test --ui  (interaktiv)
 *
 * CI: GitHub Actions / Vercel-Build-Check kann `pnpm exec playwright test` ausführen.
 */
export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 2 : undefined,
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : [["list"], ["html", { open: "never" }]],

  use: {
    baseURL: process.env.E2E_BASE_URL || "http://localhost:3000",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
    locale: "de-DE",
    timezoneId: "Europe/Berlin",
    geolocation: { longitude: 13.4050, latitude: 52.5200 }, // Berlin
    permissions: ["geolocation"],
  },

  projects: [
    { name: "chromium-desktop", use: { ...devices["Desktop Chrome"] } },
    { name: "mobile-pixel", use: { ...devices["Pixel 7"] } },
  ],

  // Lokal: dev-Server auto-starten. In CI: Build muss extern laufen.
  webServer: process.env.CI ? undefined : {
    command: "pnpm dev",
    url: "http://localhost:3000",
    reuseExistingServer: true,
    timeout: 120_000,
  },
});
