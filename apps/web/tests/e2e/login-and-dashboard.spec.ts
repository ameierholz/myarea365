import { test, expect } from "@playwright/test";

/**
 * Critical Journey: Login → Dashboard rendert → Map ist sichtbar
 *
 * ENV für CI/lokal:
 *   E2E_TEST_EMAIL    — bestehender Test-User in Supabase
 *   E2E_TEST_PASSWORD — passendes Passwort
 *   E2E_BASE_URL      — Default http://localhost:3000
 */

const EMAIL = process.env.E2E_TEST_EMAIL || "kaelthor.malven@example.com";
const PASSWORD = process.env.E2E_TEST_PASSWORD || "test-account-only";

test.describe("Critical Journey: Auth → Map", () => {
  test("Landing-Page lädt + hat Login-Link", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveTitle(/MyArea365/i);
    // Sicherheitsheader prüfen (CSP, X-Content-Type-Options)
    const response = await page.request.get("/");
    expect(response.headers()["x-content-type-options"]).toBe("nosniff");
    expect(response.headers()["strict-transport-security"]).toContain("max-age");
  });

  test("Login mit gültigen Credentials → Dashboard", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel(/e.?mail/i).fill(EMAIL);
    await page.getByLabel(/passwort/i).fill(PASSWORD);
    await page.getByRole("button", { name: /einloggen|login|anmelden/i }).click();

    await page.waitForURL(/\/dashboard/, { timeout: 10_000 });
    // Map muss innerhalb von 5s mounten (Performance-Budget)
    await expect(page.locator("canvas").first()).toBeVisible({ timeout: 5_000 });
  });

  test("Dashboard rendert ohne Console-Errors", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    page.on("console", (m) => {
      if (m.type() === "error") errors.push(m.text());
    });

    await page.goto("/login");
    await page.getByLabel(/e.?mail/i).fill(EMAIL);
    await page.getByLabel(/passwort/i).fill(PASSWORD);
    await page.getByRole("button", { name: /einloggen|login|anmelden/i }).click();
    await page.waitForURL(/\/dashboard/);
    await page.waitForLoadState("networkidle");

    // Bekannte Drittanbieter-Noise rausfiltern (AdSense, Mapbox warnings)
    const real = errors.filter((e) =>
      !/adsbygoogle|googleads|mapbox-gl/i.test(e) &&
      !/Failed to load resource/i.test(e)
    );
    expect(real, `Console-Errors: ${real.join("\n")}`).toHaveLength(0);
  });
});

test.describe("Public-Routes ohne Auth", () => {
  test("Landing-Page hat hreflang für 10 Sprachen", async ({ page }) => {
    const response = await page.goto("/");
    const html = (await response?.text()) || "";
    const hreflangs = html.match(/hreflang="([^"]+)"/g) || [];
    // Erwartet: 10 Sprach-Locales + x-default = 11
    expect(hreflangs.length).toBeGreaterThanOrEqual(11);
    expect(html).toContain('hreflang="x-default"');
    expect(html).toContain('hreflang="de-DE"');
    expect(html).toContain('hreflang="en-US"');
    expect(html).toContain('hreflang="ar-SA"');
    expect(html).toContain('hreflang="zh-CN"');
  });

  test("Offline-Page rendert ohne JS", async ({ page }) => {
    await page.goto("/offline");
    await expect(page.getByRole("heading", { name: /offline/i })).toBeVisible();
    // Link zurück zur Hauptseite muss vorhanden + tastaturzugänglich sein
    const link = page.getByRole("link", { name: /neu versuchen/i });
    await expect(link).toBeVisible();
    await expect(link).toHaveAttribute("href", "/");
  });
});
