#!/usr/bin/env node
// Animation test: renders an animated WebP simulating a full work→break cycle
// so the chicken's walk, position, walk-cycle frame advance, and trail
// stamp/erase mechanic can be verified visually without a browser.
//
// Mirrors the same layout constants used at runtime in SceneRenderer /
// ParallaxRenderer / GroundRenderer / ChickenRenderer so what you see here is
// what the canvas will draw.
import sharp from 'sharp';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { mkdir } from 'node:fs/promises';

const here = dirname(fileURLToPath(import.meta.url));
const root = dirname(here);
const SPRITES = join(root, 'public', 'sprites');
const OUT_DIR = join(root, 'assets');

const W = 640;
const H = 360;
const SKY = { r: 0x87, g: 0xce, b: 0xeb };

const BASELINE_Y = 270;
const LAYERS = [
  { file: 'clouds.png', cloud: true, offsetY: 0 },
  { file: 'hills-far.png', factor: 0.08, offsetY: 0 },
  { file: 'mid-trees.png', factor: 0.18, offsetY: 10 },
  { file: 'near-grass.png', factor: 0.35, offsetY: 8 },
];

const GROUND_Y = 270;
const GROUND_HEIGHT = 90;
const GROUND_TILE = 32;

const CHICKEN_FRAME_W = 64;
const CHICKEN_FRAME_H = 64;
const CHICKEN_FRAMES = 6;
const CHICKEN_LEFT_MARGIN = 32;
const CHICKEN_RIGHT_MARGIN = 64;
const CHICKEN_Y = 276;
const WALK_FPS = 10;

const TRAIL_Y = 296;
const TRAIL_HEIGHT = 32;
const CELL_W = 8;
const TRAIL_OFFSET_X = 32;
const TRAIL_LEN = 68;

const CLOUD_DRIFT_PX_PER_SEC = 8;

// 25-minute work + 5-minute break, simulated at 24 frames per phase.
const FRAMES_PER_PHASE = 24;
const WORK_SECONDS = 25 * 60;
const BREAK_SECONDS = 5 * 60;
const FRAME_DELAY_MS = 80; // ~12 fps playback

const grassTilePromise = sharp(join(SPRITES, 'ground-grass.png')).toBuffer();
const dirtTilePromise = sharp(join(SPRITES, 'ground-dirt.png')).toBuffer();

const layerCache = new Map();
async function getLayerMeta(file) {
  if (!layerCache.has(file)) {
    const meta = await sharp(join(SPRITES, file)).metadata();
    const buf = await sharp(join(SPRITES, file)).toBuffer();
    layerCache.set(file, { meta, buf });
  }
  return layerCache.get(file);
}

async function tiledLayer(file, offsetX) {
  const { meta, buf } = await getLayerMeta(file);
  const tileW = meta.width;
  const tileH = meta.height;
  const wrapped = ((Math.round(offsetX) % tileW) + tileW) % tileW;
  const rowW = tileW + W + tileW;
  const composites = [];
  for (let x = tileW - wrapped; x < tileW + W; x += tileW) {
    composites.push({ input: buf, left: x, top: 0 });
  }
  const wide = await sharp({
    create: {
      width: rowW,
      height: tileH,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  })
    .composite(composites)
    .png()
    .toBuffer();
  const cropped = await sharp(wide)
    .extract({ left: tileW, top: 0, width: W, height: tileH })
    .toBuffer();
  return { buf: cropped, height: tileH };
}

async function chickenFrame(file, frameIndex) {
  return sharp(join(SPRITES, file))
    .extract({
      left: frameIndex * CHICKEN_FRAME_W,
      top: 0,
      width: CHICKEN_FRAME_W,
      height: CHICKEN_FRAME_H,
    })
    .toBuffer();
}

function chickenXForProgress(progress) {
  return Math.round(
    CHICKEN_LEFT_MARGIN +
      progress * (W - CHICKEN_LEFT_MARGIN - CHICKEN_RIGHT_MARGIN),
  );
}

async function buildFrame({ phase, progress, elapsedMs }) {
  const overlays = [];

  // Parallax layers.
  for (const layer of LAYERS) {
    const offsetX = layer.cloud
      ? (elapsedMs / 1000) * CLOUD_DRIFT_PX_PER_SEC
      : progress * (W * layer.factor);
    const { buf, height } = await tiledLayer(layer.file, offsetX);
    overlays.push({
      input: buf,
      left: 0,
      top: BASELINE_Y + (layer.offsetY ?? 0) - height,
    });
  }

  // Ground tiles.
  const grassTile = await grassTilePromise;
  for (let ty = GROUND_Y; ty < GROUND_Y + GROUND_HEIGHT; ty += GROUND_TILE) {
    for (let tx = 0; tx < W; tx += GROUND_TILE) {
      overlays.push({ input: grassTile, left: tx, top: ty });
    }
  }

  // Trail. Work stamps forward; break erases backward (= work-stamped minus
  // the portion the chicken has already revisited on its return trip).
  const dirtTile = await dirtTilePromise;
  let stampedCells;
  if (phase === 'work') {
    stampedCells = Math.round(progress * TRAIL_LEN);
  } else {
    // During break, progress runs 0→1 right→left; dirt remaining = (1-progress)
    stampedCells = Math.round((1 - progress) * TRAIL_LEN);
  }
  for (let i = 0; i < stampedCells; i++) {
    const destX = TRAIL_OFFSET_X + i * CELL_W;
    const srcX = ((destX % GROUND_TILE) + GROUND_TILE) % GROUND_TILE;
    const sliceW = Math.min(CELL_W, GROUND_TILE - srcX);
    const slice1 = await sharp(dirtTile)
      .extract({ left: srcX, top: 0, width: sliceW, height: TRAIL_HEIGHT })
      .toBuffer();
    overlays.push({ input: slice1, left: destX, top: TRAIL_Y });
    if (sliceW < CELL_W) {
      const slice2 = await sharp(dirtTile)
        .extract({ left: 0, top: 0, width: CELL_W - sliceW, height: TRAIL_HEIGHT })
        .toBuffer();
      overlays.push({ input: slice2, left: destX + sliceW, top: TRAIL_Y });
    }
  }

  // Chicken: x = progress along left→right for work, 1-progress for break.
  // Walk-cycle frame index follows ChickenRenderer's rule: floor(elapsed_s × fps) % frames.
  const chickenX =
    phase === 'work'
      ? chickenXForProgress(progress)
      : chickenXForProgress(1 - progress);
  const sheet = phase === 'work' ? 'chicken-walk-right.png' : 'chicken-walk-left.png';
  const walkFrame = Math.floor((elapsedMs / 1000) * WALK_FPS) % CHICKEN_FRAMES;
  const chickenBuf = await chickenFrame(sheet, walkFrame);
  overlays.push({ input: chickenBuf, left: chickenX, top: CHICKEN_Y });

  const base = sharp({
    create: {
      width: W,
      height: H,
      channels: 4,
      background: { r: SKY.r, g: SKY.g, b: SKY.b, alpha: 1 },
    },
  });
  return base.composite(overlays).png().toBuffer();
}

function rawFromPng(buf) {
  return sharp(buf).raw().toBuffer({ resolveWithObject: true });
}

async function buildAnimation() {
  const frames = [];

  // Work phase: progress 0 → 1 over WORK_SECONDS.
  for (let i = 0; i < FRAMES_PER_PHASE; i++) {
    const progress = i / (FRAMES_PER_PHASE - 1);
    const elapsedMs = progress * WORK_SECONDS * 1000;
    const png = await buildFrame({ phase: 'work', progress, elapsedMs });
    frames.push(png);
    process.stdout.write(`work ${i + 1}/${FRAMES_PER_PHASE}\r`);
  }
  // Break phase: progress 0 → 1 over BREAK_SECONDS, chicken right→left.
  for (let i = 0; i < FRAMES_PER_PHASE; i++) {
    const progress = i / (FRAMES_PER_PHASE - 1);
    const elapsedMs =
      WORK_SECONDS * 1000 + progress * BREAK_SECONDS * 1000;
    const png = await buildFrame({ phase: 'break', progress, elapsedMs });
    frames.push(png);
    process.stdout.write(`break ${i + 1}/${FRAMES_PER_PHASE}\r`);
  }
  process.stdout.write('\n');

  // Stack frames into one tall image; emit as animated WebP via pageHeight.
  // WebP caps page-stacked height at 16383, so downscale each frame ×0.5
  // before stacking — visual fidelity is plenty for an animation smoke test.
  const ANIM_SCALE = 0.5;
  const animW = Math.round(W * ANIM_SCALE);
  const animH = Math.round(H * ANIM_SCALE);
  const resized = await Promise.all(
    frames.map((png) =>
      sharp(png).resize(animW, animH, { kernel: 'nearest' }).png().toBuffer(),
    ),
  );
  const rawFrames = await Promise.all(resized.map(rawFromPng));
  const { info } = rawFrames[0];
  const stacked = Buffer.concat(rawFrames.map((r) => r.data));
  const totalHeight = info.height * frames.length;

  await mkdir(OUT_DIR, { recursive: true });
  const outPath = join(OUT_DIR, 'animation-test.webp');
  await sharp(stacked, {
    raw: {
      width: info.width,
      height: totalHeight,
      channels: info.channels,
    },
    animated: true,
    pageHeight: info.height,
  })
    .webp({ quality: 80, effort: 4, loop: 0, delay: FRAME_DELAY_MS })
    .toFile(outPath);

  // Also dump a contact-sheet PNG for static viewing.
  const COLS = 6;
  const ROWS = Math.ceil(frames.length / COLS);
  const SCALE = 0.5;
  const cellW = Math.round(W * SCALE);
  const cellH = Math.round(H * SCALE);
  const sheetComposites = await Promise.all(
    frames.map(async (png, idx) => {
      const col = idx % COLS;
      const row = Math.floor(idx / COLS);
      const resized = await sharp(png)
        .resize(cellW, cellH, { kernel: 'nearest' })
        .png()
        .toBuffer();
      return { input: resized, left: col * cellW, top: row * cellH };
    }),
  );
  const sheetPath = join(OUT_DIR, 'animation-test-sheet.png');
  await sharp({
    create: {
      width: cellW * COLS,
      height: cellH * ROWS,
      channels: 4,
      background: { r: 0x22, g: 0x22, b: 0x22, alpha: 1 },
    },
  })
    .composite(sheetComposites)
    .png()
    .toFile(sheetPath);

  console.log(`wrote ${outPath}`);
  console.log(`wrote ${sheetPath}`);
}

await buildAnimation();
