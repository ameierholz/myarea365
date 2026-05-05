#!/usr/bin/env node
/**
 * Pack PNG sequences from `scripts/sprites/_out/<char_id>/<action>/` into
 * a single sprite-atlas + JSON manifest per action, written to
 * `apps/web/public/sprites/<char_id>/<action>.png|json`.
 *
 * Usage:
 *   pnpm tsx scripts/sprites/build_atlas.mjs <char_id>
 *   # e.g. pnpm tsx scripts/sprites/build_atlas.mjs lorekeeper
 *
 * Layout per atlas:
 *   - one row per direction (8 directions = 8 rows)
 *   - one column per frame (e.g. 16 frames = 16 cols)
 *   - frame size = source PNG size (e.g. 128x128)
 *
 * The manifest JSON is consumed by `getSpriteAtlas()` in
 * `apps/web/src/lib/sprite-atlas.ts` (Phase 3a).
 */

import { promises as fs } from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";
import sharp from "sharp";

const charId = process.argv[2];
if (!charId) {
  console.error("Usage: pnpm tsx scripts/sprites/build_atlas.mjs <char_id>");
  process.exit(1);
}

const SRC_BASE = path.resolve("scripts/sprites/_out", charId);
const OUT_BASE = path.resolve("apps/web/public/sprites", charId);

async function exists(p) {
  try { await fs.access(p); return true; } catch { return false; }
}

async function main() {
  if (!(await exists(SRC_BASE))) {
    console.error(`Source dir does not exist: ${SRC_BASE}`);
    console.error("Run the Blender renderer first (see render_sprites.py header).");
    process.exit(1);
  }

  await fs.mkdir(OUT_BASE, { recursive: true });

  const actions = (await fs.readdir(SRC_BASE, { withFileTypes: true }))
    .filter((d) => d.isDirectory())
    .map((d) => d.name);

  if (actions.length === 0) {
    console.error("No action sub-folders found under " + SRC_BASE);
    process.exit(1);
  }

  console.log(`[atlas] ${charId}: ${actions.length} actions to pack`);

  for (const action of actions) {
    await packAction(action);
  }

  console.log(`[atlas] Done — output: ${OUT_BASE}`);
}

async function packAction(action) {
  const srcDir = path.join(SRC_BASE, action);
  const files = (await fs.readdir(srcDir)).filter((f) => f.endsWith(".png")).sort();

  if (files.length === 0) {
    console.warn(`  ${action}: no PNGs, skipped`);
    return;
  }

  // Group by direction: dir0_frame000.png, dir0_frame001.png, …, dir1_frame000.png …
  const grouped = {}; // dir -> [{frame, file}]
  for (const f of files) {
    const m = f.match(/^dir(\d+)_frame(\d+)\.png$/);
    if (!m) { console.warn(`  ${action}: bad filename ${f}, skipped`); continue; }
    const dir = parseInt(m[1], 10);
    const frame = parseInt(m[2], 10);
    grouped[dir] = grouped[dir] || [];
    grouped[dir].push({ frame, file: path.join(srcDir, f) });
  }
  for (const k of Object.keys(grouped)) grouped[k].sort((a, b) => a.frame - b.frame);

  const dirCount = Math.max(...Object.keys(grouped).map(Number)) + 1;
  const frameCount = grouped[0]?.length ?? 0;
  if (dirCount === 0 || frameCount === 0) {
    console.warn(`  ${action}: no usable frames, skipped`);
    return;
  }

  // Read first to determine cell size
  const firstMeta = await sharp(grouped[0][0].file).metadata();
  const cellW = firstMeta.width;
  const cellH = firstMeta.height;
  if (!cellW || !cellH) throw new Error("first frame metadata missing");

  const atlasW = cellW * frameCount;
  const atlasH = cellH * dirCount;
  console.log(`  ${action}: ${dirCount} dirs × ${frameCount} frames @ ${cellW}×${cellH} → atlas ${atlasW}×${atlasH}`);

  // Compose sprite-sheet
  const overlays = [];
  for (let d = 0; d < dirCount; d++) {
    const frames = grouped[d] || [];
    for (let i = 0; i < frames.length; i++) {
      overlays.push({
        input: frames[i].file,
        left: i * cellW,
        top: d * cellH,
      });
    }
  }

  const outPng = path.join(OUT_BASE, `${action}.png`);
  await sharp({
    create: {
      width: atlasW,
      height: atlasH,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  })
    .composite(overlays)
    .png({ compressionLevel: 9 })
    .toFile(outPng);

  // Manifest JSON
  const manifest = {
    char_id: charId,
    action,
    cell_w: cellW,
    cell_h: cellH,
    directions: dirCount,
    frames: frameCount,
    atlas: `/sprites/${charId}/${action}.png`,
    atlas_w: atlasW,
    atlas_h: atlasH,
  };
  await fs.writeFile(
    path.join(OUT_BASE, `${action}.json`),
    JSON.stringify(manifest, null, 2),
  );

  // Try optimizing PNG via pngquant if available — typical 60-80% size reduction.
  try {
    execSync(`pngquant --force --skip-if-larger --output "${outPng}" --quality=70-90 "${outPng}"`, {
      stdio: "ignore",
    });
  } catch {
    // pngquant not installed → skip silently. sharp's compression is fine fallback.
  }

  const finalSize = (await fs.stat(outPng)).size;
  console.log(`     ${(finalSize / 1024).toFixed(1)} KB`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
