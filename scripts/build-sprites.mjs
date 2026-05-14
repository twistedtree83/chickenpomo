#!/usr/bin/env node
import sharp from 'sharp';
import { mkdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const root = dirname(here);
const ASSETS = join(root, 'assets');
const OUT = join(root, 'public', 'sprites');

await mkdir(OUT, { recursive: true });

const FRAME = 64;
const FRAME_COUNT = 6;

async function findBoundingBox(framesDir) {
  // Compute a shared bounding box across all frames so the figure stays
  // anchored consistently across the animation (no frame-by-frame jitter).
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  let width = 0;
  let height = 0;
  for (let i = 0; i < FRAME_COUNT; i++) {
    const src = join(framesDir, `frame_${String(i).padStart(3, '0')}.png`);
    const img = sharp(src);
    const { data, info } = await img.raw().toBuffer({ resolveWithObject: true });
    width = info.width;
    height = info.height;
    const channels = info.channels;
    for (let y = 0; y < info.height; y++) {
      for (let x = 0; x < info.width; x++) {
        const alpha = data[(y * info.width + x) * channels + (channels - 1)];
        if (alpha > 8) {
          if (x < minX) minX = x;
          if (y < minY) minY = y;
          if (x > maxX) maxX = x;
          if (y > maxY) maxY = y;
        }
      }
    }
  }
  if (!Number.isFinite(minX)) {
    return { left: 0, top: 0, width, height };
  }
  return {
    left: minX,
    top: minY,
    width: maxX - minX + 1,
    height: maxY - minY + 1,
  };
}

async function stitchStrip(framesDir, outName) {
  const bbox = await findBoundingBox(framesDir);
  const composites = [];
  for (let i = 0; i < FRAME_COUNT; i++) {
    const src = join(framesDir, `frame_${String(i).padStart(3, '0')}.png`);
    const buf = await sharp(src)
      .extract({ left: bbox.left, top: bbox.top, width: bbox.width, height: bbox.height })
      .resize(FRAME, FRAME, { kernel: 'nearest', fit: 'inside' })
      .extend({
        top: 0,
        bottom: 0,
        left: 0,
        right: 0,
        background: { r: 0, g: 0, b: 0, alpha: 0 },
      })
      .toBuffer();
    composites.push({ input: buf, left: i * FRAME, top: 0 });
  }
  const outPath = join(OUT, outName);
  await sharp({
    create: {
      width: FRAME * FRAME_COUNT,
      height: FRAME,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  })
    .composite(composites)
    .png()
    .toFile(outPath);
  console.log(`wrote ${outPath}`);
}

const chickenAnim = join(
  ASSETS,
  'A_funny_chicken_that_is_engulfed_in_flames',
  'animations',
);

await stitchStrip(join(chickenAnim, 'animation-48464627', 'east'), 'chicken-walk-right.png');
await stitchStrip(join(chickenAnim, 'animation-48464627', 'west'), 'chicken-walk-left.png');
await stitchStrip(join(chickenAnim, 'Drinking-dc5eeac5', 'south'), 'chicken-idle.png');

// Pass-through copy for the artist-supplied parallax panels in /assets/new/.
// They're already at the target logical width (1280) with proper alpha, so
// no resize / chroma-key / trim step is needed — just re-encode as PNG into
// the public sprites folder.
async function copyPanel(srcRel, outName) {
  const srcPath = join(ASSETS, 'new', srcRel);
  const outPath = join(OUT, outName);
  await sharp(srcPath).png().toFile(outPath);
  console.log(`wrote ${outPath}`);
}

await copyPanel('clouds.png', 'clouds.png');
await copyPanel('hills far.png', 'hills-far.png');
await copyPanel('trees-mid.png', 'mid-trees.png');
await copyPanel('near-grass.png', 'near-grass.png');

// Ground tiles: procedurally generated dithered 32×32 textures. There is no
// dedicated tile artwork in /assets/, and the dirt parallax panel is a wide
// horizon strip (2048×46) that doesn't crop into a tileable square. Seeded
// noise keeps builds reproducible; matched palettes against the
// GroundRenderer fallback colours so the swap looks continuous.
function makeRng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0x100000000;
  };
}

async function generateGroundTile(outName, palette, seed) {
  const size = 32;
  const channels = 4;
  const data = Buffer.alloc(size * size * channels);
  const rand = makeRng(seed);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const n = rand();
      let c;
      if (n < 0.06) c = palette.accent;
      else if (n < 0.20) c = palette.dark;
      else if (n < 0.40) c = palette.light;
      else c = palette.base;
      const i = (y * size + x) * channels;
      data[i] = c.r;
      data[i + 1] = c.g;
      data[i + 2] = c.b;
      data[i + 3] = 255;
    }
  }
  const out = join(OUT, outName);
  await sharp(data, { raw: { width: size, height: size, channels } }).png().toFile(out);
  console.log(`wrote ${out}`);
}

await generateGroundTile('ground-grass.png', {
  base:   { r: 0x4a, g: 0x8a, b: 0x3a },
  light:  { r: 0x5f, g: 0xa6, b: 0x4a },
  dark:   { r: 0x3a, g: 0x70, b: 0x28 },
  accent: { r: 0x2d, g: 0x55, b: 0x20 },
}, 1);

await generateGroundTile('ground-dirt.png', {
  base:   { r: 0x7a, g: 0x52, b: 0x30 },
  light:  { r: 0x8d, g: 0x64, b: 0x40 },
  dark:   { r: 0x5c, g: 0x3e, b: 0x22 },
  accent: { r: 0x3d, g: 0x28, b: 0x14 },
}, 2);

console.log('done');
