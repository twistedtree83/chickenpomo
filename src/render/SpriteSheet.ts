export type ImageFactory = () => HTMLImageElement;

const defaultImageFactory: ImageFactory = () => new Image();

export class SpriteSheet {
  readonly frameWidth: number;
  readonly frameHeight: number;
  readonly frameCount: number;
  private readonly fallbackColor: string;
  private image: HTMLImageElement | null = null;

  constructor(
    frameWidth: number,
    frameHeight: number,
    frameCount: number,
    fallbackColor = '#ff00ff',
  ) {
    if (frameWidth <= 0 || frameHeight <= 0 || frameCount <= 0) {
      throw new Error('SpriteSheet: frameWidth, frameHeight, and frameCount must all be positive');
    }
    this.frameWidth = frameWidth;
    this.frameHeight = frameHeight;
    this.frameCount = frameCount;
    this.fallbackColor = fallbackColor;
  }

  get loaded(): boolean {
    return this.image !== null;
  }

  load(url: string, imageFactory: ImageFactory = defaultImageFactory): Promise<void> {
    return new Promise((resolve) => {
      const img = imageFactory();
      img.onload = (): void => {
        this.image = img;
        resolve();
      };
      img.onerror = (): void => {
        resolve();
      };
      img.src = url;
    });
  }

  drawFrame(
    ctx: CanvasRenderingContext2D,
    frameIndex: number,
    x: number,
    y: number,
  ): void {
    if (this.image === null) {
      ctx.fillStyle = this.fallbackColor;
      ctx.fillRect(x, y, this.frameWidth, this.frameHeight);
      return;
    }
    const safeIndex = ((frameIndex % this.frameCount) + this.frameCount) % this.frameCount;
    const sx = safeIndex * this.frameWidth;
    ctx.drawImage(
      this.image,
      sx,
      0,
      this.frameWidth,
      this.frameHeight,
      x,
      y,
      this.frameWidth,
      this.frameHeight,
    );
  }
}
