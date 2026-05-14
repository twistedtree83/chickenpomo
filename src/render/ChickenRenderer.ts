import { SpriteSheet } from './SpriteSheet';

export type ChickenDirection = 'left' | 'right';

export type NowFn = () => number;

export interface ChickenRendererOptions {
  walkFps?: number;
  idleFps?: number;
  now?: NowFn;
}

const DEFAULT_WALK_FPS = 10;
const DEFAULT_IDLE_FPS = 2;

const defaultNow: NowFn = () =>
  typeof performance !== 'undefined' ? performance.now() : Date.now();

export class ChickenRenderer {
  private readonly walkRight: SpriteSheet;
  private readonly walkLeft: SpriteSheet;
  private readonly idle: SpriteSheet;
  private readonly walkFps: number;
  private readonly idleFps: number;
  private readonly now: NowFn;

  constructor(
    walkRight: SpriteSheet,
    walkLeft: SpriteSheet,
    idle: SpriteSheet,
    options: ChickenRendererOptions = {},
  ) {
    this.walkRight = walkRight;
    this.walkLeft = walkLeft;
    this.idle = idle;
    this.walkFps = options.walkFps ?? DEFAULT_WALK_FPS;
    this.idleFps = options.idleFps ?? DEFAULT_IDLE_FPS;
    this.now = options.now ?? defaultNow;
  }

  draw(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    direction: ChickenDirection,
    isPaused: boolean,
  ): void {
    const sheet = isPaused ? this.idle : direction === 'right' ? this.walkRight : this.walkLeft;
    const fps = isPaused ? this.idleFps : this.walkFps;
    const elapsedSeconds = this.now() / 1000;
    const frameIndex = Math.floor(elapsedSeconds * fps) % sheet.frameCount;
    sheet.drawFrame(ctx, frameIndex, x, y);
  }
}
