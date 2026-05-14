import type { Cell } from '../engine/TrailModel';

export type ImageFactory = () => HTMLImageElement;

const defaultImageFactory: ImageFactory = () => new Image();

export interface GroundLayout {
  canvasWidth: number;
  y: number;
  height: number;
  tileSize: number;
  trailY: number;
  trailHeight: number;
  cellWidth: number;
  trailOffsetX: number;
  grassFallbackColor: string;
  dirtFallbackColor: string;
}

export const DEFAULT_GROUND_LAYOUT: GroundLayout = {
  canvasWidth: 640,
  y: 270,
  height: 90,
  tileSize: 32,
  trailY: 296,
  trailHeight: 32,
  cellWidth: 8,
  // Trail leading edge sits under the chicken's feet (sprite center). The
  // chicken's top-left x ranges over [chickenLeftMargin, canvasWidth -
  // chickenRightMargin] = [32, 576], so its feet center ranges over [64, 608].
  // trailOffsetX matches that lower bound; trail length is unchanged
  // (68 cells × 8 px = 544), so the trailing edge lands at 608 = max foot x.
  trailOffsetX: 64,
  grassFallbackColor: '#4a8a3a',
  dirtFallbackColor: '#7a5230',
};

export interface GroundImageUrls {
  grass?: string;
  dirt?: string;
}

export class GroundRenderer {
  private grassImg: HTMLImageElement | null = null;
  private dirtImg: HTMLImageElement | null = null;
  private readonly layout: GroundLayout;

  constructor(layout: GroundLayout = DEFAULT_GROUND_LAYOUT) {
    this.layout = layout;
  }

  load(urls: GroundImageUrls, imageFactory: ImageFactory = defaultImageFactory): Promise<void> {
    const tasks: Array<Promise<void>> = [];
    if (urls.grass !== undefined) {
      tasks.push(loadInto(urls.grass, imageFactory, (img) => { this.grassImg = img; }));
    }
    if (urls.dirt !== undefined) {
      tasks.push(loadInto(urls.dirt, imageFactory, (img) => { this.dirtImg = img; }));
    }
    return Promise.all(tasks).then(() => undefined);
  }

  draw(ctx: CanvasRenderingContext2D, cells: ReadonlyArray<Cell>): void {
    this.drawGrass(ctx);
    this.drawTrail(ctx, cells);
  }

  private drawGrass(ctx: CanvasRenderingContext2D): void {
    const { canvasWidth, y, height, tileSize, grassFallbackColor } = this.layout;
    if (this.grassImg === null) {
      ctx.fillStyle = grassFallbackColor;
      ctx.fillRect(0, y, canvasWidth, height);
      return;
    }
    for (let ty = y; ty < y + height; ty += tileSize) {
      for (let tx = 0; tx < canvasWidth; tx += tileSize) {
        ctx.drawImage(this.grassImg, tx, ty);
      }
    }
  }

  private drawTrail(ctx: CanvasRenderingContext2D, cells: ReadonlyArray<Cell>): void {
    const { trailY, trailHeight, cellWidth, trailOffsetX, tileSize, dirtFallbackColor } = this.layout;
    for (let i = 0; i < cells.length; i++) {
      if (cells[i] !== 'dirt') continue;
      const destX = trailOffsetX + i * cellWidth;
      if (this.dirtImg === null) {
        ctx.fillStyle = dirtFallbackColor;
        ctx.fillRect(destX, trailY, cellWidth, trailHeight);
        continue;
      }
      const srcX = ((destX % tileSize) + tileSize) % tileSize;
      const sliceW = Math.min(cellWidth, tileSize - srcX);
      ctx.drawImage(
        this.dirtImg,
        srcX,
        0,
        sliceW,
        trailHeight,
        destX,
        trailY,
        sliceW,
        trailHeight,
      );
      if (sliceW < cellWidth) {
        ctx.drawImage(
          this.dirtImg,
          0,
          0,
          cellWidth - sliceW,
          trailHeight,
          destX + sliceW,
          trailY,
          cellWidth - sliceW,
          trailHeight,
        );
      }
    }
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
