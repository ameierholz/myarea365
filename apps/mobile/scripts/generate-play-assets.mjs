#!/usr/bin/env node
/**
 * Generiert Google-Play-Listing-Assets:
 *  - playstore-icon.png (512×512, voll undurchsichtig, kein Alpha)
 *  - feature-graphic.png (1024×500)
 *  - promo-graphic.png (180×120, optional)
 *
 * Output: apps/mobile/play-assets/
 *
 * Run: node apps/mobile/scripts/generate-play-assets.mjs
 */
import sharp from "sharp";
import { fileURLToPath } from "node:url";
import path from "node:path";
import fs from "node:fs/promises";

const here = path.dirname(fileURLToPath(import.meta.url));
const WEB_PUBLIC = path.resolve(here, "..", "..", "web", "public");
const OUT_DIR = path.resolve(here, "..", "play-assets");
const LOGO = path.join(WEB_PUBLIC, "logo.png");

await fs.mkdir(OUT_DIR, { recursive: true });

// 1) 512×512 Play-Icon — KEIN Alpha (Play lehnt transparente PNGs ab)
async function buildPlayIcon() {
  const out = path.join(OUT_DIR, "playstore-icon.png");
  await sharp(LOGO)
    .resize(440, 440, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .extend({ top: 36, bottom: 36, left: 36, right: 36, background: { r: 0x0f, g: 0x11, b: 0x15, alpha: 1 } })
    .removeAlpha()
    .png({ compressionLevel: 9 })
    .toFile(out);
  console.log("✓ playstore-icon.png (512×512, no alpha)");
}

// 2) 1024×500 Feature-Graphic
async function buildFeatureGraphic() {
  const W = 1024, H = 500;
  const logoSize = 280;
  const logoBuf = await sharp(LOGO)
    .resize({ width: logoSize, height: logoSize, fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer();

  const svg = `
    <svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="#0F1115"/>
          <stop offset="50%" stop-color="#1A1D23"/>
          <stop offset="100%" stop-color="#0F1115"/>
        </linearGradient>
        <radialGradient id="glow1" cx="20%" cy="35%" r="40%">
          <stop offset="0%" stop-color="rgba(255,45,120,0.30)"/>
          <stop offset="100%" stop-color="rgba(255,45,120,0)"/>
        </radialGradient>
        <radialGradient id="glow2" cx="85%" cy="70%" r="40%">
          <stop offset="0%" stop-color="rgba(34,209,195,0.25)"/>
          <stop offset="100%" stop-color="rgba(34,209,195,0)"/>
        </radialGradient>
      </defs>
      <rect width="${W}" height="${H}" fill="url(#g)"/>
      <rect width="${W}" height="${H}" fill="url(#glow1)"/>
      <rect width="${W}" height="${H}" fill="url(#glow2)"/>
      <text x="320" y="200" font-family="Inter, Arial, sans-serif" font-size="84" font-weight="900" fill="#F0F0F0" letter-spacing="-2">MyArea365</text>
      <text x="320" y="260" font-family="Inter, Arial, sans-serif" font-size="34" font-weight="700" fill="#22D1C3">Erlauf dir die Stadt</text>
      <text x="320" y="320" font-family="Inter, Arial, sans-serif" font-size="22" font-weight="500" fill="#8B8FA3">Gamifizierte Lauf-Community</text>
      <text x="320" y="354" font-family="Inter, Arial, sans-serif" font-size="22" font-weight="500" fill="#8B8FA3">— Map · Crews · Streaks · Rewards</text>
    </svg>
  `;

  const out = path.join(OUT_DIR, "feature-graphic.png");
  await sharp(Buffer.from(svg))
    .composite([{ input: logoBuf, top: 110, left: 30 }])
    .png()
    .toFile(out);
  console.log("✓ feature-graphic.png (1024×500)");
}

await buildPlayIcon();
await buildFeatureGraphic();
console.log(`\nDone. Assets in ${OUT_DIR}`);
