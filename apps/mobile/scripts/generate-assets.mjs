/**
 * Erzeugt die Source-Assets für @capacitor/assets aus apps/web/public/logo.png.
 *
 *  icon.png            1024×1024  App-Icon (voll)
 *  icon-foreground.png 1024×1024  Logo im Safe-Zone-Inset (für Adaptive Icons)
 *  icon-background.png 1024×1024  Solid Brand-Dunkel (#0F1115)
 *  splash.png          2732×2732  Logo zentriert auf Brand-Dunkel
 */
import sharp from "sharp";
import { mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");
const src = resolve(root, "../web/public/logo.png");
const out = resolve(root, "assets");

const BG = { r: 15, g: 17, b: 21, alpha: 1 }; // #0F1115 (Splash)
const ICON_BG = { r: 34, g: 209, b: 195, alpha: 1 }; // #22D1C3 Teal — passt zum Logo-Rand

await mkdir(out, { recursive: true });

// 1) Full icon: logo an 1024×1024 angepasst (quadratisches Canvas, Logo zentriert)
await sharp(src)
  .resize(1024, 1024, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
  .png()
  .toFile(resolve(out, "icon.png"));

// 2) Adaptive Icon Foreground: Logo füllt ~95% (bewusst mehr als Safe-Zone,
//    weil das Logo selbst schon kreisförmig ist und sonst doppelt maskiert wirkt)
const fgLogo = await sharp(src)
  .resize(980, 980, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
  .png()
  .toBuffer();

await sharp({
  create: { width: 1024, height: 1024, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
})
  .composite([{ input: fgLogo, gravity: "center" }])
  .png()
  .toFile(resolve(out, "icon-foreground.png"));

// 3) Adaptive Icon Background: Brand-Teal — harmoniert mit Logo-Rand,
//    fallback wenn Launcher keinen Kreis-Mask anwendet
await sharp({
  create: { width: 1024, height: 1024, channels: 4, background: ICON_BG },
})
  .png()
  .toFile(resolve(out, "icon-background.png"));

// 4) Splash: Logo auf ~35% Bildbreite, zentriert auf Brand-Dunkel
const splashLogo = await sharp(src)
  .resize(960, 960, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
  .png()
  .toBuffer();

await sharp({
  create: { width: 2732, height: 2732, channels: 4, background: BG },
})
  .composite([{ input: splashLogo, gravity: "center" }])
  .png()
  .toFile(resolve(out, "splash.png"));

console.log("✓ Assets erzeugt in apps/mobile/assets/");
