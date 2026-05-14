export type ImageFactory = () => HTMLImageElement;

const defaultImageFactory: ImageFactory = () => new Image();

export const DEFAULT_SCROLL_FACTORS = {
  far: 0.08,
  mid: 0.18,
  near: 0.35,
} as const;

// Per-layer fallback box. When the layer image is missing, a filled rectangle
// of this height is drawn bottom-aligned at `baselineY + offsetY`. When the
// image is present, it is drawn at its native size bottom-aligned at the same
// y — uniform pre-scaling at build time keeps the four layers' proportions
// consistent with the source artwork.
//
// `offsetY` is the per-layer vertical nudge relative to the shared horizon.
// Positive = lower (artwork's bottom-edge sinks behind the ground tiles, used
// to bury trunks and break the hard horizon seam). Defaults to 0.
export interface ParallaxLayerLayout {
  fallbackHeight: number;
  fallbackColor: string;
  offsetY?: number;
}

export interface ParallaxLayout {
  canvasWidth: number;
  canvasHeight: number;
  skyColor: string;
  cloudDriftPxPerSecond: number;
  scrollFactors: { far: number; mid: number; near: number };
  baselineY: number;
  layers: {
    clouds: ParallaxLayerLayout;
    far: ParallaxLayerLayout;
    mid: ParallaxLayerLayout;
    near: ParallaxLayerLayout;
  };
}

export const DEFAULT_PARALLAX_LAYOUT: ParallaxLayout = {
  canvasWidth: 640,
  canvasHeight: 360,
  skyColor: '#87ceeb',
  cloudDriftPxPerSecond: 8,
  scrollFactors: { ...DEFAULT_SCROLL_FACTORS },
  // All four layers bottom-align here. Matches the top of the ground strip
  // in DEFAULT_GROUND_LAYOUT.y so the world meets the ground cleanly.
  baselineY: 270,
  layers: {
    clouds: { fallbackHeight: 270, fallbackColor: '#ffffff' },
    far: { fallbackHeight: 180, fallbackColor: '#7b9c6e' },
    mid: { fallbackHeight: 140, fallbackColor: '#558844', offsetY: 10 },
    near: { fallbackHeight: 12, fallbackColor: '#2d5a27', offsetY: 8 },
  },
};

export interface ParallaxImageUrls {
  clouds?: string;
  far?: string;
  mid?: string;
  near?: string;
}

export class ParallaxRenderer {
  private cloudsImg: HTMLImageElement | null = null;
  private farImg: HTMLImageElement | null = null;
  private midImg: HTMLImageElement | null = null;
  private nearImg: HTMLImageElement | null = null;
  private readonly layout: ParallaxLayout;

  constructor(layout: ParallaxLayout = DEFAULT_PARALLAX_LAYOUT) {
    this.layout = layout;
  }

  load(urls: ParallaxImageUrls, imageFactory: ImageFactory = defaultImageFactory): Promise<void> {
    const tasks: Array<Promise<void>> = [];
    if (urls.clouds !== undefined) {
      tasks.push(loadInto(urls.clouds, imageFactory, (img) => { this.cloudsImg = img; }));
    }
    if (urls.far !== undefined) {
      tasks.push(loadInto(urls.far, imageFactory, (img) => { this.farImg = img; }));
    }
    if (urls.mid !== undefined) {
      tasks.push(loadInto(urls.mid, imageFactory, (img) => { this.midImg = img; }));
    }
    if (urls.near !== undefined) {
      tasks.push(loadInto(urls.near, imageFactory, (img) => { this.nearImg = img; }));
    }
    return Promise.all(tasks).then(() => undefined);
  }

  draw(ctx: CanvasRenderingContext2D, progress: number, wallClockMs: number): void {
    const p = clamp01(progress);
    const w = this.layout.canvasWidth;
    const h = this.layout.canvasHeight;
    const baselineY = this.layout.baselineY;

    ctx.fillStyle = this.layout.skyColor;
    ctx.fillRect(0, 0, w, h);

    const cloudOffset = (wallClockMs / 1000) * this.layout.cloudDriftPxPerSecond;
    drawLayer(ctx, this.cloudsImg, this.layout.layers.clouds, w, baselineY, cloudOffset);

    drawLayer(ctx, this.farImg, this.layout.layers.far, w, baselineY, p * this.layout.scrollFactors.far * w);
    drawLayer(ctx, this.midImg, this.layout.layers.mid, w, baselineY, p * this.layout.scrollFactors.mid * w);
    drawLayer(ctx, this.nearImg, this.layout.layers.near, w, baselineY, p * this.layout.scrollFactors.near * w);
  }
}

function loadInto(
  url: string,
  factory: ImageFactory,
  assign: (img: HTMLImageElement) => void,
): Promise<void> {
  return new Promise((resolve) => {
    const img = factory();
    img.onload = (): void => {
      assign(img);
      resolve();
    };
    img.onerror = (): void => {
      resolve();
    };
    img.src = url;
  });
}

function clamp01(v: number): number {
  if (v < 0) return 0;
  if (v > 1) return 1;
  return v;
}

function drawLayer(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement | null,
  layout: ParallaxLayerLayout,
  canvasWidth: number,
  baselineY: number,
  offsetX: number,
): void {
  const anchorY = baselineY + (layout.offsetY ?? 0);
  if (img === null) {
    ctx.fillStyle = layout.fallbackColor;
    ctx.fillRect(0, anchorY - layout.fallbackHeight, canvasWidth, layout.fallbackHeight);
    return;
  }
  if (img.width <= 0 || img.height <= 0) return;
  const tileW = img.width;
  const tileH = img.height;
  const topY = anchorY - tileH;
  const wrapped = ((offsetX % tileW) + tileW) % tileW;
  let x = -wrapped;
  while (x < canvasWidth) {
    ctx.drawImage(img, x, topY);
    x += tileW;
  }
}
