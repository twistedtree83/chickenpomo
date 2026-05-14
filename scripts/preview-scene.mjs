#!/usr/bin/env node
// Render a 320x180 preview of the parallax + ground + chicken composition,
// scaled 4x to 1280x720 for inspection. Mirrors ParallaxRenderer's
// bottom-align-at-baseline logic so what you see matches the runtime scene.
import sharp from 'sharp';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const root = dirname(here);
const SPRITES = join(root, 'public', 'sprites');
const W = 640;
const H = 360;
const SKY = { r: 135, g: 206, b: 235 };

const BASELINE_Y = 270; // matches DEFAULT_PARALLAX_LAYOUT.baselineY
// offsetY mirrors DEFAULT_PARALLAX_LAYOUT.layers.*.offsetY — positive sinks
// the layer's bottom edge below the horizon (behind the ground tiles), used
// to bury trunks and break the hard seam where parallax meets ground.
const LAYERS = [
  { file: 'clouds.png', offsetX: 160, offsetY: 0 },
  { file: 'hills-far.png', offsetX: 0, offsetY: 0 },
  { file: 'mid-trees.png', offsetX: 0, offsetY: 10 },
  { file: 'near-grass.png', offsetX: 0, offsetY: 8 },
];

const GROUND_Y = 270;
const GROUND_HEIGHT = 90;
const GROUND_TILE = 32;

const CHICKEN_FRAME_W = 64;
const CHICKEN_FRAME_H = 64;
const CHICKEN_LEFT_MARGIN = 32;
const CHICKEN_RIGHT_MARGIN = 64;
const CHICKEN_Y = 264;
const PROGRESS = 0.6;
const chickenX = Math.round(
  CHICKEN_LEFT_MARGIN + PROGRESS * (W - CHICKEN_LEFT_MARGIN - CHICKEN_RIGHT_MARGIN),
);

async function makeLayerBuffer(file, offsetX) {
  const meta = await sharp(join(SPRITES, file)).metadata();
  const tileW = meta.width;
  const tileH = meta.height;
  const tileBuf = await sharp(join(SPRITES, file)).toBuffer();
  const wrapped = ((offsetX % tileW) + tileW) % tileW;
  // Build a row at least 2*tileW + W wide, then crop the visible region.
  const rowW = tileW + W + tileW;
  const composites = [];
  for (let x = tileW - wrapped; x < tileW + W; x += tileW) {
    composites.push({ input: tileBuf, left: x, top: 0 });
  }
  const buf = await sharp({
    create: { width: rowW, height: tileH, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
  })
    .composite(composites)
    .png()
    .toBuffer();
  return {
    buf: await sharp(buf).extract({ left: tileW, top: 0, width: W, height: tileH }).toBuffer(),
    height: tileH,
  };
}

async function build() {
  const overlays = [];
  for (const layer of LAYERS) {
    const { buf, height } = await makeLayerBuffer(layer.file, layer.offsetX);
    overlays.push({ input: buf, left: 0, top: BASELINE_Y + layer.offsetY - height });
  }

  const grassTile = await sharp(join(SPRITES, 'ground-grass.png')).toBuffer();
  for (let ty = GROUND_Y; ty < GROUND_Y + GROUND_HEIGHT; ty += GROUND_TILE) {
    for (let tx = 0; tx < W; tx += GROUND_TILE) {
      overlays.push({ input: grassTile, left: tx, top: ty });
    }
  }

  const TRAIL_Y = 296;
  const TRAIL_HEIGHT = 32;
  const CELL_W = 8;
  const TRAIL_OFFSET_X = 64;
  const TRAIL_LEN = 68;
  const stampedCells = Math.round(PROGRESS * TRAIL_LEN);
  const dirtTile = await sharp(join(SPRITES, 'ground-dirt.png')).toBuffer();
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

  const chickenBuf = await sharp(join(SPRITES, 'chicken-walk-right.png'))
    .extract({ left: 0, top: 0, width: CHICKEN_FRAME_W, height: CHICKEN_FRAME_H })
    .toBuffer();
  overlays.push({ input: chickenBuf, left: chickenX, top: CHICKEN_Y });

  const base = sharp({
    create: { width: W, height: H, channels: 4, background: { r: SKY.r, g: SKY.g, b: SKY.b, alpha: 1 } },
  });
  const out = await base.composite(overlays).png().toBuffer();
  await sharp(out)
    .resize(W * 2, H * 2, { kernel: 'nearest' })
    .png()
    .toFile(join(root, 'assets', 'preview.png'));
  console.log('wrote assets/preview.png');
}

await build();
