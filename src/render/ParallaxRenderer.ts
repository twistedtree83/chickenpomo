export type ImageFactory = () => HTMLImageElement;

const defaultImageFactory: ImageFactory = () => new Image();

export const DEFAULT_SCROLL_FACTORS = {
  far: 0.08,
  mid: 0.18,
  near: 0.35,
} as const;

export interface ParallaxLayerLayout {
  y: number;
  height: number;
  fallbackColor: string;
}

export interface ParallaxLayout {
  canvasWidth: number;
  canvasHeight: number;
  skyColor: string;
  cloudDriftPxPerSecond: number;
  scrollFactors: { far: number; mid: number; near: number };
  layers: {
    clouds: ParallaxLayerLayout;
    far: ParallaxLayerLayout;
    mid: ParallaxLayerLayout;
    near: ParallaxLayerLayout;
  };
}

export const DEFAULT_PARALLAX_LAYOUT: ParallaxLayout = {
  canvasWidth: 320,
  canvasHeight: 180,
  skyColor: '#87ceeb',
  cloudDriftPxPerSecond: 4,
  scrollFactors: { ...DEFAULT_SCROLL_FACTORS },
  layers: {
    clouds: { y: 12, height: 24, fallbackColor: '#ffffff' },
    far: { y: 80, height: 30, fallbackColor: '#7b9c6e' },
    mid: { y: 95, height: 30, fallbackColor: '#558844' },
    near: { y: 115, height: 20, fallbackColor: '#2d5a27' },
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

    ctx.fillStyle = this.layout.skyColor;
    ctx.fillRect(0, 0, w, h);

    const cloudOffset = (wallClockMs / 1000) * this.layout.cloudDriftPxPerSecond;
    drawLayer(ctx, this.cloudsImg, this.layout.layers.clouds, w, cloudOffset);

    drawLayer(ctx, this.farImg, this.layout.layers.far, w, p * this.layout.scrollFactors.far * w);
    drawLayer(ctx, this.midImg, this.layout.layers.mid, w, p * this.layout.scrollFactors.mid * w);
    drawLayer(ctx, this.nearImg, this.layout.layers.near, w, p * this.layout.scrollFactors.near * w);
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
  offsetX: number,
): void {
  if (img === null) {
    ctx.fillStyle = layout.fallbackColor;
    ctx.fillRect(0, layout.y, canvasWidth, layout.height);
    return;
  }
  const tileW = img.width;
  if (tileW <= 0) return;
  const wrapped = ((offsetX % tileW) + tileW) % tileW;
  let x = -wrapped;
  while (x < canvasWidth) {
    ctx.drawImage(img, x, layout.y);
    x += tileW;
  }
}
