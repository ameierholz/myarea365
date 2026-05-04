#!/usr/bin/env node
/**
 * Generiert og-default.png (1200x630) + og-image.png + favicon.ico
 * aus logo.png. Einmal laufen lassen, Resultat ist statisch im public/.
 *
 * Run: node apps/mobile/scripts/generate-og-favicon.mjs
 * (lebt in apps/mobile, weil sharp dort als devDependency installiert ist)
 */
import sharp from "sharp";
import { fileURLToPath } from "node:url";
import path from "node:path";

const here = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC = path.resolve(here, "..", "..", "web", "public");
const LOGO = path.join(PUBLIC, "logo.png");

const BG = "#0F1115"; // Brand-Background dark
const BRAND_TINT = { r: 0xff, g: 0x2d, b: 0x78 }; // Pink

async function buildOg(outName) {
  const W = 1200, H = 630;
  const logoSize = 320;
  const logoBuf = await sharp(LOGO)
    .resize({ width: logoSize, height: logoSize, fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer();

  const svg = `
    <svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="#0F1115"/>
          <stop offset="100%" stop-color="#1A1D23"/>
        </linearGradient>
        <radialGradient id="glow" cx="50%" cy="40%" r="50%">
          <stop offset="0%" stop-color="rgba(255,45,120,0.20)"/>
          <stop offset="100%" stop-color="rgba(255,45,120,0)"/>
        </radialGradient>
      </defs>
      <rect width="${W}" height="${H}" fill="url(#g)"/>
      <rect width="${W}" height="${H}" fill="url(#glow)"/>
      <text x="${W/2}" y="${H/2 + logoSize/2 + 80}" font-family="Inter, Arial, sans-serif" font-size="68" font-weight="900" fill="#F0F0F0" text-anchor="middle" letter-spacing="2">MyArea365</text>
      <text x="${W/2}" y="${H/2 + logoSize/2 + 130}" font-family="Inter, Arial, sans-serif" font-size="24" font-weight="500" fill="#8B8FA3" text-anchor="middle">Erlauf dir die Stadt — gemeinsam in Bewegung</text>
    </svg>
  `;

  const out = path.join(PUBLIC, outName);
  await sharp(Buffer.from(svg))
    .composite([{
      input: logoBuf,
      top: Math.round((H - logoSize) / 2 - 60),
      left: Math.round((W - logoSize) / 2),
    }])
    .png()
    .toFile(out);
  console.log("✓", outName);
}

async function buildFavicon() {
  // 32x32 PNG. Modern Browser akzeptieren PNG als favicon.ico.
  const out = path.join(PUBLIC, "favicon.ico");
  await sharp(LOGO)
    .resize(32, 32, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toFile(out);
  console.log("✓ favicon.ico (32×32 PNG)");

  // 180×180 für apple-touch-icon
  await sharp(LOGO)
    .resize(180, 180, { fit: "contain", background: { r: 0x0f, g: 0x11, b: 0x15, alpha: 1 } })
    .png()
    .toFile(path.join(PUBLIC, "apple-touch-icon.png"));
  console.log("✓ apple-touch-icon.png (180×180)");

  // 192 + 512 für PWA-Manifest
  for (const size of [192, 512]) {
    await sharp(LOGO)
      .resize(size, size, { fit: "contain", background: { r: 0x0f, g: 0x11, b: 0x15, alpha: 1 } })
      .png()
      .toFile(path.join(PUBLIC, `icon-${size}.png`));
    console.log(`✓ icon-${size}.png`);
  }
}

await buildOg("og-default.png");
await buildOg("og-image.png");
await buildFavicon();
console.log("Done.");
